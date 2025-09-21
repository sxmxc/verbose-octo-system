#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE=()
VAULT_TOKEN_VALUE="${VAULT_TOKEN:-}"
VAULT_TOKEN_SOURCE="environment"
VAULT_LISTEN_PORT="${VAULT_LISTEN_PORT:-8200}"
VAULT_KV_MOUNT="${VAULT_KV_MOUNT:-sre}"
VAULT_EXEC_ADDR="http://127.0.0.1:${VAULT_LISTEN_PORT}"
UNSEAL_KEY_HOST_PATH="$ROOT_DIR/config/vault/unseal.key"
DEFAULT_TOKEN_FILE="$ROOT_DIR/.vault-token"

info() {
  printf '==> %s\n' "$1"
}

warn() {
  printf '==> WARNING: %s\n' "$1" >&2
}

fatal() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fatal "Required command not found: $cmd"
  fi
}

load_env_file() {
  local env_file="$ROOT_DIR/.env"
  if [ -f "$env_file" ]; then
    info "Loading environment overrides from .env"
    set -a
    # shellcheck source=/dev/null
    source "$env_file"
    set +a
    VAULT_LISTEN_PORT="${VAULT_LISTEN_PORT:-8200}"
    VAULT_KV_MOUNT="${VAULT_KV_MOUNT:-sre}"
    VAULT_EXEC_ADDR="http://127.0.0.1:${VAULT_LISTEN_PORT}"
    if [ -n "${VAULT_TOKEN:-}" ]; then
      VAULT_TOKEN_VALUE="$VAULT_TOKEN"
      VAULT_TOKEN_SOURCE="environment"
    fi
  fi
}

configure_docker_compose() {
  require_command docker
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker-compose)
  else
    fatal "Docker Compose is required (docker compose plugin or docker-compose binary)."
  fi
}

resolve_host_path() {
  local path="$1"
  if [[ -z "$path" ]]; then
    return 1
  fi
  if [[ "$path" == ~* ]]; then
    path="${path/#\~/$HOME}"
  fi
  if [[ "$path" == /* ]]; then
    printf '%s\n' "$path"
  else
    path="${path#./}"
    printf '%s/%s\n' "$ROOT_DIR" "$path"
  fi
}

start_infrastructure() {
  info "Starting Docker services (db, redis, vault)"
  "${DOCKER_COMPOSE[@]}" up -d db redis vault
}

ensure_vault_data_permissions() {
  info "Ensuring Vault data directory ownership"
  "${DOCKER_COMPOSE[@]}" exec -T --user root vault sh -c 'chown -R vault:vault /vault/data'
}

wait_for_vault() {
  info "Waiting for Vault to respond"
  local attempts=0
  local status_json
  while (( attempts < 30 )); do
    if status_json="$(get_vault_status_json 2>/dev/null)"; then
      if [ -n "$status_json" ]; then
        return 0
      fi
    fi
    attempts=$((attempts + 1))
    sleep 2
  done
  fatal "Vault did not become ready within 60 seconds"
}

get_vault_status_json() {
  "${DOCKER_COMPOSE[@]}" exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" vault status -format=json 2>/dev/null || true
}

parse_status_field() {
  local status_json="$1"
  local field="$2"
  printf '%s' "$status_json" | python3 - "$field" <<'PY'
import json
import sys

data = json.load(sys.stdin)
field = sys.argv[1]
value = data.get(field)
if isinstance(value, bool):
    print('true' if value else 'false')
else:
    print(value)
PY
}

initialise_vault() {
  info "Initialising Vault"
  local init_json
  init_json="$(${DOCKER_COMPOSE[@]} exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" vault operator init -key-shares=1 -key-threshold=1 -format=json)"
  local unseal_key
  unseal_key="$(printf '%s' "$init_json" | python3 - <<'PY'
import json, sys
init_data = json.load(sys.stdin)
print(init_data['unseal_keys_b64'][0])
PY
)"
  local root_token
  root_token="$(printf '%s' "$init_json" | python3 - <<'PY'
import json, sys
init_data = json.load(sys.stdin)
print(init_data['root_token'])
PY
)"
  info "Vault initialised"
  persist_unseal_key "$unseal_key"
  persist_vault_token "$root_token"
  VAULT_TOKEN_VALUE="$root_token"
  VAULT_TOKEN_SOURCE="init"
}

persist_unseal_key() {
  local key="$1"
  mkdir -p "$(dirname "$UNSEAL_KEY_HOST_PATH")"
  if [ -f "$UNSEAL_KEY_HOST_PATH" ]; then
    local existing
    existing="$(<"$UNSEAL_KEY_HOST_PATH")"
    if [ "$existing" = "$key" ]; then
      info "Unseal key already stored at config/vault/unseal.key"
      return
    fi
    warn "Unseal key file already exists; leaving it untouched"
    return
  fi
  info "Writing unseal key to config/vault/unseal.key"
  (
    umask 077
    printf '%s\n' "$key" > "$UNSEAL_KEY_HOST_PATH"
  )
}

persist_vault_token() {
  local token="$1"
  local target_path
  if [ -n "${VAULT_TOKEN_FILE:-}" ]; then
    target_path="$(resolve_host_path "$VAULT_TOKEN_FILE")"
  else
    target_path="$DEFAULT_TOKEN_FILE"
  fi
  if [ -z "$target_path" ]; then
    warn "Unable to resolve vault token file path; skipping persistence"
    return
  fi
  mkdir -p "$(dirname "$target_path")"
  if [ -f "$target_path" ]; then
    info "Vault token file already exists at ${target_path#$ROOT_DIR/}; leaving it untouched"
    return
  fi
  info "Writing root token to ${target_path#$ROOT_DIR/}"
  (
    umask 077
    printf '%s\n' "$token" > "$target_path"
  )
}

load_existing_vault_token() {
  if [ -n "$VAULT_TOKEN_VALUE" ]; then
    return
  fi
  local candidate_paths=()
  if [ -n "${VAULT_TOKEN_FILE:-}" ]; then
    candidate_paths+=("$(resolve_host_path "$VAULT_TOKEN_FILE")")
  fi
  candidate_paths+=("$DEFAULT_TOKEN_FILE")
  local path
  for path in "${candidate_paths[@]}"; do
    if [ -f "$path" ]; then
      VAULT_TOKEN_VALUE="$(<"$path")"
      VAULT_TOKEN_SOURCE="file"
      info "Loaded Vault token from ${path#$ROOT_DIR/}"
      return
    fi
  done
  warn "Vault token not found; set VAULT_TOKEN or VAULT_TOKEN_FILE to manage secrets automatically"
}

read_unseal_key() {
  if [ -f "$UNSEAL_KEY_HOST_PATH" ]; then
    cat "$UNSEAL_KEY_HOST_PATH"
  fi
}

unseal_vault_if_needed() {
  local status_json="$1"
  local sealed
  sealed="$(parse_status_field "$status_json" sealed)"
  if [ "$sealed" != "true" ]; then
    info "Vault is already unsealed"
    return
  fi
  local key
  key="$(read_unseal_key || true)"
  if [ -z "$key" ]; then
    fatal "Vault is sealed and no unseal key found at config/vault/unseal.key"
  fi
  info "Unsealing Vault"
  "${DOCKER_COMPOSE[@]}" exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" vault operator unseal "$key" >/dev/null
}

ensure_kv_mount() {
  local mount="$VAULT_KV_MOUNT"
  info "Ensuring KV secrets engine mounted at ${mount}/"
  local secrets_json
  secrets_json="$(${DOCKER_COMPOSE[@]} exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" VAULT_TOKEN="$VAULT_TOKEN_VALUE" vault secrets list -format=json)"
  local exists
  exists="$(printf '%s' "$secrets_json" | python3 - "$mount" <<'PY'
import json, sys
mount = sys.argv[1]
data = json.load(sys.stdin)
print('true' if f"{mount}/" in data else 'false')
PY
)"
  if [ "$exists" = "true" ]; then
    info "KV engine already present"
  else
    info "Enabling kv-v2 engine at ${mount}/"
    "${DOCKER_COMPOSE[@]}" exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" VAULT_TOKEN="$VAULT_TOKEN_VALUE" vault secrets enable -path="$mount" kv-v2 >/dev/null
  fi
}

vault_secret_exists() {
  local path="$1"
  if "${DOCKER_COMPOSE[@]}" exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" VAULT_TOKEN="$VAULT_TOKEN_VALUE" vault kv get -format=json "$path" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

seed_vault_secret() {
  local path="$1"
  local field="$2"
  local value="$3"
  if vault_secret_exists "$path"; then
    info "Vault secret ${path} already exists; skipping"
    return
  fi
  info "Seeding Vault secret at ${path}"
  "${DOCKER_COMPOSE[@]}" exec -T vault env VAULT_ADDR="$VAULT_EXEC_ADDR" VAULT_TOKEN="$VAULT_TOKEN_VALUE" vault kv put "$path" "$field=$value" >/dev/null
}

bootstrap_vault() {
  wait_for_vault
  local status_json
  status_json="$(get_vault_status_json)"
  if [ -z "$status_json" ]; then
    fatal "Unable to read Vault status"
  fi
  local initialised
  initialised="$(parse_status_field "$status_json" initialized)"
  if [ "$initialised" != "true" ]; then
    initialise_vault
    status_json="$(get_vault_status_json)"
  fi
  unseal_vault_if_needed "$status_json"
  load_existing_vault_token
  if [ -z "$VAULT_TOKEN_VALUE" ]; then
    warn "Skipping KV bootstrap; Vault token unavailable"
    return
  fi
  ensure_kv_mount
  seed_vault_secret "$VAULT_KV_MOUNT/auth/oidc" client_secret "replace-me"
  seed_vault_secret "$VAULT_KV_MOUNT/auth/ldap" bind_password "replace-me"
}

main() {
  require_command python3
  configure_docker_compose
  load_env_file
  start_infrastructure
  ensure_vault_data_permissions
  bootstrap_vault
  info "Bootstrap complete"
}

main "$@"
