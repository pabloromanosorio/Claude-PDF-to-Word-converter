# PDF to Word Converter - Python Flask Rebuild Design

**Date:** October 27, 2025
**Status:** Design Approved
**Author:** Claude Code with Pablo Roman

## Executive Summary

Complete rebuild of the PDF-to-Word converter application using Python + Flask + PyInstaller architecture, replacing the problematic Electron/React stack. This design maintains all existing features while solving corruption issues and simplifying the codebase.

**Key Changes:**
- **From:** Electron + React + electron-store → **To:** Python + Flask + JSON storage
- **From:** 2000+ lines of complex JavaScript → **To:** ~600 lines of clean Python
- **Distribution:** Installable .exe/.dmg files + source code on GitHub
- **Same user experience:** Double-click icon, browser opens automatically

## Background

### Problems with Current Implementation

1. **electron-store corruption:** Config files repeatedly corrupted, causing app crashes
2. **React complexity:** CDN loading issues, caching problems, browser compatibility
3. **Complex debugging:** Multi-layered architecture difficult to troubleshoot
4. **Large codebase:** Over 2000 lines across multiple files and frameworks

### User Requirements

- **Primary users:** Translators and colleagues with zero technical knowledge
- **Installation:** Must be as simple as double-clicking an icon
- **No terminal:** Users should never see command line interfaces
- **Documentation:** Crystal-clear instructions for every step
- **Cost transparency:** Clear pricing information (~$0.01-0.03 per page)

## Design Goals

1. **Simplicity:** Minimal dependencies, clean Python code
2. **Reliability:** No file corruption, proven technology stack
3. **Maintainability:** Easy to modify, test, and extend
4. **User-friendly:** Zero technical knowledge required
5. **Same features:** All existing functionality preserved
6. **Better docs:** Foolproof installation and usage guides

## Architecture Decision

### Chosen Approach: Python Flask + PyInstaller

**Why this approach:**
- Python is simpler to debug than Electron/Node.js
- Flask is battle-tested, minimal framework
- JSON file storage prevents corruption (no encryption library bugs)
- PyInstaller creates true native executables
- Smaller codebase (~600 vs 2000+ lines)
- Same user experience (double-click → app opens)

**Rejected alternatives:**
- Keep Electron but simplify: Still complex, same corruption risks
- Pure web app: Requires hosting, not suitable for local use with API keys
- Desktop GUI (tkinter): Browser UI more modern and flexible

## Technical Design

### Technology Stack

**Core:**
- Python 3.10+ (wider compatibility)
- Flask 3.0 (web server)
- Anthropic Python SDK (official API client)

**Supporting Libraries:**
- `pypdf` (PDF page extraction, not conversion)
- `python-magic` (file type detection)
- `cryptography` (Fernet for API key encryption)
- `filelock` (prevent config file corruption)

**Packaging:**
- PyInstaller 6.x (create .exe and .dmg)

**Frontend:**
- HTML5 + CSS3 + Vanilla JavaScript (no frameworks)

### File Structure

```
pdf-converter/
├── .gitignore                   # Ignore user data, cache
├── README.md                    # Main installation instructions
├── DOWNLOAD_INSTRUCTIONS.md     # Simple guide for end users
├── INSTALLATION.md              # Detailed setup (both methods)
├── requirements.txt             # Python dependencies
├── build_installers.py          # PyInstaller build script
│
├── app.py                       # Main Flask server (~150 lines)
├── converter.py                 # Claude API logic (~200 lines)
├── config_manager.py            # Settings storage (~80 lines)
│
├── docs/
│   ├── API_KEY_GUIDE.md        # How to get Anthropic API key
│   ├── BILLING_INFO.md         # Pay-as-you-go pricing details
│   ├── TROUBLESHOOTING.md      # Common issues & solutions
│   └── plans/                   # Design documents (this file)
│
├── skills/
│   └── image-to-docx-converter.zip  # Conversion skill package
│
├── static/
│   ├── index.html              # Main UI (~300 lines)
│   ├── style.css               # Modern styling
│   └── app.js                  # Frontend logic
│
└── .user-data/                 # Created at runtime, gitignored
    ├── config.json             # User settings & encrypted API key
    └── app.log                 # Debug logs (privacy-safe)
```

### Component Breakdown

#### 1. app.py (Flask Server)

**Responsibilities:**
- Start Flask server on localhost:5000
- Auto-open browser on startup
- Serve static files (HTML/CSS/JS)
- Provide API endpoints

**API Routes:**
```python
GET  /                          # Serve main UI
POST /api/upload                # Receive file for conversion
POST /api/convert               # Trigger conversion
GET  /api/settings              # Load user settings
POST /api/settings              # Save user settings
POST /api/skill-upload          # Upload skill to Anthropic (first run)
GET  /api/test-api-key          # Validate API key
```

**Auto-open browser:**
```python
def open_browser():
    """Open default browser after Flask starts"""
    webbrowser.open('http://localhost:5000')

if __name__ == '__main__':
    Timer(1, open_browser).start()
    app.run(host='127.0.0.1', port=5000)
```

#### 2. converter.py (Conversion Engine)

**Responsibilities:**
- Communicate with Anthropic API
- Handle Skills API integration
- Extract PDF pages (using pypdf)
- Generate conversion prompts
- Calculate costs
- Execute generated code

**Key Functions:**

```python
def upload_skill(api_key):
    """One-time upload of skill to user's Anthropic account"""
    # Read skills/image-to-docx-converter.zip
    # POST to Anthropic Skills API
    # Return skill_id for storage

def convert_document(file_path, settings, progress_callback):
    """Main conversion function"""
    # 1. Prepare file (extract pages if needed)
    # 2. Build verification prompt
    # 3. Call Anthropic API with skill
    # 4. Extract generated code
    # 5. Execute code to create .docx
    # 6. Calculate cost
    # 7. Return result

def extract_pages(pdf_path, page_range):
    """Extract specific pages from PDF (e.g., '1-3, 5')"""
    # Uses pypdf to create subset PDF
    # Saves tokens/cost by sending only needed pages

def calculate_cost(usage, model):
    """Calculate API cost from token usage"""
    # Model pricing per million tokens
    # Returns cost in dollars
```

**Anthropic API Call (with Skills):**

```python
response = client.messages.create(
    model=settings['model'],  # User-selected: haiku, sonnet, etc.
    max_tokens=16000,
    betas=["skills-2025-10-02"],  # Enable Skills API
    container={
        "skills": [{
            "type": "custom",
            "skill_id": config.get('skill_id'),
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
                    "data": file_to_base64(file_path)
                }
            },
            {
                "type": "text",
                "text": build_prompt(settings)
            }
        ]
    }]
)
```

**Enhanced Prompt (with Verification):**

```python
def build_prompt(settings):
    """Generate conversion prompt with anti-hallucination safeguards"""

    return f"""
Convert this document to professional Word format using the image-to-docx-converter skill.

## User Settings
- Font: {settings['font']}
- Size: {settings['fontSize']}pt
- Margins: Top {margins['top']}", Right {margins['right']}", Bottom {margins['bottom']}", Left {margins['left']}"
- Model: {settings['model']}

## Special Requests
{'- Replace signatures with [Signature]' if settings['replaceSignatures'] else ''}
{'- Add page markers at END of sentences after page breaks (for CAT tool segmentation)' if settings['addPageMarkers'] else ''}
{f"- Custom: {settings['customInstructions']}" if settings.get('customInstructions') else ''}

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
- Print "SUCCESS: {file_name}.docx" when complete
- Exit with process.exit(0) on success

The image-to-docx-converter skill provides detailed patterns - follow them exactly.
"""
```

#### 3. config_manager.py (Settings Storage)

**Responsibilities:**
- Store/retrieve user settings
- Encrypt/decrypt API key
- Manage skill_id
- Thread-safe file operations

**Security Features:**

```python
from cryptography.fernet import Fernet
from filelock import FileLock

class ConfigManager:
    def __init__(self):
        self.config_dir = Path.home() / '.pdf-converter'
        self.config_file = self.config_dir / 'config.json'
        self.lock = FileLock(self.config_file.with_suffix('.lock'))
        self.encryptor = Fernet(self._get_or_create_key())

    def save_api_key(self, key):
        """Encrypt and save API key"""
        encrypted = self.encryptor.encrypt(key.encode())
        with self.lock:  # Prevents corruption
            config = self._load_config()
            config['api_key'] = encrypted.decode()
            self._save_config(config)

    def get_api_key(self):
        """Decrypt and return API key"""
        config = self._load_config()
        encrypted = config.get('api_key')
        if not encrypted:
            return None
        return self.encryptor.decrypt(encrypted.encode()).decode()
```

**Config File Structure:**

```json
{
  "api_key": "encrypted_base64_string_here",
  "skill_id": "skill_abc123xyz",
  "skill_version": "2.1.0",
  "skill_updated_at": "2025-10-27T14:30:00",
  "settings": {
    "font": "Arial",
    "fontSize": 12,
    "margins": {
      "top": 1.0,
      "right": 1.0,
      "bottom": 1.0,
      "left": 1.0
    },
    "replaceSignatures": true,
    "addPageMarkers": true,
    "model": "claude-sonnet-4-5-20250929",
    "customInstructions": ""
  },
  "usage_stats": {
    "total_conversions": 15,
    "total_cost": 3.20,
    "last_conversion": "2025-10-27T14:25:00"
  }
}
```

#### 4. Frontend (HTML/CSS/JS)

**Main Interface (index.html):**

```html
<!DOCTYPE html>
<html>
<head>
    <title>PDF to Word Converter</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Welcome Screen (first run) -->
    <div id="welcome-screen" class="hidden">
        <h1>Welcome! 👋</h1>
        <p>Convert documents using Claude AI</p>

        <div class="info-box">
            <h3>💰 Pay-as-you-go pricing</h3>
            <p>~$0.01-0.03 per page</p>
            <p>You only pay for what you convert</p>
        </div>

        <button onclick="showApiKeySetup()">Get Started</button>
    </div>

    <!-- Main Interface -->
    <div id="main-interface">
        <header>
            <h1>PDF to Word Converter</h1>
            <button onclick="showSettings()">⚙️ Settings</button>
            <button onclick="showHelp()">? Help</button>
        </header>

        <div id="drop-zone">
            <p>📄 Drag & Drop PDF or Image Here</p>
            <p>or click to browse</p>
            <input type="file" id="file-input" accept=".pdf,.jpg,.jpeg,.png">
        </div>

        <div class="quick-settings">
            <select id="model-select">
                <option value="claude-haiku-4-5">Haiku (~$0.01/page)</option>
                <option value="claude-sonnet-4-5-20250929" selected>Sonnet (~$0.02/page)</option>
            </select>

            <select id="pages-select">
                <option value="all">All pages</option>
                <option value="custom">Custom range...</option>
            </select>

            <label>
                <input type="checkbox" id="page-markers" checked>
                Page markers
            </label>
        </div>

        <button id="convert-btn" class="primary" disabled>Convert Document</button>

        <div id="status-area"></div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

**Frontend Logic (app.js):**

```javascript
// Handle file upload
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    await uploadFile(file);
});

// Convert document
async function convertDocument() {
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('settings', JSON.stringify(getSettings()));

    const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
    });

    // Show progress updates
    const eventSource = new EventSource('/api/progress');
    eventSource.onmessage = (event) => {
        updateProgress(JSON.parse(event.data));
    };
}

// Download result
function downloadResult(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  User Double-Clicks Icon (PDF_Converter.exe/.app)       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  PyInstaller Bundle Starts                               │
│  - Unpacks Python + dependencies                         │
│  - Runs app.py (Flask server)                            │
│  - Opens browser to http://localhost:5000               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Browser Shows UI                                        │
│  - Welcome screen (if first run)                         │
│  - Main interface (if has API key)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ User uploads PDF
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Flask Backend (app.py)                                  │
│  POST /api/convert                                       │
│  - Receives file via multipart/form-data                │
│  - Calls converter.py                                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Converter (converter.py)                                │
│  1. Extract pages if needed (pypdf)                      │
│  2. Build verification prompt                            │
│  3. Call Anthropic API with skill                        │
│  4. Claude generates docx.js code                        │
│  5. Execute generated code                               │
│  6. Calculate cost                                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Flask Returns Result                                    │
│  - .docx file as blob                                    │
│  - Cost & metadata                                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Browser Downloads File                                  │
│  - User saves to desired location                        │
│  - Success message with cost displayed                   │
└─────────────────────────────────────────────────────────┘
```

## Skills API Integration

### Skill Upload Flow (First Run)

```python
# In converter.py

def upload_skill_to_user_account(api_key):
    """Upload skill to user's Anthropic account (one-time)"""

    # 1. Read skill package
    skill_path = Path(__file__).parent / 'skills' / 'image-to-docx-converter.zip'
    with open(skill_path, 'rb') as f:
        skill_data = f.read()

    # 2. Upload to Anthropic Skills API
    # Note: Exact API endpoint TBD - need to verify with Anthropic docs
    response = requests.post(
        'https://api.anthropic.com/v1/skills',
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'skills-2025-10-02'
        },
        files={'file': skill_data}
    )

    if not response.ok:
        # Fallback: Use embedded skill in prompt
        return None

    # 3. Store skill_id for future use
    result = response.json()
    skill_id = result['skill_id']

    config_manager.save({
        'skill_id': skill_id,
        'skill_version': '2.1.0',
        'skill_uploaded_at': datetime.now().isoformat()
    })

    return skill_id
```

### Skill vs Prompt Division

**In Skill (SKILL.md):**
- Structural patterns (when to use tables vs paragraphs)
- Professional quality standards
- Layout decision framework
- Verification checklist
- Code structure templates

**In Prompt (per conversion):**
- User settings (font, size, margins)
- Special requests (signatures, page markers)
- Custom instructions
- Anti-hallucination rules
- Completeness verification

This division allows:
- Skill handles "how to convert well"
- Prompt handles "what the user wants"

### Fallback Strategy

If skill upload/invocation fails:

```python
def convert_with_fallback(file_path, settings):
    """Try Skills API, fall back to embedded instructions"""

    skill_id = config_manager.get('skill_id')

    if skill_id:
        try:
            # Try with Skills API
            return convert_with_skill(file_path, settings, skill_id)
        except SkillInvocationError:
            logger.warning("Skills API failed, using embedded skill")

    # Fallback: Embed skill content in prompt
    skill_content = load_skill_from_zip()
    enhanced_prompt = f"{skill_content}\n\n{build_prompt(settings)}"
    return convert_with_embedded_skill(file_path, enhanced_prompt)
```

## Distribution Strategy

### For End Users (Non-Technical)

**GitHub Releases:**
- Windows: `PDF_Converter_Windows.exe` (~55 MB)
- Mac: `PDF_Converter_Mac.dmg` (~58 MB)

**Distribution Process:**

1. **Developer builds installers:**
```bash
python build_installers.py
# Creates installers/ folder with .exe and .dmg
```

2. **Upload to GitHub Releases:**
- Go to repository → Releases → Create new release
- Upload .exe and .dmg files
- GitHub auto-generates source code zip
- Publish release

3. **Users download:**
- Visit github.com/yourname/pdf-converter/releases
- Click Windows or Mac download link
- Install and run

**User Journey:**
```
1. Download .exe or .dmg from GitHub Releases
2. Double-click installer
3. Follow installation wizard
4. Click desktop shortcut
5. Browser opens with app
6. Follow welcome screen to set up API key
7. Start converting documents
```

### For Developers (Technical)

**Source Code Access:**
- Clone: `git clone https://github.com/yourname/pdf-converter.git`
- Download: GitHub → Code → Download ZIP

**Developer Setup:**
```bash
cd pdf-converter
pip install -r requirements.txt
python app.py
# Browser opens to localhost:5000
```

### Simple Landing Page

Host on GitHub Pages: `yourname.github.io/pdf-converter`

```html
<!DOCTYPE html>
<html>
<head>
    <title>PDF to Word Converter</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
        }
        .download-btn {
            display: inline-block;
            background: #5B67E8;
            color: white;
            padding: 15px 30px;
            margin: 10px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <h1>PDF to Word Converter</h1>
    <p>Convert PDFs to editable Word documents using AI</p>

    <h2>Download:</h2>
    <a href="releases/download/v2.0.0/PDF_Converter_Windows.exe" class="download-btn">
        🪟 Windows
    </a>
    <a href="releases/download/v2.0.0/PDF_Converter_Mac.dmg" class="download-btn">
        🍎 Mac
    </a>

    <p style="margin-top: 40px; color: #666;">
        ~$0.01-0.03 per page • Pay as you go
    </p>
</body>
</html>
```

## User Documentation

### Must-Have Documentation Files

1. **DOWNLOAD_INSTRUCTIONS.md** - Simple, foolproof download guide
2. **README.md** - Main installation and features overview
3. **INSTALLATION.md** - Detailed setup for both installers and source
4. **API_KEY_GUIDE.md** - Step-by-step API key setup with screenshots
5. **BILLING_INFO.md** - Anthropic billing, pay-as-you-go details
6. **TROUBLESHOOTING.md** - Common issues and solutions
7. **In-app help** - Contextual tooltips and help panel

### Documentation Principles

- **Assume zero technical knowledge**
- **Use screenshots for every step**
- **Numbered lists, not paragraphs**
- **Test with actual non-technical users before release**
- **Update based on user questions**

## Security & Privacy

### API Key Protection

```python
# Fernet encryption (AES-128)
from cryptography.fernet import Fernet

key = Fernet.generate_key()
cipher = Fernet(key)
encrypted = cipher.encrypt(api_key.encode())
```

Stored in: `~/.pdf-converter/config.json` (encrypted)

### Privacy Guarantees

✅ Documents sent ONLY to Anthropic API
✅ No storage on our servers (we have none!)
✅ No analytics, tracking, or telemetry
✅ API key stored only on user's computer
✅ All processing: local + Anthropic cloud

**We literally cannot see user documents or API keys.**

### .gitignore

```gitignore
# Never commit user data
.user-data/
config.json
*.log

# Python
__pycache__/
*.pyc
*.pyo
.pytest_cache/

# OS
.DS_Store
Thumbs.db

# Build artifacts
build/
dist/
*.egg-info/
installers/
```

## Testing Strategy

### Automated Tests

```python
# tests/test_converter.py
def test_pdf_conversion():
    result = convert_document('sample.pdf', default_settings)
    assert result['success'] == True
    assert result['cost'] > 0

def test_page_extraction():
    pages = extract_pages('sample.pdf', '1-3, 5')
    assert len(pages) == 4

def test_api_key_encryption():
    config.save_api_key('sk-ant-test123')
    retrieved = config.get_api_key()
    assert retrieved == 'sk-ant-test123'
```

### Pre-Release Checklist

```markdown
Before Each Release:

Installation:
- [ ] Windows .exe installs successfully
- [ ] Mac .dmg installs successfully
- [ ] Desktop shortcuts work
- [ ] Browser opens automatically
- [ ] First-run welcome screen appears

Conversion:
- [ ] PDF single page converts
- [ ] PDF multi-page converts
- [ ] JPG image converts
- [ ] PNG image converts
- [ ] Page selection works (e.g., "1-3, 5")
- [ ] Output quality 80%+ match
- [ ] Page markers at sentence boundaries
- [ ] No hallucinations detected

Settings:
- [ ] Model selection works
- [ ] Font/size changes applied
- [ ] Margins are editable
- [ ] All toggles work

Cost Tracking:
- [ ] Estimates shown before conversion
- [ ] Actual costs accurate (±10%)
- [ ] Running totals correct

Documentation:
- [ ] Download instructions clear
- [ ] API key setup works first try
- [ ] Billing info accurate
- [ ] Troubleshooting covers common issues

User Testing:
- [ ] 2-3 non-technical users can install
- [ ] Users complete setup without help
- [ ] Conversions work on first try
```

## Implementation Benefits

### Compared to Current Electron App

**Simplicity:**
- 600 lines of Python vs 2000+ lines of JavaScript
- No React, no webpack, no babel
- Standard library features instead of external packages

**Reliability:**
- JSON file storage (no corruption)
- FileLock prevents race conditions
- Proven Flask framework

**Maintainability:**
- Python easier to read/debug than JS/Node
- Fewer dependencies to manage
- Clear separation of concerns

**User Experience:**
- Same: Double-click icon → browser opens
- Faster: Python startup < Electron
- Smaller: 55MB vs 100MB+ Electron bundles

**Cost Accuracy:**
- ~$0.01-0.03 per page (was incorrectly $0.10-0.25)
- Real-time cost tracking
- Detailed usage history

## Must-Have Features Checklist

✅ Convert PDF/JPG/PNG to Word (.docx)
✅ Professional output (80-90% visual fidelity)
✅ Page selection for PDFs (e.g., "1-5, 7, 9-12")
✅ Cost tracking (real-time + totals)
✅ Model selection (Haiku, Sonnet, etc.)
✅ Auto-upload skill to user's account
✅ Skills API integration
✅ Font/size/margin settings
✅ Replace signatures with [Signature]
✅ Page markers at sentence boundaries
✅ First-run welcome + API key setup
✅ Encrypted API key storage
✅ Modern, clean UI
✅ Progress display
✅ Drag & drop upload
✅ Easy installation (.exe, .dmg)
✅ Desktop shortcuts
✅ Comprehensive documentation
✅ In-app help system

## Open Questions / Research Needed

1. **Skills API Upload Endpoint**
   - Need to verify exact API endpoint for skill upload
   - Check current Anthropic documentation
   - Test with sample skill package

2. **PyInstaller Mac Code Signing**
   - Do we need Apple Developer account ($99/year)?
   - Can users bypass "unidentified developer" warning easily?
   - Document workaround clearly

3. **Windows Code Signing**
   - SmartScreen warnings without certificate?
   - Document "Run anyway" process clearly

4. **Skills API Fallback**
   - Test embedded skill approach thoroughly
   - Measure token usage difference
   - Ensure quality parity

## Next Steps

1. ✅ **Design validated** - This document
2. ⏳ **Research Skills API** - Verify upload/invocation details
3. ⏳ **Create implementation plan** - Detailed task breakdown
4. ⏳ **Implement core** - app.py, converter.py, config_manager.py
5. ⏳ **Build UI** - HTML/CSS/JS frontend
6. ⏳ **Test thoroughly** - Pre-release checklist
7. ⏳ **Build installers** - PyInstaller for Windows + Mac
8. ⏳ **Create documentation** - All required docs
9. ⏳ **User testing** - 2-3 non-technical users
10. ⏳ **Release** - GitHub + installers

## Success Criteria

1. ✅ Non-technical users can install without help
2. ✅ API key setup clear and works first try
3. ✅ Conversions work reliably (>95% success rate)
4. ✅ Output quality matches current app (80-90% fidelity)
5. ✅ No file corruption issues
6. ✅ Codebase <1000 lines total
7. ✅ Documentation gets 5/5 clarity rating from users
8. ✅ Cost tracking accurate within ±10%

## Appendices

### A. Cost Estimate Breakdown

**Per Model, Per Page:**

| Model | Input ($/MTok) | Output ($/MTok) | Est. Cost/Page |
|-------|---------------|-----------------|----------------|
| Haiku 4.5 | $1.00 | $5.00 | ~$0.01 |
| Sonnet 4.5 | $3.00 | $15.00 | ~$0.02-0.03 |
| Sonnet 3.5 | $3.00 | $15.00 | ~$0.03 |

**Example Documents:**
- 1-page letter: $0.01-0.03
- 5-page contract: $0.05-0.15
- 20-page report: $0.20-0.60
- 100-page book: $1.00-3.00

### B. Skill Package Location

Current: `/skills/image-to-docx-converter.zip`

Contents:
- `SKILL.md` - Main skill definition
- `references/` - Additional documentation

Version tracking in config.json.

### C. Dependencies (requirements.txt)

```txt
flask==3.0.0
anthropic==0.27.0
pypdf==3.17.0
python-magic==0.4.27
cryptography==41.0.7
filelock==3.13.1
pyinstaller==6.3.0
```

### D. Build Script Example

```python
# build_installers.py
import PyInstaller.__main__
import platform

def build_windows():
    PyInstaller.__main__.run([
        'app.py',
        '--name=PDF_Converter',
        '--onefile',
        '--windowed',
        '--add-data=static:static',
        '--add-data=skills:skills',
        '--icon=assets/icon.ico'
    ])

def build_mac():
    PyInstaller.__main__.run([
        'app.py',
        '--name=PDF_Converter',
        '--onefile',
        '--windowed',
        '--add-data=static:static',
        '--add-data=skills:skills',
        '--icon=assets/icon.icns'
    ])

if __name__ == '__main__':
    if platform.system() == 'Windows':
        build_windows()
    elif platform.system() == 'Darwin':
        build_mac()
```
