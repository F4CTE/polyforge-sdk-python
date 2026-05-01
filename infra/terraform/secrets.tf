# ─── Polyforge — Secrets Manager ─────────────────────────────────────────────
#
# Two secrets:
#   polyforge/prod/secrets  — JWT secrets, encryption keys, builder creds, bot tokens
#   polyforge/prod/db       — RDS + ElastiCache connection strings
#
# Secret values are stored in Terraform variables (sensitive = true).
# They are never output and never written to plan files in plaintext.
#
# Initial population:
#   terraform apply -var-file=prod.tfvars
#
# Rotation (quarterly for MASTER_ENCRYPTION_KEY):
#   1. Generate new key: openssl rand -hex 32
#   2. Update prod.tfvars
#   3. terraform apply  (updates the secret version)
#   4. Re-encrypt all user credentials with the new key (rotation job — TBD)

# ── App secrets ───────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "app" {
  name                    = "polyforge/prod/secrets"
  description             = "Polyforge prod app secrets — JWT, encryption, builder, bots"
  recovery_window_in_days = 30  # 30-day recovery window before permanent deletion
  tags                    = { Name = "${local.name}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode(merge(var.app_secrets, {
    AWS_SES_REGION  = var.aws_region
    ECR_REGISTRY    = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  }))

  # Prevent Terraform from showing a diff when the secret is rotated externally
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Database connection strings ───────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db" {
  name                    = "polyforge/prod/db"
  description             = "Polyforge prod DB connection strings (RDS + ElastiCache)"
  recovery_window_in_days = 30
  tags                    = { Name = "${local.name}-db-secrets" }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    # RDS — direct connections (used by Prisma migrations + PgBouncer)
    DATABASE_DIRECT_URL       = "postgresql://${var.db_user_username}:${var.db_user_password}@${aws_db_instance.main.endpoint}/polyforge"
    ADMIN_DATABASE_DIRECT_URL = "postgresql://${var.db_admin_username}:${var.db_admin_password}@${aws_db_instance.main.endpoint}/polyforge_admin"

    # ElastiCache — TLS + AUTH token. Uses the replication group's primary
    # endpoint, whose DNS is automatically updated on failover (RTO < 2 min)
    # so application services reconnect transparently via ioredis retryStrategy.
    REDIS_URL = "rediss://:${var.redis_auth_token}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379/0"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Resource policy — restrict to EC2 role only ────────────────────────────────

resource "aws_secretsmanager_secret_policy" "app" {
  secret_arn = aws_secretsmanager_secret.app.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowEC2Role"
      Effect = "Allow"
      Principal = {
        AWS = aws_iam_role.ec2.arn
      }
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = "*"
    }]
  })
}

resource "aws_secretsmanager_secret_policy" "db" {
  secret_arn = aws_secretsmanager_secret.db.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowEC2Role"
      Effect = "Allow"
      Principal = {
        AWS = aws_iam_role.ec2.arn
      }
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = "*"
    }]
  })
}
