#!/usr/bin/env bash
set -euo pipefail

# Detect port bindings in docker-compose.infra.yml that are not bound
# to loopback (127.0.0.1) and are not suppressed with nosemgrep.
# Covers short-syntax (double-quoted, single-quoted, unquoted, hostless)
# and long-syntax (target:/ published:) forms.
#
# Short-syntax examples:
# Safe:   - "127.0.0.1:3000:3000"
# Safe:   - '127.0.0.1:5432:5432'
# Safe:   - "80:80" # nosemgrep: docker-compose-port-no-loopback ...
# Unsafe: - "3000:3000"
# Unsafe: - '3000:3000'
# Unsafe: - 3000:3000
# Unsafe: - "0.0.0.0:3000:3000"
# Unsafe: - "3000:3000/tcp"
# Unsafe: - "9090-9091:8080-8081"
# Unsafe: - "3000"              (hostless — binds to 0.0.0.0)
# Unsafe: - 3000               (hostless — binds to 0.0.0.0)
# Unsafe: - "9090-9091"         (hostless range — binds to 0.0.0.0)
# Unsafe: - 9090-9091           (hostless range — binds to 0.0.0.0)
#
# Long-syntax examples:
# Safe:   - target: 80
#           published: 80
#           host_ip: 127.0.0.1
# Safe:   - target: 80   # nosemgrep: docker-compose-port-no-loopback
#           published: 80
# Unsafe: - target: 80
#           published: 80
# Unsafe: - published: 80
#           target: 80
#
# See https://github.com/F4CTE/PolyForge/issues/1310

TARGET_FILE="docker-compose.infra.yml"
EXIT_CODE=0

if [ ! -f "$TARGET_FILE" ]; then
  echo "::warning file=$TARGET_FILE::$TARGET_FILE not found — skipping loopback port check"
  exit 0
fi

# ── Short-syntax detection ──────────────────────────────────────────────
# Match port-publish lines: leading whitespace, hyphen, optional quote
# (double, single, or none), followed by a non-loopback port spec.
# Exclude lines suppressed with nosemgrep.
while IFS= read -r line_num; do
  lineno=$(echo "$line_num" | cut -d: -f1)

  echo "::error file=${TARGET_FILE},line=${lineno}::Port published without 127.0.0.1 loopback binding. Add '127.0.0.1:' prefix or suppress with '# nosemgrep: docker-compose-port-no-loopback' if this is a public entry point. See https://github.com/F4CTE/PolyForge/issues/1310"
  EXIT_CODE=1
done < <(
  {
    # Short syntax with explicit host:port or host:container[/proto]
    grep -nP '^\s+-\s+["\x27]?(?!127\.0\.0\.1)[a-zA-Z0-9.\-]+:\d' "$TARGET_FILE" || true
    # Hostless short syntax (no host prefix — binds to 0.0.0.0); handles
    # single ports (3000) and ranges (9090-9091)
    grep -nP '^\s+-\s+["\x27]?\d+(-\d+)?(/\w+)?["\x27]?\s*(?:#.*)?$' "$TARGET_FILE" || true
  } \
    | grep -v '# nosemgrep: docker-compose-port-no-loopback' \
    | cut -d: -f1
)

# ── Long-syntax detection ──────────────────────────────────────────────
# Scan for Docker Compose long-syntax port mappings (target:/ published:)
# that are missing host_ip: 127.0.0.1. Uses awk to handle the multi-line
# YAML structure with order-agnostic detection.
long_syntax_errors=$(awk -v file="$TARGET_FILE" '
# Entry: target-first (common case)
/^[[:space:]]+- target:/ && !in_block {
  in_block = 1
  entry_lineno = NR
  saw_target = 1
  saw_published = 0
  has_host_ip = 0
  suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
  next
}

# Entry: published-first (unusual but valid order)
/^[[:space:]]+- published:/ && !in_block {
  in_block = 1
  entry_lineno = NR
  saw_target = 0
  saw_published = 1
  has_host_ip = 0
  suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
  next
}

in_block {
  if ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/) {
    suppressed = 1
  }
  if ($0 ~ /^[[:space:]]+target:/) {
    saw_target = 1
  }
  if ($0 ~ /^[[:space:]]+published:/) {
    saw_published = 1
  }
  if ($0 ~ /host_ip:[[:space:]]*127\.0\.0\.1/) {
    has_host_ip = 1
  }

  # Exit the port block on: next list item, empty line, or dedented key
  if ($0 ~ /^[[:space:]]+- / || $0 ~ /^[[:space:]]*$/ || ($0 ~ /^[a-zA-Z]/ && $0 !~ /^[[:space:]]+[a-z]/)) {
    if (saw_target && saw_published && !has_host_ip && !suppressed) {
      printf "::error file=%s,line=%d::Long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, entry_lineno
    }
    in_block = 0

    # Re-process this line in case it starts a new port block
    if ($0 ~ /^[[:space:]]+- target:/) {
      in_block = 1
      entry_lineno = NR
      saw_target = 1
      saw_published = 0
      has_host_ip = 0
      suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
      next
    }
    if ($0 ~ /^[[:space:]]+- published:/) {
      in_block = 1
      entry_lineno = NR
      saw_target = 0
      saw_published = 1
      has_host_ip = 0
      suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
      next
    }
  }
}

END {
  if (in_block && saw_target && saw_published && !has_host_ip && !suppressed) {
    printf "::error file=%s,line=%d::Long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, entry_lineno
  }
}
' "$TARGET_FILE")

if [ -n "$long_syntax_errors" ]; then
  echo "$long_syntax_errors"
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✓ All ports in $TARGET_FILE are bound to 127.0.0.1 (or have nosemgrep suppression)"
else
  echo ""
  echo "✗ Non-loopback ports detected — see errors above"
  echo "  Fix: bind with '127.0.0.1:<port>:<port>' or add '# nosemgrep: docker-compose-port-no-loopback' for public entry points"
  echo "  Docs: https://github.com/F4CTE/PolyForge/issues/1310"
fi

exit $EXIT_CODE
