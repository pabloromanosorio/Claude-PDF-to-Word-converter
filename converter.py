"PDF to Word converter using Anthropic Skills API.

This module handles:
- Uploading custom skills to user's Anthropic account
- Converting documents via Skills API
- Page extraction from PDFs
- Cost calculation
"

import os
import base64
import logging
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from anthropic import Anthropic
from anthropic.lib import files_from_dir

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Skill package path
SKILL_PATH = Path(__file__).parent / 'image-to-docx-converter.zip'


def upload_skill(api_key: str, client: Optional[Anthropic] = None) -> Optional[str]:
    """
    Upload image-to-docx-converter skill to user's Anthropic account.
    If skill already exists, returns the existing skill_id.

    Args:
        api_key: Anthropic API key
        client: Optional pre-configured Anthropic client (for testing)

    Returns:
        skill_id if successful, None if error (allows fallback)
    """
    try:
        if client is None:
            client = Anthropic(api_key=api_key)

        # First, check if skill already exists
        logger.info("Checking for existing skill...")
        try:
            skills_list = client.beta.skills.list(betas=["skills-2025-10-02"], source="custom")
            logger.info(f"Found {len(skills_list.data)} custom skills")
            for skill in skills_list.data:
                logger.info(f"Skill: {skill.id}, display_title={getattr(skill, 'display_title', 'N/A')}")
                # Check if this is our skill (by display title)
                if hasattr(skill, 'display_title') and skill.display_title == "Image to DOCX Converter":
                    logger.info(f"Found existing skill with matching title: {skill.id}")
                    return skill.id
        except Exception as e:
            logger.warning(f"Could not list skills: {e}")

        logger.info("Uploading new skill to Anthropic...")

        # Extract skill to temp directory for upload
        import zipfile
        import tempfile
        import shutil

        # Create temp dir with skill name (API requirement)
        temp_base = Path(tempfile.mkdtemp())
        temp_dir = temp_base / 'image-to-docx-converter'
        temp_dir.mkdir()

        try:
            # Extract skill zip
            with zipfile.ZipFile(SKILL_PATH, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # Upload via Skills API using official SDK helper
            skill = client.beta.skills.create(
                display_title="Image to DOCX Converter",
                files=files_from_dir(str(temp_dir)),
                betas=["skills-2025-10-02"]
            )

            # The response has 'id' not 'skill_id'
            skill_id = skill.id
            logger.info(f"Skill uploaded successfully: {skill_id}")
            return skill_id

        finally:
            # Clean up temp directory
            shutil.rmtree(temp_base, ignore_errors=True)

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


def file_to_base64(file_path: str) -> str:
    """Convert file to base64 encoding"""
    with open(file_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def get_media_type(file_path: str) -> str:
    """Determine media type from file extension"""
    ext = Path(file_path).suffix.lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    }
    return media_types.get(ext, 'application/pdf')


def extract_pages(pdf_path: str, page_range: str) -> str:
    """
    Extract specific pages from PDF

    Args:
        pdf_path: Path to PDF file
        page_range: Range string like "1-5, 7, 9-12" or empty for all

    Returns:
        Path to extracted PDF (or original if all pages)
    """
    if not page_range or page_range.strip() == '':
        return pdf_path

    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(pdf_path)
    writer = PdfWriter()

    # Parse page range
    pages_to_extract = set()
    for part in page_range.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-')
            pages_to_extract.update(range(int(start)-1, int(end)))  # Convert to 0-indexed
        else:
            pages_to_extract.add(int(part)-1)  # Convert to 0-indexed

    # Extract pages
    for page_num in sorted(pages_to_extract):
        if page_num < len(reader.pages):
            writer.add_page(reader.pages[page_num])

    # Save extracted PDF
    output_path = pdf_path.replace('.pdf', '_extracted.pdf')
    with open(output_path, 'wb') as f:
        writer.write(f)

    return output_path


def extract_code_from_response(response_text: str) -> Optional[str]:
    """Extract JavaScript code from API response"""
    import re

    # Try to find code block
    code_block_pattern = r'```(?:javascript)?\n(.*?)\n```'
    matches = re.findall(code_block_pattern, response_text, re.DOTALL)

    if matches:
        return matches[0]

    return None


def execute_generated_code(code: str, output_dir: str) -> Dict[str, Any]:
    """
    Execute generated JavaScript code to create .docx file.

    Args:
        code: JavaScript code to execute
        output_dir: Directory where .docx should be created

    Returns:
        Dict with success status
    """
    temp_dir = Path(tempfile.mkdtemp())

    try:
        # Write code to temp file
        code_file = temp_dir / 'generate_docx.js'
        code_file.write_text(code)

        # Set NODE_PATH to use docx module
        env = os.environ.copy()
        # Assume docx is installed globally or provide path

        # Execute with node
        result = subprocess.run(
            ['node', str(code_file)],
            cwd=output_dir,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0 and 'SUCCESS' in result.stdout:
            return {'success': True, 'output': result.stdout}
        else:
            raise Exception(f"Code execution failed: {result.stderr}\n{result.stdout}")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def convert_document(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    page_range: str = '',
    skill_id: Optional[str] = None,
    progress_callback: Optional[Callable] = None,
    client: Optional[Anthropic] = None
) -> Dict[str, Any]:
    """
    Convert document to Word format using Anthropic Skills API.

    Args:
        file_path: Path to PDF or image file
        settings: User settings (font, margins, model, etc.)
        api_key: Anthropic API key
        page_range: Page range for PDFs (e.g., "1-5, 7")
        skill_id: Optional skill ID (will use embedded if None)
        progress_callback: Optional callback(dict) for progress updates
        client: Optional pre-configured client (for testing)

    Returns:
        Dict with:
            - success: bool
            - output_path: str (path to generated .docx)
            - cost: float (in USD)
            - error: str (if failed)
    """
    try:
        if progress_callback:
            progress_callback({'status': 'preparing', 'progress': 10})

        # Extract pages if range specified
        if page_range and file_path.endswith('.pdf'):
            file_path = extract_pages(file_path, page_range)

        # Initialize client
        if client is None:
            client = Anthropic(api_key=api_key)

        # Prepare file
        file_base64 = file_to_base64(file_path)
        media_type = get_media_type(file_path)
        file_name = Path(file_path).stem

        # Build prompt - use custom if available
        from config_manager import ConfigManager
        config_mgr = ConfigManager()
        custom_prompt = config_mgr.get_custom_prompt()

        if custom_prompt:
            # Use custom prompt, but inject filename
            prompt = custom_prompt.replace('{file_name}', file_name)
        else:
            # Use default prompt builder
            prompt = build_prompt(settings, file_name)

        if progress_callback:
            progress_callback({'status': 'analyzing', 'progress': 30})

        # Prepare API call
        messages_params = {
            'model': settings.get('model', 'claude-sonnet-4-5-20250929'),
            'max_tokens': 16000,
            'betas': ['code-execution-2025-08-25', 'skills-2025-10-02'],
            'tools': [{
                'type': 'code_execution_20250825',
                'name': 'code_execution'
            }],
            'messages': [{
                'role': 'user',
                'content': [
                    {
                        'type': 'document',
                        'source': {
                            'type': 'base64',
                            'media_type': media_type,
                            'data': file_base64
                        }
                    },
                    {
                        'type': 'text',
                        'text': prompt
                    }
                ]
            }]
        }

        # Add skill if available
        if skill_id:
            messages_params['container'] = {
                'skills': [{
                    'type': 'custom',
                    'skill_id': skill_id,
                    'version': 'latest'
                }]
            }

        # Call API
        logger.info(f"Calling Anthropic API with model {settings.get('model')}")
        response = client.beta.messages.create(**messages_params)

        if progress_callback:
            progress_callback({'status': 'generating', 'progress': 70})

        # Extract code - check text blocks, tool_use, and code execution results
        response_text = ''
        code_from_tool = None
        text_editor_file_content = None

        logger.info(f"Response content blocks: {len(response.content)}")
        for i, block in enumerate(response.content):
            logger.info(f"Block {i} type: {block.type}")

            if hasattr(block, 'text'):
                response_text += block.text
                logger.info(f"Got text block, length: {len(block.text)}")

            # Check for server_tool_use blocks (code execution tools)
            if block.type == 'server_tool_use' and hasattr(block, 'input'):
                tool_name = getattr(block, 'name', '')
                logger.info(f"Server tool use block found: {tool_name}")

                # Check if it's a text editor tool (where code is written)
                if 'text_editor' in tool_name:
                    # Log the input attributes
                    logger.info(f"Text editor input attributes: {dir(block.input)}")

                    # Try various possible attribute names
                    if hasattr(block.input, 'file_text'):
                        code_from_tool = block.input.file_text
                        logger.info(f"Got code from text_editor.file_text, length: {len(code_from_tool)}")
                    elif hasattr(block.input, 'content'):
                        code_from_tool = block.input.content
                        logger.info(f"Got code from text_editor.content, length: {len(code_from_tool)}")
                    elif hasattr(block.input, 'new_str'):
                        code_from_tool = block.input.new_str
                        logger.info(f"Got code from text_editor.new_str, length: {len(code_from_tool)}")

            # Check for regular tool_use blocks (legacy)
            elif block.type == 'tool_use' and hasattr(block, 'input'):
                logger.info(f"Tool use block found: {block.name}")
                if hasattr(block.input, 'code'):
                    code_from_tool = block.input.code
                    logger.info("Got code from tool_use block")

            # Check tool result blocks for file content
            elif block.type == 'text_editor_code_execution_tool_result':
                logger.info("Found text_editor result block")
                # Log attributes
                if hasattr(block, '__dict__'):
                    logger.info(f"Result block attributes: {list(block.__dict__.keys())}")

                # Try to get file content from result
                if hasattr(block, 'content'):
                    content = block.content
                    logger.info(f"Result content type: {type(content)}")
                    logger.info(f"Result content dir: {[a for a in dir(content) if not a.startswith('_')]}")

                    # The SDK object has nested content attribute
                    if hasattr(content, 'content'):
                        nested_content = content.content
                        logger.info(f"Found nested content, type: {type(nested_content)}")
                        if isinstance(nested_content, str):
                            text_editor_file_content = nested_content
                            logger.info(f"Got file content from result.content.content (string), length: {len(text_editor_file_content)}")
                    # Try to get file_text attribute (common in SDK objects)
                    elif hasattr(content, 'file_text'):
                        text_editor_file_content = content.file_text
                        logger.info(f"Got file content from result.content.file_text, length: {len(text_editor_file_content)}")
                    # Content might be a list of content blocks
                    elif isinstance(content, list):
                        for item in content:
                            logger.info(f"Content item type: {type(item)}, has text: {hasattr(item, 'text')}")
                            if hasattr(item, 'text'):
                                text_editor_file_content = item.text
                                logger.info(f"Got file content from result.content[].text, length: {len(text_editor_file_content)}")
                                break
                    elif hasattr(content, 'text'):
                        text_editor_file_content = content.text
                        logger.info(f"Got file content from result.content.text, length: {len(text_editor_file_content)}")
                    elif isinstance(content, str):
                        text_editor_file_content = content
                        logger.info(f"Got file content from result.content (string), length: {len(text_editor_file_content)}")

            elif 'code_execution_tool_result' in block.type:
                logger.info(f"Tool result block: {block.type}")

        # Try to extract code from text response first
        code = extract_code_from_response(response_text)

        # If no code in text, try code from tool input
        if not code and code_from_tool:
            code = code_from_tool
            logger.info("Using code from tool execution input block")

        # If still no code, try file content from text_editor result
        if not code and text_editor_file_content:
            code = text_editor_file_content
            logger.info("Using code from text_editor result block")

        if not code:
            logger.error(f"No code found. Response had {len(response_text)} chars of text")
            logger.error(f"First 500 chars of response: {response_text[:500]}")
            # Log all block types for debugging
            logger.error(f"All block types: {[b.type for b in response.content]}")
            return {
                'success': False,
                'error': 'No code generated in response'
            }

        # Execute code
        output_dir = Path(file_path).parent
        execute_result = execute_generated_code(code, str(output_dir))

        if not execute_result['success']:
            return {
                'success': False,
                'error': 'Code execution failed'
            }

        if progress_callback:
            progress_callback({'status': 'complete', 'progress': 100})

        # Calculate cost
        cost = calculate_cost(
            {
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens
            },
            settings.get('model')
        )

        output_path = output_dir / f"{file_name}.docx"

        return {
            'success': True,
            'output_path': str(output_path),
            'cost': cost
        }

    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
