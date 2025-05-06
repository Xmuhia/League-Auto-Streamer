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
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InfoIcon from '@mui/icons-material/Info';

// League of Legends regions
const regions = [
  { code: 'NA1', name: 'North America' },
  { code: 'EUW1', name: 'EU West' },
  { code: 'EUN1', name: 'EU Nordic & East' },
  { code: 'KR', name: 'Korea' },
  { code: 'BR1', name: 'Brazil' },
  { code: 'JP1', name: 'Japan' },
  { code: 'RU', name: 'Russia' },
  { code: 'OC1', name: 'Oceania' },
  { code: 'TR1', name: 'Turkey' },
  { code: 'LA1', name: 'Latin America North' },
  { code: 'LA2', name: 'Latin America South' }
];

function AccountsPage({ accounts, setAccounts }) {
  const [newAccount, setNewAccount] = useState({
    summonerName: '',
    region: 'NA1'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Handle input change for new account form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAccount({
      ...newAccount,
      [name]: value
    });
  };

  // Add a new account
  const handleAddAccount = async (e) => {
    e.preventDefault();
    
    if (!newAccount.summonerName) {
      setError('Please enter a Riot ID or Game Name');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Call the main process to add account
      const account = await window.api.addAccount(newAccount);
      
      // Update accounts state
      setAccounts([...accounts, account]);
      
      // Reset form
      setNewAccount({
        summonerName: '',
        region: 'NA1'
      });
      
      const displayName = account.gameName && account.tagLine 
        ? `${account.gameName}#${account.tagLine}` 
        : account.summonerName;
        
      setSuccess(`Account "${displayName}" added successfully`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError(error.message || 'Failed to add account');
    } finally {
      setLoading(false);
    }
  };

  // Toggle account active status
  const handleToggleActive = async (accountId) => {
    try {
      const updatedAccounts = await window.api.toggleAccount(accountId);
      setAccounts(updatedAccounts);
    } catch (error) {
      setError('Failed to update account status');
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    try {
      if (!accountToDelete) return;
      
      const updatedAccounts = await window.api.removeAccount(accountToDelete.id);
      setAccounts(updatedAccounts);
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
      
      setSuccess('Account removed successfully');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError('Failed to remove account');
      setDeleteDialogOpen(false);
    }
  };

  // Handle API key update
  const handleSaveApiKey = async () => {
    try {
      // Call the main process to save API key
      await window.api.saveSettings({
        obs: {},
        twitch: {},
        streaming: {},
        league: {
          apiKey
        }
      });
      
      setShowApiKeyDialog(false);
      setSuccess('Riot API Key updated successfully');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError('Failed to save API key');
    }
  };

  // Check if a specific account is in game
  const handleCheckGameStatus = async (account) => {
    try {
      setLoading(true);
      const gameData = await window.api.checkAccountGame({
        summonerName: account.summonerName,
        region: account.region
      });
      
      const displayName = account.gameName && account.tagLine 
        ? `${account.gameName}#${account.tagLine}` 
        : account.summonerName;
        
      if (gameData) {
        setSuccess(`${displayName} is currently in game!`);
      } else {
        setSuccess(`${displayName} is not in a game right now.`);
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (error) {
      setError(`Failed to check game status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get display name for account
  const getDisplayName = (account) => {
    if (account.gameName && account.tagLine) {
      return `${account.gameName}#${account.tagLine}`;
    }
    return account.summonerName;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          League Accounts
        </Typography>
        
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={() => setShowApiKeyDialog(true)}
        >
          Set Riot API Key
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

      {/* Add account form */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add New Account
          </Typography>
          
          <form onSubmit={handleAddAccount}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Riot ID / Game Name"
                  name="summonerName"
                  value={newAccount.summonerName}
                  onChange={handleInputChange}
                  placeholder="Enter GameName or GameName#TagLine"
                  disabled={loading}
                  required
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="You can enter either just the game name (e.g., 'PlayerName') or the full Riot ID with tagline (e.g., 'PlayerName#NA1')">
                        <InfoIcon color="action" fontSize="small" sx={{ ml: 1 }} />
                      </Tooltip>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  select
                  label="Region"
                  name="region"
                  value={newAccount.region}
                  onChange={handleInputChange}
                  disabled={loading}
                  helperText="Required if not using GameName#TagLine format"
                >
                  {regions.map((region) => (
                    <MenuItem key={region.code} value={region.code}>
                      {region.name} ({region.code})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                >
                  {loading ? 'Adding...' : 'Add Account'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* Accounts list */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tracked Accounts ({accounts.length})
          </Typography>
          
          {accounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No accounts added yet. Add an account above to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Riot ID</TableCell>
                    <TableCell>Region</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <Typography variant="body1">
                          {getDisplayName(account)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {regions.find(r => r.code === account.region)?.name || account.region}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={account.inGame ? "In Game" : "Not Playing"} 
                          color={account.inGame ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={account.isActive}
                          onChange={() => handleToggleActive(account.id)}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="info" 
                          onClick={() => handleCheckGameStatus(account)}
                          disabled={loading}
                        >
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton 
                          color="error" 
                          onClick={() => openDeleteDialog(account)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Remove Account</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to remove the account "{accountToDelete ? getDisplayName(accountToDelete) : ''}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteAccount} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Key dialog */}
      <Dialog open={showApiKeyDialog} onClose={() => setShowApiKeyDialog(false)}>
        <DialogTitle>Set Riot API Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your Riot Games API key to enable account monitoring.
            You can get an API key from the <a href="https://developer.riotgames.com" target="_blank" rel="noopener noreferrer">Riot Developer Portal</a>.
            <br/><br/>
            <strong>Note:</strong> Development API keys expire after 24 hours and need to be renewed.
          </Typography>
          <TextField
            fullWidth
            label="Riot API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            margin="dense"
            variant="outlined"
            placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowApiKeyDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveApiKey} color="primary" variant="contained">
            Save Key
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AccountsPage;
