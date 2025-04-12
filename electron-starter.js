#!/usr/bin/env node

// Start Electron using the correct file
const electron = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Select the right electron.js file based on environment
const mainFile = isDev ? 
  path.join(__dirname, 'public/electron.js') : 
  path.join(__dirname, 'build/electron.js');

// Pass only safe arguments to electron
const { spawn } = require('child_process');
const args = [mainFile, ...process.argv.slice(2)];

// Start Electron
const proc = spawn(electron, args, { stdio: 'inherit' });

proc.on('close', (code) => {
  process.exit(code);
});

proc.on('error', (err) => {
  console.error('Failed to start electron:', err);
  process.exit(1);
});