const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class LeagueService {
  constructor() {
    this.apiKey = '';
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.activeAccounts = [];
    this.onGameDetected = null;
    this.onGameEnded = null;
  }
  
  /**
   * Set the Riot API key
   * @param {string} apiKey - Riot API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }
  
  /**
   * Set callback for when a game is detected
   * @param {function} callback - Function to call when game is detected
   */
  setGameDetectedCallback(callback) {
    this.onGameDetected = callback;
  }
  
  /**
   * Set callback for when a game ends
   * @param {function} callback - Function to call when game ends
   */
  setGameEndedCallback(callback) {
    this.onGameEnded = callback;
  }
  
  /**
   * Check if a summoner is currently in game
   * @param {string} summonerName - Summoner name
   * @param {string} region - Region code (e.g., NA1, EUW1)
   * @returns {Promise<Object|null>} Game data or null if not in game
   */
  async checkActiveGame(summonerName, region) {
    try {
      if (!this.apiKey) {
        throw new Error('Riot API key not set');
      }
      
      // First get summoner ID
      const summonerData = await this.getSummonerByName(summonerName, region);
      
      if (!summonerData) {
        throw new Error(`Summoner ${summonerName} not found in region ${region}`);
      }
      
      // Then check if in active game
      try {
        const response = await axios.get(
          `https://${region}.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/${summonerData.id}`,
          {
            headers: {
              'X-Riot-Token': this.apiKey
            }
          }
        );
        
        return response.data;
      } catch (error) {
        // 404 means not in game, which is normal
        if (error.response && error.response.status === 404) {
          return null;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error checking active game:', error.message);
      throw error;
    }
  }
  
  /**
   * Get summoner data by name
   * @param {string} summonerName - Summoner name
   * @param {string} region - Region code
   * @returns {Promise<Object>} Summoner data
   */
  async getSummonerByName(summonerName, region) {
    try {
      if (!this.apiKey) {
        throw new Error('Riot API key not set');
      }
      
      const response = await axios.get(
        `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`,
        {
          headers: {
            'X-Riot-Token': this.apiKey
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching summoner data:', error.message);
      throw error;
    }
  }
  
  /**
   * Add a new account to track
   * @param {string} summonerName - Summoner name
   * @param {string} region - Region code
   * @returns {Promise<Object>} The created account
   */
  async addAccount(summonerName, region) {
    try {
      // Verify account exists with Riot API
      const summonerData = await this.getSummonerByName(summonerName, region);
      
      // Create account object
      const account = {
        id: uuidv4(),
        summonerName: summonerData.name,
        summonerId: summonerData.id,
        puuid: summonerData.puuid,
        region,
        isActive: true,
        inGame: false,
        gameId: null,
        dateAdded: new Date().toISOString()
      };
      
      return account;
    } catch (error) {
      console.error('Error adding account:', error.message);
      throw error;
    }
  }
  
  /**
   * Start monitoring accounts for active games
   * @param {Array} accounts - List of accounts to monitor
   * @param {function} onGameDetected - Callback when game is detected
   * @param {function} onGameEnded - Callback when game ends
   * @returns {boolean} Success status
   */
  startMonitoring(accounts, onGameDetected, onGameEnded) {
    if (this.isMonitoring) {
      return true;
    }
    
    if (!this.apiKey) {
      throw new Error('Riot API key not set');
    }
    
    this.activeAccounts = accounts.filter(acc => acc.isActive);
    this.isMonitoring = true;
    
    if (onGameDetected) this.onGameDetected = onGameDetected;
    if (onGameEnded) this.onGameEnded = onGameEnded;
    
    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Start the monitoring loop
    this.monitoringInterval = setInterval(() => this.checkAllAccounts(), 60000); // Check every minute
    
    // Do an initial check right away
    this.checkAllAccounts();
    
    console.log(`Started monitoring ${this.activeAccounts.length} accounts`);
    return true;
  }
  
  /**
   * Check all tracked accounts for active games
   */
  async checkAllAccounts() {
    if (!this.isMonitoring || this.activeAccounts.length === 0) {
      return;
    }
    
    console.log(`Checking ${this.activeAccounts.length} accounts for active games...`);
    
    for (const account of this.activeAccounts) {
      try {
        const gameData = await this.checkActiveGame(account.summonerName, account.region);
        
        // Account just entered a game
        if (gameData && !account.inGame) {
          console.log(`${account.summonerName} just entered a game!`);
          account.inGame = true;
          account.gameId = gameData.gameId;
          
          if (this.onGameDetected) {
            this.onGameDetected(account, gameData);
          }
        } 
        // Account just left a game
        else if (!gameData && account.inGame) {
          console.log(`${account.summonerName} just left a game!`);
          const oldGameId = account.gameId;
          account.inGame = false;
          account.gameId = null;
          
          if (this.onGameEnded) {
            this.onGameEnded(account, oldGameId);
          }
        }
      } catch (error) {
        console.error(`Error checking account ${account.summonerName}:`, error.message);
      }
    }
  }
  
  /**
   * Stop monitoring accounts
   * @returns {boolean} Success status
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('Stopped monitoring accounts');
    return true;
  }
  
  /**
   * Get monitoring status
   * @returns {boolean} Whether monitoring is active
   */
  getMonitoringStatus() {
    return this.isMonitoring;
  }
}

module.exports = new LeagueService();