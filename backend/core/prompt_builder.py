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

    # Base prompt - Let docx skill do its thing, but be comprehensive
    prompt = f"""Convert this ENTIRE document (ALL PAGES) to Word (.docx) format using the docx skill.

**CRITICAL: Process every single page - do not stop after page 1.**

**Be Comprehensive:**
- Include ALL text: body, headers, footers, sidebars, captions, footnotes
- Include ALL pages from start to finish
- Don't skip or summarize anything
"""

    # Add table preservation if requested (tables are a common pain point)
    if settings.preserve_table_formatting:
        prompt += "\n- Preserve table structures and data\n"

    # Only override if user explicitly wants it
    if settings.override_formatting:
        prompt += f"""
**Apply Custom Formatting:**
- Font: {settings.font} {settings.font_size}pt
- Margins: Top {settings.margin_top}", Bottom {settings.margin_bottom}", Left {settings.margin_left}", Right {settings.margin_right}"
"""

    prompt += f"""
**Output:** {filename}.docx
"""

    # Special requirements only
    special = []

    if settings.replace_signatures:
        special.append("Replace signature images with: [Signature]")

    if settings.add_page_markers:
        special.append("Add page markers: [Page 2 of original document:] [Page 3 of original document:] etc.")
        special.append("Start markers from page 2 (not page 1)")

    if settings.custom_instructions:
        special.append(settings.custom_instructions)

    if special:
        prompt += "\n**Special Requirements:**\n- " + "\n- ".join(special)

    # Final directive - trust the skill!
    prompt += """

Use the docx skill to create the Word document. Be thorough and complete.
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
    static_instructions = """Convert this ENTIRE document (ALL PAGES) to Word (.docx) format using the docx skill.

**CRITICAL: Process every single page - do not stop after page 1.**

**Be Comprehensive:**
- Include ALL text: body, headers, footers, sidebars, captions, footnotes
- Include ALL pages from start to finish
- Don't skip or summarize anything
"""

    # Add table preservation if requested (goes in static part if always enabled)
    if settings.preserve_table_formatting:
        static_instructions += "\n- Preserve table structures and data\n"

    static_instructions += "\nUse the docx skill to create the Word document. Be thorough and complete.\n"

    # Dynamic part (not cached) - changes per conversion
    dynamic_settings = ""

    if settings.override_formatting:
        dynamic_settings += f"""
**Apply Custom Formatting:**
- Font: {settings.font} {settings.font_size}pt
- Margins: Top {settings.margin_top}", Bottom {settings.margin_bottom}", Left {settings.margin_left}", Right {settings.margin_right}"
"""

    special = []
    if settings.replace_signatures:
        special.append("Replace signature images with: [Signature]")
    if settings.add_page_markers:
        special.append("Add page markers: [Page 2 of original document:] [Page 3 of original document:] etc.")
        special.append("Start markers from page 2 (not page 1)")
    if settings.custom_instructions:
        special.append(settings.custom_instructions)

    if special:
        dynamic_settings += "\n**Special Requirements:**\n- " + "\n- ".join(special)

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
