# ─── Polyforge — Terraform Variables ─────────────────────────────────────────

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name — used as prefix for all resource names"
  type        = string
  default     = "polyforge"
}

variable "environment" {
  description = "Deployment environment (prod / staging)"
  type        = string
  default     = "prod"
}

# ─── EC2 ──────────────────────────────────────────────────────────────────────

variable "ec2_instance_type" {
  description = "EC2 instance type. c5.2xlarge = 8 vCPU + 16 GB, recommended for prod."
  type        = string
  default     = "c5.2xlarge"
}

variable "ec2_ami" {
  description = "AMI ID — Amazon Linux 2023 (x86_64, us-east-1). Update for other regions."
  type        = string
  default     = "ami-0c101f26f147fa7fd"  # Amazon Linux 2023 us-east-1 (2024-Q1)
}

variable "ec2_key_name" {
  description = "Name of the EC2 key pair for SSH access (must already exist in AWS)"
  type        = string
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks allowed to SSH into EC2 and access admin.polyforge.app"
  type        = list(string)
  # Replace with real office/VPN CIDR(s) before deploying
  default     = ["0.0.0.0/0"]
}

variable "ec2_root_volume_size_gb" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 80
}

# ─── RDS ──────────────────────────────────────────────────────────────────────

variable "rds_instance_class" {
  description = "RDS instance class. db.t3.medium for staging; db.r6g.large for prod."
  type        = string
  default     = "db.r6g.large"
}

variable "rds_allocated_storage_gb" {
  description = "Initial allocated storage for RDS (GB). Auto-scaling enabled."
  type        = number
  default     = 100
}

variable "rds_max_storage_gb" {
  description = "Maximum auto-scaling storage for RDS (GB)"
  type        = number
  default     = 500
}

variable "rds_postgres_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "16"
}

variable "db_user_username" {
  description = "Master username for the user database"
  type        = string
  default     = "poly"
  sensitive   = true
}

variable "db_user_password" {
  description = "Master password for the user database (min 16 chars)"
  type        = string
  sensitive   = true
}

variable "db_admin_username" {
  description = "Master username for the admin database"
  type        = string
  default     = "poly_admin"
  sensitive   = true
}

variable "db_admin_password" {
  description = "Master password for the admin database (min 16 chars)"
  type        = string
  sensitive   = true
}

variable "rds_backup_retention_days" {
  description = "Number of days to retain automated RDS backups"
  type        = number
  default     = 30
}

# ─── ElastiCache ──────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache node type. cache.t4g.medium for staging; cache.r7g.large for prod."
  type        = string
  default     = "cache.r7g.large"
}

variable "redis_auth_token" {
  description = "Redis AUTH token (password) for in-transit encryption"
  type        = string
  sensitive   = true
}

# ─── SES ──────────────────────────────────────────────────────────────────────

variable "ses_domain" {
  description = "Domain to verify with SES for outbound email"
  type        = string
  default     = "polyforge.app"
}

variable "alert_email" {
  description = "Email address that receives CloudWatch alarm notifications"
  type        = string
}

# ─── Secrets Manager ──────────────────────────────────────────────────────────

variable "app_secrets" {
  description = <<-EOT
    Map of application secret key/value pairs stored in Secrets Manager.
    All values are sensitive. Fill before first apply.
    See scripts/fetch-secrets.sh for expected key names.
  EOT
  type = object({
    USER_JWT_SECRET          = string
    ADMIN_JWT_SECRET         = string
    BOT_JWT_SECRET           = string
    INTERNAL_JWT_SECRET      = string
    MASTER_ENCRYPTION_KEY    = string  # 64 hex chars (32 bytes)
    TOTP_ENCRYPTION_KEY      = string  # 64 hex chars (32 bytes)
    POLY_BUILDER_API_KEY     = string
    POLY_BUILDER_SECRET      = string
    POLY_BUILDER_PASSPHRASE  = string
    TELEGRAM_BOT_TOKEN       = string
    DISCORD_BOT_TOKEN        = string
  })
  sensitive = true
}
