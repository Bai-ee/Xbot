#!/usr/bin/env node

/**
 * Test: Production Artist Video Generator
 * 
 * Demonstrates the exact request: "Grab an artist from the artist.json, 
 * and create a 30 sec 720x720 video, with an existing video of chicagos 
 * skyline in the background, layer in a 30 second audio clip of the same artist"
 */

import ArtistVideoGenerator from './src/tools/artistVideoGenerator.js';

async function testArtistVideoGenerator() {
  try {
    console.log('🚀 TESTING PRODUCTION ARTIST VIDEO GENERATOR');
    console.log('============================================');
    console.log('Request: "Grab an artist from artists.json and create a 30-second');
    console.log('720x720 video with Chicago skyline background and artist audio"');
    console.log('');
    
    const generator = new ArtistVideoGenerator();
    
    // Initialize and show available artists
    await generator.init();
    console.log('\n📋 Available Artists:');
    generator.listArtists();
    
    // Test 1: Random artist
    console.log('\n' + '='.repeat(60));
    console.log('🎲 TEST 1: Random Artist (30-second video)');
    console.log('='.repeat(60));
    
    const result1 = await generator.createArtistVideo(null, {
      duration: 30,
      outputSize: '720x720'
    });
    
    console.log('\n📊 RESULT 1 SUMMARY:');
    console.log(`   Artist: ${result1.artist.artistName} (${result1.artist.artistGenre})`);
    console.log(`   Mix: ${result1.mix.mixTitle}`);
    console.log(`   File: ${result1.filename}`);
    console.log(`   Size: ${result1.fileSizeMB}MB`);
    console.log(`   Duration: ${result1.duration}s`);
    console.log(`   Format: ${result1.size}`);
    
    // Test 2: Specific artist by name  
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TEST 2: Specific Artist - "ACIDMAN" (30-second video)');
    console.log('='.repeat(60));
    
    const result2 = await generator.createArtistVideo('ACIDMAN', {
      duration: 30,
      outputSize: '720x720'
    });
    
    console.log('\n📊 RESULT 2 SUMMARY:');
    console.log(`   Artist: ${result2.artist.artistName} (${result2.artist.artistGenre})`);
    console.log(`   Mix: ${result2.mix.mixTitle}`);
    console.log(`   File: ${result2.filename}`);
    console.log(`   Size: ${result2.fileSizeMB}MB`);
    console.log(`   Duration: ${result2.duration}s`);
    console.log(`   Format: ${result2.size}`);
    
    // Test 3: Different duration
    console.log('\n' + '='.repeat(60));
    console.log('⏱️  TEST 3: Different Artist - 15-second video');
    console.log('='.repeat(60));
    
    const result3 = await generator.createArtistVideo('ANDREW EMIL', {
      duration: 15,
      outputSize: '720x720'
    });
    
    console.log('\n📊 RESULT 3 SUMMARY:');
    console.log(`   Artist: ${result3.artist.artistName} (${result3.artist.artistGenre})`);
    console.log(`   Mix: ${result3.mix.mixTitle}`);
    console.log(`   File: ${result3.filename}`);
    console.log(`   Size: ${result3.fileSizeMB}MB`);
    console.log(`   Duration: ${result3.duration}s`);
    console.log(`   Format: ${result3.size}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n🎬 GENERATED VIDEOS:');
    console.log(`   1. ${result1.filename} (${result1.fileSizeMB}MB)`);
    console.log(`   2. ${result2.filename} (${result2.fileSizeMB}MB)`);
    console.log(`   3. ${result3.filename} (${result3.fileSizeMB}MB)`);
    
    console.log('\n📁 All videos saved to: content/videos/generated_artist_videos/');
    console.log('\n🎯 PRODUCTION READY: This tool can now handle chat requests like:');
    console.log('   "Create a 30-second video for ACIDMAN with Chicago skyline"');
    console.log('   "Make a video for a random artist"');
    console.log('   "Generate a 15-second promo for ANDREW EMIL"');
    
    return [result1, result2, result3];
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run the test
testArtistVideoGenerator()
  .then(results => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }); 