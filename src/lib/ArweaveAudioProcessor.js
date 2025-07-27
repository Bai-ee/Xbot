const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class ArweaveAudioProcessor {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'outputs', 'audio');
    this.tempDir = path.join(process.cwd(), 'temp-uploads');
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Download and process audio from Arweave URL
   */
  async processArweaveAudio(arweaveUrl, options = {}) {
    const {
      duration = 30,
      fadeIn = 2,
      fadeOut = 2,
      startTime = null,
      volume = 1.0,
      quality = 'high'
    } = options;

    const audioId = uuidv4();
    const tempInputPath = path.join(this.tempDir, `arweave_input_${audioId}.mp3`);
    const tempOutputPath = path.join(this.tempDir, `arweave_output_${audioId}.mp3`);

    try {
      console.log('🎵 Downloading audio from Arweave:', arweaveUrl);
      
      // Download audio from Arweave
      await this.downloadAudioFile(arweaveUrl, tempInputPath);
      
      // Get audio duration and metadata
      const audioInfo = await this.getAudioInfo(tempInputPath);
      console.log('📊 Audio info:', audioInfo);

      // Determine start time
      let actualStartTime = startTime;
      if (actualStartTime === null) {
        // Random start time, but avoid the very beginning and end
        const maxStart = Math.max(0, audioInfo.duration - duration - 5);
        const minStart = Math.min(5, maxStart);
        actualStartTime = Math.random() * (maxStart - minStart) + minStart;
      }

      console.log(`✂️ Clipping audio: ${actualStartTime}s to ${actualStartTime + duration}s`);

      // Process audio with FFmpeg
      const processedAudio = await this.clipAndProcessAudio({
        inputPath: tempInputPath,
        outputPath: tempOutputPath,
        startTime: actualStartTime,
        duration,
        fadeIn,
        fadeOut,
        volume,
        quality
      });

      // Clean up temp input file
      await fs.remove(tempInputPath);

      return {
        success: true,
        audioPath: tempOutputPath,
        originalDuration: audioInfo.duration,
        clippedDuration: duration,
        startTime: actualStartTime,
        metadata: {
          ...audioInfo,
          arweaveUrl,
          processedAt: new Date().toISOString(),
          options
        }
      };

    } catch (error) {
      console.error('❌ Error processing Arweave audio:', error);
      
      // Cleanup on error
      await this.cleanup([tempInputPath, tempOutputPath]);
      
      throw new Error(`Failed to process Arweave audio: ${error.message}`);
    }
  }

  /**
   * Download audio file from URL
   */
  async downloadAudioFile(url, outputPath) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000, // 60 second timeout
        headers: {
          'User-Agent': 'ArweaveVideoGenerator/1.0.0'
        }
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log('✅ Audio download completed');
          resolve();
        });
        writer.on('error', reject);
        
        // Handle download timeout
        setTimeout(() => {
          reject(new Error('Download timeout'));
        }, 120000); // 2 minute timeout
      });

    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to Arweave network. Please check your internet connection.');
      }
      throw error;
    }
  }

  /**
   * Get audio file information using FFprobe
   */
  async getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        resolve({
          duration: metadata.format.duration || 0,
          bitrate: metadata.format.bit_rate || 0,
          format: metadata.format.format_name || 'unknown',
          codec: audioStream?.codec_name || 'unknown',
          sampleRate: audioStream?.sample_rate || 0,
          channels: audioStream?.channels || 0,
          size: metadata.format.size || 0
        });
      });
    });
  }

  /**
   * Clip and process audio with FFmpeg
   */
  async clipAndProcessAudio(options) {
    const {
      inputPath,
      outputPath,
      startTime,
      duration,
      fadeIn,
      fadeOut,
      volume,
      quality
    } = options;

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .setStartTime(startTime)
        .duration(duration);

      // Apply audio filters
      const filters = [];
      
      // Volume adjustment
      if (volume !== 1.0) {
        filters.push(`volume=${volume}`);
      }

      // Fade effects
      if (fadeIn > 0) {
        filters.push(`afade=t=in:st=0:d=${fadeIn}`);
      }
      
      if (fadeOut > 0) {
        filters.push(`afade=t=out:st=${duration - fadeOut}:d=${fadeOut}`);
      }

      // Apply filters if any
      if (filters.length > 0) {
        command = command.audioFilters(filters);
      }

      // Quality settings
      const qualitySettings = this.getQualitySettings(quality);
      command = command
        .audioCodec('mp3')
        .audioBitrate(qualitySettings.bitrate)
        .audioFrequency(qualitySettings.sampleRate);

      // Process the audio
      command
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🔄 FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Processing: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ Audio processing completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Get quality settings for audio processing
   */
  getQualitySettings(quality) {
    const settings = {
      low: { bitrate: '96k', sampleRate: 22050 },
      medium: { bitrate: '128k', sampleRate: 44100 },
      high: { bitrate: '192k', sampleRate: 44100 },
      ultra: { bitrate: '320k', sampleRate: 48000 }
    };

    return settings[quality] || settings.high;
  }

  /**
   * Process uploaded audio file (alternative to Arweave)
   */
  async processUploadedAudio(filePath, options = {}) {
    const {
      duration = 30,
      fadeIn = 2,
      fadeOut = 2,
      startTime = null,
      volume = 1.0,
      quality = 'high'
    } = options;

    const audioId = uuidv4();
    const tempOutputPath = path.join(this.tempDir, `uploaded_output_${audioId}.mp3`);

    try {
      // Get audio info
      const audioInfo = await this.getAudioInfo(filePath);
      
      // Determine start time
      let actualStartTime = startTime;
      if (actualStartTime === null) {
        const maxStart = Math.max(0, audioInfo.duration - duration - 2);
        actualStartTime = Math.random() * maxStart;
      }

      // Process audio
      await this.clipAndProcessAudio({
        inputPath: filePath,
        outputPath: tempOutputPath,
        startTime: actualStartTime,
        duration,
        fadeIn,
        fadeOut,
        volume,
        quality
      });

      return {
        success: true,
        audioPath: tempOutputPath,
        originalDuration: audioInfo.duration,
        clippedDuration: duration,
        startTime: actualStartTime,
        metadata: {
          ...audioInfo,
          source: 'uploaded',
          processedAt: new Date().toISOString(),
          options
        }
      };

    } catch (error) {
      await this.cleanup([tempOutputPath]);
      throw new Error(`Failed to process uploaded audio: ${error.message}`);
    }
  }

  /**
   * Generate audio waveform visualization data
   */
  async generateWaveformData(audioPath, points = 100) {
    return new Promise((resolve, reject) => {
      const tempWaveformPath = path.join(this.tempDir, `waveform_${uuidv4()}.txt`);
      
      ffmpeg(audioPath)
        .audioFilters([
          `aresample=8000`, // Downsample for analysis
          `astats=metadata=1:reset=1`
        ])
        .format('null')
        .output('-')
        .on('end', async () => {
          try {
            // This is a simplified waveform generation
            // In a real implementation, you'd extract actual amplitude data
            const waveformData = Array.from({ length: points }, () => 
              Math.random() * 0.8 + 0.1 // Random amplitude between 0.1 and 0.9
            );
            
            resolve(waveformData);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths = []) {
    for (const filePath of filePaths) {
      try {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log(`🧹 Cleaned up: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Cleanup old temporary files
   */
  async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.remove(filePath);
          console.log(`🗑️ Removed old file: ${file}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning up old files:', error.message);
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      tempDir: this.tempDir,
      outputDir: this.outputDir,
      supportedFormats: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'],
      qualityOptions: ['low', 'medium', 'high', 'ultra']
    };
  }
}

module.exports = { ArweaveAudioProcessor }; 