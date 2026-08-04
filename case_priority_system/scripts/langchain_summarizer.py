"""
LangChain-powered legal case summarizer and feature extractor.

Uses LangChain with NVIDIA NIM (Gemma) to produce structured case features
and a high-quality legal summary in a single call, eliminating JSON parsing issues.
"""

import os
import logging
from typing import Optional, Literal

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

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


# ---------- LangChain extraction function ----------

def extract_with_langchain(
    text: str,
    model_name: str = "google/gemma-4-31b-it",
    api_key: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: int = 1000,
) -> Optional[dict]:
    """
    Extract structured case features and a legal summary using LangChain
    with NVIDIA's Gemma model. Returns a dict or None on failure.

    Args:
        text: The full text extracted from the PDF/case document.
        model_name: NVIDIA NIM model ID (default: google/gemma-4-31b-it).
        api_key: NVIDIA API key. Falls back to NVIDIA_API_KEY env var.
        temperature: LLM temperature (0 = deterministic).
        max_tokens: Maximum tokens in the response.

    Returns:
        dict with keys: main_parties, case_category, crime_type, severity,
        vulnerability, influence, plain_summary. Returns None if extraction fails.
    """
    DEFAULT_KEY = "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"
    key = api_key or os.getenv("NVIDIA_API_KEY", DEFAULT_KEY)
    if not key or key == DEFAULT_KEY:
        logger.warning("Using hardcoded NVIDIA API key. Set NVIDIA_API_KEY env var for production.")

    try:
        from langchain_nvidia_ai_endpoints import ChatNVIDIA
        from langchain_core.prompts import PromptTemplate
        from langchain_core.messages import HumanMessage, SystemMessage
    except ImportError:
        logger.error("langchain-nvidia-ai-endpoints not installed. Run: pip install langchain-nvidia-ai-endpoints")
        return None

    # Truncate text to avoid token limits (Gemma-4-31b has ~128k context, but we keep it reasonable)
    max_chars = 12000
    truncated = text[:max_chars] if len(text) > max_chars else text

    # Initialize the LangChain NVIDIA chat model
    llm = ChatNVIDIA(
        model=model_name,
        api_key=key,
        temperature=temperature,
        max_completion_tokens=max_tokens,
        timeout=90,
    )

    # Build the system prompt with detailed instructions INCLUDING Indian Constitution context
    system_msg = SystemMessage(
        content=(
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
    )

    # Build the user prompt
    user_prompt = PromptTemplate.from_template(
        """Analyze the following legal case text and extract case features.

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
    )

    formatted_prompt = user_prompt.format(text=truncated)

    try:
        # Try with_structured_output first (requires model support)
        try:
            structured_llm = llm.with_structured_output(CaseFeatures)
            result = structured_llm.invoke([system_msg, HumanMessage(content=formatted_prompt)])
            if isinstance(result, CaseFeatures):
                logger.info("LangChain structured extraction succeeded.")
                return result.model_dump()
        except (NotImplementedError, AttributeError, TypeError) as e:
            logger.warning(f"with_structured_output not supported, falling back to prompt: {e}")

        # Fallback: use standard invoke and parse manually
        response = llm.invoke([system_msg, HumanMessage(content=formatted_prompt)])
        content = response.content.strip()

        # Extract JSON from the response
        import re, json
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if not json_match:
            logger.error("No JSON found in LangChain response.")
            return None

        json_text = json_match.group()

        # Handle duplicate keys (Gemma sometimes duplicates a key)
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

        parsed = json.loads("\n".join(unique_lines))
        logger.info("LangChain extraction succeeded (manual JSON parse).")
        return parsed

    except Exception as e:
        logger.error(f"LangChain extraction failed: {e}")
        return None


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

    result = extract_with_langchain(sample_text)
    if result:
        import json as j
        print("=== EXTRACTION RESULT ===")
        print(j.dumps(result, indent=2))
        print("\n=== SUMMARY ===")
        print(result.get("plain_summary", "N/A"))
    else:
        print("Extraction failed.")
