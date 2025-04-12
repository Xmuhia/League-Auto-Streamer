'use strict';

const path = require('path');
const { app } = require('electron');

// Log startup
console.log('🚀 Electron main process starting...');

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in main process:', error);
});

const isDev = process.env.NODE_ENV === 'development';


function getMainPath() {
  if (isDev) {
    return path.join(__dirname, 'public', 'electron.js');
  }

 
  return path.join(app.getAppPath(), 'public', 'electron.js');
}

// Delay loading the main file until after Electron is ready
app.whenReady().then(() => {
  const mainPath = getMainPath();
  console.log(`🔍 Loading main Electron file from: ${mainPath}`);

  try {
    require(mainPath);
  } catch (error) {
    console.error('❌ Failed to load main process file:', mainPath);
    console.error(error);
    app.quit(); 
  }
});
