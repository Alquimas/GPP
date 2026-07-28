#!/usr/bin/env bash
# gsfen-find.sh — Find GSFEN strings in project files
#
# Finds GSFEN state serialization strings (the 4-field format or the
# "startpos" keyword) across source, tests, fixtures, and docs.
#
# Usage:
#   ./gsfen-find.sh                     # search from current directory
#   ./gsfen-find.sh <path>              # search from <path>
#   ./gsfen-find.sh --no-md             # skip .md files (docs have examples)
#   ./gsfen-find.sh --color             # highlight matches
#
# The regex uses 8 slashes (9 rows) as its anchor — very unlikely to
# produce false positives in normal code.  False negatives are minimised
# by keeping the character class broad ([A-Za-z0-9,]).
#
# Requires: grep with -E (ERE) support (GNU grep, macOS grep, etc.) or ripgrep.

set -euo pipefail

SEARCH_DIR="."
USE_COLOR=""
EXCLUDE_MD=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --no-md) EXCLUDE_MD=1 ;;
    --color) USE_COLOR=1 ;;
    --help|-h)
      sed -n 's/^# //p; s/^#$//p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$arg" || "$arg" == -* ]]; then
        echo "Unknown option: $arg" >&2
        exit 1
      fi
      SEARCH_DIR="$arg"
      ;;
  esac
done

# Regex:
#   startpos                    — the keyword form, OR
#   [A-Za-z0-9,]+              — first row of the position field
#   (/[A-Za-z0-9,]+){8}        — rows 2-9 (8 more, each preceded by /)
#   [ ]                         — space before turn
#   (w|b|dw|db|dwB|dbW)        — turn token
#   [ ]                         — space before hands
#   (-|[A-Za-z0-9]+)           — hands (hyphen or alphanumeric)
#   [ ]                         — space before counter
#   [1-9][0-9]*                 — counter (>=1, no leading zeros)
GSFEN_REGEX='startpos|[A-Za-z0-9,]+(/[A-Za-z0-9,]+){8} (w|b|dw|db|dwB|dbW) (-|[A-Za-z0-9]+) [1-9][0-9]*'

if command -v rg &>/dev/null; then
  # Use ripgrep
  RG_ARGS=(
    --line-number
    --no-heading
  )
  if [[ -n "$USE_COLOR" ]]; then
    RG_ARGS+=(--color always)
  fi
  if [[ -n "$EXCLUDE_MD" ]]; then
    RG_ARGS+=(--glob '!*.md')
  fi
  if [[ "$SEARCH_DIR" != *node_modules* ]]; then
    RG_ARGS+=(--glob '!node_modules/**')
  fi
  rg "${RG_ARGS[@]}" "$GSFEN_REGEX" "$SEARCH_DIR"

elif grep -E '' /dev/null &>/dev/null 2>&1; then
  # Use grep with ERE
  GREP_ARGS=(
    -rn
    -E
  )
  if [[ -n "$USE_COLOR" ]]; then
    GREP_ARGS+=(--color=always)
  fi
  if [[ "$SEARCH_DIR" != *node_modules* ]]; then
    GREP_ARGS+=(--exclude-dir=node_modules)
  fi
  if [[ -n "$EXCLUDE_MD" ]]; then
    GREP_ARGS+=(--exclude='*.md')
  fi
  grep "${GREP_ARGS[@]}" "$GSFEN_REGEX" "$SEARCH_DIR" 2>/dev/null || true

else
  echo "Error: need ripgrep or grep with -E (ERE) support" >&2
  exit 1
fi
