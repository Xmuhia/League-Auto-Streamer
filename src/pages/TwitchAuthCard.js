
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import LiveTvIcon from '@mui/icons-material/LiveTv';

function TwitchAuthCard() {
  const [twitchStatus, setTwitchStatus] = useState({
    connected: false,
    channelName: null
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Get initial Twitch status
  useEffect(() => {
    const getTwitchStatus = async () => {
      try {
        // Add this to your preload.js first
        const status = await window.api.getTwitchAuthStatus();
        setTwitchStatus(status);
      } catch (error) {
        console.error('Error getting Twitch status:', error);
      }
    };
    
    getTwitchStatus();
    
    // Listen for Twitch status updates (add this event listener in preload.js)
    const handleTwitchStatusChange = (event) => {
      if (event && event.detail) {
        console.log('Twitch status changed:', event.detail);
        setTwitchStatus(event.detail);
        setIsAuthenticating(false);
        setAuthDialogOpen(false);
      }
    };
    
    window.addEventListener('twitch-status-changed', handleTwitchStatusChange);
    
    return () => {
      window.removeEventListener('twitch-status-changed', handleTwitchStatusChange);
    };
  }, []);

  const handleStartAuth = async () => {
    setIsAuthenticating(true);
    setAuthDialogOpen(true);
    
    try {
      // Add this to your preload.js
      await window.api.startTwitchAuth();
    } catch (error) {
      console.error('Error authenticating with Twitch:', error);
      setIsAuthenticating(false);
      setAuthDialogOpen(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Add this to your preload.js
      await window.api.disconnectTwitch();
    } catch (error) {
      console.error('Error disconnecting from Twitch:', error);
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <LiveTvIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" component="div">
            Twitch Account
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center', my: 2 }}>
          {twitchStatus.connected ? (
            <>
              <Chip 
                label="CONNECTED" 
                color="success" 
                sx={{ mb: 1 }} 
              />
              <Typography variant="body1" component="div">
                {twitchStatus.channelName || 'Unknown Channel'}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not authenticated with Twitch
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color={twitchStatus.connected ? "error" : "primary"}
            onClick={twitchStatus.connected ? handleDisconnect : handleStartAuth}
            disabled={isAuthenticating}
            sx={{ minWidth: 180 }}
          >
            {isAuthenticating ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              twitchStatus.connected ? "Disconnect" : "Connect to Twitch"
            )}
          </Button>
        </Box>
      </CardContent>
      
      {/* Auth dialog */}
      <Dialog
        open={authDialogOpen}
        onClose={() => !isAuthenticating && setAuthDialogOpen(false)}
      >
        <DialogTitle>Authenticating with Twitch</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please complete the authentication in the browser window that opened.
            This dialog will close automatically when authentication is complete.
          </DialogContentText>
          {isAuthenticating && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setAuthDialogOpen(false)} 
            disabled={isAuthenticating}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default TwitchAuthCard;