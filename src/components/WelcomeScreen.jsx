const React = require('react');
const { useState } = React;

function WelcomeScreen({ onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleGetApiKey = () => {
    window.electronAPI.openExternal('https://console.anthropic.com/settings/keys');
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid API key format. Should start with sk-ant-');
      return;
    }

    try {
      await window.electronAPI.saveApiKey(apiKey);
      onComplete();
    } catch (err) {
      setError('Failed to save API key: ' + err.message);
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-header">
        <h1>Welcome! 👋</h1>
        <p>Convert document images to professional Word files in seconds, powered by Claude AI.</p>
      </div>

      <div className="welcome-step">
        <h3>Step 1: Get your API key</h3>
        <button className="btn-primary" onClick={handleGetApiKey}>
          Get API Key from Anthropic
        </button>
        <p className="help-text">(Opens in your browser)</p>
      </div>

      <div className="welcome-step">
        <h3>Step 2: Paste your API key here</h3>
        <input
          type="password"
          className="api-key-input"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button className="btn-primary" onClick={handleSave}>
          Save
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>

      <p className="security-note">🔒 Your API key is stored securely and never shared.</p>

      <button className="btn-link" onClick={onComplete}>
        Skip for now
      </button>
    </div>
  );
}

module.exports = WelcomeScreen;
