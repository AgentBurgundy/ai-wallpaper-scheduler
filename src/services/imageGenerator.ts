import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface ImageGenerationResponse {
  imageUrl?: string;
  imageData?: string; // base64 encoded image
  imagePath?: string; // local file path if saved
}

export class ImageGenerator {
  private genAI: GoogleGenAI;
  private imagesDir: string;
  private modelName: string;

  constructor() {
    if (!config.google.apiKey) {
      throw new Error('Google API key is not configured. Please set GOOGLE_API_KEY in your .env file or use the Settings UI.');
    }
    
    // Initialize Google Generative AI SDK
    this.genAI = new GoogleGenAI({ apiKey: config.google.apiKey });
    
    // Determine model name from config URL or use latest high-res model
    // Extract model name from URL if present, otherwise use default
    const urlMatch = config.google.apiUrl.match(/models\/([^:]+)/);
    if (urlMatch) {
      let extractedModel = urlMatch[1];
      // If the URL contains the old gemini-2.5-flash-image model, upgrade to Gemini 3 Pro Image Preview for high-res support
      if (extractedModel.includes('gemini-2.5-flash-image') || extractedModel.includes('flash-image')) {
        logger.info(`Upgrading from ${extractedModel} to gemini-3-pro-image-preview for high-resolution support`);
        this.modelName = 'gemini-3-pro-image-preview';
      } else if (extractedModel.includes('gemini-3-pro') && !extractedModel.includes('image')) {
        // Upgrade gemini-3-pro or gemini-3-pro-preview to gemini-3-pro-image-preview
        logger.info(`Upgrading from ${extractedModel} to gemini-3-pro-image-preview`);
        this.modelName = 'gemini-3-pro-image-preview';
      } else {
        this.modelName = extractedModel;
      }
    } else {
      // Default to Gemini 3 Pro Image Preview for high-resolution support (2K/4K)
      this.modelName = 'gemini-3-pro-image-preview';
    }
    
    this.imagesDir = config.app.imagesDir;
    logger.info(`Initialized ImageGenerator with model: ${this.modelName}`);
  }

  /**
   * Ensure the images directory exists
   */
  private async ensureImagesDir(): Promise<void> {
    try {
      await fs.mkdir(this.imagesDir, { recursive: true });
      logger.debug(`Images directory ensured: ${this.imagesDir}`);
    } catch (error) {
      logger.error('Failed to create images directory', error);
      throw error;
    }
  }

  /**
   * Generate an image using Google Gemini API with @google/genai SDK
   * Supports high-resolution images (1K, 2K, 4K) with Gemini 3 Pro Image Preview
   * @param prompt - The text prompt for image generation
   * @returns The path to the saved image file
   */
  async generateImage(prompt: string): Promise<string> {
    try {
      await this.ensureImagesDir();
      logger.info(`Generating image with prompt: ${prompt}`);

      // Enhanced prompt for wallpaper generation
      const enhancedPrompt = `Create a stunning desktop wallpaper image. ${prompt}. 
Style: High quality, photorealistic or artistic, cinematic composition, beautiful lighting.`;

      // Get aspect ratio and image size from config
      const aspectRatio = config.app.aspectRatio || '16:9';
      const imageSize = config.app.imageSize || '1K';
      logger.info(`Using aspect ratio: ${aspectRatio}, image size: ${imageSize}, model: ${this.modelName}`);

      logger.debug('Generating image with config', {
        model: this.modelName,
        aspectRatio,
        imageSize,
        promptLength: prompt.length,
      });

      // Try generateImages first (for Imagen models and newer Gemini models)
      // If that fails, fall back to generateContent with imageConfig
      try {
        // Check if model supports generateImages (Gemini 3 Pro, Imagen models)
        // For Gemini 3 Pro, we can use generateImages for 1K/2K, or generateContent for 4K
        const generateImagesConfig: any = {
          aspectRatio: aspectRatio as '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
          numberOfImages: 1,
        };
        
        // generateImages API supports 1K and 2K, but not 4K
        // For 4K, we'll fall through to generateContent method
        if (imageSize === '1K' || imageSize === '2K') {
          generateImagesConfig.imageSize = imageSize as '1K' | '2K';
        } else if (imageSize === '4K') {
          // Skip generateImages for 4K, will use generateContent instead
          throw new Error('generateImages does not support 4K, using generateContent');
        }
        
        const response = await this.genAI.models.generateImages({
          model: this.modelName,
          prompt: enhancedPrompt,
          config: generateImagesConfig,
        });

        // Extract image from generateImages response
        if (response.generatedImages && response.generatedImages.length > 0) {
          const generatedImage = response.generatedImages[0];
          if (generatedImage.image?.imageBytes) {
            const imageBytes = generatedImage.image.imageBytes;
            const mimeType = generatedImage.image.mimeType || 'image/png';
            
            logger.info('Found image bytes in generateImages response', { 
              mimeType,
              dataLength: imageBytes.length 
            });
            
            // imageBytes is already a Buffer or Uint8Array, convert to base64 if needed
            const base64Data = Buffer.from(imageBytes).toString('base64');
            return await this.saveBase64Image(base64Data, prompt, mimeType);
          }
        }
        
        throw new Error('No image data in generateImages response');
      } catch (generateImagesError: unknown) {
        // Fall back to generateContent with imageConfig for Gemini models
        logger.debug('generateImages failed, trying generateContent with imageConfig', {
          error: generateImagesError instanceof Error ? generateImagesError.message : String(generateImagesError),
        });

        // Prepare generation config for image generation via generateContent
        // Gemini 3 Pro Image Preview supports 1K, 2K, and 4K resolutions
        const generationConfig: any = {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        };

        // Add imageSize for Gemini 3 Pro Image Preview (supports 2K and 4K)
        if (this.modelName.includes('gemini-3') && this.modelName.includes('pro') && this.modelName.includes('image')) {
          generationConfig.imageConfig.imageSize = imageSize; // '1K', '2K', or '4K'
          logger.info(`Using high-resolution mode: ${imageSize}`);
        } else if (imageSize !== '1K') {
          logger.warn(`Model ${this.modelName} only supports 1K resolution. For ${imageSize}, use Gemini 3 Pro Image Preview model.`);
        }

        // Generate content with image generation config
        const response = await this.genAI.models.generateContent({
          model: this.modelName,
          contents: enhancedPrompt,
          config: generationConfig,
        });

        // Extract image data from response
        // The SDK returns candidates with inlineData
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('No candidates returned from API');
        }

        const candidate = candidates[0];
        const parts = candidate.content?.parts;
        
        if (!parts || parts.length === 0) {
          throw new Error('No content parts in response');
        }

        // Find image data in parts
        for (const part of parts) {
          // Check for inline data (base64 image)
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const base64Data = part.inlineData.data;
            
            if (!base64Data) {
              logger.warn('inlineData found but data is undefined');
              continue;
            }
            
            logger.info('Found inline image data in response', { 
              mimeType,
              dataLength: base64Data.length 
            });
            return await this.saveBase64Image(base64Data, prompt, mimeType);
          }
          
          // Check for file data URI (if API returns a file reference)
          if (part.fileData?.fileUri) {
            logger.info('Found file data URI in response', { uri: part.fileData.fileUri });
            return await this.downloadImageFromUrl(part.fileData.fileUri);
          }
        }

        // If we get here, no image data was found
        logger.error('Unexpected API response format', {
          candidatesCount: candidates.length,
          partsCount: parts.length,
          partTypes: parts.map((p: any) => Object.keys(p)),
        });
        throw new Error('Unexpected API response format. No image data found in response.');
      }
    } catch (err: unknown) {
      logger.error('Failed to generate image', err);
      
      // Handle SDK-specific errors
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        
        if (errorMessage.includes('api key') || errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
          throw new Error('Invalid API key. Please check your GOOGLE_API_KEY in settings.');
        } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          throw new Error(`Model ${this.modelName} not found. Please check your model configuration.`);
        } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
          throw new Error('API quota exceeded or rate limit reached. Please try again later.');
        } else if (errorMessage.includes('invalid') || errorMessage.includes('400')) {
          throw new Error(`Invalid request: ${err.message}`);
        }
      }
      
      throw err;
    }
  }

  /**
   * Download image from URL and save locally
   */
  private async downloadImageFromUrl(imageUrl: string): Promise<string> {
    logger.info(`Downloading image from URL: ${imageUrl}`);
    
    // Use fetch API instead of axios
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Determine file extension from content type or URL
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' :
                        contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
                        contentType.includes('webp') ? 'webp' : 'jpg';
      
      const filename = this.generateFilename(extension);
      const filepath = path.join(this.imagesDir, filename);
      await fs.writeFile(filepath, buffer);
      
      logger.info(`Image saved to: ${filepath}`, { size: buffer.length, extension });
      return filepath;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Save base64 encoded image
   * Note: We don't crop/resize because the Gemini model generates 1024x1024 images
   * and upscaling would make them blurry. Windows wallpaper "Fill" mode handles this better.
   */
  private async saveBase64Image(base64Data: string, prompt: string, mimeType: string = 'image/png'): Promise<string> {
    logger.info('Saving base64 encoded image', { mimeType });
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');

    // Determine file extension from mime type
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 
                     mimeType.includes('png') ? 'png' : 
                     mimeType.includes('webp') ? 'webp' : 'jpg';
    
    const filename = this.generateFilename(extension);
    const filepath = path.join(this.imagesDir, filename);
    await fs.writeFile(filepath, buffer);
    
    logger.info(`Image saved to: ${filepath}`, { size: buffer.length, extension });
    return filepath;
  }
  
  /**
   * Get the images directory path
   */
  getImagesDir(): string {
    return this.imagesDir;
  }

  /**
   * Generate a unique filename with timestamp
   */
  private generateFilename(extension: string = 'jpg'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `wallpaper-${timestamp}.${extension}`;
  }
}
