# Document Converter Design: Claude Vision + Built-in Skills

**Date:** 2025-10-28
**Status:** Approved
**Purpose:** Redesign PDF/image to Word converter using Claude Vision for OCR and built-in docx skill

## Executive Summary

Simplify converter architecture by leveraging:
1. **Claude Vision model** for superior OCR (vs pytesseract)
2. **Built-in docx skill** for Word document creation
3. **Single API call** for small documents (<90 pages, <25MB)
4. **15-page batching** for large documents with DOCX merging

**Key Benefit:** Higher quality OCR for scanned documents while removing custom skill complexity.

---

## Requirements

### User Context
- **Use Case:** Translation workflow (CAT tool input + client delivery)
- **Priority 1:** Clean text for CAT tools (no segmentation issues)
- **Priority 2:** Delivery-ready formatting (minimal cleanup after translation)
- **Priority 3:** Visual resemblance (~80-90%)

### Input Files
- PDFs (scanned or native)
- JPG/PNG images
- **All documents are scanned** - OCR critical

### Key Features to Preserve
- Page markers: `[Page X of the original]` at END of segments
- Signature replacement: Images → `[Signature]` text
- Custom instructions per conversion
- Settings UI: Font, margins, model selection
- Reading order: Double columns → left first, right below

---

## Architecture

### System Components

```
User Upload (PDF/JPG/PNG)
    ↓
Flask /api/convert
    ↓
converter.convert_document()
    ↓
Anthropic Messages API
  - Claude Vision (OCR)
  - docx skill (Word creation)
    ↓
Files API download
    ↓
Return .docx to user
```

### API Call Structure

```python
response = client.beta.messages.create(
    model=settings.get('model'),  # haiku-4.5 or sonnet-4.5
    max_tokens=16000,
    betas=[
        "code-execution-2025-08-25",
        "skills-2025-10-02",
        "files-api-2025-04-14"
    ],
    container={
        "skills": [{
            "type": "anthropic",
            "skill_id": "docx",
            "version": "latest"
        }]
    },
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": get_media_type(file_path),
                    "data": file_base64
                }
            },
            {"type": "text", "text": prompt}
        ]
    }],
    tools=[{
        "type": "code_execution_20250825",
        "name": "code_execution"
    }]
)
```

### What Changed
**Removed:**
- Custom skill upload (`upload_skill()`)
- pdf skill with pytesseract
- Code extraction logic (`extract_code_from_response()`)
- Node.js execution (`execute_generated_code()`)
- Custom skill ZIP file

**Simplified:**
- Single built-in skill (docx only)
- Claude Vision handles OCR natively
- Direct file download via Files API

---

## Model Selection

### Supported Models

| Model | API ID | Cost (per 1M tokens) | Use Case |
|-------|--------|---------------------|----------|
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 in / $5 out | Fast, budget conversions |
| **Sonnet 4.5** | `claude-sonnet-4-5-20250929` | $3 in / $15 out | **Default** - Best quality |

**Both models support:**
- Code execution tool
- Skills API
- Extended thinking
- Claude Vision (document OCR)

**Default:** Sonnet 4.5 for delivery-ready quality (user's priority #2)

---

## Prompt Design

### Vision-Optimized Conversion Prompt

```python
def build_prompt(settings: Dict[str, Any], file_name: str) -> str:
    prompt = f"""Convert this scanned document to professional Word (.docx) format.

## Document Settings
- Font: {settings.get('font', 'Arial')} {settings.get('fontSize', 12)}pt
- Margins: Top {margins.get('top', 1.0)}", Right {margins.get('right', 1.0)}",
           Bottom {margins.get('bottom', 1.0)}", Left {margins.get('left', 1.0)}"
- Output filename: {file_name}.docx

## Special Instructions
{conditional_features}

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
2. **Exact Font Sizes**: Reproduce font sizes as-is. DO NOT interpret
   larger text as "headings" - just match the visual size
3. **Complete Content**: All text, tables, images, signatures, headers, footers
4. **No Skipping**: Process entire document, every page
5. **No Adding**: Do not add titles, labels, or content not visible in source
6. **No Interpretation**: Do not summarize or reword

## LAYOUT & READING ORDER
**Structured extraction:**
- **Double columns**: Extract left column first, then right column below
  (linear reading order for CAT tools)
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
```

**Key Principles:**
- Focus on WHAT, not HOW (skill knows implementation)
- Emphasize vision model's context-aware reading
- Strong anti-hallucination rules
- CAT tool segmentation requirements
- Visual similarity targets

---

## Optimization Strategy

### API Constraints
- Max file size: 32MB
- Max pages: 100 per request
- Cost: ~1,500-3,000 tokens per page
- Image limit: 5MB each

### Processing Logic

```python
# Small documents (<90 pages, <25MB)
if should_split_document(file_path):
    convert_document_batched()  # See below
else:
    convert_document_simple()   # Single API call

def should_split_document(file_path: str) -> bool:
    file_size = os.path.getsize(file_path)
    if file_size > 25 * 1024 * 1024:  # 25MB (7MB buffer)
        return True

    if file_path.endswith('.pdf'):
        page_count = get_pdf_page_count(file_path)
        if page_count > 90:  # 10-page buffer
            return True

    return False
```

### Batch Processing (Large Documents)

**Strategy:** 15-page batches

**Why 15 pages?**
- Token usage: ~22,500-45,000 per batch (safe within context limits)
- Memory: Manageable for Claude Vision
- Progress: Frequent updates
- Recovery: Small batches = easier retry

**Workflow:**
1. Split PDF into 15-page chunks using pypdf
2. Convert each batch independently
3. Merge DOCX files using python-docx
4. Progress updates every 15 pages

```python
def convert_document_batched(file_path, settings, api_key):
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    batches = []

    # Create 15-page batches
    for i in range(0, total_pages, 15):
        batch_pages = reader.pages[i:i+15]
        batch_file = create_batch_pdf(batch_pages, i)
        batches.append(batch_file)

    # Convert each batch
    docx_files = []
    for idx, batch_file in enumerate(batches):
        progress_callback({
            'status': f'Processing pages {idx*15 + 1}-{min((idx+1)*15, total_pages)}',
            'progress': int((idx / len(batches)) * 90)
        })

        result = convert_document_simple(batch_file, settings, api_key)
        docx_files.append(result['output_path'])

    # Merge DOCX files
    merged_path = merge_docx_files(docx_files, file_name)
    return {'success': True, 'output_path': merged_path}
```

**DOCX Merging:**
```python
def merge_docx_files(docx_paths, output_name):
    from docx import Document

    merged = Document(docx_paths[0])

    for docx_path in docx_paths[1:]:
        sub_doc = Document(docx_path)
        merged.add_page_break()

        for element in sub_doc.element.body:
            merged.element.body.append(element)

    merged.save(f"{output_name}_merged.docx")
```

---

## File Handling

### Media Types
```python
def get_media_type(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    }
    return media_types.get(ext, 'application/pdf')
```

### Response Processing
1. Extract file_ids from `bash_code_execution_tool_result` blocks
2. Retrieve metadata: `client.beta.files.retrieve_metadata(file_id)`
3. Download content: `client.beta.files.download(file_id)`
4. Save: `file_content.write_to_file(output_path)`

### Error Handling
- **API Overload:** 3 retries with exponential backoff (2s, 4s, 8s)
- **Missing file_id:** Return error "No file generated by skill"
- **Large files:** Automatic batching (transparent to user)
- **User-friendly errors:** Clear messages for common issues

---

## Implementation Impact

### Files to Delete
- `image-to-docx-converter.zip` (custom skill)
- References to custom skill in converter.py
- `upload_skill()` function
- `extract_code_from_response()` function
- `execute_generated_code()` function
- Node.js execution logic

### Files to Modify
**converter.py:**
- Replace `build_prompt()` with vision-optimized version
- Simplify `convert_document()` - remove skill upload, code extraction
- Update container to use only docx skill
- Add `should_split_document()`, `convert_document_batched()`, `merge_docx_files()`
- Update beta flags: remove old, add files-api-2025-04-14

**requirements.txt:**
- Keep: `anthropic==0.71.0`, `httpx==0.27.2`
- Add: `pypdf==3.17.0` (for batch splitting)
- Add: `python-docx==1.1.0` (for DOCX merging)

**app.py:**
- No changes needed (Flask endpoints remain the same)

**config_manager.py:**
- Update model options: Haiku 4.5, Sonnet 4.5
- Update pricing for cost calculation

**static/app.js:**
- Update model dropdown options
- Add progress display for batch processing

---

## Testing Strategy

### Test Cases

1. **Small PDF (<90 pages):** Single API call path
2. **Large PDF (>90 pages):** Batch processing + merging
3. **JPG/PNG images:** Vision OCR quality
4. **Scanned documents:** Degraded quality handling
5. **Double columns:** Reading order verification
6. **Page markers:** Segment-safe placement
7. **Tables:** Structure preservation
8. **Signatures:** Replacement feature
9. **Custom instructions:** Prompt incorporation
10. **Model selection:** Haiku vs Sonnet quality/cost

### Success Criteria
- OCR accuracy: >95% for good scans, >80% for degraded
- CAT tool compatibility: No segmentation errors
- Visual similarity: 80-90% resemblance
- Processing time: <30s per page (Haiku), <60s per page (Sonnet)
- Batch merging: Seamless page transitions

---

## Dependencies

### Required Python Packages
```
flask==3.0.0
anthropic==0.71.0
httpx==0.27.2
pypdf==3.17.0
python-docx==1.1.0
python-magic==0.4.27
cryptography==41.0.7
filelock==3.13.1
```

### API Requirements
- Anthropic API key with Skills access
- Beta feature flags enabled

---

## Rollout Plan

1. **Phase 1:** Implement simplified converter (no batching)
2. **Phase 2:** Add batch processing for large documents
3. **Phase 3:** Test with real translation documents
4. **Phase 4:** Deploy to production

## Future Enhancements

- **Parallel batch processing:** Convert multiple 15-page batches concurrently
- **Progress streaming:** Real-time updates via WebSocket
- **Quality comparison:** A/B test Haiku vs Sonnet output
- **Custom batch size:** User-configurable (10-20 pages)
