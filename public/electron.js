const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const ElectronStore = require('electron-store').default; 

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
      console.log(`Game detected for ${account.summonerName}`);

      try {
        const streamSettings = settings.streaming || {};

        if (streamSettings.autoStart) {
          if (!streamService.connected && settings.obs) {
            await streamService.connect(settings.obs.address, settings.obs.password);
          }

          if (settings.twitch?.clientId && settings.twitch?.clientSecret) {
            await twitchService.connect(
              settings.twitch.clientId,
              settings.twitch.clientSecret,
              settings.twitch.channelName
            );
          }

          let title = streamSettings.titleTemplate || '{summonerName} playing League of Legends';
          title = title.replace('{summonerName}', account.summonerName);

          await twitchService.updateStreamInfo(title, 'League of Legends');
          await streamService.startStream(gameData.gameId, account.summonerName);

          if (mainWindow) {
            mainWindow.webContents.send('stream-started', { account, gameData });
          }
        }
      } catch (error) {
        console.error('Error starting stream:', error);
      }
    });

    leagueService.setGameEndedCallback(async (account, gameId) => {
      console.log(`Game ended for ${account.summonerName}`);

      try {
        const accounts = store.get('accounts') || [];
        const filteredAccounts = accounts.filter(acc => acc !== null);
        const activeAccounts = filteredAccounts.filter(acc => acc.isActive);
        const anyInGame = activeAccounts.some(acc => acc.inGame && acc.id !== account.id);

        if (!anyInGame && streamService.connected && streamService.streaming) {
          await streamService.stopStream();

          if (mainWindow) {
            mainWindow.webContents.send('stream-stopped', { account });
          }
        }
      } catch (error) {
        console.error('Error stopping stream:', error);
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
    return await leagueService.checkActiveGame(account.summonerName, account.region);
  } catch (error) {
    console.error('Error checking account game:', error);
    return null;
  }
});

ipcMain.handle('start-monitoring', async () => {
  try {
    const accounts = store.get('accounts') || [];
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
    return await streamService.connect(config.address, config.password);
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