import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function setup() {
  console.log('🎨 Screensaver Setup');
  console.log('===================\n');

  try {
    // Check if .env already exists
    const envPath = path.join(__dirname, '..', '.env');
    try {
      await fs.access(envPath);
      const overwrite = await question(
        '.env file already exists. Overwrite? (y/N): '
      );
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    } catch {
      // File doesn't exist, continue
    }

    console.log('\n📝 Configuration Setup\n');

    // Get API key
    const apiKey = await question('Enter your Google API key: ');
    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ API key is required!');
      rl.close();
      process.exit(1);
    }

    // Get API URL (optional)
    const apiUrl = await question(
      'Enter API URL (press Enter for default): '
    ) || 'https://api.google.com/nano-banana-pro/generate';

    // Get image prompt
    const imagePrompt = await question(
      'Enter image generation prompt (press Enter for default): '
    ) || 'A beautiful serene landscape with mountains and a river at sunrise';

    // Get schedule time
    const scheduleTime = await question(
      'Enter daily schedule time (HH:MM, press Enter for 09:00): '
    ) || '09:00';

    // Get timezone
    const timezone = await question(
      'Enter timezone (press Enter for America/New_York): '
    ) || 'America/New_York';

    // Create .env content
    const envContent = `# Google API Configuration
# Get your API key from: https://aistudio.google.com/ (or your Google API provider)
GOOGLE_API_KEY=${apiKey.trim()}
GOOGLE_API_URL=${apiUrl.trim()}

# Application Configuration
IMAGE_PROMPT=${imagePrompt}
IMAGES_DIR=./images
LOG_LEVEL=info

# Scheduling Configuration (if using built-in scheduler)
SCHEDULE_TIME=${scheduleTime}
TIMEZONE=${timezone}
`;

    // Write .env file
    await fs.writeFile(envPath, envContent);
    console.log('\n✅ Configuration saved to .env file!');

    // Create images directory
    const imagesDir = path.join(__dirname, '..', 'images');
    try {
      await fs.mkdir(imagesDir, { recursive: true });
      console.log('✅ Images directory created!');
    } catch (error) {
      console.warn('⚠️  Could not create images directory:', error);
    }

    console.log('\n🎉 Setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Run: npm run build');
    console.log('  2. Run: npm start');
    console.log('  3. (Optional) Set up Windows Task Scheduler for daily updates\n');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setup();


