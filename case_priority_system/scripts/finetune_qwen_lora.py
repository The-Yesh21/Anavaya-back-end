import os
import pandas as pd
import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# We'll use the base model corresponding to qwen2.5:3b
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
OUTPUT_DIR = "case_priority_system/models/qwen2.5-3b-legal-lora"

# Import our exact prompts so the fine-tuned model matches the pipeline exactly
try:
    from case_priority_system.scripts.langchain_summarizer import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
except ImportError:
    from scripts.langchain_summarizer import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

def format_training_data(row):
    """
    Format the training row into a prompt + completion pair for the LLM.
    We inject the system prompt, user prompt, and the expected JSON output.
    """
    text = str(row['description'])
    
    # Expected output JSON matching what the pipeline expects
    expected_output = f"""{{
  "main_parties": "{row.get('main_parties', 'Unknown')}",
  "case_category": "{row.get('case_category', 'General Civil')}",
  "crime_type": "{row.get('crime_type', 'Non-Violent')}",
  "severity": "{row.get('severity', 'No Injury')}",
  "vulnerability": "{row.get('vulnerability', 'Low')}",
  "influence": "{row.get('influence', 'Low')}",
  "plain_summary": "Extracted from training data."
}}"""

    user_msg = USER_PROMPT_TEMPLATE.format(text=text[:12000])
    
    # Qwen chat template approximation
    chat_prompt = f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n<|im_start|>user\n{user_msg}<|im_end|>\n<|im_start|>assistant\n{expected_output}<|im_end|>"
    
    return {"text": chat_prompt}

def main():
    print("Loading datasets...")
    # Load synthetic and real cases
    df_real = pd.read_csv("case_priority_system/data/real_report_training_cases.csv")
    df_synth = pd.read_csv("case_priority_system/data/synthetic_cases.csv")
    
    # Combine and drop NaNs in description
    df_combined = pd.concat([df_real, df_synth]).dropna(subset=['description'])
    df_combined = df_combined.sample(frac=1).reset_index(drop=True) # Shuffle
    
    # Take a subset if the dataset is too large for quick fine-tuning
    if len(df_combined) > 2000:
        print(f"Subsampling dataset from {len(df_combined)} to 2000 rows for faster training.")
        df_combined = df_combined.head(2000)

    dataset = Dataset.from_pandas(df_combined)
    dataset = dataset.map(format_training_data)

    print("Configuring 4-bit quantization (requires GPU)...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    )

    print(f"Loading tokenizer and model {MODEL_ID}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True
    )
    
    model = prepare_model_for_kbit_training(model)
    
    print("Applying LoRA configuration...")
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )
    model = get_peft_model(model, lora_config)

    print("Setting up Trainer...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        warmup_steps=100,
        max_steps=500, # Set to higher if you want a full epoch
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=10,
        optim="adamw_8bit",
        save_strategy="steps",
        save_steps=100,
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=lora_config,
        dataset_text_field="text",
        max_seq_length=2048, # Truncate to fit in 16GB RAM GPU
        tokenizer=tokenizer,
        args=training_args,
    )

    print("Starting fine-tuning...")
    trainer.train()
    
    print(f"Saving final adapter to {OUTPUT_DIR}...")
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("Fine-tuning complete. To use in Ollama, you must merge this adapter with the base model and convert to GGUF using llama.cpp.")

if __name__ == "__main__":
    # Ensure dependencies are installed
    try:
        import peft
        import trl
        import bitsandbytes
    except ImportError:
        print("Please install required libraries: pip install torch transformers datasets peft trl bitsandbytes accelerate")
        exit(1)
        
    main()
