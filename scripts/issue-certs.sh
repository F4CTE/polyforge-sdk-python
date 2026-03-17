#!/usr/bin/env bash
# ─── Issue Let's Encrypt Certificates ────────────────────────────────────────
#
# Run this ONCE on a fresh EC2 instance after DNS is pointed at the Elastic IP
# and BEFORE starting docker-compose.prod.yml for the first time.
#
# Uses certbot in standalone mode (temporarily occupies port 80).
# Certs are stored in /etc/letsencrypt/ and bind-mounted into the gateway
# container as certbot-conf volume.
#
# Prerequisites:
#   - certbot installed: sudo apt-get install certbot   (Ubuntu)
#                     or sudo yum install certbot       (Amazon Linux 2)
#   - Port 80 not yet in use (docker-compose not running)
#   - DNS A records for polyforge.app and admin.polyforge.app point to this IP
#
# Usage:
#   sudo bash scripts/issue-certs.sh

set -euo pipefail

EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set (e.g. admin@polyforge.app)}"

log() { echo "[$(date -u +%H:%M:%SZ)] $*"; }

log "Issuing cert for polyforge.app…"
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d polyforge.app \
    -d www.polyforge.app

log "Issuing cert for admin.polyforge.app…"
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d admin.polyforge.app

log "Certificates issued. Setting up auto-renewal cron…"

# Auto-renew cron: daily check, reload nginx if renewed
CRON_JOB="0 3 * * * certbot renew --quiet --deploy-hook 'docker exec \$(docker ps -qf name=gateway) nginx -s reload'"
( crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_JOB" ) | crontab -

log "Cron job installed:"
crontab -l | grep certbot

log "Done. Certificates in /etc/letsencrypt/live/"
ls /etc/letsencrypt/live/
