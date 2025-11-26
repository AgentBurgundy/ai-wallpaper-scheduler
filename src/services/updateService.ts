import axios from 'axios';
import { logger } from '../logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface UpdateInfo {
  version: string;
  available: boolean;
  downloadUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
}

export class UpdateService {
  private readonly repoOwner: string;
  private readonly repoName: string;
  private readonly currentVersion: string;
  private readonly githubApiUrl: string;

  constructor(repoOwner: string, repoName: string, currentVersion: string) {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.currentVersion = currentVersion;
    this.githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
  }

  /**
   * Check for available updates on GitHub
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      logger.info('Checking for updates...');
      const response = await axios.get(this.githubApiUrl, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Screensaver-Updater',
        },
        timeout: 10000,
      });

      const latestRelease = response.data;
      const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      const isUpdateAvailable = this.isNewerVersion(latestVersion, this.currentVersion);

      logger.info(`Latest version: ${latestVersion}, Current: ${this.currentVersion}, Update available: ${isUpdateAvailable}`);

      // Find Windows ZIP asset
      const windowsAsset = latestRelease.assets?.find((asset: any) => 
        asset.name.includes('windows') && asset.name.endsWith('.zip')
      );

      return {
        version: latestVersion,
        available: isUpdateAvailable,
        downloadUrl: windowsAsset?.browser_download_url || '',
        releaseNotes: latestRelease.body || '',
        publishedAt: latestRelease.published_at,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No releases found or repo doesn't exist - this is normal for placeholder repos
        logger.debug('No releases found or repository does not exist');
        return {
          version: this.currentVersion,
          available: false,
          downloadUrl: '',
        };
      }
      // Log other errors but don't throw - let caller handle gracefully
      logger.debug('Update check failed', error);
      return {
        version: this.currentVersion,
        available: false,
        downloadUrl: '',
      };
    }
  }

  /**
   * Compare version strings (simple semantic versioning)
   * Returns true if newVersion > currentVersion
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }

    return false; // Versions are equal
  }

  /**
   * Download the update ZIP file
   */
  async downloadUpdate(downloadUrl: string, downloadPath: string): Promise<void> {
    try {
      logger.info(`Downloading update from: ${downloadUrl}`);
      
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 300000, // 5 minute timeout
      });

      // Ensure directory exists
      const dir = path.dirname(downloadPath);
      await fs.mkdir(dir, { recursive: true });

      // Download file
      const writer = createWriteStream(downloadPath);
      await pipeline(response.data, writer);
      
      logger.info(`Update downloaded to: ${downloadPath}`);
    } catch (error) {
      logger.error('Failed to download update', error);
      throw error;
    }
  }

  /**
   * Extract and install the update
   * This is a simplified version - in production you'd want more robust extraction
   */
  async installUpdate(zipPath: string, appDir: string): Promise<void> {
    try {
      logger.info(`Installing update from: ${zipPath}`);
      
      // For Windows, we'll use a PowerShell script to handle the update
      // This is safer than trying to replace a running executable
      const updateScript = this.generateUpdateScript(zipPath, appDir);
      const scriptPath = path.join(appDir, 'update.ps1');
      
      await fs.writeFile(scriptPath, updateScript, 'utf-8');
      logger.info(`Update script created: ${scriptPath}`);
      
      // Return the script path - the UI will execute it
      return;
    } catch (error) {
      logger.error('Failed to install update', error);
      throw error;
    }
  }

  /**
   * Generate a PowerShell script to handle the update
   */
  private generateUpdateScript(zipPath: string, appDir: string): string {
    // Escape paths for PowerShell
    const escapedZipPath = zipPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const escapedAppDir = appDir.replace(/\\/g, '\\\\').replace(/'/g, "''");
    
    return `# Screensaver Update Script
# This script will extract and replace the executable

Write-Host "Starting update process..."

# Wait a moment for the app to close
Start-Sleep -Seconds 2

# Extract ZIP to temp directory
$tempDir = Join-Path $env:TEMP "screensaver-update"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "Extracting update..."
$zipPath = '${escapedZipPath}'
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

# Find the executable in the extracted files
$extractedExe = Get-ChildItem -Path $tempDir -Filter "screensaver.exe" -Recurse | Select-Object -First 1

if ($extractedExe) {
    Write-Host "Replacing executable..."
    $appDir = '${escapedAppDir}'
    $targetExe = Join-Path $appDir "screensaver.exe"
    
    # Backup old executable
    if (Test-Path $targetExe) {
        $backupPath = "$targetExe.backup"
        Copy-Item $targetExe $backupPath -Force
    }
    
    # Replace executable
    Copy-Item $extractedExe.FullName $targetExe -Force
    
    Write-Host "Update complete! Restarting application..."
    
    # Restart the application
    Start-Sleep -Seconds 1
    Start-Process $targetExe
    
    # Cleanup
    Remove-Item $tempDir -Recurse -Force
    Remove-Item $zipPath -Force
    
    Write-Host "Update successful!"
} else {
    Write-Host "Error: Could not find screensaver.exe in update package"
    exit 1
}
`;
  }
}

