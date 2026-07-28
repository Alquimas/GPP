#!/usr/bin/env bash
# browse-rule.sh — T2 Rule Browser (Phase 3)
#
# Given a BR-xxx or GSFEN rule code, returns:
#   - The rule text from BUSINESS_RULES.md or GSFEN.md
#   - Source files that enforce it
#   - Tests that exercise it
#   - ORACLE.md step reference
#   - Related rules
#
# Usage:
#   ./oracle/script/browse-rule.sh BR-MOVE-005
#   ./oracle/script/browse-rule.sh BR-GSFEN-CANON-POSITION-COMPRESSION
#   ./oracle/script/browse-rule.sh --all          # list all known codes
#   ./oracle/script/browse-rule.sh --help         # this help
#
# Requires: grep with -E (ERE) support (GNU grep, macOS grep, etc.) or ripgrep.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ORACLE_DIR="$PROJECT_DIR/oracle"
BUSINESS_RULES="$PROJECT_DIR/BUSINESS_RULES.md"
ORACLE_DOC="$PROJECT_DIR/ORACLE.md"
REFINING_DOC="$PROJECT_DIR/REFINING.md"
TEST_DOC="$PROJECT_DIR/TEST.md"
GAN_DOC="$PROJECT_DIR/GAN.md"
GSFEN_DOC="$PROJECT_DIR/GSFEN.md"

# ── helpers ────────────────────────────────────────────────────────

color() { local c="$1"; shift; if [[ -t 1 ]]; then echo "$c$*${reset}"; else echo "$*"; fi; }
bold="$(color '' '')"   # placeholder — computed if color is available
reset=""
if [[ -t 1 ]]; then
  reset="$(tput sgr0 2>/dev/null || true)"
  bold="$(tput bold 2>/dev/null || true)"
fi

has_rg=false
command -v rg &>/dev/null && has_rg=true

# ── extract rule text from BUSINESS_RULES.md ────────────────────────

extract_rule_text() {
  local code="$1"

  # GSFEN codes are defined in GSFEN.md, not BUSINESS_RULES.md
  if [[ "$code" == BR-GSFEN-* ]]; then
    extract_gsfen_rule_text "$code"
    return
  fi

  # GAN codes are defined in GAN.md, not BUSINESS_RULES.md
  if [[ "$code" == BR-GAN-* ]]; then
    extract_gan_rule_text "$code"
    return
  fi

  local rule_file="$BUSINESS_RULES"

  # Find the heading line
  local heading_line
  heading_line="$($has_rg && rg -n "^#{1,6} +$code " "$rule_file" || grep -n "^#### $code " "$rule_file")" || true

  if [[ -z "$heading_line" ]]; then
    # Try broader match (#### BR-XXX-NNN - Title)
    heading_line="$($has_rg && rg -n "^#{1,6} +$code" "$rule_file" || grep -n "^#### $code" "$rule_file")" || true
  fi

  if [[ -z "$heading_line" ]]; then
    echo "  (not found in BUSINESS_RULES.md)"
    return
  fi

  local line_num="${heading_line%%:*}"
  local heading_text="${heading_line#*:}"

  # Print body: lines following the heading until next heading or horizontal rule
  # Use awk: from line_num+1 until we hit a line starting with ### or ## or --- or EOF
  awk -v start="$line_num" '
    NR > start {
      if (/^#{2,4} / || /^---/) exit
      if (/^$/) { print ""; next }
      print "  " $0
    }
  ' "$rule_file"
}

# ── extract rule text from GSFEN.md ─────────────────────────────────

extract_gsfen_rule_text() {
  local code="$1"
  local rule_file="$GSFEN_DOC"

  local line_num
  if $has_rg; then
    line_num="$($has_rg && rg -nF "$code" "$rule_file" | head -1 | cut -d: -f1)"
  else
    line_num="$(grep -nF "$code" "$rule_file" | head -1 | cut -d: -f1)"
  fi 2>/dev/null || true

  if [[ -z "$line_num" ]]; then
    echo "  (not found in GSFEN.md)"
    return
  fi

  awk -v start="$line_num" '
    NR >= start {
      if (NR > start && (/^#{1,6} / || /^---$/ || /^- \*\*/ || /^$/)) exit
      if (NR == start) {
        sub(/^- \*\*[^*]+\*\* — /, "")
        sub(/^  - \*\*[^*]+\*\* — /, "")
        print "  " $0
        next
      }
      print "  " $0
    }
  ' "$rule_file"
}

# ── extract rule text from GAN.md ──────────────────────────────────

extract_gan_rule_text() {
  local code="$1"
  local rule_file="$GAN_DOC"

  local line_num
  if $has_rg; then
    line_num="$($has_rg && rg -nF "$code" "$rule_file" | head -1 | cut -d: -f1)"
  else
    line_num="$(grep -nF "$code" "$rule_file" | head -1 | cut -d: -f1)"
  fi 2>/dev/null || true

  if [[ -z "$line_num" ]]; then
    echo "  (not found in GAN.md)"
    return
  fi

  awk -v start="$line_num" '
    NR >= start {
      if (NR > start && (/^#{1,6} / || /^---$/ || /^- \*\*/ || /^$/)) exit
      if (NR == start) {
        sub(/^- \*\*[^*]+\*\* --- /, "")
        print "  " $0
        next
      }
      print "  " $0
    }
  ' "$rule_file"
}

# ── find related rules (same group + cross-references) ─────────────

find_related_rules() {
  local code="$1"

  # GSFEN codes use GSFEN.md for related rules
  if [[ "$code" == BR-GSFEN-* ]]; then
    find_gsfen_related_rules "$code"
    return
  fi

  # GAN codes use GAN.md for related rules
  if [[ "$code" == BR-GAN-* ]]; then
    find_gan_related_rules "$code"
    return
  fi

  # Extract the group prefix (e.g. BR-MOVE from BR-MOVE-005)
  local group="${code%-*}"
  local group_section

  echo "  ${bold}Same group (${group}-*):${reset}"

  # Find all rules in the same group
  if $has_rg; then
    group_section="$($has_rg && rg "^#### ${group}-" "$BUSINESS_RULES" || grep "^#### ${group}-" "$BUSINESS_RULES")" || true
  else
    group_section="$(grep "^#### ${group}-" "$BUSINESS_RULES")" || true
  fi

  if [[ -n "$group_section" ]]; then
    echo "$group_section" | while IFS= read -r line; do
      local rule_code
      rule_code="$(echo "$line" | sed -E 's/^#+ +//' | awk '{print $1}')"
      local rule_title
      rule_title="$(echo "$line" | sed -E 's/^#+ +//' | sed -E 's/^[^ ]+ - //')"
      if [[ "$rule_code" != "$code" ]]; then
        printf "    %-22s %s\n" "$rule_code" "$rule_title"
      fi
    done
  else
    echo "    (none)"
  fi

  # Cross-references found in the rule text itself
  echo ""
  echo "  ${bold}Cross-referenced in rule text:${reset}"
  local start_line
  start_line="$($has_rg && rg -n "^#### $code " "$BUSINESS_RULES" || grep -n "^#### $code " "$BUSINESS_RULES")" || true
  if [[ -z "$start_line" ]]; then
    start_line="$($has_rg && rg -n "^#### $code" "$BUSINESS_RULES" || grep -n "^#### $code" "$BUSINESS_RULES")" || true
  fi
  if [[ -n "$start_line" ]]; then
    local line_num="${start_line%%:*}"
    # Extract BR-xxx references from the rule body
    local refs
    refs="$(awk -v start="$line_num" '
      NR > start {
        if (/^#{2,4} / || /^---/) exit
        # collect all BR-XXX-NNN codes
        while (match($0, /BR-[A-Z]+-[0-9]+/)) {
          print substr($0, RSTART, RLENGTH)
          $0 = substr($0, RSTART + RLENGTH)
        }
      }
    ' "$BUSINESS_RULES" | sort -u)"

    if [[ -n "$refs" ]]; then
      echo "$refs" | while IFS= read -r ref; do
        echo "    $ref"
      done
    else
      echo "    (none)"
    fi
  fi
}

# ── find related GSFEN rules (same family in GSFEN.md) ─────────────

find_gsfen_related_rules() {
  local code="$1"

  # Determine the family prefix (BR-GSFEN-CANON or BR-GSFEN-VALID)
  local family
  family="$(echo "$code" | sed -n 's/^\(BR-GSFEN-CANON\|BR-GSFEN-VALID\).*/\1/p')"

  if [[ -z "$family" ]]; then
    echo "  (unknown GSFEN rule family)"
    return
  fi

  echo "  ${bold}Same family (${family}-*):${reset}"

  local results
  if $has_rg; then
    results="$($has_rg && rg -n "\*\*${family}" "$GSFEN_DOC")"
  else
    results="$(grep -n "\*\*${family}" "$GSFEN_DOC")"
  fi 2>/dev/null || true

  if [[ -z "$results" ]]; then
    echo "    (none)"
    return
  fi

  echo "$results" | while IFS=: read -r line rest; do
    local rule_code
    rule_code="$(echo "$rest" | sed -n 's/.*\*\*\([^*]*\)\*\*.*/\1/p')"
    if [[ -n "$rule_code" && "$rule_code" != "$code" ]]; then
      local title
      title="$(echo "$rest" | sed -n 's/.*\*\*[^*]*\*\* — //p' | head -c 60)"
      printf "    %-40s %s\n" "$rule_code" "$title"
    fi
  done
}

# ── find related GAN rules (same family in GAN.md) ─────────────────

find_gan_related_rules() {
  local code="$1"

  # Determine the family prefix (BR-GAN-GRAMMAR, BR-GAN-CANON, or BR-GAN-VALID)
  local family
  family="$(echo "$code" | sed -n 's/^\(BR-GAN-GRAMMAR\|BR-GAN-CANON\|BR-GAN-VALID\).*/\1/p')"

  if [[ -z "$family" ]]; then
    echo "  (unknown GAN rule family)"
    return
  fi

  echo "  ${bold}Same family (${family}-*):${reset}"

  local results
  if $has_rg; then
    results="$($has_rg && rg -n "\*\*${family}" "$GAN_DOC")"
  else
    results="$(grep -n "\*\*${family}" "$GAN_DOC")"
  fi 2>/dev/null || true

  if [[ -z "$results" ]]; then
    echo "    (none)"
    return
  fi

  echo "$results" | while IFS=: read -r line rest; do
    local rule_code
    rule_code="$(echo "$rest" | sed -n 's/.*\*\*\([^*]*\)\*\*.*/\1/p')"
    if [[ -n "$rule_code" && "$rule_code" != "$code" ]]; then
      local title
      title="$(echo "$rest" | sed -n 's/.*\*\*[^*]*\*\* --- //p' | head -c 60)"
      printf "    %-40s %s\n" "$rule_code" "$title"
    fi
  done
}

# ── search references in a directory ───────────────────────────────

search_refs() {
  local label="$1"
  local dir="$2"
  local code="$3"
  local prefix="${4:-}"

  if $has_rg; then
    local results
    results="$($has_rg && rg -n "$code" "$dir" 2>/dev/null)" || true
  else
    local results
    results="$(grep -rn "$code" "$dir" 2>/dev/null || true)"
  fi

  if [[ -z "$results" ]]; then
    echo "  (none)"
  else
    echo "$results" | head -40 | while IFS=: read -r file line rest; do
      local relpath="${file#$PROJECT_DIR/}"
      local context
      context="$(echo "$rest" | sed -E 's/^[[:space:]]*//' | sed -E 's/^\/\/|^#|^\* ?//' | head -c 80)"
      if [[ -n "$context" ]]; then
        printf "  %-48s %s\n" "$relpath:$line" "$context"
      else
        printf "  %s\n" "$relpath:$line"
      fi
    done
    local total
    total="$(echo "$results" | wc -l)"
    if (( total > 40 )); then
      echo "  ... and $((total - 40)) more matches"
    fi
  fi
}

# ── find ORACLE.md step references ─────────────────────────────────

find_oracle_refs() {
  local code="$1"

  if $has_rg; then
    local results
    results="$($has_rg && rg -n "$code" "$ORACLE_DOC" 2>/dev/null)" || true
  else
    local results
    results="$(grep -n "$code" "$ORACLE_DOC" 2>/dev/null || true)"
  fi

  if [[ -z "$results" ]]; then
    echo "  (not referenced in ORACLE.md)"
  else
    echo "$results" | while IFS=: read -r line rest; do
      local context
      context="$(echo "$rest" | sed -E 's/^[[:space:]]*//' | head -c 100)"
      # Try to detect which step this belongs to
      printf "  line %-4s %s\n" "$line" "$context"
    done
  fi
}

# ── find REFINING.md references ───────────────────────────────────

find_refining_refs() {
  local code="$1"

  if $has_rg; then
    local results
    results="$($has_rg && rg -n "$code" "$REFINING_DOC" 2>/dev/null)" || true
  else
    local results
    results="$(grep -n "$code" "$REFINING_DOC" 2>/dev/null || true)"
  fi

  if [[ -z "$results" ]]; then
    echo "  (not referenced)"
  else
    echo "$results" | while IFS=: read -r line rest; do
      local context
      context="$(echo "$rest" | sed -E 's/^[[:space:]]*//' | head -c 100)"
      printf "  line %-4s %s\n" "$line" "$context"
    done
  fi
}

# ── list all known BR-xxx codes ────────────────────────────────────

list_all_codes() {
  echo "${bold}All BR-xxx codes in BUSINESS_RULES.md:${reset}"
  echo ""

  # Group by prefix
  local current_group=""
  if $has_rg; then
    $has_rg && rg "^#### BR-" "$BUSINESS_RULES" || grep "^#### BR-" "$BUSINESS_RULES" || true
  else
    grep "^#### BR-" "$BUSINESS_RULES" || true
  fi | while IFS= read -r line; do
    local code
    code="$(echo "$line" | sed -E 's/^#+ +//' | awk '{print $1}')"
    local title
    title="$(echo "$line" | sed -E 's/^#+ +//' | sed -E 's/^[^ ]+ - //')"
    local group="${code%-*}"
    if [[ "$group" != "$current_group" ]]; then
      current_group="$group"
      echo ""
      echo "  ${bold}${group}${reset}"
    fi
    printf "    %-22s %s\n" "$code" "$title"
  done

  local total
  total="$($has_rg && rg -c "^#### BR-" "$BUSINESS_RULES" || grep -c "^#### BR-" "$BUSINESS_RULES")" || true
  echo ""
  echo "  ${bold}Total: ${total} BR-xxx codes${reset}"

  # ────────── GSFEN codes ──────────
  echo ""
  echo "${bold}GSFEN codes in GSFEN.md:${reset}"

  # Canonical-form codes
  echo ""
  echo "  ${bold}BR-GSFEN-CANON-*${reset}"
  if $has_rg; then
    $has_rg && rg -n "\*\*BR-GSFEN-CANON-" "$GSFEN_DOC"
  else
    grep -n "\*\*BR-GSFEN-CANON-" "$GSFEN_DOC"
  fi 2>/dev/null | while IFS=: read -r line rest; do
    local rule_code
    rule_code="$(echo "$rest" | sed -n 's/.*\*\*\([^*]*\)\*\*.*/\1/p')"
    local title
    title="$(echo "$rest" | sed -n 's/.*\*\*[^*]*\*\* — //p' | head -c 70)"
    if [[ -n "$rule_code" ]]; then
      printf "    %-44s %s\n" "$rule_code" "$title"
    fi
  done

  # Semantic validity codes
  echo ""
  echo "  ${bold}BR-GSFEN-VALID-*${reset}"
  if $has_rg; then
    $has_rg && rg -n "\*\*BR-GSFEN-VALID-" "$GSFEN_DOC"
  else
    grep -n "\*\*BR-GSFEN-VALID-" "$GSFEN_DOC"
  fi 2>/dev/null | while IFS=: read -r line rest; do
    local rule_code
    rule_code="$(echo "$rest" | sed -n 's/.*\*\*\([^*]*\)\*\*.*/\1/p')"
    local title
    title="$(echo "$rest" | sed -n 's/.*\*\*[^*]*\*\* — //p' | head -c 70)"
    if [[ -n "$rule_code" ]]; then
      printf "    %-44s %s\n" "$rule_code" "$title"
    fi
  done

  local gsfen_total
  gsfen_total="$($has_rg && rg -c "\*\*BR-GSFEN-" "$GSFEN_DOC" || grep -c "\*\*BR-GSFEN-" "$GSFEN_DOC")" 2>/dev/null || gsfen_total=0
  echo ""
  echo "  ${bold}Total: ${gsfen_total} GSFEN codes${reset}"

  # ────────── GAN codes ──────────
  echo ""
  echo "${bold}GAN codes in GAN.md:${reset}"

  for family in "BR-GAN-GRAMMAR" "BR-GAN-CANON" "BR-GAN-VALID"; do
    local family_display
    if [[ "$family" == "BR-GAN-GRAMMAR" ]]; then
      family_display="Grammar rules"
    elif [[ "$family" == "BR-GAN-CANON" ]]; then
      family_display="Canonical-form rules"
    else
      family_display="Semantic Validity"
    fi
    echo ""
    echo "  ${bold}${family}-* ($family_display)${reset}"
    if $has_rg; then
      $has_rg && rg -n "\*\*${family}-" "$GAN_DOC"
    else
      grep -n "\*\*${family}-" "$GAN_DOC"
    fi 2>/dev/null | while IFS=: read -r line rest; do
      local rule_code
      rule_code="$(echo "$rest" | sed -n 's/.*\*\*\([^*]*\)\*\*.*/\1/p')"
      local title
      title="$(echo "$rest" | sed -n 's/.*\*\*[^*]*\*\* --- //p' | head -c 70)"
      if [[ -n "$rule_code" ]]; then
        printf "    %-44s %s\n" "$rule_code" "$title"
      fi
    done
  done

  local gan_total
  gan_total="$($has_rg && rg -c "\*\*BR-GAN-" "$GAN_DOC" || grep -c "\*\*BR-GAN-" "$GAN_DOC")" 2>/dev/null || gan_total=0
  echo ""
  echo "  ${bold}Total: ${gan_total} GAN codes${reset}"
}

# ── show one rule ──────────────────────────────────────────────────

show_rule() {
  local code="$1"

  # Normalize: allow BR-MOVE-005 or MOVE-005 (GSFEN codes already include BR- prefix)
  if [[ "$code" != BR-* ]]; then
    code="BR-$code"
  fi

  # Validate format — accept any BR- with hyphen-separated uppercase/digit segments
  if ! echo "$code" | grep -qE '^BR-[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$'; then
    echo "Error: Invalid rule code format. Expected BR-XXX-NNN, BR-GAN-xxx, BR-GSFEN-CANON-*, or BR-GSFEN-VALID-* (e.g. BR-MOVE-005)" >&2
    exit 1
  fi

  # Check if code exists — search BUSINESS_RULES.md, GAN.md, or GSFEN.md as appropriate
  local exists=0
  if [[ "$code" == BR-GSFEN-* ]]; then
    exists="$($has_rg && rg -qF "$code" "$GSFEN_DOC" && echo 1 || grep -qF "$code" "$GSFEN_DOC" 2>/dev/null && echo 1 || echo 0)" || true
  elif [[ "$code" == BR-GAN-* ]]; then
    exists="$($has_rg && rg -qF "$code" "$GAN_DOC" && echo 1 || grep -qF "$code" "$GAN_DOC" 2>/dev/null && echo 1 || echo 0)" || true
  else
    exists="$($has_rg && rg -q "^#### $code " "$BUSINESS_RULES" && echo 1 || echo 0)" || true
    if [[ "$exists" != 1 ]]; then
      exists="$($has_rg && rg -q "^#### $code" "$BUSINESS_RULES" && echo 1 || echo 0)" || true
    fi
    if [[ "$exists" != 1 ]]; then
      exists="$(grep -q "^#### $code" "$BUSINESS_RULES" 2>/dev/null && echo 1 || echo 0)" || true
    fi
  fi

  echo "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
  echo " ${bold}$code${reset}"
  if [[ "$code" == BR-GSFEN-* ]]; then
    # GSFEN codes belong to sections in GSFEN.md
    local gsfen_section
    if $has_rg; then
      gsfen_section="$($has_rg -n "^## " "$GSFEN_DOC" | awk -F: '/Canonicalization/{s="Canonicalization"} /Semantic Validity/{s="Semantic Validity"} END{if(s) print s}')"
    fi
    if echo "$code" | grep -q 'CANON'; then
      echo "  GSFEN.md → Canonicalization section"
    else
      echo "  GSFEN.md → Semantic Validity section"
    fi
  elif [[ "$code" == BR-GAN-* ]]; then
    # GAN codes belong to sections in GAN.md
    if echo "$code" | grep -q 'GRAMMAR'; then
      echo "  GAN.md → Grammar rules section"
    elif echo "$code" | grep -q 'CANON'; then
      echo "  GAN.md → Canonical-form rules section"
    else
      echo "  GAN.md → Semantic Validity section"
    fi
  else
    local group_title
    group_title="$(echo "$code" | sed -E 's/^(BR-[A-Z]+).*/\1/')"
    local group_heading
    group_heading="$($has_rg && rg "^### $group_title " "$BUSINESS_RULES" || grep "^### $group_title " "$BUSINESS_RULES")" || true
    if [[ -z "$group_heading" ]]; then
      group_heading="$($has_rg && rg "^### $group_title -" "$BUSINESS_RULES" || grep "^### $group_title -" "$BUSINESS_RULES")" || true
    fi
    if [[ -n "$group_heading" ]]; then
      echo "  $(echo "$group_heading" | sed -E 's/^#+ +//')"
    fi
  fi
  echo ""

  # 1. Rule text
  echo "${bold}┃ Rule Text${reset}"
  echo "${bold}┃${reset}"
  extract_rule_text "$code"
  echo ""

  # 2. Source files
  echo "${bold}┃ Source Files${reset}"
  echo "${bold}┃${reset}"
  search_refs "src" "$ORACLE_DIR/src" "$code"
  echo ""

  # 3. Tests
  echo "${bold}┃ Tests${reset}"
  echo "${bold}┃${reset}"
  search_refs "tests" "$ORACLE_DIR/tests" "$code"
  echo ""

  # 4. ORACLE.md references
  echo "${bold}┃ ORACLE.md References${reset}"
  echo "${bold}┃${reset}"
  find_oracle_refs "$code"
  echo ""

  # 5. REFINING.md references
  echo "${bold}┃ REFINING.md References${reset}"
  echo "${bold}┃${reset}"
  find_refining_refs "$code"
  echo ""

  # 6. Related rules
  echo "${bold}┃ Related Rules${reset}"
  echo "${bold}┃${reset}"
  find_related_rules "$code"
  echo ""

  # 7. Other docs
  echo "${bold}┃ Other References${reset}"
  echo "${bold}┃${reset}"
  local other_hits=""
  if $has_rg; then
    other_hits="$($has_rg && rg -n "$code" "$GAN_DOC" "$TEST_DOC" 2>/dev/null || true)"
  else
    other_hits="$(grep -n "$code" "$GAN_DOC" "$TEST_DOC" 2>/dev/null || true)"
  fi
  if [[ -n "$other_hits" ]]; then
    echo "$other_hits" | while IFS=: read -r file line rest; do
      local relpath="${file#$PROJECT_DIR/}"
      local context
      context="$(echo "$rest" | sed -E 's/^[[:space:]]*//' | head -c 80)"
      if [[ -n "$context" ]]; then
        printf "  %-44s %s\n" "$relpath:$line" "$context"
      else
        printf "  %s\n" "$relpath:$line"
      fi
    done
  else
    echo "  (none)"
  fi
  echo ""
  echo "${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}"
}

# ── main ───────────────────────────────────────────────────────────

case "${1:-}" in
  --help|-h)
    # Print the doc header (lines starting with # at the top of the file)
    while IFS= read -r line; do
      case "$line" in
        '# '*) echo "${line#\# }" ;;
        '#') echo "" ;;
        '#'*) ;;  # skip other # lines
        *) break ;;
      esac
    done < "$0"
    echo ""
    echo "For a list of all BR-xxx codes: browse-rule.sh --all"
    exit 0
    ;;
  --all|-a)
    list_all_codes
    ;;
  *)
    if [[ -z "${1:-}" ]]; then
      echo "Error: Missing BR-xxx code. Usage: browse-rule.sh BR-MOVE-005" >&2
      echo "  Try:  browse-rule.sh --all   to list all codes" >&2
      exit 1
    fi
    show_rule "$1"
    ;;
esac
