const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

class AIBackgroundGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.outputDir = path.join(process.cwd(), 'outputs', 'backgrounds');
    this.tempDir = path.join(process.cwd(), 'temp-uploads');
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tempDir);
    
    // Cache for avoiding duplicate requests
    this.cache = new Map();
    this.maxCacheSize = 50;
  }

  /**
   * Generate AI background using DALL-E
   */
  async generateBackground(options) {
    const {
      artistName,
      genre = 'electronic',
      style = 'abstract',
      mood = 'energetic',
      colors = ['blue', 'purple'],
      width = 1080,
      height = 1080,
      quality = 'hd'
    } = options;

    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('📦 Using cached AI background');
      return this.cache.get(cacheKey);
    }

    try {
      console.log('🤖 Generating AI background with DALL-E...');
      
      // Generate prompt for DALL-E
      const prompt = this.generateImagePrompt({
        artistName,
        genre,
        style,
        mood,
        colors
      });

      console.log('💭 DALL-E Prompt:', prompt);

      // Generate image with DALL-E
      const dalleResponse = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        size: quality === 'hd' ? '1024x1024' : '512x512',
        quality: quality === 'hd' ? 'hd' : 'standard',
        n: 1,
      });

      const imageUrl = dalleResponse.data[0].url;
      console.log('✅ DALL-E image generated');

      // Download and process the image
      const backgroundId = uuidv4();
      const originalPath = path.join(this.tempDir, `dalle_${backgroundId}.png`);
      const processedPath = path.join(this.outputDir, `ai_bg_${backgroundId}.png`);

      // Download image
      await this.downloadImage(imageUrl, originalPath);
      
      // Process image (resize, optimize)
      const processedImage = await this.processImage(originalPath, {
        width,
        height,
        quality: 90
      });

      // Save processed image
      await processedImage.png({ quality: 90 }).toFile(processedPath);

      // Clean up original
      await fs.remove(originalPath);

      const result = {
        success: true,
        imagePath: processedPath,
        prompt,
        width,
        height,
        fileSize: (await fs.stat(processedPath)).size,
        metadata: {
          artistName,
          genre,
          style,
          mood,
          colors,
          generatedAt: new Date().toISOString(),
          dalleModel: 'dall-e-3'
        }
      };

      // Cache result
      this.cacheResult(cacheKey, result);

      console.log('✅ AI background generated and processed');
      return result;

    } catch (error) {
      console.error('❌ AI background generation failed:', error);
      
      // Fallback to gradient background
      console.log('🔄 Falling back to gradient background...');
      return await this.generateFallbackBackground(options);
    }
  }

  /**
   * Generate enhanced prompt for DALL-E
   */
  generateImagePrompt(options) {
    const { artistName, genre, style, mood, colors } = options;

    // Base style descriptions
    const stylePrompts = {
      abstract: 'abstract digital art with flowing shapes and geometric patterns',
      futuristic: 'futuristic cyberpunk landscape with neon lights and digital elements',
      organic: 'organic fluid forms and natural textures with smooth gradients',
      geometric: 'clean geometric shapes and minimalist design patterns',
      psychedelic: 'psychedelic patterns with swirling colors and kaleidoscopic effects',
      minimal: 'minimal clean design with subtle gradients and simple forms'
    };

    // Genre-specific elements
    const genreElements = {
      electronic: 'synthesizer waves, digital frequencies, circuit patterns',
      techno: 'industrial textures, metallic surfaces, mechanical elements',
      house: 'warm gradients, smooth transitions, flowing energy',
      trance: 'ethereal lights, cosmic elements, transcendent atmosphere',
      ambient: 'soft clouds, atmospheric mist, dreamy landscapes',
      dubstep: 'sharp edges, electric sparks, high-contrast patterns',
      experimental: 'unusual textures, avant-garde forms, unexpected combinations'
    };

    // Mood descriptors
    const moodDescriptors = {
      energetic: 'vibrant, dynamic, high-energy, pulsating',
      calm: 'peaceful, serene, gentle, soothing',
      dark: 'mysterious, shadowy, deep, intense',
      uplifting: 'bright, inspiring, positive, radiant',
      intense: 'powerful, dramatic, bold, striking',
      dreamy: 'soft, ethereal, floating, magical'
    };

    // Color combinations
    const colorSchemes = {
      'blue,purple': 'deep blues and vibrant purples with electric accents',
      'red,orange': 'warm reds and burning oranges with golden highlights',
      'green,teal': 'lush greens and cool teals with natural tones',
      'pink,purple': 'soft pinks and deep purples with gradient transitions',
      'gold,black': 'luxurious gold and rich black with metallic shine',
      'white,silver': 'clean whites and metallic silver with pristine finish'
    };

    const colorKey = colors.join(',');
    const selectedColors = colorSchemes[colorKey] || `${colors.join(' and ')} tones`;

    // Construct the prompt
    const prompt = `${stylePrompts[style] || stylePrompts.abstract} inspired by ${genre} music, 
    featuring ${genreElements[genre] || genreElements.electronic}, 
    with a ${moodDescriptors[mood] || moodDescriptors.energetic} atmosphere, 
    using ${selectedColors}, 
    perfect for a music video background for DJ ${artistName}, 
    high quality digital art, professional music visualization, 
    no text or logos, suitable for video background`;

    return prompt.replace(/\s+/g, ' ').trim();
  }

  /**
   * Generate multiple background variations
   */
  async generateVariations(baseOptions, count = 3) {
    console.log(`🎨 Generating ${count} background variations...`);
    
    const variations = [];
    const styleVariations = ['abstract', 'futuristic', 'organic'];
    const moodVariations = ['energetic', 'uplifting', 'intense'];

    for (let i = 0; i < count; i++) {
      try {
        const variationOptions = {
          ...baseOptions,
          style: styleVariations[i % styleVariations.length],
          mood: moodVariations[i % moodVariations.length]
        };

        const variation = await this.generateBackground(variationOptions);
        variations.push(variation);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate variation ${i + 1}:`, error.message);
      }
    }

    return {
      success: true,
      variations,
      count: variations.length
    };
  }

  /**
   * Generate animated background sequence
   */
  async generateAnimatedBackground(options) {
    const {
      duration = 30,
      fps = 2, // Lower FPS for AI generation
      ...baseOptions
    } = options;

    const frames = Math.ceil(duration * fps);
    console.log(`🎬 Generating ${frames} animated background frames...`);

    const framePrompts = this.generateAnimationPrompts(baseOptions, frames);
    const generatedFrames = [];

    for (let i = 0; i < frames; i++) {
      try {
        console.log(`🖼️ Generating frame ${i + 1}/${frames}...`);
        
        const frameOptions = {
          ...baseOptions,
          customPrompt: framePrompts[i]
        };

        const frame = await this.generateBackground(frameOptions);
        generatedFrames.push(frame);

        // Delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn(`⚠️ Failed to generate frame ${i + 1}:`, error.message);
        // Use previous frame if available
        if (generatedFrames.length > 0) {
          generatedFrames.push(generatedFrames[generatedFrames.length - 1]);
        }
      }
    }

    return {
      success: true,
      frames: generatedFrames,
      duration,
      fps,
      totalFrames: generatedFrames.length
    };
  }

  /**
   * Generate animation prompts for sequence
   */
  generateAnimationPrompts(baseOptions, frameCount) {
    const base = this.generateImagePrompt(baseOptions);
    const prompts = [];

    for (let i = 0; i < frameCount; i++) {
      const progress = i / (frameCount - 1);
      
      // Add temporal variations
      let framePrompt = base;
      
      if (progress < 0.33) {
        framePrompt += ', emerging and growing elements, beginning phase';
      } else if (progress < 0.66) {
        framePrompt += ', peak energy and full development, climax phase';
      } else {
        framePrompt += ', settling and flowing elements, resolution phase';
      }

      prompts.push(framePrompt);
    }

    return prompts;
  }

  /**
   * Download image from URL
   */
  async downloadImage(url, outputPath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * Process image with Sharp
   */
  async processImage(inputPath, options = {}) {
    const {
      width = 1080,
      height = 1080,
      quality = 90,
      blur = 0,
      brightness = 1,
      contrast = 1
    } = options;

    let image = sharp(inputPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    // Apply filters if specified
    if (blur > 0) {
      image = image.blur(blur);
    }

    if (brightness !== 1 || contrast !== 1) {
      image = image.modulate({
        brightness: brightness,
        contrast: contrast
      });
    }

    return image;
  }

  /**
   * Generate fallback gradient background
   */
  async generateFallbackBackground(options) {
    const {
      width = 1080,
      height = 1080,
      colors = ['#667eea', '#764ba2'],
      style = 'gradient'
    } = options;

    const backgroundId = uuidv4();
    const outputPath = path.join(this.outputDir, `fallback_bg_${backgroundId}.png`);

    try {
      // Create gradient using Sharp
      const svgGradient = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${colors[1] || colors[0]};stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)" />
        </svg>
      `;

      await sharp(Buffer.from(svgGradient))
        .png()
        .toFile(outputPath);

      return {
        success: true,
        imagePath: outputPath,
        prompt: 'Fallback gradient background',
        width,
        height,
        fileSize: (await fs.stat(outputPath)).size,
        metadata: {
          type: 'fallback',
          style: 'gradient',
          colors,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Fallback background generation failed: ${error.message}`);
    }
  }

  /**
   * Generate cache key for options
   */
  generateCacheKey(options) {
    const { artistName, genre, style, mood, colors, width, height } = options;
    return `${artistName}_${genre}_${style}_${mood}_${colors.join('_')}_${width}x${height}`;
  }

  /**
   * Cache result with size limit
   */
  cacheResult(key, result) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, result);
  }

  /**
   * Clean up temporary files and cache
   */
  async cleanup() {
    try {
      // Clean up temp files older than 1 hour
      const tempFiles = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const file of tempFiles) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge && file.startsWith('dalle_')) {
          await fs.remove(filePath);
          console.log(`🗑️ Cleaned up old temp file: ${file}`);
        }
      }

      // Clear cache
      this.cache.clear();
      console.log('🧹 AI background generator cleanup completed');

    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error.message);
    }
  }

  /**
   * Get generator statistics
   */
  getStats() {
    return {
      outputDir: this.outputDir,
      tempDir: this.tempDir,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      supportedStyles: ['abstract', 'futuristic', 'organic', 'geometric', 'psychedelic', 'minimal'],
      supportedMoods: ['energetic', 'calm', 'dark', 'uplifting', 'intense', 'dreamy'],
      apiAvailable: !!process.env.OPENAI_API_KEY
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.openai.models.list();
      return {
        success: true,
        modelsAvailable: response.data.length,
        dalleAvailable: response.data.some(model => model.id.includes('dall-e'))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { AIBackgroundGenerator }; 