const { BaseAgent } = require('./BaseAgent.js');
const { ImageGenerator } = require('../lib/ImageGenerator.js');

/**
 * Image Generation Agent
 * Generates custom images using AI prompts and shares them across the multi-agent system
 */
class ImageGenerationAgent extends BaseAgent {
    constructor() {
        super('image_generator', ['image_generation', 'visual_assets']);
        this.imageGenerator = new ImageGenerator();
        console.log('✅ ImageGenerationAgent initialized with ImageGenerator');
    }

    async handleMessage(message, context = {}) {
        console.log('🖼️ ImageGenerationAgent processing request:', message.substring(0, 100) + '...');
        
        try {
            // Extract image generation parameters from the message
            const params = this.extractImageParams(message, context);
            
            // Generate the image
            const result = await this.imageGenerator.generateImage(params);
            
            console.log('✅ Image generated successfully:', result.fileName);
            
            return {
                success: true,
                image: {
                    success: true,
                    imagePath: result.imagePath,
                    imageUrl: result.imageUrl,
                    fileName: result.fileName,
                    prompt: result.prompt,
                    style: result.style,
                    dimensions: result.dimensions,
                    fileSize: result.fileSize,
                    metadata: {
                        prompt: result.prompt,
                        style: result.style,
                        dimensions: result.dimensions,
                        quality: result.quality,
                        generatedAt: new Date().toISOString()
                    }
                },
                workflow: 'image_generation',
                metadata: {
                    prompt: result.prompt,
                    style: result.style,
                    dimensions: result.dimensions,
                    quality: result.quality
                },
                message: `Generated ${result.dimensions} image: "${result.prompt}"`
            };
            
        } catch (error) {
            console.error('❌ ImageGenerationAgent execution failed:', error);
            return {
                success: false,
                error: `Image generation failed: ${error.message}`,
                message: `Image generation failed: ${error.message}`
            };
        }
    }

    /**
     * Extract image generation parameters from the message and context
     */
    extractImageParams(message, context) {
        // Default parameters
        let params = {
            prompt: 'A stunning Chicago skyline at sunset with modern skyscrapers',
            style: 'realistic',
            width: 1024,
            height: 1024,
            quality: 'standard'
        };

        // Extract prompt from message
        if (message.toLowerCase().includes('chicago skyline')) {
            params.prompt = 'A stunning Chicago skyline at sunset with modern skyscrapers, dramatic lighting, and urban architecture';
        } else if (message.toLowerCase().includes('abstract')) {
            params.prompt = 'Abstract electronic music visualizer with neon colors and geometric patterns';
            params.style = 'abstract';
        } else if (message.toLowerCase().includes('cyberpunk')) {
            params.prompt = 'Cyberpunk cityscape with glowing neon lights and futuristic architecture';
            params.style = 'cyberpunk';
        } else if (message.toLowerCase().includes('minimalist')) {
            params.prompt = 'Minimalist DJ setup with clean geometric patterns and subtle lighting';
            params.style = 'minimalist';
        } else {
            // Try to extract a custom prompt from the message
            const promptMatch = message.match(/(?:generate|create|make).*?(?:image|picture|visual).*?["""]([^"""]+)["""]/i);
            if (promptMatch) {
                params.prompt = promptMatch[1];
            } else {
                // Look for descriptive text after keywords
                const keywords = ['image', 'picture', 'visual', 'background', 'scene'];
                for (const keyword of keywords) {
                    const index = message.toLowerCase().indexOf(keyword);
                    if (index !== -1) {
                        const afterKeyword = message.substring(index + keyword.length).trim();
                        if (afterKeyword.length > 10) {
                            params.prompt = afterKeyword.substring(0, 100); // Limit length
                            break;
                        }
                    }
                }
            }
        }

        // Extract style preferences
        if (message.toLowerCase().includes('artistic')) params.style = 'artistic';
        if (message.toLowerCase().includes('realistic')) params.style = 'realistic';
        if (message.toLowerCase().includes('abstract')) params.style = 'abstract';
        if (message.toLowerCase().includes('minimalist')) params.style = 'minimalist';
        if (message.toLowerCase().includes('cyberpunk')) params.style = 'cyberpunk';

        // Extract size preferences - DALL-E 3 only supports specific sizes
        if (message.toLowerCase().includes('square')) {
            params.width = 1024;
            params.height = 1024;
        } else if (message.toLowerCase().includes('widescreen') || message.toLowerCase().includes('landscape')) {
            params.width = 1792;
            params.height = 1024;
        } else if (message.toLowerCase().includes('portrait')) {
            params.width = 1024;
            params.height = 1792;
        } else if (message.toLowerCase().includes('large')) {
            params.width = 1024;
            params.height = 1024;
        }

        // Extract quality preferences
        if (message.toLowerCase().includes('high quality') || message.toLowerCase().includes('ultra')) {
            params.quality = 'high';
        } else if (message.toLowerCase().includes('standard')) {
            params.quality = 'standard';
        }

        // Override with context if provided
        if (context.imagePrompt) params.prompt = context.imagePrompt;
        if (context.imageStyle) params.style = context.imageStyle;
        if (context.imageSize) {
            // Map custom sizes to DALL-E 3 supported sizes
            const sizeMap = {
                '720x720': { width: 1024, height: 1024 },
                '1920x1080': { width: 1792, height: 1024 },
                '1080x1920': { width: 1024, height: 1792 },
                '1920x1920': { width: 1024, height: 1024 }
            };
            
            if (sizeMap[context.imageSize]) {
                params.width = sizeMap[context.imageSize].width;
                params.height = sizeMap[context.imageSize].height;
            }
        }
        if (context.imageQuality) params.quality = context.imageQuality;

        console.log('🎯 Image generation parameters:', params);
        return params;
    }
}

module.exports = { ImageGenerationAgent }; 