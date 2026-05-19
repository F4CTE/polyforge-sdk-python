#!/usr/bin/env bash
set -euo pipefail

# Detect port bindings in docker-compose.infra.yml that are not bound
# to loopback (127.0.0.1 / ::1) and are not suppressed with nosemgrep.
# Covers short-syntax (double-quoted, single-quoted, unquoted, hostless,
# IPv4 and IPv6), long-syntax (target:/ published:), flow-style
# (ports: [...] sequences including inline YAML maps { target: ... }),
# and ports: keys with YAML anchors (&) and aliases (*).
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
# Flow-style examples:
# Safe:   ports: ["127.0.0.1:3000:3000"]
# Safe:   ports: ["[::1]:3000:3000"]
# Safe:   ports: ["3000:3000"] # nosemgrep: docker-compose-port-no-loopback
# Safe:   ports: [{ target: 80, published: 80, host_ip: 127.0.0.1 }]
# Unsafe: ports: ["3000:3000"]
# Unsafe: ports: [3000]
# Unsafe: ports: ["0.0.0.0:3000:3000"]
# Unsafe: ports: ["3000:3000", "8080:8080"]
# Unsafe: ports: [{ target: 80, published: 80 }]
#
# ports: key variants:
# Safe:   ports: &app_ports   (anchor — entries follow on next lines)
# Unsafe: ports: *app_ports  (alias — cannot be verified statically)
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

# ── Global preceding-line nosemgrep tracking ───────────────────────────
# Nosemgrep comments outside ports: sections enable preceding-line
# suppression for flow-style entries.  Inside ports: sections, the
# block-style tracker (below) handles suppression independently.
!in_ports && !in_flow && /^[[:space:]]*#[[:space:]]*nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/ {
  prev_nosemgrep = 1
  next
}

# Clear prev_nosemgrep on any non-blank, non-comment, non-ports: line
# so that a stale suppression does not leak to unrelated entries.
!in_ports && !in_flow && prev_nosemgrep {
  if ($0 !~ /^[[:space:]]*$/ && $0 !~ /^[[:space:]]*#/ && $0 !~ /^[[:space:]]+["\047]?ports["\047]?:[[:space:]]*\[/) {
    prev_nosemgrep = 0
  }
}

# ── Flow-style sequence detection ──────────────────────────────────────
# YAML flow-style sequences like ports: ["3000:3000"] or multi-line
# ports: [\n  "3000:3000"\n] are valid docker-compose syntax that would
# bypass the block-style parser below.  Detect and process them first.
# Both same-line (single-entry and comma-separated) and multi-line
# (bracket on one line, entries on following lines) are handled.
# Safe:   ports: ["127.0.0.1:3000:3000"]
# Safe:   ports: ["[::1]:3000:3000"]
# Safe:   ports: ["::1:6000:6000"]
# Safe:   ports: ["3000:3000"] # nosemgrep: docker-compose-port-no-loopback
# Unsafe: ports: ["3000:3000"]
# Unsafe: ports: ["3000:3000", "8080:8080"]
# Unsafe: ports: [3000]
# Unsafe: ports: ["0.0.0.0:3000:3000"]

/^[[:space:]]+["\047]?ports["\047]?:[[:space:]]*\[/ && !in_flow {
  in_flow = 1
  flow_lineno = NR
  flow_suppressed = prev_nosemgrep
  prev_nosemgrep = 0

  # Extract content from the opening bracket onward
  line = substr($0, index($0, "["))
  # Check for same-line nosemgrep
  if (line ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/) {
    flow_suppressed = 1
  }

  # Strip leading [
  sub(/^\[/, "", line)

  # Does bracket close on this line?
  # Strip trailing whitespace and comment first so that the closing ]
  # is identified reliably — a ] inside a quoted IPv6 address
  # (e.g. "[::1]:3000:3000") would NOT be the last character and is
  # therefore left untouched.
  sub(/[[:space:]]*#.*$/, "", line)
  gsub(/[[:space:]]+$/, "", line)
  if (line ~ /\]$/) {
    sub(/\]$/, "", line)
    if (!flow_suppressed) {
      process_flow_entries(line)
    }
    in_flow = 0
    next
  }
  # Closing bracket not at end of line — continue multi-line accumulation

  # Multi-line flow: accumulate content until closing bracket
  sub(/[[:space:]]*#.*$/, "", line)
  gsub(/^[[:space:]]+/, "", line)
  flow_buf = line
  next
}

# Accumulate multi-line flow-style content until closing bracket
in_flow {
  # Check for nosemgrep on any line inside the flow section
  if ($0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/) {
    flow_suppressed = 1
  }

  # Strip comment and trailing whitespace for bracket detection.
  # The closing ] must be the last non-whitespace, non-comment character
  # on its line so that a ] inside a quoted value (e.g. "[::1]:...")
  # is never mistaken for the flow-style closing bracket.
  tmp = $0
  sub(/[[:space:]]*#.*$/, "", tmp)
  gsub(/[[:space:]]+$/, "", tmp)

  if (tmp ~ /\]$/) {
    # Closing bracket at end of line
    sub(/\]$/, "", tmp)
    gsub(/^[[:space:]]+/, "", tmp)
    gsub(/[[:space:]]+$/, "", tmp)
    flow_buf = flow_buf " " tmp
    if (!flow_suppressed) {
      process_flow_entries(flow_buf)
    }
    in_flow = 0
    next
  }

  # Not a closing bracket line — continue accumulating
  gsub(/^[[:space:]]+/, "", tmp)
  gsub(/[[:space:]]+$/, "", tmp)
  flow_buf = flow_buf " " tmp
  next
}

function process_flow_inline_map(map) {
  # Check an inline YAML map { key: value, ... } within a flow-style
  # ports sequence for loopback host_ip binding.
  # Handles quoted keys ("host_ip":, 'host_ip':) and variable
  # substitution values ($VAR, ${VAR}) in target/published.
  if (map ~ /["'\'']?host_ip["'\'']?:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?([^0-9a-f.:]|$)/) return
  # No loopback — flag if target and published are present
  _target_match = map ~ /["'\'']?target["'\'']?:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?[0-9$]/
  _published_match = map ~ /["'\'']?published["'\'']?:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?[0-9$]/
  if (_target_match && _published_match) {
    printf "::error file=%s,line=%d::Flow-style inline long-syntax port mapping without loopback binding. Add host_ip: 127.0.0.1 or suppress with # nosemgrep: docker-compose-port-no-loopback(-flow-style). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, flow_lineno
    exit_code = 1
  }
}

function process_flow_entries(buf) {
  # Pre-extract inline YAML maps ({ ... }) from the buffer before
  # comma-splitting because inline maps contain internal commas that
  # would otherwise fragment them across entries.  Extracted maps are
  # checked for loopback host_ip; the remaining buffer is processed
  # as comma-separated string entries.
  tmp = buf
  while (match(tmp, /\{[^{}]*\}/)) {
    inline_map = substr(tmp, RSTART, RLENGTH)
    tmp = substr(tmp, 1, RSTART-1) "," substr(tmp, RSTART+RLENGTH)
    process_flow_inline_map(inline_map)
  }
  # Clean up doubled/trailing/leading commas left by inline-map replacement
  gsub(/,,+/, ",", tmp)
  gsub(/^,/, "", tmp)
  gsub(/,$/, "", tmp)

  n = split(tmp, entries, ",")
  for (i = 1; i <= n; i++) {
    val = entries[i]
    gsub(/^[[:space:]]+/, "", val)
    gsub(/[[:space:]]+$/, "", val)
    if (val == "") continue

    # Strip surrounding quotes for analysis
    qval = val
    sub(/^"/, "", qval); sub(/"$/, "", qval)
    sub(/^\047/, "", qval); sub(/\047$/, "", qval)

    # Variable reference without a colon (e.g. "${APP_PORT}") — cannot
    # verify loopback binding statically.  Flag rather than silently skip.
    if (qval ~ /^\$/) {
      printf "::error file=%s,line=%d::Flow-style port uses variable substitution that cannot be verified for loopback binding. Use a static port binding or suppress with # nosemgrep: docker-compose-port-no-loopback(-flow-style). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, flow_lineno
      exit_code = 1
      continue
    }

    # Strip optional protocol suffix
    sub(/\/[a-zA-Z]+$/, "", qval)

    # Hostless form: bare number or port range (binds to 0.0.0.0)
    if (qval ~ /^[0-9]+(-[0-9]+)?$/) {
      printf "::error file=%s,line=%d::Flow-style port published without 127.0.0.1 loopback binding (hostless). Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, flow_lineno
      exit_code = 1
      continue
    }

    # IPv6 with brackets (e.g. [::1]:3000:3000)
    if (qval ~ /^\[/) {
      closing = index(qval, "]")
      if (closing == 0) continue
      host = substr(qval, 1, closing)
      if (host == "[::1]") continue
      printf "::error file=%s,line=%d::Flow-style port published without 127.0.0.1 loopback binding. Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, flow_lineno
      exit_code = 1
      continue
    }

    # Split on colon to extract host part
    parts_count = split(qval, parts, ":")
    if (parts_count < 2) continue
    host = parts[1]

    # Unbracketed IPv6 loopback short syntax must be exact "::1:host:container".
    # Do not reconstruct from partial segments (e.g. ::1:2:3000:3000 is NOT loopback).
    if (qval ~ /^::1:(([0-9]+(-[0-9]+)?|\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\})):([0-9]+(-[0-9]+)?|\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\}))|:([0-9]+(-[0-9]+)?|\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\})))$/) continue

    if (host == "127.0.0.1" || host == "[::1]" || host == "::1") continue

    printf "::error file=%s,line=%d::Flow-style port published without 127.0.0.1 loopback binding. Add 127.0.0.1: prefix or suppress with # nosemgrep: docker-compose-port-no-loopback. See https://github.com/F4CTE/PolyForge/issues/1310\n", file, flow_lineno
    exit_code = 1
  }
}

# ── ports: section tracking ────────────────────────────────────────────

# Enter a ports: section (at any indentation under a service).
# Match "ports:" followed by end-of-line, a comment, a YAML anchor (&),
# or a YAML alias (*) so that keys like "expose_ports:" are not
# misidentified as port lists.
# YAML aliases (ports: *name) cannot be statically verified, so they
# are flagged unless suppressed with nosemgrep.
/^[[:space:]]+["\047]?ports["\047]?:[[:space:]]*($|#|&|\*)/ {
  ports_indent = leadingspaces($0)
  in_ports = 1
  prev_nosemgrep = 0
  if ($0 ~ /["\047]?ports["\047]?:[[:space:]]*\*/ && $0 !~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/) {
    printf "::error file=%s,line=%d::ports: uses YAML alias — cannot verify loopback binding. Inline the port mapping or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax|-flow-style). See https://github.com/F4CTE/PolyForge/issues/1310\n", file, NR
    exit_code = 1
  }
  next
}

# Exit ports: section on any non-blank, non-comment line at or above
# the ports indent level.  Guarded by !in_block so we do not exit
# while still scanning a long-syntax block; the block exit handler
# checks ports exit itself.
in_ports && !in_block {
  cur = leadingspaces($0)
  if ($0 !~ /^[[:space:]]*$/ && $0 !~ /^[[:space:]]*#/) {
    # YAML allows indentless sequences under a key, e.g.:
    #   ports:
    #   - "3000:3000"
    # So a dash item at the same indentation as ports: must remain
    # inside the ports section and be parsed by the rules below.
    is_indentless_item = (cur == ports_indent && $0 ~ /^[[:space:]]*-[[:space:]]+/)
    if (cur < ports_indent || (cur == ports_indent && !is_indentless_item && $0 !~ /^[[:space:]]+["\047]?ports["\047]?:/)) {
      in_ports = 0
      prev_nosemgrep = 0
    }
  }
}

# ── Long-syntax entry detection (MUST come before short-syntax) ────────
# Matches any Docker Compose long-syntax port mapping key (name, target,
# published, host_ip, protocol, mode, app_protocol).  Runs first so that
# long-syntax blocks are never misidentified as short-syntax host:port
# strings.  The entry line itself is inspected for target, published,
# and host_ip keys so that single-line or first-key entries are tracked
# correctly.
in_ports && /^[[:space:]]+- +(name|target|published|host_ip|protocol|mode|app_protocol):/ && !in_block {
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
  has_host_ip = (noncomment ~ /^[[:space:]]+-[[:space:]]+host_ip:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?([^0-9a-f.:]|$)/)
  suppressed = (prev_nosemgrep || $0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/)
  prev_nosemgrep = 0
  next
}

# Long-syntax via bare dash: `-` followed by indented target:/published: keys.
# Docker Compose accepts `-` on its own line with target/published/etc. indented
# underneath.  These would otherwise be silently skipped by the short-syntax
# parser because there is no port value on the dash line.
in_ports && /^[[:space:]]+-[[:space:]]*$/ && !in_block {
  in_block = 1
  port_lead = leadingspaces($0)
  entry_lineno = NR
  saw_target = 0
  saw_published = 0
  has_host_ip = 0
  suppressed = (prev_nosemgrep || $0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/)
  prev_nosemgrep = 0
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
      prev_nosemgrep = 0
    }

    # Re-process this line in case it starts a new port block
    if (in_ports && $0 ~ /^[[:space:]]+- +(name|target|published|host_ip|protocol|mode|app_protocol):/) {
      in_block = 1
      port_lead = cur_indent
      entry_lineno = NR
      saw_target = ($0 ~ / target:/)
      saw_published = ($0 ~ / published:/)
      noncomment = $0
      sub(/[[:space:]]*#.*$/, "", noncomment)
      has_host_ip = (noncomment ~ /^[[:space:]]+-[[:space:]]+host_ip:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?([^0-9a-f.:]|$)/)
      suppressed = ($0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/)
      next
    }
  }

  # Content processing for the current block (only reached when we
  # are still in_block — i.e., the line is deeper than the entry).
  if (in_block) {
    if ($0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/) {
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
    if ($0 ~ /^[[:space:]]+host_ip:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?([^0-9a-f.:]|$)/) {
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
  if ($0 ~ /^[[:space:]]*#[[:space:]]*nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/) {
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
  if ($0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/) { prev_nosemgrep = 0; next }
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
    # Check for loopback host_ip (IPv4 or IPv6) inside the inline map.
    # Handles both unquoted keys (host_ip: 127.0.0.1) and quoted keys
    # ("host_ip": "127.0.0.1", 'host_ip': '127.0.0.1').
    if (val ~ /["'\'']?host_ip["'\'']?:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?(127\.0\.0\.1|\[::1\]|::1)["'\'']?([^0-9a-f.:]|$)/) { next }
    # No loopback host_ip in inline map — flag if target and published exist.
    # Also handles quoted keys ("target": , 'target':) and variable
    # substitution values ($VAR, ${VAR}) that would otherwise silently bypass.
    _target_match = val ~ /["'\'']?target["'\'']?:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?[0-9$]/
    _published_match = val ~ /["'\'']?published["'\'']?:[[:space:]]*([!&*][^[:space:]]*[[:space:]]+)*["'\'']?[0-9$]/
    if (_target_match && _published_match) {
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
      printf "::error file=%s,line=%d::Malformed IPv6 port entry (missing closing bracket) — could not check loopback binding. Fix the bracket syntax or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax).\n", file, NR
      exit_code = 1
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
        suppressed = ($0 ~ /# nosemgrep:.*docker-compose-port-no-loopback(-long-syntax|-flow-style)?/)
        next
      }
      # YAML alias (e.g. - *name).  The referenced mapping cannot be
      # verified, so warn rather than silently skipping.
      if (val ~ /^\*/) {
        printf "::error file=%s,line=%d::YAML alias port entry cannot be verified for loopback binding. Inline the port mapping or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax).\n", file, NR
        exit_code = 1
        next
      }
      # Any other unrecognised single-value entry — warn.
      if (val !~ /^~?$/) {
        printf "::error file=%s,line=%d::Unrecognised port entry could not be checked for loopback binding. Add an explicit host_ip or suppress with # nosemgrep: docker-compose-port-no-loopback(-long-syntax).\n", file, NR
        exit_code = 1
      }
      next
    }
    host = parts[1]

    # Unbracketed IPv6 loopback short syntax must be exact "::1:host:container".
    # Do not reconstruct from partial segments (e.g. ::1:2:3000:3000 is NOT loopback).
    if (val ~ /^::1:(([0-9]+(-[0-9]+)?|\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\})):([0-9]+(-[0-9]+)?|\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\}))|:([0-9]+(-[0-9]+)?|\$([A-Za-z_][A-Za-z0-9_]*|\{[^}]+\})))$/) { next }
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
  echo "  Fix: bind with '127.0.0.1:<port>:<port>' or add '# nosemgrep: docker-compose-port-no-loopback' (-long-syntax/-flow-style suffixes supported) for public entry points"
  echo "  Docs: https://github.com/F4CTE/PolyForge/issues/1310"
fi

exit $EXIT_CODE
