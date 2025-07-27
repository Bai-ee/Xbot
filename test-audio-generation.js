#!/usr/bin/env node

/**
 * Test script for Arweave Audio Generation
 * This script tests the audio generation functionality to ensure it's working properly
 */

const { ArweaveAudioClient } = require('./src/lib/ArweaveAudioClient');

async function testAudioGeneration() {
  console.log('🎵 Testing Arweave Audio Generation...\n');
  
  try {
    const client = new ArweaveAudioClient();
    
    // Test 1: Check if artists data is loaded
    console.log('📊 Checking artists data...');
    const artists = client.getAvailableArtists();
    console.log(`✅ Found ${artists.length} artists`);
    
    if (artists.length === 0) {
      console.error('❌ No artists found. Please check your artists.json file.');
      process.exit(1);
    }
    
    // Test 2: Generate a 15-second audio clip
    console.log('\n🎵 Generating 15-second audio clip...');
    const result = await client.generateAudioClip(15, 1, 1);
    
    console.log('✅ Audio generation successful!');
    console.log(`📁 File: ${result.fileName}`);
    console.log(`🎤 Artist: ${result.artist}`);
    console.log(`🎵 Mix: ${result.mixTitle}`);
    console.log(`⏱️ Duration: ${result.duration}s`);
    console.log(`📊 File size: ${Math.round(result.fileSize / 1024)}KB`);
    
    // Test 3: Clean up the test file
    console.log('\n🧹 Cleaning up test file...');
    await client.cleanupClip(result.audioPath);
    console.log('✅ Cleanup completed');
    
    console.log('\n🎉 All tests passed! Audio generation is working properly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAudioGeneration();
}

module.exports = { testAudioGeneration }; 