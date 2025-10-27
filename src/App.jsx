const { useState, useEffect } = React;
const WelcomeScreen = require('./components/WelcomeScreen');

const MODELS = {
  'claude-haiku-4-5': {
    name: 'Haiku 4.5 - Recommended',
    pricing: { input: 1.00, output: 5.00 },
    description: 'Best balance of quality, speed, and cost'
  },
  'claude-sonnet-4-5-20250929': {
    name: 'Sonnet 4.5 - Premium',
    pricing: { input: 3.00, output: 15.00 },
    description: 'Maximum quality for complex documents'
  },
  'claude-3-5-haiku-20241022': {
    name: 'Haiku 3.5 - Budget',
    pricing: { input: 0.80, output: 4.00 },
    description: '20% savings for simple documents'
  }
};

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(null);

  // Prompt management
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);

  useEffect(() => {
    async function checkApiKey() {
      const hasKey = await window.electronAPI.hasApiKey();
      setShowWelcome(!hasKey);
      if (hasKey) {
        loadApiKey();
      }
    }

    loadSettings();
    checkApiKey();

    // Listen for progress updates
    window.electronAPI.onConversionProgress((data) => {
      setProgress(data);
    });

    return () => {
      window.electronAPI.removeAllListeners('conversion-progress');
    };
  }, []);

  useEffect(() => {
    if (settings && settings.promptMode) {
      loadPrompt(settings.promptMode);
    }
  }, [settings?.promptMode]);

  async function loadSettings() {
    const s = await window.electronAPI.getSettings();
    setSettings(s);
  }

  async function loadApiKey() {
    const key = await window.electronAPI.getApiKey();
    setApiKey(key);
  }

  async function loadPrompt(mode) {
    const result = await window.electronAPI.getPrompt(mode);
    if (result.success) {
      setCurrentPrompt(result.prompt);
    }
  }

  async function handleSelectFiles() {
    const files = await window.electronAPI.selectFiles();
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }

  async function handleConvert() {
    if (selectedFiles.length === 0) {
      alert('Please select files first');
      return;
    }

    if (!apiKey) {
      alert('Please configure API key in settings');
      setShowApiKeyModal(true);
      return;
    }

    setIsConverting(true);
    setProgress({ status: 'starting', progress: 0 });

    try {
      const result = await window.electronAPI.convertFiles(selectedFiles, settings);

      if (result.success) {
        const successResults = result.results.filter(r => r.success);
        const failedResults = result.results.filter(r => !r.success);

        let message = `Conversion complete!\n\n`;
        message += `${successResults.length} files converted successfully\n\n`;

        if (successResults.length > 0) {
          message += `Files saved to:\n`;
          successResults.forEach(r => {
            message += `\n${r.outputPath}`;
            if (r.cost) {
              message += `\nCost: $${r.cost.toFixed(4)}`;
            }
          });
        }

        if (result.totalCost) {
          message += `\n\nTotal cost: $${result.totalCost.toFixed(4)}`;
        }

        if (failedResults.length > 0) {
          message += `\n\n${failedResults.length} files failed:\n`;
          failedResults.forEach(r => {
            message += `\n${r.fileName}: ${r.error}`;
          });
        }

        alert(message);
        setSelectedFiles([]);
        setProgress(null);
      } else {
        alert(`Conversion failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  }

  async function handleSaveSettings() {
    await window.electronAPI.saveSettings(settings);
    alert('Settings saved!');
  }

  async function handleSaveApiKey() {
    await window.electronAPI.saveApiKey(apiKey);
    await window.electronAPI.saveSettings(settings);
    setShowApiKeyModal(false);
    alert('API key saved!');
  }

  async function handleTestApiKey() {
    const result = await window.electronAPI.testApiKey(apiKey);
    if (result.success) {
      alert('API key is valid!');
    } else {
      alert(`API key test failed:\n${result.error}`);
    }
  }

  async function handleSavePrompt() {
    if (settings.promptMode === 'custom') {
      await window.electronAPI.saveCustomPrompt(currentPrompt);
      alert('Custom prompt saved!');
    }
    await handleSaveSettings();
  }

  async function handleResetPrompt() {
    const mode = settings.promptMode === 'custom' ? 'simple' : settings.promptMode;
    const result = await window.electronAPI.resetPrompt(mode);
    if (result.success) {
      setCurrentPrompt(result.prompt);
      if (settings.promptMode === 'custom') {
        setSettings({...settings, promptMode: mode});
      }
      alert('Prompt reset to default!');
    }
  }

  function handlePromptModeChange(mode) {
    setSettings({...settings, promptMode: mode});
    loadPrompt(mode);
  }

  function dxaToInches(dxa) {
    return (dxa / 1440).toFixed(2);
  }

  function inchesToDxa(inches) {
    return Math.round(parseFloat(inches) * 1440);
  }

  if (!settings) return <div className="loading">Loading...</div>;

  // Show welcome screen if no API key
  if (showWelcome) {
    return (
      <WelcomeScreen
        onComplete={() => {
          setShowWelcome(false);
          loadApiKey();
        }}
      />
    );
  }

  const estimatedSavings = settings.promptMode === 'simple' ? '~40-50% vs Advanced' :
                          settings.promptMode === 'advanced' ? 'Most detailed' :
                          'Custom configuration';

  return (
    <div className="app">
      <div className="app-title">
        <h1>Claude PDF to Word Converter</h1>
      </div>

      <header>
        <button onClick={() => setShowApiKeyModal(true)} className="api-key-btn">
          API Key
        </button>
      </header>

      <main>
        {/* File Selection */}
        <section className="file-section">
          <h2>Select Files</h2>
          <button onClick={handleSelectFiles} className="select-btn">
            Browse Files (PDF, Images)
          </button>

          {selectedFiles.length > 0 && (
            <div className="file-list">
              <h3>Selected Files ({selectedFiles.length}):</h3>
              <ul>
                {selectedFiles.map((file, i) => (
                  <li key={i}>{file.split('/').pop()}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Conversion Strategy */}
        <section className="settings-box">
          <h2>Conversion Strategy</h2>
          <div className="page-selection-group">
            <div className="radio-option">
              <input
                type="radio"
                id="advanced"
                checked={settings.promptMode === 'advanced'}
                onChange={() => handlePromptModeChange('advanced')}
              />
              <label htmlFor="advanced">Advanced (Complex documents with tables)</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="simple"
                checked={settings.promptMode === 'simple'}
                onChange={() => handlePromptModeChange('simple')}
              />
              <label htmlFor="simple">Simple (Plain text documents, ~40% cost savings)</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="custom"
                checked={settings.promptMode === 'custom'}
                onChange={() => handlePromptModeChange('custom')}
              />
              <label htmlFor="custom">Custom (Your own prompt)</label>
            </div>
          </div>

          <div style={{marginTop: '12px', fontSize: '13px', color: '#6b7280'}}>
            Token usage: {estimatedSavings}
          </div>

          <button
            onClick={() => setPromptExpanded(!promptExpanded)}
            style={{marginTop: '12px', padding: '6px 12px', fontSize: '13px'}}
          >
            {promptExpanded ? 'Hide' : 'View/Edit'} Prompt
          </button>

          {promptExpanded && (
            <div className="prompt-editor">
              <textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                disabled={settings.promptMode !== 'custom'}
              />
              <div className="prompt-actions">
                <button className="primary" onClick={handleSavePrompt}>
                  Save Prompt
                </button>
                <button onClick={handleResetPrompt}>
                  Reset to Default
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Model Selection */}
        <section className="settings-box">
          <h2>Model Selection</h2>
          <div className="setting-item">
            <label>Model</label>
            <select
              value={settings.model}
              onChange={(e) => setSettings({...settings, model: e.target.value})}
            >
              {Object.entries(MODELS).map(([id, info]) => (
                <option key={id} value={id}>{info.name}</option>
              ))}
            </select>
            <small>
              ${MODELS[settings.model].pricing.input}/${MODELS[settings.model].pricing.output} per MTok (input/output) - {MODELS[settings.model].description}
            </small>
          </div>
        </section>

        {/* Document Formatting */}
        <section className="settings-box">
          <h2>Document Formatting</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Font</label>
              <select
                value={settings.font}
                onChange={(e) => setSettings({...settings, font: e.target.value})}
              >
                <option>Arial</option>
                <option>Times New Roman</option>
                <option>Calibri</option>
                <option>Helvetica</option>
                <option>Georgia</option>
              </select>
            </div>

            <div className="setting-item">
              <label>Font Size (pt)</label>
              <input
                type="number"
                value={settings.fontSize}
                onChange={(e) => setSettings({...settings, fontSize: parseInt(e.target.value)})}
                min="8"
                max="72"
              />
            </div>
          </div>

          <h3 style={{marginTop: '16px', marginBottom: '12px', fontSize: '14px'}}>Margins (inches)</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Top</label>
              <input
                type="number"
                step="0.1"
                value={dxaToInches(settings.margins.top)}
                onChange={(e) => setSettings({
                  ...settings,
                  margins: {...settings.margins, top: inchesToDxa(e.target.value)}
                })}
              />
            </div>

            <div className="setting-item">
              <label>Right</label>
              <input
                type="number"
                step="0.1"
                value={dxaToInches(settings.margins.right)}
                onChange={(e) => setSettings({
                  ...settings,
                  margins: {...settings.margins, right: inchesToDxa(e.target.value)}
                })}
              />
            </div>

            <div className="setting-item">
              <label>Bottom</label>
              <input
                type="number"
                step="0.1"
                value={dxaToInches(settings.margins.bottom)}
                onChange={(e) => setSettings({
                  ...settings,
                  margins: {...settings.margins, bottom: inchesToDxa(e.target.value)}
                })}
              />
            </div>

            <div className="setting-item">
              <label>Left</label>
              <input
                type="number"
                step="0.1"
                value={dxaToInches(settings.margins.left)}
                onChange={(e) => setSettings({
                  ...settings,
                  margins: {...settings.margins, left: inchesToDxa(e.target.value)}
                })}
              />
            </div>
          </div>
        </section>

        {/* Page Selection */}
        <section className="settings-box">
          <h2>Page Selection</h2>
          <div className="page-selection-group">
            <div className="radio-option">
              <input
                type="radio"
                id="all-pages"
                checked={settings.pageSelection.mode === 'all'}
                onChange={() => setSettings({
                  ...settings,
                  pageSelection: {...settings.pageSelection, mode: 'all'}
                })}
              />
              <label htmlFor="all-pages">All pages</label>
            </div>

            <div className="radio-option">
              <input
                type="radio"
                id="custom-range"
                checked={settings.pageSelection.mode === 'range'}
                onChange={() => setSettings({
                  ...settings,
                  pageSelection: {...settings.pageSelection, mode: 'range'}
                })}
              />
              <label htmlFor="custom-range">Custom range</label>
            </div>

            {settings.pageSelection.mode === 'range' && (
              <input
                type="text"
                className="page-range-input"
                placeholder="e.g., 1-5, 7, 9-12"
                value={settings.pageSelection.range}
                onChange={(e) => setSettings({
                  ...settings,
                  pageSelection: {...settings.pageSelection, range: e.target.value}
                })}
              />
            )}
          </div>
        </section>

        {/* Special Options */}
        <section className="settings-box">
          <h2>Special Options</h2>
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="replace-signatures"
              checked={settings.specialRequests.replaceSignatures}
              onChange={(e) => setSettings({
                ...settings,
                specialRequests: {
                  ...settings.specialRequests,
                  replaceSignatures: e.target.checked
                }
              })}
            />
            <label htmlFor="replace-signatures">Replace signatures with [Signature]</label>
          </div>

          <div className="checkbox-group">
            <input
              type="checkbox"
              id="add-page-markers"
              checked={settings.specialRequests.addPageMarkers}
              onChange={(e) => setSettings({
                ...settings,
                specialRequests: {
                  ...settings.specialRequests,
                  addPageMarkers: e.target.checked
                }
              })}
            />
            <label htmlFor="add-page-markers">Add page markers</label>
          </div>
        </section>

        {/* Convert Button */}
        <button
          onClick={handleConvert}
          disabled={isConverting || selectedFiles.length === 0}
          className="convert-btn"
        >
          {isConverting ? 'Converting...' : 'Convert to Word'}
        </button>

        {/* Progress */}
        {progress && (
          <div className="progress">
            {progress.fileIndex !== undefined && (
              <p>File {progress.fileIndex + 1} of {progress.totalFiles}: {progress.fileName}</p>
            )}
            <p>Status: {progress.status}</p>
            {progress.chunk && <p>Chunk {progress.chunk} of {progress.totalChunks}</p>}
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.progress || 0}%` }}>
                {Math.round(progress.progress || 0)}%
              </div>
            </div>
            {progress.cost !== undefined && (
              <div className="cost-display">
                Cost so far: ${progress.cost.toFixed(4)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>API Configuration</h2>

            <label>API Key:</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />

            <div className="modal-actions">
              <button className="primary" onClick={handleTestApiKey}>
                Test Connection
              </button>
              <button className="primary" onClick={handleSaveApiKey}>
                Save
              </button>
              <button onClick={() => setShowApiKeyModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mount React app to the DOM
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
