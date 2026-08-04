#!/usr/bin/env python3
"""Minimal MCP stdio server: ask CyberSecQwen-4B via local Ollama."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
MODEL = os.environ.get("CYBERSECQWEN_MODEL", "cybersecqwen-4b")
SERVER_NAME = "cybersecqwen-4b"


def _send(msg: dict) -> None:
    data = json.dumps(msg, ensure_ascii=False)
    sys.stdout.write(f"Content-Length: {len(data.encode('utf-8'))}\r\n\r\n{data}")
    sys.stdout.flush()


def _read() -> dict | None:
    headers: dict[str, str] = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        line = line.decode("utf-8")
        if line in ("\r\n", "\n", ""):
            break
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    length = int(headers.get("content-length", "0"))
    if length <= 0:
        return None
    body = sys.stdin.buffer.read(length).decode("utf-8")
    return json.loads(body)


def _ollama_chat(prompt: str, system: str | None = None) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.3},
    }
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        return f"Error reaching Ollama at {OLLAMA_HOST}: {exc}"
    return data.get("message", {}).get("content") or json.dumps(data)


TOOLS = [
    {
        "name": "ask_cybersecqwen",
        "description": (
            "Ask CyberSecQwen-4B (local Ollama) a defensive cybersecurity question: "
            "CWE/CVE mapping, CTI, secure coding, vulnerability triage. "
            "Does not provide exploit PoCs or offensive payloads."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Question or analysis request for CyberSecQwen-4B",
                },
                "system": {
                    "type": "string",
                    "description": "Optional extra system instruction",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "list_cybersecqwen_status",
        "description": "Check whether local Ollama and cybersecqwen-4b are available.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _handle(msg: dict) -> dict | None:
    mid = msg.get("id")
    method = msg.get("method")
    params = msg.get("params") or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": "1.0.0"},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        if name == "list_cybersecqwen_status":
            try:
                with urllib.request.urlopen(f"{OLLAMA_HOST}/api/tags", timeout=10) as resp:
                    tags = json.loads(resp.read().decode("utf-8"))
                names = [m.get("name") for m in tags.get("models", [])]
                ok = any(MODEL in (n or "") for n in names)
                text = json.dumps(
                    {"ollama_host": OLLAMA_HOST, "model": MODEL, "available": ok, "models": names},
                    indent=2,
                )
            except Exception as exc:  # noqa: BLE001
                text = f"Ollama unreachable at {OLLAMA_HOST}: {exc}"
        elif name == "ask_cybersecqwen":
            prompt = args.get("prompt") or ""
            if not prompt.strip():
                text = "Error: prompt is required"
            else:
                text = _ollama_chat(prompt, args.get("system"))
        else:
            text = f"Unknown tool: {name}"
        return {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {"content": [{"type": "text", "text": text}], "isError": False},
        }
    if method == "ping":
        return {"jsonrpc": "2.0", "id": mid, "result": {}}
    if mid is not None:
        return {
            "jsonrpc": "2.0",
            "id": mid,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }
    return None


def main() -> None:
    while True:
        msg = _read()
        if msg is None:
            break
        resp = _handle(msg)
        if resp is not None:
            _send(resp)


if __name__ == "__main__":
    main()
