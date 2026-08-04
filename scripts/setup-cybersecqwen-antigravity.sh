#!/usr/bin/env bash
# One-shot: install Ollama + CyberSecQwen-4B and wire Antigravity local provider.
set -euo pipefail

MODEL_SRC="hf.co/ree2raz/CyberSecQwen-4B-GGUF:Q4_K_M"
MODEL_NAME="cybersecqwen-4b"
OLLAMA_HOST_BIND="${OLLAMA_HOST:-127.0.0.1:11434}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SETUP_DIR="${HOME}/.antigravity-cybersecqwen"

echo "==> CyberSecQwen-4B × Antigravity setup"

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installing Ollama"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew install ollama
    else
      echo "Install Ollama from https://ollama.com then re-run this script." >&2
      exit 1
    fi
  else
    if ! command -v zstd >/dev/null 2>&1; then
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zstd
      fi
    fi
    curl -fsSL https://ollama.com/install.sh | sh
  fi
fi

mkdir -p "${SETUP_DIR}" "${HOME}/.config/antigravity" "${HOME}/.gemini/antigravity-cli"

# Keep Ollama alive; bind localhost by default (override with OLLAMA_HOST=0.0.0.0:11434)
export OLLAMA_HOST="${OLLAMA_HOST_BIND}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-3h}"

if ! curl -sf "http://${OLLAMA_HOST_BIND}/api/tags" >/dev/null 2>&1; then
  echo "==> Starting ollama serve on ${OLLAMA_HOST_BIND}"
  nohup ollama serve >"${SETUP_DIR}/ollama.log" 2>&1 &
  echo $! >"${SETUP_DIR}/ollama.pid"
  for _ in $(seq 1 30); do
    curl -sf "http://${OLLAMA_HOST_BIND}/api/tags" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

if ! curl -sf "http://${OLLAMA_HOST_BIND}/api/tags" >/dev/null 2>&1; then
  echo "Ollama did not become ready. Check ${SETUP_DIR}/ollama.log" >&2
  exit 1
fi

echo "==> Pulling ${MODEL_SRC}"
ollama pull "${MODEL_SRC}"

cat >"${SETUP_DIR}/Modelfile" <<EOF
FROM ${MODEL_SRC}

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 8192
PARAMETER num_predict 2048

SYSTEM """You are CyberSecQwen, a defensive cybersecurity specialist assistant running locally inside Google Antigravity.

Priorities:
- Help with secure coding, CWE/CVE analysis, threat intelligence, vulnerability triage, and defensive hardening.
- Prefer concrete, actionable guidance over vague advice.
- Never provide exploit PoCs, malware, or offensive attack payloads. Stay on defensive analysis and remediation.
- When editing code, keep changes minimal and explain security impact briefly.
- If unsure, say so and suggest how to verify (tests, references, CWE IDs).
"""
EOF

echo "==> Creating local model tag ${MODEL_NAME}"
ollama create "${MODEL_NAME}" -f "${SETUP_DIR}/Modelfile"

# User-level Antigravity provider config (community + IDE variants)
cat >"${HOME}/.config/antigravity/config.json" <<EOF
{
  "defaultProvider": "cybersecqwen-local",
  "providers": {
    "cybersecqwen-local": {
      "type": "openai-compatible",
      "baseURL": "http://localhost:11434/v1",
      "apiKey": "ollama",
      "models": {
        "default": "${MODEL_NAME}",
        "fast": "${MODEL_NAME}",
        "deep": "${MODEL_NAME}"
      },
      "requestTimeoutMs": 300000,
      "streamReadTimeoutMs": 120000
    }
  },
  "llm_providers": [
    {
      "name": "cybersecqwen-local",
      "type": "openai_compatible",
      "base_url": "http://localhost:11434/v1",
      "api_key": "ollama",
      "default_model": "${MODEL_NAME}",
      "requestTimeoutMs": 300000,
      "streamReadTimeoutMs": 120000
    }
  ],
  "agents": {
    "default": {
      "provider": "cybersecqwen-local",
      "model": "default",
      "temperature": 0.3,
      "maxTokens": 2048
    }
  }
}
EOF

# macOS Antigravity IDE settings merge helper (creates/updates provider block)
MAC_SETTINGS="${HOME}/Library/Application Support/Antigravity/settings.json"
if [[ "$(uname -s)" == "Darwin" ]]; then
  mkdir -p "$(dirname "${MAC_SETTINGS}")"
  if [[ ! -f "${MAC_SETTINGS}" ]]; then
    cat >"${MAC_SETTINGS}" <<EOF
{
  "llm.providers": [
    {
      "name": "cybersecqwen-local",
      "baseURL": "http://localhost:11434/v1",
      "apiKey": "ollama",
      "model": "${MODEL_NAME}",
      "requestTimeoutMs": 300000,
      "streamReadTimeoutMs": 120000
    }
  ]
}
EOF
  else
    echo "==> Existing ${MAC_SETTINGS} found — left untouched. Add provider manually if needed."
  fi
fi

# Ensure project config exists when run from this repo
if [[ -d "${REPO_ROOT}/.antigravity" ]]; then
  cp "${HOME}/.config/antigravity/config.json" "${REPO_ROOT}/.antigravity/config.json"
fi

echo "==> Smoke-testing OpenAI-compatible endpoint"
curl -sf "http://${OLLAMA_HOST_BIND}/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ollama' \
  -d "{\"model\":\"${MODEL_NAME}\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK\"}],\"max_tokens\":8,\"temperature\":0}" \
  >/dev/null

echo
echo "Done."
echo "  Model:     ${MODEL_NAME}"
echo "  Endpoint:  http://localhost:11434/v1"
echo "  API key:   ollama"
echo
echo "In Antigravity UI (if config files are not auto-picked):"
echo "  Settings → LLM / Custom Provider"
echo "  Base URL: http://localhost:11434/v1"
echo "  API Key:  ollama"
echo "  Model:    ${MODEL_NAME}"
echo
echo "Keep Ollama running: ollama serve"
ollama list | grep -E "NAME|${MODEL_NAME}|CyberSecQwen" || ollama list
