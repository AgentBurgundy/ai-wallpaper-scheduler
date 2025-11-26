import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';

// Handle both ESM and bundled executable environments
function getDirname(): string {
  // In bundled executable (pkg), use process.execPath directory
  if ('pkg' in process && (process as any).pkg !== undefined) {
    return path.dirname(process.execPath);
  }
  // In ESM, use fileURLToPath
  try {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  } catch {
    // Fallback for CommonJS bundle
    return __dirname || process.cwd();
  }
}

// Get standard user data directory for persistent storage
function getUserDataDir(): string {
  const platform = process.platform;
  let userDataDir: string;
  
  if (platform === 'win32') {
    userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Screensaver');
  } else if (platform === 'darwin') {
    userDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'Screensaver');
  } else {
    userDataDir = path.join(os.homedir(), '.config', 'screensaver');
  }
  
  // Ensure directory exists (synchronously for config loading)
  if (!existsSync(userDataDir)) {
    try {
      const fs = require('fs');
      fs.mkdirSync(userDataDir, { recursive: true });
    } catch (e) {
      // Fallback to app directory if we can't create user data dir
      return appDir;
    }
  }
  
  return userDataDir;
}

const appDir = getDirname();
const userDataDir = getUserDataDir();

// Load config from user data directory first, fall back to app dir
const userEnvPath = path.join(userDataDir, '.env');
const appEnvPath = path.join(appDir, '..', '.env'); // Dev/Repo structure

// Try loading from user data dir first
if (existsSync(userEnvPath)) {
  dotenv.config({ path: userEnvPath });
} else if (existsSync(appEnvPath)) {
  // Fallback to local .env for dev
  dotenv.config({ path: appEnvPath });
} else {
  dotenv.config(); // Default location
}

export interface Config {
  google: {
    apiKey: string | undefined;
    apiUrl: string;
  };
  app: {
    imagePrompt: string;
    aspectRatio: string;
    imageSize: string;
    imagesDir: string;
    logLevel: string;
  };
  schedule: {
    time: string;
    timezone: string;
  };
}

function getEnvVar(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  if (!value && !defaultValue) {
    return undefined; // Don't throw error, return undefined
  }
  return value || defaultValue;
}

// Auto-correct old API URLs
async function correctApiUrl(url: string | undefined, defaultValue: string): Promise<string> {
  // Default to Gemini 3 Pro Image Preview for high-resolution support (2K/4K)
  const correctUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
  const rawUrl = url || defaultValue;
  
  // Fix old incorrect URLs or upgrade to Gemini 3 Pro for high-res support
  if (rawUrl.includes('nano-banana-pro') || rawUrl.includes('api.google.com') || rawUrl.includes('-exp') || 
      rawUrl.includes('gemini-2.5-flash-image') || rawUrl.includes('flash-image')) {
    // Update process.env immediately
    if (typeof process !== 'undefined' && process.env) {
      process.env.GOOGLE_API_URL = correctUrl;
    }
    
    // Try to update .env file (non-blocking, don't wait)
    try {
      // Prefer user data dir for updates
      let envPath = path.join(userDataDir, '.env');
      
      // If it doesn't exist there but exists in dev location, update dev location
      if (!existsSync(envPath) && existsSync(appEnvPath)) {
        envPath = appEnvPath;
      }

      if (existsSync(envPath)) {
        const fs = await import('fs/promises');
        let content = await fs.readFile(envPath, 'utf-8');
        // Remove old URL lines
        content = content.replace(/GOOGLE_API_URL=.*\n?/g, '');
        // Add new URL
        content += `\nGOOGLE_API_URL=${correctUrl}`;
        await fs.writeFile(envPath, content, 'utf-8');
      }
    } catch (error) {
      // Ignore errors updating .env file - config correction still works
    }
    
    return correctUrl;
  }
  
  // Use provided URL or default
  return rawUrl || correctUrl;
}

// Initialize config with corrected API URL
// Default to Gemini 3 Pro Image Preview for high-resolution support (2K/4K)
let correctedApiUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';

// Correct API URL synchronously for immediate use, then update .env file asynchronously
(function() {
  const rawUrl = getEnvVar('GOOGLE_API_URL');
  // Default to Gemini 3 Pro Image Preview for high-resolution support (2K/4K)
  const defaultValue = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
  
  if (rawUrl && (rawUrl.includes('nano-banana-pro') || rawUrl.includes('api.google.com') || rawUrl.includes('-exp'))) {
    correctedApiUrl = defaultValue;
    // Update process.env immediately
    if (typeof process !== 'undefined' && process.env) {
      process.env.GOOGLE_API_URL = defaultValue;
    }
    // Try to update .env file (non-blocking, don't wait)
    (async () => {
      try {
        const fs = await import('fs/promises');
        // Prefer user data dir for updates
        let envPath = path.join(userDataDir, '.env');
        
        // If it doesn't exist there but exists in dev location, update dev location
        if (!existsSync(envPath) && existsSync(appEnvPath)) {
          envPath = appEnvPath;
        }
        
        if (existsSync(envPath)) {
          let content = await fs.readFile(envPath, 'utf-8');
          // Remove old URL
          content = content.replace(/GOOGLE_API_URL=.*\n?/g, '');
          // Add new URL
          content += `\nGOOGLE_API_URL=${defaultValue}`;
          await fs.writeFile(envPath, content, 'utf-8');
        }
      } catch {
        // Ignore errors
      }
    })();
  } else {
    correctedApiUrl = rawUrl || defaultValue;
  }
})();

export const config: Config = {
  google: {
    apiKey: getEnvVar('GOOGLE_API_KEY'), // Optional - can be undefined
    apiUrl: correctedApiUrl,
  },
  app: {
    imagePrompt: getEnvVar('IMAGE_PROMPT', 'A beautiful serene landscape with mountains and a river at sunrise') || 'A beautiful serene landscape with mountains and a river at sunrise',
    aspectRatio: getEnvVar('ASPECT_RATIO', '16:9') || '16:9',
    imageSize: getEnvVar('IMAGE_SIZE', '1K') || '1K',
    imagesDir: (() => {
      // Always use centralized images directory in User Data
      return path.join(userDataDir, 'images');
    })(),
    logLevel: getEnvVar('LOG_LEVEL', 'info') || 'info',
  },
  schedule: {
    time: getEnvVar('SCHEDULE_TIME', '09:00') || '09:00',
    timezone: getEnvVar('TIMEZONE', 'America/New_York') || 'America/New_York',
  },
};

