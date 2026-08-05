"""
Quick connectivity test for the locally installed Ollama LLM.

Prints the model's reply to a trivial prompt. Make sure the Ollama server is
running (`ollama serve` or the Ollama desktop app) before running this.

Usage:
    python case_priority_system/scripts/test_ollama.py
"""

import os
import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")

payload = {
    "model": MODEL,
    "messages": [
        {"role": "user", "content": "Are you an LLM?"}
    ],
    "stream": False,
    "options": {
        "num_predict": 20,
        "temperature": 0,
    },
}

try:
    print(f"Connecting to {OLLAMA_URL} using model: {MODEL}...")
    response = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()

    # Print ONLY the AI's reply
    print("\n--- AI's Reply ---")
    print((data["message"]["content"] or "").strip())
    print("------------------")
except Exception as e:
    print(f"\nAPI Request Failed: {str(e)}")
    if 'response' in locals() and hasattr(response, 'text'):
        print(f"Server Response: {response.text}")
