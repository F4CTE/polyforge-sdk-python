#!/usr/bin/env bash
set -euo pipefail

# Detect port bindings in docker-compose.infra.yml that are not bound
# to loopback (127.0.0.1) and are not suppressed with nosemgrep.
# Covers double-quoted, single-quoted, and unquoted short-syntax forms.
#
# Safe:   - "127.0.0.1:3000:3000"
# Safe:   - '127.0.0.1:5432:5432'
# Safe:   - "80:80" # nosemgrep: docker-compose-port-no-loopback ...
# Unsafe: - "3000:3000"
# Unsafe: - '3000:3000'
# Unsafe: - 3000:3000
# Unsafe: - "0.0.0.0:3000:3000"
# Unsafe: - "3000:3000/tcp"
# Unsafe: - "9090-9091:8080-8081"
#
# See https://github.com/F4CTE/PolyForge/issues/1310

TARGET_FILE="docker-compose.infra.yml"
EXIT_CODE=0

if [ ! -f "$TARGET_FILE" ]; then
  echo "::warning file=$TARGET_FILE::$TARGET_FILE not found — skipping loopback port check"
  exit 0
fi

# Match port-publish lines: leading whitespace, hyphen, optional quote
# (double, single, or none), followed by a non-loopback port spec.
# Exclude lines suppressed with nosemgrep.
while IFS= read -r line_num; do
  # line_num is output from grep -n
  lineno=$(echo "$line_num" | cut -d: -f1)
  line_content=$(sed -n "${lineno}p" "$TARGET_FILE")

  echo "::error file=${TARGET_FILE},line=${lineno}::Port published without 127.0.0.1 loopback binding. Add '127.0.0.1:' prefix or suppress with '# nosemgrep: docker-compose-port-no-loopback' if this is a public entry point. See https://github.com/F4CTE/PolyForge/issues/1310"
  EXIT_CODE=1
done < <(
  grep -nP '^\s+-\s+["\x27]?(?!127\.0\.0\.1)[a-zA-Z0-9.\-]+:\d' "$TARGET_FILE" \
    | grep -v 'nosemgrep' \
    | cut -d: -f1
)

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✓ All ports in $TARGET_FILE are bound to 127.0.0.1 (or have nosemgrep suppression)"
else
  echo ""
  echo "✗ Non-loopback ports detected — see errors above"
  echo "  Fix: bind with '127.0.0.1:<port>:<port>' or add '# nosemgrep: docker-compose-port-no-loopback' for public entry points"
  echo "  Docs: https://github.com/F4CTE/PolyForge/issues/1310"
fi

exit $EXIT_CODE
