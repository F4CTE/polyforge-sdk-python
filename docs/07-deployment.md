# Polyforge — Production Deployment Guide

> Deploy Polyforge to AWS from scratch.  
> Estimated time: **2–3 hours** (first deployment)

---

## Overview

```
Internet → EC2 (Nginx + 13 services + PgBouncer)
               ↓              ↓
           AWS RDS         ElastiCache
        (PostgreSQL 16)    (Redis 7)
               ↓
         AWS Secrets Manager (all secrets)
         AWS SES             (email)
         AWS ECR             (Docker images)
         AWS CloudWatch      (logs + alarms)
```

---

## Part 1 — AWS Account Setup

### 1.1 — Create an IAM user for deployments

Never use the root AWS account for deployments.

1. IAM → Users → Create User → Name: `polyforge-deploy`
2. Attach policies: `AmazonEC2FullAccess`, `AmazonRDSFullAccess`, `AmazonElastiCacheFullAccess`, `AmazonECR_FullAccess`, `SecretsManagerReadWrite`, `CloudWatchFullAccess`, `AmazonSESFullAccess`
3. Create access key → save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

```bash
aws configure
# Region: us-east-1
# Output format: json
```

### 1.2 — Create the EC2 IAM Role

1. IAM → Roles → Create Role → Trusted entity: EC2
2. Attach: `AmazonEC2ContainerRegistryReadOnly`, `SecretsManagerReadOnlyAccess`, `AmazonSESFullAccess`
3. Name: `polyforge-ec2-role`
4. Add inline policy `polyforge-secrets-access`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
    "Resource": "arn:aws:secretsmanager:*:*:secret:polyforge/*"
  }]
}
```

---

## Part 2 — AWS Secrets Manager

All secrets must be created before services will start. Services fetch their own secrets via the AWS SDK at boot — no secret values go in `.env` files on the server.

```bash
aws secretsmanager create-secret --name polyforge/USER_JWT_SECRET       --secret-string "$(openssl rand -hex 64)"
aws secretsmanager create-secret --name polyforge/ADMIN_JWT_SECRET      --secret-string "$(openssl rand -hex 64)"
aws secretsmanager create-secret --name polyforge/BOT_JWT_SECRET        --secret-string "$(openssl rand -hex 64)"
aws secretsmanager create-secret --name polyforge/INTERNAL_JWT_SECRET   --secret-string "$(openssl rand -hex 64)"
aws secretsmanager create-secret --name polyforge/TOTP_ENCRYPTION_KEY   --secret-string "$(openssl rand -hex 32)"
aws secretsmanager create-secret --name polyforge/MASTER_ENCRYPTION_KEY --secret-string "$(openssl rand -hex 32)"
aws secretsmanager create-secret --name polyforge/POSTGRES_PASSWORD     --secret-string "$(openssl rand -base64 32 | tr -d /=+ | head -c 32)"
aws secretsmanager create-secret --name polyforge/REDIS_PASSWORD        --secret-string "$(openssl rand -base64 32 | tr -d /=+ | head -c 32)"

# After Polymarket Builder Program approval (see 08-polymarket-integration.md):
aws secretsmanager create-secret --name polyforge/POLY_BUILDER_API_KEY    --secret-string "your-builder-api-key"
aws secretsmanager create-secret --name polyforge/POLY_BUILDER_SECRET     --secret-string "your-builder-secret"
aws secretsmanager create-secret --name polyforge/POLY_BUILDER_PASSPHRASE --secret-string "your-builder-passphrase"

# After creating bots (Part 10):
aws secretsmanager create-secret --name polyforge/TELEGRAM_BOT_TOKEN      --secret-string "your-telegram-token"
aws secretsmanager create-secret --name polyforge/DISCORD_BOT_TOKEN       --secret-string "your-discord-token"
aws secretsmanager create-secret --name polyforge/DISCORD_WEBHOOK_SECRET  --secret-string "your-discord-webhook-secret"
```

Verify all secrets exist:
```bash
aws secretsmanager list-secrets \
  --query 'SecretList[?starts_with(Name, `polyforge/`)].Name' --output table
```

---

## Part 3 — RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier polyforge-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16 \
  --master-username poly \
  --master-user-password "$(aws secretsmanager get-secret-value --secret-id polyforge/POSTGRES_PASSWORD --query SecretString --output text)" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-name polymarket \
  --no-publicly-accessible \
  --backup-retention-period 35 \
  --enable-performance-insights \
  --deletion-protection
```

Once the instance is ready, install TimescaleDB:

```bash
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier polyforge-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)

psql -h $RDS_ENDPOINT -U poly -d polymarket -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

Configure the RDS security group to only accept connections from the EC2 security group (port 5432).

---

## Part 4 — ElastiCache Redis

```bash
aws elasticache create-replication-group \
  --replication-group-id polyforge-redis \
  --replication-group-description "Polyforge Redis" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.t3.micro \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "$(aws secretsmanager get-secret-value --secret-id polyforge/REDIS_PASSWORD --query SecretString --output text)"
```

---

## Part 5 — ECR (Docker Image Registry)

```bash
SERVICES=(
  "auth-service" "api-service" "admin-auth-service" "admin-api-service"
  "market-data-service" "strategy-engine" "order-service"
  "paper-order-service" "backtest-service" "notification-service"
  "bot-service" "signer-service"
)

for service in "${SERVICES[@]}"; do
  aws ecr create-repository \
    --repository-name polyforge/$service \
    --image-scanning-configuration scanOnPush=true
done
```

---

## Part 6 — EC2 Instance

### 6.1 — Security group

```bash
SG_ID=$(aws ec2 create-security-group \
  --group-name polyforge-sg \
  --description "Polyforge EC2" \
  --query GroupId --output text)

aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80  --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22  --cidr $(curl -s https://checkip.amazonaws.com)/32
```

### 6.2 — Launch instance

```bash
aws ec2 create-key-pair --key-name polyforge-key --query KeyMaterial --output text > ~/.ssh/polyforge-key.pem
chmod 400 ~/.ssh/polyforge-key.pem

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type t3.medium \
  --key-name polyforge-key \
  --security-group-ids $SG_ID \
  --iam-instance-profile Name=polyforge-ec2-role \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":40,"VolumeType":"gp3"}}]' \
  --query 'Instances[0].InstanceId' --output text)
```

### 6.3 — Allocate Elastic IP

```bash
ALLOC_ID=$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOC_ID
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOC_ID --query 'Addresses[0].PublicIp' --output text)
echo "Elastic IP: $ELASTIC_IP"   # → Use this for DNS A records
```

### 6.4 — Server setup

```bash
ssh -i ~/.ssh/polyforge-key.pem ubuntu@$ELASTIC_IP

sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
sudo apt install docker-compose-plugin certbot python3-certbot-nginx -y

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install

# ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

---

## Part 7 — DNS

```
A    polyforge.app       → <ELASTIC_IP>
A    admin.polyforge.app → <ELASTIC_IP>
```

Verify propagation:
```bash
dig +short polyforge.app
dig +short admin.polyforge.app
```

---

## Part 8 — SSL Certificates (Certbot)

```bash
sudo certbot certonly --standalone \
  -d polyforge.app -d admin.polyforge.app \
  --email admin@polyforge.app \
  --agree-tos --non-interactive

# Auto-renewal cron
sudo crontab -e
# Add:
0 0,12 * * * certbot renew --quiet --deploy-hook "docker exec gateway nginx -s reload" 2>&1 | logger -t certbot
```

---

## Part 9 — AWS SES (Email)

```bash
# Verify domain → get token → add TXT record _amazonses.polyforge.app
aws ses verify-domain-identity --domain polyforge.app
aws ses get-domain-verification-attributes --domains polyforge.app \
  --query 'VerificationAttributes.["polyforge.app"].VerificationToken' --output text

# DKIM → adds 3 CNAME records to DNS
aws ses verify-domain-dkim --domain polyforge.app

# DMARC TXT record: _dmarc.polyforge.app → "v=DMARC1; p=quarantine; rua=mailto:dmarc@polyforge.app"
```

Request SES production access via AWS Console → SES → Account dashboard. Approval takes 24–48 hours.

---

## Part 10 — Telegram & Discord Bots

### Telegram

1. Search `@BotFather` → `/newbot` → Name: `Polyforge` · Username: `polyforgebot`
2. Copy token → `aws secretsmanager create-secret --name polyforge/TELEGRAM_BOT_TOKEN --secret-string "<token>"`

### Discord

1. https://discord.com/developers/applications → New Application → "Polyforge"
2. Bot → Add Bot → Reset Token → save as `polyforge/DISCORD_BOT_TOKEN`
3. OAuth2 → URL Generator → Bot scope → Send Messages, Read Messages → add to server

---

## Part 11 — First Deployment

### 11.1 — Clone and configure

```bash
# On EC2:
cd /opt
sudo git clone git@github.com:your-org/polyforge.git
sudo chown -R ubuntu:ubuntu polyforge
cd polyforge
```

Create `/opt/polyforge/.env.prod`:

```env
NODE_ENV=production
LOG_LEVEL=info
AWS_REGION=us-east-1

DATABASE_URL=postgresql://poly:<password>@<rds-endpoint>:5432/polymarket?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://poly:<password>@<rds-endpoint>:5432/polymarket
REDIS_URL=rediss://:<redis-password>@<elasticache-endpoint>:6379

GAMMA_API_URL=https://gamma-api.polymarket.com
CLOB_API_URL=https://clob.polymarket.com
CLOB_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
DATA_API_URL=https://data-api.polymarket.com

EMAIL_DRIVER=ses
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@polyforge.app

FRONTEND_URL=https://polyforge.app
ADMIN_URL=https://admin.polyforge.app
CORS_ORIGINS=https://polyforge.app
ADMIN_CORS_ORIGINS=https://admin.polyforge.app

CHAIN_ID=137
```

### 11.2 — Run migrations

```bash
docker run --rm \
  -e DATABASE_URL="$DIRECT_DATABASE_URL" \
  -v $(pwd)/prisma:/app/prisma -w /app node:20-alpine \
  sh -c "npm install prisma && npx prisma migrate deploy"
```

### 11.3 — Build and push images (from local machine)

```bash
ECR_BASE=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
GIT_SHA=$(git rev-parse --short HEAD)

for service in auth-service api-service admin-auth-service admin-api-service \
  market-data-service strategy-engine order-service paper-order-service \
  backtest-service notification-service bot-service signer-service; do
  docker build \
    -t $ECR_BASE/polyforge/$service:$GIT_SHA \
    -t $ECR_BASE/polyforge/$service:latest \
    -f services/$service/Dockerfile .
  docker push $ECR_BASE/polyforge/$service:$GIT_SHA
  docker push $ECR_BASE/polyforge/$service:latest
done
```

### 11.4 — Start the stack

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f docker-compose.prod.yml logs -f

# Verify
curl https://polyforge.app/api/v1/health
```

---

## Part 12 — GitHub Actions CI/CD

### CI Pipeline (`.github/workflows/ci.yml`)

The CI pipeline runs on every push/PR to `main`:

| Job | Depends on | What it does |
|-----|-----------|--------------|
| **Lint** | — | ESLint across all packages |
| **Typecheck** | — | `tsc --noEmit` across all packages |
| **Test** | — | Unit tests with coverage (Vitest) |
| **Build** | Lint, Typecheck, Test | Full `pnpm build` + artifact verification |
| **E2E** | Build | Docker Compose up → seed → Playwright (Chromium + Firefox) |

The E2E job builds the full Docker stack, waits for all services to be healthy, seeds test data, runs 60+ Playwright tests across Chromium and Firefox, and uploads Playwright reports + Docker service logs on failure.

### Required repository secrets

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM deploy user key |
| `AWS_SECRET_ACCESS_KEY` | IAM deploy user secret |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | 12-digit account ID |
| `EC2_HOST` | Elastic IP |
| `EC2_SSH_KEY` | Contents of `polyforge-key.pem` |
| `DIRECT_DATABASE_URL` | Direct DB URL (for migrations) |

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run generate:api
      - run: git diff --exit-code apps/user-app/src/app/api apps/admin-app/src/app/api
      - run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push images
        run: |
          ECR_BASE=${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.${{ secrets.AWS_REGION }}.amazonaws.com
          for service in auth-service api-service admin-auth-service admin-api-service \
            market-data-service strategy-engine order-service paper-order-service \
            backtest-service notification-service bot-service signer-service; do
            docker build \
              -t $ECR_BASE/polyforge/$service:${{ github.sha }} \
              -t $ECR_BASE/polyforge/$service:latest \
              -f services/$service/Dockerfile .
            docker push $ECR_BASE/polyforge/$service:${{ github.sha }}
            docker push $ECR_BASE/polyforge/$service:latest
          done

      - name: Run migrations
        run: |
          docker run --rm \
            -e DATABASE_URL="${{ secrets.DIRECT_DATABASE_URL }}" \
            -v $(pwd)/prisma:/app/prisma -w /app node:20-alpine \
            sh -c "npm install prisma && npx prisma migrate deploy"

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /opt/polyforge
            git pull origin main
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
            sleep 15
            curl -f https://polyforge.app/api/v1/health || exit 1
```

---

## Post-Deployment Checklist

```
SSL
  ☐ https://polyforge.app loads without cert warning
  ☐ https://admin.polyforge.app loads without cert warning
  ☐ HTTP → HTTPS redirect works
  ☐ SSL Labs score A or A+

Email
  ☐ Registration email arrives
  ☐ Password reset email arrives
  ☐ SPF/DKIM/DMARC passing (mail-tester.com: 10/10)
  ☐ Not in spam folder

API
  ☐ GET /api/v1/health returns all services healthy
  ☐ WebSocket connection works
  ☐ User can register, log in, browse markets

Polymarket
  ☐ Market data loading (real API, not mock)
  ☐ Builder attribution headers present on orders

Bots
  ☐ /start command works on Telegram
  ☐ /connect flow links account correctly

Monitoring
  ☐ CloudWatch logs flowing for all services
  ☐ All alarms in OK state
  ☐ Admin /health shows all services green

Security
  ☐ admin.polyforge.app requires IP allowlist
  ☐ signer-service not reachable from internet
  ☐ No secrets in environment variables
  ☐ Canary credentials deployed in signer-service
```

---

---

## JWT Secret Rotation (L3 — SOP)

All three JWT secrets (`USER_JWT_SECRET`, `ADMIN_JWT_SECRET`, `INTERNAL_JWT_SECRET`) live in AWS Secrets Manager and are fetched at container startup via `scripts/fetch-secrets.sh`.

### When to rotate

- Suspected credential leak (mandatory, immediately)
- Periodic rotation (recommended: every 90 days)
- Staff offboarding

### Rotation procedure — zero-downtime

Because user JWTs are **7-day** tokens, a hard rotation logs out all users immediately. Follow the grace-period procedure below:

**Step 1 — Add the new secret in Secrets Manager**

```bash
# Generate a strong secret (32+ bytes)
openssl rand -hex 32

# Update in AWS Secrets Manager (do NOT delete the old value yet)
aws secretsmanager update-secret \
  --secret-id polyforge/USER_JWT_SECRET \
  --secret-string "$(openssl rand -hex 32)"
```

**Step 2 — Deploy with dual-secret validation** *(optional grace period)*

If gradual rollout is needed, temporarily configure the JWT strategy to accept tokens signed with either the old or new secret. Once all live tokens have expired (7 days max), remove the old secret acceptance.

For `ADMIN_JWT_SECRET` and `INTERNAL_JWT_SECRET` (1h / 30s TTL), a hard cut-over is fine — sessions expire quickly.

**Step 3 — Rolling restart**

```bash
# Trigger new deployment — containers re-fetch secrets on startup
./scripts/deploy.sh
```

Services read `USER_JWT_SECRET` from environment at startup via `validateEnv()`. Any service that starts without the secret will exit immediately (fail-fast), preventing silent auth bypass.

**Step 4 — Verify**

```bash
# Confirm services are running
docker compose -f docker-compose.prod.yml ps

# Confirm auth works
curl -s -X POST https://polyforge.app/auth/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}' | jq .
```

**Step 5 — Remove old secret from Secrets Manager**

After all tokens signed with the old secret have expired (max 7 days for user JWTs), update Secrets Manager to remove any temporary dual-secret setup.

### `INTERNAL_JWT_SECRET` rotation

Internal JWTs have 30s TTL. A hard rotation is safe — restart all services that use internal auth in one deployment pass.

---

*Previous: [Testing & Practices](./05-testing-and-practices.md) | Next: [Polymarket Integration](./08-polymarket-integration.md)*
