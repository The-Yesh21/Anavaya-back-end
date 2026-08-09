import json
import pandas as pd
import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig

# We'll use the base model corresponding to qwen2.5:3b
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
OUTPUT_DIR = "case_priority_system/models/qwen2.5-3b-legal-lora"

# Maximum token length of one training sequence. Kept at 2048 so the expected
# JSON output at the end of every sequence is never truncated away (see note
# below on why the production prompts are NOT used for training).
MAX_LENGTH = 2048

# ---------------------------------------------------------------------------
# TRAINING PROMPTS (condensed on purpose)
#
# The production prompts in langchain_summarizer.py (SYSTEM_PROMPT ~4.2k chars
# + USER_PROMPT_TEMPLATE ~2.2k chars) are great for inference but far too long
# for fine-tuning on a 4 GB GPU:
#   1. Sequences would be several thousand tokens long, making each training
#      step minutes long on an entry-level GPU.
#   2. SFT truncates from the right, so the expected JSON output — the very
#      thing the model must learn to produce — would be cut off entirely.
#
# So we fine-tune with a condensed version of the same instructions. The model
# learns the extraction format (fields, allowed values, JSON-only output); at
# inference the pipeline still sends the full production prompt and the model
# follows the same format.
# ---------------------------------------------------------------------------

TRAIN_SYSTEM_PROMPT = (
    "You are the feature-extraction LLM for ANAVAYA, an AI case-priority system for "
    "Indian judicial authorities. You read legal case documents (FIRs, complaints, "
    "pleadings, judgments) and extract structured features plus a plain-language "
    "summary. You never decide priority — a deterministic decision tree does that "
    "later. Return ONLY one valid JSON object matching the requested schema: no "
    "prose, no markdown fences, nothing before or after the JSON. Never invent "
    "label values."
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
- plain_summary: 3-4 sentence plain-language summary naming the parties, the dispute, key legal issues, and the relief sought

JSON:
"""


def format_training_data(row):
    """
    Format the training row into a prompt + completion pair for the LLM.
    The expected JSON output is appended as the assistant turn so the model
    learns to reproduce it exactly.
    """
    # Keep case text short so the whole sequence (system + user + JSON) fits
    # inside MAX_LENGTH tokens.
    text = str(row['description'])[:2000]

    # Build the expected JSON via json.dumps so values containing quotes or
    # special characters can never corrupt the output the model learns.
    expected = {
        "main_parties": str(row.get('main_parties', 'Unknown')),
        "case_category": str(row.get('case_category', 'General Civil')),
        "crime_type": str(row.get('crime_type', 'Non-Violent')),
        "severity": str(row.get('severity', 'No Injury')),
        "vulnerability": str(row.get('vulnerability', 'Low')),
        "influence": str(row.get('influence', 'Low')),
        # A realistic-but-generic summary derived from the row's labels (the
        # training CSVs have no summary column). Better than a literal
        # placeholder: the model learns to produce plausible plain summaries.
        "plain_summary": (
            f"A {row.get('case_category', 'General Civil')} case of a "
            f"{row.get('crime_type', 'Non-Violent')} nature with "
            f"{row.get('severity', 'No Injury')} severity involving "
            f"{row.get('main_parties', 'the parties')}."
        ),
    }
    expected_output = json.dumps(expected, indent=2)

    user_msg = TRAIN_USER_PROMPT_TEMPLATE.format(text=text)

    # Qwen chat template
    chat_prompt = (
        f"<|im_start|>system\n{TRAIN_SYSTEM_PROMPT}<|im_end|>\n"
        f"<|im_start|>user\n{user_msg}<|im_end|>\n"
        f"<|im_start|>assistant\n{expected_output}<|im_end|>"
    )

    return {"text": chat_prompt}


def main():
    print("Loading datasets...")
    df_real = pd.read_csv("case_priority_system/data/real_report_training_cases.csv")
    df_synth = pd.read_csv("case_priority_system/data/synthetic_cases.csv")

    df_combined = pd.concat([df_real, df_synth]).dropna(subset=['description'])
    df_combined = df_combined.sample(frac=1, random_state=42).reset_index(drop=True)  # Shuffle

    if len(df_combined) > 2000:
        print(f"Subsampling dataset from {len(df_combined)} to 2000 rows for faster training.")
        df_combined = df_combined.head(2000)

    dataset = Dataset.from_pandas(df_combined)
    dataset = dataset.map(format_training_data)

    print("Configuring 4-bit quantization (bf16 compute, single GPU)...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        # bf16 compute: Qwen2.5's native dtype. Training in bf16 needs no AMP
        # GradScaler (bf16 has fp32 range), which avoids the mixed fp16/bf16
        # unscale crash on consumer GPUs. RTX 2050 supports bf16.
        bnb_4bit_compute_dtype=torch.bfloat16,
    )

    print(f"Loading tokenizer and model {MODEL_ID}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        # Load the non-quantized parts (embeddings, lm_head, norms) in bf16,
        # matching the compute dtype and Qwen2.5's native dtype.
        torch_dtype=torch.bfloat16,
        quantization_config=bnb_config,
        # Explicit single-GPU map: guarantees NOTHING is offloaded to the CPU.
        # device_map="auto" on a 4 GB card can put layers on CPU, which made
        # training 5+ minutes per step.
        device_map={"": 0},
        trust_remote_code=True,
    )

    model = prepare_model_for_kbit_training(model)

    print("Applying LoRA configuration...")
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    print("Setting up Trainer...")
    training_args = SFTConfig(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=2,
        warmup_steps=20,
        max_steps=140,
        learning_rate=2e-4,
        fp16=False,
        bf16=True,
        logging_steps=5,
        optim="adamw_8bit",
        save_strategy="steps",
        save_steps=35,
        save_total_limit=2,
        seed=42,
        max_length=MAX_LENGTH,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=lora_config,
        processing_class=tokenizer,
        args=training_args,
    )

    print("Starting fine-tuning...")
    trainer.train()

    print(f"Saving final adapter to {OUTPUT_DIR}...")
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("Fine-tuning complete. To use in Ollama, you must merge this adapter "
          "with the base model and convert to GGUF using llama.cpp.")


if __name__ == "__main__":
    try:
        import peft
        import trl
        import bitsandbytes
    except ImportError:
        print("Please install required libraries: "
              "pip install torch transformers datasets peft trl bitsandbytes accelerate")
        exit(1)

    if not torch.cuda.is_available():
        print("CUDA GPU not available. This script requires a CUDA GPU "
              "(4-bit quantization + bf16 training). Install a CUDA build of "
              "torch, e.g.: pip install torch --index-url "
              "https://download.pytorch.org/whl/cu126")
        exit(1)

    main()
