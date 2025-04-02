import React, { useState, useEffect } from 'react';
import { Box, Container, Paper } from '@mui/material';
import AppHeader from './components/AppHeader';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [settings, setSettings] = useState({
    obs: { address: 'localhost:4455', password: '' },
    twitch: { clientId: '', clientSecret: '', channelName: '' },
    streaming: {
      autoStart: true,
      titleTemplate: '{summonerName} playing League of Legends',
      quality: 'medium'
    }
  });

  // Load initial data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Fetch accounts
        const accountsData = await window.api.getAccounts();
        setAccounts(accountsData);

        // Fetch settings
        const settingsData = await window.api.getSettings();
        setSettings(settingsData);

        // Check monitoring status
        const monitoringStatus = await window.api.getMonitoringStatus();
        setIsMonitoring(monitoringStatus);

        // Initialize app
        await window.api.initializeApp();
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();

    // Set up event listeners
    const removeSettingsListener = window.api.on('open-settings', () => {
      setCurrentPage('settings');
    });

    const removeAboutListener = window.api.on('open-about', () => {
      setCurrentPage('about');
    });

    // Clean up event listeners when component unmounts
    return () => {
      removeSettingsListener();
      removeAboutListener();
    };
  }, []);

  // Toggle monitoring status
  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await window.api.stopMonitoring();
        setIsMonitoring(false);
      } else {
        await window.api.startMonitoring();
        setIsMonitoring(true);
      }
    } catch (error) {
      console.error('Error toggling monitoring:', error);
    }
  };

  // Render the current page based on state
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard isMonitoring={isMonitoring} toggleMonitoring={toggleMonitoring} accounts={accounts} />;
      case 'accounts':
        return <AccountsPage accounts={accounts} setAccounts={setAccounts} />;
      case 'settings':
        return <SettingsPage settings={settings} setSettings={setSettings} />;
      case 'about':
        return <AboutPage />;
      default:
        return <Dashboard isMonitoring={isMonitoring} toggleMonitoring={toggleMonitoring} accounts={accounts} />;
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppHeader />
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} isMonitoring={isMonitoring} />
      <Box component="main" sx={{ flexGrow: 1, overflow: 'auto', padding: 0 }}>
        <Container maxWidth={false} sx={{ mt: 8, mb: 4, height: 'calc(100vh - 64px)' }}>
          <Paper
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 'calc(100vh - 120px)',
              backgroundColor: 'background.paper',
              boxShadow: 3,
            }}
          >
            {renderPage()}
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}

export default App;