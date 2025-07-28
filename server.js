// Creative Tech DJ Twitter Bot Dashboard with Multi-Agent Framework
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { TwitterApi } = require('twitter-api-v2');
const OpenAI = require('openai');

// Multi-Agent Framework Integration
const { environmentConfig } = require('./src/config/environment.js');
const { multiAgentOrchestrator } = require('./src/agents/MultiAgentOrchestrator.js');
const { twitterAgentFactory } = require('./src/agents/TwitterContentAgents.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
let openai = null;
let openaiAvailable = false;

// Function to strip quotes from environment variables (Railway adds them automatically)
function stripQuotes(value) {
  if (!value) return value;
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

// Strip quotes from critical environment variables
const TWITTER_API_KEY = stripQuotes(process.env.TWITTER_API_KEY);
const TWITTER_API_SECRET = stripQuotes(process.env.TWITTER_API_SECRET);
const ACCESS_TOKEN = stripQuotes(process.env.ACCESS_TOKEN);
const ACCESS_SECRET = stripQuotes(process.env.ACCESS_SECRET);
const OPENAI_API_KEY = stripQuotes(process.env.OPENAI_API_KEY);

console.log('🔧 Environment variables processed:', {
  TWITTER_API_KEY_LENGTH: TWITTER_API_KEY ? TWITTER_API_KEY.length : 'not set',
  OPENAI_API_KEY_LENGTH: OPENAI_API_KEY ? OPENAI_API_KEY.length : 'not set',
  OPENAI_KEY_PREVIEW: OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 10)}...` : 'not set'
});

// Initialize Twitter client with processed variables
const client = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_SECRET,
  accessToken: ACCESS_TOKEN,
  accessSecret: ACCESS_SECRET,
});

// Initialize OpenAI client with processed variables
try {
  if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    openaiAvailable = true;
    console.log('✅ OpenAI client initialized successfully');
  } else {
    console.log('⚠️  OpenAI API key not provided or invalid - AI chat will be disabled');
  }
} catch (error) {
  console.log('⚠️  Failed to initialize OpenAI client:', error.message);
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/'); // Store files in an 'uploads' directory
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
    }
  }),
  fileFilter: (req, file, cb) => {
    // Allow only image and video files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  }
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

// Express Middleware Configuration
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data'))); // Serve data directory
app.use('/content', express.static(path.join(__dirname, 'content'))); // Serve content directory
app.use('/temp-uploads', express.static(path.join(__dirname, 'temp-uploads'))); // Serve temp uploads
app.use('/outputs/videos', express.static(path.join(__dirname, 'outputs', 'videos'))); // Serve permanent videos
app.use('/outputs/images', express.static(path.join(__dirname, 'outputs', 'images'))); // Serve generated images
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Fallback route for root path if static file doesn't exist
app.get('/', (req, res) => {
  // Check if index.html exists
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback to a simple status page
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Creative Tech DJ Twitter Bot</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>🎵 Creative Tech DJ Twitter Bot</h1>
          <p>Server is running successfully!</p>
          <p>Status: <strong>OK</strong></p>
          <p>Uptime: ${Math.round(process.uptime())} seconds</p>
          <p><a href="/health">Health Check</a></p>
        </body>
      </html>
    `);
  }
});

// Routes

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
  try {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check environment variables (for troubleshooting)
app.get('/debug-env', (req, res) => {
  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    TWITTER_API_KEY_LENGTH: TWITTER_API_KEY ? TWITTER_API_KEY.length : 'not set',
    TWITTER_API_KEY_FIRST_10: TWITTER_API_KEY ? TWITTER_API_KEY.substring(0, 10) : 'not set',
    OPENAI_API_KEY_LENGTH: OPENAI_API_KEY ? OPENAI_API_KEY.length : 'not set',
    OPENAI_API_KEY_FIRST_10: OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) : 'not set',
    OPENAI_API_KEY_HAS_QUOTES: OPENAI_API_KEY ? (OPENAI_API_KEY.startsWith('"') && OPENAI_API_KEY.endsWith('"')) : false,
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

// ============================================================================
// MULTI-AGENT FRAMEWORK API ENDPOINTS
// ============================================================================

// Main multi-agent processing endpoint
app.post('/api/multi-agent', async (req, res) => {
  const { input, context = {}, workflow = 'auto' } = req.body;
  
  if (!input || input.trim().length === 0) {
    return res.status(400).json({ error: 'Input message is required' });
  }

  // Check if OpenAI is available for multi-agent processing
  if (!openaiAvailable || !openai) {
    return res.status(503).json({ 
      error: 'Multi-agent system is currently unavailable', 
      details: 'OpenAI API key not configured or invalid. Please check your OPENAI_API_KEY environment variable.' 
    });
  }

  try {
    console.log('🚀 Multi-agent request:', input.substring(0, 100) + '...');
    
    // Enhance context with current dashboard data
    const enhancedContext = {
      ...context,
      profile: analyticsCache.profile || {},
      analytics: analyticsCache.analytics || {},
      recentTweets: analyticsCache.recentTweets || [],
      timestamp: new Date().toISOString()
    };

    // Process request through multi-agent orchestrator
    const result = await multiAgentOrchestrator.processRequest(input, enhancedContext);
    
    console.log('✅ Multi-agent processing completed:', {
      workflow: result.workflow,
      agents: result.agents?.length || 0,
      success: result.success
    });

    res.json({
      success: true,
      workflow: result.workflow,
      results: result.results,
      agents: result.agents || [],
      finalOutput: result.finalOutput || null,
      metadata: result.metadata || {}
    });

  } catch (error) {
    console.error('❌ Multi-agent processing error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Multi-agent processing failed',
      details: error.message
    });
  }
});

// Get agent system status
app.get('/api/agents/status', async (req, res) => {
  try {
    const systemStatus = multiAgentOrchestrator.getSystemStatus();
    const healthCheck = await twitterAgentFactory.healthCheckAll();
    
    res.json({
      success: true,
      system: systemStatus,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Agent status check failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status',
      details: error.message
    });
  }
});

// Get available agent capabilities
app.get('/api/agents/capabilities', (req, res) => {
  try {
    const capabilities = multiAgentOrchestrator.getAvailableCapabilities();
    const agentTypes = twitterAgentFactory.getAvailableAgentTypes();
    
    res.json({
      success: true,
      capabilities,
      availableAgents: agentTypes,
      totalAgents: agentTypes.length
    });

  } catch (error) {
    console.error('❌ Failed to get agent capabilities:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get agent capabilities',
      details: error.message
    });
  }
});

// Execute specific workflow
app.post('/api/workflow/:type', async (req, res) => {
  const workflowType = req.params.type;
  const { input, context = {} } = req.body;
  
  if (!input || input.trim().length === 0) {
    return res.status(400).json({ error: 'Input message is required' });
  }

  // Check if OpenAI is available
  if (!openaiAvailable || !openai) {
    return res.status(503).json({ 
      error: 'Workflow system is currently unavailable', 
      details: 'OpenAI API key not configured or invalid.' 
    });
  }

  try {
    console.log(`🔄 Executing ${workflowType} workflow:`, input.substring(0, 100) + '...');
    
    // Force specific workflow by modifying analysis
    const enhancedContext = {
      ...context,
      profile: analyticsCache.profile || {},
      analytics: analyticsCache.analytics || {},
      recentTweets: analyticsCache.recentTweets || [],
      forceWorkflow: workflowType,
      timestamp: new Date().toISOString()
    };

    // Map workflow types to agent combinations
    const workflowAgents = {
      'content': ['content_creator'],
      'hashtag': ['hashtag_specialist'], 
      'engagement': ['engagement_optimizer'],
      'trend': ['trend_analyst'],
      'schedule': ['scheduler'],
      'video': ['video_generator'],
      'comprehensive': ['content_creator', 'hashtag_specialist', 'engagement_optimizer', 'scheduler'],
      'creative': ['trend_analyst', 'content_creator', 'hashtag_specialist']
    };

    const agents = workflowAgents[workflowType] || ['content_creator'];
    
    // Simulate analysis result to force specific workflow
    const mockAnalysis = {
      complexity: agents.length + 1,
      requiresMultiAgent: agents.length > 1,
      suggestedAgents: agents,
      workflow: agents.length > 1 ? 'comprehensive' : 'simple'
    };

    let result;
    if (agents.length === 1) {
      result = await multiAgentOrchestrator.handleSimpleTask(input, enhancedContext, mockAnalysis);
    } else {
      result = await multiAgentOrchestrator.handleComplexWorkflow(input, enhancedContext, mockAnalysis);
    }
    
    console.log(`✅ ${workflowType} workflow completed:`, result.workflow);

    res.json({
      success: true,
      workflowType,
      workflow: result.workflow,
      results: result.results,
      agents: result.agents || [],
      finalOutput: result.finalOutput || null,
      metadata: result.metadata || {}
    });

  } catch (error) {
    console.error(`❌ ${workflowType} workflow error:`, error);
    
    res.status(500).json({
      success: false,
      error: `${workflowType} workflow failed`,
      details: error.message
    });
  }
});

// ============================================================================
// ARWEAVE VIDEO GENERATION ENDPOINTS
// ============================================================================

// Generate video using Arweave system
app.post('/api/generate-video', async (req, res) => {
  const { prompt, artist = 'random', duration = 30, style = 'classic' } = req.body;
  
  if (!prompt || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Video generation prompt is required' });
  }

  // Check if OpenAI is available
  if (!openaiAvailable || !openai) {
    return res.status(503).json({ 
      error: 'Video generation is currently unavailable', 
      details: 'OpenAI API key not configured or invalid.' 
    });
  }

  try {
    console.log('🎬 Video generation request:', prompt.substring(0, 100) + '...');
    
    // Process through multi-agent system
    const videoPrompt = `Generate a video for: ${prompt}. Artist: ${artist}, Duration: ${duration}s, Style: ${style}`;
    
    const result = await multiAgentOrchestrator.processRequest(videoPrompt, {
      videoGeneration: true,
      artist,
      duration,
      style,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Video generation completed');

    res.json({
      success: true,
      video: result.results?.[0]?.result || null,
      workflow: result.workflow,
      agents: result.agents || [],
      metadata: result.metadata || {}
    });

  } catch (error) {
    console.error('❌ Video generation error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Video generation failed',
      details: error.message
    });
  }
});

// Get available artists for video generation
app.get('/api/video/artists', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    const artistsPath = path.join(process.cwd(), 'data', 'sample-artists.json');
    
    console.log('🔍 Checking artists file path:', artistsPath);
    console.log('🔍 Current working directory:', process.cwd());
    console.log('🔍 File exists:', await fs.pathExists(artistsPath));
    
    if (await fs.pathExists(artistsPath)) {
      const artists = await fs.readJson(artistsPath);
      console.log('✅ Loaded artists:', artists.length);
      
      const artistsInfo = artists.map(artist => ({
        name: artist.artistName,
        genre: artist.artistGenre,
        mixCount: artist.mixes.length,
        image: artist.artistImageFilename
      }));
      
      res.json({
        success: true,
        artists: artistsInfo,
        total: artistsInfo.length
      });
    } else {
      console.log('❌ Artists file not found, using fallback');
      res.json({
        success: true,
        artists: [{
          name: "Sample Artist",
          genre: "electronic", 
          mixCount: 1,
          image: "sample.jpg"
        }],
        total: 1
      });
    }
  } catch (error) {
    console.error('❌ Error fetching artists:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artists',
      details: error.message
    });
  }
});

// Get video generation history
app.get('/api/video/history', async (req, res) => {
  try {
    const { ArweaveVideoAgent } = require('./src/agents/ArweaveVideoAgent.js');
    const videoAgent = new ArweaveVideoAgent();
    
    const history = videoAgent.getVideoHistory();
    
    res.json({
      success: true,
      videos: history,
      total: history.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching video history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video history',
      details: error.message
    });
  }
});

// Clean up video system temp files
app.post('/api/video/cleanup', async (req, res) => {
  try {
    const { ArweaveVideoAgent } = require('./src/agents/ArweaveVideoAgent.js');
    const videoAgent = new ArweaveVideoAgent();
    
    await videoAgent.cleanup();
    
    res.json({
      success: true, 
      message: 'Video system cleanup completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during video cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Video cleanup failed',
      details: error.message
    });
  }
});

// Quick video generation with defaults  
app.post('/api/video/quick', async (req, res) => {
  try {
    console.log('🚀 Quick video generation requested');
    
    const artist = req.body.artist || 'ACIDMAN';
    const duration = req.body.duration || 30;
    
    console.log(`🎯 Generating ${duration}s video for: ${artist}`);
    
    // Use ArweaveVideoGenerator through multi-agent system
    const quickPrompt = `Create a ${duration}-second video for ${artist} with professional visuals and real Arweave audio`;
    
    const result = await multiAgentOrchestrator.processRequest(quickPrompt, {
      source: 'video_api',
      priority: 'high',
      artist: artist,
      duration: duration,
      style: 'classic',
      quick: true
    });
    
    console.log('✅ Quick video generation completed');

    // Find video generation result in the results array
    const videoResult = Object.values(result.results).find(r => r.type === 'video_generation');
    
    if (videoResult?.success) {
      const video = videoResult.video;
      
      res.json({
        success: true,
        video: {
          filename: video.filename,
          url: video.url,
          path: video.path,
          duration: video.duration,
          artist: video.artist,
          mixTitle: video.mixTitle,
          fileSize: video.fileSize,
          created: new Date().toISOString(),
          mock: video.mock || false
        },
        workflow: 'arweave_video_generation',
        message: 'Quick video generated successfully with real Arweave audio',
        metadata: {
          generator: 'ArweaveVideoGenerator',
          audioUrl: video.metadata?.arweaveUrl,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      throw new Error(videoResult?.error || 'Video generation failed');
    }

  } catch (error) {
    console.error('❌ Quick video generation error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Quick video generation failed',
      details: error.message
    });
  }
});

// Custom video generation with full parameters
app.post('/api/video/custom', async (req, res) => {
  try {
    const { prompt, artist, duration, style } = req.body;
    
    console.log(`🎬 Custom video generation requested:`, { prompt, artist, duration, style });
    
    // Use ArweaveVideoGenerator through multi-agent system
    const customPrompt = `${prompt} - Create a ${duration}-second video for ${artist} in ${style} style with professional visuals`;
    
    const result = await multiAgentOrchestrator.processRequest(customPrompt, {
      source: 'video_api',
      priority: 'high',
      artist: artist,
      duration: duration,
      style: style,
      prompt: prompt
    });

    console.log('✅ Custom video generation completed');

    // Find video generation result in the results array
    const videoResult = Object.values(result.results).find(r => r.type === 'video_generation');
    
    res.json({
      success: true,
      video: videoResult?.video || null,
      workflow: result.workflow,
      message: 'Custom video generated successfully',
      metadata: result.metadata || {}
    });

  } catch (error) {
    console.error('❌ Custom video generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Custom video generation failed',
      details: error.message
    });
  }
});

// Generate Arweave audio clip 
app.post('/api/audio/generate', async (req, res) => {
  try {
    const { artist, duration = 30, prompt } = req.body;
    
    console.log(`🎵 Audio generation requested: ${duration}s${artist ? ` for ${artist}` : ' (random)'}`);
    
    const audioPrompt = prompt || `Generate ${duration}-second audio clip${artist ? ` for ${artist}` : ''}`;
    
    const result = await multiAgentOrchestrator.processRequest(audioPrompt, {
      source: 'audio_api',
      priority: 'high',
      artist: artist,
      duration: duration
    });

    // Find audio generation result in the results array
    const audioResult = Object.values(result.results).find(r => r.type === 'audio_generation');
    
    if (audioResult?.success) {
      res.json({
        success: true,
        audio: {
          filename: audioResult.fileName,
          url: audioResult.url,
          path: audioResult.audioPath,
          duration: audioResult.duration,
          artist: audioResult.artist,
          mixTitle: audioResult.mixTitle,
          fileSize: audioResult.fileSize,
          created: new Date().toISOString()
        },
        workflow: result.workflow,
        message: audioResult.message,
        metadata: audioResult.metadata
      });
    } else {
      throw new Error(audioResult?.error || 'Audio generation failed');
    }

  } catch (error) {
    console.error('❌ Audio generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Audio generation failed',
      details: error.message
    });
  }
});

// Test Arweave connection for artist
app.post('/api/audio/test-connection', async (req, res) => {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({
        success: false,
        error: 'Artist name required'
      });
    }

    const { ArweaveAudioAgent } = require('./src/agents/ArweaveAudioAgent.js');
    const audioAgent = new ArweaveAudioAgent();
    
    const testResult = await audioAgent.testArtistConnection(artist);
    
    res.json({
      success: testResult.success,
      result: testResult,
      message: testResult.success ? 
        `Connection test successful for ${testResult.artist}` : 
        `Connection test failed: ${testResult.error}`
    });

  } catch (error) {
    console.error('❌ Connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error.message
    });
  }
});

// Get audio metadata without generating files
app.post('/api/audio/metadata', async (req, res) => {
  try {
    const { artist } = req.body;
    
    console.log('🎵 Audio metadata requested for:', artist || 'random artist');

    const prompt = `Get audio metadata${artist ? ` for ${artist}` : ' for random artist'}`;
    const context = {
      artist,
      metadataOnly: true
    };

    // Use multi-agent orchestrator
    const result = await multiAgentOrchestrator.processRequest(prompt, context);
    
    // Find metadata result in the results array
    const metadataResult = Object.values(result.results).find(r => 
      r.type === 'artist_metadata' || r.type === 'audio_generation'
    );
    
    if (metadataResult?.success) {
      res.json({
        success: true,
        data: metadataResult,
        workflow: result.workflow,
        message: 'Metadata retrieved successfully'
      });
    } else {
      throw new Error(metadataResult?.error || 'Metadata retrieval failed');
    }

  } catch (error) {
    console.error('❌ Audio metadata error:', error);
    res.status(500).json({
      success: false,
      error: 'Metadata retrieval failed',
      details: error.message
    });
  }
});

// Get all artists metadata
app.get('/api/audio/artists', async (req, res) => {
  try {
    console.log('🎵 All artists metadata requested');

    // Direct call to audio agent
    const { ArweaveAudioAgent } = require('./src/agents/ArweaveAudioAgent.js');
    const audioAgent = new ArweaveAudioAgent();
    
    const result = await audioAgent.getAllArtistsMetadata();
    
    if (result && result.success) {
      res.json({
        success: true,
        data: result,
        message: `Retrieved metadata for ${result.totalArtists} artists`
      });
    } else {
      throw new Error(result?.error || 'Artists metadata retrieval failed');
    }

  } catch (error) {
    console.error('❌ Artists metadata error:', error);
    res.status(500).json({
      success: false,
      error: 'Artists metadata retrieval failed',
      details: error.message
    });
  }
});

// Test simple video generation directly
app.post('/api/video/test-simple', async (req, res) => {
  try {
    const artist = req.body.artist || 'ACIDMAN';
    const duration = req.body.duration || 15;
    
    console.log(`🧪 Testing simple video generation for ${artist} (${duration}s)`);
    
    const { SimpleVideoGenerator } = require('./src/lib/SimpleVideoGenerator.js');
    const generator = new SimpleVideoGenerator();
    
    const result = await generator.generateSimpleVideo({
      name: artist,
      genre: 'electronic',
      mixCount: 3
    }, {
      duration: duration,
      width: 720,
      height: 720
    });
    
    console.log('✅ Simple video test completed');
    
    res.json({
      success: true,
      result: result,
      message: 'Simple video generation test completed'
    });
    
  } catch (error) {
    console.error('❌ Simple video test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Simple video test failed',
      details: error.message
    });
  }
});

// Test full video generation pipeline
app.post('/api/video/test-full-pipeline', async (req, res) => {
  try {
    console.log('🧪 Testing full video generation pipeline...');
    
    const { ArweaveVideoAgent } = require('./src/agents/ArweaveVideoAgent.js');
    const videoAgent = new ArweaveVideoAgent();
    
    // Test each component individually
    const testResults = {
      audioProcessor: { status: 'pending' },
      htmlRenderer: { status: 'pending' },
      videoCompositor: { status: 'pending' },
      aiBackgroundGenerator: { status: 'pending' },
      fullPipeline: { status: 'pending' }
    };

    // Test audio processor
    try {
      const audioStats = videoAgent.audioProcessor.getStats();
      testResults.audioProcessor = {
        status: 'success',
        data: audioStats
      };
      console.log('✅ Audio processor test passed');
    } catch (error) {
      testResults.audioProcessor = {
        status: 'error',
        error: error.message
      };
      console.log('❌ Audio processor test failed:', error.message);
    }

    // Test HTML renderer
    try {
      const htmlStats = videoAgent.htmlRenderer.getStats();
      testResults.htmlRenderer = {
        status: 'success',
        data: htmlStats
      };
      console.log('✅ HTML renderer test passed');
    } catch (error) {
      testResults.htmlRenderer = {
        status: 'error',
        error: error.message
      };
      console.log('❌ HTML renderer test failed:', error.message);
    }

    // Test video compositor
    try {
      const videoStats = videoAgent.videoCompositor.getStats();
      testResults.videoCompositor = {
        status: 'success',
        data: videoStats
      };
      console.log('✅ Video compositor test passed');
    } catch (error) {
      testResults.videoCompositor = {
        status: 'error',
        error: error.message
      };
      console.log('❌ Video compositor test failed:', error.message);
    }

    // Test AI background generator
    try {
      const aiStats = videoAgent.aiBackgroundGenerator.getStats();
      const aiConnection = await videoAgent.aiBackgroundGenerator.testConnection();
      testResults.aiBackgroundGenerator = {
        status: 'success',
        data: aiStats,
        connection: aiConnection
      };
      console.log('✅ AI background generator test passed');
    } catch (error) {
      testResults.aiBackgroundGenerator = {
        status: 'error',
        error: error.message
      };
      console.log('❌ AI background generator test failed:', error.message);
    }

    // Test full pipeline with simple video
    try {
      const simpleVideoPrompt = "Generate a test video for DJ CodeBeat";
      const fullResult = await videoAgent.handleMessage(simpleVideoPrompt, {
        artist: 'DJ CodeBeat',
        duration: 15, // Shorter for testing
        style: 'classic'
      });

      testResults.fullPipeline = {
        status: fullResult.success ? 'success' : 'partial',
        data: fullResult,
        video: fullResult.result
      };
      console.log('✅ Full pipeline test completed');
    } catch (error) {
      testResults.fullPipeline = {
        status: 'error',
        error: error.message
      };
      console.log('❌ Full pipeline test failed:', error.message);
    }

    // Clean up resources
    await videoAgent.closeResources();

    const overallSuccess = Object.values(testResults).every(test => 
      test.status === 'success' || test.status === 'partial'
    );

    res.json({
      success: overallSuccess,
      message: overallSuccess 
        ? 'Full video generation pipeline test completed successfully'
        : 'Some components failed testing',
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Pipeline test error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Pipeline test failed',
      details: error.message
    });
  }
});

// Get available artists for video generation
app.get('/api/video/artists', async (req, res) => {
  try {
    const artistsPath = path.join(__dirname, 'data', 'sample-artists.json');
    const artists = JSON.parse(fs.readFileSync(artistsPath, 'utf8'));

    // Format artist data for frontend
    const formattedArtists = artists.map(artist => ({
      name: artist.artistName,
      genre: artist.artistGenre,
      mixCount: artist.mixes.length,
      filename: artist.artistFilename,
      imageFilename: artist.artistImageFilename,
      mixes: artist.mixes.map(mix => ({
        title: mix.mixTitle,
        duration: mix.mixDuration,
        year: mix.mixDateYear,
        arweaveURL: mix.mixArweaveURL
      }))
    }));

    res.json({
      success: true,
      artists: formattedArtists,
      count: formattedArtists.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to load artists:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load artist data',
      details: error.message
    });
  }
});

// Test individual video components
app.get('/api/video/test-components', async (req, res) => {
  try {
    const tests = {};

    // Test FFmpeg availability
    try {
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegPath = require('ffmpeg-static');
      ffmpeg.setFfmpegPath(ffmpegPath);
      
      tests.ffmpeg = {
        status: 'available',
        path: ffmpegPath
      };
    } catch (error) {
      tests.ffmpeg = {
        status: 'error',
        error: error.message
      };
    }

    // Test Puppeteer
    try {
      const puppeteer = require('puppeteer');
      tests.puppeteer = {
        status: 'available',
        version: puppeteer._preferredRevision || 'unknown'
      };
    } catch (error) {
      tests.puppeteer = {
        status: 'error',
        error: error.message
      };
    }

    // Test Sharp
    try {
      const sharp = require('sharp');
      tests.sharp = {
        status: 'available',
        version: sharp.versions
      };
    } catch (error) {
      tests.sharp = {
        status: 'error',
        error: error.message
      };
    }

    // Test OpenAI
    tests.openai = {
      status: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      keyPresent: !!process.env.OPENAI_API_KEY
    };

    res.json({
      success: true,
      components: tests,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Component test failed',
      details: error.message
    });
  }
});

// Image Generation Endpoints
app.post('/api/image/generate', async (req, res) => {
  try {
    console.log('🖼️ Image generation request received:', req.body);
    
    const { prompt, style, size, quality } = req.body;
    
    // Validate required parameters
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Image prompt is required'
      });
    }

    // Initialize image generation agent
    const { ImageGenerationAgent } = require('./src/agents/ImageGenerationAgent.js');
    const imageAgent = new ImageGenerationAgent();
    
    // Prepare context with parameters
    const context = {
      imagePrompt: prompt,
      imageStyle: style || 'realistic',
      imageSize: size || '720x720',
      imageQuality: quality || 'standard'
    };
    
    // Generate image
    const result = await imageAgent.handleMessage(prompt, context);
    
    if (result.success) {
      console.log('✅ Image generated successfully:', result.image.fileName);
      
      res.json({
        success: true,
        image: result.image,
        message: result.message,
        metadata: result.metadata
      });
    } else {
      console.error('❌ Image generation failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Image generation endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Image generation failed',
      details: error.message
    });
  }
});

// Quick image generation endpoint
app.post('/api/image/quick', async (req, res) => {
  try {
    console.log('⚡ Quick image generation request received');
    
    // Initialize image generation agent
    const { ImageGenerationAgent } = require('./src/agents/ImageGenerationAgent.js');
    const imageAgent = new ImageGenerationAgent();
    
    // Generate Chicago skyline image
    const result = await imageAgent.handleMessage('Generate a Chicago skyline image', {
      imagePrompt: 'A stunning Chicago skyline at sunset with modern skyscrapers',
      imageStyle: 'realistic',
      imageSize: '1024x1024',
      imageQuality: 'standard'
    });
    
    if (result.success) {
      console.log('✅ Quick image generated successfully:', result.image.fileName);
      
      res.json({
        success: true,
        image: result.image,
        message: result.message,
        metadata: result.metadata
      });
    } else {
      console.error('❌ Quick image generation failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Quick image generation endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Quick image generation failed',
      details: error.message
    });
  }
});

// Get image history
app.get('/api/image/history', async (req, res) => {
  try {
    console.log('📚 Image history request received');
    
    const { ImageGenerator } = require('./src/lib/ImageGenerator.js');
    const imageGenerator = new ImageGenerator();
    
    const history = await imageGenerator.getImageHistory();
    
    res.json({
      success: true,
      images: history,
      count: history.length
    });
    
  } catch (error) {
    console.error('❌ Image history endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get image history',
      details: error.message
    });
  }
});

// Cleanup image files
app.post('/api/image/cleanup', async (req, res) => {
  try {
    console.log('🧹 Image cleanup request received');
    
    const { ImageGenerator } = require('./src/lib/ImageGenerator.js');
    const imageGenerator = new ImageGenerator();
    
    const cleanedCount = await imageGenerator.cleanupOldImages();
    
    res.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} old image files`
    });
    
  } catch (error) {
    console.error('❌ Image cleanup endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup image files',
      details: error.message
    });
  }
});

// Initialize Multi-Agent Framework
async function initializeMultiAgentFramework() {
  try {
    console.log('🤖 Initializing Multi-Agent Framework...');
    
    // Initialize environment configuration
    await environmentConfig.initializeValidation();
    
    // Check agent factory status
    const agentStatus = twitterAgentFactory.getSystemStats();
    console.log('🎯 Agent Factory Status:', agentStatus);
    
    // Check orchestrator status
    const orchestratorStatus = multiAgentOrchestrator.getSystemStatus();
    console.log('🚀 Multi-Agent Orchestrator Status:', orchestratorStatus.orchestrator.status);
    
    console.log('✅ Multi-Agent Framework initialized successfully!');
  } catch (error) {
    console.error('❌ Multi-Agent Framework initialization failed:', error.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🎵 DJ Twitter Bot Dashboard running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to access the dashboard`);
  console.log(`🤖 Bot is ready for tweet approval and monitoring!`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Memory usage: ${JSON.stringify(process.memoryUsage())}`);
  
  // Initialize multi-agent framework after server starts (with error handling)
  try {
    await initializeMultiAgentFramework();
  } catch (error) {
    console.error('⚠️ Multi-Agent Framework initialization failed, but server is still running:', error.message);
    console.log('🔄 Server will continue without multi-agent features');
  }
}); 