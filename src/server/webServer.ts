import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { UpdateService } from '../services/updateService.js';
import { logger } from '../logger.js';
import * as fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebServer {
  private server: ReturnType<typeof createServer> | null = null;
  private updateService: UpdateService;
  private port: number;
  private appDir: string;

  constructor(port: number = 8765, repoOwner: string, repoName: string, currentVersion: string) {
    this.port = port;
    this.updateService = new UpdateService(repoOwner, repoName, currentVersion);
    
    // Get app directory (works in both normal and pkg environments)
    if ('pkg' in process && (process as any).pkg !== undefined) {
      this.appDir = path.dirname(process.execPath);
    } else {
      this.appDir = path.resolve(__dirname, '..', '..');
    }
  }

  /**
   * Start the web server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (error) {
          logger.error('Server error', error);
          this.sendError(res, 500, 'Internal server error');
        }
      });

      this.server.listen(this.port, () => {
        logger.info(`Web server started on http://localhost:${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        logger.error('Server error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the web server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info('Web server stopped');
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Routes
    if (pathname === '/' || pathname === '/index.html') {
      await this.serveUI(res);
    } else if (pathname === '/api/check-update') {
      await this.handleCheckUpdate(res);
    } else if (pathname === '/api/update' && req.method === 'POST') {
      await this.handleUpdate(req, res);
    } else if (pathname === '/api/version') {
      await this.handleVersion(res);
    } else {
      this.sendError(res, 404, 'Not found');
    }
  }

  /**
   * Serve the web UI
   */
  private async serveUI(res: ServerResponse): Promise<void> {
    const html = await this.getUIHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Get the UI HTML content
   */
  private async getUIHTML(): Promise<string> {
    // Try to read from file, fallback to embedded HTML
    try {
      const uiPath = path.join(this.appDir, 'ui', 'index.html');
      return await fs.readFile(uiPath, 'utf-8');
    } catch {
      // Return embedded HTML if file doesn't exist
      return this.getEmbeddedHTML();
    }
  }

  /**
   * Embedded HTML UI (fallback)
   */
  private getEmbeddedHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screensaver - Update Center</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-card: rgba(18, 18, 26, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-primary: #f0f0f5;
            --text-secondary: #8888a0;
            --accent-cyan: #00d4ff;
            --accent-purple: #a855f7;
            --accent-pink: #ec4899;
            --accent-green: #22c55e;
            --accent-orange: #f97316;
            --accent-red: #ef4444;
            --glow-cyan: rgba(0, 212, 255, 0.4);
            --glow-purple: rgba(168, 85, 247, 0.4);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow: hidden;
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
                radial-gradient(ellipse 80% 50% at 20% 40%, rgba(0, 212, 255, 0.15), transparent),
                radial-gradient(ellipse 60% 40% at 80% 60%, rgba(168, 85, 247, 0.12), transparent),
                radial-gradient(ellipse 50% 30% at 50% 80%, rgba(236, 72, 153, 0.1), transparent);
            animation: gradientShift 15s ease-in-out infinite;
            z-index: 0;
        }

        @keyframes gradientShift {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
        }

        /* Floating orbs */
        .orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.5;
            animation: float 20s ease-in-out infinite;
            z-index: 0;
        }

        .orb-1 {
            width: 300px;
            height: 300px;
            background: var(--accent-cyan);
            top: -100px;
            left: -100px;
            animation-delay: 0s;
        }

        .orb-2 {
            width: 250px;
            height: 250px;
            background: var(--accent-purple);
            bottom: -80px;
            right: -80px;
            animation-delay: -7s;
        }

        .orb-3 {
            width: 200px;
            height: 200px;
            background: var(--accent-pink);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            animation-delay: -14s;
        }

        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(30px, -30px) scale(1.05); }
            50% { transform: translate(-20px, 20px) scale(0.95); }
            75% { transform: translate(-30px, -20px) scale(1.02); }
        }

        /* Grid pattern overlay */
        .grid-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
            background-size: 50px 50px;
            z-index: 0;
        }

        .container {
            position: relative;
            z-index: 1;
            background: var(--bg-card);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 48px;
            max-width: 480px;
            width: 100%;
            box-shadow: 
                0 0 0 1px rgba(255, 255, 255, 0.05) inset,
                0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 100px -20px var(--glow-cyan);
            animation: cardAppear 0.6s ease-out;
        }

        @keyframes cardAppear {
            0% { 
                opacity: 0; 
                transform: translateY(30px) scale(0.95); 
            }
            100% { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }

        .logo-section {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 32px;
        }

        .logo-icon {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 8px 32px var(--glow-cyan);
            animation: logoPulse 3s ease-in-out infinite;
        }

        @keyframes logoPulse {
            0%, 100% { box-shadow: 0 8px 32px var(--glow-cyan); }
            50% { box-shadow: 0 8px 48px var(--glow-purple); }
        }

        .logo-text h1 {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.5px;
        }

        .logo-text .subtitle {
            font-size: 14px;
            color: var(--text-secondary);
            font-weight: 400;
            margin-top: 2px;
        }

        .status {
            padding: 16px 20px;
            border-radius: 12px;
            margin-bottom: 24px;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            border: 1px solid transparent;
            transition: all 0.3s ease;
        }

        .status::before {
            content: '';
            width: 10px;
            height: 10px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .status.checking {
            background: rgba(0, 212, 255, 0.1);
            border-color: rgba(0, 212, 255, 0.2);
            color: var(--accent-cyan);
        }
        .status.checking::before {
            background: var(--accent-cyan);
            animation: pulse 1.5s ease-in-out infinite;
        }

        .status.up-to-date {
            background: rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.2);
            color: var(--accent-green);
        }
        .status.up-to-date::before {
            background: var(--accent-green);
        }

        .status.update-available {
            background: rgba(249, 115, 22, 0.1);
            border-color: rgba(249, 115, 22, 0.2);
            color: var(--accent-orange);
        }
        .status.update-available::before {
            background: var(--accent-orange);
            animation: pulse 2s ease-in-out infinite;
        }

        .status.error {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.2);
            color: var(--accent-red);
        }
        .status.error::before {
            background: var(--accent-red);
        }

        .status.updating {
            background: rgba(168, 85, 247, 0.1);
            border-color: rgba(168, 85, 247, 0.2);
            color: var(--accent-purple);
        }
        .status.updating::before {
            background: var(--accent-purple);
            animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }

        button {
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
            color: var(--bg-primary);
            border: none;
            padding: 16px 28px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            font-family: 'Outfit', sans-serif;
            cursor: pointer;
            width: 100%;
            margin-top: 8px;
            transition: all 0.3s ease;
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
            transition: left 0.5s ease;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px var(--glow-cyan);
        }

        button:hover::before {
            left: 100%;
        }

        button:active {
            transform: translateY(0);
        }

        button:disabled {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-secondary);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .version-info {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border-color);
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .version-item {
            text-align: center;
            padding: 16px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }

        .version-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .version-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 16px;
            font-weight: 500;
            color: var(--text-primary);
        }

        .release-notes {
            margin-top: 20px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            font-size: 13px;
            font-family: 'JetBrains Mono', monospace;
            max-height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .release-notes::-webkit-scrollbar {
            width: 6px;
        }

        .release-notes::-webkit-scrollbar-track {
            background: transparent;
        }

        .release-notes::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        .release-notes::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        /* Staggered animation for children */
        .container > * {
            animation: fadeInUp 0.5s ease-out both;
        }
        .container > *:nth-child(1) { animation-delay: 0.1s; }
        .container > *:nth-child(2) { animation-delay: 0.2s; }
        .container > *:nth-child(3) { animation-delay: 0.3s; }
        .container > *:nth-child(4) { animation-delay: 0.4s; }
        .container > *:nth-child(5) { animation-delay: 0.5s; }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="grid-overlay"></div>

    <div class="container">
        <div class="logo-section">
            <div class="logo-icon">🎨</div>
            <div class="logo-text">
                <h1>Screensaver</h1>
                <p class="subtitle">Update Center</p>
            </div>
        </div>
        
        <div id="status" class="status checking">Checking for updates...</div>
        
        <button id="updateBtn" onclick="startUpdate()" style="display: none;">
            ⬇️ Download & Update
        </button>
        
        <div class="version-info">
            <div class="version-item">
                <div class="version-label">Current</div>
                <div class="version-value" id="currentVersion">—</div>
            </div>
            <div class="version-item">
                <div class="version-label">Latest</div>
                <div class="version-value" id="latestVersion">—</div>
            </div>
        </div>
        
        <div id="releaseNotes" class="release-notes" style="display: none;"></div>
    </div>

    <script>
        let updateInfo = null;

        async function checkForUpdates() {
            const statusEl = document.getElementById('status');
            const currentVersionEl = document.getElementById('currentVersion');
            const latestVersionEl = document.getElementById('latestVersion');
            const updateBtn = document.getElementById('updateBtn');
            const releaseNotesEl = document.getElementById('releaseNotes');

            try {
                // Get current version
                const versionRes = await fetch('/api/version');
                const versionData = await versionRes.json();
                currentVersionEl.textContent = 'v' + versionData.version;

                // Check for updates
                const res = await fetch('/api/check-update');
                updateInfo = await res.json();
                
                latestVersionEl.textContent = 'v' + updateInfo.version;

                if (updateInfo.available) {
                    statusEl.className = 'status update-available';
                    statusEl.textContent = 'Update available: v' + updateInfo.version;
                    updateBtn.style.display = 'block';
                    
                    if (updateInfo.releaseNotes) {
                        releaseNotesEl.textContent = updateInfo.releaseNotes;
                        releaseNotesEl.style.display = 'block';
                    }
                } else {
                    statusEl.className = 'status up-to-date';
                    statusEl.textContent = 'You\\'re running the latest version!';
                    updateBtn.style.display = 'none';
                }
            } catch (error) {
                statusEl.className = 'status error';
                statusEl.textContent = 'Failed to check for updates';
                console.error('Update check failed:', error);
            }
        }

        async function startUpdate() {
            const statusEl = document.getElementById('status');
            const updateBtn = document.getElementById('updateBtn');
            
            if (!updateInfo || !updateInfo.available) return;

            statusEl.className = 'status updating';
            statusEl.textContent = 'Downloading update...';
            updateBtn.disabled = true;
            updateBtn.textContent = '⏳ Updating...';

            try {
                const res = await fetch('/api/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ downloadUrl: updateInfo.downloadUrl })
                });

                const result = await res.json();

                if (result.success) {
                    statusEl.className = 'status up-to-date';
                    statusEl.textContent = 'Update complete! Restarting...';
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                } else {
                    throw new Error(result.error || 'Update failed');
                }
            } catch (error) {
                statusEl.className = 'status error';
                statusEl.textContent = 'Update failed: ' + error.message;
                updateBtn.disabled = false;
                updateBtn.textContent = '⬇️ Download & Update';
            }
        }

        // Check for updates on load
        checkForUpdates();
        
        // Auto-refresh every 5 minutes
        setInterval(checkForUpdates, 5 * 60 * 1000);
    </script>
</body>
</html>`;
  }

  /**
   * Handle check update API request
   */
  private async handleCheckUpdate(res: ServerResponse): Promise<void> {
    try {
      const updateInfo = await this.updateService.checkForUpdates();
      this.sendJSON(res, updateInfo);
    } catch (error) {
      logger.error('Check update failed', error);
      this.sendJSON(res, {
        version: this.updateService['currentVersion'],
        available: false,
        downloadUrl: '',
        error: 'Failed to check for updates',
      }, 500);
    }
  }

  /**
   * Handle update API request
   */
  private async handleUpdate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }

      const { downloadUrl } = JSON.parse(body);
      
      if (!downloadUrl) {
        this.sendJSON(res, { success: false, error: 'Download URL required' }, 400);
        return;
      }

      // Download update
      const downloadPath = path.join(this.appDir, 'update.zip');
      await this.updateService.downloadUpdate(downloadUrl, downloadPath);

      // Generate update script
      await this.updateService.installUpdate(downloadPath, this.appDir);

      this.sendJSON(res, { 
        success: true, 
        message: 'Update downloaded. The application will restart shortly.' 
      });
    } catch (error) {
      logger.error('Update failed', error);
      this.sendJSON(res, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Update failed' 
      }, 500);
    }
  }

  /**
   * Handle version API request
   */
  private async handleVersion(res: ServerResponse): Promise<void> {
    this.sendJSON(res, { 
      version: this.updateService['currentVersion'] 
    });
  }

  /**
   * Send JSON response
   */
  private sendJSON(res: ServerResponse, data: any, statusCode: number = 200): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Send error response
   */
  private sendError(res: ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(message);
  }
}


