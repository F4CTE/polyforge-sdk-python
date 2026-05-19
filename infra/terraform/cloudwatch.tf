# ─── Polyforge — CloudWatch Log Groups, Alarms & SNS ─────────────────────────

# ── SNS topic for all alerts ──────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
  tags = { Name = "${local.name}-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Allow ElastiCache to publish node lifecycle events (failover, replica
# promotion, snapshots, maintenance) to the alerts topic. Required because
# the replication group sets notification_topic_arn to this topic.
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowOwnerFullControl"
        Effect    = "Allow"
        Principal = { AWS = "*" }
        Action    = "sns:*"
        Resource  = aws_sns_topic.alerts.arn
        Condition = {
          StringEquals = { "AWS:SourceOwner" = data.aws_caller_identity.current.account_id }
        }
      },
      {
        Sid       = "AllowElastiCachePublish"
        Effect    = "Allow"
        Principal = { Service = ["elasticache.amazonaws.com", "ec.amazonaws.com"] }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
          ArnLike = {
            "aws:SourceArn" = [
              "arn:aws:elasticache:${var.aws_region}:${data.aws_caller_identity.current.account_id}:replicationgroup:${local.redis_replication_group_id}",
              "arn:aws:elasticache:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster:${local.redis_replication_group_id}-*"
            ]
          }
        }
      },
      {
        Sid       = "AllowEventBridgePublish"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.alerts.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.rds_backup_failed.arn
          }
        }
      },
    ]
  })
}

# ── Log groups ────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "app" {
  name              = "/polyforge/prod"
  retention_in_days = 30   # Architecture spec: CloudWatch logs 30 days
  tags              = { Name = "${local.name}-logs" }
}

resource "aws_cloudwatch_log_group" "rds" {
  name              = "/aws/rds/instance/${local.name}-postgres/postgresql"
  retention_in_days = 30
}

# ── EC2: memory usage > 80% ───────────────────────────────────────────────────
# Requires CloudWatch Agent (installed via user_data)

resource "aws_cloudwatch_metric_alarm" "ec2_memory_high" {
  alarm_name          = "${local.name}-ec2-memory-high"
  alarm_description   = "EC2 memory usage > 80% for 5 minutes"
  namespace           = "CWAgent"
  metric_name         = "mem_used_percent"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.main.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-ec2-memory-high" }
}

# ── EC2: disk usage > 80% ─────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "ec2_disk_high" {
  alarm_name          = "${local.name}-ec2-disk-high"
  alarm_description   = "EC2 disk usage > 80% for 5 minutes"
  namespace           = "CWAgent"
  metric_name         = "disk_used_percent"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.main.id
    path       = "/"
    device     = "xvda1"
    fstype     = "xfs"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-ec2-disk-high" }
}

# ── EC2: CPU > 85% ────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "${local.name}-ec2-cpu-high"
  alarm_description   = "EC2 CPU > 85% for 10 minutes"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.main.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-ec2-cpu-high" }
}

# ── EC2: status check failure ─────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "ec2_status_check" {
  alarm_name          = "${local.name}-ec2-status-check-failed"
  alarm_description   = "EC2 status check failed — instance may be unreachable"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    InstanceId = aws_instance.main.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-ec2-status-check" }
}

# ── RDS: CPU > 70% ────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.name}-rds-cpu-high"
  alarm_description   = "RDS CPU > 70% for 10 minutes"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 70
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-rds-cpu-high" }
}

# ── RDS: free storage < 10 GB ─────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "${local.name}-rds-storage-low"
  alarm_description   = "RDS free storage < 10 GB"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10737418240   # 10 GB in bytes
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-rds-storage-low" }
}

# ── RDS: backup failed ────────────────────────────────────────────────────────
# PostgreSQL RDS backup failures are emitted as RDS events, not SQL Server job
# metrics. RDS-EVENT-0009 is "Automated backup failed".

resource "aws_cloudwatch_event_rule" "rds_backup_failed" {
  name        = "${local.name}-rds-backup-failed"
  description = "RDS automated backup failed"

  event_pattern = jsonencode({
    source        = ["aws.rds"]
    "detail-type" = ["RDS DB Instance Event"]
    detail = {
      EventID          = ["RDS-EVENT-0009"]
      SourceIdentifier = [aws_db_instance.main.identifier]
    }
  })

  tags = { Name = "${local.name}-rds-backup-failed" }
}

resource "aws_cloudwatch_event_target" "rds_backup_failed_alert" {
  rule      = aws_cloudwatch_event_rule.rds_backup_failed.name
  target_id = "sns-alerts"
  arn       = aws_sns_topic.alerts.arn
}

# ── Redis (Multi-AZ Replication Group) ───────────────────────────────────────
# ElastiCache emits CloudWatch metrics per cache node, not per replication
# group. We iterate the replication group's member clusters so each node gets
# its own alarm and we can identify the breaching node during an incident.
#
# Replication group members are auto-named: "<rg-id>-001" (primary) and
# "<rg-id>-002" (replica). On failover the role swaps but the IDs persist.

# Memory usage > 80% — per node
resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  for_each = toset(local.redis_member_cluster_ids)

  alarm_name          = "${local.name}-redis-memory-high-${each.key}"
  alarm_description   = "Redis memory usage > 80% for 5 minutes (node ${each.key})"
  namespace           = "AWS/ElastiCache"
  metric_name         = "DatabaseMemoryUsagePercentage"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = each.key
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-redis-memory-high-${each.key}" }
}

# Connection count > 1000 — per node
resource "aws_cloudwatch_metric_alarm" "redis_connections_high" {
  for_each = toset(local.redis_member_cluster_ids)

  alarm_name          = "${local.name}-redis-connections-high-${each.key}"
  alarm_description   = "Redis connection count > 1000 for 5 minutes (node ${each.key})"
  namespace           = "AWS/ElastiCache"
  metric_name         = "CurrConnections"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = each.key
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-redis-connections-high-${each.key}" }
}

# Engine CPU > 75% — per node. EngineCPUUtilization measures only the Redis
# engine thread (more accurate than CPUUtilization on multi-vCPU nodes where
# the engine is single-threaded but the OS reports total CPU).
resource "aws_cloudwatch_metric_alarm" "redis_engine_cpu_high" {
  for_each = toset(local.redis_member_cluster_ids)

  alarm_name          = "${local.name}-redis-engine-cpu-high-${each.key}"
  alarm_description   = "Redis engine CPU > 75% for 10 minutes (node ${each.key})"
  namespace           = "AWS/ElastiCache"
  metric_name         = "EngineCPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 75
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = each.key
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-redis-engine-cpu-high-${each.key}" }
}

# Replication lag > 10s — replica is falling behind primary. High lag means
# RPO degrades and reads against the reader endpoint return stale data.
# Only the replica node emits this metric (primary value is always 0).
resource "aws_cloudwatch_metric_alarm" "redis_replication_lag_high" {
  for_each = toset(local.redis_member_cluster_ids)

  alarm_name          = "${local.name}-redis-replication-lag-${each.key}"
  alarm_description   = "Redis replication lag > 10s for 5 minutes (node ${each.key}) — RPO degraded"
  namespace           = "AWS/ElastiCache"
  metric_name         = "ReplicationLag"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = each.key
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-redis-replication-lag-${each.key}" }
}

# ── SES: bounce rate > 5% ─────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "ses_bounce_rate_high" {
  alarm_name          = "${local.name}-ses-bounce-rate-high"
  alarm_description   = "SES bounce rate > 5% — risk of sending suspension"
  namespace           = "AWS/SES"
  metric_name         = "Reputation.BounceRate"
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 0.05
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-ses-bounce-rate" }
}

# ── Application error rate — log metric filter ────────────────────────────────
# Count ERROR-level log lines from all services. Alarm if > 1% of requests
# are errors (approximate: error lines per minute > 10).

resource "aws_cloudwatch_log_metric_filter" "app_errors" {
  name           = "${local.name}-app-errors"
  pattern        = "{ $.level = \"error\" }"
  log_group_name = aws_cloudwatch_log_group.app.name

  metric_transformation {
    name          = "AppErrorCount"
    namespace     = "Polyforge/App"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "app_error_rate_high" {
  alarm_name          = "${local.name}-app-error-rate-high"
  alarm_description   = "Application error log rate > 10 errors/minute for 5 minutes"
  namespace           = "Polyforge/App"
  metric_name         = "AppErrorCount"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${local.name}-app-error-rate" }
}

# ── Dashboard ─────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type       = "metric"
        x          = 0; y = 0; width = 6; height = 6
        properties = {
          title   = "EC2 CPU %"
          metrics = [["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.main.id]]
          period  = 60; stat = "Average"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 6; y = 0; width = 6; height = 6
        properties = {
          title   = "EC2 Memory %"
          metrics = [["CWAgent", "mem_used_percent", "InstanceId", aws_instance.main.id]]
          period  = 60; stat = "Average"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 12; y = 0; width = 6; height = 6
        properties = {
          title   = "RDS CPU %"
          metrics = [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.identifier]]
          period  = 60; stat = "Average"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 18; y = 0; width = 6; height = 6
        properties = {
          title   = "Redis Memory % (per node)"
          metrics = [
            for cluster_id in local.redis_member_cluster_ids :
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "CacheClusterId", cluster_id]
          ]
          period = 60; stat = "Average"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 0; y = 6; width = 12; height = 6
        properties = {
          title   = "Application Errors / min"
          metrics = [["Polyforge/App", "AppErrorCount"]]
          period  = 60; stat = "Sum"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 12; y = 6; width = 12; height = 6
        properties = {
          title   = "Redis Connections (per node)"
          metrics = [
            for cluster_id in local.redis_member_cluster_ids :
            ["AWS/ElastiCache", "CurrConnections", "CacheClusterId", cluster_id]
          ]
          period = 60; stat = "Maximum"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 0; y = 12; width = 12; height = 6
        properties = {
          title   = "Redis Replication Lag (s)"
          metrics = [
            for cluster_id in local.redis_member_cluster_ids :
            ["AWS/ElastiCache", "ReplicationLag", "CacheClusterId", cluster_id]
          ]
          period = 60; stat = "Maximum"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 12; y = 12; width = 12; height = 6
        properties = {
          title   = "Redis Engine CPU % (per node)"
          metrics = [
            for cluster_id in local.redis_member_cluster_ids :
            ["AWS/ElastiCache", "EngineCPUUtilization", "CacheClusterId", cluster_id]
          ]
          period = 60; stat = "Average"; view = "timeSeries"
        }
      },
    ]
  })
}

# ── Monthly cost budget ──────────────────────────────────────────────────────

resource "aws_budgets_budget" "monthly" {
  name         = "${var.project}-monthly-budget"
  budget_type  = "COST"
  limit_amount = "800"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
  }
}
