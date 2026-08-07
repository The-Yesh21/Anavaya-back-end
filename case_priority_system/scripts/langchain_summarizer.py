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
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

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
#
# The system prompt below is mirrored in PROJECT_CONTEXT.md (the human-readable
# source of truth). If you change the project framing here, update that doc too.

SYSTEM_PROMPT = (
    "You are the FEATURE-EXTRACTION LLM for ANAVAYA, an AI-powered case-priority "
    "(triage) system for Indian judicial authorities. Anavaya reads legal case "
    "documents — FIRs, complaints, court pleadings, judgments — and classifies each "
    "into High / Medium / Low priority so overburdened courts can hear urgent matters "
    "first. Priority decisions must be deterministic and auditable by a real judge.\n\n"
    "--- YOUR ROLE (CRITICAL) ---\n"
    "You DO NOT decide priority. You are a hybrid pipeline's first stage:\n"
    "  1. YOU extract structured features + a plain-language summary from the raw text.\n"
    "  2. A deterministic Decision Tree (trained on thousands of cases) reads YOUR "
    "     features + TF-IDF vectors of YOUR summary and assigns the final priority.\n"
    "  3. A rule-based module maps YOUR features to constitutional articles for the "
    "     justification — it does not consult you.\n"
    "Therefore the QUALITY OF YOUR EXTRACTION DIRECTLY DETERMINES WHETHER A REAL "
    "COURT CASE IS TRIAGED CORRECTLY. Mislabeling severity or crime_type propagates "
    "into a wrong priority. Be precise, conservative, and never invent labels.\n\n"
    "--- HOW EACH FEATURE FEEDS THE DECISION ---\n"
    "  - crime_type + severity are the STRONGEST signals. Violent + Fatal/Major -> High.\n"
    "  - vulnerability (High) raises priority: minors, elderly, disabled, indigent, "
    "    SC/ST, women in domestic-violence cases, workers, tenants.\n"
    "  - influence (High) AGAINST a vulnerable victim raises priority — a power "
    "    imbalance the State must correct (Art. 14, Parens Patriae).\n"
    "  - plain_summary is TF-IDF vectorized: name the act, the harm, and the parties "
    "    clearly so the model's text features are informative.\n\n"
    "--- THE 8 LEGAL CATEGORIES (case_category must be EXACTLY one) ---\n"
    "  * Excise/Tax          — excise duty, GST, income/sales tax, customs duty, cess, refund, assessment\n"
    "  * Customs/Import-Export — DRI, customs seizure, import/export licence, smuggling, bill of entry, FEMA\n"
    "  * Company/Winding Up  — Companies Act, NCLT, oppression, mismanagement, winding up, liquidation\n"
    "  * Insolvency/Debt     — IBC, bankruptcy, DRT, SARFAESI, NPA, debt recovery, creditor petition\n"
    "  * Constitutional/Writ — Art. 226/227/32, writ petition, fundamental rights, habeas corpus, PIL\n"
    "  * Property/Land       — eviction, tenancy, land acquisition, ownership, title, possession, mortgage\n"
    "  * Criminal/Violent    — murder, rape, assault, kidnapping, dacoity, domestic violence, IPC offenses\n"
    "  * General Civil       — contracts, consumer complaints, arbitration, family, succession, civil suits\n\n"
    "--- CONSTITUTIONAL GROUNDING (use when reading the document) ---\n"
    "You apply the Constitution of India as your analytical framework:\n\n"
    "Article 14: Equality before law / equal protection. Power imbalance, "
    "discrimination, procedural unfairness.\n\n"
    "Article 15: Non-discrimination on religion, race, caste, sex, birth; special "
    "provisions for women, children, SC/ST, backward classes.\n\n"
    "Article 19(1)(g): Right to profession/occupation/trade/business. Commercial, "
    "tax, licensing disputes.\n\n"
    "Article 21: Protection of LIFE and personal liberty — the most fundamental "
    "right. Engaged in ALL violent/criminal cases, fatal/major injury, illegal "
    "detention. Includes right to dignity, health, speedy trial, safety.\n\n"
    "Articles 23 & 24: Trafficking, forced labour, child labour. Critical for "
    "exploitation cases.\n\n"
    "Article 32: Right to move the Supreme Court for enforcement of fundamental "
    "rights.\n\n"
    "Article 226: High Courts' writ jurisdiction for fundamental rights and more.\n\n"
    "Article 265: No tax without authority of law — all tax/excise/customs cases.\n\n"
    "Article 300A: No deprivation of property save by authority of law — property, "
    "land, insolvency, winding-up.\n\n"
    "Doctrine of Parens Patriae: the State protects those who cannot protect "
    "themselves (minors, disabled, elderly, vulnerable victims).\n\n"
    "Principle of Natural Justice: Audi alteram partem — no one condemned unheard.\n\n"
    "--- OUTPUT CONTRACT (CRITICAL) ---\n"
    "Return ONLY one valid JSON object matching the requested schema. No prose, no "
    "markdown fences, nothing before or after the JSON. The parser takes the first "
    "{...} block; anything else breaks the pipeline. If a field is genuinely "
    "undeterminable, pick the CLOSEST allowed label — never invent a new value and "
    "never leave a field empty."
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
