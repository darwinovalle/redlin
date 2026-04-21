from API.models import Document, Summary

from .processing_common import generate_with_retry


def generate_summary(document: Document, text: str, lang_label: str, output_lang_instruction: str) -> str:
    """Generate and persist summary markdown for a document."""
    print("Generating summary...")
    doc_title = (document.title or "Document").strip()
    summary_prompt = f"""
You are an expert academic summarizer. {output_lang_instruction}

GOAL
Produce a high-signal, chapter/section-structured summary that captures the core intellectual substance of the source.

OUTPUT FORMAT (Pure Markdown only)
- First line MUST be exactly an H1 with the document title:
  # {doc_title}
- After the title, output the structured summary only. No preamble, no meta text, no "analysis".
- Use section headings as H2 ("##"), each starting with ONE emoji + space + concise heading (no trailing punctuation).
- Under each heading, use dense bullets ("- ") OR tight mini paragraphs.
- Final section must be:
  ## ⭐ Key Takeaways
  - 5-12 distilled bullets (no redundancy).

CONTENT RULES (Absolute)
- Omit front matter: copyright notices, ISBN, disclaimers, dedications, acknowledgments (unless containing indispensable definitions).
- Preserve the source's logic and argument flow; merge or skip low-value sections.
- No hallucinations. Only include concepts supported by the source.
- Remove repetition and ornamental filler; keep mechanisms, definitions, claims, evidence, results, implications, limitations.
- Include concrete numbers, definitions, and conditions when present; keep units and constraints.
- Use brief emphasis for pivotal terms (bold) sparingly. Use inline code like_this for terms, variables, or API names when appropriate.
- Tables are allowed if they clarify comparisons or taxonomies.
- Forbidden phrases anywhere: "Here is", "This book", "The document", "This section".
- Output language: {lang_label}
- If negligible substance after filtering: output:
  # {doc_title}

  (No substantive content found in provided excerpt.)

STRUCTURE GUIDANCE (Use as applicable)
- Start with the most structural or conceptual sections first (map to chapters/sections if present).
- For empirical work: Methods, Data, Results, Interpretation, Limitations.
- For theory: Core Claims, Definitions, Mechanisms, Propositions, Implications.
- For math/proofs: Theorem/Claim, Assumptions, Sketch of Proof, Corollaries, Scope.
- For code/APIs: Components, Interfaces, Invariants, Complexity, Example Usage.
- For dialogues/debates: Positions by speaker/side, Points of agreement, Disagreements, Evidence.
- For literature/essays: Thesis, Motifs/Themes, Structure/Arc, Key Passages (quoted minimally), Interpretation.

DENSITY & LENGTH
- Favor high information density; avoid sentence padding.
- Generally 4-10 sections total; 2-8 bullets per section depending on source length.

QUALITY CHECK (silent, do not output)
- H1 title present and correct.
- Headings are "## " + one emoji + space + concise title.
- No preamble/meta/explanations.
- No forbidden phrases.
- No unsupported claims; numbers/definitions preserved.
- Ends with "## ⭐ Key Takeaways" (5-12 bullets).

SOURCE TEXT (for analysis; paraphrase in output)
{text}
"""

    try:
        summary_response = generate_with_retry(summary_prompt, max_attempts=3)
        summary_content = summary_response.text
    except Exception as exc:
        summary_content = f"Title: {doc_title}\n\n(No substantive content found due to generation error.)"
        print(f"[Error] Failed to generate summary: {exc}")

    Summary.objects.update_or_create(
        document=document,
        defaults={"content": summary_content},
    )
    print("Summary created/updated.")
    return summary_content
