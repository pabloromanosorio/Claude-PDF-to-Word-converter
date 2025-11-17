"""
Pydantic models for PDF to Word converter.

These models define the data structures for:
- Conversion settings
- Jobs (conversion requests)
- Cost estimates
- Usage statistics
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from datetime import datetime


class ConversionSettings(BaseModel):
    """User settings for document conversion"""

    # Formatting override option (resolves contradiction!)
    override_formatting: bool = Field(default=False, description='Override original formatting with custom settings')

    # Font settings (only used if override_formatting=True)
    font: str = Field(default='Arial', description='Font family')
    font_size: int = Field(default=12, ge=8, le=72, description='Font size in points')

    # Margins (only used if override_formatting=True)
    margin_top: float = Field(default=1.0, ge=0.1, le=3.0, description='Top margin in inches')
    margin_bottom: float = Field(default=1.0, ge=0.1, le=3.0, description='Bottom margin in inches')
    margin_left: float = Field(default=1.0, ge=0.1, le=3.0, description='Left margin in inches')
    margin_right: float = Field(default=1.0, ge=0.1, le=3.0, description='Right margin in inches')

    # Model selection
    model: Literal['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'] = \
        Field(default='claude-haiku-4-5-20251001', description='Claude model to use (Haiku is 3x cheaper)')

    # Processing mode
    use_text_extraction: bool = Field(
        default=False,
        description='Extract text instead of vision (90% cheaper, but loses images/formatting)'
    )

    # Document processing options
    replace_signatures: bool = Field(default=True, description='Replace signature images with [Signature]')
    add_page_markers: bool = Field(default=True, description='Add page markers starting from page 2')

    # Table handling (CRITICAL for complex documents)
    preserve_table_formatting: bool = Field(default=True, description='Maintain table structure')
    handle_merged_cells: bool = Field(default=True, description='Handle merged table cells')

    # Custom instructions
    custom_instructions: Optional[str] = Field(default=None, max_length=500, description='Additional instructions')

    @validator('model')
    def validate_model(cls, v):
        """Ensure model is valid"""
        valid_models = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929']
        if v not in valid_models:
            raise ValueError(f'Model must be one of: {valid_models}')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "font": "Arial",
                "font_size": 12,
                "margin_top": 1.0,
                "margin_bottom": 1.0,
                "margin_left": 1.0,
                "margin_right": 1.0,
                "model": "claude-haiku-4-5-20251001",
                "replace_signatures": True,
                "add_page_markers": True,
                "preserve_table_formatting": True,
                "handle_merged_cells": True,
                "custom_instructions": None
            }
        }


class ConversionJob(BaseModel):
    """Conversion job tracking"""

    # Job identification
    id: str = Field(description='Unique job ID')
    filename: str = Field(description='Original filename')
    file_size: int = Field(description='File size in bytes')
    page_count: int = Field(description='Number of pages')
    page_range: Optional[str] = Field(default=None, description='Page range (e.g., "1-5, 7")')

    # Settings
    settings: ConversionSettings = Field(description='Conversion settings')

    # Status tracking
    status: Literal['queued', 'processing', 'completed', 'failed'] = Field(default='queued')
    progress: int = Field(default=0, ge=0, le=100, description='Progress percentage')
    current_step: Optional[str] = Field(default=None, description='Current processing step')

    # Cost tracking
    estimated_cost_low: Optional[float] = Field(default=None, description='Low cost estimate')
    estimated_cost_avg: Optional[float] = Field(default=None, description='Average cost estimate')
    estimated_cost_high: Optional[float] = Field(default=None, description='High cost estimate')
    actual_cost: Optional[float] = Field(default=None, description='Actual cost incurred')

    # Token usage
    input_tokens: Optional[int] = Field(default=None, description='Input tokens used')
    output_tokens: Optional[int] = Field(default=None, description='Output tokens used')
    cached_tokens: Optional[int] = Field(default=None, description='Cached tokens (cost savings)')

    # Output
    output_filename: Optional[str] = Field(default=None, description='Output file path')
    error_message: Optional[str] = Field(default=None, description='Error message if failed')

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "filename": "document.pdf",
                "file_size": 1048576,
                "page_count": 10,
                "page_range": None,
                "settings": ConversionSettings.Config.json_schema_extra["example"],
                "status": "processing",
                "progress": 45,
                "current_step": "Processing page 5 of 10",
                "estimated_cost_low": 0.08,
                "estimated_cost_avg": 0.10,
                "estimated_cost_high": 0.12,
                "actual_cost": None,
                "created_at": "2025-01-13T10:00:00"
            }
        }


class CostEstimate(BaseModel):
    """Cost estimation for conversion"""

    page_count: int = Field(description='Number of pages to convert')
    estimated_cost_low: float = Field(description='Low estimate (simple pages)')
    estimated_cost_avg: float = Field(description='Average estimate')
    estimated_cost_high: float = Field(description='High estimate (complex pages)')
    model: str = Field(description='Model used for estimation')
    notes: Optional[str] = Field(default=None, description='Additional notes')

    class Config:
        json_schema_extra = {
            "example": {
                "page_count": 10,
                "estimated_cost_low": 0.08,
                "estimated_cost_avg": 0.10,
                "estimated_cost_high": 0.12,
                "model": "claude-haiku-4-5-20251001",
                "notes": "Estimates assume standard document complexity"
            }
        }


class UsageStats(BaseModel):
    """Usage statistics"""

    total_conversions: int = Field(default=0, description='Total number of conversions')
    total_pages: int = Field(default=0, description='Total pages converted')
    total_cost: float = Field(default=0.0, description='Total cost incurred')
    avg_cost_per_page: float = Field(default=0.0, description='Average cost per page')
    avg_cost_per_conversion: float = Field(default=0.0, description='Average cost per conversion')
    cache_hit_rate: float = Field(default=0.0, ge=0.0, le=1.0, description='Cache hit rate (0-1)')

    class Config:
        json_schema_extra = {
            "example": {
                "total_conversions": 47,
                "total_pages": 523,
                "total_cost": 3.89,
                "avg_cost_per_page": 0.0074,
                "avg_cost_per_conversion": 0.083,
                "cache_hit_rate": 0.82
            }
        }


class JobUpdate(BaseModel):
    """WebSocket update message"""

    job_id: str
    status: Literal['queued', 'processing', 'completed', 'failed']
    progress: int = Field(ge=0, le=100)
    step: str
    timestamp: datetime = Field(default_factory=datetime.now)

    # Optional fields for completed jobs
    output_filename: Optional[str] = None
    actual_cost: Optional[float] = None
    error_message: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
