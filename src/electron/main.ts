import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { UpdateService } from '../services/updateService.js';
import { logger } from '../logger.js';
// Import services lazily to avoid loading config before app is ready
// import { ImageGenerator } from '../services/imageGenerator.js';
// import { WallpaperService } from '../services/wallpaperService.js';
// import { config } from '../config.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For Electron, we need to handle paths differently
const isDev = !app.isPackaged;
const appDir = isDev ? path.resolve(__dirname, '..', '..') : path.dirname(process.execPath);

// Get the user data directory for storing config and images
function getUserDataDir(): string {
  // In dev, we can use the app dir, but let's use the standard location to match production behavior
  const platform = process.platform;
  let userDataDir: string;
  
  try {
    userDataDir = app.getPath('userData');
  } catch {
    // Fallback if app.getPath is not available (shouldn't happen in main process)
    if (platform === 'win32') {
      userDataDir = path.join(process.env.APPDATA || '', 'Screensaver');
    } else {
      userDataDir = path.join(process.env.HOME || '', '.config', 'screensaver');
    }
  }
  return userDataDir;
}

const userDataDir = getUserDataDir();
// Config file location
const userEnvPath = path.join(userDataDir, '.env');
// Fallback for dev: existing .env in project root
const devEnvPath = path.join(appDir, '.env');

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let updateService: UpdateService | null = null;

// Get package info
async function getPackageInfo() {
  try {
    const packagePath = path.join(appDir, 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(packageContent);
  } catch {
    return {
      version: app.getVersion(),
      repository: { url: 'https://github.com/AgentBurgundy/screensaver.git' }
    };
  }
}

// Extract repo info
function extractRepoInfo(repoUrl: string): { owner: string; name: string } {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      name: match[2].replace(/\.git$/, '')
    };
  }
  return { owner: 'AgentBurgundy', name: 'screensaver' };
}

async function createTray() {
  // Create tray icon (using a simple icon - you can replace with actual icon file)
  const iconPath = path.join(appDir, 'assets', 'tray-icon.png');
  
  // Fallback to a simple icon if file doesn't exist
  let trayIcon = nativeImage.createEmpty();
  try {
    const iconExists = await fs.access(iconPath).then(() => true).catch(() => false);
    if (iconExists) {
      trayIcon = nativeImage.createFromPath(iconPath);
    }
  } catch {
    // Use empty icon
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Screensaver - AI Desktop Background');

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Open Settings',
      click: () => openSettingsWindow()
    },
    {
      label: 'Update Wallpaper Now',
      click: () => updateWallpaper()
    },
  ];

  // Only show update check in production
  if (!isDev) {
    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: 'Check for Updates',
      click: () => checkForUpdates()
    });
  }

  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Quit',
    click: () => {
      app.quit();
    }
  });

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

async function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  // Resolve preload script path
  const preloadPath = isDev 
    ? path.join(__dirname, 'preload.js')
    : path.join(path.dirname(process.execPath), 'electron', 'preload.js');
  
  // Verify preload file exists
  try {
    await fs.access(preloadPath);
    logger.debug('Preload script found at:', preloadPath);
  } catch (error) {
    logger.error('Preload script not found at:', preloadPath);
  }
  
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    icon: path.join(appDir, 'assets', 'icon.png'),
    title: 'Screensaver Settings'
  });

  // Load the settings HTML (using inline HTML since we don't have a separate file)
  settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSettingsHTML())}`);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function getSettingsHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Screensaver Settings</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: rgba(18, 18, 26, 0.9);
      --bg-input: rgba(0, 0, 0, 0.4);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(0, 212, 255, 0.5);
      --text-primary: #f0f0f5;
      --text-secondary: #8888a0;
      --text-muted: #5a5a70;
      --accent-cyan: #00d4ff;
      --accent-purple: #a855f7;
      --accent-pink: #ec4899;
      --accent-green: #22c55e;
      --accent-orange: #f97316;
      --accent-red: #ef4444;
      --glow-cyan: rgba(0, 212, 255, 0.3);
      --glow-purple: rgba(168, 85, 247, 0.3);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      height: 100%;
    }

    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 0;
      overflow-x: hidden;
      position: relative;
    }

    /* Animated gradient background */
    .bg-gradient {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(ellipse 80% 50% at 20% 40%, rgba(0, 212, 255, 0.08), transparent),
        radial-gradient(ellipse 60% 40% at 80% 60%, rgba(168, 85, 247, 0.06), transparent);
      animation: gradientShift 20s ease-in-out infinite;
      z-index: 0;
      pointer-events: none;
    }

    @keyframes gradientShift {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .main-container {
      position: relative;
      z-index: 1;
      max-width: 100%;
      padding: 32px;
      min-height: 100vh;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .logo-icon {
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      box-shadow: 0 8px 24px var(--glow-cyan);
    }

    .header-text h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-text .subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
      animation: fadeInUp 0.4s ease-out both;
    }

    .section:nth-child(2) { animation-delay: 0.1s; }
    .section:nth-child(3) { animation-delay: 0.2s; }
    .section:nth-child(4) { animation-delay: 0.3s; }
    .section:nth-child(5) { animation-delay: 0.4s; }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .section h2 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section h2::before {
      content: '';
      width: 4px;
      height: 18px;
      background: linear-gradient(180deg, var(--accent-cyan), var(--accent-purple));
      border-radius: 2px;
    }

    .form-group {
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    label .required {
      color: var(--accent-pink);
      margin-left: 2px;
    }

    input, textarea, select {
      width: 100%;
      padding: 12px 14px;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
    }

    input::placeholder, textarea::placeholder {
      color: var(--text-muted);
    }

    textarea {
      resize: vertical;
      min-height: 80px;
      line-height: 1.5;
    }

    small {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
      line-height: 1.4;
    }

    small a {
      color: var(--accent-cyan);
      text-decoration: none;
    }

    small a:hover {
      text-decoration: underline;
    }

    button {
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      color: var(--bg-primary);
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.4s ease;
    }

    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px var(--glow-cyan);
    }

    button:hover::before {
      left: 100%;
    }

    button:active {
      transform: translateY(0);
    }

    button.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
    }

    button.secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      box-shadow: none;
    }

    .button-row {
      display: flex;
      gap: 12px;
      margin-top: 4px;
    }

    .status {
      padding: 12px 16px;
      border-radius: 10px;
      margin-top: 16px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid transparent;
      animation: statusAppear 0.3s ease-out;
    }

    @keyframes statusAppear {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .status::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .success {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }
    .success::before { background: var(--accent-green); }

    .error {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
    }
    .error::before { background: var(--accent-red); }

    .warning {
      background: rgba(249, 115, 22, 0.1);
      border-color: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
    }
    .warning::before { background: var(--accent-orange); }

    .info {
      background: rgba(0, 212, 255, 0.1);
      border-color: rgba(0, 212, 255, 0.2);
      color: var(--accent-cyan);
    }
    .info::before { 
      background: var(--accent-cyan);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }

    .version-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .version-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 14px;
      text-align: center;
    }

    .version-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .version-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .schedule-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    #devModeNotice {
      color: var(--text-muted);
      font-size: 12px;
      font-style: italic;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      text-align: center;
    }

    /* Custom scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  
  <div class="main-container">
    <div class="header">
      <div class="logo-icon">🎨</div>
      <div class="header-text">
        <h1>Screensaver</h1>
        <p class="subtitle">Settings & Configuration</p>
      </div>
    </div>
    
    <div class="section">
      <h2>API Configuration</h2>
      <div id="apiKeyWarning" class="status warning" style="display: none; margin-bottom: 16px;">
        API Key required to generate wallpapers
      </div>
      
      <div class="form-group">
        <label>Google API Key <span class="required">*</span></label>
        <input type="password" id="apiKey" placeholder="Enter your API key">
        <small>Get your key from <a href="https://aistudio.google.com/" target="_blank">Google AI Studio</a></small>
      </div>
      
      <div class="form-group">
        <label>API URL</label>
        <input type="text" id="apiUrl" value="https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent">
        <small>Default: Gemini 3 Pro Image Preview (supports 2K/4K). Change for other models.</small>
      </div>
      
      <button onclick="saveConfig()">💾 Save Configuration</button>
      <div id="configStatus"></div>
    </div>

    <div class="section">
      <h2>Image Generation</h2>
      <div class="form-group">
        <label>Image Prompt</label>
        <textarea id="imagePrompt" rows="3" placeholder="Describe your dream wallpaper... e.g., A serene mountain lake at sunset with vibrant colors"></textarea>
        <small>Be descriptive! The AI will generate a wallpaper based on this prompt.</small>
      </div>
      
      <div class="form-group">
        <label>Aspect Ratio</label>
        <select id="aspectRatio">
          <option value="16:9">16:9 — Widescreen (Most monitors)</option>
          <option value="21:9">21:9 — Ultra-wide monitors</option>
          <option value="3:2">3:2 — Classic Photo</option>
          <option value="4:3">4:3 — Standard</option>
          <option value="1:1">1:1 — Square</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Resolution</label>
        <select id="imageSize">
          <option value="1K">1K (~1080p) — Fast, good for most uses</option>
          <option value="2K" selected>2K (~1440p) — High quality ✓</option>
          <option value="4K">4K (~2160p) — Ultra HD ✓</option>
        </select>
        <small>Gemini 3 Pro Image Preview supports all resolutions. 2K recommended for best quality/speed balance.</small>
      </div>
      
      <div class="button-row">
        <button onclick="testWallpaper()">🖼️ Generate Wallpaper</button>
        <button class="secondary" onclick="openImagesFolder()">📁 Open Images Folder</button>
      </div>
      <div id="testStatus"></div>
    </div>

    <div class="section">
      <h2>Schedule</h2>
      <div class="schedule-row">
        <div class="form-group">
          <label>Update Time</label>
          <input type="time" id="scheduleTime" value="09:00">
        </div>
        <div class="form-group">
          <label>Timezone</label>
          <input type="text" id="timezone" value="America/New_York">
        </div>
      </div>
      <small style="margin-top: -8px;">New wallpaper will be generated daily at the specified time.</small>
    </div>

    <div class="section" id="updatesSection">
      <h2>Updates</h2>
      <div class="version-grid">
        <div class="version-card">
          <div class="version-label">Current</div>
          <div class="version-value" id="currentVersion">—</div>
        </div>
        <div class="version-card">
          <div class="version-label">Latest</div>
          <div class="version-value" id="latestVersion">—</div>
        </div>
      </div>
      
      <div id="updateControls" style="display: none;">
        <div class="button-row">
          <button class="secondary" onclick="checkUpdates()">🔄 Check for Updates</button>
          <button id="updateBtn" onclick="installUpdate()" style="display: none;">⬇️ Install Update</button>
        </div>
        <div id="updateStatus"></div>
      </div>
      
      <div id="devModeNotice">
        🔧 Development mode — update checks disabled
      </div>
    </div>
  </div>

  <script>
    // Wait for electronAPI to be available (preload loads asynchronously)
    function waitForElectronAPI() {
      return new Promise((resolve, reject) => {
        if (typeof window.electronAPI !== 'undefined') {
          resolve(window.electronAPI);
          return;
        }
        
        // Wait up to 2 seconds for preload to load
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (typeof window.electronAPI !== 'undefined') {
            clearInterval(checkInterval);
            resolve(window.electronAPI);
          } else if (attempts > 40) { // 2 seconds (40 * 50ms)
            clearInterval(checkInterval);
            reject(new Error('electronAPI failed to load'));
          }
        }, 50);
      });
    }
    
    // Load current config
    waitForElectronAPI().then(() => {
      return window.electronAPI.loadConfig();
    }).then(config => {
      if (config) {
        const apiKey = config.GOOGLE_API_KEY || '';
        document.getElementById('apiKey').value = apiKey;
        document.getElementById('apiUrl').value = config.GOOGLE_API_URL || '';
        document.getElementById('imagePrompt').value = config.IMAGE_PROMPT || '';
        document.getElementById('aspectRatio').value = config.ASPECT_RATIO || '16:9';
        document.getElementById('imageSize').value = config.IMAGE_SIZE || '1K';
        document.getElementById('scheduleTime').value = config.SCHEDULE_TIME || '09:00';
        document.getElementById('timezone').value = config.TIMEZONE || 'America/New_York';
        
        // Show warning if API key is missing
        if (!apiKey || apiKey === 'your_api_key_here') {
          document.getElementById('apiKeyWarning').style.display = 'block';
        }
      } else {
        // No config file, show warning
        document.getElementById('apiKeyWarning').style.display = 'block';
      }
    }).catch(error => {
      console.error('Failed to load config:', error);
      document.getElementById('apiKeyWarning').style.display = 'block';
    });

    waitForElectronAPI().then(() => {
      return window.electronAPI.getVersion();
    }).then(version => {
      document.getElementById('currentVersion').textContent = version;
    }).catch(error => {
      console.error('Failed to get version:', error);
      document.getElementById('currentVersion').textContent = 'Unknown';
    });

    // Show/hide update controls based on dev mode
    waitForElectronAPI().then(() => {
      return window.electronAPI.isDevMode();
    }).then(devMode => {
      if (devMode) {
        document.getElementById('updateControls').style.display = 'none';
        document.getElementById('devModeNotice').style.display = 'block';
      } else {
        document.getElementById('updateControls').style.display = 'block';
        document.getElementById('devModeNotice').style.display = 'none';
      }
    }).catch(error => {
      console.error('Failed to check dev mode:', error);
      // Default to showing update controls if check fails
      document.getElementById('updateControls').style.display = 'block';
      document.getElementById('devModeNotice').style.display = 'none';
    });

    async function saveConfig() {
      const apiKey = document.getElementById('apiKey').value.trim();
      if (!apiKey) {
        const statusEl = document.getElementById('configStatus');
        statusEl.className = 'status error';
        statusEl.textContent = 'Please enter a Google API key.';
        document.getElementById('apiKeyWarning').style.display = 'block';
        return;
      }
      
      const config = {
        GOOGLE_API_KEY: apiKey,
        GOOGLE_API_URL: document.getElementById('apiUrl').value,
        IMAGE_PROMPT: document.getElementById('imagePrompt').value,
        ASPECT_RATIO: document.getElementById('aspectRatio').value,
        IMAGE_SIZE: document.getElementById('imageSize').value,
        SCHEDULE_TIME: document.getElementById('scheduleTime').value,
        TIMEZONE: document.getElementById('timezone').value
      };
      
      try {
        await waitForElectronAPI();
        const result = await window.electronAPI.saveConfig(config);
        const statusEl = document.getElementById('configStatus');
        if (result.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'Configuration saved successfully! The app will use your API key for wallpaper generation.';
          document.getElementById('apiKeyWarning').style.display = 'none';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = 'Failed to save configuration: ' + (result.error || 'Unknown error');
        }
      } catch (error) {
        const statusEl = document.getElementById('configStatus');
        statusEl.className = 'status error';
        statusEl.textContent = 'Error saving configuration: ' + (error instanceof Error ? error.message : String(error));
        console.error('Save config error:', error);
      }
    }

    async function testWallpaper() {
      const statusEl = document.getElementById('testStatus');
      statusEl.className = 'status info';
      statusEl.textContent = 'Generating wallpaper... (this may take 10-15 seconds)';
      
      try {
        await waitForElectronAPI();
        const result = await window.electronAPI.testWallpaper();
        if (result.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'Wallpaper updated successfully!';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = 'Failed: ' + result.error;
        }
      } catch (error) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Error: ' + (error instanceof Error ? error.message : String(error));
      }
    }

    async function openImagesFolder() {
      try {
        await waitForElectronAPI();
        await window.electronAPI.openImagesFolder();
      } catch (error) {
        console.error('Failed to open images folder:', error);
      }
    }

    async function checkUpdates() {
      const statusEl = document.getElementById('updateStatus');
      statusEl.className = 'status';
      statusEl.textContent = 'Checking for updates...';
      
      try {
        await waitForElectronAPI();
        const updateInfo = await window.electronAPI.checkForUpdates();
        document.getElementById('latestVersion').textContent = updateInfo.version;
        
        if (updateInfo.available) {
          statusEl.className = 'status success';
          statusEl.textContent = 'Update available: v' + updateInfo.version;
          document.getElementById('updateBtn').style.display = 'block';
        } else {
          statusEl.className = 'status';
          statusEl.textContent = 'You are running the latest version.';
          document.getElementById('updateBtn').style.display = 'none';
        }
      } catch (error) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Error checking for updates: ' + (error instanceof Error ? error.message : String(error));
      }
    }

    async function installUpdate() {
      const statusEl = document.getElementById('updateStatus');
      statusEl.className = 'status';
      statusEl.textContent = 'Downloading update...';
      
      try {
        await waitForElectronAPI();
        const result = await window.electronAPI.installUpdate();
        if (result.success) {
          statusEl.className = 'status success';
          statusEl.textContent = 'Update installed! The app will restart shortly...';
        } else {
          statusEl.className = 'status error';
          statusEl.textContent = 'Update failed: ' + result.error;
        }
      } catch (error) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Error installing update: ' + (error instanceof Error ? error.message : String(error));
      }
    }

    // Check for updates on load
    checkUpdates();
  </script>
</body>
</html>`;
}

async function updateWallpaper() {
  // Check if API key is configured first
  const apiKeyConfigured = await hasApiKey();
  if (!apiKeyConfigured) {
    // Show notification and open settings
    if (tray) {
      tray.displayBalloon({
        title: 'API Key Required',
        content: 'Please configure your Google API key in Settings first.',
        icon: path.join(appDir, 'assets', 'icon.png')
      });
    }
    openSettingsWindow();
    return;
  }

  // In dev mode, call services directly; in production, spawn executable
  if (isDev) {
    try {
      logger.info('Updating wallpaper directly (dev mode)');
      
      // Reload config from .env file to get latest prompt
      const freshConfig = await loadFreshConfig();
      const imagePrompt = freshConfig.IMAGE_PROMPT || 'A beautiful serene landscape with mountains and a river at sunrise';
      
      logger.info(`Using prompt from fresh config: "${imagePrompt}"`);
      
      // Update process.env so ImageGenerator picks up the latest config
      if (freshConfig.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = freshConfig.GOOGLE_API_KEY;
      if (freshConfig.GOOGLE_API_URL) process.env.GOOGLE_API_URL = freshConfig.GOOGLE_API_URL;
      if (freshConfig.IMAGE_PROMPT) process.env.IMAGE_PROMPT = freshConfig.IMAGE_PROMPT;
      if (freshConfig.ASPECT_RATIO) process.env.ASPECT_RATIO = freshConfig.ASPECT_RATIO;
      if (freshConfig.IMAGE_SIZE) process.env.IMAGE_SIZE = freshConfig.IMAGE_SIZE;
      
      // Lazy import services
      const { ImageGenerator } = await import('../services/imageGenerator.js');
      const { WallpaperService } = await import('../services/wallpaperService.js');
      
      const imageGenerator = new ImageGenerator();
      const wallpaperService = new WallpaperService();
      
      const imagePath = await imageGenerator.generateImage(imagePrompt);
      await wallpaperService.setWallpaper(imagePath);
      
      logger.info('Wallpaper updated successfully');
      if (tray) {
        tray.displayBalloon({
          title: 'Success',
          content: 'Wallpaper updated successfully!',
          icon: path.join(appDir, 'assets', 'icon.png')
        });
      }
    } catch (error) {
      logger.error('Failed to update wallpaper', error);
      if (tray) {
        tray.displayBalloon({
          title: 'Error',
          content: 'Failed to update wallpaper: ' + (error instanceof Error ? error.message : 'Unknown error'),
          icon: path.join(appDir, 'assets', 'icon.png')
        });
      }
      throw error;
    }
  } else {
    // Production mode: spawn executable
    try {
      const mainExe = path.join(appDir, 'screensaver.exe');
      await fs.access(mainExe).catch(() => {
        throw new Error('screensaver.exe not found');
      });
      
      spawn(mainExe, ['once'], {
        detached: true,
        stdio: 'ignore'
      });
    } catch (error) {
      logger.error('Failed to update wallpaper', error);
      if (tray) {
        tray.displayBalloon({
          title: 'Error',
          content: 'Failed to update wallpaper. Please check Settings.',
          icon: path.join(appDir, 'assets', 'icon.png')
        });
      }
      throw error;
    }
  }
}

async function checkForUpdates() {
  // Skip update checks in development mode
  if (isDev) {
    logger.debug('Skipping update check in development mode');
    const packageInfo = await getPackageInfo();
    return {
      version: packageInfo.version,
      available: false,
      downloadUrl: '',
    };
  }

  if (!updateService) {
    const packageInfo = await getPackageInfo();
    const repoInfo = extractRepoInfo(packageInfo.repository?.url || '');
    
    // Note: Update check will work once the repository exists on GitHub
    
    updateService = new UpdateService(repoInfo.owner, repoInfo.name, packageInfo.version);
  }

  try {
    const updateInfo = await updateService.checkForUpdates();
    if (updateInfo.available) {
      // Show notification
      if (tray) {
        tray.displayBalloon({
          title: 'Update Available',
          content: `Version ${updateInfo.version} is available. Open Settings to update.`,
          icon: path.join(appDir, 'assets', 'icon.png')
        });
      }
    }
    return updateInfo;
  } catch (error) {
    // Silently handle update check failures (repo might not exist, network issues, etc.)
    logger.debug('Update check failed (non-critical)', error);
    const packageInfo = await getPackageInfo();
    return {
      version: packageInfo.version,
      available: false,
      downloadUrl: '',
    };
  }
}

// Load fresh config from .env file (bypasses module cache)
async function loadFreshConfig(): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  
  // Get the actual userData path from Electron (this is reliable after app.whenReady)
  const electronUserData = app.getPath('userData');
  const electronEnvPath = path.join(electronUserData, '.env');
  
  // Try paths in order of priority:
  // 1. Electron's actual userData path (where save-config writes)
  // 2. userEnvPath (calculated at module load)
  // 3. devEnvPath (project root .env)
  const pathsToTry = [electronEnvPath, userEnvPath, devEnvPath];
  
  for (const envPath of pathsToTry) {
    try {
      const exists = await fs.access(envPath).then(() => true).catch(() => false);
      if (exists) {
        const content = await fs.readFile(envPath, 'utf-8');
        logger.debug(`Loading config from: ${envPath}`);
        
        content.split('\n').forEach(line => {
          const match = line.match(/^([^#=]+)=(.*)$/);
          if (match) {
            // Remove surrounding quotes if present
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            config[match[1].trim()] = value;
          }
        });
        
        // Found and parsed config, return it
        if (Object.keys(config).length > 0) {
          return config;
        }
      }
    } catch {
      // Try next path
    }
  }
  
  return config;
}

// Check if API key is configured
async function hasApiKey(): Promise<boolean> {
  try {
    // Check user data dir first
    if (await fs.access(userEnvPath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(userEnvPath, 'utf-8');
      if (content.includes('GOOGLE_API_KEY=') && content.split('\n').some(line => {
        const match = line.match(/^GOOGLE_API_KEY=(.+)$/);
        return match && match[1].trim() && match[1].trim() !== 'your_api_key_here';
      })) {
        return true;
      }
    }
    
    // Check dev path
    if (isDev) {
      const content = await fs.readFile(devEnvPath, 'utf-8').catch(() => '');
      return content.includes('GOOGLE_API_KEY=') && 
             content.split('\n').some(line => {
               const match = line.match(/^GOOGLE_API_KEY=(.+)$/);
               return match && match[1].trim() && match[1].trim() !== 'your_api_key_here';
             });
    }
    
    return false;
  } catch {
    return false;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  // Don't exit in Electron - let the app continue running
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// App event handlers
app.whenReady().then(async () => {
  try {
    await createTray();
    
    // Always open settings window on startup (especially in dev mode)
    // In production, only open if API key is not configured
    const apiKeyConfigured = await hasApiKey();
    const shouldOpenSettings = isDev || !apiKeyConfigured;
    
    if (shouldOpenSettings) {
      if (!apiKeyConfigured && tray) {
        // Show notification if API key is missing
        tray.displayBalloon({
          title: 'Configuration Required',
          content: 'Please configure your Google API key in Settings to start using Screensaver.',
          icon: path.join(appDir, 'assets', 'icon.png')
        });
      }
      // Open settings window after a short delay
      setTimeout(() => {
        openSettingsWindow().catch(err => logger.error('Failed to open settings window', err));
      }, 1000);
    }
    
    if (apiKeyConfigured) {
      // Start daily scheduler in background only if API key is configured
      // Skip in dev mode since screensaver.exe doesn't exist
      if (!isDev) {
        try {
          const mainExe = path.join(appDir, 'screensaver.exe');
          // Check if screensaver.exe exists before spawning
          try {
            await fs.access(mainExe);
            // File exists, spawn it
            spawn(mainExe, ['schedule'], {
              detached: true,
              stdio: 'ignore'
            });
            logger.debug('Started background scheduler');
          } catch (error) {
            logger.debug('screensaver.exe not found, skipping background scheduler');
          }
        } catch (error) {
          logger.debug('Could not start background scheduler', error);
        }
      } else {
        logger.debug('Skipping background scheduler in dev mode');
      }
    }

    // Check for updates on startup (only in production, silently - don't show errors)
    if (!isDev) {
      setTimeout(() => {
        checkForUpdates().catch(() => {
          // Silently ignore update check failures on startup
        });
      }, 5000);
    }
    } catch (error) {
      logger.error('Error during app initialization', error);
      // Show error to user
      if (tray) {
        tray.displayBalloon({
          title: 'Initialization Error',
          content: 'An error occurred during startup. Check logs for details.',
          icon: path.join(appDir, 'assets', 'icon.png')
        });
      }
    }
  }).catch(error => {
    logger.error('Failed to initialize app', error);
  });

app.on('window-all-closed', () => {
  // Don't quit when windows close - keep tray running
});

app.on('before-quit', () => {
  // Cleanup
});

// IPC handlers
ipcMain.handle('load-config', async () => {
  try {
    let envPath = userEnvPath;
    if (!await fs.access(envPath).then(() => true).catch(() => false)) {
      if (isDev && await fs.access(devEnvPath).then(() => true).catch(() => false)) {
        envPath = devEnvPath;
      }
    }

    const content = await fs.readFile(envPath, 'utf-8').catch(() => '');
    const config: Record<string, string> = {};
    
    if (content) {
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          config[match[1].trim()] = match[2].trim();
        }
      });
    }
    
    // Fix old API URL if present (upgrade to Gemini 3 Pro Image Preview for high-res support)
    if (config.GOOGLE_API_URL && (config.GOOGLE_API_URL.includes('nano-banana-pro') || config.GOOGLE_API_URL.includes('-exp') || 
        config.GOOGLE_API_URL.includes('gemini-2.5-flash-image') || (config.GOOGLE_API_URL.includes('gemini-3-pro') && !config.GOOGLE_API_URL.includes('image')))) {
      config.GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
      logger.info('Auto-corrected old API URL to Gemini 3 Pro Image Preview');
      
      // Save the corrected config back to user data dir (migrating if necessary)
      const correctedContent = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
        
      // Ensure directory exists
      await fs.mkdir(path.dirname(userEnvPath), { recursive: true }).catch(() => {});
      
      fs.writeFile(userEnvPath, correctedContent, 'utf-8').catch(err => 
        logger.error('Failed to save corrected config', err)
      );
    }
    
    // Ensure default API URL if not present (use Gemini 3 Pro Image Preview for high-res)
    if (!config.GOOGLE_API_URL) {
      config.GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
    }
    
    return config;
  } catch {
    // Return default config if file doesn't exist (use Gemini 3 Pro Image Preview)
    return {
      GOOGLE_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent'
    };
  }
});

ipcMain.handle('save-config', async (_event: any, config: Record<string, string>) => {
  try {
    // Always save to user data directory for persistence
    const envPath = userEnvPath;
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(envPath), { recursive: true }).catch(() => {
      // Directory might already exist, ignore error
    });
    
    // Fix old API URL if present (upgrade to Gemini 3 Pro Image Preview)
    const correctedConfig: Record<string, string> = { ...config };
    if (correctedConfig.GOOGLE_API_URL && (correctedConfig.GOOGLE_API_URL.includes('nano-banana-pro') || correctedConfig.GOOGLE_API_URL.includes('-exp') ||
        correctedConfig.GOOGLE_API_URL.includes('gemini-2.5-flash-image') || (correctedConfig.GOOGLE_API_URL.includes('gemini-3-pro') && !correctedConfig.GOOGLE_API_URL.includes('image')))) {
      correctedConfig.GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
      logger.info('Updated old API URL to Gemini 3 Pro Image Preview');
    }
    // Ensure default API URL if not provided (use Gemini 3 Pro Image Preview for high-res)
    if (!correctedConfig.GOOGLE_API_URL) {
      correctedConfig.GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
    }
    
    // Format .env file content properly
    const content = Object.entries(correctedConfig)
      .map(([key, value]) => {
        // Escape values that contain spaces or special characters
        const escapedValue = value.includes(' ') || value.includes('#') || value.includes('=')
          ? `"${value.replace(/"/g, '\\"')}"`
          : value;
        return `${key}=${escapedValue}`;
      })
      .join('\n');
    
    await fs.writeFile(envPath, content, 'utf-8');
    
    // Also update dev .env if it exists and we are in dev mode
    if (isDev) {
      try {
        await fs.writeFile(devEnvPath, content, 'utf-8');
      } catch {
        // Ignore errors updating dev env
      }
    }
    
    logger.info('Configuration saved successfully', { envPath, keys: Object.keys(correctedConfig) });
    return { success: true };
  } catch (error) {
    logger.error('Failed to save configuration', { error, errorMessage: error instanceof Error ? error.message : String(error) });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

ipcMain.handle('test-wallpaper', async () => {
  try {
    // Check if API key is configured first
    const apiKeyConfigured = await hasApiKey();
    if (!apiKeyConfigured) {
      return { success: false, error: 'Please configure your Google API key first.' };
    }
    
    await updateWallpaper();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('open-images-folder', async () => {
  try {
    const { shell } = await import('electron');
    // Get images directory from config
    const freshConfig = await loadFreshConfig();
    
    // Determine images path - use user data dir
    const electronUserData = app.getPath('userData');
    let imagesDir = path.join(electronUserData, 'images');
    
    // Also check the dist/images folder in dev mode
    if (isDev) {
      const devImagesDir = path.join(appDir, 'dist', 'images');
      // Check if dev images dir exists and has files
      try {
        const files = await fs.readdir(devImagesDir);
        if (files.length > 0) {
          imagesDir = devImagesDir;
        }
      } catch {
        // Use default
      }
    }
    
    // Ensure directory exists
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Open in file explorer
    await shell.openPath(imagesDir);
    return { success: true };
  } catch (error) {
    logger.error('Failed to open images folder', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('check-for-updates', async () => {
  // Skip in dev mode
  if (isDev) {
    const packageInfo = await getPackageInfo();
    return {
      version: packageInfo.version,
      available: false,
      downloadUrl: '',
    };
  }
  return await checkForUpdates();
});

ipcMain.handle('is-dev-mode', async () => {
  return isDev;
});

ipcMain.handle('install-update', async () => {
  if (!updateService) {
    const packageInfo = await getPackageInfo();
    const repoInfo = extractRepoInfo(packageInfo.repository?.url || '');
    updateService = new UpdateService(repoInfo.owner, repoInfo.name, packageInfo.version);
  }

  try {
    const updateInfo = await updateService.checkForUpdates();
    if (!updateInfo.available || !updateInfo.downloadUrl) {
      return { success: false, error: 'No update available' };
    }

    const downloadPath = path.join(appDir, 'update.zip');
    await updateService.downloadUpdate(updateInfo.downloadUrl, downloadPath);
    await updateService.installUpdate(downloadPath, appDir);

    // Restart app after a delay
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 2000);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('get-version', async () => {
  const packageInfo = await getPackageInfo();
  return packageInfo.version;
});

