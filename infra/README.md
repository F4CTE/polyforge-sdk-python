# Polyforge — AWS Infrastructure

Terraform manages all AWS resources for the production environment.

## Architecture

```
Internet → EC2 c5.2xlarge (Elastic IP)
               ├── docker-compose.prod.yml (13 NestJS services + Nginx gateway)
               │   ├── gateway (Nginx: SSL, routing, static Angular apps)
               │   ├── auth-service, api-service  (public network)
               │   ├── admin-auth-service, admin-api-service (admin-only network)
               │   ├── strategy-engine, order-service, signer-service
               │   ├── market-data-service, paper-order-service, backtest-service
               │   └── notification-service, bot-service
               │
               ├── AWS RDS PostgreSQL 16 + TimescaleDB (private subnet, Multi-AZ)
               │   ├── database: polyforge       (user data)
               │   └── database: polyforge_admin (admin data)
               │
               └── AWS ElastiCache Redis 7 (private subnet, TLS + AUTH)

Other AWS services:
  ECR           — 13 Docker image repositories
  Secrets Manager — JWT secrets, encryption keys, builder creds, DB URLs
  SES           — transactional email (noreply@polyforge.app)
  CloudWatch    — logs (/polyforge/prod), 9 metric alarms, dashboard
```

## Prerequisites

1. **Terraform ≥ 1.7**
   ```bash
   brew install terraform
   ```

2. **AWS CLI configured** with an IAM user/role that has admin access
   ```bash
   aws configure
   aws sts get-caller-identity
   ```

3. **Bootstrap state backend** (one-time — run before first `terraform init`):
   ```bash
   aws s3api create-bucket --bucket polyforge-terraform-state --region us-east-1
   aws s3api put-bucket-versioning \
       --bucket polyforge-terraform-state \
       --versioning-configuration Status=Enabled
   aws dynamodb create-table \
       --table-name polyforge-terraform-locks \
       --attribute-definitions AttributeName=LockID,AttributeType=S \
       --key-schema AttributeName=LockID,KeyType=HASH \
       --billing-mode PAY_PER_REQUEST
   ```

4. **EC2 key pair** — create in AWS console or CLI:
   ```bash
   aws ec2 create-key-pair --key-name polyforge-prod \
       --query 'KeyMaterial' --output text > ~/.ssh/polyforge.pem
   chmod 600 ~/.ssh/polyforge.pem
   ```

## Deploy

```bash
cd infra/terraform

# 1. Initialize
terraform init

# 2. Create prod.tfvars from the example and fill in all values
cp terraform.tfvars.example prod.tfvars
# edit prod.tfvars — fill all CHANGE_ME / GENERATE_WITH values

# 3. Plan
terraform plan -var-file=prod.tfvars

# 4. Apply (~10-15 minutes: RDS Multi-AZ takes the longest)
terraform apply -var-file=prod.tfvars
```

## After `terraform apply`

Terraform outputs the values you need for the next steps:

```bash
terraform output ec2_elastic_ip      # → Set A records in DNS
terraform output ses_dkim_tokens     # → Add 3 CNAME records
terraform output ses_verification_token  # → Add TXT record
terraform output ecr_registry        # → Use in deploy.sh
terraform output dns_records_to_add  # → Full DNS checklist
```

### Full post-apply checklist

1. **Set DNS records** — use `terraform output dns_records_to_add`
2. **Verify SES domain** — wait for DNS to propagate, then:
   ```bash
   aws ses verify-domain-identity --domain polyforge.app
   ```
3. **Request SES production access** — SES starts in sandbox (only verified emails can receive). Submit a production access request in the AWS console.
4. **SSH to EC2 and issue SSL certs**:
   ```bash
   ssh -i ~/.ssh/polyforge.pem ec2-user@$(terraform output -raw ec2_elastic_ip)
   sudo CERTBOT_EMAIL=admin@polyforge.app bash /opt/polyforge/scripts/issue-certs.sh
   ```
5. **Deploy the application**:
   ```bash
   EC2_HOST=$(terraform output -raw ec2_elastic_ip) \
   AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text) \
   bash scripts/deploy.sh
   ```
6. **Confirm SNS alert subscription** — check the alert_email inbox for an AWS SNS confirmation email.

## Resources created

| Resource | Type | Notes |
|----------|------|-------|
| VPC + subnets | `aws_vpc` | 2 public + 2 private subnets |
| Security groups | `aws_security_group` | EC2, RDS, Redis |
| EC2 instance | `c5.2xlarge` | 8 vCPU, 16 GB, 80 GB gp3 EBS |
| Elastic IP | `aws_eip` | Static IP for DNS |
| RDS PostgreSQL 16 | `db.r6g.large` | Multi-AZ, TimescaleDB, 100 GB gp3 |
| ElastiCache Redis 7 | `cache.r7g.large` | TLS + AUTH, AOF persistence |
| ECR repositories | 13× | Lifecycle: keep last 10 tagged |
| Secrets Manager | 2 secrets | App secrets + DB URLs |
| SES domain identity | — | DKIM + SPF + DMARC |
| CloudWatch log group | `/polyforge/prod` | 30-day retention |
| CloudWatch alarms | 9 alarms | Memory, CPU, RDS, Redis, SES, errors |
| CloudWatch dashboard | — | 6 panels |
| SNS topic | — | Email alerts |
| IAM role | — | EC2: ECR pull + Secrets read + CW logs |

## Estimated monthly cost (us-east-1)

| Resource | Cost/month |
|----------|-----------|
| EC2 c5.2xlarge | ~$280 |
| RDS db.r6g.large Multi-AZ | ~$230 |
| ElastiCache cache.r7g.large | ~$120 |
| EBS 80 GB gp3 | ~$7 |
| ECR (storage + transfer) | ~$5 |
| Elastic IP (associated) | $0 |
| SES (per email) | ~$1 per 1K emails |
| Secrets Manager | ~$1 |
| CloudWatch | ~$5 |
| **Total** | **~$650/month** |

Use `db.t3.medium` + `cache.t4g.medium` for staging (~$80/month total for RDS+Redis).
