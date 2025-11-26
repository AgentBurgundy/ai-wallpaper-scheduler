# Installer & System Tray Setup

This guide explains how to build an installable Windows application with a system tray interface.

## Architecture

The application now consists of:

1. **Main Application** (`screensaver.exe`) - Core wallpaper update logic
2. **Electron Tray App** - System tray icon with settings UI
3. **Windows Installer** - NSIS installer created with electron-builder

## Building the Installer

### Prerequisites

- Node.js 18+
- Windows 10/11
- All dependencies installed: `npm install`

### Build Steps

1. **Build TypeScript**:
   ```bash
   npm run build
   ```

2. **Build Electron App & Installer**:
   ```bash
   npm run build:electron
   ```

   This creates:
   - `dist-installer/Screensaver Setup X.X.X.exe` - Windows installer
   - `dist-installer/win-unpacked/` - Unpacked app directory

### Development Mode

Run Electron in development mode:

```bash
npm run electron:dev
```

Or run the built version:

```bash
npm run electron
```

## Installation

Users can install the application by:

1. **Downloading** the installer from GitHub Releases
2. **Running** `Screensaver Setup X.X.X.exe`
3. **Following** the installation wizard
4. **Launching** from Start Menu or Desktop shortcut

The app will:
- Install to `C:\Program Files\Screensaver\` (or user-selected location)
- Create Start Menu shortcut
- Create Desktop shortcut (optional)
- Add to Windows startup (optional)

## System Tray Features

After installation, the app runs in the system tray with:

### Tray Menu Options

- **Open Settings** - Opens settings window
- **Update Wallpaper Now** - Manually trigger wallpaper update
- **Check for Updates** - Check GitHub for new version
- **Quit** - Exit the application

### Settings Window

The settings window includes:

1. **API Configuration**
   - Google API Key (password field)
   - API URL
   - Save button

2. **Image Generation**
   - Image prompt editor
   - Test wallpaper button

3. **Schedule**
   - Update time picker
   - Timezone setting

4. **Updates**
   - Current version display
   - Latest version check
   - Update button (when available)

## Auto-Start

The application can be configured to start with Windows:

1. Open Settings from tray
2. Enable "Start with Windows" option (if implemented)
3. Or manually add to Windows Startup folder

## Updating

Updates work automatically:

1. App checks for updates on startup
2. Shows notification in tray if update available
3. User clicks "Check for Updates" in tray menu
4. Settings window shows update button
5. Click "Download & Install Update"
6. App downloads, installs, and restarts automatically

## File Structure

```
dist-installer/
├── Screensaver Setup X.X.X.exe  # Installer
└── win-unpacked/                 # Unpacked app
    ├── Screensaver.exe           # Main Electron app
    ├── resources/
    │   ├── app/                  # Your app code
    │   └── electron.asar         # Electron runtime
    └── ...
```

## Configuration

### electron-builder.yml

Edit `electron-builder.yml` to customize:

- App ID and name
- Installer options
- Icon paths
- GitHub release settings

### Icons

Place icon files in `assets/`:
- `icon.ico` - Windows icon (256x256 recommended)
- `tray-icon.png` - Tray icon (16x16 or 32x32)

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `npm install`
- Check that TypeScript compiles: `npm run build`
- Verify Electron version compatibility

### Tray Icon Not Showing

- Check that `assets/tray-icon.png` exists
- Verify icon file is valid image format
- Check Windows tray icon settings

### Settings Window Won't Open

- Check console for errors
- Verify preload script is working
- Ensure IPC handlers are registered

### Installer Won't Run

- Check Windows Defender/Antivirus
- Verify installer signature (if signed)
- Run as administrator if needed

## Distribution

### Creating a Release

1. **Update version** in `package.json`
2. **Build installer**:
   ```bash
   npm run build:electron
   ```
3. **Test installer** on clean Windows VM
4. **Create GitHub Release**:
   - Upload `Screensaver Setup X.X.X.exe`
   - Add release notes
   - Tag with version

### File Size

Expected sizes:
- Installer: ~100-150 MB (includes Electron runtime)
- Installed app: ~200-300 MB

The larger size is due to Electron including Chromium and Node.js runtime.

## Alternative: Portable Version

If you prefer a portable version without installer:

```bash
npm run build:electron:dir
```

This creates `dist-installer/win-unpacked/` which can be zipped and distributed.

Users can:
- Extract anywhere
- Run `Screensaver.exe` directly
- No installation required


