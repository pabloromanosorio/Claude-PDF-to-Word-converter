"""
Optimized prompt builder for docx skill conversion.

Target: ~120 tokens (vs original 400 tokens = 70% reduction)
Special emphasis on complex table handling.
"""

from models import ConversionSettings
from typing import Dict


def build_conversion_prompt(settings: ConversionSettings, filename: str) -> str:
    """
    Build optimized prompt for docx skill conversion.

    Target: ~120 tokens

    Args:
        settings: User conversion settings
        filename: Output filename (without extension)

    Returns:
        Optimized prompt string
    """

    # Base prompt - CRITICAL: Emphasize ALL pages and fidelity to original
    prompt = f"""Convert this ENTIRE document (ALL PAGES) to Word (.docx) format.

**CRITICAL: Process every single page of this document - do not stop after page 1.**

**Primary Goal:**
Match the original document as closely as possible:
- Keep the same visual layout and spacing
- Preserve the original margins, alignment, and formatting
- Maintain exact table structures
- Copy all text exactly as shown

**Output Settings:**
- Font: {settings.font} {settings.font_size}pt
- Margins: Top {settings.margin_top}", Bottom {settings.margin_bottom}", Left {settings.margin_left}", Right {settings.margin_right}"
- Filename: {filename}.docx
"""

    # Table-specific instructions (CRITICAL for complex documents)
    if settings.preserve_table_formatting:
        prompt += """
**Table Handling:**
- Preserve exact table structure, borders, and gridlines
- Maintain column widths and row heights from original
- Keep merged cells intact
- Preserve cell alignment and padding
- Maintain nested tables if present
- Copy all formatting (bold, colors, shading, fonts)
"""

    # Special instructions
    if settings.replace_signatures:
        prompt += "\n- Replace signature images with plain text: [Signature] (no italics, no special formatting)"

    if settings.add_page_markers:
        prompt += "\n- Add page markers: [Page 2 of original document:] [Page 3 of original document:] etc. at page breaks"
        prompt += "\n- IMPORTANT: Start page markers from page 2 (not page 1)"
        prompt += "\n- Format: Plain text in brackets, no italics"

    if settings.custom_instructions:
        prompt += f"\n\n**Additional Instructions:**\n{settings.custom_instructions}"

    # docx skill directive
    prompt += """

**Generate Document:**
Use the docx skill to create a high-quality Word document.
CRITICAL REMINDERS:
- Convert ALL pages (don't stop after first page)
- Prioritize visual fidelity to the original
- Copy exactly what you see, don't interpret or summarize
"""

    return prompt


def build_cached_prompt_parts(settings: ConversionSettings) -> Dict[str, str]:
    """
    Build prompt parts optimized for caching.

    Returns dict with:
    - 'static': Cacheable instructions (doesn't change)
    - 'dynamic': Per-conversion settings (changes each time)

    With caching:
    - First batch: ~120 tokens (full cost)
    - Later batches: ~30 dynamic + ~12 cached tokens
    - Savings: 90% on batches 2+
    """

    # Static part (cacheable) - doesn't change between batches
    static_instructions = """Convert this ENTIRE document (ALL PAGES) to Word (.docx) format.

**CRITICAL: Process every single page of this document - do not stop after page 1.**

**Primary Goal:**
Match the original document as closely as possible:
- Keep the same visual layout and spacing
- Preserve the original margins, alignment, and formatting
- Maintain exact table structures
- Copy all text exactly as shown

**Table Handling:**
- Preserve exact table structure, borders, and gridlines
- Maintain column widths and row heights from original
- Keep merged cells intact
- Preserve cell alignment and padding
- Maintain nested tables if present
- Copy all formatting (bold, colors, shading, fonts)

**Generate Document:**
Use the docx skill to create a high-quality Word document.
CRITICAL REMINDERS:
- Convert ALL pages (don't stop after first page)
- Prioritize visual fidelity to the original
- Copy exactly what you see, don't interpret or summarize
"""

    # Dynamic part (not cached) - changes per conversion
    dynamic_settings = f"""**Output Settings:**
- Font: {settings.font} {settings.font_size}pt
- Margins: Top {settings.margin_top}", Bottom {settings.margin_bottom}", Left {settings.margin_left}", Right {settings.margin_right}"
"""

    if settings.replace_signatures:
        dynamic_settings += "\n- Replace signature images with plain text: [Signature] (no italics, no special formatting)"

    if settings.add_page_markers:
        dynamic_settings += "\n- Add page markers: [Page 2 of original document:] [Page 3 of original document:] etc. at page breaks"
        dynamic_settings += "\n- IMPORTANT: Start page markers from page 2 (not page 1)"
        dynamic_settings += "\n- Format: Plain text in brackets, no italics"

    if settings.custom_instructions:
        dynamic_settings += f"\n\n**Additional Instructions:**\n{settings.custom_instructions}"

    return {
        'static': static_instructions,
        'dynamic': dynamic_settings
    }


def estimate_prompt_tokens(prompt: str) -> int:
    """
    Rough estimate of prompt tokens.

    Uses approximation: 1 token ≈ 4 characters or 0.75 words

    Args:
        prompt: Prompt text

    Returns:
        Estimated token count
    """
    # Simple heuristic: split by whitespace and estimate
    words = prompt.split()
    return int(len(words) * 0.75)


def validate_prompt_length(prompt: str, max_tokens: int = 150) -> bool:
    """
    Validate that prompt is within token budget.

    Args:
        prompt: Prompt text
        max_tokens: Maximum allowed tokens

    Returns:
        True if within budget, False otherwise
    """
    estimated = estimate_prompt_tokens(prompt)
    return estimated <= max_tokens
