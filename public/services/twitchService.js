const axios = require('axios');

class TwitchService {
  constructor() {
    this.clientId = '';
    this.clientSecret = '';
    this.channelName = '';
    this.accessToken = null;
    this.tokenExpiration = 0;
    this.broadcasterId = null;
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
      
      // Get access token
      await this.getAccessToken();
      
      // Get broadcaster ID if we have a channel name
      if (this.channelName) {
        await this.getBroadcasterId();
      }
      
      console.log('Connected to Twitch API');
      return true;
    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      throw new Error(`Failed to connect to Twitch: ${error.message}`);
    }
  }
  
  /**
   * Get a new OAuth access token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && Date.now() < this.tokenExpiration) {
        return this.accessToken;
      }
      
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Client ID and Client Secret are required');
      }
      
      // Get new token
      const response = await axios.post(
        'https://id.twitch.tv/oauth2/token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        })
      );
      
      // Store token and expiration (subtract 5 minutes for safety)
      this.accessToken = response.data.access_token;
      this.tokenExpiration = Date.now() + (response.data.expires_in * 1000) - 300000;
      
      console.log('New Twitch access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('Error getting Twitch access token:', error);
      throw new Error('Failed to authenticate with Twitch API');
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
      
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.twitch.tv/helix/users?login=${this.channelName}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
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
      // Make sure we have required info
      if (!this.broadcasterId) {
        await this.getBroadcasterId();
      }
      
      const token = await this.getAccessToken();
      
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
            'Authorization': `Bearer ${token}`,
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
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
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
   * Check if the channel is currently live
   * @returns {Promise<boolean>} Live status
   */
  async isChannelLive() {
    try {
      if (!this.broadcasterId) {
        await this.getBroadcasterId();
      }
      
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.twitch.tv/helix/streams?user_id=${this.broadcasterId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': this.clientId
          }
        }
      );
      
      return response.data.data.length > 0;
    } catch (error) {
      console.error('Error checking if channel is live:', error);
      return false;
    }
  }
  
  /**
   * Get stream information
   * @returns {Promise<Object|null>} Stream data or null if offline
   */
  async getStreamInfo() {
    try {
      if (!this.broadcasterId) {
        await this.getBroadcasterId();
      }
      
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `https://api.twitch.tv/helix/streams?user_id=${this.broadcasterId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': this.clientId
          }
        }
      );
      
      if (response.data.data.length > 0) {
        return response.data.data[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error getting stream info:', error);
      return null;
    }
  }
}

module.exports = TwitchService;