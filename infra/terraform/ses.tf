# ─── Polyforge — SES Email ────────────────────────────────────────────────────
#
# Domain identity for polyforge.app + DKIM signing.
# After apply, add the DKIM CNAME records shown in `terraform output ses_dkim_tokens`
# to your DNS provider.
#
# SES starts in sandbox mode — request production access via AWS console once
# the domain is verified and you have a working email flow.

resource "aws_ses_domain_identity" "main" {
  domain = var.ses_domain
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# ── DKIM verification records (add to DNS) ────────────────────────────────────
# These are outputs — see outputs.tf.
# Add three CNAME records:
#   <token>._domainkey.polyforge.app → <token>.dkim.amazonses.com

# ── SPF + DMARC are documented in DNS records — Terraform doesn't manage them.
# Add manually to your DNS provider:
#   TXT @       "v=spf1 include:amazonses.com ~all"
#   TXT _dmarc  "v=DMARC1; p=quarantine; rua=mailto:dmarc@polyforge.app"

# ── SES Configuration Set ─────────────────────────────────────────────────────
# Tracks delivery, bounces, and complaints. All sending goes through this set.

resource "aws_ses_configuration_set" "main" {
  name = "${local.name}-config-set"

  delivery_options {
    tls_policy = "Require"  # Enforce TLS on outbound SMTP
  }

  reputation_metrics_enabled = true   # Track bounce/complaint rates in CloudWatch
  sending_enabled            = true
}

# ── CloudWatch event destination (bounce + complaint metrics) ─────────────────

resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "${local.name}-cw-events"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true

  matching_types = ["send", "reject", "bounce", "complaint", "delivery", "open", "click"]

  cloudwatch_destination {
    default_value  = "0"
    dimension_name = "EmailType"
    value_source   = "messageTag"
  }
}

# ── Email identity for noreply@ ───────────────────────────────────────────────

resource "aws_ses_email_identity" "noreply" {
  email = "noreply@${var.ses_domain}"
}
