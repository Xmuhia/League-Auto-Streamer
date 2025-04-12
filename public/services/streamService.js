const OBSWebSocket = require('obs-websocket-js').default;

class StreamService {
  constructor() {
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.streaming = false;
    this.currentGame = null;
    
    // Set up event handlers
    this.obs.on('StreamStateChanged', (data) => {
      this.streaming = data.outputActive;
      console.log(`Stream state changed: ${this.streaming ? 'streaming' : 'not streaming'}`);
    });
  }
  
  async connect(address, password) {
    try {
      // Parse address
      let url = address;
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        url = `ws://${url}`;
      }
      
      // Connect to OBS (v5 API)
      await this.obs.connect(url, password);
      this.connected = true;
      
      // Check current streaming status
      const { outputActive } = await this.obs.call('GetStreamStatus');
      this.streaming = outputActive;
      
      console.log('Connected to OBS WebSocket');
      return true;
    } catch (error) {
      console.error('Error connecting to OBS:', error);
      this.connected = false;
      throw new Error(`Failed to connect to OBS: ${error.message}`);
    }
  }
  
  async disconnect() {
    try {
      if (this.connected) {
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
  
  async startStream(gameId, accountName) {
    try {
      if (!this.connected) {
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
      if (!this.connected) {
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
  
  getStatus() {
    return {
      connected: this.connected,
      streaming: this.streaming,
      currentGame: this.currentGame
    };
  }
}

module.exports = new StreamService();