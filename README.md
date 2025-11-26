# Screensaver - AI Desktop Background Generator

🤖 **Open source** Node.js/TypeScript application that generates AI images using Google Nano Banana Pro API and sets them as your Windows desktop background daily.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## ✨ Features

- 🤖 AI-powered image generation using Google Nano Banana Pro API
- 🖼️ Automatic desktop background updates
- ⏰ Daily scheduling (via Windows Task Scheduler or built-in scheduler)
- 📝 Comprehensive logging
- ⚙️ Configurable prompts and settings
- 🔒 Secure API key management (local `.env` file)
- 🚀 Easy setup with interactive configuration

## 📋 Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **Windows 10/11**
- **Google API key** - Get one from [Google AI Studio](https://aistudio.google.com/) (see [API_KEY_SETUP.md](API_KEY_SETUP.md) for details)

## 🚀 Quick Start

### Option 1: Using the Executable (No Node.js Required!) ⭐ Recommended

1. **Download the latest release** from [Releases](https://github.com/AgentBurgundy/screensaver/releases)
2. **Extract the ZIP file**
3. **Run `screensaver-setup.exe`** to configure your API key
4. **Run `screensaver.exe`** to update your wallpaper!

That's it! No Node.js installation needed.

### Option 2: From Source (For Developers)

#### 1. Clone or Download

```bash
git clone https://github.com/AgentBurgundy/screensaver.git
cd screensaver
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Set Up Configuration

**Option A: Interactive Setup (Recommended)**
```bash
npm run setup
```
This will guide you through entering your API key and preferences.

**Option B: Manual Setup**
1. Copy the example file:
   ```bash
   copy env.example.txt .env
   ```
   (On Windows PowerShell: `Copy-Item env.example.txt .env`)
2. Open `.env` in a text editor and add your API key:
   ```
   GOOGLE_API_KEY=your_actual_api_key_here
   ```
   You can also customize the image prompt and other settings.

#### 4. Build the Project

**For development:**
```bash
npm run build
npm start
```

**To create an executable:**
```bash
npm run build:exe
```
This creates `dist/screensaver.exe` - a standalone executable!

## 📖 Usage

### Using the Executable

**First time setup:**
1. Run `screensaver-setup.exe` to configure your API key
2. This creates a `.env` file in the same directory

**Update wallpaper:**
- Double-click `screensaver.exe` or run from command line
- The wallpaper will update immediately

**Schedule daily updates:**
- Use Windows Task Scheduler to run `screensaver.exe` daily
- See [Windows Task Scheduler Setup](#-windows-task-scheduler-setup) below

### Using from Source

**Run once:**
```bash
npm start
# or
npm run start -- once
```

**Built-in scheduler:**
```bash
npm run start -- schedule
```

**Development mode:**
```bash
npm run dev
```

## ⏰ Windows Task Scheduler Setup

For daily automatic execution, use Windows Task Scheduler:

### Using the Executable

1. Open Task Scheduler (`taskschd.msc`)
2. Create a new task
3. Set the trigger to "Daily" at your preferred time (e.g., 9:00 AM)
4. Set the action to start a program:
   - **Program/script**: `C:\path\to\screensaver.exe` (full path to your executable)
   - **Start in**: `C:\path\to\` (directory containing screensaver.exe and .env)
5. Save the task

### Using from Source

1. Open Task Scheduler (`taskschd.msc`)
2. Create a new task
3. Set the trigger to "Daily" at your preferred time
4. Set the action to start a program:
   - Program: `node`
   - Arguments: `dist/index.js`
   - Start in: `C:\path\to\screensaver`
5. Save the task

**Note:** Ensure Node.js is in your system PATH, or use the full path to `node.exe`

## ⚙️ Configuration

Edit `.env` file to customize (or run `npm run setup` again):

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Your Google API key | ✅ Yes |
| `GOOGLE_API_URL` | API endpoint URL | No (has default) |
| `IMAGE_PROMPT` | The prompt for image generation | No (has default) |
| `IMAGES_DIR` | Directory to save generated images | No (has default) |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | No (has default) |
| `SCHEDULE_TIME` | Time for daily updates (HH:MM format) | No (has default) |
| `TIMEZONE` | Timezone for scheduling | No (has default) |

**🔒 Security Note:** Your `.env` file contains your API key. Never commit it to version control! It's already in `.gitignore`.

## Project Structure

```
screensaver/
├── src/
│   ├── config.ts              # Configuration management
│   ├── logger.ts              # Winston logger setup
│   ├── index.ts               # Main entry point
│   └── services/
│       ├── imageGenerator.ts  # Google API integration
│       ├── wallpaperService.ts # Windows wallpaper setting
│       └── scheduler.ts       # Daily scheduling logic
├── dist/                      # Compiled JavaScript (generated)
├── images/                    # Generated images (created automatically)
├── package.json
├── tsconfig.json
└── README.md
```

## API Integration Notes

The application is designed to work with Google's Nano Banana Pro API. You may need to adjust the API request format in `src/services/imageGenerator.ts` based on the actual API specification:

- Request format (headers, body structure)
- Response format (image URL vs base64 vs buffer)
- Authentication method
- API endpoint URL

## Logging

Logs are written to:
- `combined.log` - All logs
- `error.log` - Error logs only

Console output is available in development mode.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Sharing with Friends

### Easy Distribution (Executable)

1. **Build the executable:**
   ```bash
   npm run build:exe
   npm run build:setup-exe  # Also build the setup tool
   ```

2. **Create a distribution ZIP:**
   ```
   screensaver-v1.0.0/
   ├── screensaver.exe          # Main application
   ├── screensaver-setup.exe    # Setup tool (first-time config)
   ├── env.example.txt          # Example config file
   ├── README.md                # Instructions
   └── SETUP.md                 # Setup guide
   ```

3. **Share the ZIP file** - Friends just extract and run!

### Source Distribution

1. **Share the repository link** (if on GitHub) or send them the project folder
2. They follow the Quick Start steps above
3. They run `npm run setup` to add their own API key
4. Done! Each person uses their own API key securely

## 🔄 Updating

### Automatic Updates (Recommended)

The easiest way to update is using the built-in update system:

1. **Open the Update Center**:
   ```bash
   screensaver.exe ui
   ```
   This opens a web interface in your browser.

2. **Check for Updates**: The UI automatically checks for new versions

3. **Click "Download & Update"**: When an update is available, click the button

4. **Wait for Restart**: The app will download, install, and restart automatically

### Manual Update

If you prefer to update manually:

1. Download the latest release from [Releases](https://github.com/AgentBurgundy/screensaver/releases)
2. Extract and replace the old `screensaver.exe`
3. Your `.env` file will be preserved (it's in the same directory)

### Source Users

```bash
git pull origin main
npm install  # In case dependencies changed
npm run build
```

To rebuild the executable:
```bash
npm run build:exe
```

See [UPDATE.md](UPDATE.md) for detailed information about the update system.

## 🐛 Troubleshooting

1. **API errors**: 
   - Check your API key in `.env` is correct
   - Verify the API endpoint URL matches your provider
   - Check your API quota/billing status

2. **Wallpaper not setting**: 
   - Ensure you're running on Windows 10/11
   - Check that the image file exists in the `images/` directory
   - Try running as administrator

3. **Permission errors**: 
   - Run with appropriate permissions for file system access
   - Ensure the `images/` directory is writable

4. **Task Scheduler issues**: 
   - Ensure Node.js is in your system PATH
   - Use the full path to `node.exe` in Task Scheduler
   - Check the batch file path is correct

5. **Build errors**:
   - Ensure you have Node.js 18+ installed
   - Delete `node_modules` and `dist`, then run `npm install` again

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- Uses [wallpaper](https://github.com/sindresorhus/wallpaper) for Windows wallpaper management
- Powered by Google Nano Banana Pro API

---

**Made with ❤️ by the open source community**

