"""
Configuration management with encrypted API key storage.
"""

from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet
import os
import json

from database import get_config, set_config
from models import ConversionSettings


class ConfigManager:
    """Manage application configuration with encrypted API keys"""

    def __init__(self):
        """Initialize configuration manager"""
        self.config_dir = Path.home() / '.pdf-converter'
        self.config_dir.mkdir(parents=True, exist_ok=True)

        self.key_file = self.config_dir / '.encryption_key_v2'
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

    def save_api_key(self, api_key: str) -> None:
        """
        Encrypt and save API key.

        Args:
            api_key: Anthropic API key (starts with sk-ant-)

        Raises:
            ValueError: If API key format is invalid
        """
        if not api_key.startswith('sk-ant-'):
            raise ValueError("Invalid API key format. Must start with sk-ant-")

        # Encrypt the key
        encrypted = self.encryptor.encrypt(api_key.encode())

        # Save to database
        set_config('api_key', encrypted.decode('utf-8'), encrypted=True)

    def get_api_key(self) -> Optional[str]:
        """
        Retrieve and decrypt API key.

        Returns:
            Decrypted API key or None if not set
        """
        encrypted = get_config('api_key')

        if not encrypted:
            return None

        # Decrypt the key
        try:
            decrypted = self.encryptor.decrypt(encrypted.encode())
            return decrypted.decode('utf-8')
        except Exception as e:
            print(f"Error decrypting API key: {e}")
            return None

    def has_api_key(self) -> bool:
        """Check if API key is configured"""
        return self.get_api_key() is not None

    def save_settings(self, settings: ConversionSettings) -> None:
        """Save default user settings"""
        set_config('default_settings', settings.model_dump_json())

    def get_settings(self) -> ConversionSettings:
        """Get user settings with defaults"""
        settings_json = get_config('default_settings')

        if settings_json:
            try:
                return ConversionSettings.model_validate_json(settings_json)
            except Exception:
                # Invalid settings, return defaults
                pass

        return ConversionSettings()

    def get_custom_prompt(self) -> Optional[str]:
        """Get custom prompt if saved"""
        return get_config('custom_prompt')

    def save_custom_prompt(self, prompt: str):
        """Save custom prompt"""
        set_config('custom_prompt', prompt)

    def delete_custom_prompt(self):
        """Delete custom prompt"""
        set_config('custom_prompt', '')


# Global config manager instance
_config_instance: Optional[ConfigManager] = None


def get_config_manager() -> ConfigManager:
    """Get or create global config manager instance"""
    global _config_instance
    if _config_instance is None:
        _config_instance = ConfigManager()
    return _config_instance
