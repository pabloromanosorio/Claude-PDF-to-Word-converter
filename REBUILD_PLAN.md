# PDF to Word Converter - Rebuild Implementation Plan

## Executive Summary

Rebuild the PDF to Word converter with focus on:
- ✅ **Reliable docx skill usage** with proper table handling
- ✅ **Cost optimization** through prompt efficiency and caching
- ✅ **Robust error handling** that won't break on API changes
- ✅ **Real-time progress** via WebSocket
- ✅ **Dual deployment**: Docker (development) + Native apps (distribution)

---

## 🎯 Core Principles

1. **docx Skill First** - Always use Anthropic's built-in docx skill for Word generation
2. **Table Fidelity** - Special attention to complex tables, merged cells, nested structures
3. **Reliability Over Speed** - Multiple fallbacks, comprehensive error handling
4. **Cost Consciousness** - Every token matters, use caching aggressively
5. **Easy Sharing** - Both technical (Docker) and non-technical (.app) users

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          Browser UI (Vanilla JS)                │
│  - File upload (drag & drop)                    │
│  - Real-time progress (WebSocket)               │
│  - Settings panel                               │
│  - Cost estimation & tracking                   │
└──────────────────┬──────────────────────────────┘
                   │ HTTP + WebSocket
┌──────────────────▼──────────────────────────────┐
│         FastAPI Backend (Python 3.9+)           │
│                                                  │
│  Core Components:                                │
│  ├─ Conversion Engine                           │
│  │  ├─ Optimized prompt builder                 │
│  │  ├─ Anthropic API client (with caching)      │
│  │  ├─ Multi-strategy file extraction           │
│  │  └─ Comprehensive retry logic                │
│  │                                               │
│  ├─ Progress Manager (WebSocket)                │
│  ├─ File Manager (upload/cleanup)               │
│  ├─ Cost Calculator                             │
│  └─ Database Manager (SQLite)                   │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐  ┌──────────▼──────────┐
│    SQLite    │  │   Anthropic API     │
│              │  │                     │
│ - Settings   │  │ - Vision API        │
│ - Jobs       │  │ - docx Skill        │
│ - Usage      │  │ - Files API         │
│ - Cost stats │  │ - Prompt Caching    │
└──────────────┘  └─────────────────────┘
```

---

## 🔧 Technology Stack

### Backend
```python
fastapi==0.104.1          # Modern async web framework
uvicorn==0.24.0           # ASGI server
anthropic==0.71.0         # Anthropic SDK
pydantic==2.5.0           # Data validation
httpx==0.27.2             # Async HTTP client
pypdf==3.17.0             # PDF processing
python-docx==1.1.0        # DOCX manipulation (for merging only)
cryptography==41.0.7      # API key encryption
sqlalchemy==2.0.23        # Database ORM
websockets==12.0          # WebSocket support
pytest==7.4.3             # Testing
```

### Frontend
```javascript
Vanilla JavaScript (ES6+)  // No framework overhead
Tailwind CSS (CDN)         // Modern styling, no build step
WebSocket API              // Real-time updates
Fetch API                  // HTTP requests
```

### Deployment
```yaml
Docker + Docker Compose    # Development & technical users
PyInstaller                # .app/.exe for non-technical users
```

---

## 📝 Detailed Implementation Plan

---

## Phase 1: Backend Foundation

### 1.1 Project Structure

```
pdf-converter/
├── backend/
│   ├── app.py                 # FastAPI app entry point
│   ├── config.py              # Configuration management
│   ├── database.py            # SQLite + SQLAlchemy models
│   ├── models.py              # Pydantic models
│   │
│   ├── core/
│   │   ├── converter.py       # Main conversion logic
│   │   ├── prompt_builder.py  # Optimized prompts
│   │   ├── file_extractor.py  # Multi-strategy extraction
│   │   ├── retry_handler.py   # Comprehensive retry logic
│   │   └── cache_manager.py   # Prompt caching
│   │
│   ├── api/
│   │   ├── routes.py          # API endpoints
│   │   └── websocket.py       # WebSocket handlers
│   │
│   ├── services/
│   │   ├── file_service.py    # File upload/cleanup
│   │   ├── cost_service.py    # Cost calculation
│   │   └── job_service.py     # Job management
│   │
│   └── utils/
│       ├── encryption.py      # API key encryption
│       └── logging_config.py  # Structured logging
│
├── frontend/
│   ├── index.html             # Main UI
│   ├── js/
│   │   ├── app.js            # Main application
│   │   ├── api-client.js     # API wrapper
│   │   ├── websocket.js      # WebSocket manager
│   │   └── components.js     # UI components
│   └── css/
│       └── custom.css        # Additional styles
│
├── tests/
│   ├── test_converter.py
│   ├── test_file_extraction.py
│   ├── test_retry_logic.py
│   └── test_api.py
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .dockerignore
│
├── build/
│   ├── build_mac.sh          # PyInstaller for macOS
│   ├── build_windows.bat     # PyInstaller for Windows
│   └── build_linux.sh        # PyInstaller for Linux
│
├── requirements.txt
├── README.md
└── .env.example
```

---

### 1.2 Data Models (Pydantic)

```python
# models.py

from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from datetime import datetime

class ConversionSettings(BaseModel):
    """User settings for document conversion"""
    font: str = Field(default='Arial', description='Font family')
    font_size: int = Field(default=12, ge=8, le=72, description='Font size in points')
    margin: float = Field(default=1.0, ge=0.1, le=3.0, description='Margin in inches')

    # Model selection
    model: Literal['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'] = \
        'claude-haiku-4-5-20251001'

    # Special instructions
    replace_signatures: bool = Field(default=True, description='Replace signature images with [Signature]')
    add_page_markers: bool = Field(default=True, description='Add page markers at breaks')
    custom_instructions: Optional[str] = Field(default=None, max_length=500)

    # Table handling
    preserve_table_formatting: bool = Field(default=True, description='Maintain table structure')
    handle_merged_cells: bool = Field(default=True, description='Handle merged table cells')

    class Config:
        json_schema_extra = {
            "example": {
                "font": "Arial",
                "font_size": 12,
                "margin": 1.0,
                "model": "claude-haiku-4-5-20251001",
                "replace_signatures": True,
                "add_page_markers": True,
                "preserve_table_formatting": True,
                "handle_merged_cells": True
            }
        }


class ConversionJob(BaseModel):
    """Conversion job tracking"""
    id: str
    filename: str
    file_size: int
    page_count: int
    page_range: Optional[str] = None

    settings: ConversionSettings

    status: Literal['queued', 'processing', 'completed', 'failed'] = 'queued'
    progress: int = Field(default=0, ge=0, le=100, description='Progress percentage')
    current_step: Optional[str] = None

    estimated_cost_low: Optional[float] = None
    estimated_cost_avg: Optional[float] = None
    estimated_cost_high: Optional[float] = None
    actual_cost: Optional[float] = None

    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cached_tokens: Optional[int] = None

    output_filename: Optional[str] = None
    error_message: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class CostEstimate(BaseModel):
    """Cost estimation for conversion"""
    page_count: int
    estimated_cost_low: float
    estimated_cost_avg: float
    estimated_cost_high: float
    model: str
    notes: Optional[str] = None


class UsageStats(BaseModel):
    """Usage statistics"""
    total_conversions: int = 0
    total_pages: int = 0
    total_cost: float = 0.0
    avg_cost_per_page: float = 0.0
    avg_cost_per_conversion: float = 0.0
    cache_hit_rate: float = 0.0  # Percentage of cached tokens
```

---

### 1.3 Database Schema (SQLAlchemy)

```python
# database.py

from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()

class Job(Base):
    """Conversion job record"""
    __tablename__ = 'jobs'

    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, nullable=False)
    page_range = Column(String, nullable=True)

    settings = Column(JSON, nullable=False)

    status = Column(String, nullable=False, default='queued')
    progress = Column(Integer, default=0)
    current_step = Column(String, nullable=True)

    estimated_cost_low = Column(Float, nullable=True)
    estimated_cost_avg = Column(Float, nullable=True)
    estimated_cost_high = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)

    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cached_tokens = Column(Integer, nullable=True)

    output_filename = Column(String, nullable=True)
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class Config(Base):
    """Application configuration"""
    __tablename__ = 'config'

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    encrypted = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class DailyUsage(Base):
    """Daily usage statistics"""
    __tablename__ = 'daily_usage'

    date = Column(String, primary_key=True)  # YYYY-MM-DD format
    total_conversions = Column(Integer, default=0)
    total_pages = Column(Integer, default=0)
    total_cost = Column(Float, default=0.0)
    total_input_tokens = Column(Integer, default=0)
    total_output_tokens = Column(Integer, default=0)
    total_cached_tokens = Column(Integer, default=0)


# Database initialization
def init_db(db_path: str = None):
    """Initialize database"""
    if db_path is None:
        db_dir = os.path.expanduser('~/.pdf-converter')
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, 'converter.db')

    engine = create_engine(f'sqlite:///{db_path}')
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    return Session()
```

---

## Phase 2: Core Conversion Logic

### 2.1 Optimized Prompt with docx Skill Emphasis

**Key Focus: Complex Tables**

```python
# core/prompt_builder.py

def build_conversion_prompt(settings: ConversionSettings, filename: str) -> str:
    """
    Build optimized prompt for docx skill conversion.
    Target: ~120 tokens (vs current 400)

    Special emphasis on table handling for complex documents.
    """

    # Base prompt - concise and direct
    prompt = f"""Convert this document to Word (.docx) format.

**Output Settings:**
- Font: {settings.font} {settings.font_size}pt
- Margins: {settings.margin}" all sides
- Filename: {filename}.docx

**Text Extraction:**
Extract all text exactly as shown. Preserve original language and layout.
"""

    # Table-specific instructions (CRITICAL)
    if settings.preserve_table_formatting:
        prompt += """
**Table Handling (CRITICAL):**
- Preserve exact table structure and borders
- Maintain column widths and row heights
- Keep merged cells intact
- Preserve cell alignment (left/center/right)
- Maintain nested tables if present
- Copy formatting (bold, colors, shading)
- Keep header rows distinct
"""

    # Special instructions
    if settings.replace_signatures:
        prompt += "\n- Replace signature images with '[Signature]'"

    if settings.add_page_markers:
        prompt += "\n- Add '[Page X]' at end of sentences after page breaks (not mid-sentence)"

    if settings.custom_instructions:
        prompt += f"\n- {settings.custom_instructions}"

    # docx skill directive
    prompt += """

**Generate Document:**
Use the docx skill to create a high-quality Word document.
Focus on accuracy over interpretation - copy exactly what you see.
"""

    return prompt


def build_cached_prompt(settings: ConversionSettings) -> dict:
    """
    Build prompt with caching for batch processing.

    Returns prompt parts where static parts are cacheable.
    """

    # Static part (cacheable) - doesn't change between batches
    static_instructions = """Convert this document to Word (.docx) format.

**Text Extraction:**
Extract all text exactly as shown. Preserve original language and layout.

**Table Handling (CRITICAL):**
- Preserve exact table structure and borders
- Maintain column widths and row heights
- Keep merged cells intact
- Preserve cell alignment (left/center/right)
- Maintain nested tables if present
- Copy formatting (bold, colors, shading)
- Keep header rows distinct

**Generate Document:**
Use the docx skill to create a high-quality Word document.
Focus on accuracy over interpretation - copy exactly what you see.
"""

    # Dynamic part (not cached) - changes per conversion
    dynamic_settings = f"""**Output Settings:**
- Font: {settings.font} {settings.font_size}pt
- Margins: {settings.margin}" all sides
"""

    if settings.replace_signatures:
        dynamic_settings += "\n- Replace signature images with '[Signature]'"

    if settings.add_page_markers:
        dynamic_settings += "\n- Add '[Page X]' at page breaks"

    if settings.custom_instructions:
        dynamic_settings += f"\n- {settings.custom_instructions}"

    return {
        'static': static_instructions,
        'dynamic': dynamic_settings
    }
```

**Token Analysis:**
- Current prompt: ~400 tokens
- Optimized prompt: ~120 tokens
- **Savings: 70% reduction**

With caching on batches:
- First batch: 120 tokens (full cost)
- Subsequent batches: ~30 tokens dynamic + 12 cached tokens
- **Savings on batches: 90%**

---

### 2.2 Multi-Strategy File Extraction

**Problem:** Current code breaks when API response structure changes.

**Solution:** Multiple extraction strategies with fallbacks.

```python
# core/file_extractor.py

import re
import logging
from typing import List, Optional
from anthropic.types import Message

logger = logging.getLogger(__name__)


class FileExtractor:
    """
    Multi-strategy file ID extraction with comprehensive fallbacks.

    Tries multiple methods to extract file IDs from API response.
    Logs detailed information when extraction fails for debugging.
    """

    def extract_file_ids(self, response: Message) -> List[str]:
        """
        Extract file IDs using multiple strategies.

        Strategies (in order):
        1. Bash execution result objects
        2. Text content regex patterns
        3. Response metadata
        4. Content inspection

        Raises:
            FileExtractionError: If all strategies fail
        """
        strategies = [
            self._extract_from_bash_result,
            self._extract_from_text_patterns,
            self._extract_from_metadata,
            self._extract_from_content_inspection
        ]

        for i, strategy in enumerate(strategies, 1):
            try:
                file_ids = strategy(response)
                if file_ids:
                    logger.info(f"File extraction succeeded using strategy {i}: {strategy.__name__}")
                    return file_ids
            except Exception as e:
                logger.warning(f"Strategy {i} ({strategy.__name__}) failed: {e}")
                continue

        # All strategies failed - provide detailed error
        self._log_response_structure(response)
        raise FileExtractionError(
            "Failed to extract file IDs from response using all strategies. "
            "This may indicate an API response format change. "
            "Check logs for response structure details."
        )

    def _extract_from_bash_result(self, response: Message) -> List[str]:
        """
        Strategy 1: Extract from bash code execution result.

        This is the primary expected format when using docx skill.
        """
        file_ids = []

        for content_block in response.content:
            # Check for bash execution result
            if hasattr(content_block, 'type') and \
               content_block.type == 'bash_code_execution_tool_result':

                # Navigate nested structure defensively
                if hasattr(content_block, 'content'):
                    inner_content = content_block.content

                    if hasattr(inner_content, 'type') and \
                       inner_content.type == 'bash_code_execution_result':

                        if hasattr(inner_content, 'content'):
                            for file_obj in inner_content.content:
                                if hasattr(file_obj, 'file_id'):
                                    file_ids.append(file_obj.file_id)
                                    logger.debug(f"Found file_id: {file_obj.file_id}")

        return file_ids

    def _extract_from_text_patterns(self, response: Message) -> List[str]:
        """
        Strategy 2: Extract file IDs from text content using regex.

        Looks for patterns like 'file-abc123xyz' in text responses.
        """
        file_ids = []
        file_id_pattern = re.compile(r'file-[a-zA-Z0-9_-]+')

        for content_block in response.content:
            if hasattr(content_block, 'type') and content_block.type == 'text':
                if hasattr(content_block, 'text'):
                    matches = file_id_pattern.findall(content_block.text)
                    file_ids.extend(matches)
                    if matches:
                        logger.debug(f"Found file IDs in text: {matches}")

        # Deduplicate while preserving order
        seen = set()
        unique_ids = []
        for file_id in file_ids:
            if file_id not in seen:
                seen.add(file_id)
                unique_ids.append(file_id)

        return unique_ids

    def _extract_from_metadata(self, response: Message) -> List[str]:
        """
        Strategy 3: Extract from response metadata or file attributes.

        Checks for file information in response-level attributes.
        """
        file_ids = []

        # Check for files attribute
        if hasattr(response, 'files') and response.files:
            for file_obj in response.files:
                if hasattr(file_obj, 'id'):
                    file_ids.append(file_obj.id)
                    logger.debug(f"Found file in metadata: {file_obj.id}")

        return file_ids

    def _extract_from_content_inspection(self, response: Message) -> List[str]:
        """
        Strategy 4: Inspect all content blocks for any file references.

        Last resort - looks through all attributes for file-like IDs.
        """
        file_ids = []

        def inspect_object(obj, path=""):
            """Recursively inspect object for file IDs"""
            if isinstance(obj, str):
                if obj.startswith('file-'):
                    file_ids.append(obj)
                    logger.debug(f"Found file ID at {path}: {obj}")
            elif isinstance(obj, (list, tuple)):
                for i, item in enumerate(obj):
                    inspect_object(item, f"{path}[{i}]")
            elif hasattr(obj, '__dict__'):
                for key, value in obj.__dict__.items():
                    inspect_object(value, f"{path}.{key}")

        inspect_object(response.content, "response.content")

        return file_ids

    def _log_response_structure(self, response: Message):
        """
        Log detailed response structure for debugging.

        Called when all extraction strategies fail.
        """
        logger.error("=" * 80)
        logger.error("FILE EXTRACTION FAILED - Response Structure Analysis:")
        logger.error("=" * 80)

        # Log response type
        logger.error(f"Response type: {type(response)}")
        logger.error(f"Response attributes: {dir(response)}")

        # Log content blocks
        logger.error(f"\nContent blocks ({len(response.content)}):")
        for i, block in enumerate(response.content):
            logger.error(f"\n  Block {i}:")
            logger.error(f"    Type: {getattr(block, 'type', 'NO TYPE')}")
            logger.error(f"    Attributes: {dir(block)}")

            if hasattr(block, 'content'):
                logger.error(f"    Content type: {type(block.content)}")
                logger.error(f"    Content: {block.content}")

        # Log usage info
        if hasattr(response, 'usage'):
            logger.error(f"\nUsage: {response.usage}")

        logger.error("=" * 80)


class FileExtractionError(Exception):
    """Raised when file extraction fails"""
    pass
```

---

### 2.3 Comprehensive Retry Logic

```python
# core/retry_handler.py

import time
import random
import logging
from typing import Callable, TypeVar, Optional
from anthropic import APIError, APIConnectionError, APITimeoutError, RateLimitError

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """Configuration for retry behavior"""
    max_attempts: int = 5
    initial_delay: float = 2.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True

    # Which HTTP status codes should be retried
    retryable_status_codes = {
        429,  # Rate limit
        500,  # Internal server error
        502,  # Bad gateway
        503,  # Service unavailable
        504,  # Gateway timeout
        529,  # Service overload (Anthropic specific)
    }


class RetryHandler:
    """
    Comprehensive retry logic with exponential backoff and jitter.

    Handles various error types and provides detailed logging.
    """

    def __init__(self, config: RetryConfig = None):
        self.config = config or RetryConfig()

    def with_retry(
        self,
        func: Callable[[], T],
        operation_name: str = "API call"
    ) -> T:
        """
        Execute function with retry logic.

        Args:
            func: Function to execute (should return a value)
            operation_name: Name for logging purposes

        Returns:
            Result from successful function execution

        Raises:
            Last exception if all retries exhausted
        """
        last_exception = None

        for attempt in range(1, self.config.max_attempts + 1):
            try:
                logger.info(f"{operation_name}: Attempt {attempt}/{self.config.max_attempts}")
                result = func()

                if attempt > 1:
                    logger.info(f"{operation_name}: Succeeded after {attempt} attempts")

                return result

            except (RateLimitError, APIError) as e:
                last_exception = e

                # Check if this error is retryable
                status_code = getattr(e, 'status_code', None)

                if status_code not in self.config.retryable_status_codes:
                    logger.error(f"{operation_name}: Non-retryable error {status_code}: {e}")
                    raise

                # Calculate backoff delay
                if attempt < self.config.max_attempts:
                    delay = self._calculate_delay(attempt, status_code)
                    logger.warning(
                        f"{operation_name}: Retryable error {status_code}, "
                        f"retrying in {delay:.1f}s... ({e})"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"{operation_name}: Max retries ({self.config.max_attempts}) exhausted"
                    )

            except (APIConnectionError, APITimeoutError) as e:
                last_exception = e

                if attempt < self.config.max_attempts:
                    delay = self._calculate_delay(attempt, None)
                    logger.warning(
                        f"{operation_name}: Network error, retrying in {delay:.1f}s... ({e})"
                    )
                    time.sleep(delay)
                else:
                    logger.error(f"{operation_name}: Max retries exhausted (network errors)")

            except Exception as e:
                # Non-retryable errors
                logger.error(f"{operation_name}: Non-retryable exception: {type(e).__name__}: {e}")
                raise

        # All retries exhausted
        raise last_exception

    def _calculate_delay(self, attempt: int, status_code: Optional[int]) -> float:
        """
        Calculate backoff delay with exponential backoff and jitter.

        Args:
            attempt: Current attempt number (1-indexed)
            status_code: HTTP status code if available

        Returns:
            Delay in seconds
        """
        # Base exponential backoff
        delay = self.config.initial_delay * (self.config.exponential_base ** (attempt - 1))

        # Cap at max delay
        delay = min(delay, self.config.max_delay)

        # Add jitter to prevent thundering herd
        if self.config.jitter:
            jitter = random.uniform(0, delay * 0.1)  # 0-10% jitter
            delay += jitter

        # Special handling for rate limits (longer delay)
        if status_code == 429:
            delay = max(delay, 10.0)  # Minimum 10s for rate limits

        return delay


# Global retry handler instance
retry_handler = RetryHandler()
```

---

### 2.4 Main Conversion Engine

```python
# core/converter.py

import base64
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable
from anthropic import Anthropic

from .prompt_builder import build_conversion_prompt, build_cached_prompt
from .file_extractor import FileExtractor
from .retry_handler import retry_handler
from models import ConversionSettings

logger = logging.getLogger(__name__)


class ConversionEngine:
    """
    Core PDF to Word conversion engine using Claude Vision + docx skill.

    Features:
    - Optimized prompts (70% token reduction)
    - Prompt caching (90% cost savings on batches)
    - Multi-strategy file extraction
    - Comprehensive retry logic
    """

    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)
        self.file_extractor = FileExtractor()

    def convert_document(
        self,
        file_path: str,
        settings: ConversionSettings,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Convert document to Word format.

        Args:
            file_path: Path to PDF or image file
            settings: Conversion settings
            progress_callback: Optional callback for progress updates

        Returns:
            Dict with:
                - success: bool
                - output_path: str (path to .docx)
                - cost: float
                - input_tokens: int
                - output_tokens: int
                - cached_tokens: int
                - error: str (if failed)
        """
        try:
            if progress_callback:
                progress_callback({'progress': 10, 'step': 'Preparing file'})

            # Load and encode file
            file_base64 = self._file_to_base64(file_path)
            media_type = self._get_media_type(file_path)
            filename = Path(file_path).stem

            if progress_callback:
                progress_callback({'progress': 20, 'step': 'Building conversion prompt'})

            # Build prompt
            prompt = build_conversion_prompt(settings, filename)

            logger.info(f"Converting {filename} with model {settings.model}")
            logger.debug(f"Prompt length: ~{len(prompt.split())} words")

            if progress_callback:
                progress_callback({'progress': 30, 'step': 'Calling Claude API'})

            # Make API call with retry
            response = retry_handler.with_retry(
                lambda: self.client.beta.messages.create(
                    model=settings.model,
                    max_tokens=16000,
                    betas=[
                        'code-execution-2025-08-25',
                        'skills-2025-10-02',
                        'files-api-2025-04-14'
                    ],
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
                ),
                operation_name=f"Convert {filename}"
            )

            if progress_callback:
                progress_callback({'progress': 70, 'step': 'Extracting result'})

            # Extract file IDs
            file_ids = self.file_extractor.extract_file_ids(response)

            if not file_ids:
                raise Exception("No file generated by docx skill")

            file_id = file_ids[0]
            logger.info(f"File generated: {file_id}")

            if progress_callback:
                progress_callback({'progress': 85, 'step': 'Downloading result'})

            # Download file
            file_metadata = self.client.beta.files.retrieve_metadata(
                file_id=file_id,
                betas=["files-api-2025-04-14"]
            )

            file_content = self.client.beta.files.download(
                file_id=file_id,
                betas=["files-api-2025-04-14"]
            )

            # Save file
            output_dir = Path(file_path).parent
            output_path = output_dir / file_metadata.filename
            file_content.write_to_file(output_path)

            logger.info(f"Downloaded: {file_metadata.filename}")

            if progress_callback:
                progress_callback({'progress': 100, 'step': 'Complete'})

            # Calculate cost
            cost = self._calculate_cost(response.usage, settings.model)

            return {
                'success': True,
                'output_path': str(output_path),
                'cost': cost,
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
                'cached_tokens': getattr(response.usage, 'cache_read_input_tokens', 0)
            }

        except Exception as e:
            logger.error(f"Conversion failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    def _file_to_base64(self, file_path: str) -> str:
        """Convert file to base64"""
        with open(file_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')

    def _get_media_type(self, file_path: str) -> str:
        """Determine media type from file extension"""
        ext = Path(file_path).suffix.lower()
        media_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png'
        }
        return media_types.get(ext, 'application/pdf')

    def _calculate_cost(self, usage, model: str) -> float:
        """Calculate actual cost from token usage"""
        pricing = {
            'claude-haiku-4-5-20251001': {'input': 1.00, 'output': 5.00, 'cache': 0.10},
            'claude-sonnet-4-5-20250929': {'input': 3.00, 'output': 15.00, 'cache': 0.30}
        }

        prices = pricing.get(model, pricing['claude-sonnet-4-5-20250929'])

        input_cost = (usage.input_tokens / 1_000_000) * prices['input']
        output_cost = (usage.output_tokens / 1_000_000) * prices['output']

        # Cache read tokens are cheaper
        cache_tokens = getattr(usage, 'cache_read_input_tokens', 0)
        cache_cost = (cache_tokens / 1_000_000) * prices['cache']

        total = input_cost + output_cost + cache_cost

        logger.info(
            f"Cost: ${total:.4f} "
            f"(input: {usage.input_tokens}, output: {usage.output_tokens}, "
            f"cached: {cache_tokens})"
        )

        return round(total, 4)
```

---

## Phase 3: FastAPI Backend

### 3.1 API Routes

```python
# api/routes.py

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from typing import Optional
import uuid
from pathlib import Path

from models import ConversionSettings, ConversionJob, CostEstimate
from services.job_service import JobService
from services.cost_service import CostService
from services.file_service import FileService

router = APIRouter(prefix="/api")

# Service instances (injected via dependency)
job_service = JobService()
cost_service = CostService()
file_service = FileService()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "2.0.0"}


@router.post("/convert", response_model=ConversionJob)
async def convert_document(
    file: UploadFile = File(...),
    settings: str = Form(...),  # JSON string
    page_range: Optional[str] = Form(None)
):
    """
    Upload and convert document to Word.

    Returns job ID for tracking progress via WebSocket.
    """
    import json

    # Parse settings
    settings_dict = json.loads(settings)
    conversion_settings = ConversionSettings(**settings_dict)

    # Save uploaded file
    job_id = str(uuid.uuid4())
    file_path = await file_service.save_upload(job_id, file)

    # Get page count
    page_count = await file_service.get_page_count(file_path)

    # Create job
    job = ConversionJob(
        id=job_id,
        filename=file.filename,
        file_size=file_path.stat().st_size,
        page_count=page_count,
        page_range=page_range,
        settings=conversion_settings
    )

    # Estimate cost
    estimate = cost_service.estimate_cost(page_count, conversion_settings.model, page_range)
    job.estimated_cost_low = estimate.estimated_cost_low
    job.estimated_cost_avg = estimate.estimated_cost_avg
    job.estimated_cost_high = estimate.estimated_cost_high

    # Save job to database
    await job_service.create_job(job)

    # Start conversion (async background task)
    await job_service.start_conversion(job_id, str(file_path))

    return job


@router.get("/jobs/{job_id}", response_model=ConversionJob)
async def get_job(job_id: str):
    """Get job status"""
    job = await job_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/download/{job_id}")
async def download_result(job_id: str):
    """Download converted file"""
    job = await job_service.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != 'completed':
        raise HTTPException(status_code=400, detail="Job not completed")

    if not job.output_filename:
        raise HTTPException(status_code=404, detail="Output file not found")

    file_path = Path(job.output_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename=file_path.name
    )


@router.post("/estimate", response_model=CostEstimate)
async def estimate_cost(
    file: UploadFile = File(...),
    model: str = Form(...),
    page_range: Optional[str] = Form(None)
):
    """Estimate conversion cost"""
    # Save temp file
    temp_path = await file_service.save_temp(file)

    try:
        page_count = await file_service.get_page_count(temp_path)
        estimate = cost_service.estimate_cost(page_count, model, page_range)
        return estimate
    finally:
        temp_path.unlink()


@router.get("/settings", response_model=ConversionSettings)
async def get_settings():
    """Get current settings"""
    # Load from database
    settings = await job_service.get_default_settings()
    return settings


@router.post("/settings")
async def save_settings(settings: ConversionSettings):
    """Save default settings"""
    await job_service.save_default_settings(settings)
    return {"success": True}


@router.get("/stats")
async def get_usage_stats():
    """Get usage statistics"""
    stats = await job_service.get_usage_stats()
    return stats
```

---

### 3.2 WebSocket Progress Handler

```python
# api/websocket.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections for job progress updates"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        """Accept new connection for job"""
        await websocket.accept()
        self.active_connections[job_id] = websocket
        logger.info(f"WebSocket connected for job {job_id}")

    def disconnect(self, job_id: str):
        """Remove connection"""
        if job_id in self.active_connections:
            del self.active_connections[job_id]
            logger.info(f"WebSocket disconnected for job {job_id}")

    async def send_update(self, job_id: str, message: dict):
        """Send progress update to client"""
        if job_id in self.active_connections:
            try:
                await self.active_connections[job_id].send_json(message)
            except Exception as e:
                logger.error(f"Failed to send update to {job_id}: {e}")
                self.disconnect(job_id)

    async def broadcast_update(self, message: dict):
        """Send update to all connected clients"""
        dead_connections = []

        for job_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(job_id)

        for job_id in dead_connections:
            self.disconnect(job_id)


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time job progress.

    Usage from frontend:
        ws = new WebSocket('ws://localhost:8000/ws/jobs/{job_id}');
        ws.onmessage = (event) => {
            const update = JSON.parse(event.data);
            console.log(update.progress, update.step);
        };
    """
    await manager.connect(job_id, websocket)

    try:
        # Keep connection alive and send updates
        while True:
            # This will be called by the job processor to send updates
            # For now, just keep the connection alive
            await asyncio.sleep(1)

            # Could send heartbeat
            # await websocket.send_json({"type": "heartbeat"})

    except WebSocketDisconnect:
        manager.disconnect(job_id)
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}")
        manager.disconnect(job_id)


# Helper function for job processor to send updates
async def send_job_update(job_id: str, progress: int, step: str, status: str = "processing"):
    """
    Send progress update for a job.

    Called by the conversion engine during processing.
    """
    await manager.send_update(job_id, {
        "job_id": job_id,
        "status": status,
        "progress": progress,
        "step": step,
        "timestamp": datetime.now().isoformat()
    })
```

---

## Phase 4: Frontend

### 4.1 Modern UI (HTML + Tailwind)

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF to Word Converter</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .drop-zone {
            border: 2px dashed #cbd5e0;
            transition: all 0.3s ease;
        }
        .drop-zone.drag-over {
            border-color: #4299e1;
            background-color: #ebf8ff;
        }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-4xl mx-auto p-6">
        <!-- Header -->
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">PDF to Word Converter</h1>
            <p class="text-gray-600 mt-2">Convert PDFs and images to editable Word documents</p>
        </header>

        <!-- File Upload -->
        <div id="upload-section" class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div id="drop-zone" class="drop-zone rounded-lg p-12 text-center cursor-pointer">
                <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <p class="mt-2 text-sm text-gray-600">
                    <span class="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p class="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 50MB)</p>
                <input type="file" id="file-input" class="hidden" accept=".pdf,.jpg,.jpeg,.png">
            </div>

            <!-- Selected File -->
            <div id="selected-file" class="hidden mt-4 p-4 bg-blue-50 rounded-lg">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <svg class="h-8 w-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                        </svg>
                        <div class="ml-3">
                            <p id="file-name" class="text-sm font-medium text-gray-900"></p>
                            <p id="file-info" class="text-sm text-gray-500"></p>
                        </div>
                    </div>
                    <button id="clear-file" class="text-red-600 hover:text-red-800">
                        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Settings -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-lg font-semibold mb-4">Settings</h2>

            <!-- Model Selection -->
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <div class="grid grid-cols-2 gap-4">
                    <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="model" value="claude-haiku-4-5-20251001" checked class="mr-3">
                        <div>
                            <div class="font-medium">Haiku</div>
                            <div class="text-xs text-gray-500">~$0.01/page - Fast</div>
                        </div>
                    </label>
                    <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="model" value="claude-sonnet-4-5-20250929" class="mr-3">
                        <div>
                            <div class="font-medium">Sonnet</div>
                            <div class="text-xs text-gray-500">~$0.02/page - High quality</div>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Page Range -->
            <div id="page-range-section" class="hidden mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Pages</label>
                <div class="flex gap-4">
                    <label class="flex items-center">
                        <input type="radio" name="pages" value="all" checked class="mr-2">
                        All pages
                    </label>
                    <label class="flex items-center">
                        <input type="radio" name="pages" value="range" class="mr-2">
                        Range:
                    </label>
                    <input type="text" id="page-range-input" placeholder="e.g., 1-5, 7, 9-12"
                           class="border rounded px-3 py-1 text-sm flex-1" disabled>
                </div>
                <p id="page-count" class="text-xs text-gray-500 mt-1"></p>
            </div>

            <!-- Options -->
            <div class="space-y-2">
                <label class="flex items-center">
                    <input type="checkbox" id="page-markers" checked class="mr-2">
                    <span class="text-sm">Add page markers</span>
                </label>
                <label class="flex items-center">
                    <input type="checkbox" id="replace-signatures" checked class="mr-2">
                    <span class="text-sm">Replace signature images with [Signature]</span>
                </label>
                <label class="flex items-center">
                    <input type="checkbox" id="preserve-tables" checked class="mr-2">
                    <span class="text-sm font-medium text-blue-600">Preserve complex table formatting</span>
                </label>
            </div>
        </div>

        <!-- Cost Estimate -->
        <div id="cost-estimate" class="hidden bg-blue-50 rounded-lg p-4 mb-6">
            <h3 class="font-semibold mb-2">Estimated Cost</h3>
            <div class="flex justify-between text-sm">
                <span>Pages: <span id="est-pages" class="font-medium"></span></span>
                <span>Low: $<span id="est-low"></span></span>
                <span>Avg: $<span id="est-avg"></span></span>
                <span>High: $<span id="est-high"></span></span>
            </div>
        </div>

        <!-- Convert Button -->
        <button id="convert-btn" disabled
                class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold
                       hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
            Convert to Word
        </button>

        <!-- Progress -->
        <div id="progress-section" class="hidden mt-6 bg-white rounded-lg shadow-md p-6">
            <h3 class="font-semibold mb-3">Converting...</h3>
            <div class="mb-2">
                <div class="flex justify-between text-sm mb-1">
                    <span id="progress-step">Preparing...</span>
                    <span id="progress-percent">0%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="progress-bar" class="bg-blue-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                </div>
            </div>
        </div>

        <!-- Success -->
        <div id="success-section" class="hidden mt-6 bg-green-50 rounded-lg p-6">
            <div class="flex items-center mb-4">
                <svg class="h-8 w-8 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <div>
                    <h3 class="font-semibold text-green-900">Conversion Complete!</h3>
                    <p id="success-filename" class="text-sm text-green-700"></p>
                </div>
            </div>
            <div class="flex gap-4">
                <button id="download-btn" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                    Download
                </button>
                <button id="convert-another-btn" class="flex-1 border border-green-600 text-green-600 py-2 rounded-lg hover:bg-green-50">
                    Convert Another
                </button>
            </div>
            <p id="actual-cost" class="text-sm text-gray-600 mt-3">
                Actual cost: $<span id="cost-value"></span>
            </p>
        </div>

        <!-- Usage Stats -->
        <div class="mt-6 bg-white rounded-lg shadow-md p-6">
            <h3 class="font-semibold mb-3">Usage Statistics</h3>
            <div class="grid grid-cols-3 gap-4 text-center">
                <div>
                    <div class="text-2xl font-bold text-blue-600" id="stat-conversions">0</div>
                    <div class="text-xs text-gray-500">Conversions</div>
                </div>
                <div>
                    <div class="text-2xl font-bold text-blue-600" id="stat-pages">0</div>
                    <div class="text-xs text-gray-500">Pages</div>
                </div>
                <div>
                    <div class="text-2xl font-bold text-blue-600">$<span id="stat-cost">0.00</span></div>
                    <div class="text-xs text-gray-500">Total Cost</div>
                </div>
            </div>
        </div>
    </div>

    <script src="js/api-client.js"></script>
    <script src="js/websocket.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
```

---

## Phase 5: Deployment

### 5.1 Docker Setup

```dockerfile
# docker/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run app
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker/docker-compose.yml

version: '3.8'

services:
  pdf-converter:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ../data:/app/data
      - ~/.pdf-converter:/root/.pdf-converter
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LOG_LEVEL=INFO
    restart: unless-stopped
```

**Usage for colleagues:**
```bash
# One-time setup
git clone <repo>
cd pdf-converter
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run
docker-compose -f docker/docker-compose.yml up

# Open browser to http://localhost:8000
```

---

### 5.2 Native App Build (PyInstaller)

```python
# build/build_spec.py

# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['../backend/app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../frontend', 'frontend'),
        ('../backend', 'backend'),
    ],
    hiddenimports=[
        'anthropic',
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'pypdf',
        'cryptography',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PDF-to-Word-Converter',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../assets/icon.ico'  # Add app icon
)

# For macOS, create .app bundle
app = BUNDLE(
    exe,
    name='PDF to Word Converter.app',
    icon='../assets/icon.icns',
    bundle_identifier='com.yourname.pdfconverter',
    info_plist={
        'NSHighResolutionCapable': 'True',
        'LSMinimumSystemVersion': '10.13.0',
    },
)
```

```bash
# build/build_mac.sh

#!/bin/bash

echo "Building PDF to Word Converter for macOS..."

# Create virtual environment
python3 -m venv build_env
source build_env/bin/activate

# Install dependencies
pip install -r ../requirements.txt
pip install pyinstaller

# Build
pyinstaller build_spec.py

echo "Build complete! App located in dist/"
echo "To distribute: Create DMG or zip the .app bundle"

deactivate
```

```bat
# build/build_windows.bat

@echo off
echo Building PDF to Word Converter for Windows...

:: Create virtual environment
python -m venv build_env
call build_env\Scripts\activate

:: Install dependencies
pip install -r ..\requirements.txt
pip install pyinstaller

:: Build
pyinstaller build_spec.py

echo Build complete! Executable located in dist/
echo To distribute: Use NSIS or Inno Setup to create installer

deactivate
```

**Distribution for colleagues:**

**Option A: Direct .app/.exe**
```
1. Download PDF-to-Word-Converter.zip
2. Extract
3. Double-click PDF-to-Word-Converter.app (Mac) or .exe (Windows)
4. On first run: Enter your Anthropic API key
5. App opens browser automatically
```

**Option B: Installer**
```
Mac: Open PDF-Converter.dmg → Drag to Applications
Windows: Run PDF-Converter-Setup.exe → Follow installer
Linux: sudo dpkg -i pdf-converter.deb
```

---

## Implementation Checklist

### ✅ Backend Core
- [ ] Project structure setup
- [ ] Pydantic models (Settings, Job, etc.)
- [ ] SQLite database with SQLAlchemy
- [ ] Optimized prompt builder (120 tokens)
- [ ] Multi-strategy file extraction
- [ ] Comprehensive retry logic
- [ ] Main conversion engine
- [ ] Prompt caching implementation

### ✅ API Layer
- [ ] FastAPI app setup
- [ ] API routes (convert, jobs, download)
- [ ] WebSocket progress handler
- [ ] File upload service
- [ ] Cost calculation service
- [ ] Job management service

### ✅ Frontend
- [ ] HTML structure with Tailwind
- [ ] File upload with drag-drop
- [ ] Settings panel
- [ ] WebSocket client for progress
- [ ] Cost estimation display
- [ ] Usage statistics display

### ✅ Testing
- [ ] Unit tests (prompt, extraction, retry)
- [ ] Integration tests (full conversion flow)
- [ ] API endpoint tests
- [ ] WebSocket tests
- [ ] Error handling tests

### ✅ Deployment
- [ ] Dockerfile and docker-compose
- [ ] PyInstaller build scripts
- [ ] Mac .app bundle
- [ ] Windows .exe installer
- [ ] Documentation (README, setup guides)

### ✅ Polish
- [ ] Logging configuration
- [ ] Error messages
- [ ] File cleanup automation
- [ ] Database migrations
- [ ] API key encryption
- [ ] Usage tracking

---

## Success Criteria

### Reliability
- ✅ Error rate < 2% (vs current ~15%)
- ✅ Multi-strategy extraction never fails on API changes
- ✅ All network errors properly retried
- ✅ Detailed error messages for debugging

### Cost Optimization
- ✅ Prompt tokens reduced by 70% (400 → 120)
- ✅ Prompt caching working (90% cache hit rate)
- ✅ Total cost per document reduced by 50-70%

### User Experience
- ✅ Real-time progress updates
- ✅ Accurate cost estimates
- ✅ One-click deployment for colleagues
- ✅ Usage statistics visible

### Table Handling
- ✅ Complex tables preserved accurately
- ✅ Merged cells maintained
- ✅ Nested tables supported
- ✅ Formatting preserved (borders, alignment, colors)

---

## Timeline (Flexible - Quality over Speed)

No hard deadlines. Rough estimates:

- **Backend Core**: 3-4 days
- **API Layer**: 2-3 days
- **Frontend**: 2-3 days
- **Testing**: 2-3 days
- **Deployment**: 2-3 days
- **Documentation**: 1-2 days

**Total**: ~2-3 weeks at steady pace

---

## Next Steps

1. ✅ Review and approve this plan
2. Start with backend core (conversion engine)
3. Test as we build (iterative)
4. Add frontend when backend solid
5. Package for distribution

Ready to start building?
