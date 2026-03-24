# Polyforge — Production Deployment Guide (End-to-End)

> From zero to running in production. Follow every step in order.
> Estimated time: **3-4 hours** (first deployment, excluding DNS propagation and SES approval)

---

## Prerequisites

Before starting, ensure you have all of the following ready:

| Requirement | Details |
|---|---|
| AWS account | With IAM admin access (or the specific policies listed in [07-deployment.md](./07-deployment.md) Part 1) |
| Domain name | `polyforge.app` registered, with access to DNS records |
| Terraform | >= 1.5 installed (`terraform -version`) |
| Docker + Compose | Docker Desktop 4.x or Docker Engine + Compose v2 (`docker compose version`) |
| AWS CLI v2 | Configured with credentials (`aws sts get-caller-identity`) |
| Node.js 24 + pnpm 9 | For building frontend apps and running migrations locally |
| SSH key pair | Will be created in Step 2, or bring your own |
| Polymarket Builder API keys | From the Builder Program dashboard (see [08-polymarket-integration.md](./08-polymarket-integration.md)) |

---

## Step 1 — Clone and Configure

### 1.1 Clone the repository

```bash
git clone git@github.com:your-org/polyforge.git
cd polyforge
```

### 1.2 Install dependencies

```bash
pnpm install
pnpm --filter "./packages/**" build
```

### 1.3 Prepare secrets for Terraform

You will need to generate several secrets. Do this now and save them somewhere secure (e.g., a password manager):

```bash
# JWT secrets (4 unique values)
openssl rand -hex 32   # USER_JWT_SECRET
openssl rand -hex 32   # ADMIN_JWT_SECRET
openssl rand -hex 32   # BOT_JWT_SECRET
openssl rand -hex 32   # INTERNAL_JWT_SECRET

# Encryption keys (2 unique values, 64 hex chars each)
openssl rand -hex 32   # MASTER_ENCRYPTION_KEY
openssl rand -hex 32   # TOTP_ENCRYPTION_KEY

# Database passwords (2 unique values)
openssl rand -base64 32 | tr -d '/=+' | head -c 24   # db_user_password
openssl rand -base64 32 | tr -d '/=+' | head -c 24   # db_admin_password

# Redis auth token
openssl rand -hex 24   # redis_auth_token (no special characters)
```

Have your Polymarket Builder Program credentials ready:
- `POLY_BUILDER_API_KEY`
- `POLY_BUILDER_SECRET`
- `POLY_BUILDER_PASSPHRASE`
- `BUILDER_TIER` (default: `UNVERIFIED`)

Have your AI API keys ready (required for NL query and strategy-from-description features):
- `ANTHROPIC_API_KEY` (Claude API key)
- `OPENAI_API_KEY` (OpenAI API key)

Have your WhatsApp Business credentials ready (optional, for WhatsApp bot):
- `WHATSAPP_TOKEN` (from Meta Business Platform)
- `WHATSAPP_PHONE_ID` (from Meta WhatsApp Business)
- `WHATSAPP_VERIFY_TOKEN` (random string for webhook verification)
- `WHATSAPP_APP_SECRET` (Meta app secret for X-Hub-Signature-256)

If Telegram/Discord/WhatsApp bots are not ready, use `"dev-disabled"` as a placeholder.

---

## Step 2 — Terraform Infrastructure

### 2.1 Bootstrap the state backend (one-time)

This creates the S3 bucket and DynamoDB table that Terraform uses to store state and locks:

```bash
aws s3api create-bucket --bucket polyforge-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
    --bucket polyforge-terraform-state \
    --versioning-configuration Status=Enabled
aws dynamodb create-table \
    --table-name polyforge-terraform-locks \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```

### 2.2 Configure Terraform variables

```bash
cd infra/terraform
cp terraform.tfvars.example prod.tfvars
```

Edit `prod.tfvars` and replace every `CHANGE_ME` value with the secrets you generated in Step 1.3. Key variables:

| Variable | Value |
|---|---|
| `ec2_key_name` | Name of your EC2 key pair (create one if needed: `aws ec2 create-key-pair --key-name polyforge-prod --query KeyMaterial --output text > ~/.ssh/polyforge.pem && chmod 600 ~/.ssh/polyforge.pem`) |
| `admin_cidr_blocks` | Your IP in CIDR notation, e.g. `["203.0.113.50/32"]` |
| `db_user_password` | Generated password from Step 1.3 |
| `db_admin_password` | Generated password from Step 1.3 |
| `redis_auth_token` | Generated token from Step 1.3 |
| `app_secrets.*` | All JWT secrets, encryption keys, and Polymarket credentials |
| `alert_email` | Email for CloudWatch alarm notifications |

> See `terraform.tfvars.example` for the complete variable list and comments.

### 2.3 Plan and apply

```bash
terraform init
terraform plan -var-file=prod.tfvars     # review the plan carefully
terraform apply -var-file=prod.tfvars    # ~10-15 minutes (RDS Multi-AZ is slowest)
```

### 2.4 Save the outputs

```bash
terraform output ec2_elastic_ip          # Elastic IP for DNS A records
terraform output ses_dkim_tokens         # 3 CNAME records for DKIM
terraform output ses_verification_token  # TXT record for SES verification
terraform output ecr_registry            # ECR registry URL
terraform output dns_records_to_add      # Full DNS checklist
```

Save these values; you will need them in the next steps.

---

## Step 3 — DNS Configuration

Add these records at your DNS provider. Use `terraform output dns_records_to_add` for exact values.

| Type | Host | Value |
|---|---|---|
| A | `polyforge.app` | `<ec2_elastic_ip>` |
| A | `admin.polyforge.app` | `<ec2_elastic_ip>` |
| CNAME | `<dkim1>._domainkey.polyforge.app` | `<ses_dkim_token_1>` |
| CNAME | `<dkim2>._domainkey.polyforge.app` | `<ses_dkim_token_2>` |
| CNAME | `<dkim3>._domainkey.polyforge.app` | `<ses_dkim_token_3>` |
| TXT | `polyforge.app` | `"v=spf1 include:amazonses.com ~all"` |
| TXT | `_dmarc.polyforge.app` | `"v=DMARC1; p=quarantine; rua=mailto:admin@polyforge.app"` |

Verify propagation:

```bash
dig +short polyforge.app            # should return the Elastic IP
dig +short admin.polyforge.app      # same IP
```

> DNS propagation typically takes 5-30 minutes. Do not proceed to Step 5 (SSL) until both records resolve.

---

## Step 4 — EC2 Setup

### 4.1 SSH into the instance

```bash
EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
```

### 4.2 Verify user-data setup completed

Terraform's user-data script installs Docker, Docker Compose, AWS CLI, and clones the repo. Verify:

```bash
docker --version            # Docker should be installed
docker compose version      # Compose v2 should be available
aws --version               # AWS CLI v2
ls /opt/polyforge            # Repo should be cloned here
```

If any of these are missing, install manually following the commands in [07-deployment.md](./07-deployment.md) Part 6.4.

### 4.3 Fetch secrets

The `fetch-secrets.sh` script pulls all secrets from AWS Secrets Manager and writes `/opt/polyforge/.env.prod`:

```bash
sudo bash /opt/polyforge/scripts/fetch-secrets.sh --region us-east-1
```

Verify the file was created:

```bash
wc -l /opt/polyforge/.env.prod   # should have 30+ lines
```

> This script is safe to re-run. It overwrites `.env.prod` each time with fresh values from Secrets Manager.

---

## Step 5 — SSL Certificates

DNS must be propagated before this step (verify with `dig +short polyforge.app`).

### 5.1 Issue certificates

```bash
# On EC2:
sudo CERTBOT_EMAIL=admin@polyforge.app bash /opt/polyforge/scripts/issue-certs.sh
```

This issues certificates for `polyforge.app`, `www.polyforge.app`, and `admin.polyforge.app` using Let's Encrypt standalone mode.

### 5.2 Verify

```bash
ls /etc/letsencrypt/live/polyforge.app/
# Should contain: fullchain.pem  privkey.pem  cert.pem  chain.pem

ls /etc/letsencrypt/live/admin.polyforge.app/
# Same set of files
```

### 5.3 Auto-renewal

The `issue-certs.sh` script installs a daily cron job that checks for renewal and reloads the nginx gateway container on success. Verify:

```bash
crontab -l | grep certbot
# Should show: 0 3 * * * certbot renew ...
```

---

## Step 6 — Database Setup

### 6.1 Run Prisma migrations

From your **local machine** (or from EC2 if `npx` is available):

```bash
# Option A: from local machine with direct RDS access
DATABASE_URL="postgresql://poly:<password>@<rds-endpoint>:5432/polyforge" \
  npx prisma migrate deploy --schema prisma/schema.prisma

ADMIN_DIRECT_DATABASE_URL="postgresql://poly_admin:<password>@<rds-endpoint>:5432/polyforge_admin" \
  npx prisma migrate deploy --schema prisma/schema.admin.prisma
```

```bash
# Option B: from EC2 using the migrations container in docker-compose.prod.yml
# Migrations run automatically when the stack starts (see Step 8)
# Check logs: docker logs polyforge_migrations --tail 50
```

### 6.2 Apply TimescaleDB hypertables

```bash
DATABASE_URL="postgresql://poly:<password>@<rds-endpoint>:5432/polyforge" \
  bash scripts/post-migrate.sh
```

This creates TimescaleDB hypertables for time-series data (price candles, order history, etc.).

### 6.3 Seed the admin account

```bash
# From EC2, after the stack is running (Step 8):
docker exec -it polyforge_admin-auth-service sh -c \
  "npx ts-node scripts/create-admin.ts --email admin@polyforge.app --password '<strong-password>'"
```

Or from your local machine:

```bash
ADMIN_DIRECT_DATABASE_URL="postgresql://poly_admin:<password>@<rds-endpoint>:5432/polyforge_admin" \
  pnpm seed:admin
```

### 6.4 Verify database connectivity

```bash
psql "postgresql://poly:<password>@<rds-endpoint>:5432/polyforge" -c "SELECT count(*) FROM _prisma_migrations;"
```

---

## Step 7 — Build and Push Docker Images

### 7.1 Set environment variables

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
export EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)
```

### 7.2 Build and push

```bash
bash scripts/deploy.sh --push-only
```

This will:
1. Log in to ECR
2. Create all ECR repositories (idempotent)
3. Build all service images (gateway + 12 NestJS services)
4. Tag each image with the current git SHA and `latest`
5. Push all images to ECR

Expected time: 10-20 minutes on first push (layers are not cached).

> The deploy script builds the following services: gateway, auth-service, api-service, admin-auth-service, admin-api-service, market-data-service, strategy-engine, order-service, paper-order-service, backtest-service, notification-service, bot-service, signer-service.

---

## Step 8 — Launch Services

### 8.1 Full deploy

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)

bash scripts/deploy.sh
```

The deploy script SSHs to EC2 and performs a rolling restart in safe order:
1. Refreshes secrets from AWS Secrets Manager
2. Pulls all new images from ECR
3. Restarts background workers (notification, bot, backtest, paper-order)
4. Restarts pipeline services (market-data, strategy-engine, order-service)
5. Restarts signer-service (isolated network)
6. Restarts user-facing APIs (auth-service, api-service)
7. Restarts admin services
8. Restarts the gateway last

### 8.2 Verify containers are healthy

```bash
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
cd /opt/polyforge
docker compose -f docker-compose.prod.yml ps
```

All containers should show `Up` status. Check for startup errors:

```bash
docker compose -f docker-compose.prod.yml logs --tail 20
```

---

## Step 9 — Post-Deployment Verification

Run through each check from your local machine:

### 9.1 Health checks

```bash
curl -s https://polyforge.app/auth/v1/health | jq .
curl -s https://polyforge.app/api/v1/health | jq .
curl -s https://admin.polyforge.app/auth/v1/health | jq .
curl -s https://admin.polyforge.app/api/v1/health | jq .
```

All should return `{"status":"ok"}`.

### 9.2 TLS verification

```bash
echo | openssl s_client -connect polyforge.app:443 -servername polyforge.app 2>/dev/null \
  | openssl x509 -noout -dates

curl -sI https://polyforge.app/ | grep -E "HTTP|Content-Type"
curl -sI https://admin.polyforge.app/ | grep -E "HTTP|Content-Type"
```

### 9.3 Login test

Log in to the admin panel at `https://admin.polyforge.app` with the admin credentials from Step 6.3.

### 9.4 SES email verification

```bash
aws ses verify-domain-identity --domain polyforge.app --region us-east-1
```

If SES is still in sandbox, submit a production access request via the AWS Console (Support > Service Quotas > SES > Sending Limits). Approval takes 24-48 hours.

Test email delivery by registering a test user account (or triggering a password reset).

### 9.5 Market data sync

Verify market data is flowing:

```bash
curl -s https://polyforge.app/api/v1/markets?limit=5 | jq '.data | length'
# Should return > 0 after the market-data-service syncs (allow 2-3 minutes)
```

### 9.6 WebSocket connection

Open `https://polyforge.app` in a browser, open DevTools > Network > WS, and verify a WebSocket connection is established to `/ws`.

### 9.7 CloudWatch

```bash
aws cloudwatch describe-alarms --state-value ALARM --region us-east-1
# Should return no alarms in ALARM state
```

Confirm the SNS alert subscription by checking the `alert_email` inbox for an AWS SNS confirmation email and clicking the link.

### 9.8 Geoblocking verification

Verify that geo-blocked countries receive a 451 response on trading endpoints:

```bash
# From a US IP (or using a VPN exit in a blocked country):
curl -sI https://polyforge.app/api/v1/markets | grep "HTTP"
# Should return 200 (read-only endpoints are NOT blocked)

curl -sI -X POST https://polyforge.app/api/v1/orders | grep "HTTP"
# Should return 451 from a blocked country
```

Verify that public endpoints are accessible from any country:

```bash
curl -s https://polyforge.app/api/v1/docs | head -1
# Should return Swagger JSON (no geo-blocking)

curl -s https://polyforge.app/api/v1/actions | head -1
# Should return actions list (no geo-blocking)
```

Verify the X-Country-Code and X-Region-Code headers are passed through by checking the api-service request logs.

### 9.9 AI features verification

Verify the NL query and strategy-from-description features are operational:

```bash
# Check that the API keys are loaded (via health endpoint extensions)
curl -s https://polyforge.app/api/v1/health | jq '.features'
# Should show ai_query: true if ANTHROPIC_API_KEY or OPENAI_API_KEY is set
```

### 9.10 Webhook verification

For WhatsApp webhook:

```bash
curl -s "https://polyforge.app/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<your-verify-token>&hub.challenge=test"
# Should return "test" (the challenge value)
```

For Telegram webhook, set it via the Bot API:

```bash
curl "https://api.telegram.org/bot<token>/setWebhook?url=https://polyforge.app/api/v1/webhooks/telegram"
```

### 9.11 MCP server verification

The MCP server package (`packages/mcp-server`) lets AI assistants interact with the platform. To verify:

```bash
# Build the MCP server
pnpm --filter @polyforge/mcp-server build

# Test connectivity (requires a running API service)
node packages/mcp-server/dist/index.js --help
```

Configure your AI assistant (e.g., Claude Desktop) with the MCP server endpoint. See `packages/mcp-server/README.md` for configuration details.

### 9.12 Full checklist

See the detailed post-deployment checklist in [07-deployment.md](./07-deployment.md) (Post-Deployment Checklist section) covering SSL, email, API, Polymarket integration, bots, monitoring, and security checks.

---

## Step 10 — Enable Invite-Only Mode

### 10.1 Enable invite-only

Log in to `https://admin.polyforge.app`, go to **Dashboard > Launch Control**, and toggle **"Enable invite-only"**.

Or via API:

```bash
ADMIN_TOKEN="<your-admin-jwt>"

curl -s -X PATCH https://admin.polyforge.app/api/v1/config/invite-only \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' | jq .
```

### 10.2 Generate invite codes

```bash
curl -s -X POST https://admin.polyforge.app/api/v1/invites \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 20, "uses": 1, "ttlDays": 7}' | jq .
```

Or use the **Invites & Waitlist > Invite Codes** tab in the admin panel.

### 10.3 Send invites to waitlist users

In the admin panel, go to **Invites & Waitlist > Waitlist** and click **Send invite** for each user. This generates a single-use code and emails it automatically.

Monitor first signups in the admin panel under **Users**.

---

## Rollback Procedure

### Roll back to a previous image tag

```bash
bash scripts/deploy.sh --tag <previous-git-sha> --deploy-only
```

This pulls the specified image tag from ECR and restarts all services without rebuilding.

### Roll back a single service

```bash
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
cd /opt/polyforge
docker compose -f docker-compose.prod.yml restart <service-name>
docker compose -f docker-compose.prod.yml logs <service-name> --tail 100 -f
```

### Database rollback

Restore from an RDS automated snapshot (taken daily, retained for 35 days):

1. AWS Console > RDS > Snapshots > select snapshot > Restore
2. Update `polyforge/prod/db` in Secrets Manager with the new RDS endpoint
3. Re-run `fetch-secrets.sh` and restart services

See [14-backup-recovery.md](./14-backup-recovery.md) for full database recovery procedures.

---

## Maintenance

### Updating the application

```bash
cd polyforge        # local machine
git pull origin main
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)
bash scripts/deploy.sh
```

Or let GitHub Actions handle it automatically on push to `main` (see [07-deployment.md](./07-deployment.md) Part 12).

### SSL certificate renewal

Automatic via the cron job installed by `issue-certs.sh`. Certbot checks daily at 03:00 and reloads nginx on renewal. No manual action needed.

### Database backups

Automated daily by RDS (35-day retention). Create manual snapshots before major migrations:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier polyforge-db \
  --db-snapshot-identifier "pre-migration-$(date +%Y%m%d)"
```

See [14-backup-recovery.md](./14-backup-recovery.md) for the full backup strategy and recovery procedures.

### Monitoring

- CloudWatch dashboard: `terraform output cloudwatch_dashboard_url`
- Alarm status: `aws cloudwatch describe-alarms --state-value ALARM --region us-east-1`
- Service health: `curl -s https://polyforge.app/api/v1/health | jq .`

### Viewing logs

```bash
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
cd /opt/polyforge

# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f auth-service

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail 100 api-service
```

Logs also stream to CloudWatch under the `/polyforge/prod` log group.

### Secret rotation

See the JWT Secret Rotation SOP in [07-deployment.md](./07-deployment.md) for zero-downtime secret rotation procedures.

---

## Troubleshooting

### Service will not start

```bash
# Check the service logs
docker compose -f docker-compose.prod.yml logs <service> --tail 50

# Check environment variables are loaded
docker compose -f docker-compose.prod.yml exec <service> env | grep -i database

# Verify .env.prod exists and has content
wc -l /opt/polyforge/.env.prod
```

Common causes: missing secrets in `.env.prod` (re-run `fetch-secrets.sh`), ECR image not found (re-run `deploy.sh --push-only`).

### 502 Bad Gateway

The service behind nginx is not running or is still starting. Check:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs gateway --tail 20
docker compose -f docker-compose.prod.yml logs <failed-service> --tail 50
```

If a service is crash-looping, fix the root cause (usually missing env vars or database connectivity), then restart it.

### Database connection failed

```bash
# Verify RDS is reachable from EC2
docker compose -f docker-compose.prod.yml exec auth-service sh -c \
  'nc -zv <rds-endpoint> 5432'

# Check PgBouncer is running
docker compose -f docker-compose.prod.yml logs pgbouncer --tail 20

# Verify credentials in .env.prod
grep DATABASE /opt/polyforge/.env.prod
```

Common causes: security group not allowing EC2-to-RDS traffic on port 5432, incorrect password in Secrets Manager, PgBouncer not started.

### Redis connection refused

```bash
# Verify ElastiCache is reachable
docker compose -f docker-compose.prod.yml exec auth-service sh -c \
  'nc -zv <elasticache-endpoint> 6379'

# Check the REDIS_URL in .env.prod
grep REDIS /opt/polyforge/.env.prod
```

Common causes: `AUTH` password mismatch (regenerate in Secrets Manager and re-fetch), security group blocking port 6379, TLS required but URL uses `redis://` instead of `rediss://`.

### Email not sending

```bash
# Check SES domain verification status
aws ses get-identity-verification-attributes \
  --identities polyforge.app --region us-east-1

# Check DKIM status
aws ses get-identity-dkim-attributes \
  --identities polyforge.app --region us-east-1

# Check if still in sandbox
aws ses get-account --region us-east-1 | jq '.SendingEnabled'
```

Common causes: SES still in sandbox mode (only verified recipients work), DKIM DNS records not propagated, `EMAIL_DRIVER` not set to `ses` in production.

### WebSocket not connecting

```bash
# Check CORS origins in .env.prod
grep CORS /opt/polyforge/.env.prod

# Verify the api-service is running (WebSocket is served by api-service)
docker compose -f docker-compose.prod.yml logs api-service --tail 20
```

Common causes: `CORS_ORIGINS` does not include the frontend URL, nginx not proxying WebSocket upgrade headers (check gateway config), api-service not running.

### Migrations failed

```bash
# Check migration container logs
docker logs polyforge_migrations --tail 50

# Run migrations manually
docker run --rm --env-file .env.prod \
  <ecr_registry>/polyforge-auth-service:latest \
  npx prisma migrate deploy
```

Common causes: database not reachable, previous migration partially applied (check `_prisma_migrations` table), TimescaleDB extension not installed.

---

## Quick Reference

| Action | Command |
|---|---|
| Full deploy | `bash scripts/deploy.sh` |
| Push images only | `bash scripts/deploy.sh --push-only` |
| Deploy without rebuild | `bash scripts/deploy.sh --deploy-only` |
| Roll back | `bash scripts/deploy.sh --tag <sha> --deploy-only` |
| Refresh secrets | `sudo bash scripts/fetch-secrets.sh` |
| Issue SSL certs | `sudo CERTBOT_EMAIL=admin@polyforge.app bash scripts/issue-certs.sh` |
| View service status | `docker compose -f docker-compose.prod.yml ps` |
| View logs | `docker compose -f docker-compose.prod.yml logs -f <service>` |
| Health check | `curl -s https://polyforge.app/api/v1/health \| jq .` |
| Terraform outputs | `cd infra/terraform && terraform output` |

---

*Related docs: [Architecture](./01-architecture.md) | [Deployment (AWS manual)](./07-deployment.md) | [Launch Runbook](./13-launch-runbook.md) | [Backup & Recovery](./14-backup-recovery.md) | [Incident Response](./15-incident-response.md) | [Performance Tuning](./16-performance-tuning.md)*
