// Creative Tech DJ Twitter Bot Dashboard Server
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const PORT = process.env.PORT || 3000;

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

function generateRandomTweet() {
  const baseTweet = djTweets[Math.floor(Math.random() * djTweets.length)];
  
  // Add some randomization to make tweets unique
  const shouldAddTimeElement = Math.random() > 0.7;
  const shouldAddMusicEmoji = Math.random() > 0.6;
  const shouldAddVibeWord = Math.random() > 0.8;
  
  let tweet = baseTweet;
  
  if (shouldAddTimeElement) {
    const timeEmoji = timeBasedEmojis[Math.floor(Math.random() * timeBasedEmojis.length)];
    const currentHour = new Date().getHours();
    let timePhrase = '';
    
    if (currentHour < 12) timePhrase = 'This morning ';
    else if (currentHour < 17) timePhrase = 'This afternoon ';
    else timePhrase = 'Tonight ';
    
    tweet = `${timeEmoji} ${timePhrase}${tweet.toLowerCase()}`;
  }
  
  if (shouldAddMusicEmoji) {
    const musicEmoji = musicEmojis[Math.floor(Math.random() * musicEmojis.length)];
    tweet = `${tweet} ${musicEmoji}`;
  }
  
  if (shouldAddVibeWord) {
    const vibeWord = vibeWords[Math.floor(Math.random() * vibeWords.length)];
    tweet = tweet.replace(/\!/, ` - ${vibeWord}!`);
  }
  
  // Add a timestamp-based element to ensure uniqueness
  const timestamp = Date.now().toString().slice(-4);
  const hashtagVariations = ['#DJ' + timestamp, '#Studio' + timestamp, '#Creative' + timestamp];
  const uniqueTag = hashtagVariations[Math.floor(Math.random() * hashtagVariations.length)];
  
  // Ensure tweet doesn't exceed 280 characters
  let finalTweet = tweet;
  if (finalTweet.length > 250) { // Leave room for unique tag
    finalTweet = finalTweet.substring(0, 240) + '...';
  }
  
  // Only add unique tag if there's room
  if ((finalTweet + ' ' + uniqueTag).length <= 280) {
    finalTweet += ' ' + uniqueTag;
  }
  
  return finalTweet;
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 DJ Twitter Bot Dashboard running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to access the dashboard`);
  console.log(`🤖 Bot is ready for tweet approval and monitoring!`);
}); 