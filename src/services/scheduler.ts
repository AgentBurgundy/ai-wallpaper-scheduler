import { logger } from '../logger.js';
import { ImageGenerator } from './imageGenerator.js';
import { WallpaperService } from './wallpaperService.js';
import { config } from '../config.js';

export class Scheduler {
  private imageGenerator: ImageGenerator;
  private wallpaperService: WallpaperService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.imageGenerator = new ImageGenerator();
    this.wallpaperService = new WallpaperService();
  }

  /**
   * Run the wallpaper update process once
   */
  async runOnce(): Promise<void> {
    try {
      logger.info('Starting wallpaper update process');
      const prompt = config.app.imagePrompt;
      const imagePath = await this.imageGenerator.generateImage(prompt);
      await this.wallpaperService.setWallpaper(imagePath);
      logger.info('Wallpaper update completed successfully');
    } catch (error) {
      logger.error('Wallpaper update failed', error);
      throw error;
    }
  }

  /**
   * Schedule daily wallpaper updates using a simple interval
   * Note: For production, Windows Task Scheduler is recommended
   */
  startDailySchedule(): void {
    logger.info('Starting daily scheduler');
    
    // Calculate milliseconds until next scheduled time
    const [hours, minutes] = config.schedule.time.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If scheduled time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const msUntilNext = scheduledTime.getTime() - now.getTime();
    logger.info(`Next wallpaper update scheduled for: ${scheduledTime.toISOString()}`);

    // Run once immediately if scheduled time is far away
    // Otherwise wait until scheduled time
    if (msUntilNext > 3600000) { // More than 1 hour away
      this.runOnce().catch((error) => {
        logger.error('Initial wallpaper update failed', error);
      });
    }

    // Schedule daily updates (24 hours = 86400000 ms)
    const dailyInterval = 24 * 60 * 60 * 1000;
    
    setTimeout(() => {
      this.runOnce().catch((error) => {
        logger.error('Scheduled wallpaper update failed', error);
      });
      
      this.intervalId = setInterval(() => {
        this.runOnce().catch((error) => {
          logger.error('Scheduled wallpaper update failed', error);
        });
      }, dailyInterval);
    }, msUntilNext);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler stopped');
    }
  }
}


