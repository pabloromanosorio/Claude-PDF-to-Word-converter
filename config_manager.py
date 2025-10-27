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

        # Merge saved settings with defaults (saved settings override defaults)
        saved_settings = config.get('settings', {})
        merged = {**default_settings, **saved_settings}

        # Handle nested margins dict separately
        if 'margins' in saved_settings and isinstance(saved_settings['margins'], dict):
            merged['margins'] = {**default_settings['margins'], **saved_settings['margins']}

        return merged

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
