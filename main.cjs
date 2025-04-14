'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Log startup
console.log('🚀 Electron main process starting...');

// Set ICU data file path - MUST be before any other Electron initialization
const isPackaged = !process.env.NODE_ENV || process.env.NODE_ENV === 'production';
if (isPackaged) {
  try {
    // Create an array of possible ICU data file locations
    const icuPaths = [
      path.join(process.resourcesPath, 'icudtl.dat'),
      path.join(__dirname, 'icudtl.dat'),
      path.join(app.getAppPath(), 'icudtl.dat'),
      path.join(path.dirname(app.getPath('exe')), 'icudtl.dat'),
      path.join(app.getPath('exe'), '..', 'icudtl.dat'),
      // Look in resources dir
      path.join(process.resourcesPath || '', 'resources', 'icudtl.dat'),
      // Look in unpackaged resources
      path.join(app.getAppPath(), 'resources', 'icudtl.dat')
    ];
    
    let icuPathFound = false;
    
    for (const icuPath of icuPaths) {
      console.log('Checking for ICU data file at:', icuPath);
      
      if (fs.existsSync(icuPath)) {
        console.log('✅ Found ICU data file at:', icuPath);
        app.commandLine.appendSwitch('icu-data-file', icuPath);
        icuPathFound = true;
        break;
      }
    }
    
    if (!icuPathFound) {
      console.error('❌ Could not find ICU data file in any of the expected locations');
    }
    
    // Handle FFmpeg
    // Add FFmpeg path to process.env so child processes can find it
    const possibleFfmpegPaths = [
      path.join(app.getAppPath(), 'ffmpeg.dll'),
      path.join(app.getAppPath(), '../ffmpeg.dll'),
      path.join(__dirname, 'ffmpeg.dll'),
      path.join(process.resourcesPath || '', 'ffmpeg.dll'),
      path.join(app.getAppPath(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
    ];
    
    for (const ffmpegPath of possibleFfmpegPaths) {
      if (fs.existsSync(ffmpegPath)) {
        console.log('Found FFmpeg at:', ffmpegPath);
        process.env.FFMPEG_PATH = ffmpegPath;
        // Also make it available on global scope for convenience
        global.FFMPEG_PATH = ffmpegPath;
        break;
      } else {
        console.log('FFmpeg not found at:', ffmpegPath);
      }
    }
  } catch (error) {
    console.error('Error setting up environment paths:', error);
  }
}

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in main process:', error);
});

const isDev = process.env.NODE_ENV === 'development';

function getMainPath() {
  if (isDev) {
    return path.join(__dirname, 'public', 'electron.js');
  }
  
  // For production, use a path that matches your build structure
  return path.join(app.getAppPath(), 'build', 'electron.js');
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