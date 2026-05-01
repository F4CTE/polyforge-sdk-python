# ─── Polyforge — ElastiCache Redis 7 (Multi-AZ Replication Group) ────────────
#
# Uses aws_elasticache_replication_group with automatic failover for HA.
#   - Primary + 1 replica in separate AZs
#   - Automatic failover (RTO < 2 min)
#   - Read replicas distribute load
#
# In-transit encryption + AUTH token enabled.
# Connection string format (used in .env.prod):
#   rediss://:<auth_token>@<primary_endpoint>:6379/0

# ── Subnet group ──────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]
  tags       = { Name = "${local.name}-redis-subnet-group" }
}

# ── Parameter group ───────────────────────────────────────────────────────────

resource "aws_elasticache_parameter_group" "redis7" {
  name        = "${local.name}-redis7"
  family      = "redis7"
  description = "Polyforge Redis 7 — tuned for streams + pub/sub"

  # Append-only persistence (AOF) — everysec tradeoff: low data loss, good perf
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  parameter {
    name  = "appendfsync"
    value = "everysec"
  }

  # Notify keyspace events for expiry (used by rate-limit cleanup)
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  # Max memory eviction policy: allkeys-lru (cache data can be evicted;
  # stream data is not cached so won't be evicted before consumers read it)
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
}

# ── ElastiCache Replication Group (Multi-AZ) ──────────────────────────────────

locals {
  redis_replication_group_id = "${local.name}-redis"
  redis_num_cache_clusters   = 2
  # AWS auto-names members "<rg-id>-001", "<rg-id>-002", ... — deterministic
  # at plan time so we can use them for_each without "known after apply".
  redis_member_cluster_ids = [
    for i in range(1, local.redis_num_cache_clusters + 1) :
    format("%s-%03d", local.redis_replication_group_id, i)
  ]
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = local.redis_replication_group_id
  description          = "Polyforge Redis 7 — multi-AZ replication group"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_clusters   = local.redis_num_cache_clusters
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  port                 = 6379

  # High availability
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Encryption
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # Snapshots — daily at 4 AM UTC (after RDS backup window)
  snapshot_retention_limit = 7
  snapshot_window          = "04:00-05:00"

  # Maintenance
  maintenance_window = "sun:05:00-sun:06:00"

  # Publish node lifecycle events (failover, replica promotion, snapshot
  # success/failure, maintenance) to SNS — same topic as RDS/EC2 alarms.
  notification_topic_arn = aws_sns_topic.alerts.arn

  # CloudWatch logs
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "engine-log"
  }

  tags = { Name = "${local.name}-redis" }
}

resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/polyforge/prod/redis-slow-log"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "redis_engine" {
  name              = "/polyforge/prod/redis-engine-log"
  retention_in_days = 7
}
