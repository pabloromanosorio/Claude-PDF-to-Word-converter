const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const apiKeyManager = require('./src/api-key-manager');

const store = new Store();
let mainWindow;

// Default settings
const DEFAULT_SETTINGS = {
  model: 'claude-haiku-4-5',
  font: 'Arial',
  fontSize: 11,
  margins: {
    top: 1440,    // in DXA (1440 DXA = 1 inch)
    right: 1440,
    bottom: 1440,
    left: 1440
  },
  specialRequests: {
    replaceSignatures: true,
    addPageMarkers: true
  },
  promptMode: 'simple',  // 'advanced' | 'simple' | 'custom'
  pageSelection: {
    mode: 'all',         // 'all' | 'range'
    range: ''            // e.g., "1-5, 7, 9-12"
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('src/index.html');

  // Development: Uncomment to show dev tools
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers

// Get settings (with migration for old settings)
ipcMain.handle('get-settings', async () => {
  let settings = store.get('settings', DEFAULT_SETTINGS);

  // Migrate old settings to new structure
  if (!settings.promptMode) {
    settings.promptMode = 'simple';
  }
  if (!settings.pageSelection) {
    settings.pageSelection = { mode: 'all', range: '' };
  }
  if (!settings.margins.right) {
    // Old settings had single margin value, migrate to individual margins
    const margin = settings.margins.top || 1440;
    settings.margins = {
      top: margin,
      right: margin,
      bottom: margin,
      left: margin
    };
  }

  // Save migrated settings
  store.set('settings', settings);

  return settings;
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  store.set('settings', settings);
  return { success: true };
});

// Get API key
ipcMain.handle('get-api-key', async () => {
  return apiKeyManager.getApiKey();
});

// Save API key
ipcMain.handle('save-api-key', async (event, apiKey) => {
  try {
    apiKeyManager.saveApiKey(apiKey);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if API key exists
ipcMain.handle('has-api-key', async () => {
  return apiKeyManager.hasApiKey();
});

// Open external URL
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// Test API key
ipcMain.handle('test-api-key', async (event, apiKey) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    
    // Simple test request
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: 'Say "OK"'
      }]
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Select files
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Supported Files', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'] },
      { name: 'PDF Documents', extensions: ['pdf'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'] }
    ]
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

// Convert files
ipcMain.handle('convert-files', async (event, filePaths, settings) => {
  const apiKey = apiKeyManager.getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured'
    };
  }
  
  const converter = require('./converter');
  const results = [];
  let totalCost = 0;

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    const fileName = path.basename(filePath, path.extname(filePath));

    try {
      // Send progress update
      mainWindow.webContents.send('conversion-progress', {
        fileIndex: i,
        totalFiles: filePaths.length,
        fileName: path.basename(filePath),
        status: 'processing',
        progress: (i / filePaths.length) * 100,
        cost: totalCost
      });

      // Convert file
      const result = await converter.convertFile(filePath, fileName, settings, apiKey, (progress) => {
        mainWindow.webContents.send('conversion-progress', {
          fileIndex: i,
          totalFiles: filePaths.length,
          fileName: path.basename(filePath),
          cost: totalCost + (progress.cost || 0),
          ...progress
        });
      });

      results.push(result);

      // Accumulate cost
      if (result.cost) {
        totalCost += result.cost;
      }

    } catch (error) {
      results.push({
        success: false,
        fileName: path.basename(filePath),
        error: error.message
      });
    }
  }

  return {
    success: true,
    results,
    totalCost
  };
});

// Show output folder
ipcMain.handle('show-output-folder', async () => {
  const outputDir = path.join(app.getPath('documents'), 'PDF-Converter-Output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  require('electron').shell.openPath(outputDir);
});

// Get prompt (advanced, simple, or custom)
ipcMain.handle('get-prompt', async (event, mode) => {
  try {
    if (mode === 'custom') {
      // Get custom prompt from store
      const customPrompt = store.get('custom-prompt', null);
      if (customPrompt) {
        return { success: true, prompt: customPrompt, mode: 'custom' };
      }
      // Fall back to simple if no custom prompt exists
      mode = 'simple';
    }

    // Load from file
    const promptFileName = mode === 'advanced' ? 'master-prompt.txt' : 'basic-prompt.txt';
    const promptPath = path.join(__dirname, 'prompts', promptFileName);
    const promptText = fs.readFileSync(promptPath, 'utf-8');

    return { success: true, prompt: promptText, mode };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save custom prompt
ipcMain.handle('save-custom-prompt', async (event, text) => {
  try {
    store.set('custom-prompt', text);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Reset prompt (clear custom, return to default)
ipcMain.handle('reset-prompt', async (event, mode) => {
  try {
    if (mode === 'custom') {
      // Clear custom prompt from store
      store.delete('custom-prompt');
    }

    // Return the default prompt for the requested mode
    const promptFileName = mode === 'advanced' ? 'master-prompt.txt' : 'basic-prompt.txt';
    const promptPath = path.join(__dirname, 'prompts', promptFileName);
    const promptText = fs.readFileSync(promptPath, 'utf-8');

    return { success: true, prompt: promptText, mode };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
