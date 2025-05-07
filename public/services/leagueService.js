const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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
    
    // New properties for enhanced game detection
    this.logApiResponses = true;
    this.logDir = path.join(__dirname, 'api_logs');
    this.verificationDelay = 5000; // 5 second delay for secondary verification
    this.gameVerificationCache = new Map(); // Cache to avoid duplicate verifications
  }

  // Create logs directory if logging is enabled
  initLogging() {
    if (this.logApiResponses && !fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`Created API logs directory: ${this.logDir}`);
      } catch (error) {
        console.error(`Failed to create logs directory: ${error.message}`);
        this.logApiResponses = false;
      }
    }
  }

  // Log API responses to file for debugging
  recordApiResponse(endpoint, response, isError = false) {
    if (!this.logApiResponses) return;
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const sanitizedEndpoint = endpoint.replace(/https:\/\/|http:\/\/|\//g, '_').replace(/[?&=]/g, '-');
      const shortEndpoint = sanitizedEndpoint.length > 50 ? sanitizedEndpoint.substring(0, 50) : sanitizedEndpoint;
      const filename = `${timestamp}_${shortEndpoint}_${isError ? 'error' : 'success'}.json`;
      
      fs.writeFileSync(
        path.join(this.logDir, filename),
        JSON.stringify(response, null, 2)
      );
    } catch (error) {
      console.error(`Failed to record API response: ${error.message}`);
    }
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.initLogging(); // Initialize logging when API key is set
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
    if (!region) return 'americas'; // Default routing value
    
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
      if (!summonerName) throw new Error('Summoner name is required');
      if (!region) throw new Error('Region is required');
      
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
        
        // Log the API response
        const accountData = response.data;
        this.recordApiResponse(url, accountData);
        console.log(`Account data received for ${gameName}#${tagLine}:`, accountData);
        
        if (!accountData || !accountData.puuid) {
          throw new Error(`Invalid account data received for ${gameName}#${tagLine}`);
        }
        
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
            
            // Log the API response
            this.recordApiResponse(summonerUrl, summonerResponse.data);
            
            // If this succeeds, we've found the right shard
            return {
              ...summonerResponse.data,
              gameName: accountData.gameName,
              tagLine: accountData.tagLine
            };
          } catch (directError) {
            // If direct mapping fails, continue to the active shard API
            console.log(`Direct shard mapping failed, trying active shard API: ${directError.message}`);
            if (directError.response) {
              this.recordApiResponse(`${region}_direct_mapping`, directError.response.data, true);
            }
          }
        }
        
        // Try to get the active shard via the API
        try {
          const shardUrl = `https://${routingValue}.api.riotgames.com/riot/account/v1/active-shards/by-game/lol/by-puuid/${accountData.puuid}`;
          console.log(`Active shard request URL: ${shardUrl}`);
          
          const shardResponse = await axios.get(shardUrl, {
            headers: { 'X-Riot-Token': this.apiKey },
          });
          
          // Log the API response
          this.recordApiResponse(shardUrl, shardResponse.data);
          console.log(`Active shard response: ${JSON.stringify(shardResponse.data)}`);
          
          if (!shardResponse.data || !shardResponse.data.activeShard) {
            throw new Error(`Invalid active shard data received for ${gameName}#${tagLine}`);
          }
          
          // Now get the actual summoner data using puuid
          const summonerUrl = `https://${shardResponse.data.activeShard}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}`;
          const summonerResponse = await axios.get(summonerUrl, {
            headers: { 'X-Riot-Token': this.apiKey },
          });
          
          // Log the API response
          this.recordApiResponse(summonerUrl, summonerResponse.data);
          
          // Return the summoner data with additional account info
          return {
            ...summonerResponse.data,
            gameName: accountData.gameName,
            tagLine: accountData.tagLine
          };
        } catch (shardError) {
          console.error(`Active shard lookup failed: ${shardError.message}`);
          if (shardError.response?.data) {
            this.recordApiResponse('active_shard_error', shardError.response.data, true);
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
              
              // Log the API response
              this.recordApiResponse(summonerUrl, summonerResponse.data);
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
          // Log the error response
          this.recordApiResponse('account_lookup_error', error.response.data, true);
          
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
      if (!summonerName) throw new Error('Summoner name is required');
      if (!region) throw new Error('Region is required');

      // Check if online
      const online = await this.isOnline();
      if (!online) {
        throw new Error('OFFLINE');
      }

      const summonerData = await this.getSummonerByName(summonerName, region);
      if (!summonerData?.id) {
        throw new Error(`Summoner ${summonerName} not found or has no ID`);
      }

      try {
        // Use the specific region for the spectator endpoint
        const url = `https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${summonerData.puuid}`;
        console.log(`Checking active game at: ${url}`);
        
        const response = await axios.get(url, {
          headers: { 'X-Riot-Token': this.apiKey },
        });

        // Log the successful spectator API response
        this.recordApiResponse(url, response.data);
        console.log(`Active game found for ${summonerName}`);

        // Simplify the return object to just include essential game status info
        return {
          inGame: true,
          gameId: response.data.gameId,
          gameType: response.data.gameType,
          gameMode: response.data.gameMode,
          mapId: response.data.mapId,
          gameLengthSeconds: response.data.gameLength,
          participants: response.data.participants.map(p => ({
            summonerName: p.summonerName,
            championId: p.championId,
            teamId: p.teamId
          }))
        };
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // Log the 404 response
          this.recordApiResponse(`${region}_spectator_404`, error.response.data, true);
          console.log(`No active game found for ${summonerName} - performing secondary verification`);
          
          // Implement secondary verification with match history check
          // Generate a cache key to avoid duplicate verifications
          const cacheKey = `${summonerData.puuid}_${Date.now()}`;
          
          // Check if we've recently verified this account
          if (this.gameVerificationCache.has(summonerData.puuid)) {
            const cachedResult = this.gameVerificationCache.get(summonerData.puuid);
            if (Date.now() - cachedResult.timestamp < 60000) { // Cache for 1 minute
              console.log(`Using cached verification result for ${summonerName}`);
              return cachedResult.result;
            }
          }
          
          // After a 404 from spectator API, wait briefly and try secondary verification
          try {
            // Delay to account for potential API synchronization issues
            await new Promise(resolve => setTimeout(resolve, this.verificationDelay));
            
            // Secondary verification: check recent matches
            // Only do this verification if we have a puuid
            if (summonerData.puuid) {
              // Try to get the most recent match
              const routingValue = this.getRoutingValueForRegion(region);
              const recentMatchUrl = `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/by-puuid/${summonerData.puuid}/ids?start=0&count=1`;
              console.log(`Checking recent matches: ${recentMatchUrl}`);
              
              try {
                const recentMatchResponse = await axios.get(recentMatchUrl, {
                  headers: { 'X-Riot-Token': this.apiKey },
                });
                
                this.recordApiResponse(recentMatchUrl, recentMatchResponse.data);
                
                if (recentMatchResponse.data && recentMatchResponse.data.length > 0) {
                  const matchId = recentMatchResponse.data[0];
                  const matchDetailsUrl = `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
                  console.log(`Checking match details: ${matchDetailsUrl}`);
                  
                  const matchDetails = await axios.get(matchDetailsUrl, {
                    headers: { 'X-Riot-Token': this.apiKey },
                  });
                  
                  this.recordApiResponse(matchDetailsUrl, matchDetails.data);
                  
                  // Check if the match is very recent (started less than 2 hours ago)
                  // and is still ongoing (does not have an end time)
                  const matchInfo = matchDetails.data.info;
                  const matchStartTime = matchInfo.gameCreation;
                  const currentTime = Date.now();
                  const matchHasEnded = matchInfo.gameEndTimestamp != null;
                  
                  // If match started within last 2 hours and has no end timestamp
                  if (currentTime - matchStartTime < 7200000 && !matchHasEnded) {
                    console.log(`Recent match found that may be in progress: ${matchId}`);
                    
                    // Game might be in progress but not showing in spectator API
                    const result = {
                      inGame: true,
                      gameId: matchId,
                      gameType: matchInfo.gameType || 'MATCHED_GAME',
                      gameMode: matchInfo.gameMode || 'CLASSIC',
                      mapId: matchInfo.mapId || 11,
                      gameLengthSeconds: Math.floor((currentTime - matchStartTime) / 1000),
                      participants: matchInfo.participants.map(p => ({
                        summonerName: p.summonerName,
                        championId: p.championId,
                        teamId: p.teamId
                      })),
                      verifiedByMatchHistory: true
                    };
                    
                    // Cache this result
                    this.gameVerificationCache.set(summonerData.puuid, {
                      timestamp: Date.now(),
                      result: result
                    });
                    
                    return result;
                  }
                }
              } catch (matchError) {
                // Log match lookup error but continue with regular not-in-game response
                console.error(`Error checking match history: ${matchError.message}`);
                if (matchError.response?.data) {
                  this.recordApiResponse('match_history_error', matchError.response.data, true);
                }
              }
            }
          } catch (verificationError) {
            console.error(`Secondary verification failed: ${verificationError.message}`);
          }
          
          // If we get here, both spectator API and secondary verification indicate not in game
          const notInGameResult = {
            inGame: false,
            lastChecked: new Date().toISOString()
          };
          
          // Cache this negative result
          this.gameVerificationCache.set(summonerData.puuid, {
            timestamp: Date.now(),
            result: notInGameResult
          });
          
          return notInGameResult;
        }
        
        if (error.response) {
          // Log other error responses
          this.recordApiResponse(`${region}_spectator_error`, error.response.data, true);
          
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
      if (!summonerName) throw new Error('Summoner name is required');
      if (!region) throw new Error('Region is required');
      
      // Check if online
      const online = await this.isOnline();
      if (!online) {
        throw new Error('OFFLINE');
      }
      
      const summonerData = await this.getSummonerByName(summonerName, region);
      if (!summonerData || !summonerData.puuid) {
        throw new Error(`Invalid summoner data received for ${summonerName}`);
      }
      
      const accountExists = this.activeAccounts.some(
        (acc) => acc && acc.puuid === summonerData.puuid
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

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('No accounts to monitor');
    }
    
    // Log incoming accounts for debugging
    console.log('Accounts received for monitoring:', 
      accounts.map(a => a ? 
        `${a.summonerName || a.gameName || 'Unknown'} (Active: ${a.isActive}, Has PUUID: ${Boolean(a.puuid)})` 
        : 'NULL ACCOUNT'
      )
    );

    // More lenient filtering - only require isActive and either summonerName or gameName
    this.activeAccounts = accounts
      .filter(a => {
        if (!a) {
          console.log('Filtering out null account');
          return false;
        }
        
        if (!a.isActive) {
          console.log(`Account ${a.summonerName || a.gameName || 'Unknown'} is not active`);
          return false;
        }
        
        const hasName = Boolean(a.summonerName || a.gameName);
        const hasRegion = Boolean(a.region);
        
        if (!hasName || !hasRegion) {
          console.log(`Account missing required fields: ${JSON.stringify({
            hasName,
            hasRegion,
            account: a.summonerName || a.gameName || 'Unknown' 
          })}`);
          return false;
        }
        
        return true;
      })
      .reduce((unique, account) => {
        // Deduplicate by id or puuid
        const exists = unique.some(a => 
          (a.id && a.id === account.id) || 
          (a.puuid && a.puuid === account.puuid)
        );
        if (!exists) {
          unique.push(account);
        } else {
          console.log(`Filtering out duplicate account: ${account.summonerName || account.gameName || 'Unknown'}`);
        }
        return unique;
      }, []);

    if (this.activeAccounts.length === 0) {
      throw new Error('No valid active accounts to monitor');
    }

    console.log(`Filtered down to ${this.activeAccounts.length} valid active accounts`);

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

    // Clear expired entries from verification cache
    for (const [puuid, cacheEntry] of this.gameVerificationCache.entries()) {
      if (Date.now() - cacheEntry.timestamp > 60000) { // Expire after 1 minute
        this.gameVerificationCache.delete(puuid);
      }
    }

    for (const account of this.activeAccounts) {
      // Enhanced account validation with detailed logging
      if (!account) {
        console.log('Skipping null account in monitoring');
        continue;
      }
      
      // Log the account to diagnose the issue
      console.log('Processing account:', JSON.stringify({
        id: account.id,
        summonerName: account.summonerName,
        gameName: account.gameName,
        tagLine: account.tagLine,
        region: account.region,
        puuid: account.puuid ? account.puuid.substring(0, 10) + '...' : null
      }));
      
      // Use either summonerName or gameName
      const accountName = account.summonerName || account.gameName;
      const accountRegion = account.region;
      
      if (!accountName || !accountRegion) {
        console.log(`Skipping account with missing name or region: ${JSON.stringify({
          hasName: Boolean(accountName),
          hasRegion: Boolean(accountRegion)
        })}`);
        continue;
      }
      
      try {
        // Use proper name for checking
        const nameToCheck = account.gameName && account.tagLine 
          ? `${account.gameName}#${account.tagLine}` 
          : accountName;
          
        console.log(`Checking game status for ${nameToCheck} in ${accountRegion}`);
        
        const gameStatus = await this.checkActiveGame(nameToCheck, accountRegion);

        if (gameStatus.inGame) {
          // Player is in game
          console.log(`${nameToCheck} is currently IN GAME:`);
          console.log(`  Game Mode: ${gameStatus.gameMode}`);
          console.log(`  Game Length: ${Math.floor(gameStatus.gameLengthSeconds / 60)} minutes`);
          if (gameStatus.participants) {
            console.log(`  Champions: ${gameStatus.participants.map(p => p.summonerName).join(', ')}`);
          }
          if (gameStatus.verifiedByMatchHistory) {
            console.log(`  Note: Game detected via match history verification`);
          }
          
          if (!account.inGame) {
            account.inGame = true;
            account.gameId = gameStatus.gameId;
            console.log(`${nameToCheck} has ENTERED a game`);
            if (typeof this.onGameDetected === 'function') {
              this.onGameDetected(account, gameStatus);
            }
          }
        } else {
          // Player is not in game
          console.log(`${nameToCheck} is NOT IN GAME (last checked: ${gameStatus.lastChecked})`);
          
          if (account.inGame) {
            console.log(`${nameToCheck} has EXITED a game`);
            const endedGameId = account.gameId;
            account.inGame = false;
            account.gameId = null;
            
            if (typeof this.onGameEnded === 'function') {
              this.onGameEnded(account, endedGameId);
            }
          }
        }
      } catch (error) {
        if (error.message === 'OFFLINE') {
          console.log(`Cannot check ${accountName} - network is offline`);
        } else {
          console.error(`Failed to monitor ${accountName}:`, error.message);
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
    return this.startMonitoring(this.activeAccounts, this.onGameDetected, this.onGameEnded);
  }

  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      accountCount: Array.isArray(this.activeAccounts) ? this.activeAccounts.length : 0,
      activeAccounts: Array.isArray(this.activeAccounts) 
        ? this.activeAccounts.filter(a => a && a.isActive).length 
        : 0,
      isOnline: this.offlineRetryCount < this.maxRetries,
      loggingEnabled: this.logApiResponses,
      secondaryVerificationEnabled: true
    };
  }
}

module.exports = new LeagueService();