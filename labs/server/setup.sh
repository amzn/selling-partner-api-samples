#!/usr/bin/env bash
set -e  # Exit on any error

# ── Pretty output ───────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_message(){ echo -e "${1}${2}${NC}"; }
print_success(){ print_message "$GREEN" "✓ $1"; }
print_error(){   print_message "$RED"   "✗ $1"; }
print_info(){    print_message "$BLUE"  "ℹ $1"; }
print_warning(){ print_message "$YELLOW" "⚠ $1"; }

# ── Config ─────────────────────────────────────────────────────────────────────
# Always run relative to this script's directory (i.e., labs/server)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="venv"
HOST="0.0.0.0"
PORT="8000"

# ── Helpers ────────────────────────────────────────────────────────────────────
command_exists(){ command -v "$1" >/dev/null 2>&1; }
check_python_version(){
  if command_exists python3; then
    local version major minor
    version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
    major=${version%%.*}; minor=${version##*.}
    [[ "$major" -ge 3 && "$minor" -ge 8 ]] && return 0
  fi
  return 1
}
cleanup(){ if [ $? -ne 0 ]; then print_error "Setup failed. Check the error messages above."; fi; }
trap cleanup EXIT

# ── Header ─────────────────────────────────────────────────────────────────────
echo ""
print_info "╔════════════════════════════════════════════════════════╗"
print_info "║   Amazon SP-API Mock Server - Automated Setup         ║"
print_info "╚════════════════════════════════════════════════════════╝"
echo ""

# ── Prereqs ────────────────────────────────────────────────────────────────────
print_info "Checking prerequisites..."
if ! check_python_version; then
  print_error "Python 3.8 or higher is required"
  print_info "Please install Python 3.8+ from https://www.python.org/"
  exit 1
fi
print_success "Python 3.8+ found"

if ! command_exists pip3; then
  print_error "pip3 is not installed"
  exit 1
fi
print_success "pip3 found"
echo ""

# ── Step 1: venv ───────────────────────────────────────────────────────────────
print_info "Step 1/4: Creating virtual environment..."
if [ -d "$VENV_DIR" ]; then
  print_warning "Virtual environment already exists"
  read -p "Do you want to recreate it? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$VENV_DIR"
    python3 -m venv "$VENV_DIR"
    print_success "Virtual environment created"
  else
    print_info "Using existing virtual environment"
  fi
else
  python3 -m venv "$VENV_DIR"
  print_success "Virtual environment created"
fi

# ── Step 2: activate ───────────────────────────────────────────────────────────
echo ""
print_info "Step 2/4: Activating virtual environment..."
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate" || { print_error "Failed to activate virtual environment"; exit 1; }
print_success "Virtual environment activated"

print_info "Upgrading pip..."
pip install --quiet --upgrade pip
print_success "pip upgraded"

# ── Step 3: deps ───────────────────────────────────────────────────────────────
echo ""
print_info "Step 3/4: Installing dependencies..."
if [ ! -f "requirements.txt" ]; then
  print_error "requirements.txt not found"
  exit 1
fi
pip install --quiet -r requirements.txt || { print_error "Failed to install dependencies"; exit 1; }
print_success "Dependencies installed"

# ── Step 4: verify ────────────────────────────────────────────────────────────
echo ""
print_info "Step 4/4: Verifying setup..."
if [ ! -d "responses" ]; then
  print_warning "responses/ directory not found"
  print_info "Creating responses/ directory..."
  mkdir -p responses
  print_warning "Please ensure all required JSON response files are in the responses/ directory"
else
  print_success "responses/ directory found"
fi

if [ ! -f "main.py" ]; then
  print_error "main.py not found in current directory"
  exit 1
fi
print_success "main.py found"

# ── Info ───────────────────────────────────────────────────────────────────────
echo ""
print_success "════════════════════════════════════════════════════════"
print_success "Setup completed successfully!"
print_success "════════════════════════════════════════════════════════"
echo ""
print_info "Server Details:"
print_info "  • Local URL:        http://localhost:$PORT"
print_info "  • Network URL:      http://$HOST:$PORT"
print_info "  • Health Check:     http://localhost:$PORT/health"
echo ""
print_info "Starting server in 3 seconds..."
sleep 3

# ── Run ────────────────────────────────────────────────────────────────────────
echo ""
print_info "╔════════════════════════════════════════════════════════╗"
print_info "║   Server Starting...                                   ║"
print_info "║   Press CTRL+C to stop the server                      ║"
print_info "╚════════════════════════════════════════════════════════╝"
echo ""

uvicorn main:app --reload --host "$HOST" --port "$PORT" 2>&1 | while IFS= read -r line; do
  if [[ $line == *"Application startup complete"* ]]; then
    echo ""
    print_success "════════════════════════════════════════════════════════"
    print_success "Server is running!"
    print_success "════════════════════════════════════════════════════════"
    echo ""
    print_info "Test the server with:"
    print_info "  curl http://localhost:$PORT/health"
    echo ""
  fi
  echo "$line"
done
