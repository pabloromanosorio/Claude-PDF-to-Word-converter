import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
from converter import upload_skill, convert_document, build_prompt, calculate_cost


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

    # Create a valid dummy skill zip
    import zipfile
    skill_path = tmp_path / "image-to-docx-converter.zip"
    with zipfile.ZipFile(skill_path, 'w') as zf:
        zf.writestr('test_skill/SKILL.md', 'Test skill content')

    with patch('converter.SKILL_PATH', skill_path):
        skill_id = upload_skill("sk-ant-test123", mock_anthropic_client)

    assert skill_id == "skill_abc123xyz"
    mock_anthropic_client.beta.skills.create.assert_called_once()


def test_upload_skill_handles_api_error(mock_anthropic_client, tmp_path):
    """Test skill upload error handling"""
    # Mock API error
    mock_anthropic_client.beta.skills.create.side_effect = Exception("API Error")

    # Create a valid dummy skill zip
    import zipfile
    skill_path = tmp_path / "image-to-docx-converter.zip"
    with zipfile.ZipFile(skill_path, 'w') as zf:
        zf.writestr('test_skill/SKILL.md', 'Test skill content')

    with patch('converter.SKILL_PATH', skill_path):
        skill_id = upload_skill("sk-ant-test123", mock_anthropic_client)

    # Should return None on error (for fallback)
    assert skill_id is None


def test_convert_document_with_skill(mock_anthropic_client, tmp_path):
    """Test document conversion with skill"""
    # This is a stub - we'll implement full conversion later
    # For now, just verify the function signature exists
    from converter import convert_document

    assert callable(convert_document)


def test_build_prompt_includes_verification_rules():
    """Test that build_prompt includes anti-hallucination rules"""
    settings = {
        'font': 'Arial',
        'fontSize': 12,
        'margins': {'top': 1.0, 'right': 1.0, 'bottom': 1.0, 'left': 1.0},
        'model': 'claude-sonnet-4-5-20250929',
        'addPageMarkers': True,
        'replaceSignatures': True
    }

    prompt = build_prompt(settings, 'test_file')

    # Verify anti-hallucination rules present
    assert "DO NOT add content" in prompt
    assert "EXACT text" in prompt or "preserve EXACT text" in prompt
    assert "Anti-Hallucination Rules" in prompt or "DO NOT" in prompt
    assert "Page" in prompt and "original" in prompt  # Page markers
    assert "Completeness Check" in prompt or "verification" in prompt.lower()


def test_calculate_cost_accuracy():
    """Test cost calculation with known values"""
    from converter import calculate_cost

    # Test with Sonnet pricing
    usage = {'input_tokens': 1_000_000, 'output_tokens': 1_000_000}
    cost = calculate_cost(usage, 'claude-sonnet-4-5-20250929')
    expected = 3.00 + 15.00  # $3 per million input + $15 per million output
    assert abs(cost - expected) < 0.01

    # Test with Haiku pricing
    usage = {'input_tokens': 500_000, 'output_tokens': 500_000}
    cost = calculate_cost(usage, 'claude-haiku-4-5')
    expected = 0.50 + 2.50  # $1 per million * 0.5M + $5 per million * 0.5M
    assert abs(cost - expected) < 0.01

    # Test with unknown model (should use Sonnet pricing)
    cost_unknown = calculate_cost(usage, 'unknown-model')
    assert cost_unknown == calculate_cost(usage, 'claude-sonnet-4-5-20250929')
