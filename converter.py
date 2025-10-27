"""
PDF to Word converter using Anthropic Skills API.

This module handles:
- Uploading custom skills to user's Anthropic account
- Converting documents via Skills API
- Page extraction from PDFs
- Cost calculation
"""

import os
import base64
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from anthropic import Anthropic

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Skill package path
SKILL_PATH = Path(__file__).parent / 'image-to-docx-converter.zip'


def _collect_files_from_directory(directory: Path) -> list:
    """
    Recursively collect all files from directory for Skills API upload.

    Args:
        directory: Path to directory

    Returns:
        List of file tuples (relative_path, file_handle)
    """
    files = []
    for item in directory.rglob('*'):
        if item.is_file():
            # Get relative path from directory
            rel_path = item.relative_to(directory)
            files.append((str(rel_path), open(item, 'rb')))
    return files


def upload_skill(api_key: str, client: Optional[Anthropic] = None) -> Optional[str]:
    """
    Upload image-to-docx-converter skill to user's Anthropic account.

    Args:
        api_key: Anthropic API key
        client: Optional pre-configured Anthropic client (for testing)

    Returns:
        skill_id if successful, None if error (allows fallback)
    """
    try:
        if client is None:
            client = Anthropic(api_key=api_key)

        logger.info("Uploading skill to Anthropic...")

        # Extract skill to temp directory for upload
        import zipfile
        import tempfile
        import shutil

        temp_dir = Path(tempfile.mkdtemp())
        files_list = []

        try:
            # Extract skill zip
            with zipfile.ZipFile(SKILL_PATH, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # Collect files from extracted directory
            files_list = _collect_files_from_directory(temp_dir)

            # Upload via Skills API
            skill = client.beta.skills.create(
                files=files_list,
                betas=["skills-2025-10-02"]
            )

            logger.info(f"Skill uploaded successfully: {skill.skill_id}")
            return skill.skill_id

        finally:
            # Close all file handles
            for _, file_handle in files_list:
                try:
                    file_handle.close()
                except:
                    pass
            # Clean up temp directory
            shutil.rmtree(temp_dir, ignore_errors=True)

    except Exception as e:
        logger.error(f"Skill upload failed: {e}")
        logger.info("Will use embedded skill instructions as fallback")
        return None


def build_prompt(settings: Dict[str, Any], file_name: str) -> str:
    """
    Build conversion prompt with verification requirements.

    Args:
        settings: User settings (font, margins, etc.)
        file_name: Output file name

    Returns:
        Complete prompt string
    """
    margins = settings.get('margins', {})

    prompt = f"""Convert this document to professional Word format using the image-to-docx-converter skill.

## User Settings
- Font: {settings.get('font', 'Arial')}
- Size: {settings.get('fontSize', 12)}pt
- Margins: Top {margins.get('top', 1.0)}", Right {margins.get('right', 1.0)}", Bottom {margins.get('bottom', 1.0)}", Left {margins.get('left', 1.0)}"
- Model: {settings.get('model', 'claude-sonnet-4-5-20250929')}

## Special Requests
"""

    if settings.get('replaceSignatures'):
        prompt += "- Replace signatures with [Signature]\n"

    if settings.get('addPageMarkers'):
        prompt += "- Add page markers at END of sentences after page breaks (for CAT tool segmentation)\n"

    if settings.get('customInstructions'):
        prompt += f"- Custom: {settings['customInstructions']}\n"

    prompt += """
## CRITICAL VERIFICATION REQUIREMENTS

**Before generating code, verify:**
1. ✓ Read ENTIRE document - do not skip any pages or sections
2. ✓ Preserve EXACT text - no paraphrasing, no interpretation
3. ✓ Reproduce EXACT formatting - font sizes as-is, not as headings
4. ✓ Include ALL elements - text, tables, images, signatures

**Anti-Hallucination Rules:**
- ❌ DO NOT add content that isn't in the source document
- ❌ DO NOT interpret/summarize - reproduce exactly
- ❌ DO NOT skip sections because they "look similar"
- ❌ DO NOT add titles, headings, or labels not in original

**Page Markers (if enabled):**
- Insert "[Page X of the original]" at END of sentence after page break
- Example: "...end of text on page 1. [Page 2 of the original] Start of text..."
- Never insert mid-sentence (breaks CAT tool segmentation)

**Completeness Check:**
After generating the document code:
1. Count pages in source vs output - must match
2. Verify all sections present
3. Confirm no content was skipped or omitted

**Output Requirements:**
- Generate complete, executable Node.js code using docx.js
- Include ALL necessary require() statements
- Save to: ./{file_name}.docx
- Print "SUCCESS: {file_name}.docx" when complete
- Exit with process.exit(0) on success

The image-to-docx-converter skill provides detailed patterns - follow them exactly.
"""

    return prompt


def calculate_cost(usage: Dict[str, int], model: str) -> float:
    """
    Calculate API cost from token usage.

    Args:
        usage: Token usage dict with input_tokens and output_tokens
        model: Model name

    Returns:
        Cost in US dollars
    """
    # Pricing per million tokens
    pricing = {
        'claude-haiku-4-5': {'input': 1.00, 'output': 5.00},
        'claude-sonnet-4-5-20250929': {'input': 3.00, 'output': 15.00},
        'claude-3-5-haiku-20241022': {'input': 0.80, 'output': 4.00}
    }

    model_pricing = pricing.get(model, pricing['claude-sonnet-4-5-20250929'])

    input_cost = (usage.get('input_tokens', 0) / 1_000_000) * model_pricing['input']
    output_cost = (usage.get('output_tokens', 0) / 1_000_000) * model_pricing['output']

    return input_cost + output_cost


def convert_document(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    skill_id: Optional[str] = None,
    progress_callback: Optional[Callable] = None
) -> Dict[str, Any]:
    """
    Convert document to Word format.

    Args:
        file_path: Path to PDF or image file
        settings: User settings
        api_key: Anthropic API key
        skill_id: Optional skill ID (will use embedded if None)
        progress_callback: Optional callback for progress updates

    Returns:
        Dict with success status, output path, and cost
    """
    # TODO: Implement full conversion
    # For now, raise NotImplementedError
    raise NotImplementedError("Full conversion implementation in next task")
