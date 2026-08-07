import os
import subprocess

# Model name can be overridden via the OLLAMA_MODEL environment variable.
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

def pull_model():
    """Pull the specified Ollama model if not already present."""
    try:
        subprocess.run(["ollama", "pull", OLLAMA_MODEL], check=True)
        print(f"Successfully pulled Ollama model {OLLAMA_MODEL}")
    except Exception as e:
        print(f"Failed to pull Ollama model {OLLAMA_MODEL}: {e}")

if __name__ == "__main__":
    pull_model()
