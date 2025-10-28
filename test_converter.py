"""
Integration tests for PDF/Image to Word converter.

Run with: pytest test_converter.py
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch
import pytest

from converter import (
    build_prompt,
    extract_pages,
    should_split_document,
    file_to_base64,
    get_media_type
)
from config_manager import ConfigManager
from cost_calculator import estimate_cost_for_file, calculate_actual_cost


class TestPromptBuilder:
    """Test prompt generation"""

    def test_build_prompt_default(self):
        settings = {
            'font': 'Arial',
            'fontSize': 12,
            'margin': 1.0,
            'replaceSignatures': False,
            'addPageMarkers': False
        }

        prompt = build_prompt(settings, 'test_file')

        assert 'Arial' in prompt
        assert '12pt' in prompt
        assert '1.0" on all sides' in prompt
        assert 'test_file.docx' in prompt

    def test_build_prompt_with_options(self):
        settings = {
            'font': 'Times New Roman',
            'fontSize': 14,
            'margin': 0.75,
            'replaceSignatures': True,
            'addPageMarkers': True,
            'customInstructions': 'Keep headers'
        }

        prompt = build_prompt(settings, 'test')

        assert 'Times New Roman' in prompt
        assert '14pt' in prompt
        assert '[Signature]' in prompt
        assert '[Page X of the original]' in prompt
        assert 'Keep headers' in prompt


class TestFileHelpers:
    """Test file utility functions"""

    def test_get_media_type(self):
        assert get_media_type('file.pdf') == 'application/pdf'
        assert get_media_type('file.jpg') == 'image/jpeg'
        assert get_media_type('file.jpeg') == 'image/jpeg'
        assert get_media_type('file.png') == 'image/png'
        assert get_media_type('FILE.PDF') == 'application/pdf'

    def test_file_to_base64(self):
        with tempfile.NamedTemporaryFile(delete=False, mode='wb') as f:
            f.write(b'test content')
            temp_path = f.name

        try:
            result = file_to_base64(temp_path)
            assert isinstance(result, str)
            assert len(result) > 0
        finally:
            os.unlink(temp_path)


class TestDocumentBatching:
    """Test batching logic"""

    def test_should_split_small_file(self):
        # Create small temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as f:
            f.write(b'small file')
            temp_path = f.name

        try:
            assert should_split_document(temp_path) == False
        finally:
            os.unlink(temp_path)


class TestCostEstimation:
    """Test cost calculation"""

    def test_calculate_actual_cost_haiku(self):
        usage = {
            'input_tokens': 1000000,  # 1M tokens
            'output_tokens': 500000   # 500K tokens
        }

        cost = calculate_actual_cost(usage, 'claude-haiku-4-5-20251001')

        # 1M * $1.00 + 500K * $5.00 = $1.00 + $2.50 = $3.50
        assert cost == 3.5

    def test_calculate_actual_cost_sonnet(self):
        usage = {
            'input_tokens': 1000000,  # 1M tokens
            'output_tokens': 500000   # 500K tokens
        }

        cost = calculate_actual_cost(usage, 'claude-sonnet-4-5-20250929')

        # 1M * $3.00 + 500K * $15.00 = $3.00 + $7.50 = $10.50
        assert cost == 10.5


class TestConfigManager:
    """Test configuration management"""

    def test_get_settings_defaults(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_mgr = ConfigManager(config_dir=Path(tmpdir))
            settings = config_mgr.get_settings()

            assert settings['font'] == 'Arial'
            assert settings['fontSize'] == 12
            assert settings['margin'] == 1.0
            assert settings['replaceSignatures'] == True
            assert settings['addPageMarkers'] == True

    def test_save_and_get_settings(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_mgr = ConfigManager(config_dir=Path(tmpdir))

            custom_settings = {
                'font': 'Calibri',
                'fontSize': 11,
                'margin': 0.5
            }

            config_mgr.save_settings(custom_settings)
            retrieved = config_mgr.get_settings()

            assert retrieved['font'] == 'Calibri'
            assert retrieved['fontSize'] == 11
            assert retrieved['margin'] == 0.5

    def test_custom_prompt(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_mgr = ConfigManager(config_dir=Path(tmpdir))

            # Initially no custom prompt
            assert config_mgr.get_custom_prompt() is None

            # Save custom prompt
            config_mgr.save_custom_prompt('My custom prompt')
            assert config_mgr.get_custom_prompt() == 'My custom prompt'

            # Delete custom prompt
            config_mgr.delete_custom_prompt()
            assert config_mgr.get_custom_prompt() is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
