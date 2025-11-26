import { ImageGenerator } from './services/imageGenerator.js';
import { WallpaperService } from './services/wallpaperService.js';
import { Scheduler } from './services/scheduler.js';
import { WebServer } from './server/webServer.js';
import { logger } from './logger.js';
import { config } from './config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get package.json for version and repo info
async function getPackageInfo() {
  let appDir: string;
  if ('pkg' in process && (process as any).pkg !== undefined) {
    appDir = path.dirname(process.execPath);
  } else {
    appDir = path.resolve(__dirname, '..');
  }

  try {
    const packagePath = path.join(appDir, 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(packageContent);
  } catch {
    // Fallback values
    return {
      version: '1.0.0',
      repository: {
        url: 'https://github.com/AgentBurgundy/screensaver.git'
      }
    };
  }
}

// Extract repo owner and name from GitHub URL
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

/**
 * Main application entry point
 */
async function main() {
  try {
    logger.info('Starting Screensaver application');
    logger.info(`Configuration: ${JSON.stringify(config, null, 2)}`);

    const args = process.argv.slice(2);
    const command = args[0] || 'once';

    if (command === 'once') {
      // Run once and exit
      logger.info('Running wallpaper update once');
      const imageGenerator = new ImageGenerator();
      const wallpaperService = new WallpaperService();
      
      const imagePath = await imageGenerator.generateImage(config.app.imagePrompt);
      await wallpaperService.setWallpaper(imagePath);
      
      logger.info('Wallpaper update completed. Exiting.');
      process.exit(0);
    } else if (command === 'schedule') {
      // Run with built-in scheduler
      logger.info('Starting with built-in scheduler');
      const scheduler = new Scheduler();
      scheduler.startDailySchedule();

      // Keep process alive
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down gracefully');
        scheduler.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully');
        scheduler.stop();
        process.exit(0);
      });
    } else if (command === 'ui') {
      // Start web UI for updates
      logger.info('Starting web UI server');
      const packageInfo = await getPackageInfo();
      const repoInfo = extractRepoInfo(packageInfo.repository?.url || '');
      const webServer = new WebServer(8765, repoInfo.owner, repoInfo.name, packageInfo.version);
      
      await webServer.start();
      
      // Open browser
      const { exec } = await import('child_process');
      exec(`start http://localhost:8765`, (error) => {
        if (error) {
          logger.warn('Could not open browser automatically');
          logger.info(`Please open http://localhost:8765 in your browser`);
        }
      });

      // Keep server running
      process.on('SIGINT', () => {
        logger.info('Shutting down web server');
        webServer.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Shutting down web server');
        webServer.stop();
        process.exit(0);
      });
    } else {
      logger.error(`Unknown command: ${command}`);
      logger.info('Usage: screensaver.exe [once|schedule|ui]');
      logger.info('  once     - Update wallpaper once and exit (for Task Scheduler)');
      logger.info('  schedule - Run with built-in daily scheduler');
      logger.info('  ui       - Start web UI for checking and installing updates');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Application error', error);
    process.exit(1);
  }
}

main();

