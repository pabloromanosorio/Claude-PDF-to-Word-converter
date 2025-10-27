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
