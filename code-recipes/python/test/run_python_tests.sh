#!/usr/bin/env 
# run_python_tests.sh
# Usage:
#   sh code-recipes/python/test/run_python_tests.sh [all|datakiosk|awd ...]
# - Starts the PM2 mock backend (npm install if needed)
# - Ensures `.venv` exists and installs pytest
# - Runs pytest targets matching the provided use-case names (defaults to all)
# This script can be executed from any directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CODE_RECIPES_DIR="$REPO_ROOT/code-recipes"
PYTHON_DIR="$CODE_RECIPES_DIR/python"
MOCK_DIR="$CODE_RECIPES_DIR/test"
PM2_CLI="$MOCK_DIR/node_modules/pm2/lib/binaries/CLI.js"
VENV_DIR="$REPO_ROOT/.venv"

start_mock_backend() {
  pushd "$MOCK_DIR" >/dev/null
  npm install >/dev/null
  node "$PM2_CLI" start src/index.js --name mock-backend >/dev/null
  popd >/dev/null
}

stop_mock_backend() {
  pushd "$MOCK_DIR" >/dev/null
  node "$PM2_CLI" stop mock-backend >/dev/null || true
  popd >/dev/null
}

ensure_venv() {
  if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m pip install --upgrade pip >/dev/null
  "$VENV_DIR/bin/pip" install pytest >/dev/null
}

resolve_targets() {
  local selections=("$@")
  local resolved=()
  if [[ ${#selections[@]} -eq 0 || "${selections[0]}" == "all" ]]; then
    resolved+=("test")
  else
    for selection in "${selections[@]}"; do
      local key="${selection,,}"
      local path=""
      case "$key" in
        datakiosk) path="test/datakiosk/test_datakiosk_query_recipe.py" ;;
        *) path="test/$key" ;;
      esac
      if [[ ! -e "$PYTHON_DIR/$path" ]]; then
        echo "Unknown or missing use case '$selection' (expected path: $path)" >&2
        exit 1
      fi
      resolved+=("$path")
    done
  fi
  printf '%s\n' "${resolved[@]}"
}

trap stop_mock_backend EXIT
start_mock_backend
ensure_venv
TMP_TARGETS="$(resolve_targets "$@")"
IFS=$'\n' read -r -d '' -a TARGETS <<<"${TMP_TARGETS}" || true

pushd "$PYTHON_DIR" >/dev/null
for target in "${TARGETS[@]}"; do
  echo "Running pytest $target"
  "$VENV_DIR/bin/pytest" "$target"
done
popd >/dev/null
