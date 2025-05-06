const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class LeagueService {
  constructor() {
    this.apiKey = '';
    this.pollingIntervalMs = 60000; // default: 60 seconds
    this.monitoringInterval = null;
    this.isMonitoring = false;
    this.activeAccounts = [];
    this.onGameDetected = null;
    this.onGameEnded = null;
    this.offlineRetryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 30000; // 30 seconds initial delay
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  setPollingInterval(ms) {
    this.pollingIntervalMs = ms;
    if (this.isMonitoring) {
      this.restartMonitoring();
    }
  }

  setGameDetectedCallback(callback) {
    this.onGameDetected = callback;
  }

  setGameEndedCallback(callback) {
    this.onGameEnded = callback;
  }

  getRoutingValueForRegion(region) {
    // Map regions to their routing values (americas, asia, europe)
    const regionMappings = {
      'NA1': 'americas',
      'BR1': 'americas',
      'LA1': 'americas',
      'LA2': 'americas',
      'OC1': 'americas',
      'KR': 'asia',
      'JP1': 'asia',
      'EUW1': 'europe',
      'EUN1': 'europe',
      'TR1': 'europe',
      'RU': 'europe'
    };
    
    return regionMappings[region] || 'americas'; // Default to americas if region not found
  }

  async isOnline() {
    try {
      // Use a known valid Riot endpoint for connectivity check
      await axios.head('https://developer.riotgames.com', { timeout: 5000 });
      // Reset retry count upon successful connection
      this.offlineRetryCount = 0;
      return true;
    } catch (error) {
      console.log('Network connectivity check failed:', error.message);
      return false;
    }
  }

  async getSummonerByName(summonerName, region) {
    try {
      if (!this.apiKey) throw new Error('Riot API key not set');
      
      // Check if online
      const online = await this.isOnline();
      if (!online) {
        throw new Error('OFFLINE');
      }
      
      // Parse the Riot ID format (gameName#tagLine)
      let gameName, tagLine;
      if (summonerName.includes('#')) {
        [gameName, tagLine] = summonerName.split('#');
      } else {
        gameName = summonerName;
        tagLine = region; // Default to region as tagLine if not provided
      }
      
      console.log(`Looking up Riot ID: ${gameName}#${tagLine}`);
      
      // Map region to routing value
      const routingValue = this.getRoutingValueForRegion(region);
      
      try {
        // First, get account information using Riot ID
        const url = `https://${routingValue}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
        console.log(`Account request URL: ${url}`);
        
        const response = await axios.get(url, {
          headers: { 'X-Riot-Token': this.apiKey },
        });
        
        const accountData = response.data;
        console.log(`Account data received for ${gameName}#${tagLine}:`, accountData);
        
        // Direct mapping approach - try the provided region first
        const regionShardMap = {
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
        
        // If we have a direct mapping, try that first
        if (regionShardMap[region]) {
          try {
            const summonerUrl = `https://${regionShardMap[region]}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}`;
            console.log(`Trying direct region mapping: ${summonerUrl}`);
            
            const summonerResponse = await axios.get(summonerUrl, {
              headers: { 'X-Riot-Token': this.apiKey },
            });
            
            // If this succeeds, we've found the right shard
            return {
              ...summonerResponse.data,
              gameName: accountData.gameName,
              tagLine: accountData.tagLine
            };
          } catch (directError) {
            // If direct mapping fails, continue to the active shard API
            console.log(`Direct shard mapping failed, trying active shard API: ${directError.message}`);
          }
        }
        
        // Try to get the active shard via the API
        try {
          const shardUrl = `https://${routingValue}.api.riotgames.com/riot/account/v1/active-shards/by-game/lol/by-puuid/${accountData.puuid}`;
          console.log(`Active shard request URL: ${shardUrl}`);
          
          const shardResponse = await axios.get(shardUrl, {
            headers: { 'X-Riot-Token': this.apiKey },
          });
          
          console.log(`Active shard response: ${JSON.stringify(shardResponse.data)}`);
          
          // Now get the actual summoner data using puuid
          const summonerUrl = `https://${shardResponse.data.activeShard}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}`;
          const summonerResponse = await axios.get(summonerUrl, {
            headers: { 'X-Riot-Token': this.apiKey },
          });
          
          // Return the summoner data with additional account info
          return {
            ...summonerResponse.data,
            gameName: accountData.gameName,
            tagLine: accountData.tagLine
          };
        } catch (shardError) {
          console.error(`Active shard lookup failed: ${shardError.message}`);
          if (shardError.response?.data) {
            console.error(`API Error details: ${JSON.stringify(shardError.response.data)}`);
          }
          
          // Try all regions as a fallback
          const regions = ['NA1', 'EUW1', 'EUN1', 'KR', 'BR1', 'JP1', 'LA1', 'LA2', 'OC1', 'TR1', 'RU'];
          
          for (const testRegion of regions) {
            try {
              console.log(`Trying region ${testRegion} as fallback`);
              const summonerUrl = `https://${testRegion}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}`;
              const summonerResponse = await axios.get(summonerUrl, {
                headers: { 'X-Riot-Token': this.apiKey },
              });
              
              console.log(`Found account in region ${testRegion}`);
              
              // Return the summoner data with additional account info
              return {
                ...summonerResponse.data,
                gameName: accountData.gameName,
                tagLine: accountData.tagLine
              };
            } catch (fallbackError) {
              // Continue to next region
            }
          }
          
          // If we get here, all fallbacks failed
          throw new Error(`Could not find active shard for account ${accountData.gameName}#${accountData.tagLine}. This account may exist but has never played League of Legends.`);
        }
      } catch (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`API Error (${error.response.status}):`, 
                        error.response.data?.status?.message || error.response.statusText);
          
          if (error.response.status === 400) {
            throw new Error(`Invalid Riot ID format or the account doesn't exist. Check the gameName and tagLine.`);
          } else if (error.response.status === 401 || error.response.status === 403) {
            throw new Error(`API key invalid or expired. Please update your Riot API key.`);
          } else if (error.response.status === 404) {
            throw new Error(`Account not found: ${gameName}#${tagLine}`);
          } else if (error.response.status === 429) {
            throw new Error(`Rate limit exceeded. Please try again later.`);
          } else {
            throw new Error(`API error (${error.response.status}): ${error.response.statusText}`);
          }
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Network Error:', error.message);
          throw new Error('OFFLINE');
        } else {
          // Something happened in setting up the request
          console.error('Request Error:', error.message);
          throw error;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch summoner "${summonerName}" in ${region}:`, error.message);
      throw error;
    }
  }

  async checkActiveGame(summonerName, region) {
    try {
      if (!this.apiKey) throw new Error('Riot API key not set');

      // Check if online
      const online = await this.isOnline();
      if (!online) {
        throw new Error('OFFLINE');
      }

      const summonerData = await this.getSummonerByName(summonerName, region);
      if (!summonerData?.id) {
        throw new Error(`Summoner ${summonerName} not found`);
      }

      try {
        // Use the specific region for the spectator endpoint
        const url = `https://${region}.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/${summonerData.id}`;
        const response = await axios.get(url, {
          headers: { 'X-Riot-Token': this.apiKey },
        });

        return response.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          return null; // Not in game
        }
        
        if (error.response) {
          if (error.response.status === 401 || error.response.status === 403) {
            throw new Error(`API key invalid or expired. Please update your Riot API key.`);
          } else if (error.response.status === 429) {
            throw new Error(`Rate limit exceeded. Please try again later.`);
          } else {
            throw new Error(`API error (${error.response.status}): ${error.response.statusText}`);
          }
        } else if (error.request) {
          throw new Error('OFFLINE');
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error checking active game for ${summonerName}:`, error.message);
      throw error;
    }
  }

  async addAccount(summonerName, region) {
    try {
      // Check if online
      const online = await this.isOnline();
      if (!online) {
        throw new Error('OFFLINE');
      }
      
      const summonerData = await this.getSummonerByName(summonerName, region);
      const accountExists = this.activeAccounts.some(
        (acc) => acc.puuid === summonerData.puuid
      );
      if (accountExists) {
        console.warn(`Account ${summonerName} already being tracked`);
        return null;
      }

      const account = {
        id: uuidv4(),
        summonerName: summonerData.name,
        summonerId: summonerData.id,
        puuid: summonerData.puuid,
        region,
        gameName: summonerData.gameName || summonerData.name,
        tagLine: summonerData.tagLine || region,
        isActive: true,
        inGame: false,
        gameId: null,
        dateAdded: new Date().toISOString(),
      };

      this.activeAccounts.push(account);
      return account;
    } catch (error) {
      console.error(`Error adding account ${summonerName}:`, error.message);
      throw error;
    }
  }

  startMonitoring(accounts = [], onGameDetected, onGameEnded) {
    if (!this.apiKey) throw new Error('Riot API key not set');
    if (this.isMonitoring) return true;

    if (!accounts || accounts.length === 0) {
      throw new Error('No active accounts to monitor');
    }

    this.activeAccounts = [
      ...new Map(accounts.filter(a => a.isActive).map(a => [a.puuid, a])).values(),
    ];

    if (this.activeAccounts.length === 0) {
      throw new Error('No active accounts to monitor');
    }

    this.onGameDetected = onGameDetected || this.onGameDetected;
    this.onGameEnded = onGameEnded || this.onGameEnded;
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => this.checkAllAccounts(), this.pollingIntervalMs);
    this.checkAllAccounts();

    console.log(`Started monitoring ${this.activeAccounts.length} accounts`);
    return true;
  }

  async checkAllAccounts() {
    if (!this.isMonitoring) return;

    console.log(`[${new Date().toISOString()}] Checking ${this.activeAccounts.length} accounts...`);

    // Check connectivity first
    const online = await this.isOnline();
    if (!online) {
      this.offlineRetryCount++;
      console.log(`Offline detected (retry ${this.offlineRetryCount}/${this.maxRetries}). Will retry in ${this.retryDelay/1000} seconds.`);
      
      // Implement exponential backoff
      if (this.offlineRetryCount <= this.maxRetries) {
        setTimeout(() => this.checkAllAccounts(), this.retryDelay);
        // Increase retry delay for next attempt (exponential backoff)
        this.retryDelay = Math.min(this.retryDelay * 2, 300000); // Max 5 minutes
      } else {
        console.log('Max offline retries reached. Pausing monitoring until connectivity resumes.');
        // We'll continue regular polling but won't increment retry count further
        this.offlineRetryCount = this.maxRetries;
      }
      return;
    }
    
    // Reset retry delay if we're online
    this.retryDelay = 30000;

    for (const account of this.activeAccounts) {
      try {
        const gameData = await this.checkActiveGame(account.summonerName, account.region);

        if (gameData && !account.inGame) {
          account.inGame = true;
          account.gameId = gameData.gameId;
          console.log(`${account.summonerName} entered a game`);

          this.onGameDetected?.(account, gameData);

        } else if (!gameData && account.inGame) {
          const endedGameId = account.gameId;
          account.inGame = false;
          account.gameId = null;
          console.log(`${account.summonerName} exited a game`);

          this.onGameEnded?.(account, endedGameId);
        }
      } catch (error) {
        if (error.message === 'OFFLINE') {
          console.log(`Cannot check ${account.summonerName} - network is offline`);
        } else {
          console.error(`Failed to monitor ${account.summonerName}:`, error.message);
        }
      }
    }
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Stopped monitoring');
    return true;
  }

  restartMonitoring() {
    this.stopMonitoring();
    this.startMonitoring(this.activeAccounts, this.onGameDetected, this.onGameEnded);
  }

  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      accountCount: this.activeAccounts.length,
      activeAccounts: this.activeAccounts.filter(a => a.isActive).length,
      isOnline: this.offlineRetryCount < this.maxRetries
    };
  }
}

module.exports = new LeagueService();
