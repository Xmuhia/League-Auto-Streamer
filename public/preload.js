// public/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Account management
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  removeAccount: (accountId) => ipcRenderer.invoke('remove-account', accountId),
  toggleAccount: (accountId) => ipcRenderer.invoke('toggle-account', accountId),
  checkAccountGame: (account) => ipcRenderer.invoke('check-account-game', account),
  
  // Monitoring
  startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  
  // OBS and Twitch integration
  connectObs: (config) => ipcRenderer.invoke('connect-obs', config),
  connectTwitch: (config) => ipcRenderer.invoke('connect-twitch', config),
  updateStreamInfo: (info) => ipcRenderer.invoke('update-stream-info', info),
  getObsStatus: () => ipcRenderer.invoke('get-obs-status'),
  
  // Twitch authentication
  getTwitchAuthStatus: () => ipcRenderer.invoke('get-twitch-auth-status'),
  startTwitchAuth: () => ipcRenderer.invoke('start-twitch-auth'),
  disconnectTwitch: () => ipcRenderer.invoke('disconnect-twitch'),
  
  // Test functions
  testStartStream: () => ipcRenderer.invoke('test-start-stream'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // App initialization
  initializeApp: () => ipcRenderer.invoke('initialize-app'),
  
  // Event system
  on: (channel, callback) => {
    const validChannels = [
      'open-settings', 
      'open-about', 
      'account-updated', 
      'stream-started', 
      'stream-stopped', 
      'accounts-updated',
      'obs-status-changed',
      'twitch-status-changed'  // Added new event channel
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  }
});