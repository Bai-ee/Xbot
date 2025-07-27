const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

/**
 * Image Generator - Creates custom images using OpenAI DALL-E API
 * Generates realistic images that can be shared across the multi-agent system
 */
class ImageGenerator {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'outputs', 'images');
        this.tempDir = path.join(process.cwd(), 'temp-uploads');
        
        // Ensure directories exist
        fs.ensureDirSync(this.outputDir);
        fs.ensureDirSync(this.tempDir);
        
        // Initialize OpenAI client
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        console.log('[ImageGenerator] Initialized with OpenAI DALL-E API');
    }

    /**
     * Generate an image based on the provided parameters using OpenAI DALL-E
     */
    async generateImage(params = {}) {
        const {
            prompt = 'A stunning Chicago skyline at sunset with modern skyscrapers',
            style = 'realistic',
            width = 1024,
            height = 1024,
            quality = 'standard'
        } = params;

        console.log(`[ImageGenerator] Generating ${width}x${height} ${style} image: "${prompt}"`);

        try {
            // Generate the image using OpenAI DALL-E
            const imagePath = await this.createImageWithOpenAI(prompt, style, width, height, quality);
            
            // Get file stats
            const stats = fs.statSync(imagePath);
            const fileSize = this.formatFileSize(stats.size);
            
            // Create URL for web access
            const fileName = path.basename(imagePath);
            const imageUrl = `/outputs/images/${fileName}`;
            
            console.log(`[ImageGenerator] ✅ Image generated: ${fileName} (${fileSize})`);

            return {
                imagePath,
                imageUrl,
                fileName,
                prompt,
                style,
                dimensions: `${width}x${height}`,
                fileSize,
                quality,
                metadata: {
                    prompt,
                    style,
                    dimensions: `${width}x${height}`,
                    quality,
                    generatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('[ImageGenerator] Error generating image:', error);
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }

    /**
     * Create an image using OpenAI DALL-E API
     */
    async createImageWithOpenAI(prompt, style, width, height, quality) {
        const imagePath = path.join(this.outputDir, `img_${uuidv4()}.png`);
        
        try {
            // Enhance prompt based on style
            let enhancedPrompt = prompt;
            if (style === 'artistic') {
                enhancedPrompt = `Artistic interpretation of: ${prompt}`;
            } else if (style === 'abstract') {
                enhancedPrompt = `Abstract representation of: ${prompt}`;
            } else if (style === 'cyberpunk') {
                enhancedPrompt = `Cyberpunk style: ${prompt}`;
            } else if (style === 'minimalist') {
                enhancedPrompt = `Minimalist design: ${prompt}`;
            }

            console.log(`[ImageGenerator] Calling OpenAI DALL-E with prompt: "${enhancedPrompt}"`);

            // Call OpenAI DALL-E API
            const response = await this.openai.images.generate({
                model: "dall-e-3",
                prompt: enhancedPrompt,
                size: `${width}x${height}`,
                quality: quality === 'high' ? 'hd' : 'standard',
                n: 1,
            });

            if (response.data && response.data[0] && response.data[0].url) {
                // Download the image
                const imageUrl = response.data[0].url;
                await this.downloadImage(imageUrl, imagePath);
                console.log(`[ImageGenerator] Image downloaded to: ${imagePath}`);
                return imagePath;
            } else {
                throw new Error('No image URL received from OpenAI');
            }

        } catch (error) {
            console.error('[ImageGenerator] OpenAI API error:', error);
            throw new Error(`OpenAI image generation failed: ${error.message}`);
        }
    }

    /**
     * Download image from URL to local file
     */
    async downloadImage(imageUrl, outputPath) {
        const https = require('https');
        const http = require('http');
        
        return new Promise((resolve, reject) => {
            const protocol = imageUrl.startsWith('https:') ? https : http;
            
            const request = protocol.get(imageUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download image: ${response.statusCode}`));
                    return;
                }

                const fileStream = fs.createWriteStream(outputPath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(outputPath);
                });

                fileStream.on('error', (error) => {
                    fs.unlink(outputPath, () => {}); // Delete file on error
                    reject(error);
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get all generated images
     */
    async getImageHistory() {
        try {
            const files = await fs.readdir(this.outputDir);
            const imageFiles = files.filter(file => 
                file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
            );
            
            const images = [];
            for (const file of imageFiles) {
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);
                images.push({
                    fileName: file,
                    filePath,
                    fileUrl: `/outputs/images/${file}`,
                    fileSize: this.formatFileSize(stats.size),
                    createdAt: stats.birthtime
                });
            }
            
            return images.sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            console.error('[ImageGenerator] Error getting image history:', error);
            return [];
        }
    }

    /**
     * Clean up old image files
     */
    async cleanupOldImages(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        try {
            const files = await fs.readdir(this.outputDir);
            const now = Date.now();
            let cleanedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);
                const age = now - stats.birthtime.getTime();
                
                if (age > maxAge) {
                    await fs.remove(filePath);
                    cleanedCount++;
                }
            }
            
            console.log(`[ImageGenerator] Cleaned up ${cleanedCount} old image files`);
            return cleanedCount;
        } catch (error) {
            console.error('[ImageGenerator] Error cleaning up images:', error);
            return 0;
        }
    }
}

module.exports = { ImageGenerator }; 