#!/usr/bin/env bash
set -euo pipefail

# Detect port bindings in docker-compose.infra.yml that are not bound
# to loopback (127.0.0.1 / ::1) and are not suppressed with nosemgrep.
# Covers short-syntax (double-quoted, single-quoted, unquoted, hostless,
# IPv4 and IPv6) and long-syntax (target:/ published:) forms.
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
# Unsafe: - "[::]:3000:3000"    (IPv6 all interfaces)
# Unsafe: - "[2001:db8::1]:3000:3000" (IPv6 non-loopback)
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
  echo "::error file=$TARGET_FILE::$TARGET_FILE not found — loopback port check cannot run"
  exit 1
fi

# ── Combined short + long syntax detection (single awk pass) ────────────
# All detection is scoped to services.*.ports: sections to avoid false
# positives on unrelated keys (labels, metadata, etc.).
# Indentation: services (0), service-name (2), ports: (4), entries (6).

violations=$(awk -v file="$TARGET_FILE" '
BEGIN { exit_code = 0 }

# ── ports: section tracking ────────────────────────────────────────────

# Enter a ports: section (4-space indent under a service).
/^    ports:/ {
  in_ports = 1
  next
}

# Exit ports: section on the next service-level key (4-space indent,
# e.g. "    volumes:", "    image:", "    networks:"), on a service
# name (2-space indent), or on a top-level key (0-space indent).
# Do NOT exit inside a long-syntax port block (in_block guards this).
in_ports && !in_block && /^    [a-zA-Z]/ {
  if ($0 !~ /^    ports:/) { in_ports = 0 }
}
in_ports && (/^  [a-zA-Z]/ || /^[a-zA-Z]/) {
  in_ports = 0
}

# ── Long-syntax entry detection (MUST come before short-syntax) ────────
# These checks run first so that `- target: 80` / `- published: 80`
# lines are handled as long-syntax blocks, not misidentified as
# short-syntax host:port mappings.

# Entry: target-first (common case)
in_ports && /^[[:space:]]+- target:/ && !in_block {
  in_block = 1
  entry_lineno = NR
  saw_target = 1
  saw_published = 0
  has_host_ip = 0
  suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
  next
}

# Entry: published-first (unusual but valid order)
in_ports && /^[[:space:]]+- published:/ && !in_block {
  in_block = 1
  entry_lineno = NR
  saw_target = 0
  saw_published = 1
  has_host_ip = 0
  suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
  next
}

in_block {
  # Exit the port block on: next list item, empty line, service-level
  # key (4-space indent), or top-level / service-name key (0 or 2 spaces).
  # IMPORTANT: exit must be checked BEFORE content processing so that a
  # suppression comment on the next list item applies to the new block,
  # not the current one.
  if ($0 ~ /^[[:space:]]+- / || $0 ~ /^[[:space:]]*$/ || $0 ~ /^    [a-zA-Z]/ || $0 ~ /^  [a-zA-Z]/ || $0 ~ /^[a-zA-Z]/) {
    if (saw_target && saw_published && !has_host_ip && !suppressed) {
      printf "::error file=%s,line=%d::Long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, entry_lineno
      exit_code = 1
    }
    in_block = 0

    # If the line that exited the block is also a service-level key
    # (4-space indent), exit the ports section as well.  This cannot
    # be handled by the earlier ports-exit rule because at that point
    # in_block was still 1 and !in_block was false.
    if ($0 ~ /^    [a-zA-Z]/) {
      if ($0 !~ /^    ports:/) { in_ports = 0 }
    }
    # Also exit ports on 2-space or 0-space keys (same rationale)
    if ($0 ~ /^  [a-zA-Z]/ || $0 ~ /^[a-zA-Z]/) {
      in_ports = 0
    }

    # Re-process this line in case it starts a new port block
    if (in_ports && $0 ~ /^[[:space:]]+- target:/) {
      in_block = 1
      entry_lineno = NR
      saw_target = 1
      saw_published = 0
      has_host_ip = 0
      suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
      next
    }
    if (in_ports && $0 ~ /^[[:space:]]+- published:/) {
      in_block = 1
      entry_lineno = NR
      saw_target = 0
      saw_published = 1
      has_host_ip = 0
      suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/)
      next
    }
  }

  # Content processing for the current block (only reached when we
  # are still in_block — i.e., the line is deeper than the entry).
  if (in_block) {
    if ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/) {
      suppressed = 1
    }
    if ($0 ~ /^[[:space:]]+target:/) {
      saw_target = 1
    }
    if ($0 ~ /^[[:space:]]+published:/) {
      saw_published = 1
    }
    # Match loopback host_ip (127.0.0.1 / ::1) with optional single/double quotes,
    # but NOT inside comments
    if ($0 !~ /^[[:space:]]*#/ && $0 ~ /host_ip:[[:space:]]*["'\'']?(127\.0\.0\.1|::1)["'\'']?/) {
      has_host_ip = 1
    }
  }
}

# ── Short-syntax detection (inside ports: only, after long-syntax) ─────
# Runs after long-syntax entry rules, so `- target:` / `- published:`
# lines are already claimed by the long-syntax state machine.
in_ports && /^[[:space:]]+-[[:space:]]+/ && !in_block {
  # Skip suppressed lines
  if ($0 ~ /# nosemgrep: docker-compose-port-no-loopback/) { next }

  # Capture the raw value after the leading "- "
  # Strip optional quotes (double or single) and trailing whitespace / comment
  gsub(/^[[:space:]]*-[[:space:]]+/, "")
  gsub(/[[:space:]]*#.*$/, "")
  gsub(/[[:space:]]+$/, "")
  raw = $0

  # Remove surrounding quotes for analysis
  val = raw
  sub(/^"/, "", val); sub(/"$/, "", val)
  sub(/^\047/, "", val); sub(/\047$/, "", val)

  # Remove optional protocol suffix (e.g. /tcp, /udp)
  sub(/\/[a-zA-Z]+$/, "", val)

  # ---- Hostless forms: single port or port range (binds to 0.0.0.0) ----
  if (val ~ /^[0-9]+(-[0-9]+)?$/) {
    printf "::error file=%s,line=%d::Port published without 127.0.0.1 loopback binding (hostless). Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, NR
    exit_code = 1
    next
  }

  # ---- Explicit host forms ----
  # Split on colon to extract host part.  IPv6 addresses use bracket
  # notation (e.g. [::1]:3000:3000) which contains internal colons, so
  # they must be parsed separately.
  # Forms: HOST:CONTAINER, HOST:CONTAINER/PROTO, HOST:HOSTPORT:CONTAINERPORT
  if (val ~ /^\[/) {
    closing = index(val, "]")
    if (closing == 0) { next }
    host = substr(val, 1, closing)
  } else {
    parts_count = split(val, parts, ":")
    if (parts_count < 2) { next }
    host = parts[1]
  }

  # Detect IPv6 bracket notation: [::], [::1], [2001:db8::1], etc.
  is_ipv6 = (host ~ /^\[.*\]$/)

  # Safe: IPv4 loopback
  if (host == "127.0.0.1") { next }
  # Safe: IPv6 loopback in brackets
  if (is_ipv6 && host == "[::1]") { next }

  # Everything else is unsafe
  printf "::error file=%s,line=%d::Port published without 127.0.0.1 loopback binding. Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, NR
  exit_code = 1
  next
}

END {
  if (in_block && saw_target && saw_published && !has_host_ip && !suppressed) {
    printf "::error file=%s,line=%d::Long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, entry_lineno
    exit_code = 1
  }
  print exit_code
}
' "$TARGET_FILE")

# The last line of awk output is the exit code; everything else is errors
EXIT_CODE=$(echo "$violations" | tail -1)
EXIT_CODE="${EXIT_CODE:-0}"
ERROR_OUTPUT=$(echo "$violations" | sed '$d')
ERROR_OUTPUT="${ERROR_OUTPUT:-}"

if [ -n "$ERROR_OUTPUT" ]; then
  echo "$ERROR_OUTPUT"
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
