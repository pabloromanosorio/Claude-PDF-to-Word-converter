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
