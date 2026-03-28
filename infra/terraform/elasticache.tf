# ─── Polyforge — ElastiCache Redis 7 ─────────────────────────────────────────
#
# PRODUCTION LIMITATION: Currently using aws_elasticache_cluster (single-node).
# This means:
#   - No automatic failover if the node fails → downtime for rate limiting, sessions, etc.
#   - No read replicas → all queries hit the primary
#   - Data loss risk during maintenance windows (AWS patches require a reboot)
#
# TODO: Migrate to aws_elasticache_replication_group with automatic failover when budget allows.
# This would add:
#   - 1-2 replica nodes in other AZs for HA
#   - Automatic failover (RTO < 2 min)
#   - Read replicas to distribute load
# Estimated cost increase: ~3x for multi-AZ (but unavoidable for production HA)
#
# Cost tradeoff: v1.0 accepts this risk as a bootstrapped startup to reduce AWS spend.
# Estimated cost for 1+2 cluster: $450-550/month vs. current $150-200/month.
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

# ── ElastiCache Cluster ───────────────────────────────────────────────────────

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${local.name}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  port                 = 6379

  # Encryption
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # Snapshots — daily at 4 AM UTC (after RDS backup window)
  snapshot_retention_limit = 7
  snapshot_window          = "04:00-05:00"

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"

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
