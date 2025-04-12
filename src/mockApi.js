// Mock API for development in browser without Electron
const mockAccounts = [
    {
      id: '1',
      summonerName: 'TestAccount1',
      region: 'NA1',
      isActive: true,
      inGame: false,
      summonerId: 'sum123456' // Added summonerId
    },
    {
      id: '2',
      summonerName: 'TestAccount2',
      region: 'EUW1',
      isActive: true,
      inGame: true,
      gameId: '12345',
      summonerId: 'sum789012' // Added summonerId
    }
  ];
  
  const mockSettings = {
    obs: { address: 'localhost:4455', password: '' },
    twitch: { clientId: '', clientSecret: '', channelName: '' },
    streaming: {
      autoStart: true,
      titleTemplate: '{summonerName} playing League of Legends',
      quality: 'medium'
    }
  };
  
  // If window.api doesn't exist, create a mock version
  if (typeof window !== 'undefined' && !window.api) {
    window.api = {
      // Account management
      getAccounts: () => Promise.resolve(mockAccounts),
      
      // Improved to actually add the new account
      addAccount: (account) => {
        const newAccount = {
          id: Date.now().toString(),
          summonerName: account.summonerName,
          region: account.region,
          isActive: true,
          inGame: false,
          summonerId: 'sum' + Math.random().toString().substring(2, 8)
        };
        mockAccounts.push(newAccount);
        return Promise.resolve([...mockAccounts]);
      },
      
      // Improved to remove by ID
      removeAccount: (accountId) => {
        const index = mockAccounts.findIndex(acc => acc.id === accountId);
        if (index !== -1) mockAccounts.splice(index, 1);
        return Promise.resolve([...mockAccounts]);
      },
      
      // Improved to toggle the specified account
      toggleAccount: (accountId) => {
        const account = mockAccounts.find(acc => acc.id === accountId);
        if (account) account.isActive = !account.isActive;
        return Promise.resolve([...mockAccounts]);
      },
      
      // Added for AccountsPage
      checkAccountGame: () => Promise.resolve(null),
      
      // Monitoring
      startMonitoring: () => Promise.resolve(true),
      stopMonitoring: () => Promise.resolve(true),
      getMonitoringStatus: () => Promise.resolve(false),
      
      // Added for SettingsPage
      connectObs: () => Promise.resolve(true),
      connectTwitch: () => Promise.resolve(true),
      updateStreamInfo: () => Promise.resolve(true),
      
      // Settings
      getSettings: () => Promise.resolve(mockSettings),
      saveSettings: (newSettings) => {
        Object.assign(mockSettings, newSettings);
        return Promise.resolve({...mockSettings});
      },
      
      initializeApp: () => Promise.resolve(true),
      
      on: (channel, callback) => {
        console.log(`Mock registered listener for ${channel}`);
        return () => console.log(`Mock removed listener for ${channel}`);
      }
    };
    
    console.log('Mock API initialized for browser development');
  }
  
  const mockApiModule = {};
  export default mockApiModule;