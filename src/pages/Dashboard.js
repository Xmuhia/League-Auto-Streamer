import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  CircularProgress,
  Divider,
  Chip,
  Avatar
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import ScheduleIcon from '@mui/icons-material/Schedule';

function Dashboard({ isMonitoring, toggleMonitoring, accounts }) {
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [currentlyStreaming, setCurrentlyStreaming] = useState(null);
  const [streamStatus, setStreamStatus] = useState({
    connected: false,
    streaming: false,
    uptime: '00:00:00'
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Filter active accounts
  useEffect(() => {
    // Add null check before filtering
    setActiveAccounts(accounts?.filter(account => account && account.isActive) || []);
  }, [accounts]);

  // Find currently streaming account
  useEffect(() => {
    // Add null check before finding
    const streaming = accounts?.find(account => account && account.inGame);
    setCurrentlyStreaming(streaming || null);
  }, [accounts]);

  // Get initial OBS status and listen for updates
  useEffect(() => {
    // Get initial OBS status
    const getInitialObsStatus = async () => {
      try {
        const status = await window.api.getObsStatus();
        setStreamStatus(prevStatus => ({
          ...prevStatus,
          connected: status.connected,
          streaming: status.streaming
        }));
      } catch (error) {
        console.error('Error getting OBS status:', error);
      }
    };
    
    // Listen for OBS status updates
    const unsubscribe = window.api.on('obs-status-changed', (status) => {
      console.log('OBS status changed:', status);
      setStreamStatus(prevStatus => ({
        ...prevStatus,
        connected: status.connected,
        streaming: status.streaming
      }));
    });
    
    // Listen for stream started events
    const streamStartedUnsubscribe = window.api.on('stream-started', ({ account, gameData }) => {
      console.log('Stream started for:', account.summonerName);
      setStreamStatus(prevStatus => ({
        ...prevStatus,
        streaming: true
      }));
      setElapsedSeconds(0);
    });
    
    // Listen for stream stopped events
    const streamStoppedUnsubscribe = window.api.on('stream-stopped', ({ account }) => {
      console.log('Stream stopped for:', account.summonerName);
      setStreamStatus(prevStatus => ({
        ...prevStatus,
        streaming: false
      }));
      setElapsedSeconds(0);
    });
    
    // Initialize
    getInitialObsStatus();
    
    // Clean up
    return () => {
      if (unsubscribe) unsubscribe();
      if (streamStartedUnsubscribe) streamStartedUnsubscribe();
      if (streamStoppedUnsubscribe) streamStoppedUnsubscribe();
    };
  }, []);

  // Update stream duration if streaming
  useEffect(() => {
    let interval;
    if (streamStatus.streaming) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [streamStatus.streaming]);

  // Format elapsed time
  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle monitoring toggle
  const handleMonitoringToggle = async () => {
    await toggleMonitoring();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        
        <Button
          variant="contained"
          color={isMonitoring ? "error" : "primary"}
          startIcon={isMonitoring ? <StopIcon /> : <PlayArrowIcon />}
          onClick={handleMonitoringToggle}
          sx={{ borderRadius: 2 }}
        >
          {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Monitoring status card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card 
            sx={{ 
              height: '100%', 
              background: isMonitoring ? 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)' : 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
              color: 'white'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 14 }} color="rgba(255,255,255,0.8)" gutterBottom>
                  Monitoring Status
                </Typography>
                
                <Switch 
                  checked={isMonitoring}
                  onChange={handleMonitoringToggle}
                  color="default"
                />
              </Box>
              
              <Typography variant="h5" component="div" sx={{ mt: 1 }}>
                {isMonitoring ? "Active" : "Inactive"}
              </Typography>
              
              <Typography sx={{ mb: 1.5, fontSize: 14 }} color="rgba(255,255,255,0.8)">
                {isMonitoring 
                  ? `Watching ${activeAccounts.length} account${activeAccounts.length !== 1 ? 's' : ''}`
                  : "Not monitoring any accounts"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Active accounts card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountCircleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  League Accounts
                </Typography>
              </Box>
              
              <Typography variant="h3" component="div" align="center" sx={{ my: 2 }}>
                {activeAccounts.length}
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                {activeAccounts.length === 0 
                  ? "No active accounts to monitor" 
                  : `${activeAccounts.length} active account${activeAccounts.length !== 1 ? 's' : ''} being monitored`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Current game card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VideogameAssetIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  Current Game
                </Typography>
              </Box>
              
              {currentlyStreaming ? (
                <>
                  <Box sx={{ textAlign: 'center', my: 2 }}>
                    <Chip 
                      label="LIVE" 
                      color="error" 
                      size="small" 
                      sx={{ mb: 1 }} 
                    />
                    <Typography variant="h6" component="div">
                      {currentlyStreaming.summonerName || currentlyStreaming.gameName || 'Unknown'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Game ID: {currentlyStreaming.gameId || 'Unknown'}
                  </Typography>
                </>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
                  <Typography variant="body2" color="text.secondary">
                    No active games detected
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Stream status card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LiveTvIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  Stream Status
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center', my: 2 }}>
                {streamStatus.streaming ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                      <Chip label="STREAMING" color="success" />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ScheduleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        Uptime: {formatElapsedTime(elapsedSeconds)}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {streamStatus.connected ? "Connected but not streaming" : "Not connected to OBS"}
                  </Typography>
                )}
              </Box>
              
              <Divider sx={{ my: 1 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  OBS Status:
                </Typography>
                <Chip 
                  label={streamStatus.connected ? "Connected" : "Disconnected"} 
                  color={streamStatus.connected ? "success" : "error"}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recently monitored accounts */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monitored Accounts
              </Typography>
              
              {activeAccounts.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No accounts are being monitored. Add League accounts to get started.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {activeAccounts.map((account) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={account.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                              {(account.summonerName?.charAt(0) || account.gameName?.charAt(0) || '?').toUpperCase()}
                            </Avatar>
                            <Typography variant="subtitle1" component="div">
                              {account.summonerName || account.gameName || 'Unknown User'}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Region: {account.region || 'Unknown'}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                            <Chip 
                              label={account.inGame ? "In Game" : "Not Playing"} 
                              color={account.inGame ? "success" : "default"}
                              size="small"
                            />
                            <Typography variant="caption" color="text.secondary">
                              ID: {account.summonerId ? `${account.summonerId.substring(0, 8)}...` : 'N/A'}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;