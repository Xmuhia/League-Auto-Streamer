const axios = require('axios');
const { BrowserWindow } = require('electron');
const ElectronStore = require('electron-store').default;
const store = new ElectronStore();

class TwitchService {
  constructor() {
    this.clientId = '';
    this.clientSecret = '';
    this.channelName = '';
    this.redirectUri = 'http://localhost:3000/auth/callback'; // Local callback
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiration = 0;
    this.broadcasterId = null;
    
    // Load tokens from storage if available
    this.loadTokensFromStorage();
  }
  
  /**
   * Connect to Twitch API and initialize with credentials
   * @param {string} clientId - Twitch application Client ID
   * @param {string} clientSecret - Twitch application Client Secret
   * @param {string} channelName - Twitch channel name
   * @returns {Promise<boolean>} Connection success
   */
  async connect(clientId, clientSecret, channelName) {
    try {
      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.channelName = channelName;
      
      // Check if we have valid tokens
      if (this.accessToken && this.refreshToken && Date.now() < this.tokenExpiration) {
        try {
          // Validate token
          await this.validateToken();
          
          // Get broadcaster ID if needed
          if (this.channelName && !this.broadcasterId) {
            await this.getBroadcasterId();
          }
          
          console.log('Connected to Twitch API using stored token');
          return true;
        } catch (error) {
          console.log('Stored token invalid, trying to refresh...');
          
          // Try to refresh the token
          if (this.refreshToken) {
            try {
              await this.refreshAccessToken();
              
              if (this.channelName) {
                await this.getBroadcasterId();
              }
              
              console.log('Connected to Twitch API using refreshed token');
              return true;
            } catch (refreshError) {
              console.log('Token refresh failed:', refreshError.message);
              // Clear invalid tokens
              this.clearTokens();
            }
          }
        }
      }
      
      // At this point, we need user authorization
      console.log('No valid tokens available, user authorization required');
      return false;
    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      throw new Error(`Failed to connect to Twitch: ${error.message}`);
    }
  }
  
  /**
   * Get authorization URL for user OAuth flow
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl() {
    const scopes = 'channel:manage:broadcast user:read:email';
    return `https://id.twitch.tv/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
  }
  
  /**
   * Start OAuth flow in a new window
   * @returns {Promise<boolean>} Success
   */
  async startAuthFlow() {
    return new Promise((resolve, reject) => {
      try {
        const authUrl = this.getAuthorizationUrl();
        
        // Create auth window
        const authWindow = new BrowserWindow({
          width: 800,
          height: 600,
          show: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });
        
        // Listen for the redirect
        authWindow.webContents.on('will-redirect', async (event, url) => {
          const urlObj = new URL(url);
          
          // Check if this is our redirect URI
          if (url.startsWith(this.redirectUri)) {
            const code = urlObj.searchParams.get('code');
            const error = urlObj.searchParams.get('error');
            
            if (code) {
              authWindow.close();
              
              try {
                await this.handleAuthCode(code);
                resolve(true);
              } catch (err) {
                reject(err);
              }
            } else if (error) {
              authWindow.close();
              reject(new Error(`Authentication error: ${error}`));
            }
          }
        });
        
        // Handle auth window closed
        authWindow.on('closed', () => {
          reject(new Error('Authentication window was closed before completing authorization'));
        });
        
        // Load the auth URL
        authWindow.loadURL(authUrl);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth redirect
   * @returns {Promise<boolean>} Success
   */
  async handleAuthCode(code) {
    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri
        }
      });
      
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiration = Date.now() + (response.data.expires_in * 1000) - 300000; // 5 min buffer
      
      // Save tokens to storage
      this.saveTokensToStorage();
      
      // Get broadcaster ID
      if (this.channelName) {
        await this.getBroadcasterId();
      }
      
      console.log('Successfully authorized with Twitch');
      return true;
    } catch (error) {
      console.error('Error handling authorization code:', error);
      throw new Error(`Failed to authorize with Twitch: ${error.message}`);
    }
  }
  
  /**
   * Refresh access token using refresh token
   * @returns {Promise<string>} New access token
   */
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token'
        }
      });
      
      this.accessToken = response.data.access_token;
      
      // Some implementations return a new refresh token, some don't
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }
      
      this.tokenExpiration = Date.now() + (response.data.expires_in * 1000) - 300000;
      
      // Save updated tokens
      this.saveTokensToStorage();
      
      console.log('Successfully refreshed Twitch access token');
      return this.accessToken;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }
  
  /**
   * Validate the current access token
   * @returns {Promise<boolean>} Is token valid
   */
  async validateToken() {
    try {
      const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      // Check if the token has the required scopes
      const scopes = response.data.scopes || [];
      if (!scopes.includes('channel:manage:broadcast')) {
        throw new Error('Token missing required scopes');
      }
      
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw error;
    }
  }
  
  /**
   * Get the broadcaster ID for the channel
   * @returns {Promise<string>} Broadcaster ID
   */
  async getBroadcasterId() {
    try {
      if (!this.channelName) {
        throw new Error('Channel name is required');
      }
      
      if (!this.accessToken) {
        throw new Error('Access token required');
      }
      
      const response = await axios.get(
        `https://api.twitch.tv/helix/users?login=${this.channelName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Client-Id': this.clientId
          }
        }
      );
      
      if (response.data.data.length === 0) {
        throw new Error(`Channel "${this.channelName}" not found`);
      }
      
      this.broadcasterId = response.data.data[0].id;
      return this.broadcasterId;
    } catch (error) {
      console.error('Error getting broadcaster ID:', error);
      throw new Error(`Failed to get broadcaster ID: ${error.message}`);
    }
  }
  
  /**
   * Update stream information
   * @param {string} title - Stream title
   * @param {string} gameName - Game name
   * @returns {Promise<boolean>} Success status
   */
  async updateStreamInfo(title, gameName) {
    try {
      // Ensure we have a valid token
      if (!this.accessToken) {
        throw new Error('Not authenticated with Twitch');
      }
      
      // Make sure we have broadcaster ID
      if (!this.broadcasterId) {
        await this.getBroadcasterId();
      }
      
      // Get game ID
      let gameId = await this.getGameId(gameName);
      
      // Update channel info
      await axios.patch(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${this.broadcasterId}`,
        {
          title: title,
          game_id: gameId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Client-Id': this.clientId,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`Updated Twitch stream info: "${title}" / "${gameName}"`);
      return true;
    } catch (error) {
      console.error('Error updating stream info:', error);
      throw new Error(`Failed to update stream info: ${error.message}`);
    }
  }
  
  /**
   * Get game ID by name
   * @param {string} gameName - Game name
   * @returns {Promise<string>} Game ID
   */
  async getGameId(gameName) {
    try {
      const response = await axios.get(
        `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Client-Id': this.clientId
          }
        }
      );
      
      // Return game ID if found, or default to League of Legends ID
      if (response.data.data.length > 0) {
        return response.data.data[0].id;
      }
      
      // Default to League of Legends (ID: 21779)
      console.warn(`Game "${gameName}" not found on Twitch, using default League of Legends ID`);
      return '21779';
    } catch (error) {
      console.error('Error getting game ID:', error);
      // Default to League of Legends as fallback
      return '21779';
    }
  }
  
  /**
   * Save tokens to storage
   */
  saveTokensToStorage() {
    try {
      store.set('twitch.tokens', {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiration: this.tokenExpiration,
        broadcasterId: this.broadcasterId
      });
    } catch (error) {
      console.error('Error saving tokens to storage:', error);
    }
  }
  
  /**
   * Load tokens from storage
   */
  loadTokensFromStorage() {
    try {
      const tokens = store.get('twitch.tokens');
      if (tokens) {
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.tokenExpiration = tokens.tokenExpiration;
        this.broadcasterId = tokens.broadcasterId;
      }
    } catch (error) {
      console.error('Error loading tokens from storage:', error);
    }
  }
  
  /**
   * Clear stored tokens
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiration = 0;
    this.broadcasterId = null;
    
    try {
      store.delete('twitch.tokens');
    } catch (error) {
      console.error('Error clearing tokens from storage:', error);
    }
  }
  
  /**
   * Get Twitch connection status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      connected: Boolean(this.accessToken && this.tokenExpiration > Date.now()),
      channelName: this.channelName,
      hasValidToken: Boolean(this.accessToken && this.tokenExpiration > Date.now()),
      needsAuthorization: !this.accessToken || this.tokenExpiration <= Date.now()
    };
  }
}

module.exports = TwitchService;