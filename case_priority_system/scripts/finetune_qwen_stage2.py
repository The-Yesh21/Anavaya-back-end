"""
STAGE-2 fine-tune: legal-category reasoning.

Continues from the stage-1 adapter (`models/qwen2.5-3b-legal-lora`) and trains
on `data/constitutional_training_cases.csv`, where every case carries a
`plain_summary` that EXPLAINS why the case falls in its `case_category`
(citing matched keywords + primary constitutional articles).

Stage 1 taught the model the extraction JSON format; stage 2 teaches it to
reason about and defend the classification in plain language. Priority remains
with the deterministic Decision Tree — the model never decides priority.

Output: case_priority_system/models/qwen2.5-3b-legal-lora-v2

Usage:
    python finetune_qwen_stage2.py                # fresh run
    python finetune_qwen_stage2.py --resume       # resume from newest checkpoint in OUTPUT_DIR
"""
import argparse
import glob
import json
import os

import pandas as pd
import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, prepare_model_for_kbit_training, PeftModel
from trl import SFTTrainer, SFTConfig

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
STAGE1_ADAPTER = "case_priority_system/models/qwen2.5-3b-legal-lora"
OUTPUT_DIR = "case_priority_system/models/qwen2.5-3b-legal-lora-v2"
DATA = "case_priority_system/data/constitutional_training_cases.csv"
MAX_LENGTH = 2048

# Condensed training prompts (mirroring the production SYSTEM_PROMPT /
# USER_PROMPT_TEMPLATE, which now include the classification-reasoning
# instruction). Short sequences = fast training on a 4 GB GPU; the full
# production prompt is used at inference.
TRAIN_SYSTEM_PROMPT = (
    "You are the feature-extraction LLM for ANAVAYA, an AI case-priority system for "
    "Indian judicial authorities. You read legal case documents and extract structured "
    "features plus a plain-language summary. You never decide priority — a deterministic "
    "decision tree does that later. Your case_category choice must be defensible: end the "
    "plain_summary with one sentence explaining why the case falls in the chosen category, "
    "citing the concrete facts. Return ONLY one valid JSON object matching the requested "
    "schema — no prose, no markdown fences."
)

TRAIN_USER_PROMPT_TEMPLATE = """Extract case features from the legal text below.

LEGAL TEXT:
{text}

Return ONLY valid JSON with EXACTLY these fields and allowed values:
- main_parties: string, comma-separated names of all parties involved
- case_category: one of Excise/Tax, Customs/Import-Export, Company/Winding Up, Insolvency/Debt, Constitutional/Writ, Property/Land, Criminal/Violent, General Civil
- crime_type: one of Violent, Financial, Property, Non-Violent
- severity: one of Fatal, Major, Minor, No Injury
- vulnerability: one of High, Medium, Low
- influence: one of High, Low
- plain_summary: 3-4 sentence plain-language summary naming the parties, the dispute, and the relief sought, ENDING with one sentence explaining why the case belongs to the chosen case_category, citing the specific facts that support the classification.

JSON:
"""


def format_training_data(row):
    text = str(row["description"])[:2000]
    expected = {
        "main_parties": str(row.get("main_parties", "Unknown")),
        "case_category": str(row.get("case_category", "General Civil")),
        "crime_type": str(row.get("crime_type", "Non-Violent")),
        "severity": str(row.get("severity", "No Injury")),
        "vulnerability": str(row.get("vulnerability", "Low")),
        "influence": str(row.get("influence", "Low")),
        "plain_summary": str(row.get("plain_summary", "")).strip(),
    }
    expected_output = json.dumps(expected, indent=2)
    user_msg = TRAIN_USER_PROMPT_TEMPLATE.format(text=text)
    chat_prompt = (
        f"<|im_start|>system\n{TRAIN_SYSTEM_PROMPT}<|im_end|>\n"
        f"<|im_start|>user\n{user_msg}<|im_end|>\n"
        f"<|im_start|>assistant\n{expected_output}<|im_end|>"
    )
    return {"text": chat_prompt}


def find_latest_checkpoint(output_dir: str) -> str | None:
    """Return the path of the highest-numbered checkpoint-* dir in output_dir."""
    checkpoints = [
        p for p in glob.glob(os.path.join(output_dir, "checkpoint-*"))
        if os.path.isdir(p)
    ]
    if not checkpoints:
        return None

    def step_num(path: str) -> int:
        try:
            return int(os.path.basename(path).split("-")[-1])
        except ValueError:
            return -1

    return max(checkpoints, key=step_num)


def main():
    parser = argparse.ArgumentParser(description="Stage-2 LoRA fine-tune for ANAVAYA")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume training from the newest checkpoint-* in OUTPUT_DIR "
             "(continues global_step up to max_steps).",
    )
    args = parser.parse_args()

    resume_from = find_latest_checkpoint(OUTPUT_DIR) if args.resume else None
    if args.resume:
        if resume_from is None:
            print(f"No checkpoint found in {OUTPUT_DIR}; starting fresh.")
        else:
            print(f"Resuming from checkpoint: {resume_from}")

    print("Loading stage-2 dataset...")
    df = pd.read_csv(DATA).dropna(subset=["description"])
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    dataset = Dataset.from_pandas(df).map(format_training_data)
    print(f"Stage-2 examples: {len(dataset)}")

    print("Configuring 4-bit quantization (bf16 compute, single GPU)...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )

    print(f"Loading base model {MODEL_ID}...")
    tokenizer = AutoTokenizer.from_pretrained(STAGE1_ADAPTER, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token

    base = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.bfloat16,
        quantization_config=bnb_config,
        device_map={"": 0},
        trust_remote_code=True,
    )
    base = prepare_model_for_kbit_training(base)

    print(f"Loading stage-1 adapter from {STAGE1_ADAPTER}...")
    # is_trainable=True is required: from_pretrained defaults to inference mode
    # (all params frozen), and PeftModel.train() does not unfreeze adapters.
    model = PeftModel.from_pretrained(base, STAGE1_ADAPTER, is_trainable=True)
    model.print_trainable_parameters()

    print("Setting up Trainer (continuing from stage-1 adapter)...")
    training_args = SFTConfig(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=2,
        warmup_steps=15,
        max_steps=100,
        learning_rate=1e-4,  # lower LR: refine stage-1 behaviour, don't destroy it
        fp16=False,
        bf16=True,
        logging_steps=5,
        optim="adamw_8bit",
        save_strategy="steps",
        save_steps=25,
        save_total_limit=2,
        seed=42,
        max_length=MAX_LENGTH,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,  # already a PEFT model — no peft_config
        train_dataset=dataset,
        processing_class=tokenizer,
        args=training_args,
    )

    print("Starting stage-2 fine-tuning...")
    trainer.train(resume_from_checkpoint=resume_from)

    print(f"Saving final stage-2 adapter to {OUTPUT_DIR}...")
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("Stage-2 fine-tuning complete.")


if __name__ == "__main__":
    if not torch.cuda.is_available():
        print("CUDA GPU not available. This script requires a CUDA GPU.")
        exit(1)
    main()
