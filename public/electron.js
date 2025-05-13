const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const ElectronStore = require('electron-store').default; 
const axios = require('axios'); // Make sure this is imported for featured games API call

// Import services
const leagueService = require('./services/leagueService');
const TwitchService = require('./services/twitchService');
const streamService = require('./services/streamService');

// Create a single instance of TwitchService
const twitchService = new TwitchService();

// Initialize settings store
const store = new ElectronStore();

// Create main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

let mainWindow;

app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });

  initializeApp();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Load settings from store
function getSettings() {
  return {
    obs: store.get('obs') || { address: 'localhost:4455', password: '' },
    twitch: store.get('twitch') || { clientId: '', clientSecret: '', channelName: '' },
    streaming: store.get('streaming') || {
      autoStart: true,
      titleTemplate: '{summonerName} playing League of Legends',
      quality: 'medium'
    },
    league: store.get('league') || { apiKey: '' }
  };
}

// App initialization
async function initializeApp() {
  try {
    const settings = getSettings();

    if (settings.league && settings.league.apiKey) {
      leagueService.setApiKey(settings.league.apiKey);
    }

    leagueService.setGameDetectedCallback(async (account, gameData) => {
      console.log(`Game detected for ${account ? account.summonerName : 'undefined'}`);

      try {
        // Update the account's state in the stored accounts
        const accounts = store.get('accounts') || [];
        const filteredAccounts = accounts.filter(acc => acc !== null);
        const updatedAccounts = filteredAccounts.map(acc => {
          if (acc && acc.id === account.id) {
            return { ...acc, inGame: true, gameId: gameData.gameId };
          }
          return acc;
        });
        
        store.set('accounts', updatedAccounts);

        // Send notification to the frontend about updated accounts
        if (mainWindow) {
          mainWindow.webContents.send('accounts-updated', updatedAccounts);
        }

        const streamSettings = settings.streaming || {};
        console.log('Auto-start streaming:', streamSettings.autoStart);

        if (streamSettings.autoStart) {
          if (!streamService.connected && settings.obs) {
            console.log('Connecting to OBS...');
            await streamService.connect(settings.obs.address, settings.obs.password);
            
            // Send OBS status update to UI
            if (mainWindow) {
              mainWindow.webContents.send('obs-status-changed', streamService.getStatus());
            }
          }

          // Connect to Twitch and check authentication status
          let twitchConnected = false;
          if (settings.twitch?.clientId && settings.twitch?.clientSecret) {
            console.log('Connecting to Twitch...');
            twitchConnected = await twitchService.connect(
              settings.twitch.clientId,
              settings.twitch.clientSecret,
              settings.twitch.channelName
            );
            console.log('Twitch connected:', twitchConnected);
            
            // Send Twitch status update to UI
            if (mainWindow) {
              mainWindow.webContents.send('twitch-status-changed', twitchService.getStatus());
            }
          }

          // Try to update Twitch stream info if we have valid auth
          if (twitchConnected && twitchService.accessToken) {
            try {
              let title = streamSettings.titleTemplate || '{summonerName} playing League of Legends';
              title = title.replace('{summonerName}', account.summonerName || 'League player');
              
              console.log(`Updating Twitch stream info: "${title}"`);
              await twitchService.updateStreamInfo(title, 'League of Legends');
            } catch (twitchError) {
              console.error('Error updating Twitch stream info:', twitchError.message);
              // Continue with OBS streaming even if Twitch update fails
            }
          } else {
            console.log('Skipping Twitch update - not authenticated or connected');
          }

          // Start OBS streaming with additional parameters for spectator mode
          console.log('Starting OBS stream...');
          await streamService.startStream(
            gameData.gameId, 
            account.summonerName,
            account.summonerId,
            account.region
          );

          // Send stream status update to UI
          if (mainWindow) {
            mainWindow.webContents.send('stream-started', { account, gameData });
            mainWindow.webContents.send('obs-status-changed', streamService.getStatus());
          }
        }
      } catch (error) {
        console.error('Error handling game detection:', error);
      }
    });

    leagueService.setGameEndedCallback(async (account, gameId) => {
      console.log(`Game ended for ${account.summonerName}`);

      try {
        // Update the account's state in the stored accounts
        const accounts = store.get('accounts') || [];
        const filteredAccounts = accounts.filter(acc => acc !== null);
        const updatedAccounts = filteredAccounts.map(acc => {
          if (acc && acc.id === account.id) {
            return { ...acc, inGame: false, gameId: null };
          }
          return acc;
        });
        
        store.set('accounts', updatedAccounts);

        // Send notification to the frontend about updated accounts
        if (mainWindow) {
          mainWindow.webContents.send('accounts-updated', updatedAccounts);
        }

        const activeAccounts = updatedAccounts.filter(acc => acc.isActive);
        const anyInGame = activeAccounts.some(acc => acc.inGame && acc.id !== account.id);

        if (!anyInGame && streamService.connected && streamService.streaming) {
          await streamService.stopStream();

          // Send updated status to UI
          if (mainWindow) {
            mainWindow.webContents.send('stream-stopped', { account });
            mainWindow.webContents.send('obs-status-changed', streamService.getStatus());
          }
        }
      } catch (error) {
        console.error('Error handling game end:', error);
      }
    });

    return true;
  } catch (error) {
    console.error('Error initializing app:', error);
    return false;
  }
}

// IPC handlers

ipcMain.handle('get-accounts', async () => {
  const accounts = store.get('accounts') || [];
  return accounts.filter(account => account !== null);
});

ipcMain.handle('add-account', async (event, account) => {
  try {
    const newAccount = await leagueService.addAccount(account.summonerName, account.region);
    if (!newAccount) {
      throw new Error('Failed to add account: Invalid response from API');
    }
    
    const accounts = store.get('accounts') || [];
    const filteredAccounts = accounts.filter(account => account !== null);
    filteredAccounts.push(newAccount);
    store.set('accounts', filteredAccounts);
    return filteredAccounts;
  } catch (error) {
    console.error('Error adding account:', error);
    throw error;
  }
});

ipcMain.handle('remove-account', async (event, accountId) => {
  const accounts = store.get('accounts') || [];
  const filteredAccounts = accounts.filter(account => account !== null && account.id !== accountId);
  store.set('accounts', filteredAccounts);
  return filteredAccounts;
});

ipcMain.handle('toggle-account', async (event, accountId) => {
  const accounts = store.get('accounts') || [];
  const filteredAccounts = accounts.filter(account => account !== null);
  const updatedAccounts = filteredAccounts.map(account =>
    account.id === accountId ? { ...account, isActive: !account.isActive } : account
  );
  store.set('accounts', updatedAccounts);

  if (leagueService.isMonitoring) {
    const activeAccounts = updatedAccounts.filter(acc => acc.isActive);
    leagueService.startMonitoring(activeAccounts);
  }

  return updatedAccounts;
});

ipcMain.handle('check-account-game', async (event, account) => {
  try {
    if (!account || !account.summonerName || !account.region) {
      throw new Error('Invalid account data');
    }
    
    // Construct proper Riot ID
    const riotId = account.gameName && account.tagLine 
      ? `${account.gameName}#${account.tagLine}`
      : account.summonerName;
      
    console.log(`Checking game for: ${riotId} in region ${account.region}`);
    const gameData = await leagueService.checkActiveGame(riotId, account.region);
    
    // Update the account's game status in the store
    if (gameData) {
      const accounts = store.get('accounts') || [];
      const filteredAccounts = accounts.filter(acc => acc !== null);
      const updatedAccounts = filteredAccounts.map(acc => {
        if (acc && acc.id === account.id) {
          return { ...acc, inGame: gameData.inGame, gameId: gameData.gameId };
        }
        return acc;
      });
      
      store.set('accounts', updatedAccounts);
      
      // Notify the UI of the updated accounts
      if (mainWindow) {
        mainWindow.webContents.send('accounts-updated', updatedAccounts);
      }
    }
    
    return gameData;
  } catch (error) {
    console.error('Error checking account game:', error);
    return null;
  }
});

ipcMain.handle('start-monitoring', async () => {
  try {
    const accounts = store.get('accounts') || [];
    console.log('Accounts loaded from storage:', JSON.stringify(accounts, null, 2));
    
    const filteredAccounts = accounts.filter(account => account !== null);
    const activeAccounts = filteredAccounts.filter(acc => acc.isActive);

    if (activeAccounts.length === 0) {
      throw new Error('No active accounts to monitor');
    }

    return leagueService.startMonitoring(activeAccounts);
  } catch (error) {
    console.error('Error starting monitoring:', error);
    throw error;
  }
});

ipcMain.handle('stop-monitoring', async () => {
  try {
    return leagueService.stopMonitoring();
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    throw error;
  }
});

ipcMain.handle('get-monitoring-status', async () => {
  return leagueService.getMonitoringStatus();
});

ipcMain.handle('connect-obs', async (event, config) => {
  try {
    const result = await streamService.connect(config.address, config.password);
    
    // Send OBS status update to UI
    if (mainWindow) {
      mainWindow.webContents.send('obs-status-changed', streamService.getStatus());
    }
    
    return result;
  } catch (error) {
    console.error('Error connecting to OBS:', error);
    throw error;
  }
});

ipcMain.handle('connect-twitch', async (event, config) => {
  try {
    return await twitchService.connect(
      config.clientId,
      config.clientSecret,
      config.channelName
    );
  } catch (error) {
    console.error('Error connecting to Twitch:', error);
    throw error;
  }
});

ipcMain.handle('update-stream-info', async (event, info) => {
  try {
    return await twitchService.updateStreamInfo(info.title, info.game || 'League of Legends');
  } catch (error) {
    console.error('Error updating stream info:', error);
    throw error;
  }
});

ipcMain.handle('get-settings', async () => {
  return getSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    if (settings.obs) store.set('obs', settings.obs);
    if (settings.twitch) store.set('twitch', settings.twitch);
    if (settings.streaming) store.set('streaming', settings.streaming);
    if (settings.league) store.set('league', settings.league);

    if (settings.league?.apiKey) {
      leagueService.setApiKey(settings.league.apiKey);
    }

    return settings;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
});

ipcMain.handle('initialize-app', async () => {
  return await initializeApp();
});

ipcMain.handle('get-obs-status', async () => {
  return streamService.getStatus();
});

// New IPC handlers for Twitch authentication
ipcMain.handle('get-twitch-auth-status', () => {
  return {
    connected: Boolean(twitchService.accessToken && Date.now() < (twitchService.tokenExpiration || 0)),
    channelName: twitchService.channelName
  };
});

ipcMain.handle('start-twitch-auth', async () => {
  try {
    const settings = getSettings();
    if (!settings.twitch?.clientId || !settings.twitch?.clientSecret) {
      throw new Error('Twitch Client ID and Secret must be configured');
    }
    
    // Initialize with stored settings
    await twitchService.connect(
      settings.twitch.clientId,
      settings.twitch.clientSecret,
      settings.twitch.channelName
    );
    
    // Start auth flow
    const success = await twitchService.startAuthFlow();
    
    // Notify the UI of the updated status
    if (mainWindow) {
      mainWindow.webContents.send('twitch-status-changed', {
        connected: Boolean(twitchService.accessToken),
        channelName: twitchService.channelName
      });
    }
    
    return success;
  } catch (error) {
    console.error('Error starting Twitch auth:', error);
    throw error;
  }
});

ipcMain.handle('disconnect-twitch', async () => {
  twitchService.clearTokens();
  
  // Notify the UI of the updated status
  if (mainWindow) {
    mainWindow.webContents.send('twitch-status-changed', {
      connected: false,
      channelName: null
    });
  }
  
  return true;
});

ipcMain.handle('test-start-stream', async () => {
  try {
    console.log('Starting test stream...');
    
    // Connect to OBS if needed
    if (!streamService.connected) {
      const settings = getSettings();
      console.log('Connecting to OBS...');
      await streamService.connect(settings.obs.address, settings.obs.password);
    }
    
    // Find a real game to stream - first check monitored accounts
    console.log('Looking for an active game to stream...');
    const accounts = store.get('accounts') || [];
    const activeAccounts = accounts.filter(acc => acc && acc.isActive);
    
    let accountWithGame = null;
    let gameData = null;
    
    // Check if any monitored accounts are in game
    for (const account of activeAccounts) {
      try {
        if (account && account.summonerName && account.region) {
          console.log(`Checking if ${account.summonerName} is in game...`);
          const checkResult = await leagueService.checkActiveGame(account.summonerName, account.region);
          
          if (checkResult && checkResult.inGame) {
            console.log(`Found active game for ${account.summonerName}`);
            accountWithGame = account;
            gameData = checkResult;
            break;
          }
        }
      } catch (error) {
        console.log(`Error checking game for ${account.summonerName}:`, error.message);
      }
    }
    
    // If no monitored accounts are in game, use a featured game
    if (!accountWithGame) {
      console.log('No monitored accounts in game, trying to get a featured game...');
      
      try {
        // Get the featured games for a reliable region (NA1)
        const region = 'NA1';
        const url = `https://${region}.api.riotgames.com/lol/spectator/v4/featured-games`;
        
        const response = await axios.get(url, {
          headers: {
            'X-Riot-Token': leagueService.apiKey
          }
        });
        
        if (response.data && response.data.gameList && response.data.gameList.length > 0) {
          const featuredGame = response.data.gameList[0];
          const participant = featuredGame.participants[0]; // Get first player
          
          console.log(`Found featured game with ${participant.summonerName}`);
          
          // Create a temporary account object for the featured player
          accountWithGame = {
            summonerName: participant.summonerName,
            summonerId: participant.summonerId,
            region: region
          };
          
          // Format game data to match what our service expects
          gameData = {
            inGame: true,
            gameId: featuredGame.gameId,
            gameMode: featuredGame.gameMode,
            mapId: featuredGame.mapId,
            observers: featuredGame.observers,
            participants: featuredGame.participants
          };
        }
      } catch (error) {
        console.error('Error getting featured game:', error.message);
      }
    }
    
    // If we still don't have a game, throw an error
    if (!accountWithGame || !gameData) {
      throw new Error('No active games found to test stream. Please ensure at least one monitored account is in a game, or try again later.');
    }
    
    // Try to update Twitch info if authenticated
    try {
      if (twitchService.accessToken) {
        const title = `Test Stream: ${accountWithGame.summonerName} playing League of Legends`;
        console.log('Updating Twitch stream info:', title);
        await twitchService.updateStreamInfo(title, 'League of Legends');
      }
    } catch (twitchError) {
      console.error('Twitch update error during test:', twitchError);
      // Continue with OBS anyway
    }
    
    // Start the stream with the real game data
    console.log(`Starting OBS stream for test using ${accountWithGame.summonerName}'s game...`);
    await streamService.startStream(
      gameData.gameId, 
      accountWithGame.summonerName,
      accountWithGame.summonerId,
      accountWithGame.region
    );
    
    // Update UI
    if (mainWindow) {
      console.log('Sending stream-started event to UI');
      mainWindow.webContents.send('stream-started', {
        account: accountWithGame,
        gameData: gameData
      });
      mainWindow.webContents.send('obs-status-changed', streamService.getStatus());
    }
    
    return true;
  } catch (error) {
    console.error('Test stream error:', error);
    throw error;
  }
});