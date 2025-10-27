const React = require('react');
const { useState } = React;

function WelcomeScreen({ onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showFallbackOption, setShowFallbackOption] = useState(false);

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
      setError('');
      setStatus('Saving API key...');
      await window.electronAPI.saveApiKey(apiKey);

      // Check if skill already uploaded
      const existingSkillId = await window.electronAPI.getSkillId();
      if (existingSkillId) {
        setStatus('Ready to convert!');
        setTimeout(() => onComplete(), 1000);
        return;
      }

      // Upload skill to user's account
      setStatus('Setting up your converter (one-time setup, ~10 seconds)...');
      const result = await window.electronAPI.uploadSkillForUser(apiKey);

      if (result.success) {
        setStatus('Setup complete! Ready to convert.');
        setTimeout(() => onComplete(), 1500);
      } else {
        // Upload failed but app can still work
        setError(`Setup warning: ${result.error}\n\nDon't worry - the app will still work with embedded instructions.`);
        setShowFallbackOption(true);
        setStatus('');
      }

    } catch (err) {
      setError('Failed to save: ' + err.message);
      setStatus('');
    }
  };

  const handleSkipSetup = () => {
    setError('');
    setShowFallbackOption(false);
    onComplete();
  };

  const handleRetry = async () => {
    setError('');
    setShowFallbackOption(false);
    await handleSave();
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-header">
        <h1>Welcome!</h1>
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
        <button className="btn-primary" onClick={handleSave} disabled={!!status}>
          {status ? 'Setting up...' : 'Save'}
        </button>
        {status && <p className="status-text">{status}</p>}
        {error && (
          <div className="error-section">
            <p className="error-text">{error}</p>
            {showFallbackOption && (
              <div className="fallback-buttons">
                <button className="btn-secondary" onClick={handleRetry}>
                  Retry Setup
                </button>
                <button className="btn-link" onClick={handleSkipSetup}>
                  Skip Skills API (use embedded instructions)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="security-note">Your API key is stored securely and never shared.</p>

      {!showFallbackOption && (
        <button className="btn-link" onClick={onComplete}>
          Skip for now
        </button>
      )}
    </div>
  );
}

module.exports = WelcomeScreen;
