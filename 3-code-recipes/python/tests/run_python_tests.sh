#!/usr/bin/env bash
# run_python_tests.sh
# Usage:
#   bash 3-code-recipes/python/tests/run_python_tests.sh [all|<use-case>|<path> ...]
#
# Examples:
#   run_python_tests.sh                       # run all tests
#   run_python_tests.sh datakiosk reports     # run selected use cases
#   run_python_tests.sh 3-vendor-retail-procurement
#   run_python_tests.sh tests/2-reporting-analytics/reports
#
# A use case is matched against the folder names below tests/, ignoring case,
# hyphens, underscores and the numeric category prefix. "datakiosk",
# "data-kiosk", "multichannel_fulfillment" and "vendor-retail-procurement"
# all resolve to their respective folders.
#
# - Starts the PM2 mock backend (installs npm dependencies first)
# - Ensures a virtualenv exists and installs test-requirements.txt
#   (defaults to <repo>/.venv, override with VENV_DIR=/path/to/venv)
# - Runs pytest for the resolved targets
# This script can be executed from any directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CODE_RECIPES_DIR="$(cd "$PYTHON_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CODE_RECIPES_DIR/.." && pwd)"
TESTS_DIR="$PYTHON_DIR/tests"
MOCK_DIR="$CODE_RECIPES_DIR/test"
PM2_CLI="$MOCK_DIR/node_modules/pm2/lib/binaries/CLI.js"
MOCK_NAME="mock-backend"
MOCK_URL="http://localhost:3000"
VENV_DIR="${VENV_DIR:-$REPO_ROOT/.venv}"

# Lowercase and strip everything except letters and digits (bash 3.2 compatible).
normalize() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]'
}

start_mock_backend() {
  pushd "$MOCK_DIR" >/dev/null
  npm install --no-audit --no-fund >/dev/null
  # Remove a leftover instance so `start` doesn't fail on a duplicate name.
  node "$PM2_CLI" delete "$MOCK_NAME" >/dev/null 2>&1 || true
  node "$PM2_CLI" start src/index.js --name "$MOCK_NAME" >/dev/null
  popd >/dev/null

  # Wait until the mock backend accepts requests.
  local attempt
  for attempt in $(seq 1 30); do
    if curl -s -o /dev/null -X POST "$MOCK_URL/auth/o2/token"; then
      return 0
    fi
    sleep 0.5
  done
  echo "Mock backend did not start on $MOCK_URL" >&2
  exit 1
}

stop_mock_backend() {
  if [[ -f "$PM2_CLI" ]]; then
    (cd "$MOCK_DIR" && node "$PM2_CLI" delete "$MOCK_NAME" >/dev/null 2>&1) || true
  fi
}

ensure_venv() {
  if [[ ! -x "$VENV_DIR/bin/python" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m pip install --quiet --upgrade pip
  "$VENV_DIR/bin/python" -m pip install --quiet -r "$PYTHON_DIR/test-requirements.txt"
}

# Prints one pytest target per line, relative to PYTHON_DIR.
resolve_targets() {
  if [[ $# -eq 0 || "$1" == "all" ]]; then
    echo "tests"
    return
  fi

  local selection key dir name matches
  for selection in "$@"; do
    # Explicit paths (relative to the python dir) are passed through.
    if [[ -e "$PYTHON_DIR/$selection" ]]; then
      echo "$selection"
      continue
    fi

    key="$(normalize "$selection")"
    matches=""
    while IFS= read -r dir; do
      name="$(basename "$dir")"
      # Match "2-reporting-analytics" as well as "reporting-analytics".
      if [[ "$(normalize "$name")" == "$key" || "$(normalize "${name#[0-9]-}")" == "$key" ]]; then
        matches+="${dir#"$PYTHON_DIR"/}"$'\n'
      fi
    done < <(find "$TESTS_DIR" -mindepth 1 -type d -not -name "__pycache__" | sort)

    if [[ -z "$matches" ]]; then
      echo "Unknown use case '$selection'. Available use cases:" >&2
      find "$TESTS_DIR" -mindepth 1 -type d -not -name "__pycache__" \
        | sed "s#^$TESTS_DIR/#  #" | sort >&2
      exit 1
    fi
    printf '%s' "$matches"
  done
}

# Resolve targets before starting anything so typos fail fast.
TARGETS=()
while IFS= read -r target; do
  [[ -n "$target" ]] && TARGETS+=("$target")
done < <(resolve_targets "$@")
[[ ${#TARGETS[@]} -gt 0 ]] || exit 1

trap stop_mock_backend EXIT
start_mock_backend
ensure_venv

cd "$PYTHON_DIR"
echo "Running pytest ${TARGETS[*]}"
"$VENV_DIR/bin/pytest" "${TARGETS[@]}"
