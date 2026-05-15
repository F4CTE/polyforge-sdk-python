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
# Safe:   - "[::1]:3000:3000"   (bracketed IPv6 loopback)
# Safe:   - "::1:6000:6000"     (unbracketed IPv6 loopback)
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
# Unsafe: - ":::3000:3000"      (unbracketed IPv6 all-interfaces :: — binds to 0.0.0.0)
# Unsafe: - "[2001:db8::]:3000:3000"  (IPv6 non-loopback)
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
# Indentation is tracked dynamically: ports_indent = indent of the ports:
# key; port_lead = indent of the "-" that starts a long-syntax entry.

violations=$(awk -v file="$TARGET_FILE" '
function leadingspaces(str) {
  match(str, /^ */)
  return RLENGTH
}

BEGIN { exit_code = 0; prev_nosemgrep = 0 }

# ── ports: section tracking ────────────────────────────────────────────

# Enter a ports: section (at any indentation under a service).
# Match "ports:" followed by end-of-line or a comment so that keys
# like "expose_ports:" are not misidentified as port lists.
/^[[:space:]]+ports:[[:space:]]*($|#)/ {
  ports_indent = leadingspaces($0)
  in_ports = 1
  next
}

# Exit ports: section on any non-blank, non-comment line at or above
# the ports indent level.  Guarded by !in_block so we do not exit
# while still scanning a long-syntax block; the block exit handler
# checks ports exit itself.
in_ports && !in_block {
  cur = leadingspaces($0)
  if ($0 !~ /^[[:space:]]*$/ && $0 !~ /^[[:space:]]*#/ && cur <= ports_indent && $0 !~ /^[[:space:]]+ports:/) {
    in_ports = 0
  }
}

# ── Long-syntax entry detection (MUST come before short-syntax) ────────
# Matches any Docker Compose long-syntax port mapping key (name, target,
# published, host_ip, protocol, mode, app_protocol).  Runs first so that
# long-syntax blocks are never misidentified as short-syntax host:port
# strings.  The entry line itself is inspected for target, published,
# and host_ip keys so that single-line or first-key entries are tracked
# correctly.
in_ports && /^[[:space:]]+- (name|target|published|host_ip|protocol|mode|app_protocol):/ && !in_block {
  in_block = 1
  port_lead = leadingspaces($0)
  entry_lineno = NR
  saw_target = ($0 ~ / target:/)
  saw_published = ($0 ~ / published:/)
  # Inspect only the non-comment portion of the entry line when checking
  # host_ip so that inline comments like `# host_ip: 127.0.0.1` are not
  # confused for a real binding.
  noncomment = $0
  sub(/[[:space:]]*#.*$/, "", noncomment)
  has_host_ip = (noncomment ~ /host_ip:[[:space:]]*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?/)
  suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback(-long-syntax)?/)
  next
}

in_block {
  cur_indent = leadingspaces($0)
  # Exit block when we encounter a new port entry ("- " at any depth)
  # or a non-blank line whose indent is at or above the block entry
  # indent (service-level key, service name, or top-level key).
  # Blank and whitespace-only lines are ignored inside the block:
  # they do not exit the block and cannot cause a premature false
  # positive on entries whose host_ip appears after spacing.
  if ($0 ~ /^[[:space:]]+- / || ($0 !~ /^[[:space:]]*$/ && cur_indent <= port_lead)) {
    if (saw_target && saw_published && !has_host_ip && !suppressed) {
      printf "::error file=%s,line=%d::Long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, entry_lineno
      exit_code = 1
    }
    in_block = 0

    # If the line that exited the block is at or above ports indent
    # (and is not blank / a comment), also exit the ports section.
    if (cur_indent <= ports_indent && $0 !~ /^[[:space:]]*$/ && $0 !~ /^[[:space:]]*#/) {
      in_ports = 0
    }

    # Re-process this line in case it starts a new port block
    if (in_ports && $0 ~ /^[[:space:]]+- (name|target|published|host_ip|protocol|mode|app_protocol):/) {
      in_block = 1
      port_lead = cur_indent
      entry_lineno = NR
      saw_target = ($0 ~ / target:/)
      saw_published = ($0 ~ / published:/)
      noncomment = $0
      sub(/[[:space:]]*#.*$/, "", noncomment)
      has_host_ip = (noncomment ~ /host_ip:[[:space:]]*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?/)
      suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback(-long-syntax)?/)
      next
    }
  }

  # Content processing for the current block (only reached when we
  # are still in_block — i.e., the line is deeper than the entry).
  if (in_block) {
    if ($0 ~ /# nosemgrep: docker-compose-port-no-loopback(-long-syntax)?/) {
      suppressed = 1
    }
    if ($0 ~ /^[[:space:]]+target:/) {
      saw_target = 1
    }
    if ($0 ~ /^[[:space:]]+published:/) {
      saw_published = 1
    }
    # Match loopback host_ip (127.0.0.1 / ::1) with optional single/double quotes.
    # Anchored to line-start so that comments, inline comments, and typos
    # (e.g. xhost_ip:) do not satisfy the guard.
    if ($0 ~ /^[[:space:]]+host_ip:[[:space:]]*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?/) {
      has_host_ip = 1
    }
  }
}

# ── Preceding-line nosemgrep tracking ────────────────────────────
# Semgrep allows # nosemgrep: rule-id on the
# immediately preceding line (not just on the same line).  Track that
# here for the short-syntax path.  Long-syntax entries are already
# consumed by the state machine above.
in_ports && !in_block {
  if ($0 ~ /^[[:space:]]*#[[:space:]]*nosemgrep:[[:space:]]*docker-compose-port-no-loopback(-long-syntax)?/) {
    prev_nosemgrep = 1
    next
  }
  # Any other non-empty, non-port-entry line inside ports clears the flag.
  # Blank lines are left alone — Semgrep tolerates blank lines between the
  # suppression comment and the suppressed code.
  if ($0 !~ /^[[:space:]]*$/ && $0 !~ /^[[:space:]]+- /) {
    prev_nosemgrep = 0
  }
}

# ── Short-syntax detection (inside ports: only, after long-syntax) ─────
# Runs after long-syntax entry rules, so long-syntax port mapping keys
# (name, target, published, host_ip, protocol, mode, app_protocol) are
# already claimed by the long-syntax state machine.
in_ports && /^[[:space:]]+-[[:space:]]+/ && !in_block {
  # Skip suppressed lines (same-line or preceding-line nosemgrep)
  if ($0 ~ /# nosemgrep: docker-compose-port-no-loopback(-long-syntax)?/) { prev_nosemgrep = 0; next }
  if (prev_nosemgrep) { prev_nosemgrep = 0; next }

  # Save indentation before modifying $0 so that anchor entries
  # (- &name) can use it as port_lead for the block content handler.
  entry_indent = leadingspaces($0)

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
  # Normalize whitespace left after quote removal (quoted inline maps
  # like - "{ target: 80, ... }" have a space between the quote and the
  # brace that would otherwise defeat the ^\{.*\}$ anchor below).
  gsub(/^[[:space:]]+/, "", val); gsub(/[[:space:]]+$/, "", val)

  # Remove optional protocol suffix (e.g. /tcp, /udp)
  sub(/\/[a-zA-Z]+$/, "", val)

  # ---- Inline YAML map: - { target: 80, published: 80, host_ip: 127.0.0.1 } ----
  # These would otherwise fall through to short-syntax parsing and produce
  # spurious errors.  Detect the inline map wrapper and inspect it directly
  # for loopback host_ip.
  if (val ~ /^\{.*\}$/) {
    # Check for loopback host_ip (IPv4 or IPv6) inside the inline map
    if (val ~ /host_ip:[[:space:]]*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?/) { next }
    # No loopback host_ip in inline map — flag if target and published exist
    if (val ~ /target:[[:space:]]*[0-9]/ && val ~ /published:[[:space:]]*[0-9]/) {
      printf "::error file=%s,line=%d::Inline long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, NR
      exit_code = 1
    }
    next
  }

  # ---- Hostless forms: single port or port range (binds to 0.0.0.0) ----
  if (val ~ /^[0-9]+(-[0-9]+)?$/) {
    printf "::error file=%s,line=%d::Port published without 127.0.0.1 loopback binding (hostless). Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, NR
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
    if (closing == 0) {
      printf "::warning file=%s,line=%d::Malformed IPv6 port entry (missing closing bracket) — could not check loopback binding.\n", file, NR
      next
    }
    host = substr(val, 1, closing)
  } else {
    parts_count = split(val, parts, ":")
    if (parts_count < 2) {
      # YAML anchor definition (e.g. - &name).  Treat the subsequent
      # indented lines as long-syntax block content so that target:,
      # published:, and host_ip: keys are tracked.
      if (val ~ /^&/) {
        in_block = 1
        port_lead = entry_indent
        entry_lineno = NR
        saw_target = 0
        saw_published = 0
        has_host_ip = 0
        suppressed = ($0 ~ /# nosemgrep: docker-compose-port-no-loopback(-long-syntax)?/)
        next
      }
      # YAML alias (e.g. - *name).  The referenced mapping cannot be
      # verified, so warn rather than silently skipping.
      if (val ~ /^\*/) {
        printf "::warning file=%s,line=%d::YAML alias port entry cannot be verified for loopback binding. Inline the port mapping or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax).\n", file, NR
        next
      }
      # Any other unrecognised single-value entry — warn.
      if (val !~ /^~?$/) {
        printf "::warning file=%s,line=%d::Unrecognised port entry could not be checked for loopback binding. Add an explicit host_ip or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax).\n", file, NR
      }
      next
    }
    host = parts[1]

    # Unbracketed IPv6 (host empty due to leading ::).  Compose accepts
    # short syntax like "::1:6000:6000" (unbracketed IPv6 loopback).
    # Reconstruct the host: for ::1:... with 4+ colon-separated parts
    # the first three are the IPv6 address (two empty from :: plus the
    # hex segment).  ::1 is loopback-safe; everything else (e.g. :::...
    # for all-interfaces ::) is unsafe.
    if (host == "" && parts_count >= 4) {
      host = "::" parts[3]
    }
  }

  # Detect IPv6 bracket notation: [::], [::1], [2001:db8::1], etc.
  is_ipv6 = (host ~ /^\[.*\]$/)

  # Safe: IPv4 loopback
  if (host == "127.0.0.1") { next }
  # Safe: IPv6 loopback (bracketed and unbracketed)
  if (is_ipv6 && host == "[::1]") { next }
  if (host == "::1") { next }

  # Everything else is unsafe
  printf "::error file=%s,line=%d::Port published without 127.0.0.1 loopback binding. Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, NR
  exit_code = 1
  next
}

END {
  if (in_block && saw_target && saw_published && !has_host_ip && !suppressed) {
    printf "::error file=%s,line=%d::Long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, entry_lineno
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
  echo "  Fix: bind with '127.0.0.1:<port>:<port>' or add '# nosemgrep: docker-compose-port-no-loopback(-long-syntax)' for public entry points"
  echo "  Docs: https://github.com/F4CTE/PolyForge/issues/1310"
fi

exit $EXIT_CODE
