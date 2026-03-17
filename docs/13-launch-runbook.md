# Polyforge — Launch Runbook

> Step-by-step guide for deploying Polyforge to production and going live in invite-only mode.

---

## Prerequisites

- [ ] AWS account with admin IAM credentials (`aws configure` done, `aws sts get-caller-identity` passes)
- [ ] Domain `polyforge.app` registered and nameservers pointing to your DNS provider
- [ ] EC2 key pair created: `aws ec2 create-key-pair --key-name polyforge-prod ...` → `~/.ssh/polyforge.pem`
- [ ] SES production access requested (or already approved)
- [ ] Polymarket Builder Program API keys in hand
- [ ] Telegram bot token (or set to `dev-disabled` for launch)
- [ ] Discord bot token (or set to `dev-disabled` for launch)

---

## Step 1 — Bootstrap Terraform State Backend (one-time)

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

---

## Step 2 — Configure Terraform Variables

```bash
cd infra/terraform
cp terraform.tfvars.example prod.tfvars
```

Edit `prod.tfvars` and fill in every `CHANGE_ME` / `GENERATE_WITH` value:

| Variable | How to get it |
|----------|---------------|
| `ec2_ami` | `aws ec2 describe-images --owners amazon --filters "Name=name,Values=al2023-ami-*-x86_64" --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text` |
| `db_password` | `openssl rand -base64 32` |
| `admin_db_password` | `openssl rand -base64 32` |
| `redis_auth_token` | `openssl rand -base64 32` (no special chars: `openssl rand -hex 24`) |
| `app_secrets.JWT_SECRET` | `openssl rand -base64 64` |
| `app_secrets.ADMIN_JWT_SECRET` | `openssl rand -base64 64` |
| `app_secrets.INTERNAL_JWT_SECRET` | `openssl rand -base64 64` |
| `app_secrets.ENCRYPTION_KEK` | `openssl rand -hex 32` (32 bytes = 64 hex chars) |
| `app_secrets.POLYMARKET_API_KEY` | From Builder Program dashboard |
| `app_secrets.POLYMARKET_SECRET` | From Builder Program dashboard |
| `app_secrets.POLYMARKET_PASSPHRASE` | From Builder Program dashboard |
| `admin_cidr_blocks` | Your office/VPN IP(s) in CIDR notation |

---

## Step 3 — Apply Infrastructure (~15 minutes)

```bash
cd infra/terraform
terraform init
terraform plan -var-file=prod.tfvars   # review — no surprises
terraform apply -var-file=prod.tfvars
```

Note the outputs — you'll need them throughout this runbook:

```bash
terraform output ec2_elastic_ip       # → A record for polyforge.app + admin.polyforge.app
terraform output ses_dkim_tokens      # → 3 CNAME records
terraform output ses_verification_token  # if needed
terraform output ecr_registry         # e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com
terraform output dns_records_to_add   # full checklist
```

---

## Step 4 — DNS Records

Add the following records at your DNS provider (use `terraform output dns_records_to_add` for exact values):

| Type | Host | Value |
|------|------|-------|
| A | `polyforge.app` | `<ec2_elastic_ip>` |
| A | `admin.polyforge.app` | `<ec2_elastic_ip>` |
| CNAME | `_domainkey1.polyforge.app` | `<ses_dkim_token_1>` |
| CNAME | `_domainkey2.polyforge.app` | `<ses_dkim_token_2>` |
| CNAME | `_domainkey3.polyforge.app` | `<ses_dkim_token_3>` |
| TXT | `polyforge.app` | `"v=spf1 include:amazonses.com ~all"` |
| TXT | `_dmarc.polyforge.app` | `"v=DMARC1; p=quarantine; rua=mailto:admin@polyforge.app"` |

Wait for propagation (typically 5–30 minutes). Verify:

```bash
dig +short polyforge.app          # should return <ec2_elastic_ip>
dig +short admin.polyforge.app    # same IP
```

---

## Step 5 — SES Verification

```bash
aws ses verify-domain-identity --domain polyforge.app --region us-east-1
```

If SES is still in sandbox, submit a production access request in the AWS console (Support → Service Quotas → SES → Sending Limits). This can take 24–48 hours.

---

## Step 6 — Build & Push Docker Images

```bash
EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

bash scripts/deploy.sh --push-only
```

This will:
1. Log in to ECR
2. Create all 13 ECR repos (idempotent)
3. Build and push all service images tagged `latest`

Expected time: ~10–20 minutes (first push, layers not cached).

---

## Step 7 — SSH to EC2 and Issue TLS Certificates

```bash
EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
```

On the EC2 instance:

```bash
# Wait for user_data to finish (Docker should be installed)
docker --version   # confirm Docker is running

# Issue certs (requires DNS to propagate first)
sudo CERTBOT_EMAIL=admin@polyforge.app bash /opt/polyforge/scripts/issue-certs.sh
```

Verify certs were issued:

```bash
ls /etc/letsencrypt/live/polyforge.app/
# fullchain.pem  privkey.pem  ...
```

Exit the SSH session.

---

## Step 8 — Full Deploy

```bash
EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

bash scripts/deploy.sh
```

The deploy script:
1. Pushes images (skips build, already done in step 6)
2. SSHs to EC2
3. Runs `fetch-secrets.sh` to pull secrets from AWS Secrets Manager → `/opt/polyforge/.env.prod`
4. Pulls images from ECR
5. Performs rolling restart in safe order:
   - Background workers first (market-data, notification, bot)
   - Pipeline (strategy-engine, order-service, paper-order-service, backtest)
   - Signer (isolated network)
   - User-facing APIs (api-service, auth-service)
   - Admin services
   - Gateway last

---

## Step 9 — Smoke Test Production

```bash
EC2_HOST=$(cd infra/terraform && terraform output -raw ec2_elastic_ip)

# Health checks
curl -s https://polyforge.app/auth/v1/health | jq .
curl -s https://polyforge.app/api/v1/health | jq .
curl -s https://admin.polyforge.app/auth/v1/health | jq .
curl -s https://admin.polyforge.app/api/v1/health | jq .

# TLS certificate check
echo | openssl s_client -connect polyforge.app:443 -servername polyforge.app 2>/dev/null \
  | openssl x509 -noout -dates

# Angular apps load
curl -sI https://polyforge.app/ | grep -E "HTTP|Content-Type"
curl -sI https://admin.polyforge.app/ | grep -E "HTTP|Content-Type"
```

---

## Step 10 — Run Database Migrations

SSH to EC2 and run Prisma migrations against the live RDS instance:

```bash
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST

# Migrations run automatically via the migrations container in docker-compose.prod.yml
# Verify they completed:
docker logs polyforge_migrations --tail 50

# If needed, run manually:
cd /opt/polyforge
docker run --rm --env-file .env.prod \
  <ecr_registry>/polyforge-auth-service:latest \
  npx prisma migrate deploy
```

---

## Step 11 — Confirm SNS Alert Subscription

Check the `alert_email` inbox for an AWS SNS confirmation email and click the confirmation link.

Test an alarm fires correctly:

```bash
aws cloudwatch set-alarm-state \
  --alarm-name "polyforge-prod-ec2-cpu-high" \
  --state-value ALARM \
  --state-reason "test" \
  --region us-east-1
# Wait ~1 minute — should receive email
aws cloudwatch set-alarm-state \
  --alarm-name "polyforge-prod-ec2-cpu-high" \
  --state-value OK \
  --state-reason "test reset"
```

---

## Step 12 — Generate Initial Invite Codes

Use the admin panel or API to generate the first batch of invite codes:

### Via Admin API

```bash
ADMIN_TOKEN="<admin_jwt>"  # log in to admin panel first

# Generate 20 single-use codes (7-day TTL)
curl -s -X POST https://admin.polyforge.app/api/v1/invites \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 20, "uses": 1, "ttlDays": 7}' | jq .

# List active codes
curl -s https://admin.polyforge.app/api/v1/invites \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### Enable Invite-Only Mode

Set `INVITE_ONLY=true` in `/opt/polyforge/.env.prod` on the EC2 instance, then restart auth-service:

```bash
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
sudo sed -i 's/INVITE_ONLY=false/INVITE_ONLY=true/' /opt/polyforge/.env.prod
# Or add the line if not present:
echo "INVITE_ONLY=true" | sudo tee -a /opt/polyforge/.env.prod

cd /opt/polyforge
docker compose -f docker-compose.prod.yml restart auth-service
docker compose -f docker-compose.prod.yml logs auth-service --tail 20
```

---

## Step 13 — Register First Admin User

```bash
# Create admin user directly in admin DB (or use a seed script)
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST

docker exec -it polyforge_admin-auth-service sh -c \
  "npx ts-node scripts/create-admin.ts --email admin@polyforge.app --password <strong-password>"
```

Then log in at `https://admin.polyforge.app`.

---

## Rollback Procedure

If anything goes wrong during deploy:

```bash
# Roll back to previous image tag
bash scripts/deploy.sh --tag <previous-tag> --deploy-only

# Or restart individual service
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
cd /opt/polyforge
docker compose -f docker-compose.prod.yml restart auth-service

# View logs
docker compose -f docker-compose.prod.yml logs auth-service --tail 100 -f
```

---

## Post-Launch Monitoring Checklist

- [ ] CloudWatch dashboard shows green: `terraform output cloudwatch_dashboard_url`
- [ ] No alarms in ALARM state: `aws cloudwatch describe-alarms --state-value ALARM --region us-east-1`
- [ ] SES delivery rate > 95% (check CloudWatch SES metrics)
- [ ] Auth-service error rate < 0.1% (CloudWatch `AppErrorCount` metric)
- [ ] RDS CPU < 30%, storage > 80 GB free
- [ ] Redis memory < 50%
- [ ] EC2 CPU < 40% under normal load

---

## Key URLs

| Resource | URL |
|----------|-----|
| User app | https://polyforge.app |
| Admin panel | https://admin.polyforge.app |
| CloudWatch dashboard | `terraform output cloudwatch_dashboard_url` |
| AWS Console | https://us-east-1.console.aws.amazon.com |
