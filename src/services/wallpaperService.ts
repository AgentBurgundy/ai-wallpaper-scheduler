import { setWallpaper as setWallpaperApi, getWallpaper } from 'wallpaper';
import { logger } from '../logger.js';
import { existsSync, copyFileSync } from 'fs';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export class WallpaperService {
  /**
   * Set the desktop wallpaper to the specified image path
   * @param imagePath - Absolute path to the image file
   */
  async setWallpaper(imagePath: string): Promise<void> {
    try {
      // Ensure absolute path
      const absolutePath = path.resolve(imagePath);

      // Verify file exists
      if (!existsSync(absolutePath)) {
        throw new Error(`Image file not found: ${absolutePath}`);
      }

      logger.info(`Setting wallpaper to: ${absolutePath}`);
      
      // Copy to a standard location that Windows can always access
      // This helps with permissions and ensures Windows can read it
      const wallpaperDir = path.join(os.homedir(), 'Pictures', 'Screensaver');
      await fs.mkdir(wallpaperDir, { recursive: true });
      const wallpaperPath = path.join(wallpaperDir, 'current-wallpaper.png');
      
      // Copy the image to the standard location
      copyFileSync(absolutePath, wallpaperPath);
      logger.info(`Copied wallpaper to: ${wallpaperPath}`);

      // Method 1: Use reg.exe to set wallpaper (most reliable on Windows)
      if (process.platform === 'win32') {
        try {
          // Set the wallpaper path in registry
          await execAsync(`reg add "HKCU\\Control Panel\\Desktop" /v Wallpaper /t REG_SZ /d "${wallpaperPath}" /f`);
          
          // Set wallpaper style (2 = Stretch, 10 = Fill, 6 = Fit, 0 = Center, 22 = Span)
          await execAsync(`reg add "HKCU\\Control Panel\\Desktop" /v WallpaperStyle /t REG_SZ /d "10" /f`);
          await execAsync(`reg add "HKCU\\Control Panel\\Desktop" /v TileWallpaper /t REG_SZ /d "0" /f`);
          
          // Force Windows to refresh the desktop using SystemParametersInfo
          const psRefresh = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
    
    public const int SPI_SETDESKWALLPAPER = 0x0014;
    public const int SPIF_UPDATEINIFILE = 0x01;
    public const int SPIF_SENDCHANGE = 0x02;
}
"@
[Wallpaper]::SystemParametersInfo([Wallpaper]::SPI_SETDESKWALLPAPER, 0, '${wallpaperPath.replace(/'/g, "''")}', [Wallpaper]::SPIF_UPDATEINIFILE -bor [Wallpaper]::SPIF_SENDCHANGE)
`;
          // Write script to temp file and execute
          const scriptPath = path.join(os.tmpdir(), 'set-wallpaper.ps1');
          await fs.writeFile(scriptPath, psRefresh, 'utf-8');
          await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
          await fs.unlink(scriptPath).catch(() => {});
          
          logger.info('Wallpaper set via registry + SystemParametersInfo successfully');
        } catch (regError) {
          logger.warn('Registry method failed, trying alternatives', regError);
          
          // Method 2: Try the wallpaper npm package
          try {
            await setWallpaperApi(wallpaperPath);
            logger.info('Wallpaper set via wallpaper package successfully');
          } catch (apiError) {
            logger.warn('Wallpaper package failed', apiError);
          }
        }
      } else {
        // Non-Windows: use the wallpaper package
        await setWallpaperApi(wallpaperPath);
        logger.info('Wallpaper set via wallpaper package successfully');
      }
    } catch (error) {
      logger.error('Failed to set wallpaper', error);
      throw error;
    }
  }

  /**
   * Get the current wallpaper path
   * @returns The current wallpaper path
   */
  async getCurrentWallpaper(): Promise<string> {
    try {
      const currentWallpaper = await getWallpaper();
      logger.debug(`Current wallpaper: ${currentWallpaper}`);
      return currentWallpaper;
    } catch (error) {
      logger.error('Failed to get current wallpaper', error);
      throw error;
    }
  }
}

