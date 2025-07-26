// Creative Tech DJ Twitter Bot
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

// Function to check environment variables
function checkEnvironment() {
  const requiredVars = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'ACCESS_TOKEN', 'ACCESS_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName] || process.env[varName] === 'your_api_key_here' || process.env[varName] === 'your_api_secret_here' || process.env[varName] === 'your_access_token_here' || process.env[varName] === 'your_access_secret_here');
  
  if (missing.length > 0) {
    console.error('❌ Missing or placeholder environment variables:', missing.join(', '));
    console.error('📝 Please create a .env file with your Twitter API credentials:');
    console.error('');
    console.error('TWITTER_API_KEY=your_api_key_here');
    console.error('TWITTER_API_SECRET=your_api_secret_here');
    console.error('ACCESS_TOKEN=your_access_token_here');
    console.error('ACCESS_SECRET=your_access_secret_here');
    console.error('');
    console.error('🔗 Get credentials at: https://developer.x.com');
    return false;
  }
  return true;
}

// Check environment before initializing client
if (!checkEnvironment()) {
  process.exit(1);
}

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

// DJ content templates
const djTweets = [
  "🎶 Fresh beats cooking in the studio! New mix dropping soon... #DJ #CreativeTech #ElectronicMusic",
  "🔥 That moment when the crowd syncs with the beat... pure magic! #DJLife #MusicProduction",
  "🎧 Testing new creative tech tools for tonight's set. Innovation meets rhythm! #TechHouse #CreativeTech",
  "⚡ The energy at last night's gig was unreal! Thank you all for dancing with me 🙌 #Grateful #DJCommunity",
  "🎵 Working on some experimental sounds. Sometimes the best tracks come from happy accidents! #StudioLife",
];

// Function to get random tweet
function getRandomTweet() {
  return djTweets[Math.floor(Math.random() * djTweets.length)];
}

// Main bot function
async function postTweet() {
  try {
    const tweetContent = getRandomTweet();
    await client.v2.tweet(tweetContent);
    console.log('✅ Tweet sent successfully!');
    console.log('📝 Content:', tweetContent);
  } catch (error) {
    console.error('❌ Tweet failed:', error.message);
    if (error.code === 401) {
      console.error('🔑 Authentication failed. Please check your Twitter API credentials.');
    }
  }
}

// Run the bot
postTweet();