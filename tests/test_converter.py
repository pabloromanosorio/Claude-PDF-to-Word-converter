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
    mock_response.usage = MagicMock(input_tokens=1000, output_tokens=500)

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
