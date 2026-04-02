#!/bin/sh
# ── Gateway entrypoint ───────────────────────────────────────────────────────
# Generates the admin IP allowlist from ADMIN_ALLOWED_IPS env var, then
# starts nginx. This avoids hardcoding IP addresses in the nginx config.
#
# ADMIN_ALLOWED_IPS format:  comma-separated CIDRs or IPs
#   Example: "203.0.113.1/32,10.8.0.0/24"
#
# If ADMIN_ALLOWED_IPS is empty/unset, only loopback (127.0.0.1) is allowed
# and a warning is logged. This prevents accidental lock-out while still
# refusing public access.
# ─────────────────────────────────────────────────────────────────────────────

set -e

ALLOWLIST_FILE="/etc/nginx/admin_allowlist.conf"

# Generate geo block entries from ADMIN_ALLOWED_IPS
{
  echo "# Auto-generated from ADMIN_ALLOWED_IPS — do not edit manually"
  echo "geo \$admin_allowed {"
  echo "    default  0;"

  if [ -z "$ADMIN_ALLOWED_IPS" ]; then
    echo "    # WARNING: ADMIN_ALLOWED_IPS not set — admin panel restricted to loopback only"
    echo "    127.0.0.1/32  1;"
    echo "    ::1            1;"
    echo "}"
    echo ""
    echo >&2 "[gateway] WARNING: ADMIN_ALLOWED_IPS is not set."
    echo >&2 "[gateway] Admin panel is restricted to loopback (127.0.0.1) only."
    echo >&2 "[gateway] Set ADMIN_ALLOWED_IPS='<cidr1>,<cidr2>' for production access."
  else
    # Split comma-separated IPs/CIDRs and add each as an allow entry
    echo "$ADMIN_ALLOWED_IPS" | tr ',' '\n' | while IFS= read -r cidr; do
      cidr=$(echo "$cidr" | xargs)  # trim whitespace
      if [ -n "$cidr" ]; then
        echo "    ${cidr}  1;"
      fi
    done
    echo "}"
    echo ""
    echo >&2 "[gateway] Admin IP allowlist configured with: $ADMIN_ALLOWED_IPS"
  fi
} > "$ALLOWLIST_FILE"

exec "$@"
