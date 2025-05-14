const OBSWebSocket = require('obs-websocket-js').default;
const { exec } = require('child_process');
const leagueService = require('./leagueService');

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
  
  async startStream(gameId, accountName, summonerId, region, gameData = null) {
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
      
      // If gameData is provided directly, use it instead of fetching
      let actualGameData = gameData;
      
      // Only fetch game data if not provided
      if (!actualGameData) {
        // Get game data to obtain encryption key with retries
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!actualGameData && attempts < maxAttempts) {
          attempts++;
          try {
            console.log(`Attempt ${attempts}/${maxAttempts} to get game data for ${summonerId}`);
            actualGameData = await this.getGameInfo(summonerId, region);
            
            if (actualGameData) {
              console.log('Game data retrieved successfully');
              break;
            } else {
              console.log(`No game data found (attempt ${attempts}/${maxAttempts})`);
              if (attempts < maxAttempts) {
                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (error) {
            console.error(`Error getting game data (attempt ${attempts}/${maxAttempts}):`, error.message);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!actualGameData) {
          throw new Error(`No active game data found for ${accountName} after ${maxAttempts} attempts`);
        }
      }
      
      // When using just gameId (from stored data), create a minimal game data structure
      if (actualGameData && !actualGameData.observers) {
        console.log(`Creating minimal game data from gameId ${gameId}`);
        actualGameData = {
          gameId: gameId,
          platformId: region // Use region as platformId for spectator URL
        };
      }
      
      // Launch League spectator mode for the current game
      await this.launchLeagueSpectator(actualGameData, region);
      
      // Wait for spectator client to launch
      await this.waitForSpectatorLaunch(10000);
      
      // Set up scene with game capture - with retries
      let sceneSetupSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempt ${attempt}/3 to set up League scene`);
          await this.setUpLeagueScene();
          sceneSetupSuccess = true;
          break;
        } catch (error) {
          console.error(`Scene setup attempt ${attempt} failed:`, error);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!sceneSetupSuccess) {
        console.warn('Failed to set up scene properly. Continuing anyway, but stream may not show game.');
      }
      
      // Start the stream
      console.log('Starting OBS stream...');
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
          item.sourceName === 'League Game' || item.sourceName === 'League Game (Placeholder)'
        );
        
        if (!leagueSource) {
          await this.createLeagueGameSource();
        }
      } catch (error) {
        // Scene might exist but be empty
        console.log('Error getting scene items, creating source anyway:', error.message);
        await this.createLeagueGameSource();
      }
      
      return true;
    } catch (error) {
      console.error('Error setting up League scene:', error);
      
      // If we still have a connection, try to create a basic fallback scene as a last resort
      if (this.connected && this.obs) {
        try {
          console.log('Attempting to create fallback scene...');
          
          // Create a basic scene if it doesn't exist
          await this.obs.call('CreateScene', {
            sceneName: 'League Fallback'
          });
          
          // Set as current scene
          await this.obs.call('SetCurrentProgramScene', {
            sceneName: 'League Fallback'
          });
          
          // Add a text source
          await this.obs.call('CreateInput', {
            sceneName: 'League Fallback',
            inputName: 'Info Text',
            inputKind: 'text_ft2_source_v2',
            inputSettings: {
              text: 'League of Legends Stream\nGame capture not available - please configure manually'
            }
          });
          
          console.log('Created fallback scene successfully');
          return true;
        } catch (fallbackError) {
          console.error('Failed to create fallback scene:', fallbackError);
        }
      }
      
      throw error;
    }
  }
  
  async createLeagueGameSource() {
    if (!this.connected || !this.obs) {
      throw new Error('Not connected to OBS');
    }
    
    // Different source types based on platform
    if (process.platform === 'win32') {
      // Windows - use game_capture
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
    } else if (process.platform === 'darwin') {
      // macOS - use display_capture or window_capture
      try {
        console.log('Creating display capture source for macOS');
        await this.obs.call('CreateInput', {
          sceneName: 'League of Legends',
          inputName: 'League Game',
          inputKind: 'display_capture',
          inputSettings: {
            // Display capture doesn't need specific window settings
          }
        });
      } catch (error) {
        console.log('Failed to create display_capture, trying window_capture:', error.message);
        try {
          await this.obs.call('CreateInput', {
            sceneName: 'League of Legends',
            inputName: 'League Game',
            inputKind: 'window_capture',
            inputSettings: {
              // On macOS, we can't specify a window title as easily
              // Just create the source and let user configure it manually
            }
          });
        } catch (windowError) {
          console.error('Failed to create window_capture:', windowError.message);
          // Create a text source as a fallback
          await this.obs.call('CreateInput', {
            sceneName: 'League of Legends',
            inputName: 'League Game (Placeholder)',
            inputKind: 'text_ft2_source_v2',
            inputSettings: {
              text: 'League of Legends Stream\nPlease configure capture source manually'
            }
          });
        }
      }
    } else {
      // Linux or other platforms - use window_capture
      try {
        await this.obs.call('CreateInput', {
          sceneName: 'League of Legends',
          inputName: 'League Game',
          inputKind: 'window_capture',
          inputSettings: {
            // Window capture settings for Linux
          }
        });
      } catch (error) {
        console.error('Failed to create window_capture:', error.message);
        // Fallback to a text source
        await this.obs.call('CreateInput', {
          sceneName: 'League of Legends',
          inputName: 'League Game (Placeholder)',
          inputKind: 'text_ft2_source_v2',
          inputSettings: {
            text: 'League of Legends Stream\nPlease configure capture source manually'
          }
        });
      }
    }
  }
  
  async getGameInfo(summonerId, region) {
    try {
      // Get game data using leagueService
      console.log(`Getting game data for ${summonerId} in ${region}`);
      const gameData = await leagueService.checkActiveGame(summonerId, region);
      
      if (!gameData) {
        console.log(`No active game found for summoner ${summonerId}`);
        return null;
      }
      
      console.log(`Game data retrieved. Game ID: ${gameData.gameId}, Platform: ${gameData.platformId}`);
      return gameData;
    } catch (error) {
      console.error(`Error getting game info: ${error.message}`);
      return null;
    }
  }
  
  async launchLeagueSpectator(gameData, region) {
    try {
      console.log(`Launching spectator for game ${gameData.gameId} in region ${region}`);
      
      // Extract needed information from game data
      const platformId = gameData.platformId || this.getPlatformId(region);
      const gameId = gameData.gameId;
      
      // Handle case when observers might be missing entirely (for minimal game data)
      const encryptionKey = gameData.observers 
        ? (typeof gameData.observers === 'string' ? gameData.observers : gameData.observers.encryptionKey)
        : "";
      
      if (!platformId) {
        throw new Error(`Unsupported region: ${region}`);
      }
      
      // For macOS, use a completely different approach - direct executable launch
      if (process.platform === 'darwin') {
        try {
          // Find the League of Legends executable inside the app bundle
          const leagueAppPath = '/Applications/League of Legends.app';
          const leagueExePath = '/Applications/League of Legends.app/Contents/LoL/League of Legends.app/Contents/MacOS/LeagueClient';
          
          let spectateCommand;
          
          // First try to use LeagueClient executable directly with spectate args
          if (encryptionKey) {
            spectateCommand = `"${leagueExePath}" "--spectator-server=" "--spectator-endpoint=${platformId}" "--game-id=${gameId}" "--encryption-key=${encryptionKey}"`;
          } else {
            spectateCommand = `"${leagueExePath}" "--spectator-server=" "--spectator-endpoint=${platformId}" "--game-id=${gameId}"`;
          }
          
          console.log(`Attempting to launch spectator with command: ${spectateCommand}`);
          
          // Try to run the command
          exec(spectateCommand, (error, stdout, stderr) => {
            if (error) {
              console.error('Error launching spectator with direct command:', error);
              console.log('Falling back to app launch...');
              
              // Fall back to simply opening the app
              exec(`open "${leagueAppPath}"`, (openError) => {
                if (openError) {
                  console.error('Error opening League app:', openError);
                } else {
                  console.log('Opened League app without spectator parameters');
                }
              });
            } else {
              console.log('Successfully launched spectator with direct command');
            }
          });
        } catch (macError) {
          console.error('Error in macOS-specific spectator launch:', macError);
          
          // Fall back to simply opening the League app
          exec(`open -a "League of Legends"`, (error) => {
            if (error) {
              console.error('Error opening League app:', error);
            } else {
              console.log('Opened League app as fallback');
            }
          });
        }
      } else if (process.platform === 'win32') {
        // Windows approach with the URL protocol
        const spectatorUrl = encryptionKey 
          ? `riot:spectator:${platformId}:${gameId}:${encryptionKey}`
          : `riot:spectator:${platformId}:${gameId}`;
        
        exec(`start "" "${spectatorUrl}"`, (error) => {
          if (error) {
            console.error('Error launching spectator client on Windows:', error);
          } else {
            console.log('Launched spectator URL on Windows');
          }
        });
      } else {
        // Linux approach with the URL protocol
        const spectatorUrl = encryptionKey 
          ? `riot:spectator:${platformId}:${gameId}:${encryptionKey}`
          : `riot:spectator:${platformId}:${gameId}`;
        
        exec(`xdg-open "${spectatorUrl}"`, (error) => {
          if (error) {
            console.error('Error launching spectator client on Linux:', error);
          } else {
            console.log('Launched spectator URL on Linux');
          }
        });
      }
      
      // Return true regardless of client launch - we'll continue with streaming anyway
      return true;
    } catch (error) {
      console.error('Error launching spectator:', error);
      // Don't throw the error - just log it and continue with streaming
      return false;
    }
  }
  
  async launchSpectatorUrl(spectatorUrl) {
    return new Promise((resolve, reject) => {
      console.log(`Launching spectator URL: ${spectatorUrl}`);
      
      if (process.platform === 'win32') {
        exec(`start "" "${spectatorUrl}"`, (error) => {
          if (error) {
            console.error('Error launching spectator client:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } else if (process.platform === 'darwin') { // macOS
        // On macOS, first try the standard open command
        exec(`open "${spectatorUrl}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Standard open command failed:', error);
            console.log('Trying alternative approach with osascript...');
            
            // If that fails, try using AppleScript
            const appleScript = `
              tell application "League of Legends"
                activate
              end tell
              delay 1
              open location "${spectatorUrl}"
            `;
            
            exec(`osascript -e '${appleScript}'`, (scriptError, scriptStdout, scriptStderr) => {
              if (scriptError) {
                console.error('AppleScript approach failed:', scriptError);
                resolve(false);
              } else {
                console.log('AppleScript approach succeeded');
                resolve(true);
              }
            });
          } else {
            console.log('Standard open command succeeded');
            resolve(true);
          }
        });
      } else { // Linux
        exec(`xdg-open "${spectatorUrl}"`, (error) => {
          if (error) {
            console.error('Error launching spectator client:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      }
    });
  }

  async waitForSpectatorLaunch(maxWaitTimeMs = 15000) {
    console.log(`Waiting up to ${maxWaitTimeMs/1000} seconds for spectator client to launch...`);
    
    // Wait progressively with status checks
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Log progress
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      console.log(`Waiting for spectator client: ${elapsedSeconds}s elapsed`);
    }
    
    console.log('Spectator client launch wait completed');
    return true;
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