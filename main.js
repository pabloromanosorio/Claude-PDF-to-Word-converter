const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();
let mainWindow;

// Default settings
const DEFAULT_SETTINGS = {
  model: 'claude-haiku-4-5',
  font: 'Arial',
  fontSize: 11,
  margins: {
    top: 1440,
    right: 1440,
    bottom: 1440,
    left: 1440
  },
  specialRequests: {
    replaceSignatures: true,
    addPageMarkers: true
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
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers

// Get settings
ipcMain.handle('get-settings', async () => {
  const settings = store.get('settings', DEFAULT_SETTINGS);
  return settings;
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  store.set('settings', settings);
  return { success: true };
});

// Get API key
ipcMain.handle('get-api-key', async () => {
  return store.get('api-key', '');
});

// Save API key
ipcMain.handle('save-api-key', async (event, apiKey) => {
  store.set('api-key', apiKey);
  return { success: true };
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
      { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

// Convert files
ipcMain.handle('convert-files', async (event, filePaths, settings) => {
  const apiKey = store.get('api-key', '');
  
  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured'
    };
  }
  
  const converter = require('./converter');
  const results = [];
  
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
        progress: (i / filePaths.length) * 100
      });
      
      // Convert file
      const result = await converter.convertFile(filePath, fileName, settings, apiKey, (progress) => {
        mainWindow.webContents.send('conversion-progress', {
          fileIndex: i,
          totalFiles: filePaths.length,
          fileName: path.basename(filePath),
          ...progress
        });
      });
      
      results.push(result);
      
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
    results
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
