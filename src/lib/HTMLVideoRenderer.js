const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class HTMLVideoRenderer {
  constructor() {
    this.browser = null;
    this.outputDir = path.join(process.cwd(), 'outputs', 'renders');
    this.tempDir = path.join(process.cwd(), 'temp-uploads');
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tempDir);
    
    // Default video settings
    this.defaultSettings = {
      width: 1080,
      height: 1080,
      fps: 30,
      duration: 30,
      quality: 'high'
    };
  }

  /**
   * Initialize Puppeteer browser
   */
  async initialize() {
    if (this.browser) {
      return this.browser;
    }

    console.log('🚀 Initializing Puppeteer browser...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        defaultViewport: {
          width: this.defaultSettings.width,
          height: this.defaultSettings.height
        }
      });

      console.log('✅ Puppeteer browser initialized');
      return this.browser;
    } catch (error) {
      console.error('❌ Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  /**
   * Render HTML to static image
   */
  async renderToImage(htmlContent, options = {}) {
    const {
      width = this.defaultSettings.width,
      height = this.defaultSettings.height,
      quality = 90,
      format = 'png'
    } = options;

    const renderId = uuidv4();
    const outputPath = path.join(this.outputDir, `render_${renderId}.${format}`);

    try {
      await this.initialize();
      
      const page = await this.browser.newPage();
      await page.setViewport({ width, height });

      console.log('🎨 Rendering HTML to image...');

      // Set content and wait for any dynamic content to load
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      // Add some delay for animations to settle
      await page.waitForTimeout(1000);

      // Take screenshot
      const screenshotOptions = {
        path: outputPath,
        type: format,
        fullPage: false,
        clip: { x: 0, y: 0, width, height }
      };

      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
      }

      await page.screenshot(screenshotOptions);
      await page.close();

      console.log('✅ Image rendered successfully');

      return {
        success: true,
        imagePath: outputPath,
        width,
        height,
        format,
        size: (await fs.stat(outputPath)).size
      };

    } catch (error) {
      console.error('❌ Error rendering HTML to image:', error);
      throw new Error(`Failed to render HTML to image: ${error.message}`);
    }
  }

  /**
   * Render HTML to video frames
   */
  async renderToVideoFrames(htmlContent, options = {}) {
    const {
      width = this.defaultSettings.width,
      height = this.defaultSettings.height,
      duration = this.defaultSettings.duration,
      fps = this.defaultSettings.fps,
      animations = [],
      audioWaveform = null
    } = options;

    const renderId = uuidv4();
    const framesDir = path.join(this.tempDir, `frames_${renderId}`);
    await fs.ensureDir(framesDir);

    const totalFrames = duration * fps;
    const frameFiles = [];

    try {
      await this.initialize();
      
      const page = await this.browser.newPage();
      await page.setViewport({ width, height });

      console.log(`🎬 Rendering ${totalFrames} video frames...`);

      // Set initial content
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      // Inject animation and waveform scripts
      await this.injectAnimationScripts(page, { animations, audioWaveform });

      // Render each frame
      for (let frame = 0; frame < totalFrames; frame++) {
        const frameTime = frame / fps;
        const framePath = path.join(framesDir, `frame_${frame.toString().padStart(6, '0')}.png`);
        
        // Update animations for current time
        await this.updateFrameAnimations(page, frameTime, duration);
        
        // Small delay for DOM updates
        await page.waitForTimeout(16); // ~60fps update rate
        
        // Capture frame
        await page.screenshot({
          path: framePath,
          type: 'png',
          fullPage: false,
          clip: { x: 0, y: 0, width, height }
        });

        frameFiles.push(framePath);

        // Progress logging
        if (frame % Math.ceil(totalFrames / 10) === 0) {
          console.log(`⏳ Rendered ${frame}/${totalFrames} frames (${Math.round(frame/totalFrames*100)}%)`);
        }
      }

      await page.close();

      console.log('✅ All video frames rendered');

      return {
        success: true,
        framesDir,
        frameFiles,
        totalFrames,
        duration,
        fps,
        width,
        height
      };

    } catch (error) {
      console.error('❌ Error rendering video frames:', error);
      
      // Cleanup on error
      await this.cleanup([framesDir]);
      
      throw new Error(`Failed to render video frames: ${error.message}`);
    }
  }

  /**
   * Inject animation and visualization scripts into the page
   */
  async injectAnimationScripts(page, options = {}) {
    const { animations = [], audioWaveform = null } = options;

    await page.evaluate((animationsData, waveformData) => {
      // Global animation state
      window.videoAnimations = animationsData;
      window.audioWaveform = waveformData;
      window.currentTime = 0;

      // Animation helper functions
      window.updateAnimations = function(time, duration) {
        window.currentTime = time;
        const progress = time / duration;

        // Apply predefined animations
        window.videoAnimations.forEach(animation => {
          const element = document.querySelector(animation.selector);
          if (!element) return;

          switch (animation.type) {
            case 'fadeIn':
              element.style.opacity = Math.min(1, time / (animation.duration || 2));
              break;
            case 'slideIn':
              const slideProgress = Math.min(1, time / (animation.duration || 1));
              const translateX = (1 - slideProgress) * (animation.distance || 100);
              element.style.transform = `translateX(${translateX}px)`;
              break;
            case 'pulse':
              const pulseScale = 1 + Math.sin(time * animation.speed || 2) * (animation.amplitude || 0.1);
              element.style.transform = `scale(${pulseScale})`;
              break;
            case 'rotate':
              const rotation = (time * (animation.speed || 30)) % 360;
              element.style.transform = `rotate(${rotation}deg)`;
              break;
          }
        });

        // Update waveform visualization
        if (window.audioWaveform && window.audioWaveform.length > 0) {
          const waveformElement = document.querySelector('.waveform');
          if (waveformElement) {
            updateWaveformVisualization(waveformElement, progress);
          }
        }
      };

      // Waveform visualization
      window.updateWaveformVisualization = function(element, progress) {
        if (!window.audioWaveform) return;

        const waveformHTML = window.audioWaveform.map((amplitude, index) => {
          const barProgress = Math.max(0, progress * window.audioWaveform.length - index);
          const height = amplitude * 100 * Math.min(1, barProgress);
          const opacity = Math.min(1, barProgress);
          
          return `<div class="waveform-bar" style="height: ${height}%; opacity: ${opacity}"></div>`;
        }).join('');

        element.innerHTML = waveformHTML;
      };

    }, animations, audioWaveform);
  }

  /**
   * Update animations for current frame time
   */
  async updateFrameAnimations(page, time, duration) {
    await page.evaluate((currentTime, totalDuration) => {
      if (window.updateAnimations) {
        window.updateAnimations(currentTime, totalDuration);
      }
    }, time, duration);
  }

  /**
   * Generate enhanced HTML layout with animations
   */
  generateEnhancedLayout(data) {
    const { artistData, audioData, visuals, style = 'classic' } = data;

    const animations = this.getAnimationsForStyle(style);
    const waveformClass = style === 'enhanced' ? 'waveform' : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                width: 1080px;
                height: 1080px;
                background: ${this.generateBackground(visuals, style)};
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: 'Arial', sans-serif;
                color: white;
                overflow: hidden;
                position: relative;
            }
            
            .artist-name {
                font-size: 64px;
                font-weight: bold;
                margin-bottom: 30px;
                text-shadow: 2px 2px 8px rgba(0,0,0,0.7);
                opacity: 0;
                animation: fadeInSlide 2s ease-out forwards;
            }
            
            .mix-title {
                font-size: 42px;
                margin-bottom: 50px;
                opacity: 0.9;
                text-align: center;
                opacity: 0;
                animation: fadeInSlide 2s ease-out 0.5s forwards;
            }
            
            .logo {
                position: absolute;
                bottom: 60px;
                right: 60px;
                font-size: 28px;
                opacity: 0.8;
                animation: fadeIn 3s ease-out 1s forwards;
            }
            
            .waveform {
                position: absolute;
                bottom: 200px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: end;
                gap: 2px;
                height: 100px;
                width: 400px;
            }
            
            .waveform-bar {
                background: linear-gradient(to top, ${visuals.backgroundColor}, rgba(255,255,255,0.8));
                width: 4px;
                min-height: 2px;
                border-radius: 2px;
                transition: height 0.1s ease;
            }
            
            .pulse-bg {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: pulse 4s ease-in-out infinite;
                pointer-events: none;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeInSlide {
                from { 
                    opacity: 0; 
                    transform: translateY(30px);
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0);
                }
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 0.3; }
                50% { transform: scale(1.05); opacity: 0.1; }
            }
            
            ${this.getStyleSpecificCSS(style)}
        </style>
    </head>
    <body>
        <div class="pulse-bg"></div>
        <div class="artist-name">${artistData.artistName}</div>
        <div class="mix-title">${audioData.title}</div>
        ${style === 'enhanced' ? '<div class="waveform"></div>' : ''}
        <div class="logo">CreativeTech DJ</div>
    </body>
    </html>`;
  }

  /**
   * Generate background based on style
   */
  generateBackground(visuals, style) {
    const baseColor = visuals.backgroundColor || '#667eea';
    
    switch (style) {
      case 'modern':
        return `linear-gradient(135deg, ${baseColor} 0%, #000 100%)`;
      case 'minimal':
        return `linear-gradient(to bottom, ${baseColor}22 0%, ${baseColor}11 100%)`;
      case 'enhanced':
        return `radial-gradient(circle at 30% 70%, ${baseColor} 0%, #000 50%, ${baseColor}44 100%)`;
      default:
        return `linear-gradient(45deg, ${baseColor} 0%, #000 100%)`;
    }
  }

  /**
   * Get animations for specific style
   */
  getAnimationsForStyle(style) {
    const animations = [
      {
        selector: '.artist-name',
        type: 'fadeIn',
        duration: 2
      },
      {
        selector: '.mix-title',
        type: 'fadeIn',
        duration: 2,
        delay: 0.5
      }
    ];

    if (style === 'enhanced') {
      animations.push({
        selector: '.pulse-bg',
        type: 'pulse',
        speed: 0.5,
        amplitude: 0.1
      });
    }

    return animations;
  }

  /**
   * Get style-specific CSS
   */
  getStyleSpecificCSS(style) {
    switch (style) {
      case 'modern':
        return `
          .artist-name {
            background: linear-gradient(45deg, #fff, #ccc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
        `;
      case 'minimal':
        return `
          body { background-attachment: fixed; }
          .artist-name, .mix-title { color: #333; text-shadow: none; }
        `;
      case 'enhanced':
        return `
          body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
            pointer-events: none;
          }
        `;
      default:
        return '';
    }
  }

  /**
   * Close browser and cleanup
   */
  async cleanup(pathsToClean = []) {
    // Clean up specified paths
    for (const pathToClean of pathsToClean) {
      try {
        if (await fs.pathExists(pathToClean)) {
          await fs.remove(pathToClean);
          console.log(`🧹 Cleaned up: ${path.basename(pathToClean)}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup ${pathToClean}:`, error.message);
      }
    }
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔒 Puppeteer browser closed');
    }
  }

  /**
   * Get renderer statistics
   */
  getStats() {
    return {
      browserInitialized: !!this.browser,
      outputDir: this.outputDir,
      tempDir: this.tempDir,
      supportedFormats: ['png', 'jpeg'],
      defaultSettings: this.defaultSettings
    };
  }
}

module.exports = { HTMLVideoRenderer }; 