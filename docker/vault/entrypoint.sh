#!/bin/sh
set -eu

VAULT_SERVER_CONFIG_PATH=${VAULT_SERVER_CONFIG_PATH:-/vault/config/local.hcl}
VAULT_CONFIG_PATH=${VAULT_SERVER_CONFIG_PATH}
VAULT_ADDR_INTERNAL=${VAULT_ADDR_INTERNAL:-http://127.0.0.1:${VAULT_LISTEN_PORT:-8200}}
VAULT_BIN=${VAULT_BIN:-vault}
UNSEAL_KEY=${VAULT_UNSEAL_KEY:-}
UNSEAL_KEY_FILE=${VAULT_UNSEAL_KEY_FILE:-}

# Prepare configuration file if the mounted path is absent
if [ ! -f "${VAULT_CONFIG_PATH}" ]; then
  if [ -n "${VAULT_LOCAL_CONFIG:-}" ]; then
    printf '%s\n' "${VAULT_LOCAL_CONFIG}" > /tmp/vault-local-config.json
    VAULT_CONFIG_PATH=/tmp/vault-local-config.json
  else
    echo "[vault-entrypoint] No Vault configuration found at ${VAULT_CONFIG_PATH} and VAULT_LOCAL_CONFIG is empty." >&2
    exit 1
  fi
fi

# Launch Vault server in the background
${VAULT_BIN} server -config="${VAULT_CONFIG_PATH}" &
VAULT_PID=$!

cleanup() {
  kill "${VAULT_PID}" 2>/dev/null || true
  wait "${VAULT_PID}" 2>/dev/null || true
}
trap cleanup INT TERM

export VAULT_ADDR="${VAULT_ADDR_INTERNAL}"

# Wait for Vault to accept connections
attempt=0
status_json=""
while true; do
  status_json=$(${VAULT_BIN} status -format=json 2>/tmp/vault-status.err || true)
  if echo "${status_json}" | grep -q '"initialized"'; then
    break
  fi
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge 60 ]; then
    echo "[vault-entrypoint] Vault failed to start within timeout" >&2
    cat /tmp/vault-status.err >&2 || true
    cleanup
    exit 1
  fi
  sleep 1
done

initialized=$(echo "${status_json}" | sed -n 's/.*"initialized"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' | head -n1)
sealed=$(echo "${status_json}" | sed -n 's/.*"sealed"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' | head -n1)
initialized=${initialized:-false}
sealed=${sealed:-true}

if [ "${initialized}" != "true" ]; then
  echo "[vault-entrypoint] Vault is not initialised. Complete initialisation manually before relying on auto-unseal." >&2
  wait "${VAULT_PID}"
fi

if [ "${sealed}" = "true" ]; then
  key="${UNSEAL_KEY}"
  if [ -z "${key}" ] && [ -n "${UNSEAL_KEY_FILE}" ] && [ -f "${UNSEAL_KEY_FILE}" ]; then
    key=$(cat "${UNSEAL_KEY_FILE}")
  fi
  if [ -z "${key}" ] && [ -n "${UNSEAL_KEY_FILE}" ]; then
    echo "[vault-entrypoint] Unseal key file not found: ${UNSEAL_KEY_FILE}" >&2
  fi
  key=$(printf '%s' "${key}" | tr -d '\r\n')
  if [ -z "${key}" ]; then
    echo "[vault-entrypoint] Vault is sealed and no unseal key provided (set VAULT_UNSEAL_KEY or VAULT_UNSEAL_KEY_FILE)." >&2
    wait "${VAULT_PID}"
  fi
  echo "[vault-entrypoint] Auto-unsealing Vault (source=${UNSEAL_KEY:+env}${UNSEAL_KEY:+,}${UNSEAL_KEY_FILE:+file:${UNSEAL_KEY_FILE}})..."
  ${VAULT_BIN} operator unseal "${key}"
fi

wait "${VAULT_PID}"
