# League Auto-Streamer

Automatically stream League of Legends games to Twitch when specified accounts enter a game. This desktop application monitors your chosen summoner accounts and controls OBS Studio to stream whenever they start playing.

## Features

- **Account Monitoring**: Track multiple League of Legends accounts across different regions
- **Automatic Game Detection**: Start streaming as soon as a player enters a game
- **OBS Integration**: Automatically control OBS Studio via WebSocket
- **Twitch Integration**: Update stream title and game category automatically
- **User-Friendly Interface**: Modern React UI with dark mode

## Prerequisites

Before using this application, you'll need:

1. **OBS Studio** (v28.0+) with WebSocket server enabled
2. **League of Legends** installed on your computer
3. **Riot Games API Key** from the [Riot Developer Portal](https://developer.riotgames.com)
4. **Twitch Developer Application** from the [Twitch Developer Console](https://dev.twitch.tv/console/apps)

## Installation

### From Release

1. Download the latest release for your platform from the [Releases page](https://github.com/yourusername/league-auto-streamer/releases)
2. Install the application by running the installer
3. Launch League Auto-Streamer

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/league-auto-streamer.git
cd league-auto-streamer

# Install dependencies
npm install

# Run the setup script (optional)
node scripts/setup.js

# Start the development version
npm run electron-dev

# Build for production
npm run electron-build
```

## Setup

1. **OBS Studio Configuration**:
   - Open OBS Studio
   - Go to Tools > WebSocket Server Settings
   - Enable the WebSocket server
   - Note the port (default is 4455)
   - Optionally set a password

2. **Riot API Key**:
   - Visit the [Riot Developer Portal](https://developer.riotgames.com)
   - Register or log in to your account
   - Generate a Development API Key (or request a Production API Key for long-term use)

3. **Twitch Integration**:
   - Go to the [Twitch Developer Console](https://dev.twitch.tv/console/apps)
   - Register a new application
   - Set the OAuth Redirect URL to `http://localhost`
   - Note your Client ID and generate a Client Secret

4. **In-App Configuration**:
   - Enter your Riot API Key in the League API settings
   - Configure OBS WebSocket connection details
   - Enter your Twitch credentials and channel name
   - Add League of Legends accounts to monitor

## Usage

1. **Add League Accounts**:
   - Go to the "League Accounts" page
   - Enter summoner names and regions
   - Toggle accounts on/off as needed

2. **Start Monitoring**:
   - Click "Start Monitoring" on the Dashboard
   - The app will check your accounts periodically
   - When a player enters a game, streaming will start automatically

3. **Settings Configuration**:
   - Customize stream title template, quality, and more
   - Configure OBS and Twitch integration
   - Set up automatic streaming options

## Troubleshooting

### Common Issues

- **Cannot connect to OBS**: Ensure WebSocket server is enabled in OBS and the address/port are correct
- **Twitch integration not working**: Verify your Client ID and Secret are correct
- **Games not detected**: Check your Riot API key is valid and not expired
- **OBS not streaming**: Ensure your OBS scene is properly configured for League of Legends

### Logs

Log files are located at:
- Windows: `%APPDATA%\league-auto-streamer\logs`
- macOS: `~/Library/Logs/league-auto-streamer`
- Linux: `~/.config/league-auto-streamer/logs`

## Development

This application is built with:
- Electron
- React
- Material UI
- Node.js

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Riot Games API for League of Legends data
- OBS Project for the OBS WebSocket protocol
- Twitch for their Developer API

## Disclaimer

This application is not endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.