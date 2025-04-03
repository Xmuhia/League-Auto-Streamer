import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  IconButton,
  InputAdornment
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ReplayIcon from '@mui/icons-material/Replay';

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function SettingsPage({ settings, setSettings }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [localSettings, setLocalSettings] = useState(settings);
  const [showObsPassword, setShowObsPassword] = useState(false);
  const [showTwitchSecrets, setShowTwitchSecrets] = useState(false);
  const [testingObs, setTestingObs] = useState(false);
  const [testingTwitch, setTestingTwitch] = useState(false);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Handle input change in settings form
  const handleInputChange = (section, field, value) => {
    setLocalSettings({
      ...localSettings,
      [section]: {
        ...localSettings[section],
        [field]: value
      }
    });
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Call the main process to save settings
      await window.api.saveSettings(localSettings);
      
      // Update parent state
      setSettings(localSettings);
      
      setSuccess('Settings saved successfully');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError('Failed to save settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Test OBS connection
  const handleTestObsConnection = async () => {
    try {
      setTestingObs(true);
      setError('');
      setSuccess('');
      
      // Call the main process to test OBS connection
      const result = await window.api.connectObs({
        address: localSettings.obs.address,
        password: localSettings.obs.password
      });
      
      if (result) {
        setSuccess('Successfully connected to OBS');
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError('Failed to connect to OBS: ' + error.message);
    } finally {
      setTestingObs(false);
    }
  };

  // Test Twitch integration
  const handleTestTwitchConnection = async () => {
    try {
      setTestingTwitch(true);
      setError('');
      setSuccess('');
      
      // Call the main process to test Twitch connection
      const result = await window.api.connectTwitch({
        clientId: localSettings.twitch.clientId,
        clientSecret: localSettings.twitch.clientSecret,
        channelName: localSettings.twitch.channelName
      });
      
      if (result) {
        setSuccess('Successfully connected to Twitch');
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError('Failed to connect to Twitch: ' + error.message);
    } finally {
      setTestingTwitch(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Settings
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSaveSettings}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {/* Error and success alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Settings tabs */}
      <Paper sx={{ width: '100%', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="settings tabs">
          <Tab label="Streaming" />
          <Tab label="OBS Integration" />
          <Tab label="Twitch Integration" />
          <Tab label="League API" />
        </Tabs>

        {/* Streaming Settings */}
        <TabPanel value={currentTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Streaming Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure how games are streamed when detected.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.streaming.autoStart}
                    onChange={(e) => handleInputChange('streaming', 'autoStart', e.target.checked)}
                    color="primary"
                  />
                }
                label="Automatically start streaming when a game is detected"
              />
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Stream Title Template"
                value={localSettings.streaming.titleTemplate}
                onChange={(e) => handleInputChange('streaming', 'titleTemplate', e.target.value)}
                helperText="Use {summonerName} as a placeholder for the player's name"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                select
                label="Stream Quality"
                value={localSettings.streaming.quality}
                onChange={(e) => handleInputChange('streaming', 'quality', e.target.value)}
              >
                <MenuItem value="low">Low (720p 30fps)</MenuItem>
                <MenuItem value="medium">Medium (1080p 30fps)</MenuItem>
                <MenuItem value="high">High (1080p 60fps)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </TabPanel>

        {/* OBS Settings */}
        <TabPanel value={currentTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                OBS WebSocket Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Connect to OBS Studio through WebSocket to control streaming automatically.
                Make sure you have enabled WebSocket in OBS (Tools &gt; WebSocket Server Settings).
              </Typography>
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="WebSocket Address"
                value={localSettings.obs.address}
                onChange={(e) => handleInputChange('obs', 'address', e.target.value)}
                placeholder="localhost:4455"
                helperText="Format: hostname:port"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type={showObsPassword ? 'text' : 'password'}
                label="WebSocket Password"
                value={localSettings.obs.password}
                onChange={(e) => handleInputChange('obs', 'password', e.target.value)}
                placeholder="Leave empty if no password is set"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowObsPassword(!showObsPassword)}
                        edge="end"
                      >
                        {showObsPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleTestObsConnection}
                disabled={testingObs}
                startIcon={testingObs ? <CircularProgress size={20} /> : <ReplayIcon />}
              >
                {testingObs ? 'Testing Connection...' : 'Test Connection'}
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Twitch Settings */}
        <TabPanel value={currentTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Twitch Integration
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Connect to Twitch to update stream information automatically.
                You'll need to create a Twitch application at <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer">Twitch Developer Console</a>.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Twitch Channel Name"
                value={localSettings.twitch.channelName}
                onChange={(e) => handleInputChange('twitch', 'channelName', e.target.value)}
                placeholder="Your Twitch username"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Client ID"
                value={localSettings.twitch.clientId}
                onChange={(e) => handleInputChange('twitch', 'clientId', e.target.value)}
                placeholder="Your Twitch application Client ID"
                type={showTwitchSecrets ? 'text' : 'password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowTwitchSecrets(!showTwitchSecrets)}
                        edge="end"
                      >
                        {showTwitchSecrets ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Client Secret"
                value={localSettings.twitch.clientSecret}
                onChange={(e) => handleInputChange('twitch', 'clientSecret', e.target.value)}
                placeholder="Your Twitch application Client Secret"
                type={showTwitchSecrets ? 'text' : 'password'}
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleTestTwitchConnection}
                disabled={testingTwitch}
                startIcon={testingTwitch ? <CircularProgress size={20} /> : <ReplayIcon />}
              >
                {testingTwitch ? 'Testing Connection...' : 'Test Connection'}
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* League API Settings */}
        <TabPanel value={currentTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Riot Games API
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure your Riot Games API key to enable monitoring League of Legends accounts.
                You can get an API key from the <a href="https://developer.riotgames.com" target="_blank" rel="noopener noreferrer">Riot Developer Portal</a>.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Riot API Key"
                value={localSettings.league?.apiKey || ''}
                onChange={(e) => handleInputChange('league', 'apiKey', e.target.value)}
                placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                type={showTwitchSecrets ? 'text' : 'password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowTwitchSecrets(!showTwitchSecrets)}
                        edge="end"
                      >
                        {showTwitchSecrets ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                For development, you can use a Development API Key which expires in 24 hours.
                For production use, you should request a Production API Key.
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
}

export default SettingsPage;