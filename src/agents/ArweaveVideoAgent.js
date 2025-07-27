const { BaseAgent } = require('./TwitterContentAgents.js');
const openaiClient = require('../api/openaiClient.js');
const path = require('path');
const fs = require('fs-extra');

class ArweaveVideoAgent extends BaseAgent {
  constructor() {
    super('ArweaveVideoAgent', ['video_generation', 'arweave_audio', 'content_creation']);
    this.outputDir = path.join(process.cwd(), 'outputs', 'videos');
    this.tempDir = path.join(process.cwd(), 'temp-uploads');
    
    // Ensure output directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tempDir);
  }

  async handleMessage(input, context = {}) {
    console.log('🎬 ArweaveVideoAgent processing request:', input.substring(0, 100) + '...');

    // Analyze the video generation request
    const videoRequest = await this.analyzeVideoRequest(input, context);
    
    // Determine workflow steps based on request
    const workflow = this.determineVideoWorkflow(videoRequest, context);
    
    console.log('🎯 Video workflow determined:', workflow);

    // Execute the video generation workflow
    const result = await this.executeVideoWorkflow(workflow, videoRequest, context);

    return {
      type: 'video_generation',
      workflow: workflow.type,
      steps: workflow.steps,
      result: result,
      videoPath: result.videoPath || null,
      metadata: {
        agent: this.name,
        artist: result.artist || null,
        duration: result.duration || 30,
        timestamp: new Date().toISOString()
      }
    };
  }

  async analyzeVideoRequest(input, context) {
    const prompt = `Analyze this video generation request and extract key information:

Request: "${input}"

Extract and return JSON with:
- artist: specific artist name mentioned or "random" 
- duration: video length in seconds (default 30)
- style: video style preference ("classic", "modern", "minimal", etc.)
- audioSource: "arweave" or "upload" 
- customContent: any specific content to include
- urgency: "high", "medium", "low"

Example: {"artist": "random", "duration": 30, "style": "classic", "audioSource": "arweave", "customContent": null, "urgency": "medium"}`;

    try {
      const analysis = await openaiClient.runCompletion(prompt, null, {
        temperature: 0.3,
        max_tokens: 200
      });

      // Try to parse JSON response
      try {
        return JSON.parse(analysis.response);
      } catch (parseError) {
        // Fallback to defaults if JSON parsing fails
        return {
          artist: "random",
          duration: 30,
          style: "classic", 
          audioSource: "arweave",
          customContent: input,
          urgency: "medium"
        };
      }
    } catch (error) {
      console.error('❌ Failed to analyze video request:', error.message);
      // Return default video request
      return {
        artist: "random",
        duration: 30,
        style: "classic",
        audioSource: "arweave", 
        customContent: input,
        urgency: "medium"
      };
    }
  }

  determineVideoWorkflow(videoRequest, context) {
    const steps = [];
    
    // Always include core steps
    steps.push('load_artist_data');
    
    // Add audio processing step
    if (videoRequest.audioSource === 'arweave') {
      steps.push('fetch_arweave_audio');
    } else {
      steps.push('process_uploaded_audio');
    }
    
    // Add visual generation steps
    steps.push('generate_visuals');
    steps.push('create_layout');
    
    // Add video composition
    steps.push('compose_video');
    
    // Optional steps based on request
    if (videoRequest.style === 'enhanced' || context.includeAI) {
      steps.push('ai_background_generation');
    }
    
    if (videoRequest.urgency === 'low') {
      steps.push('quality_optimization');
    }

    // Determine workflow type
    let workflowType = 'simple';
    if (steps.length > 5) {
      workflowType = 'comprehensive';
    } else if (steps.length > 3) {
      workflowType = 'moderate';
    }

    return {
      type: workflowType,
      steps,
      canSkip: ['ai_background_generation', 'quality_optimization'],
      canAdd: ['social_media_optimization', 'multiple_formats']
    };
  }

  async executeVideoWorkflow(workflow, videoRequest, context) {
    console.log(`🔄 Executing ${workflow.type} video workflow with ${workflow.steps.length} steps`);
    
    const results = {};
    let currentData = { ...videoRequest };

    try {
      for (const step of workflow.steps) {
        console.log(`📋 Executing step: ${step}`);
        
        switch (step) {
          case 'load_artist_data':
            currentData.artistData = await this.loadArtistData(currentData.artist);
            break;
            
          case 'fetch_arweave_audio':
            currentData.audioData = await this.fetchArweaveAudio(currentData.artistData);
            break;
            
          case 'process_uploaded_audio':
            currentData.audioData = await this.processUploadedAudio(context.uploadedFiles);
            break;
            
          case 'generate_visuals':
            currentData.visuals = await this.generateVisuals(currentData);
            break;
            
          case 'create_layout':
            currentData.layout = await this.createVideoLayout(currentData);
            break;
            
          case 'ai_background_generation':
            if (!workflow.canSkip.includes(step) || context.forceAI) {
              currentData.aiBackground = await this.generateAIBackground(currentData);
            }
            break;
            
          case 'compose_video':
            currentData.video = await this.composeVideo(currentData);
            break;
            
          case 'quality_optimization':
            if (!workflow.canSkip.includes(step)) {
              currentData.video = await this.optimizeVideo(currentData.video);
            }
            break;
        }
        
        results[step] = { success: true, timestamp: new Date().toISOString() };
      }

      return {
        success: true,
        workflow: workflow.type,
        artist: currentData.artistData?.artistName || 'Unknown',
        duration: currentData.duration,
        videoPath: currentData.video?.path || null,
        steps: results,
        metadata: currentData
      };
      
    } catch (error) {
      console.error('❌ Video workflow execution failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        workflow: workflow.type,
        completedSteps: Object.keys(results),
        failedStep: workflow.steps.find(step => !results[step])
      };
    }
  }

  async loadArtistData(artistName) {
    // Load from sample artists data
    const artistsPath = path.join(process.cwd(), 'data', 'sample-artists.json');
    
    try {
      if (await fs.pathExists(artistsPath)) {
        const artists = await fs.readJson(artistsPath);
        
        if (artistName === 'random') {
          return artists[Math.floor(Math.random() * artists.length)];
        } else {
          const found = artists.find(a => 
            a.artistName.toLowerCase().includes(artistName.toLowerCase())
          );
          return found || artists[0]; // Fallback to first artist
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load artists data:', error.message);
    }

    // Fallback artist data
    return {
      artistName: "Sample Artist",
      artistGenre: "electronic",
      mixes: [{
        mixTitle: "Hello World Mix",
        mixArweaveURL: "https://arweave.net/sample-audio-hash",
        mixDuration: "30:00",
        mixDateYear: "'24"
      }]
    };
  }

  async fetchArweaveAudio(artistData) {
    console.log('🎵 Fetching Arweave audio for:', artistData.artistName);
    
    // For now, return mock audio data - real implementation would download from Arweave
    const selectedMix = artistData.mixes[Math.floor(Math.random() * artistData.mixes.length)];
    
    return {
      title: selectedMix.mixTitle,
      url: selectedMix.mixArweaveURL,
      duration: 30,
      format: 'mp3',
      // In real implementation, this would be the downloaded file path
      localPath: path.join(this.tempDir, `audio-${Date.now()}.mp3`),
      mock: true // Indicates this is mock data
    };
  }

  async processUploadedAudio(uploadedFiles) {
    // Process user-uploaded audio files
    if (!uploadedFiles || uploadedFiles.length === 0) {
      throw new Error('No audio files uploaded');
    }
    
    const audioFile = uploadedFiles.find(f => f.mimetype.startsWith('audio/'));
    if (!audioFile) {
      throw new Error('No valid audio files found');
    }

    return {
      title: audioFile.originalname,
      localPath: audioFile.path,
      duration: 30, // Could be detected using ffprobe
      format: audioFile.mimetype.split('/')[1],
      mock: false
    };
  }

  async generateVisuals(data) {
    console.log('🎨 Generating visuals for:', data.artistData.artistName);
    
    // Simple visual generation - in real implementation this would create actual images
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
    const selectedColor = colors[Math.floor(Math.random() * colors.length)];
    
    return {
      backgroundColor: selectedColor,
      artistImage: `/assets/artists/${data.artistData.artistName.toLowerCase().replace(/\s+/g, '-')}.jpg`,
      logoImage: '/assets/logos/sample-logo.png',
      style: data.style || 'classic',
      dimensions: { width: 1080, height: 1080 }
    };
  }

  async createVideoLayout(data) {
    console.log('📐 Creating video layout');
    
    // Generate HTML layout for the video
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                margin: 0;
                padding: 0;
                width: 1080px;
                height: 1080px;
                background: linear-gradient(45deg, ${data.visuals.backgroundColor}, #000);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: 'Arial', sans-serif;
                color: white;
            }
            .artist-name {
                font-size: 48px;
                font-weight: bold;
                margin-bottom: 20px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }
            .mix-title {
                font-size: 32px;
                margin-bottom: 40px;
                opacity: 0.9;
            }
            .logo {
                position: absolute;
                bottom: 40px;
                right: 40px;
                font-size: 24px;
                opacity: 0.8;
            }
        </style>
    </head>
    <body>
        <div class="artist-name">${data.artistData.artistName}</div>
        <div class="mix-title">${data.audioData.title}</div>
        <div class="logo">CreativeTech DJ</div>
    </body>
    </html>`;

    const layoutPath = path.join(this.tempDir, `layout-${Date.now()}.html`);
    await fs.writeFile(layoutPath, htmlContent);

    return {
      htmlPath: layoutPath,
      dimensions: data.visuals.dimensions,
      style: data.visuals.style
    };
  }

  async generateAIBackground(data) {
    console.log('🤖 Generating AI background (mock)');
    
    // Mock AI background generation - real implementation would use DALL-E or similar
    return {
      prompt: `Abstract electronic music visualization for ${data.artistData.artistName}`,
      imagePath: null, // Would be generated image path
      style: 'abstract_electronic',
      mock: true
    };
  }

  async composeVideo(data) {
    console.log('🎬 Composing final video');
    
    const outputFileName = `${data.artistData.artistName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.mp4`;
    const outputPath = path.join(this.outputDir, outputFileName);
    
    // Mock video composition - real implementation would use FFmpeg
    const videoData = {
      path: outputPath,
      duration: data.duration,
      format: 'mp4',
      resolution: '1080x1080',
      audioTrack: data.audioData.localPath,
      visualTrack: data.layout.htmlPath,
      created: new Date().toISOString(),
      mock: true // Indicates this is mock data
    };

    // Create a placeholder file for now
    await fs.writeFile(outputPath, JSON.stringify(videoData, null, 2));
    
    console.log('✅ Video composed (mock):', outputFileName);
    
    return videoData;
  }

  async optimizeVideo(videoData) {
    console.log('⚡ Optimizing video quality');
    
    // Mock optimization - real implementation would re-encode with better settings
    return {
      ...videoData,
      optimized: true,
      bitrate: '2000k',
      codec: 'h264'
    };
  }

  // Utility methods
  async cleanup() {
    // Clean up temporary files
    const tempFiles = await fs.readdir(this.tempDir);
    const oldFiles = tempFiles.filter(file => {
      const filePath = path.join(this.tempDir, file);
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtime.getTime();
      return age > 24 * 60 * 60 * 1000; // Older than 24 hours
    });

    for (const file of oldFiles) {
      await fs.remove(path.join(this.tempDir, file));
    }

    console.log(`🧹 Cleaned up ${oldFiles.length} temporary files`);
  }

  getVideoHistory() {
    // Return list of generated videos
    try {
      const videos = fs.readdirSync(this.outputDir)
        .filter(file => file.endsWith('.mp4'))
        .map(file => ({
          filename: file,
          path: path.join(this.outputDir, file),
          created: fs.statSync(path.join(this.outputDir, file)).mtime
        }))
        .sort((a, b) => b.created - a.created);

      return videos;
    } catch (error) {
      console.error('❌ Error getting video history:', error.message);
      return [];
    }
  }
}

module.exports = { ArweaveVideoAgent }; 