# Vision + Skills Converter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild PDF/image to Word converter using Claude Vision for OCR and built-in docx skill, with page selection, prompt editing, simplified margins, and cost tracking.

**Architecture:** Single API call with Claude Vision (OCR) + docx skill (Word creation). 15-page batching for large documents. Flask backend with enhanced UI for page selection, prompt editing, and cost display.

**Tech Stack:** Python 3.10+, Flask, Anthropic API (Skills + Vision), pypdf (PDF splitting), python-docx (merging), JavaScript (UI enhancements)

---

## Task 1: Update Dependencies and Cleanup

**Files:**
- Modify: `requirements.txt`
- Delete: `image-to-docx-converter.zip`

**Step 1: Update requirements.txt**

Replace old dependencies with new ones:

```txt
flask==3.0.0
anthropic==0.71.0
httpx==0.27.2
pypdf==3.17.0
python-docx==1.1.0
python-magic==0.4.27
cryptography==41.0.7
filelock==3.13.1
pytest==7.4.3
```

**Step 2: Delete custom skill package**

```bash
rm image-to-docx-converter.zip
```

**Step 3: Install updated dependencies**

```bash
source venv/bin/activate
pip install -r requirements.txt
```

Expected: All packages install successfully

**Step 4: Commit**

```bash
git add requirements.txt
git rm image-to-docx-converter.zip
git commit -m "deps: update for vision+skills, remove custom skill"
```

---

## Task 2: Simplify Margins to Single Value

**Files:**
- Modify: `config_manager.py`
- Modify: `static/app.js`
- Modify: `static/index.html`

**Step 1: Update default settings in config_manager.py**

Find the `get_settings()` method and update margins structure:

```python
def get_settings(self) -> Dict[str, Any]:
    """Get user settings with defaults"""
    default_settings = {
        'font': 'Arial',
        'fontSize': 12,
        'margin': 1.0,  # Changed from margins object to single value
        'model': 'claude-sonnet-4-5-20250929',
        'replaceSignatures': False,
        'addPageMarkers': False,
        'customInstructions': ''
    }
    # ... rest of method
```

**Step 2: Update migration logic**

Add migration for old margin format in `get_settings()`:

```python
# After loading settings from file
if 'margins' in settings and 'margin' not in settings:
    # Migrate old format to new
    old_margins = settings.pop('margins')
    settings['margin'] = old_margins.get('top', 1.0)  # Use top as default
```

**Step 3: Update UI HTML**

In `static/index.html`, replace margin inputs:

```html
<!-- Replace the 4 margin inputs with single input -->
<div class="form-group">
  <label for="margin">Margin (inches, all sides):</label>
  <input type="number" id="margin" step="0.1" min="0.5" max="2.0">
</div>
```

**Step 4: Update JavaScript settings handling**

In `static/app.js`, update `loadSettings()` and `saveSettings()`:

```javascript
function loadSettings() {
    fetch('/api/settings')
        .then(response => response.json())
        .then(settings => {
            document.getElementById('font').value = settings.font || 'Arial';
            document.getElementById('fontSize').value = settings.fontSize || 12;
            document.getElementById('margin').value = settings.margin || 1.0;  // Single value
            document.getElementById('model').value = settings.model || 'claude-sonnet-4-5-20250929';
            // ... rest
        });
}

function saveSettings() {
    const settings = {
        font: document.getElementById('font').value,
        fontSize: parseInt(document.getElementById('fontSize').value),
        margin: parseFloat(document.getElementById('margin').value),  // Single value
        model: document.getElementById('model').value,
        // ... rest
    };
    // ... rest
}
```

**Step 5: Test settings migration**

```bash
# Start app
python app.py
# Open browser to http://localhost:5000
# Verify margin shows single value
# Change margin, save, reload - verify persistence
```

Expected: Single margin input works, old settings migrate correctly

**Step 6: Commit**

```bash
git add config_manager.py static/app.js static/index.html
git commit -m "feat: simplify margins to single value for all sides"
```

---

## Task 3: Add Page Selection Feature

**Files:**
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `static/style.css`
- Modify: `app.py`
- Modify: `converter.py`

**Step 1: Add page selector UI to index.html**

Add after file upload section:

```html
<div id="pageSelector" class="page-selector" style="display:none;">
  <h3>Page Selection</h3>
  <div class="form-group">
    <label>
      <input type="radio" name="pageMode" value="all" checked> All pages
    </label>
  </div>
  <div class="form-group">
    <label>
      <input type="radio" name="pageMode" value="range"> Specific pages/ranges
    </label>
    <input type="text" id="pageRange" placeholder="e.g., 1-5, 7, 9-12" disabled>
    <small>Format: 1-5, 7, 9-12 (comma-separated ranges)</small>
  </div>
  <p id="pageCount" class="page-count"></p>
</div>
```

**Step 2: Add CSS styling**

In `static/style.css`:

```css
.page-selector {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    margin: 15px 0;
}

.page-count {
    font-size: 0.9em;
    color: #666;
    margin-top: 10px;
}

#pageRange {
    margin-left: 10px;
    padding: 5px;
    width: 200px;
}

#pageRange:disabled {
    background: #e0e0e0;
}
```

**Step 3: Add JavaScript page detection**

In `static/app.js`, add after file upload handling:

```javascript
// Show page selector when PDF uploaded
document.getElementById('fileInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
        // Show page selector
        document.getElementById('pageSelector').style.display = 'block';

        // Get page count from backend
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/page-count', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        document.getElementById('pageCount').textContent =
            `Total pages: ${data.pageCount}`;
    } else {
        // Hide for images
        document.getElementById('pageSelector').style.display = 'none';
    }
});

// Enable/disable page range input
document.querySelectorAll('input[name="pageMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const rangeInput = document.getElementById('pageRange');
        rangeInput.disabled = this.value === 'all';
    });
});
```

**Step 4: Add page count endpoint in app.py**

Add new route:

```python
@app.route('/api/page-count', methods=['POST'])
def get_page_count():
    """Get PDF page count"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if not file.filename.endswith('.pdf'):
            return jsonify({'error': 'Not a PDF file'}), 400

        # Save temporarily
        temp_path = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf').name
        file.save(temp_path)

        # Get page count
        from pypdf import PdfReader
        reader = PdfReader(temp_path)
        page_count = len(reader.pages)

        os.unlink(temp_path)

        return jsonify({'pageCount': page_count})

    except Exception as e:
        logger.error(f"Page count error: {e}")
        return jsonify({'error': str(e)}), 500
```

**Step 5: Update convert endpoint to accept page range**

In `app.py`, modify `/api/convert` to accept page selection:

```python
@app.route('/api/convert', methods=['POST'])
def convert_file():
    try:
        # ... existing file upload handling ...

        # Get page range if provided
        page_range = request.form.get('pageRange', '')

        # Convert with page selection
        result = convert_document(
            str(file_path),
            settings,
            api_key,
            page_range=page_range  # New parameter
        )
        # ... rest
```

**Step 6: Add page extraction logic to converter.py**

Add helper function:

```python
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
```

**Step 7: Update convert_document signature**

```python
def convert_document(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    page_range: str = '',
    progress_callback: Optional[Callable] = None,
    client: Optional[Anthropic] = None
) -> Dict[str, Any]:
    """Convert document to Word format"""
    try:
        # Extract pages if range specified
        if page_range and file_path.endswith('.pdf'):
            file_path = extract_pages(file_path, page_range)

        # ... rest of conversion logic
```

**Step 8: Update JavaScript to send page range**

In `static/app.js`, update convert function:

```javascript
async function convertFile() {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Add page range if specified
    const pageMode = document.querySelector('input[name="pageMode"]:checked').value;
    if (pageMode === 'range') {
        const pageRange = document.getElementById('pageRange').value;
        formData.append('pageRange', pageRange);
    }

    // ... rest of conversion
}
```

**Step 9: Test page selection**

```bash
python app.py
# Upload multi-page PDF
# Verify page count shows
# Try "all pages" - converts all
# Try "1-3, 5" - converts only those pages
```

Expected: Page selector works, only selected pages convert

**Step 10: Commit**

```bash
git add static/ app.py converter.py
git commit -m "feat: add page selection for PDF conversion"
```

---

## Task 4: Add Prompt Editor UI

**Files:**
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `static/style.css`
- Modify: `app.py`
- Modify: `converter.py`

**Step 1: Add prompt editor section to HTML**

Add before conversion button:

```html
<div class="prompt-editor">
  <h3>Conversion Prompt
    <button id="togglePrompt" class="btn-secondary">Show/Edit</button>
  </h3>
  <div id="promptContainer" style="display:none;">
    <textarea id="promptEditor" rows="15"></textarea>
    <div class="prompt-actions">
      <button id="resetPrompt" class="btn-secondary">Reset to Default</button>
      <button id="savePrompt" class="btn-primary">Save Custom Prompt</button>
    </div>
    <p class="prompt-info">
      Custom prompt overrides default. Leave blank to use default prompt generation.
    </p>
  </div>
</div>
```

**Step 2: Add CSS styling**

In `static/style.css`:

```css
.prompt-editor {
    margin: 20px 0;
    padding: 15px;
    background: #f9f9f9;
    border-radius: 5px;
}

.prompt-editor h3 {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#promptEditor {
    width: 100%;
    padding: 10px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    border: 1px solid #ddd;
    border-radius: 3px;
    resize: vertical;
}

.prompt-actions {
    margin-top: 10px;
    display: flex;
    gap: 10px;
}

.prompt-info {
    font-size: 0.9em;
    color: #666;
    margin-top: 10px;
}

.btn-secondary {
    background: #6c757d;
    color: white;
    padding: 8px 15px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}

.btn-secondary:hover {
    background: #5a6268;
}
```

**Step 3: Add JavaScript for prompt editing**

In `static/app.js`:

```javascript
// Toggle prompt visibility
document.getElementById('togglePrompt').addEventListener('click', function() {
    const container = document.getElementById('promptContainer');
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
    this.textContent = isVisible ? 'Show/Edit' : 'Hide';

    if (!isVisible) {
        // Load current prompt when showing
        loadPrompt();
    }
});

// Load prompt (default or custom)
async function loadPrompt() {
    const response = await fetch('/api/prompt');
    const data = await response.json();
    document.getElementById('promptEditor').value = data.prompt;
}

// Save custom prompt
document.getElementById('savePrompt').addEventListener('click', async function() {
    const customPrompt = document.getElementById('promptEditor').value;

    const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({customPrompt: customPrompt})
    });

    if (response.ok) {
        alert('Custom prompt saved successfully!');
    } else {
        alert('Failed to save prompt');
    }
});

// Reset to default
document.getElementById('resetPrompt').addEventListener('click', async function() {
    if (!confirm('Reset to default prompt? This will remove your custom prompt.')) {
        return;
    }

    const response = await fetch('/api/prompt', {
        method: 'DELETE'
    });

    if (response.ok) {
        loadPrompt();
        alert('Reset to default prompt');
    }
});
```

**Step 4: Add prompt management to config_manager.py**

Add methods:

```python
def get_custom_prompt(self) -> Optional[str]:
    """Get custom prompt if saved"""
    config_file = self.config_dir / 'custom_prompt.txt'
    if config_file.exists():
        return config_file.read_text()
    return None

def save_custom_prompt(self, prompt: str):
    """Save custom prompt"""
    config_file = self.config_dir / 'custom_prompt.txt'
    config_file.write_text(prompt)

def delete_custom_prompt(self):
    """Delete custom prompt"""
    config_file = self.config_dir / 'custom_prompt.txt'
    if config_file.exists():
        config_file.unlink()
```

**Step 5: Add prompt endpoints to app.py**

```python
@app.route('/api/prompt', methods=['GET'])
def get_prompt():
    """Get current prompt (custom or default)"""
    try:
        custom_prompt = config_manager.get_custom_prompt()

        if custom_prompt:
            return jsonify({'prompt': custom_prompt, 'isCustom': True})
        else:
            # Generate default prompt with current settings
            from converter import build_prompt
            settings = config_manager.get_settings()
            default_prompt = build_prompt(settings, 'example')
            return jsonify({'prompt': default_prompt, 'isCustom': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/prompt', methods=['POST'])
def save_custom_prompt():
    """Save custom prompt"""
    try:
        data = request.get_json()
        custom_prompt = data.get('customPrompt', '').strip()

        if custom_prompt:
            config_manager.save_custom_prompt(custom_prompt)
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Empty prompt'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/prompt', methods=['DELETE'])
def delete_custom_prompt():
    """Delete custom prompt (reset to default)"""
    try:
        config_manager.delete_custom_prompt()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

**Step 6: Update converter to use custom prompt**

Modify `convert_document()` in `converter.py`:

```python
def convert_document(...):
    try:
        # ... setup code ...

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

        # ... rest of conversion
```

**Step 7: Test prompt editor**

```bash
python app.py
# Click "Show/Edit" - see default prompt
# Edit prompt, save - verify saved
# Convert document - verify custom prompt used
# Reset - verify back to default
```

Expected: Prompt editor works, custom prompts persist and override default

**Step 8: Commit**

```bash
git add static/ app.py converter.py config_manager.py
git commit -m "feat: add prompt editor with custom prompt support"
```

---

## Task 5: Implement Cost Estimation and Tracking

**Files:**
- Create: `cost_calculator.py`
- Modify: `converter.py`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `static/style.css`

**Step 1: Create cost calculator module**

Create `cost_calculator.py`:

```python
"""
Cost calculation for Claude API usage.
Handles both estimation (before conversion) and actual cost (after conversion).
"""

from typing import Dict, Tuple
from pathlib import Path

# Pricing per million tokens (input/output)
MODEL_PRICING = {
    'claude-haiku-4-5-20251001': {'input': 1.00, 'output': 5.00},
    'claude-sonnet-4-5-20250929': {'input': 3.00, 'output': 15.00},
}

# Token estimation constants
TOKENS_PER_PAGE_LOW = 1500   # Simple pages (mostly text)
TOKENS_PER_PAGE_HIGH = 3000  # Complex pages (tables, images)
TOKENS_PER_PAGE_AVG = 2250   # Average

OUTPUT_TOKENS_PER_PAGE_LOW = 2000
OUTPUT_TOKENS_PER_PAGE_HIGH = 4000
OUTPUT_TOKENS_PER_PAGE_AVG = 3000


def get_pdf_page_count(file_path: str) -> int:
    """Get page count from PDF"""
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    return len(reader.pages)


def estimate_cost_for_file(
    file_path: str,
    model: str,
    page_range: str = ''
) -> Dict[str, float]:
    """
    Estimate cost before conversion

    Returns:
        {
            'estimated_cost_low': float,
            'estimated_cost_high': float,
            'estimated_cost_avg': float,
            'page_count': int
        }
    """
    # Get page count
    if file_path.endswith('.pdf'):
        page_count = get_pdf_page_count(file_path)

        # If page range specified, count only selected pages
        if page_range:
            pages_to_convert = parse_page_range(page_range)
            page_count = len(pages_to_convert)
    else:
        # Images count as 1 page
        page_count = 1

    # Get pricing
    pricing = MODEL_PRICING.get(model, MODEL_PRICING['claude-sonnet-4-5-20250929'])

    # Calculate estimates (low, high, average)
    scenarios = [
        (TOKENS_PER_PAGE_LOW, OUTPUT_TOKENS_PER_PAGE_LOW),
        (TOKENS_PER_PAGE_HIGH, OUTPUT_TOKENS_PER_PAGE_HIGH),
        (TOKENS_PER_PAGE_AVG, OUTPUT_TOKENS_PER_PAGE_AVG)
    ]

    costs = []
    for input_per_page, output_per_page in scenarios:
        input_tokens = input_per_page * page_count
        output_tokens = output_per_page * page_count

        input_cost = (input_tokens / 1_000_000) * pricing['input']
        output_cost = (output_tokens / 1_000_000) * pricing['output']
        costs.append(input_cost + output_cost)

    return {
        'estimated_cost_low': round(costs[0], 4),
        'estimated_cost_high': round(costs[1], 4),
        'estimated_cost_avg': round(costs[2], 4),
        'page_count': page_count
    }


def calculate_actual_cost(usage: Dict[str, int], model: str) -> float:
    """
    Calculate actual cost after conversion

    Args:
        usage: {'input_tokens': int, 'output_tokens': int}
        model: Model name

    Returns:
        Cost in USD
    """
    pricing = MODEL_PRICING.get(model, MODEL_PRICING['claude-sonnet-4-5-20250929'])

    input_cost = (usage['input_tokens'] / 1_000_000) * pricing['input']
    output_cost = (usage['output_tokens'] / 1_000_000) * pricing['output']

    return round(input_cost + output_cost, 4)


def parse_page_range(page_range: str) -> set:
    """Parse page range string into set of page numbers"""
    pages = set()
    for part in page_range.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-')
            pages.update(range(int(start), int(end) + 1))
        else:
            pages.add(int(part))
    return pages
```

**Step 2: Add cost estimation endpoint**

In `app.py`:

```python
@app.route('/api/estimate-cost', methods=['POST'])
def estimate_cost():
    """Estimate cost before conversion"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        settings = config_manager.get_settings()
        page_range = request.form.get('pageRange', '')

        # Save file temporarily
        temp_path = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix).name
        file.save(temp_path)

        # Calculate estimate
        from cost_calculator import estimate_cost_for_file
        estimate = estimate_cost_for_file(
            temp_path,
            settings.get('model', 'claude-sonnet-4-5-20250929'),
            page_range
        )

        os.unlink(temp_path)

        return jsonify(estimate)

    except Exception as e:
        logger.error(f"Cost estimation error: {e}")
        return jsonify({'error': str(e)}), 500
```

**Step 3: Update convert endpoint to return actual cost**

In `app.py`, modify `/api/convert`:

```python
@app.route('/api/convert', methods=['POST'])
def convert_file():
    try:
        # ... existing conversion code ...

        if result['success']:
            return jsonify({
                'success': True,
                'filename': Path(result['output_path']).name,
                'actual_cost': result.get('cost', 0),  # Add actual cost
                'download_url': f"/api/download/{Path(result['output_path']).name}"
            })
        # ... error handling
```

**Step 4: Add cost display to UI**

In `static/index.html`, add before convert button:

```html
<div id="costEstimate" class="cost-display" style="display:none;">
  <h4>Estimated Cost</h4>
  <p>Pages to convert: <span id="estPages">0</span></p>
  <p>Low estimate: $<span id="estLow">0.00</span></p>
  <p>Average estimate: $<span id="estAvg">0.00</span></p>
  <p>High estimate: $<span id="estHigh">0.00</span></p>
</div>

<div id="actualCost" class="cost-display" style="display:none;">
  <h4>Actual Cost</h4>
  <p class="cost-value">$<span id="actualCostValue">0.00</span></p>
</div>
```

**Step 5: Add CSS for cost display**

In `static/style.css`:

```css
.cost-display {
    background: #e8f5e9;
    padding: 15px;
    border-radius: 5px;
    margin: 15px 0;
    border-left: 4px solid #4caf50;
}

.cost-display h4 {
    margin-top: 0;
    color: #2e7d32;
}

.cost-value {
    font-size: 1.5em;
    font-weight: bold;
    color: #1b5e20;
}
```

**Step 6: Add JavaScript for cost estimation**

In `static/app.js`:

```javascript
// Auto-estimate cost when file/pages change
async function updateCostEstimate() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Add page range if specified
    const pageMode = document.querySelector('input[name="pageMode"]:checked')?.value;
    if (pageMode === 'range') {
        const pageRange = document.getElementById('pageRange').value;
        formData.append('pageRange', pageRange);
    }

    const response = await fetch('/api/estimate-cost', {
        method: 'POST',
        body: formData
    });

    const estimate = await response.json();

    // Display estimate
    document.getElementById('estPages').textContent = estimate.page_count;
    document.getElementById('estLow').textContent = estimate.estimated_cost_low.toFixed(4);
    document.getElementById('estAvg').textContent = estimate.estimated_cost_avg.toFixed(4);
    document.getElementById('estHigh').textContent = estimate.estimated_cost_high.toFixed(4);
    document.getElementById('costEstimate').style.display = 'block';
}

// Trigger estimation on file change
document.getElementById('fileInput').addEventListener('change', updateCostEstimate);

// Trigger estimation on page range change
document.getElementById('pageRange').addEventListener('input',
    debounce(updateCostEstimate, 500)
);

// Show actual cost after conversion
function showActualCost(cost) {
    document.getElementById('actualCostValue').textContent = cost.toFixed(4);
    document.getElementById('actualCost').style.display = 'block';
}

// Update convert function to display actual cost
async function convertFile() {
    // ... existing conversion code ...

    const result = await response.json();
    if (result.success) {
        showActualCost(result.actual_cost);
        // ... rest of success handling
    }
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
```

**Step 7: Update converter to return cost**

In `converter.py`, ensure `convert_document()` returns cost:

```python
def convert_document(...):
    try:
        # ... conversion logic ...

        # Calculate actual cost
        from cost_calculator import calculate_actual_cost
        actual_cost = calculate_actual_cost(
            {
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens
            },
            settings.get('model')
        )

        return {
            'success': True,
            'output_path': str(output_path),
            'cost': actual_cost
        }
```

**Step 8: Test cost calculation**

```bash
python app.py
# Upload PDF - verify estimate appears
# Try different page ranges - verify estimate updates
# Convert document - verify actual cost shown
# Compare estimate vs actual
```

Expected: Cost estimates accurate within 20%, actual cost displays correctly

**Step 9: Commit**

```bash
git add cost_calculator.py app.py converter.py static/
git commit -m "feat: add cost estimation and actual cost tracking"
```

---

## Task 6: Rewrite Converter Core Logic

**Files:**
- Modify: `converter.py` (major rewrite)

**Step 1: Remove obsolete functions**

Delete these functions from `converter.py`:
- `upload_skill()`
- `extract_code_from_response()`
- `execute_generated_code()`

**Step 2: Update imports**

Replace imports at top of file:

```python
"""
PDF/Image to Word converter using Claude Vision + built-in docx skill.
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
```

**Step 3: Rewrite build_prompt with simplified margins**

Replace `build_prompt()`:

```python
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
```

**Step 4: Add helper functions**

Add these helper functions:

```python
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
            pages_to_extract.update(range(int(start)-1, int(end)))  # 0-indexed
        else:
            pages_to_extract.add(int(part)-1)  # 0-indexed

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
```

**Step 5: Rewrite convert_document (simple path)**

Replace `convert_document()`:

```python
def convert_document(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    page_range: str = '',
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
            return convert_document_batched(
                file_path, settings, api_key, progress_callback, client
            )

        # Simple conversion path
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
    """Simple conversion for small documents"""

    if progress_callback:
        progress_callback({'status': 'preparing', 'progress': 20})

    # Initialize client
    if client is None:
        client = Anthropic(api_key=api_key)

    # Prepare file
    file_base64 = file_to_base64(file_path)
    media_type = get_media_type(file_path)
    file_name = Path(file_path).stem

    # Build prompt (use custom if available)
    from config_manager import ConfigManager
    config_mgr = ConfigManager()
    custom_prompt = config_mgr.get_custom_prompt()

    if custom_prompt:
        prompt = custom_prompt.replace('{file_name}', file_name)
    else:
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
```

**Step 6: Test simple conversion**

```bash
python app.py
# Upload small PDF (<10 pages)
# Verify conversion works with new logic
# Check cost calculation
# Verify margins use single value
```

Expected: Simple conversion works, cost tracked, margins correct

**Step 7: Commit**

```bash
git add converter.py
git commit -m "refactor: rewrite converter core with vision+skills"
```

---

## Task 7: Implement Batch Processing for Large Documents

**Files:**
- Modify: `converter.py` (add batching logic)

**Step 1: Add batch document creation helper**

Add to `converter.py`:

```python
def create_batch_pdf(pages: list, start_idx: int) -> str:
    """Create temporary PDF from page list"""
    writer = PdfWriter()
    for page in pages:
        writer.add_page(page)

    temp_path = tempfile.mktemp(suffix=f'_batch_{start_idx}.pdf')
    with open(temp_path, 'wb') as f:
        writer.write(f)

    return temp_path
```

**Step 2: Add DOCX merging function**

```python
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
```

**Step 3: Implement batched conversion**

```python
def convert_document_batched(
    file_path: str,
    settings: Dict[str, Any],
    api_key: str,
    progress_callback: Optional[Callable] = None,
    client: Optional[Anthropic] = None
) -> Dict[str, Any]:
    """
    Convert large document in 15-page batches

    Args:
        file_path: Path to PDF file
        settings: User settings
        api_key: Anthropic API key
        progress_callback: Progress callback
        client: Optional client

    Returns:
        Conversion result dict
    """
    BATCH_SIZE = 15

    if client is None:
        client = Anthropic(api_key=api_key)

    # Split into batches
    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    batches = []

    logger.info(f"Splitting {total_pages} pages into {BATCH_SIZE}-page batches")

    for i in range(0, total_pages, BATCH_SIZE):
        batch_pages = reader.pages[i:i+BATCH_SIZE]
        batch_file = create_batch_pdf(batch_pages, i)
        batches.append(batch_file)

    # Convert each batch
    docx_files = []
    total_cost = 0.0
    file_name = Path(file_path).stem

    for idx, batch_file in enumerate(batches):
        start_page = idx * BATCH_SIZE + 1
        end_page = min((idx + 1) * BATCH_SIZE, total_pages)

        if progress_callback:
            progress = int((idx / len(batches)) * 90)
            progress_callback({
                'status': f'Processing pages {start_page}-{end_page}',
                'progress': progress
            })

        logger.info(f"Converting batch {idx+1}/{len(batches)}: pages {start_page}-{end_page}")

        # Convert batch
        result = convert_document_simple(
            batch_file,
            settings,
            api_key,
            progress_callback=None,  # Don't nest progress callbacks
            client=client
        )

        if not result['success']:
            # Clean up batch files
            for bf in batches:
                try:
                    os.unlink(bf)
                except:
                    pass
            return result

        docx_files.append(result['output_path'])
        total_cost += result.get('cost', 0)

        # Clean up batch PDF
        try:
            os.unlink(batch_file)
        except:
            pass

    # Merge DOCX files
    if progress_callback:
        progress_callback({'status': 'Merging documents', 'progress': 95})

    logger.info(f"Merging {len(docx_files)} DOCX files")
    merged_path = merge_docx_files(docx_files, file_name)

    if progress_callback:
        progress_callback({'status': 'Complete', 'progress': 100})

    return {
        'success': True,
        'output_path': merged_path,
        'cost': total_cost
    }
```

**Step 4: Add python-docx to requirements if missing**

Verify `requirements.txt` has:

```txt
python-docx==1.1.0
```

**Step 5: Test batch processing**

```bash
python app.py
# Upload large PDF (>100 pages) OR create test with 100+ pages
# Verify batching triggers
# Check progress updates show page ranges
# Verify merged document is correct
# Check total cost is sum of batch costs
```

Expected: Large documents batch automatically, merge seamlessly, cost accurate

**Step 6: Commit**

```bash
git add converter.py requirements.txt
git commit -m "feat: implement 15-page batching for large documents"
```

---

## Task 8: Update Model Selection UI

**Files:**
- Modify: `static/index.html`
- Modify: `config_manager.py`

**Step 1: Update model dropdown in HTML**

In `static/index.html`, update model select:

```html
<div class="form-group">
  <label for="model">Model:</label>
  <select id="model">
    <option value="claude-sonnet-4-5-20250929">Sonnet 4.5 (Best quality, $3/$15 per 1M tokens)</option>
    <option value="claude-haiku-4-5-20251001">Haiku 4.5 (Fast & cheap, $1/$5 per 1M tokens)</option>
  </select>
</div>
```

**Step 2: Update default model in config_manager**

In `config_manager.py`, update default:

```python
def get_settings(self) -> Dict[str, Any]:
    default_settings = {
        'font': 'Arial',
        'fontSize': 12,
        'margin': 1.0,
        'model': 'claude-sonnet-4-5-20250929',  # Sonnet 4.5 as default
        'replaceSignatures': False,
        'addPageMarkers': False,
        'customInstructions': ''
    }
    # ...
```

**Step 3: Test model selection**

```bash
python app.py
# Change model to Haiku
# Convert document
# Verify faster conversion, lower cost
# Change to Sonnet
# Verify higher quality, higher cost
```

Expected: Both models work, pricing reflects selection

**Step 4: Commit**

```bash
git add static/index.html config_manager.py
git commit -m "feat: update model selection to Haiku 4.5 and Sonnet 4.5"
```

---

## Task 9: Add Retry Logic for API Overload

**Files:**
- Modify: `converter.py`

**Step 1: Add retry logic to simple conversion**

In `convert_document_simple()`, wrap API call:

```python
# API call with retry logic
max_retries = 3
retry_delay = 2

for attempt in range(max_retries):
    try:
        response = client.beta.messages.create(...)
        break  # Success
    except Exception as e:
        error_str = str(e)
        if 'Overloaded' in error_str or 'overloaded' in error_str:
            if attempt < max_retries - 1:
                logger.warning(f"API overloaded, retrying in {retry_delay}s (attempt {attempt+1}/{max_retries})")
                import time
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            else:
                return {
                    'success': False,
                    'error': 'Anthropic API is currently overloaded. Please try again in a few moments.'
                }
        else:
            # Different error, re-raise
            raise
```

**Step 2: Test retry logic**

Manually test by temporarily causing overload (not realistic, but verify code path):

```bash
python app.py
# Normal conversion should work
# Code is defensive against overload
```

**Step 3: Commit**

```bash
git add converter.py
git commit -m "feat: add exponential backoff retry for API overload"
```

---

## Task 10: Integration Testing and Documentation

**Files:**
- Create: `tests/test_converter_integration.py`
- Update: `README.md`
- Create: `TESTING.md`

**Step 1: Create integration test**

Create `tests/test_converter_integration.py`:

```python
"""
Integration tests for vision+skills converter
"""

import os
import pytest
from pathlib import Path
from converter import (
    convert_document,
    should_split_document,
    extract_pages,
    build_prompt
)
from cost_calculator import estimate_cost_for_file

# Skip if no API key
pytestmark = pytest.mark.skipif(
    not os.getenv('ANTHROPIC_API_KEY'),
    reason="No API key available"
)


def test_small_pdf_conversion():
    """Test converting small PDF"""
    # Requires test PDF in tests/fixtures/
    test_file = Path(__file__).parent / 'fixtures' / 'test_small.pdf'
    if not test_file.exists():
        pytest.skip("Test file not available")

    settings = {
        'font': 'Arial',
        'fontSize': 12,
        'margin': 1.0,
        'model': 'claude-haiku-4-5-20251001',
        'replaceSignatures': False,
        'addPageMarkers': False,
        'customInstructions': ''
    }

    result = convert_document(
        str(test_file),
        settings,
        os.getenv('ANTHROPIC_API_KEY')
    )

    assert result['success'] == True
    assert Path(result['output_path']).exists()
    assert result['cost'] > 0


def test_page_extraction():
    """Test page range extraction"""
    test_file = Path(__file__).parent / 'fixtures' / 'test_multi.pdf'
    if not test_file.exists():
        pytest.skip("Test file not available")

    extracted = extract_pages(str(test_file), '1-3, 5')
    assert Path(extracted).exists()

    from pypdf import PdfReader
    reader = PdfReader(extracted)
    assert len(reader.pages) == 4  # Pages 1,2,3,5


def test_cost_estimation():
    """Test cost estimation"""
    test_file = Path(__file__).parent / 'fixtures' / 'test_small.pdf'
    if not test_file.exists():
        pytest.skip("Test file not available")

    estimate = estimate_cost_for_file(
        str(test_file),
        'claude-sonnet-4-5-20250929'
    )

    assert 'estimated_cost_low' in estimate
    assert 'estimated_cost_high' in estimate
    assert estimate['estimated_cost_low'] < estimate['estimated_cost_high']
    assert estimate['page_count'] > 0


def test_prompt_building():
    """Test prompt generation"""
    settings = {
        'font': 'Arial',
        'fontSize': 12,
        'margin': 1.0,
        'replaceSignatures': True,
        'addPageMarkers': True,
        'customInstructions': 'Test instruction'
    }

    prompt = build_prompt(settings, 'test_doc')

    assert 'Arial' in prompt
    assert '1.0" on all sides' in prompt
    assert '[Signature]' in prompt
    assert '[Page X of the original]' in prompt
    assert 'Test instruction' in prompt


def test_batching_detection():
    """Test batching logic"""
    # Would need large test file or mock
    # For now, test function exists
    assert callable(should_split_document)
```

**Step 2: Create testing documentation**

Create `TESTING.md`:

```markdown
# Testing Guide

## Running Tests

```bash
# Install dev dependencies
pip install -r requirements.txt

# Run all tests
pytest tests/ -v

# Run with API key (integration tests)
ANTHROPIC_API_KEY=your-key pytest tests/ -v

# Run specific test
pytest tests/test_converter_integration.py::test_small_pdf_conversion -v
```

## Test Coverage

- **Unit Tests:** Cost calculation, prompt building, page extraction
- **Integration Tests:** Full conversion with API (requires key)
- **Manual Tests:** UI features, batch processing, error handling

## Test Fixtures

Place test PDFs in `tests/fixtures/`:
- `test_small.pdf` (1-5 pages)
- `test_multi.pdf` (10+ pages)
- `test_large.pdf` (100+ pages for batching)

## Cost Considerations

Integration tests consume API tokens. Use Haiku model for testing:

```python
settings = {'model': 'claude-haiku-4-5-20251001'}
```

## Manual Testing Checklist

- [ ] Upload PDF - page count shows
- [ ] Select page range - only selected pages convert
- [ ] Upload image - converts successfully
- [ ] Edit prompt - custom prompt used
- [ ] Cost estimate - appears and updates
- [ ] Actual cost - shown after conversion
- [ ] Large document (100+ pages) - batches correctly
- [ ] Change model - Haiku vs Sonnet works
- [ ] Simplified margins - single value applies to all sides
```

**Step 3: Update README**

Update `README.md` with new features:

```markdown
# PDF/Image to Word Converter

Convert scanned PDFs and images to editable Word documents using Claude's Vision and Skills API.

## Features

- **Superior OCR:** Claude Vision model outperforms traditional OCR
- **Page Selection:** Convert specific pages or ranges
- **Prompt Editing:** View and customize conversion prompt
- **Cost Tracking:** Estimated and actual API costs
- **Batch Processing:** Automatic 15-page batching for large documents
- **Model Selection:** Choose Haiku (fast/cheap) or Sonnet (best quality)

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set API key
export ANTHROPIC_API_KEY=your-key

# Run app
python app.py

# Open browser
http://localhost:5000
```

## New Features (v2.0)

### Page Selection
- Select specific pages: "1-5, 7, 9-12"
- Convert only what you need
- Reduces cost for large documents

### Prompt Editor
- View default conversion prompt
- Edit and save custom prompts
- Reset to default anytime

### Simplified Margins
- Single margin value for all sides
- Easier configuration
- Migrates old 4-value format

### Cost Tracking
- **Estimated cost** before conversion (low/avg/high)
- **Actual cost** after conversion
- Per-page cost breakdown

### Model Selection
- **Haiku 4.5:** Fast, economical ($1/$5 per 1M tokens)
- **Sonnet 4.5:** Best quality ($3/$15 per 1M tokens)

## Architecture

- **Backend:** Python Flask
- **OCR:** Claude Vision (multimodal LLM)
- **Word Generation:** Anthropic docx skill
- **Batching:** pypdf (splitting), python-docx (merging)

## Testing

See [TESTING.md](TESTING.md) for details.

```bash
pytest tests/ -v
```

## Cost Optimization

- Use Haiku for high-volume work
- Select specific pages when possible
- Estimated cost shown before conversion
```

**Step 4: Run tests**

```bash
pytest tests/ -v
```

Expected: Tests pass (or skip if no fixtures/API key)

**Step 5: Commit**

```bash
git add tests/ TESTING.md README.md
git commit -m "docs: add integration tests and updated documentation"
```

---

## Task 11: Final Cleanup and Verification

**Files:**
- Delete obsolete files
- Verify all changes

**Step 1: Remove obsolete code**

```bash
# Verify custom skill ZIP already deleted
# Remove any test-electron.js or old Node.js files if present
find . -name "*.js" -path "./node_modules" -prune -o -name "test-*.js" -print
```

**Step 2: Verify all features work**

Manual testing checklist:

```bash
python app.py

# Test each feature:
1. [ ] Upload PDF - page count appears
2. [ ] Select pages "1-3" - only those pages convert
3. [ ] Cost estimate - shows before conversion
4. [ ] Actual cost - shows after conversion
5. [ ] Edit prompt - custom prompt saves and applies
6. [ ] Reset prompt - back to default
7. [ ] Change to Haiku - faster, cheaper
8. [ ] Change to Sonnet - better quality
9. [ ] Simplified margins - single value works
10. [ ] Upload image (JPG) - converts successfully
11. [ ] Large PDF (>90 pages) - batches automatically
12. [ ] Page markers - appear at sentence ends
13. [ ] Signature replacement - works if enabled
```

**Step 3: Final commit**

```bash
git status
# Verify all changes committed
git log --oneline -10
# Review recent commits
```

**Step 4: Update changelog**

Create or update `CHANGELOG.md`:

```markdown
# Changelog

## [2.0.0] - 2025-10-28

### Added
- **Claude Vision OCR:** Superior OCR using multimodal LLM (vs pytesseract)
- **Page Selection:** Select specific pages/ranges for conversion
- **Prompt Editor:** View, edit, and save custom conversion prompts
- **Cost Tracking:** Estimated cost (before) and actual cost (after)
- **Simplified Margins:** Single margin value for all sides
- **Model Selection:** Choose Haiku 4.5 (fast/cheap) or Sonnet 4.5 (quality)
- **Batch Processing:** Automatic 15-page batching for large documents
- **Built-in docx Skill:** Uses Anthropic's built-in skill (no custom upload)

### Changed
- **Architecture:** Simplified from custom skill to built-in docx skill
- **OCR Method:** Claude Vision instead of pdf skill's pytesseract
- **API Structure:** Single API call with Vision + docx skill
- **Margins:** Migrated from 4 values to 1 value

### Removed
- Custom skill upload logic
- pdf skill dependency (pytesseract)
- Node.js code execution
- Complex code extraction logic

### Fixed
- Better OCR accuracy for degraded scans
- Improved cost calculation per page
- More reliable batch merging

## [1.0.0] - Previous version
- Electron app with custom skill
- Basic PDF to DOCX conversion
```

**Step 5: Final commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add v2.0 changelog"
```

**Step 6: Verify git history is clean**

```bash
git log --oneline --graph -15
```

Expected: Clean commit history with descriptive messages

---

## Task 12: Easy Installation and Desktop Launcher

**Files:**
- Create: `start.command` (Mac)
- Create: `start.bat` (Windows)
- Create: `INSTALL.md`
- Update: `README.md`

**Step 1: Create Mac launcher script**

Create `start.command`:

```bash
#!/bin/bash
# PDF Converter Launcher for Mac

cd "$(dirname "$0")"

echo "🚀 Starting PDF to Word Converter..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check/create venv
if [ ! -d "venv" ]; then
    echo "📦 Setting up environment (first time only)..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check API key
if [ ! -f "$HOME/.pdf-converter/config.json" ]; then
    echo ""
    echo "⚠️  No API key configured yet."
    echo "   The app will prompt you to enter it on first use."
    echo ""
fi

# Start app
echo "✅ Starting app on http://localhost:5000"
echo "   Your browser will open automatically..."
echo ""
python app.py

read -p "Press Enter to exit..."
```

**Step 2: Make launcher executable**

```bash
chmod +x start.command
```

**Step 3: Create Windows launcher**

Create `start.bat`:

```batch
@echo off
title PDF to Word Converter

cd /d "%~dp0"

echo.
echo Starting PDF to Word Converter...
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

REM Check/create venv
if not exist "venv" (
    echo Setting up environment ^(first time only^)...
    python -m venv venv
    call venv\Scripts\activate
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

REM Check API key
if not exist "%USERPROFILE%\.pdf-converter\config.json" (
    echo.
    echo No API key configured yet.
    echo The app will prompt you to enter it on first use.
    echo.
)

REM Start app
echo Starting app on http://localhost:5000
echo Your browser will open automatically...
echo.
python app.py

pause
```

**Step 4: Create installation guide**

Create `INSTALL.md`:

```markdown
# Installation Guide

## Quick Start (Easiest)

### Mac
1. Download/clone this repository
2. Double-click `start.command`
3. Enter your Anthropic API key when prompted
4. Start converting!

### Windows
1. Download/clone this repository
2. Double-click `start.bat`
3. Enter your Anthropic API key when prompted
4. Start converting!

**First launch:** Automatically installs dependencies (takes 1-2 minutes)

## Requirements

- **Python 3.10+** ([Download](https://www.python.org/downloads/))
- **Anthropic API Key** ([Get one](https://console.anthropic.com/))

## Manual Installation

If launchers don't work:

```bash
# 1. Create virtual environment
python3 -m venv venv

# 2. Activate (Mac/Linux)
source venv/bin/activate

# OR Activate (Windows)
venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set API key
export ANTHROPIC_API_KEY=your-key-here

# 5. Run app
python app.py

# 6. Open browser
# http://localhost:5000
```

## Creating Desktop Shortcut

### Mac
1. Right-click `start.command`
2. Select "Make Alias"
3. Drag alias to Desktop or Applications

### Windows
1. Right-click `start.bat`
2. Select "Create Shortcut"
3. Move shortcut to Desktop
4. (Optional) Right-click shortcut → Properties → Change Icon

## Troubleshooting

**"Permission denied" on Mac:**
```bash
chmod +x start.command
```

**"Python not found":**
- Install Python 3.10+ from python.org
- Make sure it's in your PATH

**"API key error":**
- Get key from console.anthropic.com
- Enter in app's Settings page

**Port 5000 already in use:**
- Close other apps using port 5000
- Or edit `app.py` to use different port

## Uninstall

Delete the folder. Config/API key stored in:
- Mac: `~/.pdf-converter/`
- Windows: `%USERPROFILE%\.pdf-converter\`
```

**Step 5: Update README with installation section**

In `README.md`, replace Quick Start section:

```markdown
## Installation

### Super Easy (Recommended)

**Mac:** Double-click `start.command`
**Windows:** Double-click `start.bat`

That's it! First launch automatically installs dependencies.

See [INSTALL.md](INSTALL.md) for detailed instructions and troubleshooting.

### Manual Installation

```bash
python3 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your-key
python app.py
```

Open http://localhost:5000
```

**Step 6: Test launchers**

```bash
# Mac
./start.command

# Should:
# - Create venv if missing
# - Install dependencies
# - Start app
# - Open browser

# Windows (in Command Prompt)
start.bat

# Should do same on Windows
```

Expected: App starts with one double-click, browser opens automatically

**Step 7: Test desktop shortcut**

```bash
# Mac: Create alias, move to Desktop, double-click
# Windows: Create shortcut, move to Desktop, double-click
```

Expected: Works from desktop

**Step 8: Update app.py to auto-open browser**

Verify `app.py` has browser auto-open (should already exist):

```python
from threading import Timer
import webbrowser

def open_browser():
    webbrowser.open('http://127.0.0.1:5000')

if __name__ == '__main__':
    Timer(1, open_browser).start()
    app = create_app()
    app.run(host='127.0.0.1', port=5000, debug=False)
```

**Step 9: Commit**

```bash
git add start.command start.bat INSTALL.md README.md app.py
git commit -m "feat: add one-click launchers and installation guide"
```

---

## Plan Complete!

**Summary of Changes:**

1. ✅ Updated dependencies (pypdf, python-docx, anthropic 0.71.0)
2. ✅ Simplified margins to single value
3. ✅ Added page selection feature
4. ✅ Added prompt editor with custom prompt support
5. ✅ Implemented cost estimation and actual cost tracking
6. ✅ Rewrote converter core with Vision + docx skill
7. ✅ Implemented 15-page batching for large documents
8. ✅ Updated model selection (Haiku 4.5, Sonnet 4.5)
9. ✅ Added retry logic for API overload
10. ✅ Created integration tests and documentation
11. ✅ Final cleanup and verification
12. ✅ Easy installation with one-click launchers

**Files Modified:**
- `requirements.txt` - Updated dependencies
- `config_manager.py` - Simplified margins, prompt management
- `converter.py` - Complete rewrite with Vision+skills
- `cost_calculator.py` - New module for cost tracking
- `app.py` - New endpoints for page count, cost, prompt
- `static/index.html` - UI for page selection, prompt editor, cost display
- `static/app.js` - JavaScript for new features
- `static/style.css` - Styling for new components
- `tests/test_converter_integration.py` - Integration tests
- `README.md` - Updated documentation
- `TESTING.md` - New testing guide
- `CHANGELOG.md` - Version 2.0 changes
- `start.command` - Mac one-click launcher
- `start.bat` - Windows one-click launcher
- `INSTALL.md` - Installation guide

**Files Deleted:**
- `image-to-docx-converter.zip` - Custom skill package

**Total Tasks:** 12 major tasks
**Estimated Time:** 3-4 hours for experienced developer

---

**Plan saved to:** `docs/plans/2025-10-28-vision-skills-implementation.md`

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
