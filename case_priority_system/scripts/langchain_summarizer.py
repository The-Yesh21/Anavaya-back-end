"""
Ollama-powered legal case summarizer and feature extractor.

Calls a locally installed Ollama model (default: deepseek-r1:8b) to produce
structured case features and a high-quality legal summary in a single call,
eliminating JSON parsing issues. No cloud API keys required — everything
runs on your machine.
"""

import os
import re
import json
import logging
from typing import Optional, Literal

from pydantic import BaseModel, Field

import requests

logger = logging.getLogger(__name__)

# ---------- Ollama configuration (override via env vars) ----------

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")

# ---------- Pydantic model for structured output ----------

class CaseFeatures(BaseModel):
    """Schema for structured case feature extraction from legal documents."""
    main_parties: str = Field(
        description="Comma-separated names of all people, companies, government bodies, or courts involved in the case"
    )
    case_category: Literal[
        "Excise/Tax",
        "Customs/Import-Export",
        "Company/Winding Up",
        "Insolvency/Debt",
        "Constitutional/Writ",
        "Property/Land",
        "Criminal/Violent",
        "General Civil",
    ] = Field(description="The specific legal domain the case falls under")
    crime_type: Literal["Violent", "Financial", "Property", "Non-Violent"] = Field(
        description="Broad category of the case type as per the model"
    )
    severity: Literal["Fatal", "Major", "Minor", "No Injury"] = Field(
        description="Level of physical injury or harm detected"
    )
    vulnerability: Literal["High", "Medium", "Low"] = Field(
        description="Vulnerability level of the affected party"
    )
    influence: Literal["High", "Low"] = Field(
        description="Level of power/influence of the accused or opposing party"
    )
    plain_summary: str = Field(
        description=(
            "A clear, concise 3-4 sentence plain-language summary of the case. "
            "Name the main parties, explain what the dispute is about, mention "
            "any key legal issues or constitutional questions, and state the "
            "relief sought. Use simple language a non-lawyer could understand."
        )
    )


# ---------- Prompts (shared with the direct-API fallback) ----------

SYSTEM_PROMPT = (
    "You are an expert constitutional legal analyst for a court case triage system. "
    "You apply the Constitution of India as your primary analytical framework. "
    "Your task is to analyze legal documents and extract structured information, "
    "identifying which constitutional rights are engaged. "
    "Always respond with valid, complete JSON matching the requested schema exactly. "
    "Do not include any text outside the JSON.\n\n"
    "--- INDIAN CONSTITUTIONAL CONTEXT ---\n"
    "Key constitutional provisions relevant to case analysis:\n\n"
    "Article 14: Equality before law — The State shall not deny equality before the "
    "law or equal protection of laws. Relevant for power imbalance cases, "
    "discrimination claims, and procedural fairness.\n\n"
    "Article 15: Prohibition of discrimination on grounds of religion, race, caste, "
    "sex, or place of birth. Special provisions for women, children, SC/ST, and "
    "backward classes.\n\n"
    "Article 19(1)(g): Right to practice any profession or carry on any occupation, "
    "trade, or business. Relevant for commercial, tax, and licensing disputes.\n\n"
    "Article 21: Protection of life and personal liberty — No person shall be "
    "deprived of life or personal liberty except according to procedure established "
    "by law. This is the MOST FUNDAMENTAL right. Includes right to live with dignity, "
    "right to health, right to a speedy trial, and right to safety. Engaged in ALL "
    "violent/criminal cases, fatal/major injury cases, and illegal detention cases.\n\n"
    "Articles 23 & 24: Prohibition of human trafficking, forced labour, and child "
    "labour in hazardous industries. Critical for exploitation cases.\n\n"
    "Article 32: Right to move the Supreme Court for enforcement of fundamental "
    "rights (constitutional remedies).\n\n"
    "Article 226: Power of High Courts to issue writs for enforcement of "
    "fundamental rights and for any other purpose.\n\n"
    "Article 265: No tax shall be levied or collected except by authority of law. "
    "Relevant for all tax, excise, and customs cases.\n\n"
    "Article 300A: No person shall be deprived of property save by authority of law. "
    "Relevant for property, land, insolvency, and company winding-up cases.\n\n"
    "Doctrine of Parens Patriae: The State has a duty to protect those who cannot "
    "protect themselves (minors, disabled, elderly, vulnerable victims).\n\n"
    "Principle of Natural Justice: Audi alteram partem (right to be heard) — no "
    "one shall be condemned without a fair hearing.\n\n"
    "--- END OF CONSTITUTIONAL CONTEXT ---"
)

USER_PROMPT_TEMPLATE = """Analyze the following legal case text and extract case features.

LEGAL TEXT:
{text}

RULES FOR EACH FIELD:
- main_parties: Comma-separated names of parties involved.
- case_category: Choose ONE:
  * Excise/Tax — for excise duty, GST, income tax, sales tax, customs duty, cess, refund, assessment
  * Customs/Import-Export — for DRI, customs seizure, import/export licence, smuggling, bill of entry, FEMA
  * Company/Winding Up — for Companies Act, NCLT, oppression, mismanagement, winding up, liquidation
  * Insolvency/Debt — for IBC, bankruptcy, DRT, SARFAESI, NPA, debt recovery, creditor petition
  * Constitutional/Writ — for Article 226/227/32, writ petition, fundamental rights, habeas corpus, PIL
  * Property/Land — for eviction, tenancy, land acquisition, ownership, title, possession, mortgage
  * Criminal/Violent — for murder, rape, assault, kidnapping, dacoity, domestic violence, IPC offenses
  * General Civil — for contracts, consumer complaints, arbitration, family law, succession, civil suits
- crime_type: Violent (for physical harm/criminal violence) | Financial (for debt/insolvency/finance) |
  Property (for land/real estate) | Non-Violent (for all other civil, tax, company, regulatory matters)
- severity: Fatal (death) | Major (serious injury, hospitalization, permanent disability) |
  Minor (minor injury) | No Injury (no physical harm)
- vulnerability: High (minors, elderly, disabled, poor, SC/ST, women in DV cases, workers, tenants) |
  Medium (some disadvantage) | Low (no vulnerability factors)
- influence: High (government, large company, public authority, regulatory body, politician) | Low (individual)
- plain_summary: Write a 3-4 sentence clear plain-language summary naming the parties, the dispute,
  any constitutional/legal questions, and what relief is sought. Where relevant, mention which
  constitutional articles (e.g., Article 21 for life/liberty, Article 14 for equality) are engaged.

Return ONLY valid JSON matching this schema:
{{
  "main_parties": "...",
  "case_category": "...",
  "crime_type": "...",
  "severity": "...",
  "vulnerability": "...",
  "influence": "...",
  "plain_summary": "..."
}}
"""


# ---------- JSON repair helpers ----------

def _parse_json_content(content: str) -> dict:
    """Extracts and repairs the JSON object embedded in the LLM response."""
    json_match = re.search(r"\{.*\}", content, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON found in LLM response.")

    json_text = json_match.group()

    # Handle duplicate keys (reasoning models sometimes duplicate a key)
    seen = set()
    lines = json_text.split("\n")
    unique_lines = []
    for line in lines:
        key_m = re.match(r'\s*("[^"]+")\s*:', line)
        if key_m and key_m.group(1) in seen:
            continue
        if key_m:
            seen.add(key_m.group(1))
        unique_lines.append(line)

    return json.loads("\n".join(unique_lines))


# ---------- Ollama extraction function ----------

def extract_with_ollama(
    text: str,
    model_name: Optional[str] = None,
    ollama_url: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: int = 4096,
    timeout: int = 300,
) -> Optional[dict]:
    """
    Extract structured case features and a legal summary using a local Ollama model.

    Args:
        text: The full text extracted from the PDF/case document.
        model_name: Ollama model ID (default: OLLAMA_MODEL / deepseek-r1:8b).
        ollama_url: Ollama server URL (default: OLLAMA_URL / http://localhost:11434).
        temperature: LLM temperature (0 = deterministic).
        max_tokens: Maximum tokens for the response. deepseek-r1 is a reasoning
            model, so keep this generous — chain-of-thought consumes tokens
            before the final JSON answer is produced.
        timeout: Request timeout in seconds (local 8B models can be slow).

    Returns:
        dict with keys: main_parties, case_category, crime_type, severity,
        vulnerability, influence, plain_summary. Returns None if extraction fails.
    """
    url = (ollama_url or OLLAMA_URL).rstrip("/")
    model = model_name or OLLAMA_MODEL

    if requests is None:
        logger.error("requests package is not installed.")
        return None

    # Truncate text to keep prompt sizes reasonable for a local model
    max_chars = 12000
    truncated = text[:max_chars] if len(text) > max_chars else text

    user_prompt = USER_PROMPT_TEMPLATE.format(text=truncated)

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        # DeepSeek-R1 is a reasoning model. 'think': False asks Ollama to skip
        # the chain-of-thought block when the model supports it, which speeds
        # up extraction. It is ignored gracefully if unsupported.
        "think": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        response = requests.post(f"{url}/api/chat", json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        content = (data.get("message") or {}).get("content", "").strip()

        if not content:
            logger.error("Ollama returned empty content. Is the server running?")
            return None

        parsed = _parse_json_content(content)
        logger.info("Ollama extraction succeeded (JSON parsed).")

        # Validate against the schema when every field is present
        try:
            features = CaseFeatures(**parsed)
            return features.model_dump()
        except Exception as e:
            logger.warning(f"Ollama output failed schema validation ({e}); returning raw dict.")
            return parsed

    except Exception as e:
        logger.error(f"Ollama extraction failed: {e}")
        return None


# Backward-compatible alias (the module was previously LangChain/NVIDIA-based)
extract_with_langchain = extract_with_ollama


# ---------- Standalone test ----------
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    sample_text = (
        "This is a case regarding the seizure of imported raw silk bales by the "
        "Directorate of Revenue Intelligence. The petitioner, Pooja Exporters, "
        "had imported 51 bales of mulberry raw silk under an advance licence issued "
        "by the DGFT. The DRI officials seized the goods alleging misdeclaration of "
        "value and violation of the Foreign Trade Policy. The petitioner claims the "
        "valuation was done correctly and seeks release of the seized goods and "
        "compensation for losses."
    )

    result = extract_with_ollama(sample_text)
    if result:
        import json as j
        print("=== EXTRACTION RESULT ===")
        print(j.dumps(result, indent=2))
        print("\n=== SUMMARY ===")
        print(result.get("plain_summary", "N/A"))
    else:
        print("Extraction failed.")
