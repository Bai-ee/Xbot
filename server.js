// Creative Tech DJ Twitter Bot Dashboard
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { TwitterApi } = require('twitter-api-v2');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
let openai = null;
let openaiAvailable = false;

// API Key validation function from troubleshooting guide
function validateOpenAIKeyFormat(apiKey) {
  if (!apiKey) return { valid: false, error: 'API key is missing' };
  
  if (typeof apiKey !== 'string') {
    return { valid: false, error: 'API key must be a string' };
  }
  
  const trimmed = apiKey.trim();
  if (trimmed !== apiKey) {
    return { valid: false, error: 'API key has leading/trailing whitespace' };
  }
  
  if (!trimmed.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' };
  }
  
  if (trimmed.length < 50) {
    return { valid: false, error: 'API key appears too short' };
  }
  
  if (!/^sk-[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }
  
  return { valid: true };
}

// API Key validation with actual OpenAI API call
async function validateKeyWithAPI(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      const error = await response.json();
      return { 
        valid: false, 
        error: 'API key is invalid, expired, or revoked',
        details: error.error?.message 
      };
    }
    
    if (response.status === 429) {
      return { 
        valid: true, // Key is valid but rate limited
        warning: 'API key is valid but rate limited'
      };
    }
    
    return { 
      valid: response.status === 200,
      models: response.status === 200 ? (await response.json()).data?.length : 0
    };
    
  } catch (error) {
    return { 
      valid: false, 
      error: 'Network error during validation',
      details: error.message 
    };
  }
}

// Debug environment setup
function debugEnvironmentSetup() {
  console.log('\n🔍 === OPENAI API KEY DEBUG ===');
  
  // Check raw environment variable
  const rawKey = process.env.OPENAI_API_KEY;
  console.log('1. Raw API key present:', !!rawKey);
  console.log('2. Raw API key length:', rawKey?.length || 0);
  console.log('3. Raw API key preview:', rawKey ? `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 8)}` : 'MISSING');
  
  // Check format validation
  const formatCheck = validateOpenAIKeyFormat(rawKey);
  console.log('4. Format validation:', formatCheck.valid ? '✅ PASSED' : `❌ ${formatCheck.error}`);
  
  // Check for common issues
  if (rawKey) {
    const issues = [];
    
    if (rawKey !== rawKey.trim()) {
      issues.push('Has leading/trailing whitespace');
    }
    
    if (rawKey.includes(' ')) {
      issues.push('Contains spaces');
    }
    
    if (rawKey.includes('\n') || rawKey.includes('\r')) {
      issues.push('Contains line breaks');
    }
    
    if (issues.length > 0) {
      console.log('⚠️  Potential issues:', issues.join(', '));
    }
  }
  
  console.log('=== END DEBUG ===\n');
}

// Initialize with comprehensive validation
async function initializeOpenAI() {
  debugEnvironmentSetup();
  
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️  OpenAI API key not provided - AI chat will be disabled');
      return;
    }

    // Format validation
    const formatValidation = validateOpenAIKeyFormat(apiKey);
    if (!formatValidation.valid) {
      console.log(`❌ Invalid API key format: ${formatValidation.error}`);
      return;
    }

    console.log('✅ API key format validation passed');

    // Test with actual OpenAI API
    console.log('🔍 Validating API key with OpenAI...');
    const apiValidation = await validateKeyWithAPI(apiKey);
    
    if (!apiValidation.valid) {
      console.log(`❌ API key validation failed: ${apiValidation.error}`);
      if (apiValidation.details) {
        console.log(`   Details: ${apiValidation.details}`);
      }
      console.log('🔧 Suggested fixes:');
      console.log('   1. Generate a new API key at https://platform.openai.com/api-keys');
      console.log('   2. Check if your OpenAI account has available credits');
      console.log('   3. Verify the key has not expired or been revoked');
      return;
    }

    if (apiValidation.warning) {
      console.log(`⚠️  ${apiValidation.warning}`);
    }

    console.log(`✅ API key validated successfully! Access to ${apiValidation.models || 'unknown'} models`);

    // Initialize OpenAI client
    openai = new OpenAI({
      apiKey: apiKey.trim(),
      timeout: 60000,
      maxRetries: 3
    });
    
    openaiAvailable = true;
    console.log('✅ OpenAI client initialized successfully');

  } catch (error) {
    console.log('❌ Failed to initialize OpenAI client:', error.message);
    console.log('🔧 Check your OPENAI_API_KEY environment variable');
  }
}

// Initialize OpenAI with validation
initializeOpenAI();

// Configure multer for file uploads
const upload = multer({
  dest: 'temp-uploads/', // Temporary directory for uploads
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
    files: 4 // Max 4 files (Twitter's limit)
  },
  fileFilter: (req, file, cb) => {
    // Check file types
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
    const isValidType = [...allowedImageTypes, ...allowedVideoTypes].includes(file.mimetype);
    
    if (isValidType) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`), false);
    }
  }
});

// Ensure temp directory exists
fs.ensureDirSync('temp-uploads');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Twitter client setup
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

// Tweet queue file
const QUEUE_FILE = path.join(__dirname, 'data', 'tweetQueue.json');

// Ensure data directory exists
fs.ensureDirSync(path.dirname(QUEUE_FILE));

// Initialize queue if it doesn't exist
if (!fs.existsSync(QUEUE_FILE)) {
  fs.writeJsonSync(QUEUE_FILE, { tweets: [] });
}

// Enhanced DJ content templates with more variety
const djTweets = [
  "🎶 Just finished cooking up some fresh beats in the studio! Can't wait to drop these tracks soon... #StudioLife #DJ #NewMusic",
  "🔥 That magical moment when the crowd moves as one with the beat... pure energy! #DJLife #MusicMagic #CreativeTech",
  "🎧 Experimenting with some cutting-edge creative tech tools for tonight's set. Innovation meets rhythm! #TechHouse #CreativeProcess",
  "⚡ The energy from last weekend's gig is still giving me chills! Thank you to everyone who danced the night away 🙌 #Grateful #WeekendVibes",
  "🎵 Sometimes the best tracks come from happy accidents in the studio. Embracing the creative chaos! #MusicProduction #CreativeFlow",
  "🌟 Working on a special remix that's been brewing in my mind for weeks. Nearly ready to share it with the world! #RemixLife #ComingSoon",
  "🎹 Diving deep into sound design today. Every knob twist and frequency sweep tells a story... #SoundDesign #ElectronicMusic #Process",
  "🔊 Nothing beats the feeling of a perfectly mixed transition. Hours of practice for that one seamless moment! #DJSkills #Perfection #Craft",
  "🎪 Prepping for an incredible show this weekend! The setlist is fire and I can't contain my excitement 🔥 #UpcomingGig #ShowPrep",
  "⚙️ Geeking out over new gear that just arrived! Time to explore some uncharted sonic territories #GearHead #NewToys #Innovation",
  "🌙 Late night studio sessions hit different. When the world sleeps, creativity awakens... #NightOwl #LateNightBeats #CreativeHours",
  "🎨 Music is painting with sound, and tonight I'm working on a masterpiece in multiple colors #MusicIsArt #CreativeExpression #Abstract"
];

// Random elements to add uniqueness
const timeBasedEmojis = ['⏰', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕'];
const musicEmojis = ['🎼', '🎹', '🥁', '🎸', '🎺', '🎷', '🪘'];
const vibeWords = ['feeling it', 'in the zone', 'vibing', 'flowing', 'creating magic', 'in my element'];

// Helper functions
function loadQueue() {
  try {
    return fs.readJsonSync(QUEUE_FILE);
  } catch (error) {
    return { tweets: [] };
  }
}

function saveQueue(queue) {
  fs.writeJsonSync(QUEUE_FILE, queue, { spaces: 2 });
}

// Generate random DJ tweet
function generateRandomTweet() {
  const tweet = djTweets[Math.floor(Math.random() * djTweets.length)];
  
  // Add more uniqueness with dynamic elements
  const timeEmojis = ['🌅', '🌞', '🌙', '⭐', '🌟', '✨', '💫'];
  const musicEmojis = ['🎵', '🎶', '🎼', '🎧', '🎤', '🎹', '🥁', '🎺', '🎸', '🎻'];
  const vibeWords = ['energy', 'vibes', 'beats', 'rhythm', 'groove', 'flow', 'sound', 'music'];
  
  const randomTimeEmoji = timeEmojis[Math.floor(Math.random() * timeEmojis.length)];
  const randomMusicEmoji = musicEmojis[Math.floor(Math.random() * musicEmojis.length)];
  const randomVibe = vibeWords[Math.floor(Math.random() * vibeWords.length)];
  
  // Add timestamp-based hashtag for uniqueness
  const timestamp = Date.now().toString(36);
  const uniqueTag = `#CreativeTech${timestamp}`;
  
  return `${randomTimeEmoji} ${tweet} ${randomMusicEmoji} #${randomVibe} ${uniqueTag}`;
}

// Helper function to upload media to Twitter
async function uploadMediaToTwitter(filePath, mediaType) {
  try {
    console.log(`📤 Uploading ${mediaType} to Twitter:`, filePath);
    
    // Upload media to Twitter
    const mediaUpload = await client.v1.uploadMedia(filePath, {
      mimeType: mediaType
    });
    
    console.log(`✅ Media uploaded successfully. Media ID: ${mediaUpload}`);
    return mediaUpload;
  } catch (error) {
    console.error('❌ Error uploading media to Twitter:', error);
    throw new Error(`Failed to upload media: ${error.message}`);
  }
}

// Helper function to process uploaded files
async function processUploadedFiles(files) {
  if (!files || files.length === 0) {
    return [];
  }
  
  const mediaIds = [];
  
  try {
    // Process each uploaded file
    for (const file of files) {
      const mediaId = await uploadMediaToTwitter(file.path, file.mimetype);
      mediaIds.push(mediaId);
      
      // Clean up temporary file
      try {
        await fs.remove(file.path);
        console.log(`🗑️ Cleaned up temp file: ${file.filename}`);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file:', cleanupError.message);
      }
    }
    
    return mediaIds;
  } catch (error) {
    // Clean up any remaining temp files on error
    for (const file of files) {
      try {
        await fs.remove(file.path);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp file on error:', cleanupError.message);
      }
    }
    throw error;
  }
}

// Helper function to extract media files from multer fields
function extractMediaFiles(req) {
  const files = [];
  
  // Multer stores files with field names like media_0, media_1, etc.
  Object.keys(req.files || {}).forEach(fieldName => {
    if (fieldName.startsWith('media_')) {
      const fileArray = req.files[fieldName];
      if (Array.isArray(fileArray)) {
        files.push(...fileArray);
      } else {
        files.push(fileArray);
      }
    }
  });
  
  return files;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get pending tweets
app.get('/api/tweets', (req, res) => {
  const queue = loadQueue();
  res.json(queue.tweets);
});

// Generate new tweet for approval
app.post('/api/generate', (req, res) => {
  const queue = loadQueue();
  const newTweet = {
    id: Date.now().toString(),
    content: generateRandomTweet(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  queue.tweets.push(newTweet);
  saveQueue(queue);
  
  res.json(newTweet);
});

// Update tweet content
app.put('/api/tweets/:id', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  const queue = loadQueue();
  const tweetIndex = queue.tweets.findIndex(t => t.id === id);
  
  if (tweetIndex === -1) {
    return res.status(404).json({ error: 'Tweet not found' });
  }
  
  queue.tweets[tweetIndex].content = content;
  queue.tweets[tweetIndex].updatedAt = new Date().toISOString();
  saveQueue(queue);
  
  res.json(queue.tweets[tweetIndex]);
});

// Approve and post tweet
app.post('/api/tweets/:id/approve', async (req, res) => {
  const { id } = req.params;
  
  const queue = loadQueue();
  const tweetIndex = queue.tweets.findIndex(t => t.id === id);
  
  if (tweetIndex === -1) {
    return res.status(404).json({ error: 'Tweet not found' });
  }
  
  const tweet = queue.tweets[tweetIndex];
  
  // Check if tweet is already posted
  if (tweet.status === 'posted') {
    return res.json({ success: true, tweet, message: 'Tweet was already posted' });
  }
  
  try {
    console.log(`Attempting to post tweet: ${tweet.content.substring(0, 50)}...`);
    
    // Post to Twitter
    const tweetResponse = await client.v2.tweet(tweet.content);
    
    console.log('Tweet posted successfully to Twitter:', tweetResponse.data?.id);
    
    // Update status
    tweet.status = 'posted';
    tweet.postedAt = new Date().toISOString();
    tweet.twitterId = tweetResponse.data?.id; // Store Twitter ID for reference
    saveQueue(queue);
    
    res.json({ success: true, tweet });
  } catch (error) {
    console.error('Twitter API Error Details:', {
      code: error.code,
      message: error.message,
      data: error.data
    });
    
    // Check if this is truly a failure or if the tweet might have gone through
    let errorMessage = 'Failed to post tweet';
    let shouldReturnError = true;
    
    if (error.code === 403) {
      if (error.data && error.data.detail) {
        if (error.data.detail.includes('duplicate')) {
          // For duplicate errors, let's check if the tweet is actually unique
          console.log('Duplicate content detected for tweet:', tweet.content);
          errorMessage = 'Tweet content appears to be a duplicate. Try editing to make it more unique.';
        } else {
          errorMessage = 'Access forbidden. Your API key may not have write permissions.';
        }
      } else {
        errorMessage = 'Access forbidden. Check your Twitter API permissions.';
      }
    } else if (error.code === 401) {
      errorMessage = 'Authentication failed. Check your Twitter API credentials.';
    } else if (error.code === 429) {
      errorMessage = 'Rate limit exceeded. Please wait before posting again.';
    } else if (error.code >= 500) {
      errorMessage = 'Twitter server error. Please try again later.';
    }
    
    // Don't update tweet status to failed unless we're sure it failed
    if (shouldReturnError) {
      res.status(error.code === 429 ? 429 : 500).json({ 
        error: errorMessage, 
        details: error.message,
        code: error.code,
        canRetry: error.code === 429 || error.code >= 500
      });
    }
  }
});

// Reject tweet
app.post('/api/tweets/:id/reject', (req, res) => {
  const { id } = req.params;
  
  const queue = loadQueue();
  queue.tweets = queue.tweets.filter(t => t.id !== id);
  saveQueue(queue);
  
  res.json({ success: true });
});

// Clear posted tweets
app.delete('/api/tweets/posted', (req, res) => {
  const queue = loadQueue();
  queue.tweets = queue.tweets.filter(t => t.status !== 'posted');
  saveQueue(queue);
  
  res.json({ success: true });
});

// Auto-generate tweets (for scheduled generation)
app.post('/api/auto-generate', (req, res) => {
  const queue = loadQueue();
  const pendingCount = queue.tweets.filter(t => t.status === 'pending').length;
  
  // Don't generate if there are already 5 pending tweets
  if (pendingCount >= 5) {
    return res.json({ message: 'Queue is full', pendingCount });
  }
  
  const newTweet = {
    id: Date.now().toString(),
    content: generateRandomTweet(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    autoGenerated: true
  };
  
  queue.tweets.push(newTweet);
  saveQueue(queue);
  
  res.json({ success: true, tweet: newTweet, pendingCount: pendingCount + 1 });
});

// Auto-generate tweets with AI context
app.post('/api/auto-generate', async (req, res) => {
  const { count = 5 } = req.body;
  
  try {
    const queue = loadQueue();
    const generatedTweets = [];
    
    for (let i = 0; i < count; i++) {
      const newTweet = {
        id: Date.now().toString() + '_' + i,
        content: generateRandomTweet(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        autoGenerated: true
      };
      
      queue.tweets.push(newTweet);
      generatedTweets.push(newTweet);
    }
    
    saveQueue(queue);
    res.json({ success: true, tweets: generatedTweets, totalGenerated: count });
  } catch (error) {
    console.error('Error auto-generating tweets:', error);
    res.status(500).json({ error: 'Failed to auto-generate tweets' });
  }
});

// Post tweet directly to Twitter
app.post('/api/post-direct', upload.fields([
  { name: 'media_0', maxCount: 1 },
  { name: 'media_1', maxCount: 1 },
  { name: 'media_2', maxCount: 1 },
  { name: 'media_3', maxCount: 1 }
]), async (req, res) => {
  const { content } = req.body;
  
  if (!content && (!req.files || Object.keys(req.files).length === 0)) {
    return res.status(400).json({ error: 'Tweet content or media is required' });
  }
  
  try {
    console.log(`Posting tweet directly: ${content || 'Media-only tweet'}...`);
    
    // Extract and process media files
    const mediaFiles = extractMediaFiles(req);
    const mediaIds = await processUploadedFiles(mediaFiles);
    
    // Create tweet options
    const tweetOptions = {};
    if (content && content.trim()) {
      tweetOptions.text = content.trim();
    }
    if (mediaIds.length > 0) {
      tweetOptions.media = { media_ids: mediaIds };
    }
    
    // Post to Twitter
    const tweet = await client.v2.tweet(tweetOptions);
    
    // Create tweet object for storage
    const tweetData = {
      id: Date.now().toString(),
      content: content || '',
      status: 'posted',
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      twitterId: tweet.data.id,
      autoGenerated: false,
      media: mediaFiles.map(file => ({
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        originalName: file.originalname,
        size: file.size
      }))
    };
    
    // Add to queue for record keeping
    const queue = loadQueue();
    queue.tweets.unshift(tweetData);
    saveQueue(queue);
    
    console.log(`Tweet posted successfully to Twitter: ${tweet.data.id}`);
    
    res.json({ success: true, tweet: tweetData, twitterId: tweet.data.id });
  } catch (error) {
    console.error('Twitter API Error Details:', {
      code: error.code,
      message: error.message,
      data: error.data
    });
    
    // Clean up any remaining temp files on error
    try {
      const mediaFiles = extractMediaFiles(req);
      for (const file of mediaFiles) {
        await fs.remove(file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files after error:', cleanupError.message);
    }
    
    let errorMessage = 'Failed to post tweet';
    
    if (error.code === 403) {
      if (error.data && error.data.detail && error.data.detail.includes('duplicate')) {
        errorMessage = 'Tweet content appears to be a duplicate. Try editing to make it more unique.';
      } else {
        errorMessage = 'Access forbidden. Your API key may not have write permissions.';
      }
    } else if (error.code === 401) {
      errorMessage = 'Authentication failed. Check your Twitter API credentials.';
    } else if (error.code === 429) {
      errorMessage = 'Rate limit exceeded. Please wait before posting again.';
    } else if (error.code >= 500) {
      errorMessage = 'Twitter server error. Please try again later.';
    }
    
    res.status(error.code === 429 ? 429 : 500).json({
      error: errorMessage,
      details: error.message,
      code: error.code,
      canRetry: error.code === 429 || error.code >= 500
    });
  }
});

// Save tweet as draft
app.post('/api/save-draft', upload.fields([
  { name: 'media_0', maxCount: 1 },
  { name: 'media_1', maxCount: 1 },
  { name: 'media_2', maxCount: 1 },
  { name: 'media_3', maxCount: 1 }
]), async (req, res) => {
  const { content } = req.body;
  
  if (!content && (!req.files || Object.keys(req.files).length === 0)) {
    return res.status(400).json({ error: 'Tweet content or media is required' });
  }
  
  try {
    // Extract media files information (don't upload to Twitter yet)
    const mediaFiles = extractMediaFiles(req);
    const mediaInfo = [];
    
    // Process media files for storage info (but keep files for later upload)
    for (const file of mediaFiles) {
      // Store media info for the draft
      mediaInfo.push({
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        tempPath: file.path, // Keep temp file for later use
        filename: file.filename
      });
    }
    
    const queue = loadQueue();
    const newTweet = {
      id: Date.now().toString(),
      content: content || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      autoGenerated: false,
      draft: true,
      media: mediaInfo
    };
    
    queue.tweets.unshift(newTweet);
    saveQueue(queue);
    
    const pendingCount = queue.tweets.filter(t => t.status === 'pending').length;
    
    console.log(`Draft saved with ${mediaInfo.length} media files`);
    res.json({ success: true, tweet: newTweet, pendingCount });
  } catch (error) {
    console.error('Error saving draft:', error);
    
    // Clean up temp files on error
    try {
      const mediaFiles = extractMediaFiles(req);
      for (const file of mediaFiles) {
        await fs.remove(file.path);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files after error:', cleanupError.message);
    }
    
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Post tweet from queue
app.post('/api/tweet/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const queue = loadQueue();
    const tweet = queue.tweets.find(t => t.id === id);
    
    if (!tweet) {
      return res.status(404).json({ error: 'Tweet not found' });
    }
    
    if (tweet.status === 'posted') {
      return res.status(400).json({ error: 'Tweet already posted' });
    }
    
    console.log(`Attempting to post tweet: ${tweet.content.substring(0, 50)}...`);
    
    // Handle media files if present
    let mediaIds = [];
    if (tweet.media && tweet.media.length > 0) {
      console.log(`📎 Processing ${tweet.media.length} media files...`);
      
      // Upload media files to Twitter
      for (const mediaInfo of tweet.media) {
        if (mediaInfo.tempPath && await fs.pathExists(mediaInfo.tempPath)) {
          try {
            const mediaId = await uploadMediaToTwitter(mediaInfo.tempPath, mediaInfo.mimetype);
            mediaIds.push(mediaId);
            
            // Clean up temp file after successful upload
            await fs.remove(mediaInfo.tempPath);
            console.log(`✅ Uploaded and cleaned up: ${mediaInfo.originalName}`);
          } catch (uploadError) {
            console.error(`❌ Failed to upload media: ${mediaInfo.originalName}`, uploadError);
            // Clean up temp file even on failure
            try {
              await fs.remove(mediaInfo.tempPath);
            } catch (cleanupError) {
              console.warn('Failed to cleanup temp file:', cleanupError.message);
            }
            throw new Error(`Failed to upload media: ${mediaInfo.originalName}`);
          }
        } else {
          console.warn(`⚠️ Media file not found: ${mediaInfo.tempPath || 'No path'}`);
        }
      }
    }
    
    // Create tweet options
    const tweetOptions = {};
    if (tweet.content && tweet.content.trim()) {
      tweetOptions.text = tweet.content.trim();
    }
    if (mediaIds.length > 0) {
      tweetOptions.media = { media_ids: mediaIds };
    }
    
    // Post to Twitter
    const twitterResponse = await client.v2.tweet(tweetOptions);
    
    // Update tweet status
    tweet.status = 'posted';
    tweet.postedAt = new Date().toISOString();
    tweet.twitterId = twitterResponse.data.id;
    
    // Update media info to remove temp paths
    if (tweet.media) {
      tweet.media = tweet.media.map(media => ({
        type: media.type,
        originalName: media.originalName,
        size: media.size
        // Remove tempPath and filename as they're no longer needed
      }));
    }
    
    saveQueue(queue);
    
    console.log(`Tweet posted successfully to Twitter: ${twitterResponse.data.id}`);
    res.json({ success: true, tweet, twitterId: twitterResponse.data.id });
  } catch (error) {
    console.error('Twitter API Error:', error);
    let errorMessage = 'Failed to post tweet';
    
    if (error.code === 403) {
      if (error.data && error.data.detail && error.data.detail.includes('duplicate')) {
        errorMessage = 'Tweet content appears to be a duplicate. Try editing to make it more unique.';
      } else {
        errorMessage = 'Access forbidden. Your API key may not have write permissions.';
      }
    } else if (error.code === 401) {
      errorMessage = 'Authentication failed. Check your Twitter API credentials.';
    } else if (error.code === 429) {
      errorMessage = 'Rate limit exceeded. Please wait before posting again.';
    } else if (error.code >= 500) {
      errorMessage = 'Twitter server error. Please try again later.';
    }
    
    res.status(error.code === 429 ? 429 : 500).json({
      error: errorMessage,
      details: error.message,
      code: error.code,
      canRetry: error.code === 429 || error.code >= 500
    });
  }
});

// Rate limiting protection for analytics
let analyticsCache = {};
const ANALYTICS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for long-term caching
let lastAnalyticsCall = 0;
const ANALYTICS_COOLDOWN = 30 * 1000; // 30 seconds between calls
let rateLimitInfo = {
  remaining: 25, // Default to full quota
  limit: 25,
  resetTime: null,
  lastUpdated: null
};

// Auto-refresh analytics once per day (at 9 AM UTC)
let lastAutoRefresh = 0;
const AUTO_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

function shouldAutoRefresh() {
  const now = Date.now();
  const timeSinceLastAuto = now - lastAutoRefresh;
  return timeSinceLastAuto >= AUTO_REFRESH_INTERVAL;
}

function updateRateLimitInfo(headers) {
  if (headers) {
    const newRateLimitInfo = {
      remaining: parseInt(headers['x-user-limit-24hour-remaining']) || 0,
      limit: parseInt(headers['x-user-limit-24hour-limit']) || 25,
      resetTime: parseInt(headers['x-user-limit-24hour-reset']) * 1000 || null,
      lastUpdated: Date.now()
    };
    
    // Only update if we got valid data
    if (newRateLimitInfo.remaining !== undefined && newRateLimitInfo.limit !== undefined) {
      rateLimitInfo = newRateLimitInfo;
      console.log(`Rate limit updated: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`);
    }
  }
}

// Get rate limit status
app.get('/api/rate-limit', (req, res) => {
  const now = Date.now();
  const timeUntilReset = rateLimitInfo.resetTime ? Math.max(0, rateLimitInfo.resetTime - now) : null;
  
  res.json({
    remaining: rateLimitInfo.remaining,
    limit: rateLimitInfo.limit,
    resetTime: rateLimitInfo.resetTime,
    timeUntilResetHours: timeUntilReset ? Math.ceil(timeUntilReset / (60 * 60 * 1000)) : null,
    lastUpdated: rateLimitInfo.lastUpdated,
    canRefresh: rateLimitInfo.remaining > 0,
    autoRefreshAvailable: shouldAutoRefresh(),
    status: rateLimitInfo.remaining > 0 ? 'available' : 'rate_limited'
  });
});

// Manual analytics refresh endpoint
app.post('/api/refresh-analytics', async (req, res) => {
  try {
    // Check rate limits first
    if (rateLimitInfo.remaining !== null && rateLimitInfo.remaining <= 0) {
      const timeUntilReset = rateLimitInfo.resetTime ? Math.max(0, rateLimitInfo.resetTime - Date.now()) : null;
      const hoursUntilReset = timeUntilReset ? Math.ceil(timeUntilReset / (60 * 60 * 1000)) : 'unknown';
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `No analytics refreshes remaining (0/${rateLimitInfo.limit}). Resets in ${hoursUntilReset} hours.`,
        resetTime: rateLimitInfo.resetTime,
        rate_limit: rateLimitInfo,
        cached_data: analyticsCache.analytics?.data || null
      });
    }

    console.log('Manual analytics refresh requested...');
    
    try {
      // Fetch fresh analytics - DON'T clear cache, only update on success
      const analyticsData = await fetchFreshAnalytics();
      
      // Update auto-refresh timestamp if this was successful
      lastAutoRefresh = Date.now();
      
      res.json({
        success: true,
        data: analyticsData,
        rate_limit: rateLimitInfo,
        refreshed_at: new Date().toISOString(),
        message: `Analytics refreshed successfully. ${rateLimitInfo.remaining}/${rateLimitInfo.limit} refreshes remaining.`
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Manual refresh failed:', error);
    
    // Update rate limit info from error if available
    if (error.headers) {
      updateRateLimitInfo(error.headers);
    }
    
    const isRateLimited = error.code === 429;
    const timeUntilReset = rateLimitInfo.resetTime ? Math.max(0, rateLimitInfo.resetTime - Date.now()) : null;
    const hoursUntilReset = timeUntilReset ? Math.ceil(timeUntilReset / (60 * 60 * 1000)) : 'unknown';
    
    res.status(error.code === 429 ? 429 : 500).json({
      error: isRateLimited ? 'Rate limited' : 'Refresh failed',
      message: isRateLimited 
        ? `Rate limit exceeded. Resets in ${hoursUntilReset} hours.`
        : error.message,
      rate_limit: rateLimitInfo,
      cached_data: analyticsCache.analytics?.data || null
    });
  }
});

async function fetchFreshAnalytics() {
  console.log('Fetching fresh analytics data...');
  
  // Start with existing cached data as fallback
  let profile = analyticsCache.profile?.data || null;
  let recentTweets = null;
  let tweetsFromCache = false;
  
  // Get user profile with metrics - only update cache on success
  try {
    const profileResponse = await client.v2.me({
      'user.fields': ['public_metrics', 'created_at', 'description', 'profile_image_url', 'username', 'name']
    });
    
    // SUCCESS: Update profile cache and use fresh data
    profile = profileResponse.data;
    analyticsCache.profile = { data: profile, timestamp: Date.now() };
    
    // Update rate limit info from successful call
    updateRateLimitInfo(profileResponse._headers);
    console.log('✅ Profile data updated successfully');
  } catch (profileError) {
    console.log('❌ Profile fetch failed:', profileError.message);
    updateRateLimitInfo(profileError.headers);
    
    // Keep using cached profile data (don't update cache)
    if (analyticsCache.profile) {
      profile = analyticsCache.profile.data;
      console.log('📦 Using cached profile data');
    } else {
      // No cached data available - this will result in fallback data
      console.log('⚠️ No cached profile data available');
    }
  }

  // Get recent tweets with metrics - only update cache on success
  try {
    if (profile && profile.id) {
      const tweetsResponse = await client.v2.userTimeline(profile.id, {
        max_results: 10,
        'tweet.fields': ['created_at', 'public_metrics', 'text']
      });
      
      // SUCCESS: Update tweets cache and use fresh data
      recentTweets = tweetsResponse;
      analyticsCache.recentTweets = { data: recentTweets.data, timestamp: Date.now() };
      
      // Update rate limit info
      updateRateLimitInfo(tweetsResponse._headers);
      console.log('✅ Recent tweets updated successfully');
    }
  } catch (tweetsError) {
    console.log('❌ Recent tweets fetch failed:', tweetsError.code === 429 ? 'Rate limited' : tweetsError.message);
    updateRateLimitInfo(tweetsError.headers);
    
    // Keep using cached tweets data (don't update cache)
    if (analyticsCache.recentTweets) {
      recentTweets = { data: analyticsCache.recentTweets.data };
      tweetsFromCache = true;
      console.log('📦 Using cached tweets data');
    } else {
      // No cached data available
      console.log('⚠️ No cached tweets data available');
    }
  }

  // Calculate total engagement from recent tweets
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalReplies = 0;
  let totalQuotes = 0;
  let tweetsAnalyzed = 0;

  if (recentTweets && recentTweets.data && Array.isArray(recentTweets.data)) {
    tweetsAnalyzed = recentTweets.data.length;
    recentTweets.data.forEach(tweet => {
      if (tweet && tweet.public_metrics) {
        totalLikes += tweet.public_metrics.like_count || 0;
        totalRetweets += tweet.public_metrics.retweet_count || 0;
        totalReplies += tweet.public_metrics.reply_count || 0;
        totalQuotes += tweet.public_metrics.quote_count || 0;
      }
    });
  }

  // Build analytics data - use cached data as fallback for missing pieces
  const analyticsData = {
    profile: profile || { 
      public_metrics: { followers_count: 0, following_count: 0, tweet_count: 0 },
      name: 'Profile Unavailable',
      username: 'unavailable'
    },
    recent_engagement: {
      total_likes: totalLikes,
      total_retweets: totalRetweets,
      total_replies: totalReplies,
      total_quotes: totalQuotes,
      tweets_analyzed: tweetsAnalyzed,
      avg_likes_per_tweet: tweetsAnalyzed > 0 ? Math.round(totalLikes / tweetsAnalyzed) : 0
    },
    recent_tweets: recentTweets?.data || [],
    cache_info: {
      from_cache: tweetsFromCache,
      cached_at: tweetsFromCache ? analyticsCache.recentTweets?.timestamp : null,
      refreshed_at: new Date().toISOString(),
      profile_from_cache: !profile || analyticsCache.profile?.data === profile,
      tweets_from_cache: tweetsFromCache
    },
    rate_limit: rateLimitInfo
  };

  // Only update main analytics cache if we got at least some data
  if (profile || recentTweets) {
    const now = Date.now();
    lastAnalyticsCall = now;
    analyticsCache.analytics = {
      data: analyticsData,
      timestamp: now
    };
    console.log('✅ Analytics cache updated with latest data');
  } else {
    console.log('⚠️ No new data retrieved - analytics cache unchanged'); 
  }

  return analyticsData;
}

// Get user profile data
app.get('/api/profile', async (req, res) => {
  try {
    // Rate limit protection
    const now = Date.now();
    if (now - lastAnalyticsCall < ANALYTICS_COOLDOWN) {
      if (analyticsCache.profile && (now - analyticsCache.profile.timestamp) < ANALYTICS_CACHE_TTL) {
        return res.json(analyticsCache.profile.data);
      }
    }

    console.log('Fetching fresh profile data...');
    const user = await client.v2.me({
      'user.fields': [
        'created_at',
        'description', 
        'entities',
        'id',
        'location',
        'name',
        'pinned_tweet_id',
        'profile_image_url',
        'protected',
        'public_metrics',
        'url',
        'username',
        'verified'
      ]
    });
    
    lastAnalyticsCall = now;
    analyticsCache.profile = {
      data: user.data,
      timestamp: now
    };
    
    res.json(user.data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    
    // Return cached data if available during errors
    if (analyticsCache.profile) {
      console.log('Returning cached profile data due to API error');
      return res.json(analyticsCache.profile.data);
    }
    
    let errorMessage = 'Failed to fetch profile data';
    if (error.code === 429) {
      errorMessage = 'Rate limited - please wait a moment before refreshing';
    } else if (error.code === 401) {
      errorMessage = 'Authentication error - check API credentials';
    }
    
    res.status(error.code === 429 ? 429 : 500).json({ 
      error: errorMessage, 
      details: error.message,
      code: error.code
    });
  }
});

// Get recent tweets with metrics  
app.get('/api/recent-tweets', async (req, res) => {
  try {
    // Rate limit protection
    const now = Date.now();
    if (now - lastAnalyticsCall < ANALYTICS_COOLDOWN) {
      if (analyticsCache.recentTweets && (now - analyticsCache.recentTweets.timestamp) < ANALYTICS_CACHE_TTL) {
        return res.json(analyticsCache.recentTweets.data);
      }
    }

    console.log('Fetching fresh recent tweets...');
    const currentUser = await client.v2.me();
    
    if (!currentUser || !currentUser.data || !currentUser.data.id) {
      throw new Error('Unable to get current user ID');
    }
    
    const tweets = await client.v2.userTimeline(currentUser.data.id, {
      max_results: 10,
      'tweet.fields': [
        'author_id',
        'context_annotations', 
        'created_at',
        'entities',
        'id',
        'in_reply_to_user_id',
        'lang',
        'public_metrics',
        'text'
      ]
    });
    
    lastAnalyticsCall = now;
    const tweetData = tweets.data || [];
    analyticsCache.recentTweets = {
      data: tweetData,
      timestamp: now
    };
    
    res.json(tweetData);
  } catch (error) {
    console.error('Error fetching recent tweets:', error);
    
    // Return cached data if available
    if (analyticsCache.recentTweets) {
      console.log('Returning cached tweets due to API error');
      return res.json(analyticsCache.recentTweets.data);
    }
    
    let errorMessage = 'Failed to fetch recent tweets';
    if (error.code === 429) {
      errorMessage = 'Rate limited - recent tweets temporarily unavailable';
    }
    
    res.status(error.code === 429 ? 429 : 500).json({ 
      error: errorMessage, 
      details: error.message,
      code: error.code,
      cached: false
    });
  }
});

// Get followers count and following count
app.get('/api/followers', async (req, res) => {
  try {
    // Rate limit protection
    const now = Date.now();
    if (now - lastAnalyticsCall < ANALYTICS_COOLDOWN) {
      if (analyticsCache.followers && (now - analyticsCache.followers.timestamp) < ANALYTICS_CACHE_TTL) {
        return res.json(analyticsCache.followers.data);
      }
    }

    console.log('Fetching fresh follower data...');
    const currentUser = await client.v2.me({
      'user.fields': ['public_metrics', 'username', 'name']
    });
    
    if (!currentUser || !currentUser.data) {
      throw new Error('Unable to get current user data');
    }
    
    const followersData = {
      followers_count: currentUser.data.public_metrics?.followers_count || 0,
      following_count: currentUser.data.public_metrics?.following_count || 0,
      tweet_count: currentUser.data.public_metrics?.tweet_count || 0,
      listed_count: currentUser.data.public_metrics?.listed_count || 0,
      username: currentUser.data.username || 'N/A',
      name: currentUser.data.name || 'N/A'
    };
    
    lastAnalyticsCall = now;
    analyticsCache.followers = {
      data: followersData,
      timestamp: now
    };
    
    res.json(followersData);
  } catch (error) {
    console.error('Error fetching followers:', error);
    
    // Return cached data if available
    if (analyticsCache.followers) {
      console.log('Returning cached followers due to API error');
      return res.json(analyticsCache.followers.data);
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch followers data', 
      details: error.message,
      code: error.code
    });
  }
});

// Get specific tweet metrics
app.get('/api/tweet/:id/metrics', async (req, res) => {
  const { id } = req.params;
  
  try {
    const tweet = await client.v2.singleTweet(id, {
      'tweet.fields': [
        'author_id',
        'created_at',
        'public_metrics',
        'text',
        'context_annotations'
      ]
    });
    
    res.json({
      tweet: tweet.data,
      metrics: tweet.data.public_metrics
    });
  } catch (error) {
    console.error('Error fetching tweet metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tweet metrics', 
      details: error.message 
    });
  }
});

// Get analytics dashboard data
app.get('/api/analytics', async (req, res) => {
  try {
    // Check if we have cached data to return
    if (analyticsCache.analytics && analyticsCache.analytics.data) {
      const cachedData = analyticsCache.analytics.data;
      const cacheAge = Date.now() - analyticsCache.analytics.timestamp;
      
      // Check if we should auto-refresh (once per day)
      const shouldAutoRefreshNow = shouldAutoRefresh() && rateLimitInfo.remaining > 0;
      
      if (!shouldAutoRefreshNow) {
        // Return cached data with updated cache info
        console.log('📦 Returning cached analytics data (no auto-refresh needed)');
        return res.json({
          ...cachedData,
          cache_info: {
            ...cachedData.cache_info,
            from_cache: true,
            cache_age_hours: Math.floor(cacheAge / (60 * 60 * 1000)),
            last_cached: new Date(analyticsCache.analytics.timestamp).toISOString()
          },
          rate_limit: rateLimitInfo
        });
      }
    }

    // Auto-refresh if conditions are met
    if (shouldAutoRefresh() && rateLimitInfo.remaining > 0) {
      console.log('🔄 Performing daily auto-refresh of analytics...');
      try {
        const freshData = await fetchFreshAnalytics();
        lastAutoRefresh = Date.now(); // Update auto-refresh timestamp
        return res.json(freshData);
      } catch (error) {
        console.error('Auto-refresh failed, falling back to cache:', error.message);
        // Fall through to return cached data
      }
    }

    // Return cached data if available (preferred over fallback)
    if (analyticsCache.analytics && analyticsCache.analytics.data) {
      const cachedData = analyticsCache.analytics.data;
      const cacheAge = Date.now() - analyticsCache.analytics.timestamp;
      
      console.log('📦 Returning cached analytics data (auto-refresh failed or not available)');
      return res.json({
        ...cachedData,
        cache_info: {
          ...cachedData.cache_info,
          from_cache: true,
          cache_age_hours: Math.floor(cacheAge / (60 * 60 * 1000)),
          last_cached: new Date(analyticsCache.analytics.timestamp).toISOString(),
          auto_refresh_available: shouldAutoRefresh(),
          rate_limited: rateLimitInfo.remaining <= 0
        },
        rate_limit: rateLimitInfo
      });
    }

    // Only show fallback data if we have NEVER successfully fetched any data
    console.log('⚠️ No cached analytics data available - showing initial fallback');
    
    const now = Date.now();
    const timeUntilReset = rateLimitInfo.resetTime ? Math.max(0, rateLimitInfo.resetTime - now) : null;
    const hoursUntilReset = timeUntilReset ? Math.ceil(timeUntilReset / (60 * 60 * 1000)) : null;
    
    const fallbackData = {
      profile: { 
        public_metrics: { 
          followers_count: 0, 
          following_count: 0, 
          tweet_count: 0,
          listed_count: 0
        },
        name: 'Data Unavailable',
        username: 'rate_limited',
        description: 'Profile data temporarily unavailable due to API rate limits',
        created_at: new Date().toISOString()
      },
      recent_engagement: {
        total_likes: 0,
        total_retweets: 0,
        total_replies: 0,
        total_quotes: 0,
        tweets_analyzed: 0,
        avg_likes_per_tweet: 0
      },
      recent_tweets: [],
      cache_info: {
        from_cache: false,
        no_data: true,
        message: rateLimitInfo.remaining <= 0 
          ? `Rate limited: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} refreshes remaining. Resets in ${hoursUntilReset || 'unknown'} hours.`
          : 'No analytics data available - try refreshing manually',
        rate_limited: rateLimitInfo.remaining <= 0,
        refreshes_remaining: rateLimitInfo.remaining,
        total_refreshes: rateLimitInfo.limit,
        reset_time: rateLimitInfo.resetTime,
        hours_until_reset: hoursUntilReset,
        never_fetched: true
      },
      rate_limit: {
        ...rateLimitInfo,
        status: rateLimitInfo.remaining <= 0 ? 'rate_limited' : 'available',
        status_message: rateLimitInfo.remaining <= 0 
          ? `Rate limited - ${hoursUntilReset || 'unknown'} hours until reset`
          : `${rateLimitInfo.remaining}/${rateLimitInfo.limit} refreshes available`
      }
    };
    
    res.json(fallbackData);
  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    
    // Even on error, try to return cached data if available
    if (analyticsCache.analytics && analyticsCache.analytics.data) {
      console.log('📦 Returning cached data due to endpoint error');
      const cachedData = analyticsCache.analytics.data;
      const cacheAge = Date.now() - analyticsCache.analytics.timestamp;
      
      return res.json({
        ...cachedData,
        cache_info: {
          ...cachedData.cache_info,
          from_cache: true,
          cache_age_hours: Math.floor(cacheAge / (60 * 60 * 1000)),
          last_cached: new Date(analyticsCache.analytics.timestamp).toISOString(),
          error_fallback: true
        },
        rate_limit: rateLimitInfo
      });
    }
    
    res.status(500).json({ 
      error: 'Analytics temporarily unavailable',
      details: error.message,
      rate_limit: rateLimitInfo
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

// Debug endpoint to check environment variables (for troubleshooting)
app.get('/debug-env', (req, res) => {
  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    TWITTER_API_KEY_LENGTH: process.env.TWITTER_API_KEY ? process.env.TWITTER_API_KEY.length : 'not set',
    TWITTER_API_KEY_FIRST_10: process.env.TWITTER_API_KEY ? process.env.TWITTER_API_KEY.substring(0, 10) : 'not set',
    OPENAI_API_KEY_LENGTH: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 'not set',
    OPENAI_API_KEY_FIRST_10: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) : 'not set',
    OPENAI_API_KEY_HAS_QUOTES: process.env.OPENAI_API_KEY ? (process.env.OPENAI_API_KEY.startsWith('"') && process.env.OPENAI_API_KEY.endsWith('"')) : false,
    OPENAI_AVAILABLE: openaiAvailable,
    TIMESTAMP: new Date().toISOString()
  };
  
  res.json(envDebug);
});

// Clear analytics cache (for debugging/manual refresh)
app.post('/api/clear-cache', (req, res) => {
  const hadCachedData = Object.keys(analyticsCache).length > 0;
  const cacheInfo = {
    had_profile_cache: !!analyticsCache.profile,
    had_tweets_cache: !!analyticsCache.recentTweets,
    had_analytics_cache: !!analyticsCache.analytics,
    cache_age_hours: analyticsCache.analytics ? 
      Math.floor((Date.now() - analyticsCache.analytics.timestamp) / (60 * 60 * 1000)) : 0
  };
  
  // Clear all caches
  analyticsCache = {};
  lastAnalyticsCall = 0;
  
  console.log('🗑️ Analytics cache manually cleared');
  res.json({ 
    success: true, 
    message: hadCachedData ? 'Analytics cache cleared - previous data removed' : 'No cached data was found to clear',
    previous_cache_info: cacheInfo,
    timestamp: new Date().toISOString(),
    warning: 'Next analytics request will show fallback data until successful API call'
  });
});

// Chat endpoint for AI assistant
app.post('/api/chat', async (req, res) => {
  const { message, context = {} } = req.body;
  
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Check if OpenAI is available
  if (!openaiAvailable || !openai) {
    return res.status(503).json({ 
      error: 'AI chat is currently unavailable', 
      details: 'OpenAI API key not configured or invalid. Please check your OPENAI_API_KEY environment variable.' 
    });
  }

  try {
    console.log(`AI Chat request: ${message.substring(0, 100)}...`);

    // Create a Twitter-focused system prompt
    const systemPrompt = `You are an AI assistant specialized in Twitter/X management for a Creative Tech DJ. 

Your expertise includes:
- Creating engaging tweets about music, DJ performances, and creative technology
- Analyzing Twitter analytics and providing actionable insights
- Suggesting optimal posting times and content strategies
- Helping with hashtag strategies and audience engagement
- Providing advice on building a music/DJ brand on social media

Current context:
- User has ${context.remainingTweets || 'several'} tweets remaining today
- Analytics rate limits: ${context.analyticsRemaining || 'unknown'} refreshes available
- Recent performance: ${context.recentEngagement || 'data not available'}

Be helpful, creative, and focused on practical Twitter/music industry advice. Keep responses concise but informative.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;
    
    console.log(`AI Chat response: ${aiResponse.substring(0, 100)}...`);

    res.json({
      success: true,
      response: aiResponse,
      usage: completion.usage
    });

  } catch (error) {
    console.error('OpenAI Chat Error:', error);
    
    let errorMessage = 'Failed to get AI response';
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please check your billing.';
    } else if (error.code === 'invalid_api_key') {
      errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
      openaiAvailable = false; // Disable OpenAI for future requests
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = 'OpenAI rate limit exceeded. Please try again in a moment.';
    }

    res.status(500).json({
      error: errorMessage,
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 DJ Twitter Bot Dashboard running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to access the dashboard`);
  console.log(`🤖 Bot is ready for tweet approval and monitoring!`);
}); 