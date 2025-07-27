const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class VideoCompositor {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'outputs', 'videos');
    this.tempDir = path.join(process.cwd(), 'temp-uploads');
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tempDir);

    // Default settings
    this.defaultSettings = {
      width: 1080,
      height: 1080,
      fps: 30,
      videoBitrate: '2000k',
      audioBitrate: '192k',
      format: 'mp4',
      codec: 'libx264',
      audioCodec: 'aac'
    };
  }

  /**
   * Compose video from frames and audio
   */
  async composeVideo(options) {
    const {
      framesDir,
      audioPath,
      outputFilename,
      duration,
      fps = this.defaultSettings.fps,
      width = this.defaultSettings.width,
      height = this.defaultSettings.height,
      quality = 'high',
      metadata = {}
    } = options;

    const videoId = uuidv4();
    const outputPath = path.join(this.outputDir, outputFilename || `video_${videoId}.mp4`);
    const tempVideoPath = path.join(this.tempDir, `temp_video_${videoId}.mp4`);

    try {
      console.log('🎬 Starting video composition...');
      console.log(`📁 Frames: ${framesDir}`);
      console.log(`🎵 Audio: ${path.basename(audioPath)}`);
      console.log(`📹 Output: ${outputFilename}`);

      // Verify inputs exist
      if (!await fs.pathExists(framesDir)) {
        throw new Error(`Frames directory not found: ${framesDir}`);
      }
      
      if (!await fs.pathExists(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Get quality settings
      const qualitySettings = this.getQualitySettings(quality);

      // Create video from frames
      await this.createVideoFromFrames({
        framesDir,
        tempVideoPath,
        fps,
        width,
        height,
        duration,
        qualitySettings
      });

      // Combine video with audio
      await this.combineVideoWithAudio({
        videoPath: tempVideoPath,
        audioPath,
        outputPath,
        duration,
        qualitySettings,
        metadata
      });

      // Clean up temp video
      await fs.remove(tempVideoPath);

      // Get output file stats
      const stats = await fs.stat(outputPath);

      console.log('✅ Video composition completed successfully!');

      return {
        success: true,
        videoPath: outputPath,
        duration,
        width,
        height,
        fps,
        fileSize: stats.size,
        format: 'mp4',
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          settings: qualitySettings
        }
      };

    } catch (error) {
      console.error('❌ Video composition failed:', error);
      
      // Cleanup on error
      await this.cleanup([tempVideoPath, outputPath]);
      
      throw new Error(`Video composition failed: ${error.message}`);
    }
  }

  /**
   * Create video from image frames
   */
  async createVideoFromFrames(options) {
    const { framesDir, tempVideoPath, fps, width, height, duration, qualitySettings } = options;

    return new Promise((resolve, reject) => {
      console.log('🎞️ Creating video from frames...');

      // Frame pattern (frame_000001.png, frame_000002.png, etc.)
      const framePattern = path.join(framesDir, 'frame_%06d.png');

      const command = ffmpeg()
        .input(framePattern)
        .inputOptions([
          '-framerate', fps.toString(),
          '-t', duration.toString()
        ])
        .videoCodec(this.defaultSettings.codec)
        .size(`${width}x${height}`)
        .fps(fps)
        .videoBitrate(qualitySettings.videoBitrate)
        .outputOptions([
          '-pix_fmt', 'yuv420p', // Ensures compatibility
          '-preset', qualitySettings.preset,
          '-crf', qualitySettings.crf.toString()
        ])
        .output(tempVideoPath)
        .on('start', (commandLine) => {
          console.log('🔄 FFmpeg frames command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Frames processing: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ Video frames processed');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg frames error:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Combine video with audio
   */
  async combineVideoWithAudio(options) {
    const { videoPath, audioPath, outputPath, duration, qualitySettings, metadata } = options;

    return new Promise((resolve, reject) => {
      console.log('🎵 Combining video with audio...');

      let command = ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .videoCodec('copy') // Copy video stream without re-encoding
        .audioCodec(this.defaultSettings.audioCodec)
        .audioBitrate(qualitySettings.audioBitrate)
        .duration(duration)
        .outputOptions([
          '-map', '0:v:0', // First video stream
          '-map', '1:a:0', // First audio stream
          '-shortest' // End when shortest stream ends
        ]);

      // Add metadata if provided
      if (metadata.artist) {
        command = command.outputOptions('-metadata', `artist=${metadata.artist}`);
      }
      if (metadata.title) {
        command = command.outputOptions('-metadata', `title=${metadata.title}`);
      }
      if (metadata.description) {
        command = command.outputOptions('-metadata', `description=${metadata.description}`);
      }

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🔄 FFmpeg combine command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Audio/video combining: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ Audio and video combined');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg combine error:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Create video from single image and audio (simpler approach)
   */
  async createVideoFromImageAndAudio(options) {
    const {
      imagePath,
      audioPath,
      outputFilename,
      duration,
      width = this.defaultSettings.width,
      height = this.defaultSettings.height,
      quality = 'high',
      metadata = {}
    } = options;

    const videoId = uuidv4();
    const outputPath = path.join(this.outputDir, outputFilename || `simple_video_${videoId}.mp4`);

    try {
      console.log('🎬 Creating video from image and audio...');

      // Verify inputs
      if (!await fs.pathExists(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      if (!await fs.pathExists(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const qualitySettings = this.getQualitySettings(quality);

      await new Promise((resolve, reject) => {
        let command = ffmpeg()
          .input(imagePath)
          .inputOptions(['-loop', '1'])
          .input(audioPath)
          .videoCodec(this.defaultSettings.codec)
          .audioCodec(this.defaultSettings.audioCodec)
          .size(`${width}x${height}`)
          .videoBitrate(qualitySettings.videoBitrate)
          .audioBitrate(qualitySettings.audioBitrate)
          .duration(duration)
          .fps(30)
          .outputOptions([
            '-pix_fmt', 'yuv420p',
            '-preset', qualitySettings.preset,
            '-crf', qualitySettings.crf.toString(),
            '-shortest'
          ]);

        // Add metadata
        if (metadata.artist) {
          command = command.outputOptions('-metadata', `artist=${metadata.artist}`);
        }
        if (metadata.title) {
          command = command.outputOptions('-metadata', `title=${metadata.title}`);
        }

        command
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🔄 FFmpeg simple video command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`⏳ Video creation: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log('✅ Simple video created');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg simple video error:', err);
            reject(err);
          })
          .run();
      });

      const stats = await fs.stat(outputPath);

      return {
        success: true,
        videoPath: outputPath,
        duration,
        width,
        height,
        fileSize: stats.size,
        format: 'mp4',
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          type: 'simple',
          settings: qualitySettings
        }
      };

    } catch (error) {
      console.error('❌ Simple video creation failed:', error);
      
      await this.cleanup([outputPath]);
      
      throw new Error(`Simple video creation failed: ${error.message}`);
    }
  }

  /**
   * Add text overlay to video
   */
  async addTextOverlay(videoPath, textOptions) {
    const {
      text,
      position = 'center',
      fontSize = 24,
      color = 'white',
      startTime = 0,
      duration = null
    } = textOptions;

    const videoId = uuidv4();
    const outputPath = path.join(this.outputDir, `overlay_${videoId}.mp4`);

    try {
      await new Promise((resolve, reject) => {
        let drawTextFilter = `drawtext=fontfile=/System/Library/Fonts/Arial.ttf:text='${text}':fontsize=${fontSize}:fontcolor=${color}`;
        
        // Position settings
        switch (position) {
          case 'top':
            drawTextFilter += ':x=(w-text_w)/2:y=50';
            break;
          case 'bottom':
            drawTextFilter += ':x=(w-text_w)/2:y=h-text_h-50';
            break;
          case 'center':
            drawTextFilter += ':x=(w-text_w)/2:y=(h-text_h)/2';
            break;
          default:
            drawTextFilter += ':x=(w-text_w)/2:y=(h-text_h)/2';
        }

        // Time settings
        if (startTime > 0 || duration) {
          const endTime = duration ? startTime + duration : '';
          drawTextFilter += `:enable='between(t,${startTime},${endTime})'`;
        }

        ffmpeg(videoPath)
          .videoFilters(drawTextFilter)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      return {
        success: true,
        videoPath: outputPath
      };

    } catch (error) {
      throw new Error(`Text overlay failed: ${error.message}`);
    }
  }

  /**
   * Get quality settings based on quality level
   */
  getQualitySettings(quality) {
    const settings = {
      low: {
        videoBitrate: '1000k',
        audioBitrate: '128k',
        crf: 28,
        preset: 'fast'
      },
      medium: {
        videoBitrate: '1500k',
        audioBitrate: '128k',
        crf: 23,
        preset: 'medium'
      },
      high: {
        videoBitrate: '2500k',
        audioBitrate: '192k',
        crf: 20,
        preset: 'slow'
      },
      ultra: {
        videoBitrate: '4000k',
        audioBitrate: '320k',
        crf: 18,
        preset: 'slower'
      }
    };

    return settings[quality] || settings.high;
  }

  /**
   * Get video information
   */
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration || 0,
          bitrate: metadata.format.bit_rate || 0,
          size: metadata.format.size || 0,
          format: metadata.format.format_name || 'unknown',
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate) || 0,
            bitrate: videoStream.bit_rate
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: audioStream.sample_rate,
            channels: audioStream.channels,
            bitrate: audioStream.bit_rate
          } : null
        });
      });
    });
  }

  /**
   * Convert video to different formats
   */
  async convertVideo(inputPath, outputFormat, options = {}) {
    const { quality = 'high', width, height } = options;
    
    const videoId = uuidv4();
    const outputPath = path.join(this.outputDir, `converted_${videoId}.${outputFormat}`);
    
    try {
      const qualitySettings = this.getQualitySettings(quality);
      
      await new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath)
          .videoCodec(outputFormat === 'webm' ? 'libvpx-vp9' : this.defaultSettings.codec)
          .audioCodec(outputFormat === 'webm' ? 'libvorbis' : this.defaultSettings.audioCodec)
          .videoBitrate(qualitySettings.videoBitrate)
          .audioBitrate(qualitySettings.audioBitrate);

        if (width && height) {
          command = command.size(`${width}x${height}`);
        }

        command
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      return {
        success: true,
        videoPath: outputPath,
        format: outputFormat
      };

    } catch (error) {
      throw new Error(`Video conversion failed: ${error.message}`);
    }
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
   * Get compositor statistics
   */
  getStats() {
    return {
      outputDir: this.outputDir,
      tempDir: this.tempDir,
      supportedFormats: ['mp4', 'webm', 'avi', 'mov'],
      supportedCodecs: ['libx264', 'libvpx-vp9'],
      qualityLevels: ['low', 'medium', 'high', 'ultra'],
      defaultSettings: this.defaultSettings
    };
  }
}

module.exports = { VideoCompositor }; 