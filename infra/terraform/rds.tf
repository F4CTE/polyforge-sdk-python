# ─── Polyforge — RDS (PostgreSQL 16 + TimescaleDB) ────────────────────────────
#
# Single RDS instance hosts two databases:
#   - polyforge       (user data — TimescaleDB hypertables)
#   - polyforge_admin (admin data — plain PostgreSQL)
#
# TimescaleDB is enabled via a custom parameter group.
# The admin DB is created in a separate terraform resource after the instance is up.

# ── Subnet group ──────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-rds-subnet-group"
  subnet_ids = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]
  tags       = { Name = "${local.name}-rds-subnet-group" }
}

# ── Parameter group — enables TimescaleDB ─────────────────────────────────────

resource "aws_db_parameter_group" "main" {
  name        = "${local.name}-pg16-timescaledb"
  family      = "postgres${var.rds_postgres_version}"
  description = "PostgreSQL 16 with TimescaleDB shared_preload_libraries"

  parameter {
    name         = "shared_preload_libraries"
    value        = "timescaledb"
    apply_method = "pending-reboot"
  }

  # Tune for the primary workload (many small transactions, OHLCV writes)
  parameter {
    name  = "max_connections"
    value = "200"   # PgBouncer keeps actual connections low
  }

  parameter {
    name  = "work_mem"
    value = "16384"  # 16 MB per sort/hash — safe at 200 connections
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "524288"  # 512 MB for VACUUM / index builds
  }

  parameter {
    name  = "effective_cache_size"
    value = "3145728"  # 3 GB — inform planner about OS cache
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"  # SSD storage on RDS
  }

  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"  # Log queries > 1s for slow-query analysis
    apply_method = "immediate"
  }

  tags = { Name = "${local.name}-pg16-params" }
}

# ── RDS Instance ──────────────────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  identifier = "${local.name}-postgres"

  engine         = "postgres"
  engine_version = "${var.rds_postgres_version}.3"   # e.g. 16.3
  instance_class = var.rds_instance_class

  db_name  = "polyforge"
  username = var.db_user_username
  password = var.db_user_password

  # Storage
  allocated_storage     = var.rds_allocated_storage_gb
  max_allocated_storage = var.rds_max_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  iops                  = 3000

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Params & options
  parameter_group_name = aws_db_parameter_group.main.name

  # Backups
  backup_retention_period   = var.rds_backup_retention_days
  backup_window             = "03:00-04:00"   # 3-4 AM UTC (low traffic)
  maintenance_window        = "sun:04:00-sun:05:00"
  delete_automated_backups  = false
  copy_tags_to_snapshot     = true

  # High availability
  multi_az = true  # Standby in private_1b

  # Monitoring
  monitoring_interval          = 60  # Enhanced monitoring every 60s
  monitoring_role_arn          = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7  # days (free tier)
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Protection
  deletion_protection      = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${local.name}-final-snapshot"

  tags = { Name = "${local.name}-postgres" }
}

# ── Enhanced monitoring role ──────────────────────────────────────────────────

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${local.name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ── Admin DB provisioning note ────────────────────────────────────────────────
# The polyforge_admin database and poly_admin user are created via the
# migration container (Dockerfile.migrate.admin) which runs:
#
#   CREATE USER poly_admin WITH PASSWORD '...' CREATEDB;
#   CREATE DATABASE polyforge_admin OWNER poly_admin;
#
# This happens as part of `scripts/deploy.sh` on first deploy.
# Terraform does not manage Postgres users/databases directly to avoid
# storing credentials in state.
