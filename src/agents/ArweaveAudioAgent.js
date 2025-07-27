const { BaseAgent } = require('./BaseAgent.js');
const { ArweaveAudioClient } = require('../lib/ArweaveAudioClient.js');

/**
 * Arweave Audio Agent - Specialized agent for generating audio clips from Arweave
 * Integrates with the comprehensive ArweaveAudioClient for efficient audio processing
 */
class ArweaveAudioAgent extends BaseAgent {
  constructor() {
    super('ArweaveAudioAgent', ['audio_generation', 'arweave_audio', 'audio_clips']);
    
    try {
      this.audioClient = new ArweaveAudioClient();
      console.log('✅ ArweaveAudioAgent initialized with ArweaveAudioClient');
    } catch (error) {
      console.error('❌ Failed to initialize ArweaveAudioAgent:', error);
      this.audioClient = null;
    }
  }

  async handleMessage(input, context = {}) {
    console.log('🎵 ArweaveAudioAgent processing request:', input.substring(0, 100) + '...');

    if (!this.audioClient) {
      throw new Error('ArweaveAudioClient not initialized');
    }

    try {
      // Check if this is a metadata-only request
      if (context.metadataOnly || input.toLowerCase().includes('metadata') || input.toLowerCase().includes('info only')) {
        return await this.getArtistMetadata(input, context);
      }

      // Parse request parameters
      const duration = this.extractDuration(input, context);
      const artist = this.extractArtist(input, context);
      const fadeIn = context.fadeIn || 2;
      const fadeOut = context.fadeOut || 2;

      console.log(`🎯 Audio generation request: ${duration}s${artist ? ` for ${artist}` : ' (random)'}`);

      // Generate audio clip
      const audioResult = await this.audioClient.generateAudioClip(
        duration,
        fadeIn,
        fadeOut,
        input,
        { artist }
      );

      console.log(`✅ Audio generated: ${audioResult.artist} - ${audioResult.mixTitle} (${audioResult.duration}s)`);

      // Return comprehensive result
      return {
        type: 'audio_generation',
        success: true,
        audioPath: audioResult.audioPath,
        fileName: audioResult.fileName,
        url: `/content/audio/${audioResult.fileName}`,
        artist: audioResult.artist,
        mixTitle: audioResult.mixTitle,
        duration: audioResult.duration,
        fileSize: Math.round(audioResult.fileSize / 1024) + 'KB',
        arweaveUrl: audioResult.arweaveUrl,
        metadata: {
          arweaveUrl: audioResult.arweaveUrl,
          startTime: audioResult.startTime,
          totalDuration: audioResult.totalDuration,
          fadeIn,
          fadeOut
        }
      };

    } catch (error) {
      console.error('❌ ArweaveAudioAgent error:', error);
      return {
        type: 'audio_generation',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get artist metadata without generating audio files
   */
  async getArtistMetadata(input, context = {}) {
    try {
      const artist = this.extractArtist(input, context);
      
      if (artist) {
        // Get specific artist info
        const artistMix = this.audioClient.getArtistMix(artist);
        if (!artistMix) {
          throw new Error(`Artist "${artist}" not found`);
        }

        return {
          type: 'artist_metadata',
          success: true,
          artist: artistMix.artist,
          mixTitle: artistMix.mix.mixTitle,
          mixDuration: artistMix.mix.mixDuration,
          mixDateYear: artistMix.mix.mixDateYear,
          mixGenre: artistMix.artist.artistGenre,
          arweaveUrl: artistMix.mix.mixArweaveURL,
          thumbnailImage: artistMix.artist.artistImageFilename,
          mixImage: artistMix.mix.mixImageFilename,
          totalDurationSeconds: this.audioClient.parseDuration(artistMix.mix.mixDuration),
          metadata: {
            artist: artistMix.artist,
            mix: artistMix.mix,
            availableMixes: artistMix.artist.mixes.length,
            fullArtistData: artistMix.artist
          }
        };
      } else {
        // Get random artist info
        const artistMix = this.audioClient.getArtistMix();
        
        return {
          type: 'artist_metadata',
          success: true,
          artist: artistMix.artist.artistName,
          mixTitle: artistMix.mix.mixTitle,
          mixDuration: artistMix.mix.mixDuration,
          mixDateYear: artistMix.mix.mixDateYear,
          mixGenre: artistMix.artist.artistGenre,
          arweaveUrl: artistMix.mix.mixArweaveURL,
          thumbnailImage: artistMix.artist.artistImageFilename,
          mixImage: artistMix.mix.mixImageFilename,
          totalDurationSeconds: this.audioClient.parseDuration(artistMix.mix.mixDuration),
          metadata: {
            artist: artistMix.artist,
            mix: artistMix.mix,
            availableMixes: artistMix.artist.mixes.length,
            fullArtistData: artistMix.artist
          }
        };
      }
    } catch (error) {
      console.error('❌ ArweaveAudioAgent metadata error:', error);
      return {
        type: 'artist_metadata',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all available artists with their metadata
   */
  async getAllArtistsMetadata() {
    try {
      const artists = this.audioClient.getAvailableArtists();
      const artistsData = [];

      for (const artistInfo of artists) {
        try {
          // artistInfo is an object with {name, genre, mixCount}, we need the name
          const artistName = artistInfo.name || artistInfo;
          const artistMix = this.audioClient.getArtistMix(artistName);
          if (artistMix) {
            artistsData.push({
              name: artistMix.artist.artistName,
              genre: artistMix.artist.artistGenre,
              totalMixes: artistMix.artist.mixes.length,
              thumbnailImage: artistMix.artist.artistImageFilename,
              filename: artistMix.artist.artistFilename,
              mixes: artistMix.artist.mixes.map(mix => ({
                title: mix.mixTitle,
                duration: mix.mixDuration,
                year: mix.mixDateYear,
                arweaveUrl: mix.mixArweaveURL,
                image: mix.mixImageFilename
              }))
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not load data for artist: ${artistInfo.name || artistInfo}`);
        }
      }

      return {
        type: 'all_artists_metadata',
        success: true,
        totalArtists: artistsData.length,
        artists: artistsData
      };
    } catch (error) {
      console.error('❌ ArweaveAudioAgent getAllArtistsMetadata error:', error);
      return {
        type: 'all_artists_metadata',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract duration from input or context
   */
  extractDuration(input, context) {
    // Check context first
    if (context.duration) {
      return parseInt(context.duration);
    }

    // Use ArweaveAudioClient's parsing
    return this.audioClient.extractRequestedDuration(input) || 30;
  }

  /**
   * Extract artist from input or context
   */
  extractArtist(input, context) {
    // Check context first
    if (context.artist && context.artist !== 'random') {
      return context.artist;
    }

    // Use ArweaveAudioClient's parsing
    return this.audioClient.extractArtistFromPrompt(input);
  }

  /**
   * Generate audio for specific artist
   */
  async generateForArtist(artistName, duration = 30, options = {}) {
    try {
      const audioResult = await this.audioClient.generateAudioClip(
        duration,
        options.fadeIn || 2,
        options.fadeOut || 2,
        `Generate audio for ${artistName}`,
        { artist: artistName }
      );

      return {
        success: true,
        ...audioResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate random audio clip
   */
  async generateRandom(duration = 30, options = {}) {
    try {
      const audioResult = await this.audioClient.generateAudioClip(
        duration,
        options.fadeIn || 2,
        options.fadeOut || 2,
        'Generate random audio clip',
        {}
      );

      return {
        success: true,
        ...audioResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available artists
   */
  getAvailableArtists() {
    if (!this.audioClient) {
      return [];
    }
    return this.audioClient.getAvailableArtists();
  }

  /**
   * Test audio connection for artist
   */
  async testArtistConnection(artistName) {
    if (!this.audioClient) {
      return { success: false, error: 'AudioClient not initialized' };
    }

    try {
      const { artist, mix } = this.audioClient.getArtistMix(artistName);
      const connectionTest = await this.audioClient.testArweaveConnection(mix.mixArweaveURL);
      
      return {
        success: connectionTest.success,
        artist: artist.artistName,
        mix: mix.mixTitle,
        url: mix.mixArweaveURL,
        connection: connectionTest
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up audio files
   */
  async cleanup() {
    console.log('🧹 ArweaveAudioAgent cleanup...');
    
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      const audioDir = path.join(process.cwd(), 'content', 'audio');
      if (await fs.pathExists(audioDir)) {
        const files = await fs.readdir(audioDir);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        for (const file of files) {
          if (file.startsWith('arweave_clip_') && (file.endsWith('.mp3') || file.endsWith('.m4a'))) {
            const filePath = path.join(audioDir, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtime.getTime() > oneHour) {
              await fs.unlink(filePath);
              console.log(`🧹 Cleaned up audio: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ ArweaveAudioAgent cleanup error:', error);
    }
  }

  /**
   * Get agent status and stats
   */
  getStatus() {
    return {
      name: this.name,
      specializations: this.specializations,
      initialized: !!this.audioClient,
      availableArtists: this.audioClient ? this.audioClient.getAvailableArtists().length : 0,
      stats: this.getStats()
    };
  }
}

module.exports = { ArweaveAudioAgent }; 