import os
import requests

# Load the API key from environment variables or use the default key
API_KEY = os.getenv("NVIDIA_API_KEY", "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")
url = "https://integrate.api.nvidia.com/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "google/gemma-4-31b-it",
    "messages": [
        {"role": "user", "content": "Are you an LLM?"}
    ],
    "max_tokens": 20,
    "temperature": 0
}

try:
    print(f"Connecting to {url} using API key starting with: {API_KEY[:8]}...")
    response = requests.post(url, headers=headers, json=payload, timeout=20)
    response.raise_for_status()
    data = response.json()
    
    # Print ONLY the AI's reply
    print("\n--- AI's Reply ---")
    print(data["choices"][0]["message"]["content"].strip())
    print("------------------")
except Exception as e:
    print(f"\nAPI Request Failed: {str(e)}")
    if 'response' in locals() and hasattr(response, 'text'):
        print(f"Server Response: {response.text}")
