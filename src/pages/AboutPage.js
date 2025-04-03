import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Link,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CodeIcon from '@mui/icons-material/Code';
import BugReportIcon from '@mui/icons-material/BugReport';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import LiveTvIcon from '@mui/icons-material/LiveTv';

function AboutPage() {
  return (
    <Box>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          About League Auto-Streamer
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Version 1.0.0
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                What is League Auto-Streamer?
              </Typography>
              
              <Typography variant="body1" paragraph>
                League Auto-Streamer is a desktop application that automatically detects when your specified
                League of Legends accounts enter a game and starts streaming to Twitch.
              </Typography>
              
              <Typography variant="body1" paragraph>
                This tool is perfect for content creators, streamers, and teams who want to ensure they
                never miss broadcasting their gameplay without having to manually start streams.
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Key Features
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Automatic Game Detection" 
                    secondary="Monitors specified accounts and detects when they enter games"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="OBS Integration" 
                    secondary="Automatically controls OBS to start and stop streaming"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Twitch Integration" 
                    secondary="Updates stream information with game details and titles"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Multi-Account Support" 
                    secondary="Monitor multiple League accounts across different regions"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Requirements
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SportsSoccerIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="League of Legends" 
                    secondary="The game client should be installed on your computer"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <LiveTvIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="OBS Studio" 
                    secondary="Version 28.0 or later with WebSocket server enabled"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CodeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Riot Games API Key" 
                    secondary="Required to check player status (free from Riot Developer Portal)"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CodeIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Twitch Developer App" 
                    secondary="Create an application on Twitch Developer Console"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Support & Resources
              </Typography>
              
              <List>
                <ListItem button component={Link} href="https://github.com/yourusername/league-auto-streamer" target="_blank" rel="noopener">
                  <ListItemIcon>
                    <GitHubIcon />
                  </ListItemIcon>
                  <ListItemText primary="GitHub Repository" />
                </ListItem>
                
                <ListItem button component={Link} href="https://github.com/yourusername/league-auto-streamer/issues" target="_blank" rel="noopener">
                  <ListItemIcon>
                    <BugReportIcon />
                  </ListItemIcon>
                  <ListItemText primary="Report Issues" />
                </ListItem>
                
                <ListItem button component={Link} href="https://developer.riotgames.com" target="_blank" rel="noopener">
                  <ListItemIcon>
                    <SportsSoccerIcon />
                  </ListItemIcon>
                  <ListItemText primary="Riot Developer Portal" />
                </ListItem>
                
                <ListItem button component={Link} href="https://obsproject.com" target="_blank" rel="noopener">
                  <ListItemIcon>
                    <LiveTvIcon />
                  </ListItemIcon>
                  <ListItemText primary="OBS Studio" />
                </ListItem>
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  © 2025 League Auto-Streamer. Not affiliated with Riot Games.
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  League of Legends is a registered trademark of Riot Games, Inc.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AboutPage;