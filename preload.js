const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // API Key
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  hasApiKey: () => ipcRenderer.invoke('has-api-key'),
  testApiKey: (apiKey) => ipcRenderer.invoke('test-api-key', apiKey),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Skill management
  uploadSkillForUser: (apiKey) => ipcRenderer.invoke('upload-skill-for-user', apiKey),
  getSkillId: () => ipcRenderer.invoke('get-skill-id'),
  setSkillId: (skillId) => ipcRenderer.invoke('set-skill-id', skillId),

  // Prompt management
  getPrompt: (mode) => ipcRenderer.invoke('get-prompt', mode),
  saveCustomPrompt: (text) => ipcRenderer.invoke('save-custom-prompt', text),
  resetPrompt: (mode) => ipcRenderer.invoke('reset-prompt', mode),

  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  convertFiles: (filePaths, settings) => ipcRenderer.invoke('convert-files', filePaths, settings),
  showOutputFolder: () => ipcRenderer.invoke('show-output-folder'),

  // Progress updates
  onConversionProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (event, data) => callback(data));
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
