const { useState, useEffect } = React;

const MODELS = {
  'claude-haiku-4-5': {
    name: 'Haiku 4.5 - Recommended ⭐',
    pricing: '$1/$5 per MTok',
    description: 'Best balance of quality, speed, and cost'
  },
  'claude-sonnet-4-5-20250929': {
    name: 'Sonnet 4.5 - Premium 💎',
    pricing: '$3/$15 per MTok',
    description: 'Maximum quality for complex documents'
  },
  'claude-3-5-haiku-20241022': {
    name: 'Haiku 3.5 - Budget 💰',
    pricing: '$0.80/$4 per MTok',
    description: '20% savings for simple documents'
  }
};

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    loadSettings();
    loadApiKey();
    
    // Listen for progress updates
    window.electronAPI.onConversionProgress((data) => {
      setProgress(data);
    });
    
    return () => {
      window.electronAPI.removeAllListeners('conversion-progress');
    };
  }, []);

  async function loadSettings() {
    const s = await window.electronAPI.getSettings();
    setSettings(s);
  }

  async function loadApiKey() {
    const key = await window.electronAPI.getApiKey();
    setApiKey(key);
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
      setShowSettings(true);
      return;
    }

    setIsConverting(true);
    setProgress({ status: 'starting' });

    try {
      const result = await window.electronAPI.convertFiles(selectedFiles, settings);

      if (result.success) {
        const successResults = result.results.filter(r => r.success);
        const failedResults = result.results.filter(r => !r.success);

        let message = `Conversion complete!\n\n`;
        message += `✅ ${successResults.length} files converted successfully\n\n`;

        if (successResults.length > 0) {
          message += `Files saved to:\n`;
          successResults.forEach(r => {
            message += `• ${r.outputPath}\n`;
          });
        }

        if (failedResults.length > 0) {
          message += `\n❌ ${failedResults.length} files failed:\n`;
          failedResults.forEach(r => {
            message += `• ${r.fileName}: ${r.error}\n`;
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
    await window.electronAPI.saveApiKey(apiKey);
    setShowSettings(false);
    alert('Settings saved!');
  }

  async function handleTestApiKey() {
    const result = await window.electronAPI.testApiKey(apiKey);
    if (result.success) {
      alert('✅ API key is valid!');
    } else {
      alert(`❌ API key test failed:\n${result.error}`);
    }
  }

  if (!settings) return <div className="loading">Loading...</div>;

  return (
    <div className="app">
      <header>
        <h1>Claude PDF to Word Converter</h1>
        <button onClick={() => setShowSettings(true)} className="settings-btn">
          ⚙️ Settings
        </button>
      </header>

      <main>
        {/* File Selection */}
        <section className="file-section">
          <h2>📁 Select Files</h2>
          <button onClick={handleSelectFiles} className="select-btn">
            Browse Files (PDF, JPG, PNG)
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

        {/* Settings Preview */}
        <section className="settings-preview">
          <h3>Current Settings:</h3>
          <p>Model: {MODELS[settings.model].name}</p>
          <p>Font: {settings.font} {settings.fontSize}pt</p>
          <p>Margins: {settings.margins.top / 1440}" all sides</p>
        </section>

        {/* Convert Button */}
        <button 
          onClick={handleConvert} 
          disabled={isConverting || selectedFiles.length === 0}
          className="convert-btn"
        >
          {isConverting ? '⏳ Converting...' : '🚀 Convert to Word'}
        </button>

        {/* Progress */}
        {progress && (
          <div className="progress">
            <p>File {progress.fileIndex + 1} of {progress.totalFiles}: {progress.fileName}</p>
            <p>Status: {progress.status}</p>
            {progress.chunk && <p>Chunk {progress.chunk}/{progress.totalChunks}</p>}
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress.progress || 0}%` }} />
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal">
          <div className="modal-content">
            <h2>Settings</h2>
            
            <div className="setting-group">
              <label>API Key:</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              <button onClick={handleTestApiKey}>Test Connection</button>
            </div>

            <div className="setting-group">
              <label>Model:</label>
              <select
                value={settings.model}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
              >
                {Object.entries(MODELS).map(([id, info]) => (
                  <option key={id} value={id}>{info.name}</option>
                ))}
              </select>
              <small>{MODELS[settings.model].description}</small>
            </div>

            <div className="setting-group">
              <label>Font:</label>
              <select
                value={settings.font}
                onChange={(e) => setSettings({...settings, font: e.target.value})}
              >
                <option>Arial</option>
                <option>Times New Roman</option>
                <option>Calibri</option>
              </select>
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.specialRequests.replaceSignatures}
                  onChange={(e) => setSettings({
                    ...settings,
                    specialRequests: {
                      ...settings.specialRequests,
                      replaceSignatures: e.target.checked
                    }
                  })}
                />
                Replace signatures with [Signature]
              </label>
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.specialRequests.addPageMarkers}
                  onChange={(e) => setSettings({
                    ...settings,
                    specialRequests: {
                      ...settings.specialRequests,
                      addPageMarkers: e.target.checked
                    }
                  })}
                />
                Add page markers
              </label>
            </div>

            <div className="modal-actions">
              <button onClick={handleSaveSettings}>Save</button>
              <button onClick={() => setShowSettings(false)}>Cancel</button>
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