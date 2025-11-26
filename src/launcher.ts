/**
 * Launcher script that handles updates before starting the main app
 * This should be the entry point for the executable
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

// Get executable directory
function getAppDir(): string {
  if ('pkg' in process && (process as any).pkg !== undefined) {
    return path.dirname(process.execPath);
  }
  return process.cwd();
}

async function main() {
  const appDir = getAppDir();
  const updateScript = path.join(appDir, 'update.ps1');
  const mainExe = path.join(appDir, 'screensaver.exe');

  // Check if update script exists (from previous update)
  try {
    await fs.access(updateScript);
    console.log('Update script found. Running update...');
    
    // Run update script
    const { stdout, stderr } = await execAsync(
      `powershell -ExecutionPolicy Bypass -File "${updateScript}"`
    );
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    // Update script should restart the app, so exit
    process.exit(0);
  } catch (error: any) {
    // If update script doesn't exist or failed, just start the main app
    if (error.code === 'ENOENT') {
      // No update script, start normally
    } else {
      console.error('Update failed, starting app normally:', error.message);
    }
  }

  // Start the main application
  try {
    const args = process.argv.slice(2).join(' ');
    const command = `"${mainExe}" ${args}`;
    
    exec(command, (error) => {
      if (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Failed to launch application:', error);
    process.exit(1);
  }
}

main();


