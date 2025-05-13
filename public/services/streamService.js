const OBSWebSocket = require('obs-websocket-js').default;
const { exec } = require('child_process');

class StreamService {
  constructor() {
    this.obs = null;
    this.connected = false;
    this.streaming = false;
    this.currentGame = null;
  }
  
  async connect(address, password) {
    try {
      // Create a new instance each time to avoid stale connections
      this.obs = new OBSWebSocket();
      
      // Set up event handlers before connecting
      this.obs.on('ConnectionClosed', (data) => {
        console.log(`OBS connection closed: ${JSON.stringify(data)}`);
        this.connected = false;
      });
      
      this.obs.on('StreamStateChanged', (data) => {
        this.streaming = data.outputActive;
        console.log(`Stream state changed: ${this.streaming ? 'streaming' : 'not streaming'}`);
      });
      
      // Parse address - support both formats like "localhost:4455" and full URLs
      let url = address;
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        url = `ws://${url}`;
      }
      
      console.log(`Attempting to connect to OBS at: ${url}`);
      
      // Try multiple connection options if the primary one fails
      let connected = false;
      let lastError = null;
      
      // Try the provided URL first
      try {
        await this.obs.connect(url, password);
        connected = true;
        console.log(`Connected to OBS WebSocket at ${url}`);
      } catch (error) {
        lastError = error;
        console.log(`Primary connection failed: ${error.message}`);
      }
      
      // If primary connection failed, try IPv6 alternatives
      if (!connected) {
        // Extract the port from the URL
        const portMatch = url.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : '4455';
        
        // IPv6 alternatives to try
        const ipv6Alternatives = [
          `ws://[::1]:${port}`,               // IPv6 localhost
          `ws://[::ffff:127.0.0.1]:${port}`   // IPv4-mapped IPv6 address
        ];
        
        for (const ipv6Url of ipv6Alternatives) {
          try {
            console.log(`Trying IPv6 alternative: ${ipv6Url}`);
            await this.obs.connect(ipv6Url, password);
            connected = true;
            console.log(`Connected to OBS WebSocket using IPv6: ${ipv6Url}`);
            break;
          } catch (error) {
            console.log(`IPv6 connection failed: ${error.message}`);
          }
        }
      }
      
      // If all connection attempts failed, throw the original error
      if (!connected) {
        throw lastError || new Error('Failed to connect to OBS WebSocket');
      }
      
      this.connected = true;
      
      // Check current streaming status
      const { outputActive } = await this.obs.call('GetStreamStatus');
      this.streaming = outputActive;
      
      console.log('Connected to OBS WebSocket successfully');
      return true;
    } catch (error) {
      this.connected = false;
      
      // Provide more specific error messages
      console.error('Error connecting to OBS:', error);
      
      let errorMessage = 'Failed to connect to OBS';
      
      if (error.code === 1006) {
        errorMessage += ': Connection closed abnormally. Check that OBS is running, WebSocket server is enabled, and port 4455 is correct. Also ensure no firewall is blocking the connection.';
      } else if (error.code === 4009) {
        errorMessage += ': Authentication failed. Check your password.';
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }
  
  async disconnect() {
    try {
      if (this.connected && this.obs) {
        await this.obs.disconnect();
        this.connected = false;
        console.log('Disconnected from OBS WebSocket');
      }
      return true;
    } catch (error) {
      console.error('Error disconnecting from OBS:', error);
      return false;
    }
  }
  
  async startStream(gameId, accountName, summonerId, region) {
    try {
      if (!this.connected || !this.obs) {
        throw new Error('Not connected to OBS');
      }
      
      // Check current status
      const { outputActive } = await this.obs.call('GetStreamStatus');
      
      if (outputActive) {
        console.log('Already streaming');
        this.streaming = true;
        this.currentGame = gameId;
        return true;
      }
      
      // Launch League spectator mode for the current game
      await this.launchLeagueSpectator(gameId, summonerId, region);
      
      // Wait for spectator client to launch
      console.log('Waiting for spectator client to launch...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Set up scene with game capture
      await this.setUpLeagueScene();
      
      // Start the stream
      await this.obs.call('StartStream');
      
      this.streaming = true;
      this.currentGame = gameId;
      
      console.log(`Started streaming game ${gameId} for ${accountName}`);
      return true;
    } catch (error) {
      console.error('Error starting stream:', error);
      throw new Error(`Failed to start stream: ${error.message}`);
    }
  }
  
  async stopStream() {
    try {
      if (!this.connected || !this.obs) {
        throw new Error('Not connected to OBS');
      }
      
      // Check current status
      const { outputActive } = await this.obs.call('GetStreamStatus');
      
      if (!outputActive) {
        console.log('Not currently streaming');
        this.streaming = false;
        this.currentGame = null;
        return true;
      }
      
      // Stop the stream
      await this.obs.call('StopStream');
      
      this.streaming = false;
      this.currentGame = null;
      
      console.log('Stopped streaming');
      return true;
    } catch (error) {
      console.error('Error stopping stream:', error);
      throw new Error(`Failed to stop stream: ${error.message}`);
    }
  }
  
  async setUpLeagueScene() {
    try {
      if (!this.connected || !this.obs) {
        throw new Error('Not connected to OBS');
      }
      
      // Get scenes list
      const { scenes } = await this.obs.call('GetSceneList');
      const leagueScene = scenes.find(scene => scene.sceneName === 'League of Legends');
      
      // Create scene if needed
      if (!leagueScene) {
        await this.obs.call('CreateScene', {
          sceneName: 'League of Legends'
        });
      }
      
      // Set as current scene
      await this.obs.call('SetCurrentProgramScene', {
        sceneName: 'League of Legends'
      });
      
      // Check if League game source exists
      try {
        const { sceneItems } = await this.obs.call('GetSceneItemList', {
          sceneName: 'League of Legends'
        });
        
        const leagueSource = sceneItems.find(item => 
          item.sourceName === 'League Game'
        );
        
        if (!leagueSource) {
          await this.createLeagueGameSource();
        }
      } catch (error) {
        // Scene might exist but be empty
        await this.createLeagueGameSource();
      }
      
      return true;
    } catch (error) {
      console.error('Error setting up League scene:', error);
      throw error;
    }
  }
  
  async createLeagueGameSource() {
    if (!this.connected || !this.obs) {
      throw new Error('Not connected to OBS');
    }
    
    // Create game capture source for League
    await this.obs.call('CreateInput', {
      sceneName: 'League of Legends',
      inputName: 'League Game',
      inputKind: 'game_capture',
      inputSettings: {
        window: 'League of Legends.exe',
        window_match_priority: 1,
        capture_mode: 'window'
      }
    });
  }
  
  async launchLeagueSpectator(gameId, summonerId, region) {
    try {
      console.log(`Launching spectator for game ${gameId} in region ${region}`);
      
      // Get platform ID for the region
      const platformId = this.getPlatformId(region);
      
      if (!platformId) {
        throw new Error(`Unsupported region: ${region}`);
      }
      
      // Create spectator URL
      const spectatorUrl = `riot:spectator:${platformId}:${gameId}:${summonerId}:1`;
      
      // Launch URL using child_process
      exec(`start "" "${spectatorUrl}"`);
      
      console.log(`Spectator URL launched: ${spectatorUrl}`);
      return true;
    } catch (error) {
      console.error('Error launching spectator:', error);
      throw error;
    }
  }
  
  getPlatformId(region) {
    const platformMap = {
      'NA1': 'NA1',
      'EUW1': 'EUW1',
      'EUN1': 'EUN1',
      'KR': 'KR',
      'BR1': 'BR1',
      'JP1': 'JP1',
      'LA1': 'LA1',
      'LA2': 'LA2',
      'OC1': 'OC1',
      'TR1': 'TR1',
      'RU': 'RU'
    };
    
    return platformMap[region] || null;
  }
  
  getStatus() {
    return {
      connected: this.connected,
      streaming: this.streaming,
      currentGame: this.currentGame
    };
  }
}

module.exports = new StreamService();