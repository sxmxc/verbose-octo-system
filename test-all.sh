#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_VENV_DIR="$ROOT_DIR/backend/.venv"
BACKEND_PYTHON_BIN="${BACKEND_PYTHON:-}"

print_header() {
  printf '\n==== %s ====' "$1"
  printf '\n'
}

ensure_backend_python() {
  if [ -n "$BACKEND_PYTHON_BIN" ]; then
    if [ -x "$BACKEND_PYTHON_BIN" ]; then
      return
    fi
    echo "Configured backend Python '$BACKEND_PYTHON_BIN' is not executable." >&2
    echo "Set BACKEND_PYTHON to a valid interpreter or create backend/.venv." >&2
    exit 1
  fi

  if [ -x "$BACKEND_VENV_DIR/bin/python" ]; then
    BACKEND_PYTHON_BIN="$BACKEND_VENV_DIR/bin/python"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    BACKEND_PYTHON_BIN="$(command -v python3)"
    return
  fi

  if command -v python >/dev/null 2>&1; then
    BACKEND_PYTHON_BIN="$(command -v python)"
    return
  fi

  echo "Unable to locate a Python interpreter for backend tests." >&2
  echo "Create a virtualenv at backend/.venv or export BACKEND_PYTHON=/path/to/python." >&2
  exit 1
}

check_python_module() {
  local module="$1"
  ensure_backend_python
  "$BACKEND_PYTHON_BIN" - "$module" <<'PY' 2>/dev/null
import importlib.util
import sys

module_name = sys.argv[1]
sys.exit(0 if importlib.util.find_spec(module_name) else 1)
PY
}

ensure_backend_dependencies() {
  ensure_backend_python
  local missing=()
  for module in fastapi pydantic sqlalchemy; do
    if ! check_python_module "$module"; then
      missing+=("$module")
    fi
  done

  if ((${#missing[@]})); then
    echo "Missing backend Python packages: ${missing[*]}" >&2
    if [ -x "$BACKEND_VENV_DIR/bin/pip" ]; then
      echo "Install them with: $BACKEND_VENV_DIR/bin/pip install -r backend/requirements.txt" >&2
    else
      echo "Create the venv and install: python -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt" >&2
    fi
    exit 1
  fi
}

ensure_frontend_dependencies() {
  local vitest_bin="$ROOT_DIR/frontend/node_modules/.bin/vitest"
  if [ ! -x "$vitest_bin" ]; then
    echo "Frontend dependencies not installed. Run 'npm install' inside frontend/." >&2
    exit 1
  fi
}

run_backend_tests() {
  ensure_backend_dependencies
  print_header "Running backend tests"
  (cd "$ROOT_DIR/backend" && "$BACKEND_PYTHON_BIN" -m pytest "$@")
}

run_frontend_tests() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm executable not found" >&2
    exit 1
  fi
  ensure_frontend_dependencies
  print_header "Running frontend tests"
  (cd "$ROOT_DIR/frontend" && npm run test -- "$@")
}

usage() {
  cat <<USAGE
Usage: $(basename "$0") [backend|frontend|all]

Run the full test suite for the backend, frontend, or both (default).
USAGE
}

TARGET="${1:-all}"
shift $(( $# > 0 ? 1 : 0 )) || true

case "$TARGET" in
  backend)
    run_backend_tests "$@"
    ;;
  frontend)
    run_frontend_tests "$@"
    ;;
  all)
    run_backend_tests "$@"
    run_frontend_tests "$@"
    ;;
  -h|--help)
    usage
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    usage
    exit 1
    ;;
esac
