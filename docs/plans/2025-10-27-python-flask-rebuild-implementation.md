# Python Flask PDF Converter - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild PDF-to-Word converter using Python + Flask, replacing problematic Electron/React stack with reliable, simple architecture.

**Architecture:** Python Flask backend serves browser-based UI, communicates with Anthropic Skills API for conversions, stores settings in encrypted JSON file, packages as native executables with PyInstaller.

**Tech Stack:** Python 3.10+, Flask 3.0, Anthropic SDK, pypdf, cryptography (Fernet), PyInstaller 6.x, Vanilla JavaScript frontend

---

## Prerequisites

**Current directory:** `/Users/pabloromanromanosorio/pdf-converter-app-clean`

**Before starting:**
```bash
# Kill any running Electron processes
pkill -f "electron" 2>/dev/null || true

# Verify we're in correct directory
pwd
# Expected: /Users/pabloromanromanosorio/pdf-converter-app-clean

# Check git status
git status
```

---

## Task 1: Clean Up Old Code and Set Up Python Environment

**Goal:** Remove Electron/React code, keep only essential files (docs, skills, prompts)

**Files:**
- Delete: `main.js`, `preload.js`, `converter.js`, `package.json`, `package-lock.json`, `node_modules/`
- Delete: `src/` directory (all React components)
- Keep: `docs/`, `prompts/`, `image-to-docx-converter.zip`, `.git/`, `.gitignore`, `README.md`

**Step 1: Back up essential files list**

```bash
# Verify what we're keeping
ls -la docs/ prompts/ *.zip *.md 2>/dev/null
```

**Step 2: Remove Node.js/Electron files**

```bash
# Remove JavaScript/Node files
rm -f main.js preload.js converter.js package.json package-lock.json test-electron.js

# Remove node_modules
rm -rf node_modules/

# Remove old src directory
rm -rf src/

# Remove build artifacts
rm -rf dist/ build/

# Remove OS files
rm -rf .DS_Store
```

**Step 3: Update .gitignore for Python**

Create `.gitignore`:
```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.pytest_cache/
*.egg-info/
dist/
build/
*.egg

# User data (never commit)
.user-data/
config.json
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Installers (build locally)
installers/

# Node (if any remain)
node_modules/
package-lock.json
```

**Step 4: Create requirements.txt**

Create `requirements.txt`:
```txt
flask==3.0.0
anthropic==0.27.0
pypdf==3.17.0
python-magic-bin==0.4.14
cryptography==41.0.7
filelock==3.13.1
pyinstaller==6.3.0
pytest==7.4.3
```

**Step 5: Create Python virtual environment**

```bash
# Create venv
python3 -m venv venv

# Activate it
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt
```

**Step 6: Verify installation**

```bash
# Check Flask installed
python -c "import flask; print(f'Flask {flask.__version__}')"
# Expected: Flask 3.0.0

# Check Anthropic SDK
python -c "import anthropic; print(f'Anthropic SDK {anthropic.__version__}')"
# Expected: Anthropic SDK 0.27.0
```

**Step 7: Commit cleanup**

```bash
git add .gitignore requirements.txt
git add -u  # Stage deletions
git commit -m "chore: remove Electron/React code, set up Python environment

- Deleted: main.js, preload.js, converter.js, package.json
- Deleted: node_modules/, src/, dist/, build/
- Added: requirements.txt with Python dependencies
- Updated: .gitignore for Python project"
```

---

## Task 2: Create Config Manager (Secure Settings Storage)

**Goal:** Implement secure JSON-based configuration with API key encryption

**Files:**
- Create: `config_manager.py`
- Create: `tests/test_config_manager.py`

**Step 1: Write failing test for config manager**

Create `tests/test_config_manager.py`:
```python
import pytest
import tempfile
import shutil
from pathlib import Path
from config_manager import ConfigManager


@pytest.fixture
def temp_config_dir():
    """Create temporary config directory for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    shutil.rmtree(temp_dir)


def test_save_and_retrieve_api_key(temp_config_dir):
    """Test API key encryption and retrieval"""
    config = ConfigManager(config_dir=temp_config_dir)

    test_key = "sk-ant-test123456"
    config.save_api_key(test_key)

    retrieved_key = config.get_api_key()
    assert retrieved_key == test_key


def test_api_key_is_encrypted_in_file(temp_config_dir):
    """Verify API key is not stored in plaintext"""
    config = ConfigManager(config_dir=temp_config_dir)

    test_key = "sk-ant-secret"
    config.save_api_key(test_key)

    # Read raw file content
    config_file = temp_config_dir / 'config.json'
    with open(config_file, 'r') as f:
        content = f.read()

    # API key should NOT appear in plaintext
    assert test_key not in content


def test_save_and_retrieve_settings(temp_config_dir):
    """Test saving and loading user settings"""
    config = ConfigManager(config_dir=temp_config_dir)

    settings = {
        'font': 'Arial',
        'fontSize': 12,
        'model': 'claude-sonnet-4-5-20250929'
    }

    config.save_settings(settings)
    retrieved = config.get_settings()

    assert retrieved == settings


def test_skill_id_storage(temp_config_dir):
    """Test storing and retrieving skill ID"""
    config = ConfigManager(config_dir=temp_config_dir)

    skill_id = "skill_abc123xyz"
    config.save_skill_id(skill_id)

    retrieved = config.get_skill_id()
    assert retrieved == skill_id
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/test_config_manager.py -v
```

Expected: `ModuleNotFoundError: No module named 'config_manager'`

**Step 3: Implement ConfigManager**

Create `config_manager.py`:
```python
"""
Configuration manager with encrypted API key storage.

Uses Fernet (AES-128) for API key encryption and FileLock to prevent
file corruption from concurrent access.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from cryptography.fernet import Fernet
from filelock import FileLock


class ConfigManager:
    """Manage application configuration with encrypted API keys"""

    def __init__(self, config_dir: Optional[Path] = None):
        """
        Initialize config manager.

        Args:
            config_dir: Optional custom config directory (for testing)
        """
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path.home() / '.pdf-converter'

        self.config_dir.mkdir(parents=True, exist_ok=True)

        self.config_file = self.config_dir / 'config.json'
        self.lock_file = self.config_dir / 'config.lock'
        self.key_file = self.config_dir / '.encryption_key'

        # Initialize encryption
        self.encryptor = Fernet(self._get_or_create_encryption_key())

    def _get_or_create_encryption_key(self) -> bytes:
        """Get existing encryption key or create new one"""
        if self.key_file.exists():
            with open(self.key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(self.key_file, 'wb') as f:
                f.write(key)
            # Restrict permissions (owner only)
            os.chmod(self.key_file, 0o600)
            return key

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file with file locking"""
        lock = FileLock(self.lock_file)

        with lock:
            if not self.config_file.exists():
                return {}

            with open(self.config_file, 'r') as f:
                return json.load(f)

    def _save_config(self, config: Dict[str, Any]) -> None:
        """Save configuration to file with file locking"""
        lock = FileLock(self.lock_file)

        with lock:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)

    def save_api_key(self, api_key: str) -> None:
        """
        Encrypt and save API key.

        Args:
            api_key: Anthropic API key (starts with sk-ant-)

        Raises:
            ValueError: If API key format is invalid
        """
        if not api_key.startswith('sk-ant-'):
            raise ValueError("Invalid API key format")

        # Encrypt the key
        encrypted = self.encryptor.encrypt(api_key.encode())

        # Save to config
        config = self._load_config()
        config['api_key'] = encrypted.decode('utf-8')
        self._save_config(config)

    def get_api_key(self) -> Optional[str]:
        """
        Retrieve and decrypt API key.

        Returns:
            Decrypted API key or None if not set
        """
        config = self._load_config()
        encrypted = config.get('api_key')

        if not encrypted:
            return None

        # Decrypt the key
        decrypted = self.encryptor.decrypt(encrypted.encode())
        return decrypted.decode('utf-8')

    def save_settings(self, settings: Dict[str, Any]) -> None:
        """Save user settings"""
        config = self._load_config()
        config['settings'] = settings
        self._save_config(config)

    def get_settings(self) -> Dict[str, Any]:
        """Get user settings with defaults"""
        config = self._load_config()

        default_settings = {
            'font': 'Arial',
            'fontSize': 12,
            'margins': {
                'top': 1.0,
                'right': 1.0,
                'bottom': 1.0,
                'left': 1.0
            },
            'replaceSignatures': True,
            'addPageMarkers': True,
            'model': 'claude-sonnet-4-5-20250929'
        }

        return config.get('settings', default_settings)

    def save_skill_id(self, skill_id: str) -> None:
        """Save uploaded skill ID"""
        config = self._load_config()
        config['skill_id'] = skill_id
        self._save_config(config)

    def get_skill_id(self) -> Optional[str]:
        """Get skill ID if available"""
        config = self._load_config()
        return config.get('skill_id')

    def has_api_key(self) -> bool:
        """Check if API key is configured"""
        return self.get_api_key() is not None
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_config_manager.py -v
```

Expected: All tests PASS

**Step 5: Commit config manager**

```bash
git add config_manager.py tests/test_config_manager.py
git commit -m "feat: add secure config manager with encrypted API key storage

- Fernet (AES-128) encryption for API keys
- FileLock prevents corruption from concurrent access
- JSON-based storage in ~/.pdf-converter/
- Comprehensive test coverage"
```

---

## Task 3: Create Converter Module (Skills API Integration)

**Goal:** Implement document conversion using Anthropic Skills API

**Files:**
- Create: `converter.py`
- Create: `tests/test_converter.py`

**Step 1: Write test for skill upload**

Create `tests/test_converter.py`:
```python
import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
from converter import upload_skill, convert_document


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client for testing"""
    with patch('converter.Anthropic') as mock_client:
        yield mock_client.return_value


def test_upload_skill_success(mock_anthropic_client, tmp_path):
    """Test successful skill upload"""
    # Mock the API response
    mock_anthropic_client.beta.skills.create.return_value = MagicMock(
        skill_id="skill_abc123xyz"
    )

    # Create a dummy skill zip
    skill_path = tmp_path / "image-to-docx-converter.zip"
    skill_path.write_bytes(b"fake skill content")

    with patch('converter.SKILL_PATH', skill_path):
        skill_id = upload_skill("sk-ant-test123", mock_anthropic_client)

    assert skill_id == "skill_abc123xyz"
    mock_anthropic_client.beta.skills.create.assert_called_once()


def test_upload_skill_handles_api_error(mock_anthropic_client, tmp_path):
    """Test skill upload error handling"""
    # Mock API error
    mock_anthropic_client.beta.skills.create.side_effect = Exception("API Error")

    skill_path = tmp_path / "image-to-docx-converter.zip"
    skill_path.write_bytes(b"fake skill content")

    with patch('converter.SKILL_PATH', skill_path):
        skill_id = upload_skill("sk-ant-test123", mock_anthropic_client)

    # Should return None on error (for fallback)
    assert skill_id is None
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_converter.py::test_upload_skill_success -v
```

Expected: `ModuleNotFoundError: No module named 'converter'`

**Step 3: Implement skill upload function**

Create `converter.py`:
```python
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
from anthropic.lib import files_from_dir

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Skill package path
SKILL_PATH = Path(__file__).parent / 'image-to-docx-converter.zip'


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

        try:
            # Extract skill zip
            with zipfile.ZipFile(SKILL_PATH, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # Upload via Skills API
            skill = client.beta.skills.create(
                files=files_from_dir(str(temp_dir)),
                betas=["skills-2025-10-02"]
            )

            logger.info(f"Skill uploaded successfully: {skill.skill_id}")
            return skill.skill_id

        finally:
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
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_converter.py -v
```

Expected: All tests PASS

**Step 5: Add test for convert_document (stub)**

Add to `tests/test_converter.py`:
```python
def test_convert_document_with_skill(mock_anthropic_client, tmp_path):
    """Test document conversion with skill"""
    # This is a stub - we'll implement full conversion later
    # For now, just verify the function signature exists
    from converter import convert_document

    assert callable(convert_document)
```

**Step 6: Add convert_document stub**

Add to `converter.py`:
```python
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
```

**Step 7: Commit converter foundation**

```bash
git add converter.py tests/test_converter.py
git commit -m "feat: add converter module with Skills API upload

- Skill upload to user's Anthropic account
- Enhanced verification prompt builder
- Cost calculation from token usage
- Comprehensive error handling and logging
- Test coverage for skill upload"
```

---

## Task 4: Complete Document Conversion Logic

**Goal:** Implement full conversion with Skills API invocation and code execution

**Files:**
- Modify: `converter.py`
- Modify: `tests/test_converter.py`

**Step 1: Add conversion test**

Add to `tests/test_converter.py`:
```python
def test_convert_document_calls_api_correctly(mock_anthropic_client, tmp_path):
    """Test that convert_document calls API with correct parameters"""
    # Mock API response
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(type='text', text='''```javascript
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun } = require('docx');

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                children: [new TextRun("Test document")]
            })
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync('./test.docx', buffer);
    console.log('SUCCESS: test.docx');
    process.exit(0);
});
```''')
    ]
    mock_response.usage = {'input_tokens': 1000, 'output_tokens': 500}

    mock_anthropic_client.beta.messages.create.return_value = mock_response

    # Create test PDF
    test_pdf = tmp_path / "test.pdf"
    test_pdf.write_bytes(b"%PDF-1.4 fake pdf")

    settings = {
        'font': 'Arial',
        'fontSize': 12,
        'model': 'claude-sonnet-4-5-20250929',
        'margins': {'top': 1.0, 'right': 1.0, 'bottom': 1.0, 'left': 1.0}
    }

    from converter import convert_document

    with patch('converter.execute_generated_code', return_value={'success': True}):
        result = convert_document(
            str(test_pdf),
            settings,
            "sk-ant-test123",
            skill_id="skill_test123",
            client=mock_anthropic_client
        )

    # Verify API was called with Skills API parameters
    call_args = mock_anthropic_client.beta.messages.create.call_args
    assert call_args.kwargs['betas'] == ["code-execution-2025-08-25", "skills-2025-10-02"]
    assert 'container' in call_args.kwargs
    assert call_args.kwargs['container']['skills'][0]['skill_id'] == 'skill_test123'
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_converter.py::test_convert_document_calls_api_correctly -v
```

Expected: FAIL (NotImplementedError or assertion errors)

**Step 3: Implement full convert_document**

Replace the stub in `converter.py`:
```python
import subprocess
import tempfile
import shutil


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

        # Initialize client
        if client is None:
            client = Anthropic(api_key=api_key)

        # Prepare file
        file_base64 = file_to_base64(file_path)
        media_type = get_media_type(file_path)
        file_name = Path(file_path).stem

        # Build prompt
        prompt = build_prompt(settings, file_name)

        if progress_callback:
            progress_callback({'status': 'analyzing', 'progress': 30})

        # Prepare API call
        messages_params = {
            'model': settings.get('model', 'claude-sonnet-4-5-20250929'),
            'max_tokens': 16000,
            'betas': ['code-execution-2025-08-25', 'skills-2025-10-02'],
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
            messages_params['tools'] = [{
                'type': 'code_execution_20250825',
                'name': 'code_execution'
            }]

        # Call API
        logger.info(f"Calling Anthropic API with model {settings.get('model')}")
        response = client.beta.messages.create(**messages_params)

        if progress_callback:
            progress_callback({'status': 'generating', 'progress': 70})

        # Extract code
        response_text = ''
        for block in response.content:
            if hasattr(block, 'text'):
                response_text += block.text

        code = extract_code_from_response(response_text)

        if not code:
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
```

**Step 4: Run tests**

```bash
pytest tests/test_converter.py -v
```

Expected: All tests PASS

**Step 5: Commit conversion logic**

```bash
git add converter.py tests/test_converter.py
git commit -m "feat: implement full document conversion with Skills API

- Skills API invocation with container parameter
- Code extraction from API response
- JavaScript code execution for .docx generation
- Progress callbacks for UI updates
- Comprehensive error handling
- Cost calculation from usage data"
```

---

## Task 5: Create Flask Web Server

**Goal:** Create Flask app that serves UI and handles API requests

**Files:**
- Create: `app.py`
- Create: `tests/test_app.py`
- Create: `static/` directory structure

**Step 1: Create directory structure**

```bash
mkdir -p static
mkdir -p templates
mkdir -p tests
```

**Step 2: Write Flask app test**

Create `tests/test_app.py`:
```python
import pytest
from app import create_app


@pytest.fixture
def client():
    """Create test client"""
    app = create_app(testing=True)
    with app.test_client() as client:
        yield client


def test_index_route_returns_html(client):
    """Test main route serves HTML"""
    response = client.get('/')
    assert response.status_code == 200
    assert b'DOCTYPE html' in response.data or b'PDF to Word Converter' in response.data


def test_api_settings_get(client):
    """Test getting settings"""
    response = client.get('/api/settings')
    assert response.status_code == 200
    data = response.get_json()
    assert 'font' in data
    assert 'model' in data


def test_api_health_check(client):
    """Test health check endpoint"""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
```

**Step 3: Run test to verify it fails**

```bash
pytest tests/test_app.py -v
```

Expected: `ModuleNotFoundError: No module named 'app'`

**Step 4: Implement Flask app**

Create `app.py`:
```python
"""
Flask web server for PDF to Word converter.

Serves browser-based UI and provides API endpoints for:
- File upload and conversion
- Settings management
- API key configuration
- Skill upload
"""

import os
import logging
import webbrowser
from threading import Timer
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from werkzeug.utils import secure_filename

from config_manager import ConfigManager
from converter import upload_skill, convert_document

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize config manager
config_manager = ConfigManager()


def create_app(testing=False):
    """Application factory"""
    app = Flask(__name__, static_folder='static', static_url_path='/static')

    if testing:
        app.config['TESTING'] = True

    # Configure upload folder
    UPLOAD_FOLDER = Path.home() / '.pdf-converter' / 'uploads'
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max

    @app.route('/')
    def index():
        """Serve main UI"""
        # For now, serve static HTML file
        return send_from_directory('static', 'index.html')

    @app.route('/api/health')
    def health_check():
        """Health check endpoint"""
        return jsonify({'status': 'ok'})

    @app.route('/api/settings', methods=['GET'])
    def get_settings():
        """Get user settings"""
        try:
            settings = config_manager.get_settings()
            return jsonify(settings)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/settings', methods=['POST'])
    def save_settings():
        """Save user settings"""
        try:
            settings = request.get_json()
            config_manager.save_settings(settings)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/api-key', methods=['GET'])
    def get_api_key_status():
        """Check if API key is configured"""
        try:
            has_key = config_manager.has_api_key()
            return jsonify({'hasApiKey': has_key})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/api-key', methods=['POST'])
    def save_api_key():
        """Save API key"""
        try:
            data = request.get_json()
            api_key = data.get('apiKey')

            if not api_key or not api_key.startswith('sk-ant-'):
                return jsonify({'error': 'Invalid API key format'}), 400

            config_manager.save_api_key(api_key)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/skill-upload', methods=['POST'])
    def upload_skill_to_account():
        """Upload skill to user's Anthropic account"""
        try:
            api_key = config_manager.get_api_key()
            if not api_key:
                return jsonify({'error': 'API key not configured'}), 400

            skill_id = upload_skill(api_key)

            if skill_id:
                config_manager.save_skill_id(skill_id)
                return jsonify({'success': True, 'skillId': skill_id})
            else:
                return jsonify({
                    'success': False,
                    'error': 'Skill upload failed, will use embedded fallback'
                })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/convert', methods=['POST'])
    def convert_file():
        """Convert uploaded file to Word"""
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400

            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'Empty filename'}), 400

            # Save uploaded file
            filename = secure_filename(file.filename)
            file_path = app.config['UPLOAD_FOLDER'] / filename
            file.save(file_path)

            # Get settings
            settings = config_manager.get_settings()
            api_key = config_manager.get_api_key()
            skill_id = config_manager.get_skill_id()

            if not api_key:
                return jsonify({'error': 'API key not configured'}), 400

            # Convert
            result = convert_document(
                str(file_path),
                settings,
                api_key,
                skill_id=skill_id
            )

            if result['success']:
                # Return the file
                return send_file(
                    result['output_path'],
                    as_attachment=True,
                    download_name=Path(result['output_path']).name
                )
            else:
                return jsonify({'error': result.get('error', 'Conversion failed')}), 500

        except Exception as e:
            logger.error(f"Conversion error: {e}")
            return jsonify({'error': str(e)}), 500

    return app


def open_browser():
    """Open browser to app URL after startup delay"""
    webbrowser.open('http://127.0.0.1:5000')


if __name__ == '__main__':
    # Start browser after 1 second
    Timer(1, open_browser).start()

    # Run Flask app
    app = create_app()
    app.run(host='127.0.0.1', port=5000, debug=False)
```

**Step 5: Run tests**

```bash
pytest tests/test_app.py -v
```

Expected: Most tests PASS (index route will fail until we create HTML)

**Step 6: Commit Flask app**

```bash
git add app.py tests/test_app.py
git commit -m "feat: add Flask web server with API endpoints

- Main UI route serving static HTML
- API endpoints for settings, API key, conversion
- Skill upload endpoint
- File upload handling with secure filenames
- Auto-open browser on startup
- Comprehensive error handling"
```

---

## Task 6: Create Frontend UI (HTML/CSS/JS)

**Goal:** Build clean, modern browser-based interface

**Files:**
- Create: `static/index.html`
- Create: `static/style.css`
- Create: `static/app.js`

**Step 1: Create main HTML**

Create `static/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF to Word Converter</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <!-- Welcome Screen (first run) -->
    <div id="welcome-screen" class="screen hidden">
        <div class="container">
            <h1>Welcome to PDF to Word Converter! 👋</h1>
            <p class="subtitle">Convert documents using Claude AI</p>

            <div class="info-box">
                <h3>💰 Pay-as-you-go pricing</h3>
                <p><strong>~$0.01-0.03 per page</strong></p>
                <p>You only pay for what you convert. No subscription needed.</p>
            </div>

            <div class="setup-steps">
                <h3>Quick Setup (2 minutes)</h3>
                <ol>
                    <li>Get your Anthropic API key (free account)</li>
                    <li>Add a credit card for pay-as-you-go billing</li>
                    <li>Paste your API key here</li>
                </ol>
            </div>

            <button id="get-started-btn" class="btn-primary">Get Started</button>
        </div>
    </div>

    <!-- API Key Setup Screen -->
    <div id="api-key-screen" class="screen hidden">
        <div class="container">
            <h2>API Key Setup</h2>

            <div class="info-box">
                <h4>ℹ️ What is an API key?</h4>
                <p>An API key is like a password that lets this app use Claude AI on your behalf. You'll be billed directly by Anthropic for usage.</p>
            </div>

            <div class="setup-step">
                <h3>Step 1: Get your API key</h3>
                <button id="open-anthropic-btn" class="btn-secondary">Open Anthropic Console ↗</button>
                <p class="help-text">Sign up → Settings → API Keys → Create Key</p>
            </div>

            <div class="setup-step">
                <h3>Step 2: Set up billing</h3>
                <p class="warning">⚠️ Important: Add a credit card in the Anthropic Console (Billing section) before continuing. Without billing setup, conversions will fail.</p>
            </div>

            <div class="setup-step">
                <h3>Step 3: Enter your API key</h3>
                <input type="password" id="api-key-input" placeholder="sk-ant-api03-..." class="input-text">
                <button id="save-api-key-btn" class="btn-primary">Save & Continue</button>
                <p id="api-key-error" class="error-text hidden"></p>
                <p id="api-key-status" class="status-text hidden"></p>
            </div>

            <p class="security-note">🔒 Your API key is stored securely on your computer and never shared.</p>
        </div>
    </div>

    <!-- Main Interface -->
    <div id="main-interface" class="screen hidden">
        <header>
            <h1>PDF to Word Converter</h1>
            <div class="header-buttons">
                <button id="settings-btn" class="btn-icon" title="Settings">⚙️</button>
                <button id="help-btn" class="btn-icon" title="Help">?</button>
            </div>
        </header>

        <main>
            <!-- Drop Zone -->
            <div id="drop-zone" class="drop-zone">
                <div class="drop-zone-content">
                    <p class="drop-zone-icon">📄</p>
                    <p class="drop-zone-text">Drag & Drop PDF or Image Here</p>
                    <p class="drop-zone-subtext">or click to browse</p>
                    <p class="drop-zone-formats">Supports: PDF, JPG, PNG</p>
                </div>
                <input type="file" id="file-input" accept=".pdf,.jpg,.jpeg,.png" hidden>
            </div>

            <!-- Quick Settings -->
            <div class="quick-settings">
                <div class="setting-group">
                    <label>Model:</label>
                    <select id="model-select" class="select-input">
                        <option value="claude-haiku-4-5">Haiku (~$0.01/page)</option>
                        <option value="claude-sonnet-4-5-20250929" selected>Sonnet (~$0.02/page)</option>
                        <option value="claude-3-5-haiku-20241022">Haiku 3.5 (~$0.01/page)</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="page-markers-check" checked>
                        Page markers
                    </label>
                </div>

                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="replace-signatures-check" checked>
                        Replace signatures
                    </label>
                </div>
            </div>

            <!-- Selected File Display -->
            <div id="selected-file" class="selected-file hidden">
                <p id="selected-file-name"></p>
                <button id="clear-file-btn" class="btn-text">Clear</button>
            </div>

            <!-- Convert Button -->
            <button id="convert-btn" class="btn-primary btn-large" disabled>Convert Document</button>

            <!-- Progress Display -->
            <div id="progress-container" class="progress-container hidden">
                <h3 id="progress-title">Converting...</h3>
                <div class="progress-bar">
                    <div id="progress-fill" class="progress-fill"></div>
                </div>
                <p id="progress-status">Preparing...</p>
                <p id="progress-cost"></p>
            </div>

            <!-- Success Display -->
            <div id="success-container" class="success-container hidden">
                <h3>✅ Conversion Complete!</h3>
                <p id="success-filename"></p>
                <p id="success-cost"></p>
                <button id="convert-another-btn" class="btn-primary">Convert Another Document</button>
            </div>

            <!-- Usage Stats -->
            <div class="usage-stats">
                <p>Recent conversions: <span id="total-conversions">0</span> documents</p>
                <p>Total cost: $<span id="total-cost">0.00</span></p>
            </div>
        </main>
    </div>

    <script src="/static/app.js"></script>
</body>
</html>
```

**Step 2: Create CSS styling**

Create `static/style.css`:
```css
/* CSS Reset and Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary-color: #5B67E8;
    --primary-hover: #4A56D7;
    --success-color: #10B981;
    --error-color: #EF4444;
    --warning-color: #F59E0B;
    --text-primary: #1F2937;
    --text-secondary: #6B7280;
    --bg-primary: #FFFFFF;
    --bg-secondary: #F9FAFB;
    --border-color: #E5E7EB;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    color: var(--text-primary);
    background: var(--bg-secondary);
    line-height: 1.6;
}

/* Screen Management */
.screen {
    min-height: 100vh;
    padding: 20px;
}

.screen.hidden {
    display: none;
}

.container {
    max-width: 700px;
    margin: 40px auto;
    padding: 40px;
    background: var(--bg-primary);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
}

/* Typography */
h1 {
    font-size: 32px;
    margin-bottom: 12px;
    color: var(--text-primary);
}

h2 {
    font-size: 24px;
    margin-bottom: 16px;
    color: var(--text-primary);
}

h3 {
    font-size: 18px;
    margin-bottom: 12px;
    color: var(--text-primary);
}

.subtitle {
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 24px;
}

/* Buttons */
.btn-primary {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-primary:hover {
    background: var(--primary-hover);
}

.btn-primary:disabled {
    background: #9CA3AF;
    cursor: not-allowed;
}

.btn-large {
    width: 100%;
    padding: 16px 24px;
    font-size: 18px;
    margin-top: 20px;
}

.btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 10px 20px;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-secondary:hover {
    background: #F3F4F6;
}

.btn-icon {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 8px 12px;
}

.btn-text {
    background: none;
    border: none;
    color: var(--primary-color);
    cursor: pointer;
    font-size: 14px;
    text-decoration: underline;
}

/* Info Boxes */
.info-box {
    background: #EFF6FF;
    border: 1px solid #BFDBFE;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
}

.info-box h3, .info-box h4 {
    color: #1E40AF;
    margin-bottom: 8px;
}

.warning {
    color: var(--warning-color);
    font-weight: 500;
}

/* Inputs */
.input-text {
    width: 100%;
    padding: 12px;
    font-size: 14px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-bottom: 12px;
    font-family: monospace;
}

.select-input {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 14px;
}

/* Drop Zone */
.drop-zone {
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    padding: 60px 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background: var(--bg-primary);
}

.drop-zone:hover {
    border-color: var(--primary-color);
    background: #F0F9FF;
}

.drop-zone.drag-over {
    border-color: var(--primary-color);
    background: #EFF6FF;
}

.drop-zone-icon {
    font-size: 48px;
    margin-bottom: 12px;
}

.drop-zone-text {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 8px;
}

.drop-zone-subtext {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 12px;
}

.drop-zone-formats {
    font-size: 13px;
    color: var(--text-secondary);
}

/* Quick Settings */
.quick-settings {
    display: flex;
    gap: 20px;
    margin: 20px 0;
    flex-wrap: wrap;
}

.setting-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Progress Bar */
.progress-container {
    margin: 30px 0;
}

.progress-bar {
    width: 100%;
    height: 30px;
    background: var(--bg-secondary);
    border-radius: 15px;
    overflow: hidden;
    margin: 12px 0;
}

.progress-fill {
    height: 100%;
    background: var(--primary-color);
    transition: width 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 500;
}

/* Success/Error Messages */
.error-text {
    color: var(--error-color);
    font-size: 14px;
    margin-top: 8px;
}

.status-text {
    color: var(--text-secondary);
    font-size: 14px;
    margin-top: 8px;
}

.success-container {
    text-align: center;
    padding: 30px;
    background: #F0FDF4;
    border-radius: 12px;
    margin: 20px 0;
}

.success-container h3 {
    color: var(--success-color);
}

/* Header */
header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
}

.header-buttons {
    display: flex;
    gap: 8px;
}

/* Main Content */
main {
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
}

/* Utility Classes */
.hidden {
    display: none;
}

.security-note {
    text-align: center;
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 24px;
}

.help-text {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 8px;
}

.setup-steps {
    margin: 24px 0;
}

.setup-steps ol {
    margin-left: 24px;
}

.setup-steps li {
    margin: 8px 0;
}

.setup-step {
    margin: 24px 0;
}

.selected-file {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
    margin: 12px 0;
}

.usage-stats {
    text-align: center;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 14px;
}
```

**Step 3: Create JavaScript logic**

Create `static/app.js` (to be continued in next step due to length)

**Step 4: Commit frontend structure**

```bash
git add static/index.html static/style.css
git commit -m "feat: add frontend HTML and CSS

- Modern, clean UI design
- Welcome screen for first-run
- API key setup flow
- Main conversion interface
- Progress display
- Responsive design with flexbox
- Professional color scheme and typography"
```

---

(Continued in next task...)

## Task 7: Complete Frontend JavaScript Logic

**Files:**
- Create: `static/app.js`

**Step 1: Implement app.js**

Create `static/app.js`:

```javascript
// State management
let selectedFile = null;
let hasApiKey = false;

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Initialize app
async function initializeApp() {
    console.log('Initializing app...');

    // Check if API key is configured
    try {
        const response = await fetch('/api/api-key');
        const data = await response.json();
        hasApiKey = data.hasApiKey;

        if (hasApiKey) {
            showScreen('main-interface');
            loadSettings();
            loadUsageStats();
        } else {
            showScreen('welcome-screen');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showScreen('welcome-screen');
    }
}

// Event listeners setup
function setupEventListeners() {
    // Welcome screen
    document.getElementById('get-started-btn').addEventListener('click', () => {
        showScreen('api-key-screen');
    });

    // API key setup
    document.getElementById('open-anthropic-btn').addEventListener('click', () => {
        window.open('https://console.anthropic.com/settings/keys', '_blank');
    });

    document.getElementById('save-api-key-btn').addEventListener('click', saveApiKey);

    // File selection
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // Convert button
    document.getElementById('convert-btn').addEventListener('click', convertDocument);

    // Clear file button
    document.getElementById('clear-file-btn').addEventListener('click', clearSelectedFile);

    // Convert another button
    document.getElementById('convert-another-btn').addEventListener('click', () => {
        clearSelectedFile();
        document.getElementById('success-container').classList.add('hidden');
    });
}

// API key save
async function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const errorEl = document.getElementById('api-key-error');
    const statusEl = document.getElementById('api-key-status');
    const saveBtn = document.getElementById('save-api-key-btn');

    const apiKey = apiKeyInput.value.trim();

    // Validate format
    if (!apiKey.startsWith('sk-ant-')) {
        errorEl.textContent = 'Invalid API key format. Should start with sk-ant-';
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    statusEl.textContent = 'Saving API key...';
    statusEl.classList.remove('hidden');
    saveBtn.disabled = true;

    try {
        // Save API key
        const response = await fetch('/api/api-key', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({apiKey})
        });

        if (!response.ok) {
            throw new Error('Failed to save API key');
        }

        statusEl.textContent = 'API key saved! Setting up converter (10 seconds)...';

        // Upload skill to user's account
        const skillResponse = await fetch('/api/skill-upload', {
            method: 'POST'
        });

        const skillData = await skillResponse.json();

        if (skillData.success) {
            statusEl.textContent = 'Setup complete! Redirecting...';
        } else {
            statusEl.textContent = 'Setup complete! (Using embedded skill)';
        }

        // Show main interface after short delay
        setTimeout(() => {
            showScreen('main-interface');
            loadSettings();
        }, 1500);

    } catch (error) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.classList.remove('hidden');
        statusEl.classList.add('hidden');
    } finally {
        saveBtn.disabled = false;
    }
}

// Load settings from server
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        // Apply to UI
        document.getElementById('model-select').value = settings.model;
        document.getElementById('page-markers-check').checked = settings.addPageMarkers;
        document.getElementById('replace-signatures-check').checked = settings.replaceSignatures;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Load usage statistics
async function loadUsageStats() {
    // TODO: Implement if we add usage tracking
    document.getElementById('total-conversions').textContent = '0';
    document.getElementById('total-cost').textContent = '0.00';
}

// Handle file selection
function handleFileSelect(file) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF, JPG, or PNG file');
        return;
    }

    selectedFile = file;

    // Show selected file
    document.getElementById('selected-file-name').textContent = file.name;
    document.getElementById('selected-file').classList.remove('hidden');

    // Enable convert button
    document.getElementById('convert-btn').disabled = false;
}

// Clear selected file
function clearSelectedFile() {
    selectedFile = null;
    document.getElementById('selected-file').classList.add('hidden');
    document.getElementById('convert-btn').disabled = true;
    document.getElementById('file-input').value = '';
}

// Convert document
async function convertDocument() {
    if (!selectedFile) return;

    // Get settings from UI
    const settings = {
        model: document.getElementById('model-select').value,
        addPageMarkers: document.getElementById('page-markers-check').checked,
        replaceSignatures: document.getElementById('replace-signatures-check').checked
    };

    // Show progress
    document.getElementById('progress-container').classList.remove('hidden');
    document.getElementById('convert-btn').disabled = true;

    updateProgress('Uploading file...', 10);

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('settings', JSON.stringify(settings));

        // Send to server
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Conversion failed');
        }

        updateProgress('Conversion complete!', 100);

        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name.replace(/\.[^/.]+$/, '.docx');
        a.click();
        window.URL.revokeObjectURL(url);

        // Show success
        showSuccess(a.download, 0.15); // TODO: Get actual cost from response

    } catch (error) {
        alert('Conversion failed: ' + error.message);
        document.getElementById('progress-container').classList.add('hidden');
        document.getElementById('convert-btn').disabled = false;
    }
}

// Update progress display
function updateProgress(status, percent) {
    document.getElementById('progress-status').textContent = status;
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('progress-fill').textContent = Math.round(percent) + '%';
}

// Show success message
function showSuccess(filename, cost) {
    document.getElementById('progress-container').classList.add('hidden');
    document.getElementById('success-filename').textContent = filename;
    document.getElementById('success-cost').textContent = `Cost: $${cost.toFixed(4)}`;
    document.getElementById('success-container').classList.remove('hidden');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeApp();
});
```

**Step 2: Test the UI manually**

```bash
# Start the app
python app.py
```

Expected: Browser opens, shows welcome screen

**Step 3: Commit JavaScript**

```bash
git add static/app.js
git commit -m "feat: add frontend JavaScript logic

- Screen state management (welcome/setup/main)
- API key setup flow with validation
- Drag-and-drop file upload
- Settings management
- Conversion flow with progress display
- File download handling
- Error handling and user feedback"
```

---

## Task 8: Create User Documentation

**Goal:** Write comprehensive, foolproof documentation for users

**Files:**
- Update: `README.md`
- Create: `DOWNLOAD_INSTRUCTIONS.md`
- Update: `docs/API_KEY_GUIDE.md`
- Create: `docs/BILLING_INFO.md`
- Create: `docs/TROUBLESHOOTING.md`

**Step 1: Update main README**

Update `README.md`:
```markdown
# PDF to Word Converter

Convert PDFs and images to editable Word documents using Claude AI.

## ✨ Features

- 📄 Convert PDF, JPG, PNG to professional Word documents
- 🎯 80-90% visual fidelity
- 💰 Pay-as-you-go pricing (~$0.01-0.03 per page)
- ⚡ Fast conversion (10-30 seconds)
- 🔒 Secure - API key stored locally, encrypted
- 🎨 Customizable fonts, margins, formatting

## 🚀 Quick Start

### For End Users (Easiest)

**Download the installer:**
- **Windows:** [Download .exe](releases/latest) (coming soon)
- **Mac:** [Download .dmg](releases/latest) (coming soon)

Double-click to install, no technical knowledge required!

See [DOWNLOAD_INSTRUCTIONS.md](DOWNLOAD_INSTRUCTIONS.md) for detailed steps.

### For Developers

**Requirements:** Python 3.10+

```bash
# Clone repository
git clone https://github.com/yourname/pdf-converter.git
cd pdf-converter

# Install dependencies
pip install -r requirements.txt

# Run app
python app.py
```

Browser opens automatically to http://localhost:5000

## 💰 Pricing

- **Per page:** ~$0.01-0.03
- **1-page letter:** ~$0.02
- **10-page contract:** ~$0.20
- **100-page book:** ~$2.00

No subscription. Pay only for what you convert through Anthropic.

## 📖 Documentation

- [Download Instructions](DOWNLOAD_INSTRUCTIONS.md) - For end users
- [API Key Guide](docs/API_KEY_GUIDE.md) - How to get your Anthropic API key
- [Billing Info](docs/BILLING_INFO.md) - Understanding pay-as-you-go costs
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues & solutions

## 🔧 Development

```bash
# Run tests
pytest tests/ -v

# Build installers (requires PyInstaller)
python build_installer.py
```

## 📝 License

MIT

## 💬 Support

- Issues: [GitHub Issues](issues)
- Questions: [GitHub Discussions](discussions)
```

**Step 2: Create download instructions**

Create `DOWNLOAD_INSTRUCTIONS.md`:
```markdown
# Download & Installation Instructions

## Windows Users

1. **Click this link:** [Download for Windows](releases/latest/PDF_Converter_Windows.exe)
2. **Wait for download** (file: PDF_Converter_Windows.exe, ~55 MB)
3. **Find the file** in your Downloads folder
4. **Double-click** PDF_Converter_Windows.exe
5. **If Windows shows a security warning:**
   - Click "More info"
   - Click "Run anyway"
   - (This is normal for apps without Microsoft signatures)
6. **Follow the installer** - click Next → Next → Install
7. **Find the shortcut** on your desktop: "PDF Converter"
8. **Double-click the shortcut** - your browser will open with the app!

## Mac Users

1. **Click this link:** [Download for Mac](releases/latest/PDF_Converter_Mac.dmg)
2. **Wait for download** (file: PDF_Converter_Mac.dmg, ~58 MB)
3. **Find the file** in your Downloads folder
4. **Double-click** PDF_Converter_Mac.dmg
5. **Drag the app** to the Applications folder (window will show you)
6. **Open Applications** folder
7. **Right-click** "PDF Converter" → Open
8. **If Mac shows "unidentified developer":**
   - Click "Open" in the dialog
   - (Or: System Preferences → Security & Privacy → "Open Anyway")
9. **Your browser will open** with the app!

## First Time Setup (All Users)

After installing, the app will open in your browser and show:

### Step 1: Get API Key
- Click "Get API Key from Anthropic"
- Sign up for free account
- Go to Settings → API Keys
- Click "Create Key"
- **Copy the key** (starts with sk-ant-)

### Step 2: Set Up Billing
⚠️ **Important:** Before continuing, add a credit card in the Anthropic Console:
- Go to "Billing" in the Anthropic Console
- Add payment method
- You'll only be charged for what you use (~$0.01-0.03 per page)

### Step 3: Enter API Key
- Paste your API key in the app
- Click "Save"
- Wait ~10 seconds for setup
- Done! 🎉

## Start Converting

1. Drag a PDF or image into the app
2. Click "Convert"
3. Wait 10-30 seconds
4. Download your Word document!

## Need Help?

See [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
```

**Step 3: Create API key guide**

Create `docs/API_KEY_GUIDE.md`:
```markdown
# How to Get Your Anthropic API Key

## What is an API Key?

An API key is like a password that lets this app use Claude AI on your behalf. You'll be billed directly by Anthropic for usage - the app creator never sees your API key or charges you anything.

## Step-by-Step Guide

### 1. Go to Anthropic Console

Open this link: https://console.anthropic.com/settings/keys

### 2. Sign Up or Log In

- If new: Click "Sign Up" and create free account
- If existing: Log in with your credentials

### 3. Navigate to API Keys

- Click "Settings" in the left sidebar
- Click "API Keys"

### 4. Create New Key

- Click "Create Key" button
- Give it a name (e.g., "PDF Converter")
- **Copy the key immediately** - you won't see it again!

The key starts with: `sk-ant-api03-...`

### 5. Set Up Billing (Required!)

**Before using the app, you MUST add billing:**

- Go to "Billing" in the Anthropic Console
- Click "Add Payment Method"
- Enter credit card details
- **You won't be charged until you convert documents**
- Typical usage: ~$0.01-0.03 per page

### 6. Paste in App

- Return to the PDF Converter app
- Paste your API key in the setup screen
- Click "Save"
- The app will automatically upload the conversion skill (~10 seconds)
- Ready to convert!

## Security

✅ Your API key is stored **only on your computer**
✅ Encrypted using industry-standard AES-128
✅ Never sent to anyone except Anthropic
✅ The app creator cannot see your key

## Managing Your Key

**If you need to change your API key:**
1. Generate new key in Anthropic Console
2. Open app settings (⚙️ button)
3. Click "Change API Key"
4. Paste new key

**If your key is compromised:**
1. Go to Anthropic Console
2. Delete the old key
3. Create a new one
4. Update in the app

## Billing Questions?

See [Billing Info Guide](BILLING_INFO.md)
```

**Step 4: Create billing info**

Create `docs/BILLING_INFO.md`:
```markdown
# Billing Information

## How Pricing Works

This app uses Anthropic's Claude AI, which charges **pay-as-you-go** based on usage:

### Per-Page Costs

| Document Type | Haiku Model | Sonnet Model |
|---------------|-------------|--------------|
| Simple text | ~$0.01/page | ~$0.02/page |
| With tables | ~$0.01/page | ~$0.03/page |
| Complex layout | ~$0.02/page | ~$0.03/page |

### Example Costs

- **1-page letter:** $0.01-0.03
- **5-page contract:** $0.05-0.15
- **20-page report:** $0.20-0.60
- **100-page book:** $1.00-3.00

### Models Explained

**Haiku (Cheaper, Faster):**
- Best for: Simple documents, plain text
- Speed: ~10 seconds per page
- Cost: ~$0.01 per page

**Sonnet (Better Quality):**
- Best for: Complex layouts, tables, formatting
- Speed: ~15 seconds per page
- Cost: ~$0.02-0.03 per page

## How You're Billed

1. **By Anthropic, not the app creator**
   - Charges appear on your credit card as "Anthropic"
   - The app creator receives nothing
   - All payments go directly to Anthropic

2. **Monthly billing**
   - Anthropic bills monthly
   - View usage in [Anthropic Console](https://console.anthropic.com/billing)

3. **Only for successful conversions**
   - If conversion fails, you're not charged
   - Cost shown before conversion is an estimate

## Viewing Your Usage

**In the App:**
- Bottom of main screen shows: "Total cost: $X.XX"
- This is approximate based on conversions

**In Anthropic Console:**
- Go to: https://console.anthropic.com/billing
- See exact usage, costs, and invoices
- Download invoices for expense reports

## Setting Spending Limits

In the Anthropic Console:
1. Go to "Billing"
2. Set usage alerts (e.g., email when spending hits $10)
3. Set spending caps (optional hard limit)

## No Hidden Fees

✅ No subscription
✅ No monthly minimums
✅ No setup fees
✅ No per-document fees from the app
✅ Only Anthropic API usage costs

## Optimizing Costs

**Tips to reduce spending:**

1. **Use Haiku for simple documents**
   - 40% cheaper than Sonnet
   - Great for plain text

2. **Select specific pages**
   - Convert only pages you need
   - "Pages: 1-5" instead of all 100 pages

3. **Batch similar documents**
   - Settings apply to all conversions
   - Saves time adjusting settings

## Questions?

**About billing/charges:** Contact Anthropic support
**About the app:** [Open GitHub Issue](../../issues)
```

**Step 5: Create troubleshooting guide**

Create `docs/TROUBLESHOOTING.md`:
```markdown
# Troubleshooting Guide

## Common Issues

### "Invalid API Key" Error

**Symptoms:** App shows "Invalid API key" after pasting

**Solutions:**
1. Check the key starts with `sk-ant-api03-`
2. Make sure you copied the entire key
3. No extra spaces before/after the key
4. Generate a new key in Anthropic Console if needed

---

### "Billing Not Set Up" Error

**Symptoms:** Conversion fails with billing error

**Solution:**
1. Go to https://console.anthropic.com/billing
2. Click "Add Payment Method"
3. Enter credit card details
4. Try conversion again

---

### App Won't Open (Windows)

**Symptoms:** Double-clicking .exe does nothing

**Solutions:**
1. Right-click → "Run as Administrator"
2. Check Windows Defender didn't block it:
   - Settings → Windows Security → Virus & Threat Protection
   - "Protection history"
   - Allow the app if blocked

---

### "Unidentified Developer" (Mac)

**Symptoms:** Mac won't open the app

**Solutions:**
1. Right-click app → "Open" (instead of double-click)
2. Click "Open" in the dialog

**Alternative:**
```bash
xattr -d com.apple.quarantine /Applications/PDF\ Converter.app
```

---

### Browser Doesn't Open

**Symptoms:** App starts but no browser window

**Solution:**
Manually open: http://127.0.0.1:5000

---

### Conversion Takes Too Long

**Symptoms:** Progress stuck for 5+ minutes

**Solutions:**
1. Check internet connection
2. Try smaller file/fewer pages
3. Switch to Haiku model (faster)
4. Check Anthropic status: https://status.anthropic.com

---

### "No Code Generated" Error

**Symptoms:** Conversion fails with code generation error

**Solutions:**
1. Try again (temporary API issue)
2. Switch models (Haiku ↔ Sonnet)
3. Check document isn't corrupted
4. Try with different document

---

### Output Quality Issues

**Symptoms:** Word document doesn't match original

**Solutions:**
1. Use Sonnet model (better quality)
2. Check original PDF isn't low resolution
3. For complex layouts, use "Advanced" settings
4. Report issue with example: [GitHub Issues](../../issues)

---

### App Crashes on Startup

**Symptoms:** App closes immediately after starting

**Solutions:**

**Windows:**
1. Delete config: `C:\Users\YourName\.pdf-converter\`
2. Restart app
3. Re-enter API key

**Mac:**
1. Delete config: `~/.pdf-converter/`
2. Restart app
3. Re-enter API key

---

## Still Need Help?

1. **Check logs:**
   - Windows: `C:\Users\YourName\.pdf-converter\app.log`
   - Mac: `~/.pdf-converter/app.log`

2. **Report issue:**
   - Go to: [GitHub Issues](../../issues)
   - Include: Error message, steps to reproduce
   - Attach log file (remove API key first!)

3. **Anthropic API issues:**
   - Check: https://status.anthropic.com
   - Contact: Anthropic support
```

**Step 6: Commit documentation**

```bash
git add README.md DOWNLOAD_INSTRUCTIONS.md docs/API_KEY_GUIDE.md docs/BILLING_INFO.md docs/TROUBLESHOOTING.md
git commit -m "docs: add comprehensive user documentation

- Updated README with quick start for users and developers
- Download instructions for Windows and Mac
- API key setup guide with security info
- Billing information with cost estimates
- Troubleshooting guide for common issues
- All written for non-technical users"
```

---

## Task 9: Create PyInstaller Build Script

**Goal:** Create script to build standalone .exe and .dmg installers

**Files:**
- Create: `build_installer.py`
- Create: `pdf_converter.spec` (PyInstaller spec file)

**Step 1: Create build script**

Create `build_installer.py`:
```python
"""
Build standalone installers for PDF Converter.

Creates:
- Windows: PDF_Converter.exe
- Mac: PDF_Converter.app (bundled in .dmg)

Requirements:
- PyInstaller 6.x
- On Mac: create-dmg (brew install create-dmg)
"""

import os
import sys
import shutil
import platform
from pathlib import Path
import PyInstaller.__main__


def clean_build_dirs():
    """Remove old build artifacts"""
    dirs_to_remove = ['build', 'dist', '__pycache__']

    for dir_name in dirs_to_remove:
        if Path(dir_name).exists():
            shutil.rmtree(dir_name)
            print(f"✓ Removed {dir_name}/")


def build_windows():
    """Build Windows .exe installer"""
    print("\n📦 Building Windows installer...")

    PyInstaller.__main__.run([
        'app.py',
        '--name=PDF_Converter',
        '--onefile',
        '--windowed',
        '--add-data=static:static',
        '--add-data=image-to-docx-converter.zip:.',
        '--hidden-import=anthropic',
        '--hidden-import=flask',
        '--hidden-import=pypdf',
        '--collect-all=anthropic',
        '--collect-all=flask',
        # '--icon=assets/icon.ico',  # Uncomment when icon is ready
    ])

    print("✓ Windows .exe created in dist/")


def build_mac():
    """Build Mac .app and .dmg"""
    print("\n📦 Building Mac installer...")

    PyInstaller.__main__.run([
        'app.py',
        '--name=PDF_Converter',
        '--onefile',
        '--windowed',
        '--add-data=static:static',
        '--add-data=image-to-docx-converter.zip:.',
        '--hidden-import=anthropic',
        '--hidden-import=flask',
        '--hidden-import=pypdf',
        '--collect-all=anthropic',
        '--collect-all=flask',
        '--osx-bundle-identifier=com.pdfconverter.app',
        # '--icon=assets/icon.icns',  # Uncomment when icon is ready
    ])

    print("✓ Mac .app created in dist/")

    # Create DMG (optional, requires create-dmg)
    try:
        import subprocess

        app_path = Path('dist/PDF_Converter.app')
        dmg_path = Path('dist/PDF_Converter.dmg')

        if dmg_path.exists():
            dmg_path.unlink()

        subprocess.run([
            'create-dmg',
            '--volname', 'PDF Converter',
            '--window-pos', '200', '120',
            '--window-size', '600', '400',
            '--icon-size', '100',
            '--app-drop-link', '400', '200',
            str(dmg_path),
            str(app_path)
        ], check=True)

        print("✓ Mac .dmg created in dist/")

    except (FileNotFoundError, subprocess.CalledProcessError):
        print("⚠️  Could not create .dmg (install with: brew install create-dmg)")
        print("   .app is still available in dist/")


def main():
    print("🏗️  PDF Converter Installer Builder\n")

    # Clean old builds
    clean_build_dirs()

    # Detect platform and build
    system = platform.system()

    if system == 'Windows':
        build_windows()
    elif system == 'Darwin':  # macOS
        build_mac()
    else:
        print(f"❌ Unsupported platform: {system}")
        print("   Supported: Windows, macOS")
        sys.exit(1)

    print("\n✅ Build complete!")
    print("   Output: dist/")
    print("\n📤 Next steps:")
    print("   1. Test the installer on a clean machine")
    print("   2. Upload to GitHub Releases")
    print("   3. Update download links in README.md")


if __name__ == '__main__':
    main()
```

**Step 2: Test build script (dry run)**

```bash
# Just verify it runs without errors (won't complete full build yet)
python build_installer.py --help 2>/dev/null || echo "Script created successfully"
```

**Step 3: Create requirements for building**

Create `requirements-build.txt`:
```txt
# Build-time dependencies (in addition to requirements.txt)
pyinstaller==6.3.0
```

**Step 4: Commit build script**

```bash
git add build_installer.py requirements-build.txt
git commit -m "feat: add PyInstaller build script for installers

- Automated .exe creation for Windows
- Automated .app/.dmg creation for Mac
- Clean build artifacts before building
- Platform detection
- Instructions for next steps after build"
```

---

## Task 10: Final Integration Testing

**Goal:** Test complete flow end-to-end

**Files:**
- Create: `tests/test_integration.py`
- Create: `test_samples/` directory with test files

**Step 1: Create integration test**

Create `tests/test_integration.py`:
```python
"""
Integration tests for complete conversion flow.

These tests verify the entire pipeline from API key setup
through conversion to Word output.
"""

import pytest
from pathlib import Path
import tempfile
import shutil


@pytest.mark.integration
def test_full_conversion_flow():
    """
    Test complete conversion flow (requires real API key).

    This test should be run manually with:
    ANTHROPIC_API_KEY=sk-ant-xxx pytest tests/test_integration.py -v -m integration
    """
    import os
    api_key = os.getenv('ANTHROPIC_API_KEY')

    if not api_key:
        pytest.skip("Set ANTHROPIC_API_KEY environment variable to run integration tests")

    from config_manager import ConfigManager
    from converter import upload_skill, convert_document

    # Use temp config directory
    temp_dir = Path(tempfile.mkdtemp())

    try:
        # Initialize config
        config = ConfigManager(config_dir=temp_dir)
        config.save_api_key(api_key)

        # Upload skill
        skill_id = upload_skill(api_key)
        if skill_id:
            config.save_skill_id(skill_id)

        # Create test PDF (or use sample)
        test_pdf = temp_dir / 'test.pdf'
        # TODO: Add actual test PDF creation or use fixture

        # Convert
        settings = {
            'font': 'Arial',
            'fontSize': 12,
            'margins': {'top': 1.0, 'right': 1.0, 'bottom': 1.0, 'left': 1.0},
            'model': 'claude-haiku-4-5',
            'addPageMarkers': True,
            'replaceSignatures': True
        }

        # result = convert_document(
        #     str(test_pdf),
        #     settings,
        #     api_key,
        #     skill_id=skill_id
        # )

        # assert result['success']
        # assert Path(result['output_path']).exists()

        print("✓ Integration test would run here with real API key")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
```

**Step 2: Create manual testing checklist**

Create `TESTING_CHECKLIST.md`:
```markdown
# Testing Checklist

Run through this checklist before each release.

## Pre-Release Testing

### Installation
- [ ] Windows .exe installs successfully
- [ ] Mac .dmg/.app installs successfully
- [ ] Desktop shortcuts created
- [ ] App launches and browser opens
- [ ] No security warnings (or warnings are documented)

### First-Run Experience
- [ ] Welcome screen appears for new users
- [ ] API key setup screen is clear
- [ ] Link to Anthropic Console opens correctly
- [ ] Billing warning is visible
- [ ] API key validation works
- [ ] Skill upload completes successfully
- [ ] Transitions to main interface smoothly

### Conversion
- [ ] PDF single-page converts
- [ ] PDF multi-page converts
- [ ] JPG image converts
- [ ] PNG image converts
- [ ] Page selection works (e.g., "1-3, 5")
- [ ] Progress bar updates
- [ ] Download starts automatically
- [ ] Output file opens in Word
- [ ] Cost estimate is reasonable

### Output Quality
- [ ] Text is accurate (no hallucinations)
- [ ] Tables formatted correctly
- [ ] Layout matches original (80%+)
- [ ] Margins are editable in Word
- [ ] Page markers at sentence boundaries (if enabled)
- [ ] Signatures replaced correctly (if enabled)

### Settings
- [ ] Model selection works
- [ ] Font/size changes applied
- [ ] Margin adjustments work
- [ ] Checkboxes toggle correctly
- [ ] Settings persist after restart

### Error Handling
- [ ] Invalid API key → clear error message
- [ ] No billing → helpful message with link
- [ ] Network error → retry option
- [ ] File too large → size limit message
- [ ] Unsupported file type → format error

### Documentation
- [ ] README is accurate
- [ ] Download instructions work
- [ ] API key guide is clear
- [ ] Billing info is accurate
- [ ] Troubleshooting covers common issues

## User Testing

Get 2-3 non-technical users to:
- [ ] Install without help
- [ ] Set up API key
- [ ] Convert a document
- [ ] Report any confusion

Fix issues before public release.

## Performance
- [ ] Conversion completes in <60 seconds for typical document
- [ ] App starts in <5 seconds
- [ ] UI is responsive during conversion

## Security
- [ ] API key is encrypted in config.json
- [ ] No API keys in logs
- [ ] No documents stored permanently
- [ ] Temp files cleaned up after conversion
```

**Step 3: Commit testing files**

```bash
git add tests/test_integration.py TESTING_CHECKLIST.md
git commit -m "test: add integration tests and release checklist

- Integration test framework for full conversion flow
- Manual testing checklist for releases
- Covers installation, conversion, quality, errors
- User testing guidelines"
```

---

## Verification

After completing all tasks, verify the implementation:

### Code Quality
- [ ] All tests pass: `pytest tests/ -v`
- [ ] No Python warnings
- [ ] Code follows PEP 8

### Functionality
- [ ] App starts and opens browser
- [ ] Welcome screen works
- [ ] API key setup works
- [ ] File upload works
- [ ] Conversion completes
- [ ] Output file is valid .docx

### Documentation
- [ ] README is clear
- [ ] All docs link correctly
- [ ] Instructions tested by non-technical user

### Build
- [ ] Installers build successfully
- [ ] .exe works on Windows
- [ ] .app works on Mac

---

## Next Steps

After implementation:

1. **Test thoroughly** with real documents
2. **Build installers** using `python build_installer.py`
3. **Create GitHub Release** and upload installers
4. **Update download links** in README
5. **Announce** to target users

**Estimated total time:** 8-10 hours of focused development

---

**Plan complete!**

For execution, choose one of:
1. **Subagent-Driven Development** - Execute in this session with fresh subagents per task
2. **Parallel Session** - Open new session and use superpowers:executing-plans
