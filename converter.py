"""
PDF/Image to Word converter using Claude Vision + built-in docx skill.

This module handles document conversion using:
- Claude Vision API for OCR
- Built-in docx skill for Word document generation
- Page extraction and batching for large documents
"""

import os
import base64
import logging
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from anthropic import Anthropic
from pypdf import PdfReader, PdfWriter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def build_prompt(settings: Dict[str, Any], file_name: str) -> str:
    """
    Build vision-optimized conversion prompt.

    Args:
        settings: User settings (font, margin, etc.)
        file_name: Output file name

    Returns:
        Complete prompt string
    """
    margin = settings.get('margin', 1.0)  # Single value now

    prompt = f"""Convert this scanned document to professional Word (.docx) format.

## Document Settings
- Font: {settings.get('font', 'Arial')} {settings.get('fontSize', 12)}pt
- Margins: {margin}" on all sides
- Output filename: {file_name}.docx

## Special Instructions"""

    if settings.get('replaceSignatures'):
        prompt += "\n- Replace signature images with text '[Signature]'"

    if settings.get('addPageMarkers'):
        prompt += "\n- Insert '[Page X of the original]' at END of complete sentences after page breaks. NEVER mid-sentence (critical for CAT tool segmentation)."

    if settings.get('customInstructions'):
        prompt += f"\n- {settings['customInstructions']}"

    prompt += """

## TEXT EXTRACTION via Vision Model
**Read the document image carefully:**
- Extract ALL text exactly as it appears (no paraphrasing)
- Preserve original language
- Handle poor scan quality, degraded text, or handwriting
- Understand document structure and layout context
- Recognize heading hierarchy, tables, lists, and formatting

## CRITICAL PRESERVATION RULES
**Reproduce EXACTLY what you see:**
1. **Exact Text**: Every word, character, number exactly as shown
2. **Exact Font Sizes**: Reproduce font sizes as-is. DO NOT interpret larger text as "headings" - just match the visual size
3. **Complete Content**: All text, tables, images, signatures, headers, footers
4. **No Skipping**: Process entire document, every page
5. **No Adding**: Do not add titles, labels, or content not visible in source
6. **No Interpretation**: Do not summarize or reword

## LAYOUT & READING ORDER
**Structured extraction:**
- **Double columns**: Extract left column first, then right column below (linear reading order for CAT tools)
- **Parallel text** (signatures, dates): Preserve spatial relationship
- **Tables**: Maintain exact structure, borders, cell content
- **Lists**: Preserve bullet/numbered formatting exactly as shown
- **Spacing**: Match paragraph spacing and line breaks

## OUTPUT QUALITY for Professional Delivery
**Create a Word document that is:**
- Clean, editable text (no text-as-images except signatures if not replaced)
- Consistent formatting throughout
- CAT-tool compatible (proper segmentation, no mid-sentence breaks)
- Minimal post-processing needed (~90% delivery-ready)
- Visually similar to original (~80-90% resemblance)

Use the docx skill to create a high-quality formatted Word document.
"""

    return prompt


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


def should_split_document(file_path: str) -> bool:
    """Determine if document needs batching"""
    file_size = os.path.getsize(file_path)

    # Split if > 25MB
    if file_size > 25 * 1024 * 1024:
        return True

    # For PDFs, check page count
    if file_path.endswith('.pdf'):
        reader = PdfReader(file_path)
        if len(reader.pages) > 90:
            return True

    return False


def create_batch_pdf(pages: list, start_idx: int) -> str:
    """Create temporary PDF from page list"""
    writer = PdfWriter()
    for page in pages:
        writer.add_page(page)

    temp_path = tempfile.mktemp(suffix=f'_batch_{start_idx}.pdf')
    with open(temp_path, 'wb') as f:
        writer.write(f)

    return temp_path


def merge_docx_files(docx_paths: list, output_name: str) -> str:
    """
    Merge multiple DOCX files preserving formatting

    Args:
        docx_paths: List of DOCX file paths
        output_name: Base name for output file

    Returns:
        Path to merged DOCX file
    """
    from docx import Document

    merged = Document(docx_paths[0])

    for docx_path in docx_paths[1:]:
        sub_doc = Document(docx_path)

        # Add page break
        merged.add_page_break()

        # Copy all elements
        for element in sub_doc.element.body:
            merged.element.body.append(element)

    output_dir = Path(docx_paths[0]).parent
    output_path = output_dir / f"{output_name}_merged.docx"
    merged.save(output_path)

    # Clean up batch files
    for path in docx_paths:
        try:
            os.unlink(path)
        except:
            pass

    return str(output_path)


def convert_document_batched(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    progress_callback: Optional[Callable] = None,
    client: Optional[Anthropic] = None
) -> Dict[str, Any]:
    """
    Convert large PDFs in batches (15 pages each)

    Args:
        file_path: Path to PDF file
        settings: User settings
        api_key: Anthropic API key
        progress_callback: Optional callback
        client: Optional pre-configured client

    Returns:
        Same as convert_document_simple
    """
    try:
        if progress_callback:
            progress_callback({'status': 'preparing batches', 'progress': 5})

        reader = PdfReader(file_path)
        total_pages = len(reader.pages)
        batch_size = 15
        batches = []

        # Create batches
        for i in range(0, total_pages, batch_size):
            batch_pages = reader.pages[i:i + batch_size]
            batches.append(batch_pages)

        logger.info(f"Splitting {total_pages} pages into {len(batches)} batches")

        converted_paths = []
        total_cost = 0.0

        # Process each batch
        for idx, batch_pages in enumerate(batches):
            batch_progress = 10 + (80 * idx / len(batches))

            if progress_callback:
                progress_callback({
                    'status': f'converting batch {idx+1}/{len(batches)}',
                    'progress': batch_progress
                })

            # Create temp PDF for batch
            batch_pdf_path = create_batch_pdf(batch_pages, idx)

            # Convert batch
            result = convert_document_simple(
                batch_pdf_path,
                settings,
                api_key,
                None,  # No progress callback for batches
                client
            )

            # Cleanup batch PDF
            try:
                os.unlink(batch_pdf_path)
            except:
                pass

            if not result['success']:
                # Cleanup on failure
                for path in converted_paths:
                    try:
                        os.unlink(path)
                    except:
                        pass
                return result

            converted_paths.append(result['output_path'])
            total_cost += result.get('cost', 0)

        # Merge all batches
        if progress_callback:
            progress_callback({'status': 'merging batches', 'progress': 90})

        file_name = Path(file_path).stem
        merged_path = merge_docx_files(converted_paths, file_name)

        if progress_callback:
            progress_callback({'status': 'complete', 'progress': 100})

        return {
            'success': True,
            'output_path': merged_path,
            'cost': total_cost
        }

    except Exception as e:
        logger.error(f"Batched conversion failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


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
    Convert document to Word format using Claude Vision + docx skill.

    Args:
        file_path: Path to PDF or image file
        settings: User settings (font, margin, model, etc.)
        api_key: Anthropic API key
        page_range: Page range for PDFs (e.g., "1-5, 7")
        skill_id: Ignored (kept for compatibility)
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

        # Check if batching needed
        if should_split_document(file_path):
            logger.info("Document requires batching")
            return convert_document_batched(
                file_path, settings, api_key, progress_callback, client
            )
        else:
            # Simple conversion for small documents
            return convert_document_simple(
                file_path, settings, api_key, progress_callback, client
            )

    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def convert_document_simple(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    progress_callback: Optional[Callable] = None,
    client: Optional[Anthropic] = None
) -> Dict[str, Any]:
    """Simple conversion for small documents using Vision + docx skill"""

    if progress_callback:
        progress_callback({'status': 'preparing', 'progress': 20})

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
        progress_callback({'status': 'analyzing', 'progress': 40})

    # API call
    logger.info(f"Calling Anthropic API with model {settings.get('model')}")

    response = client.beta.messages.create(
        model=settings.get('model', 'claude-sonnet-4-5-20250929'),
        max_tokens=16000,
        betas=['code-execution-2025-08-25', 'skills-2025-10-02', 'files-api-2025-04-14'],
        container={
            'skills': [{
                'type': 'anthropic',
                'skill_id': 'docx',
                'version': 'latest'
            }]
        },
        messages=[{
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
        }],
        tools=[{
            'type': 'code_execution_20250825',
            'name': 'code_execution'
        }]
    )

    if progress_callback:
        progress_callback({'status': 'generating', 'progress': 70})

    # Extract file IDs
    file_ids = []
    for item in response.content:
        if item.type == 'bash_code_execution_tool_result':
            content_item = item.content
            if content_item.type == 'bash_code_execution_result':
                for file in content_item.content:
                    if hasattr(file, 'file_id'):
                        file_ids.append(file.file_id)

    if not file_ids:
        return {
            'success': False,
            'error': 'No file generated by skill'
        }

    # Download file
    file_id = file_ids[0]
    file_metadata = client.beta.files.retrieve_metadata(
        file_id=file_id,
        betas=["files-api-2025-04-14"]
    )
    file_content = client.beta.files.download(
        file_id=file_id,
        betas=["files-api-2025-04-14"]
    )

    # Save file
    output_dir = Path(file_path).parent
    output_path = output_dir / file_metadata.filename
    file_content.write_to_file(output_path)
    logger.info(f"Downloaded: {file_metadata.filename}")

    if progress_callback:
        progress_callback({'status': 'complete', 'progress': 100})

    # Calculate cost
    from cost_calculator import calculate_actual_cost
    cost = calculate_actual_cost(
        {
            'input_tokens': response.usage.input_tokens,
            'output_tokens': response.usage.output_tokens
        },
        settings.get('model')
    )

    return {
        'success': True,
        'output_path': str(output_path),
        'cost': cost
    }
