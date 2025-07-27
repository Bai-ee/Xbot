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

// Post tweet directly to Twitter without queue
app.post('/api/post-direct', async (req, res) => {
  const { content } = req.body;
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Tweet content is required' });
  }
  
  if (content.length > 280) {
    return res.status(400).json({ error: 'Tweet content exceeds 280 characters' });
  }
  
  try {
    // Post directly to Twitter
    console.log(`Posting tweet directly: ${content.substring(0, 50)}...`);
    const tweetResponse = await client.v2.tweet(content);
    console.log('Tweet posted successfully to Twitter:', tweetResponse.data?.id);
    
    // Create tweet object for display purposes
    const tweet = {
      id: Date.now().toString(),
      content: content.trim(),
      status: 'posted',
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      twitterId: tweetResponse.data?.id,
      directPost: true
    };
    
    // Optionally save to queue for record keeping
    const queue = loadQueue();
    queue.tweets.unshift(tweet);
    saveQueue(queue);
    
    res.json({ success: true, tweet });
  } catch (error) {
    console.error('Twitter API Error Details:', {
      code: error.code,
      message: error.message,
      data: error.data
    });
    
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
app.post('/api/save-draft', async (req, res) => {
  const { content } = req.body;
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Tweet content is required' });
  }
  
  try {
    const queue = loadQueue();
    const newTweet = {
      id: Date.now().toString(),
      content: content.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      autoGenerated: false,
      draft: true
    };
    
    queue.tweets.unshift(newTweet);
    saveQueue(queue);
    
    const pendingCount = queue.tweets.filter(t => t.status === 'pending').length;
    res.json({ success: true, tweet: newTweet, pendingCount });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ error: 'Failed to save draft' });
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
    
    // Force fresh fetch by clearing cache temporarily
    const oldCache = analyticsCache.analytics;
    delete analyticsCache.analytics;
    
    try {
      // Fetch fresh analytics
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
      // Restore old cache if fetch failed
      if (oldCache) {
        analyticsCache.analytics = oldCache;
      }
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
  
  // Get user profile with metrics
  let profile = null;
  try {
    const profileResponse = await client.v2.me({
      'user.fields': ['public_metrics', 'created_at', 'description', 'profile_image_url', 'username', 'name']
    });
    profile = profileResponse.data;
    
    // Update rate limit info from successful call
    updateRateLimitInfo(profileResponse._headers);
  } catch (profileError) {
    console.error('Profile fetch failed:', profileError.message);
    updateRateLimitInfo(profileError.headers);
    
    // Use cached profile if available
    if (analyticsCache.profile) {
      profile = analyticsCache.profile.data;
      console.log('Using cached profile data');
    } else {
      throw profileError;
    }
  }

  // Get recent tweets with metrics (handle rate limits gracefully)
  let recentTweets = null;
  let tweetsFromCache = false;
  
  try {
    if (profile && profile.id) {
      const tweetsResponse = await client.v2.userTimeline(profile.id, {
        max_results: 10,
        'tweet.fields': ['created_at', 'public_metrics', 'text']
      });
      recentTweets = tweetsResponse;
      
      // Update rate limit info
      updateRateLimitInfo(tweetsResponse._headers);
    }
  } catch (tweetsError) {
    console.log('Recent tweets fetch failed:', tweetsError.code === 429 ? 'Rate limited' : tweetsError.message);
    updateRateLimitInfo(tweetsError.headers);
    
    // Try to use cached tweets
    if (analyticsCache.recentTweets) {
      recentTweets = { data: analyticsCache.recentTweets.data };
      tweetsFromCache = true;
      console.log('Using cached tweets data');
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

  const analyticsData = {
    profile: profile || { public_metrics: { followers_count: 0, following_count: 0, tweet_count: 0 } },
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
      refreshed_at: new Date().toISOString()
    },
    rate_limit: rateLimitInfo
  };

  // Cache the results with long TTL
  const now = Date.now();
  lastAnalyticsCall = now;
  analyticsCache.analytics = {
    data: analyticsData,
    timestamp: now
  };

  // Cache individual components
  if (profile) {
    analyticsCache.profile = { data: profile, timestamp: now };
  }
  if (recentTweets && !tweetsFromCache) {
    analyticsCache.recentTweets = { data: recentTweets.data, timestamp: now };
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
    // Check if we have cached data
    if (analyticsCache.analytics && analyticsCache.analytics.data) {
      const cachedData = analyticsCache.analytics.data;
      const cacheAge = Date.now() - analyticsCache.analytics.timestamp;
      
      // Check if we should auto-refresh (once per day)
      const shouldAutoRefreshNow = shouldAutoRefresh() && rateLimitInfo.remaining > 0;
      
      if (!shouldAutoRefreshNow) {
        // Return cached data with updated cache info
        console.log('Returning cached analytics data (no auto-refresh needed)');
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
      console.log('Performing daily auto-refresh of analytics...');
      try {
        const freshData = await fetchFreshAnalytics();
        lastAutoRefresh = Date.now(); // Update auto-refresh timestamp
        return res.json(freshData);
      } catch (error) {
        console.error('Auto-refresh failed, falling back to cache:', error.message);
        // Fall through to return cached data
      }
    }

    // Return cached data if available (no auto-refresh conditions met)
    if (analyticsCache.analytics && analyticsCache.analytics.data) {
      const cachedData = analyticsCache.analytics.data;
      const cacheAge = Date.now() - analyticsCache.analytics.timestamp;
      
      console.log('Returning cached analytics data');
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

    // No cached data available - return comprehensive fallback
    console.log('No cached analytics data available, returning comprehensive fallback');
    
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
        hours_until_reset: hoursUntilReset
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
    res.status(500).json({ 
      error: 'Analytics temporarily unavailable',
      details: error.message,
      rate_limit: rateLimitInfo
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Clear analytics cache (for debugging/manual refresh)
app.post('/api/clear-cache', (req, res) => {
  analyticsCache = {};
  lastAnalyticsCall = 0;
  console.log('Analytics cache cleared');
  res.json({ 
    success: true, 
    message: 'Analytics cache cleared',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 DJ Twitter Bot Dashboard running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} to access the dashboard`);
  console.log(`🤖 Bot is ready for tweet approval and monitoring!`);
}); 