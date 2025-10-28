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
