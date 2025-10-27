const Store = require('electron-store');

const store = new Store({
  encryptionKey: 'image-to-word-converter-secure-v2-2025', // More secure encryption key
  name: 'config'
});

class ApiKeyManager {
  saveApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid API key format');
    }
    store.set('anthropic_api_key', apiKey);
  }

  getApiKey() {
    return store.get('anthropic_api_key');
  }

  hasApiKey() {
    const key = this.getApiKey();
    return key && key.length > 0;
  }

  clearApiKey() {
    store.delete('anthropic_api_key');
  }

  getSkillId() {
    // Return stored skill_id only (no process.env fallback)
    return store.get('skill_id');
  }

  getSkillIdOrNull() {
    // Explicitly return null if not set
    const skillId = store.get('skill_id');
    return skillId || null;
  }

  setSkillId(skillId) {
    store.set('skill_id', skillId);
  }
}

module.exports = new ApiKeyManager();
