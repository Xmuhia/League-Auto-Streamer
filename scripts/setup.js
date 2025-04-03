/**
 * Setup script to help first-time users configure the application
 * Run with: node scripts/setup.js
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');

// Initialize the store
const store = new Store();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Ask a question and get user input
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User response
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Main setup function
 */
async function setup() {
  console.log('\n=== League Auto-Streamer Setup ===\n');
  console.log('This script will help you configure the basic settings for the application.');
  console.log('You can always change these settings later from the Settings page.\n');

  // Get Riot API key
  console.log('\n=== Riot Games API Setup ===');
  console.log('You need a Riot Games API key to monitor League of Legends accounts.');
  console.log('Get your API key from: https://developer.riotgames.com\n');
  
  const apiKey = await askQuestion('Enter your Riot API key: ');
  
  if (apiKey) {
    store.set('league', { apiKey });
    console.log('Riot API key saved successfully!');
  } else {
    console.log('No API key provided. You can add it later in the application settings.');
  }

  // OBS WebSocket setup
  console.log('\n=== OBS WebSocket Setup ===');
  console.log('To control OBS automatically, you need to enable the WebSocket server in OBS.');
  console.log('1. Open OBS Studio');
  console.log('2. Go to Tools > WebSocket Server Settings');
  console.log('3. Enable WebSocket server and note the Server Port (default: 4455)');
  console.log('4. Optionally set a password\n');
  
  const obsAddress = await askQuestion('Enter OBS WebSocket address (default: localhost:4455): ');
  const obsPassword = await askQuestion('Enter OBS WebSocket password (leave empty if none): ');
  
  store.set('obs', { 
    address: obsAddress || 'localhost:4455',
    password: obsPassword
  });
  
  console.log('OBS settings saved successfully!');

  // Twitch setup
  console.log('\n=== Twitch Integration Setup ===');
  console.log('To update stream information automatically, you need to create a Twitch application.');
  console.log('1. Go to https://dev.twitch.tv/console/apps');
  console.log('2. Register a new application');
  console.log('3. Set the OAuth Redirect URL to http://localhost');
  console.log('4. Get the Client ID and generate a Client Secret\n');
  
  const channelName = await askQuestion('Enter your Twitch channel name: ');
  const clientId = await askQuestion('Enter your Twitch Client ID: ');
  const clientSecret = await askQuestion('Enter your Twitch Client Secret: ');
  
  if (channelName && clientId && clientSecret) {
    store.set('twitch', { channelName, clientId, clientSecret });
    console.log('Twitch settings saved successfully!');
  } else {
    console.log('Some Twitch settings were missing. You can add them later in the application settings.');
  }

  // Streaming preferences
  console.log('\n=== Streaming Preferences ===');
  
  const autoStartAnswer = await askQuestion('Automatically start streaming when a game is detected? (y/n, default: y): ');
  const autoStart = autoStartAnswer.toLowerCase() !== 'n';
  
  const titleTemplate = await askQuestion('Enter stream title template (default: "{summonerName} playing League of Legends"): ');
  
  const qualityOptions = ['low', 'medium', 'high'];
  const qualityAnswer = await askQuestion('Select stream quality (low/medium/high, default: medium): ');
  const quality = qualityOptions.includes(qualityAnswer.toLowerCase()) ? qualityAnswer.toLowerCase() : 'medium';
  
  store.set('streaming', {
    autoStart,
    titleTemplate: titleTemplate || '{summonerName} playing League of Legends',
    quality
  });
  
  console.log('Streaming preferences saved successfully!');

  console.log('\n=== Setup Complete! ===');
  console.log('You can now start the League Auto-Streamer application.');
  console.log('All settings can be modified from the Settings page.');

  rl.close();
}

// Run the setup
setup().catch(error => {
  console.error('Setup error:', error);
  rl.close();
});