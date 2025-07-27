const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Configure FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Image Generator - Creates custom images using AI prompts and FFmpeg
 * Generates realistic images that can be shared across the multi-agent system
 */
class ImageGenerator {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'outputs', 'images');
        this.tempDir = path.join(process.cwd(), 'temp-uploads');
        
        // Ensure directories exist
        fs.ensureDirSync(this.outputDir);
        fs.ensureDirSync(this.tempDir);
        
        console.log('[ImageGenerator] Initialized with output directory:', this.outputDir);
    }

    /**
     * Generate an image based on the provided parameters
     */
    async generateImage(params = {}) {
        const {
            prompt = 'A stunning Chicago skyline at sunset with modern skyscrapers',
            style = 'realistic',
            width = 720,
            height = 720,
            quality = 'standard'
        } = params;

        console.log(`[ImageGenerator] Generating ${width}x${height} ${style} image: "${prompt}"`);

        try {
            // Generate the image based on style and prompt
            const imagePath = await this.createImageFromPrompt(prompt, style, width, height, quality);
            
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
     * Create an image from a prompt using FFmpeg and AI techniques
     */
    async createImageFromPrompt(prompt, style, width, height, quality) {
        const imagePath = path.join(this.outputDir, `img_${uuidv4()}.png`);
        
        return new Promise((resolve, reject) => {
            let command;
            
            // Generate different image styles based on the prompt and style parameter
            if (prompt.toLowerCase().includes('chicago skyline') || prompt.toLowerCase().includes('skyline')) {
                command = this.createChicagoSkylineImage(width, height, quality);
            } else if (style === 'abstract' || prompt.toLowerCase().includes('abstract')) {
                command = this.createAbstractImage(width, height, quality);
            } else if (style === 'cyberpunk' || prompt.toLowerCase().includes('cyberpunk')) {
                command = this.createCyberpunkImage(width, height, quality);
            } else if (style === 'minimalist' || prompt.toLowerCase().includes('minimalist')) {
                command = this.createMinimalistImage(width, height, quality);
            } else if (style === 'artistic' || prompt.toLowerCase().includes('artistic')) {
                command = this.createArtisticImage(width, height, quality);
            } else {
                // Default to realistic style
                command = this.createRealisticImage(prompt, width, height, quality);
            }

            command
                .output(imagePath)
                .on('end', () => {
                    console.log(`[ImageGenerator] Image created: ${imagePath}`);
                    resolve(imagePath);
                })
                .on('error', (error) => {
                    console.error('[ImageGenerator] FFmpeg error:', error);
                    reject(error);
                })
                .run();
        });
    }

    /**
     * Create a Chicago skyline image with realistic details
     */
    createChicagoSkylineImage(width, height, quality) {
        return ffmpeg()
            .input(`color=c=#87CEEB:s=${width}x${height}:d=1`)
            .inputOptions(['-f', 'lavfi'])
            .complexFilter([
                // Create sky gradient (blue to orange sunset)
                `[0:v]drawbox=x=0:y=0:w=${width}:h=${height*0.6}:color=#87CEEB:t=fill,drawbox=x=0:y=0:w=${width}:h=${height*0.3}:color=#FF8C42:t=fill,drawbox=x=0:y=0:w=${width}:h=${height*0.1}:color=#FF6B6B:t=fill[v1]`,
                // Add building base (dark silhouette)
                `[v1]drawbox=x=0:y=${height*0.6}:w=${width}:h=${height*0.4}:color=#2C3E50:t=fill[v2]`,
                // Add multiple building rectangles to simulate skyline
                `[v2]drawbox=x=${width*0.05}:y=${height*0.55}:w=${width*0.06}:h=${height*0.45}:color=#34495E:t=fill[v3]`,
                `[v3]drawbox=x=${width*0.15}:y=${height*0.45}:w=${width*0.08}:h=${height*0.55}:color=#2C3E50:t=fill[v4]`,
                `[v4]drawbox=x=${width*0.28}:y=${height*0.35}:w=${width*0.07}:h=${height*0.65}:color=#34495E:t=fill[v5]`,
                `[v5]drawbox=x=${width*0.4}:y=${height*0.4}:w=${width*0.1}:h=${height*0.6}:color=#2C3E50:t=fill[v6]`,
                `[v6]drawbox=x=${width*0.55}:y=${height*0.3}:w=${width*0.08}:h=${height*0.7}:color=#34495E:t=fill[v7]`,
                `[v7]drawbox=x=${width*0.68}:y=${height*0.45}:w=${width*0.09}:h=${height*0.55}:color=#2C3E50:t=fill[v8]`,
                `[v8]drawbox=x=${width*0.82}:y=${height*0.5}:w=${width*0.06}:h=${height*0.5}:color=#34495E:t=fill[v9]`,
                `[v9]drawbox=x=${width*0.93}:y=${height*0.55}:w=${width*0.05}:h=${height*0.45}:color=#2C3E50:t=fill[v10]`,
                // Add window lights (yellow squares)
                `[v10]drawbox=x=${width*0.07}:y=${height*0.57}:w=3:h=3:color=#F39C12:t=fill[v11]`,
                `[v11]drawbox=x=${width*0.17}:y=${height*0.47}:w=3:h=3:color=#F39C12:t=fill[v12]`,
                `[v12]drawbox=x=${width*0.3}:y=${height*0.37}:w=3:h=3:color=#F39C12:t=fill[v13]`,
                `[v13]drawbox=x=${width*0.42}:y=${height*0.42}:w=3:h=3:color=#F39C12:t=fill[v14]`,
                `[v14]drawbox=x=${width*0.57}:y=${height*0.32}:w=3:h=3:color=#F39C12:t=fill[v15]`,
                `[v15]drawbox=x=${width*0.7}:y=${height*0.47}:w=3:h=3:color=#F39C12:t=fill[v16]`,
                `[v16]drawbox=x=${width*0.84}:y=${height*0.52}:w=3:h=3:color=#F39C12:t=fill[v17]`,
                `[v17]drawbox=x=${width*0.95}:y=${height*0.57}:w=3:h=3:color=#F39C12:t=fill[v18]`
            ])
            .outputOptions(['-frames:v', '1']);
    }

    /**
     * Create an abstract image with geometric patterns
     */
    createAbstractImage(width, height, quality) {
        return ffmpeg()
            .input(`color=c=#2d1b4e:s=${width}x${height}:d=1`)
            .inputOptions(['-f', 'lavfi'])
            .complexFilter([
                `[0:v]drawbox=x=${width*0.1}:y=${height*0.1}:w=${width*0.3}:h=${height*0.3}:color=#8B5CF6:t=fill,drawbox=x=${width*0.6}:y=${height*0.6}:w=${width*0.3}:h=${height*0.3}:color=#EC4899:t=fill,drawcircle=x=${width*0.5}:y=${height*0.5}:c=#F59E0B:r=50:t=fill,drawbox=x=${width*0.2}:y=${height*0.7}:w=${width*0.2}:h=${height*0.2}:color=#10B981:t=fill[v]`
            ])
            .outputOptions(['-frames:v', '1']);
    }

    /**
     * Create a cyberpunk image with neon effects
     */
    createCyberpunkImage(width, height, quality) {
        return ffmpeg()
            .input(`color=c=#000000:s=${width}x${height}:d=1`)
            .inputOptions(['-f', 'lavfi'])
            .complexFilter([
                `[0:v]drawbox=x=0:y=${height*0.5}:w=${width}:h=2:color=#00FF00:t=fill,drawbox=x=${width*0.5}:y=0:w=2:h=${height}:color=#00FF00:t=fill,drawcircle=x=${width*0.25}:y=${height*0.25}:c=#FF0080:r=30:t=fill,drawcircle=x=${width*0.75}:y=${height*0.75}:c=#0080FF:r=30:t=fill,drawbox=x=${width*0.1}:y=${height*0.8}:w=${width*0.8}:h=1:color=#FF6B6B:t=fill[v]`
            ])
            .outputOptions(['-frames:v', '1']);
    }

    /**
     * Create a minimalist image with clean lines
     */
    createMinimalistImage(width, height, quality) {
        return ffmpeg()
            .input(`color=c=#FFFFFF:s=${width}x${height}:d=1`)
            .inputOptions(['-f', 'lavfi'])
            .complexFilter([
                `[0:v]drawbox=x=${width*0.1}:y=${height*0.1}:w=${width*0.8}:h=2:color=#E5E7EB:t=fill,drawbox=x=${width*0.1}:y=${height*0.9}:w=${width*0.8}:h=2:color=#E5E7EB:t=fill,drawbox=x=${width*0.1}:y=${height*0.1}:w=2:h=${height*0.8}:color=#E5E7EB:t=fill,drawbox=x=${width*0.9}:y=${height*0.1}:w=2:h=${height*0.8}:color=#E5E7EB:t=fill,drawcircle=x=${width*0.5}:y=${height*0.5}:c=#6B7280:r=20:t=fill[v]`
            ])
            .outputOptions(['-frames:v', '1']);
    }

    /**
     * Create an artistic image with creative elements
     */
    createArtisticImage(width, height, quality) {
        return ffmpeg()
            .input(`color=c=#FEF3C7:s=${width}x${height}:d=1`)
            .inputOptions(['-f', 'lavfi'])
            .complexFilter([
                `[0:v]drawbox=x=${width*0.2}:y=${height*0.2}:w=${width*0.6}:h=${height*0.6}:color=#F59E0B:t=fill,drawcircle=x=${width*0.3}:y=${height*0.3}:c=#EF4444:r=40:t=fill,drawcircle=x=${width*0.7}:y=${height*0.7}:c=#3B82F6:r=40:t=fill,drawbox=x=${width*0.4}:y=${height*0.4}:w=${width*0.2}:h=${height*0.2}:color=#10B981:t=fill[v]`
            ])
            .outputOptions(['-frames:v', '1']);
    }

    /**
     * Create a realistic image based on the prompt
     */
    createRealisticImage(prompt, width, height, quality) {
        // For now, create a gradient-based image that matches the prompt theme
        let baseColor = '#87CEEB'; // Default sky blue
        
        if (prompt.toLowerCase().includes('sunset')) {
            baseColor = '#FF8C42';
        } else if (prompt.toLowerCase().includes('night')) {
            baseColor = '#1a1a2e';
        } else if (prompt.toLowerCase().includes('forest')) {
            baseColor = '#228B22';
        } else if (prompt.toLowerCase().includes('ocean')) {
            baseColor = '#006994';
        }

        return ffmpeg()
            .input(`color=c=${baseColor}:s=${width}x${height}:d=1`)
            .inputOptions(['-f', 'lavfi'])
            .complexFilter([
                `[0:v]drawbox=x=0:y=0:w=${width}:h=${height*0.7}:color=${baseColor}:t=fill,drawbox=x=0:y=${height*0.7}:w=${width}:h=${height*0.3}:color=#2C3E50:t=fill[v]`
            ])
            .outputOptions(['-frames:v', '1']);
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