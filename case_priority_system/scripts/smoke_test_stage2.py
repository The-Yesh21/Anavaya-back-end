"""Smoke test for the final stage-2 LoRA adapter.

Loads Qwen2.5-3B-Instruct + the LoRA adapter from
case_priority_system/models/qwen2.5-3b-legal-lora-v2 and runs a short
generation to prove the adapter is intact and usable for inference.
"""
import sys

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER_DIR = "case_priority_system/models/qwen2.5-3b-legal-lora-v2"

print(f"torch: {torch.__version__} | cuda: {torch.cuda.is_available()}")

tok = AutoTokenizer.from_pretrained(ADAPTER_DIR, trust_remote_code=True)
print(f"tokenizer OK: {type(tok).__name__}")

model = AutoModelForCausalLM.from_pretrained(
    BASE, torch_dtype=torch.float16, device_map="cpu", trust_remote_code=True
)
model = PeftModel.from_pretrained(model, ADAPTER_DIR)
model.eval()
print(f"PEFT adapter loaded OK | active adapters: {model.active_adapters}")

prompt = '{"case_summary": "Seizure of imported goods under Customs Act", "case_category":'
inp = tok(prompt, return_tensors="pt")
with torch.no_grad():
    out = model.generate(**inp, max_new_tokens=16, do_sample=False)
generated = tok.decode(out[0][inp["input_ids"].shape[1]:], skip_special_tokens=True)
print(f"GENERATED: {generated}")
print("=== SMOKE TEST PASSED ===")
