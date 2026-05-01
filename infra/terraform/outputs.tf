# ─── Polyforge — Terraform Outputs ───────────────────────────────────────────

# ── EC2 ───────────────────────────────────────────────────────────────────────

output "ec2_elastic_ip" {
  description = "Elastic IP — set this as the A record for polyforge.app and admin.polyforge.app"
  value       = aws_eip.main.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "ec2_public_dns" {
  description = "EC2 public DNS (for SSH before DNS is configured)"
  value       = aws_instance.main.public_dns
}

# ── RDS ───────────────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS endpoint (host:port) — internal only, not publicly accessible"
  value       = aws_db_instance.main.endpoint
}

output "rds_port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

# ── ElastiCache (Multi-AZ Replication Group) ─────────────────────────────────
# The replication group exposes two DNS endpoints:
#   - primary_endpoint_address: always points to the current writer; AWS
#     transparently swings DNS to the new primary on failover (RTO < 2 min).
#   - reader_endpoint_address: round-robins across read replicas.
# Application services use the primary endpoint via REDIS_URL.

output "redis_primary_endpoint" {
  description = "Redis primary endpoint (writer) — DNS swings on failover"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint (round-robin across replicas)"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

# ── ECR ───────────────────────────────────────────────────────────────────────

output "ecr_registry" {
  description = "ECR registry URL — use as ECR_REGISTRY in deploy.sh"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecr_repositories" {
  description = "Map of service name → ECR repository URL"
  value = {
    for k, v in aws_ecr_repository.services : k => v.repository_url
  }
}

# ── SES ───────────────────────────────────────────────────────────────────────

output "ses_verification_token" {
  description = "SES domain verification TXT record value — add to DNS as TXT @ (or _amazonses)"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = <<-EOT
    SES DKIM CNAME records — add all 3 to DNS:
      <token>._domainkey.polyforge.app → <token>.dkim.amazonses.com
  EOT
  value = formatlist(
    "%s._domainkey.%s → %s.dkim.amazonses.com",
    aws_ses_domain_dkim.main.dkim_tokens,
    var.ses_domain,
    aws_ses_domain_dkim.main.dkim_tokens,
  )
}

# ── Secrets Manager ───────────────────────────────────────────────────────────

output "secrets_manager_arns" {
  description = "ARNs of the Secrets Manager secrets"
  value = {
    app = aws_secretsmanager_secret.app.arn
    db  = aws_secretsmanager_secret.db.arn
  }
}

# ── CloudWatch ────────────────────────────────────────────────────────────────

output "cloudwatch_dashboard_url" {
  description = "Direct link to the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "sns_alerts_arn" {
  description = "SNS topic ARN for alerts — subscribe additional endpoints if needed"
  value       = aws_sns_topic.alerts.arn
}

# ── DNS records summary ───────────────────────────────────────────────────────

output "dns_records_to_add" {
  description = "All DNS records that must be added to your registrar"
  value = <<-EOT
    ── A Records ─────────────────────────────────────────────────────────
    A  polyforge.app           ${aws_eip.main.public_ip}
    A  www.polyforge.app       ${aws_eip.main.public_ip}
    A  admin.polyforge.app     ${aws_eip.main.public_ip}

    ── SES Domain Verification ───────────────────────────────────────────
    TXT _amazonses.polyforge.app   "${aws_ses_domain_identity.main.verification_token}"

    ── SES DKIM (add all 3) ──────────────────────────────────────────────
    CNAME ${aws_ses_domain_dkim.main.dkim_tokens[0]}._domainkey  ${aws_ses_domain_dkim.main.dkim_tokens[0]}.dkim.amazonses.com
    CNAME ${aws_ses_domain_dkim.main.dkim_tokens[1]}._domainkey  ${aws_ses_domain_dkim.main.dkim_tokens[1]}.dkim.amazonses.com
    CNAME ${aws_ses_domain_dkim.main.dkim_tokens[2]}._domainkey  ${aws_ses_domain_dkim.main.dkim_tokens[2]}.dkim.amazonses.com

    ── Email Authentication ──────────────────────────────────────────────
    TXT @      "v=spf1 include:amazonses.com ~all"
    TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@polyforge.app"
  EOT
}
