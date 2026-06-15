#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XHS_VERSION="${XHS_VERSION:-v2026.06.12.1403-5c43e3d}"
XHS_ASSET="xiaohongshu-mcp-linux-amd64.tar.gz"
XHS_URL="https://github.com/xpzouying/xiaohongshu-mcp/releases/download/${XHS_VERSION}/${XHS_ASSET}"
XHS_DIR="${ROOT}/toolkit/xhs/xhs-mcp"

YES=false
DOCTOR=false
SKIP_NPM=false
SKIP_XHS=false
SKIP_SYSTEM_CHECK=false

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Install and diagnose dependencies for the travel-agent skills.

Options:
  -y, --yes              Run non-interactively where possible.
      --doctor           Only check current installation status.
      --skip-npm         Do not install npm CLIs.
      --skip-xhs         Do not download Xiaohongshu MCP binaries.
      --skip-system      Skip node/npm/chromium system checks.
  -h, --help             Show this help.

Environment:
  XHS_VERSION            xpzouying/xiaohongshu-mcp release tag.
  NPM                    npm executable to use. Default: npm.
  FLYAI_BIN              flyai executable used by toolkit/fz/flyai-env.
  MCPORTER               mcporter executable used by toolkit/xhs scripts.

Notes:
  - FlyAI CLI comes from npm package @fly-ai/flyai-cli.
  - mcporter CLI comes from npm package mcporter.
  - Xiaohongshu login is not performed by this installer.
  - toolkit/fz/.env is optional. Add FLYAI_API_KEY there if you have one.
EOF
}

log() { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok() { printf '\033[32mOK\033[0m %s\n' "$*"; }
warn() { printf '\033[33mWARN\033[0m %s\n' "$*"; }
fail() { printf '\033[31mFAIL\033[0m %s\n' "$*"; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

ask() {
  local prompt="$1"
  if "$YES"; then
    return 0
  fi
  local reply
  read -r -p "${prompt} [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yes) YES=true; shift ;;
      --doctor) DOCTOR=true; shift ;;
      --skip-npm) SKIP_NPM=true; shift ;;
      --skip-xhs) SKIP_XHS=true; shift ;;
      --skip-system) SKIP_SYSTEM_CHECK=true; shift ;;
      -h|--help) usage; exit 0 ;;
      *) fail "Unknown option: $1"; usage; exit 2 ;;
    esac
  done
}

check_system() {
  "$SKIP_SYSTEM_CHECK" && return 0

  log "Checking system tools"
  local missing=()
  for cmd in curl tar chmod grep sed ss ps; do
    if has_cmd "$cmd"; then ok "$cmd found"; else missing+=("$cmd"); fi
  done

  if has_cmd node; then ok "node found: $(command -v node)"; else warn "node not found"; fi
  if has_cmd "${NPM:-npm}"; then ok "npm found: $(command -v "${NPM:-npm}")"; else warn "npm not found"; fi

  if ((${#missing[@]})); then
    fail "Missing required tools: ${missing[*]}"
    return 1
  fi
}

install_npm_clis() {
  "$SKIP_NPM" && { warn "Skipping npm CLI install"; return 0; }

  local npm_cmd="${NPM:-npm}"
  if ! has_cmd "$npm_cmd"; then
    warn "npm is not installed. Install Node.js/npm first, then rerun ./install.sh"
    warn "Ubuntu/Debian example: sudo apt-get update && sudo apt-get install -y nodejs npm"
    return 0
  fi

  log "Checking npm CLIs"
  if has_cmd "${FLYAI_BIN:-flyai}"; then
    ok "flyai already found: $(command -v "${FLYAI_BIN:-flyai}")"
  elif ask "Install FlyAI CLI with npm i -g @fly-ai/flyai-cli?"; then
    "$npm_cmd" i -g @fly-ai/flyai-cli
    ok "flyai installed"
  else
    warn "FlyAI CLI not installed; live Fliggy flight/hotel/POI data will be unavailable"
  fi

  if has_cmd "${MCPORTER:-mcporter}"; then
    ok "mcporter already found: $(command -v "${MCPORTER:-mcporter}")"
  elif ask "Install mcporter CLI with npm i -g mcporter?"; then
    "$npm_cmd" i -g mcporter
    ok "mcporter installed"
  else
    warn "mcporter not installed; use direct HTTP MCP calls or web fallback for Xiaohongshu"
  fi
}

install_xhs_mcp() {
  "$SKIP_XHS" && { warn "Skipping Xiaohongshu MCP binary install"; return 0; }

  log "Installing Xiaohongshu MCP binary (${XHS_VERSION})"
  mkdir -p "$XHS_DIR"

  if [[ -x "${XHS_DIR}/xiaohongshu-mcp-linux-amd64" && -x "${XHS_DIR}/xiaohongshu-login-linux-amd64" ]]; then
    ok "Xiaohongshu MCP binaries already installed"
    return 0
  fi

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  curl -L -o "${tmp}/${XHS_ASSET}" "$XHS_URL"
  tar -xzf "${tmp}/${XHS_ASSET}" -C "$XHS_DIR"
  chmod +x "${XHS_DIR}/xiaohongshu-mcp-linux-amd64" "${XHS_DIR}/xiaohongshu-login-linux-amd64"
  ok "Installed Xiaohongshu MCP binaries under toolkit/xhs/xhs-mcp"
}

ensure_wrappers() {
  log "Preparing wrapper scripts and local config"
  chmod +x \
    "${ROOT}/toolkit/fz/flyai-env" \
    "${ROOT}/toolkit/fz/fz-status" \
    "${ROOT}/toolkit/xhs/xhs-mcp-start" \
    "${ROOT}/toolkit/xhs/xhs-mcp-stop" \
    "${ROOT}/toolkit/xhs/xhs-mcp-status" \
    "${ROOT}/toolkit/xhs/xhs-login-qr" \
    "${ROOT}/toolkit/xhs/xhs-login-watch"

  if [[ ! -f "${ROOT}/toolkit/fz/.env.example" ]]; then
    cat > "${ROOT}/toolkit/fz/.env.example" <<'EOF'
# Optional. FlyAI works without a key, but a key may improve quota/result quality.
# FLYAI_API_KEY=your-key
EOF
    ok "Created toolkit/fz/.env.example"
  fi

  if [[ ! -f "${ROOT}/toolkit/fz/.env" ]]; then
    warn "toolkit/fz/.env is missing; create it from .env.example if you have FLYAI_API_KEY"
  fi
}

doctor() {
  local failures=0
  log "Doctor check"

  for cmd in curl tar chmod grep sed ss ps; do
    if has_cmd "$cmd"; then ok "$cmd"; else fail "$cmd missing"; failures=$((failures + 1)); fi
  done

  if has_cmd node; then ok "node: $(command -v node)"; else warn "node missing"; fi
  if has_cmd "${NPM:-npm}"; then ok "npm: $(command -v "${NPM:-npm}")"; else warn "npm missing"; fi
  if has_cmd "${FLYAI_BIN:-flyai}"; then ok "flyai: $(command -v "${FLYAI_BIN:-flyai}")"; else warn "flyai missing"; fi
  if has_cmd "${MCPORTER:-mcporter}"; then ok "mcporter: $(command -v "${MCPORTER:-mcporter}")"; else warn "mcporter missing"; fi

  if [[ -x "${XHS_DIR}/xiaohongshu-mcp-linux-amd64" ]]; then
    ok "Xiaohongshu MCP binary installed"
  else
    warn "Xiaohongshu MCP binary missing"
  fi

  if ss -ltn 2>/dev/null | grep -q ':18060'; then
    ok "Xiaohongshu MCP service is listening on :18060"
  else
    warn "Xiaohongshu MCP service is not listening on :18060"
  fi

  if [[ -f "${ROOT}/toolkit/fz/.env" ]]; then
    ok "toolkit/fz/.env exists"
  else
    warn "toolkit/fz/.env missing (optional unless you need a FlyAI API key)"
  fi

  return "$failures"
}

main() {
  parse_args "$@"
  if "$DOCTOR"; then
    doctor
    return
  fi

  check_system
  install_npm_clis
  install_xhs_mcp
  ensure_wrappers

  printf '\n'
  ok "Install step complete"
  printf 'Next checks:\n'
  printf '  ./install.sh --doctor\n'
  printf '  ./toolkit/fz/fz-status\n'
  printf '  XHS_SKIP_LOGIN=1 ./toolkit/xhs/xhs-mcp-start\n'
}

main "$@"
