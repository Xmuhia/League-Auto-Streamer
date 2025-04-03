import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Toolbar,
  Typography,
  Chip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

// Width of the drawer
const drawerWidth = 240;

function Sidebar({ currentPage, setCurrentPage, isMonitoring }) {
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { 
          width: drawerWidth, 
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)'
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto', mt: 2 }}>
        {/* Status indicator */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          mb: 2 
        }}>
          <Chip
            icon={<RecordVoiceOverIcon />}
            label={isMonitoring ? "Monitoring Active" : "Monitoring Inactive"}
            color={isMonitoring ? "success" : "error"}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          />
        </Box>

        <Divider />
        
        <List>
          <ListItem disablePadding>
            <ListItemButton 
              selected={currentPage === 'dashboard'}
              onClick={() => handlePageChange('dashboard')}
            >
              <ListItemIcon>
                <DashboardIcon color={currentPage === 'dashboard' ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography 
                    variant="body1" 
                    color={currentPage === 'dashboard' ? 'primary' : 'inherit'}
                    fontWeight={currentPage === 'dashboard' ? 'bold' : 'normal'}
                  >
                    Dashboard
                  </Typography>
                } 
              />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding>
            <ListItemButton 
              selected={currentPage === 'accounts'}
              onClick={() => handlePageChange('accounts')}
            >
              <ListItemIcon>
                <PeopleIcon color={currentPage === 'accounts' ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography 
                    variant="body1" 
                    color={currentPage === 'accounts' ? 'primary' : 'inherit'}
                    fontWeight={currentPage === 'accounts' ? 'bold' : 'normal'}
                  >
                    League Accounts
                  </Typography>
                } 
              />
            </ListItemButton>
          </ListItem>
        </List>
        
        <Divider />
        
        <List>
          <ListItem disablePadding>
            <ListItemButton
              selected={currentPage === 'settings'}
              onClick={() => handlePageChange('settings')}
            >
              <ListItemIcon>
                <SettingsIcon color={currentPage === 'settings' ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography 
                    variant="body1" 
                    color={currentPage === 'settings' ? 'primary' : 'inherit'}
                    fontWeight={currentPage === 'settings' ? 'bold' : 'normal'}
                  >
                    Settings
                  </Typography>
                } 
              />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding>
            <ListItemButton
              selected={currentPage === 'about'}
              onClick={() => handlePageChange('about')}
            >
              <ListItemIcon>
                <InfoIcon color={currentPage === 'about' ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography 
                    variant="body1" 
                    color={currentPage === 'about' ? 'primary' : 'inherit'}
                    fontWeight={currentPage === 'about' ? 'bold' : 'normal'}
                  >
                    About
                  </Typography>
                } 
              />
            </ListItemButton>
          </ListItem>
        </List>
        
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          width: '100%', 
          textAlign: 'center' 
        }}>
          <Typography variant="caption" color="text.secondary">
            v1.0.0
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;