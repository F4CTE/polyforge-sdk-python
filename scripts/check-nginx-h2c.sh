#!/usr/bin/env bash
set -euo pipefail

# Detect unsafe H2C smuggling patterns in nginx configs.
# Fails CI if any proxy_set_header forwards $http_upgrade directly
# instead of using the $safe_upgrade map.
#
# Safe:   proxy_set_header Upgrade $safe_upgrade;
# Safe:   proxy_set_header Upgrade "";
# Unsafe: proxy_set_header Upgrade $http_upgrade;

SEARCH_DIRS=(
  "apps/gateway"
  "services/gateway"
  "apps/admin-app"
  "apps/user-app"
)

UNSAFE_PATTERN='proxy_set_header\s+Upgrade\s+\$http_upgrade'
UNSAFE_CONN='proxy_set_header\s+Connection\s+["\x27]?upgrade["\x27]?\s*;'

EXIT_CODE=0

for dir in "${SEARCH_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    continue
  fi

  while IFS= read -r -d '' file; do
    if grep -Pn "$UNSAFE_PATTERN" "$file"; then
      echo "::error file=${file}::H2C smuggling: forwarding \$http_upgrade directly. Use \$safe_upgrade map instead."
      EXIT_CODE=1
    fi

    if grep -Pn "$UNSAFE_CONN" "$file"; then
      echo "::error file=${file}::H2C smuggling: hardcoded 'upgrade' Connection header. Use \$safe_connection map instead."
      EXIT_CODE=1
    fi
  done < <(find "$dir" -name '*.conf' -print0)
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✓ No H2C smuggling patterns found in nginx configs"
else
  echo ""
  echo "✗ H2C smuggling patterns detected — see errors above"
  echo "  Fix: use \$safe_upgrade / \$safe_connection maps (see services/gateway/nginx.dev.conf for reference)"
  echo "  Docs: https://github.com/F4CTE/PolyForge/issues/777"
fi

exit $EXIT_CODE
