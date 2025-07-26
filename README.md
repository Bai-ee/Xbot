# 🎵 Creative Tech DJ Twitter Bot with Web Dashboard

Automated content engine for DJs and Creative-Tech users using X Premium+ tools. Features a modern web dashboard for tweet approval and monitoring before posting.

## ✨ Features

- 🎵 **Curated DJ Content**: Pre-built tweet templates for DJs and creative tech users
- 🌐 **Web Dashboard**: Beautiful interface to monitor, edit, and approve tweets
- ✅ **Tweet Approval System**: Review and edit tweets before they go live
- 📊 **Analytics**: Track pending tweets, posted tweets, and queue statistics
- 🔄 **Real-time Updates**: Dashboard updates automatically every 30 seconds
- 🎯 **Character Count**: Real-time character counting with Twitter limit validation
- 🚀 **Railway Ready**: Pre-configured for easy deployment to Railway

## 🎬 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Twitter API Credentials
1. Visit [Twitter Developer Portal](https://developer.x.com)
2. Create a new app and generate API keys
3. Your `.env` file is already configured with your credentials

### 3. Launch the Web Dashboard
```bash
npm start
```

Open http://localhost:3000 to access your dashboard!

## 🌐 Web Dashboard Features

### Tweet Management
- **Generate Tweets**: Create new DJ-focused content with one click
- **Edit Tweets**: Modify content directly in the dashboard
- **Approve & Post**: Review and approve tweets before they go live
- **Real-time Character Count**: See exactly how many characters you're using
- **Queue Management**: View all pending and posted tweets

### Dashboard Sections
- **Stats Overview**: See pending tweets, posted today, and total queue
- **Tweet Queue**: All your tweets organized by status (pending first)
- **Real-time Updates**: Data refreshes automatically
- **Toast Notifications**: Get instant feedback on all actions

## 🎵 Using the Bot

### Generate Tweet
Click "Generate New Tweet" to create a random DJ-focused tweet from templates.

### Edit Content
Click in any tweet text area to edit the content. Changes save automatically.

### Approve & Post
Click "Approve & Post" to send the tweet to Twitter immediately.

### Reject Tweet
Click "Reject" to remove a tweet from the queue without posting.

## 🚀 Deploy to Railway

### 1. Connect to Railway
1. Go to [Railway.app](https://railway.app)
2. Connect your GitHub repository
3. Click "Deploy Now"

### 2. Set Environment Variables
In Railway dashboard, add these environment variables:
```env
TWITTER_API_KEY=9wJwJdKGRi5mIc5kefAAZyjC7
TWITTER_API_SECRET=XouT4JAW5oAridbvJKWGMUdqo9s6heetokRKhgiUCXAk1Vt8RY
ACCESS_TOKEN=18508964-le8C1iwlotI3FZxy3NSWOVo8iM5jjpAbbdqOm3K0f
ACCESS_SECRET=I2LUde9Mx1DcTw6oFuXoi57YIBCMAYuWM4SaQky40RSSo
PORT=8080
```

### 3. Deploy!
Railway will automatically deploy your bot with the web dashboard.

## 🛠 Customization

### Edit Tweet Templates
Modify the `djTweets` array in `server.js`:
```javascript
const djTweets = [
  "🎶 Your custom DJ content here! #YourHashtags",
  "🔥 Add your show announcements and mix releases",
  // Add more templates...
];
```

### Styling
Edit `public/style.css` to customize the dashboard appearance.

### Functionality
Modify `public/script.js` to add new features to the dashboard.

## 📱 API Endpoints

The bot includes a full REST API:

- `GET /` - Web dashboard
- `GET /api/tweets` - Get all tweets
- `POST /api/generate` - Generate new tweet
- `PUT /api/tweets/:id` - Update tweet content
- `POST /api/tweets/:id/approve` - Approve and post tweet
- `POST /api/tweets/:id/reject` - Reject tweet
- `DELETE /api/tweets/posted` - Clear posted tweets
- `GET /health` - Health check

## 💡 Pro Tips

### Content Strategy
- **Personalize Templates**: Replace generic content with your specific shows, releases, and venues
- **Use Hashtags**: Include genre-specific hashtags like #TechHouse, #DeepHouse, #CreativeTech
- **Show Announcements**: Add upcoming gigs and event details
- **Behind-the-Scenes**: Share studio sessions and production insights

### Scheduling
- **Manual Mode**: Use the dashboard to approve tweets as needed
- **Batch Approval**: Generate multiple tweets and approve them when ready
- **Strategic Timing**: Approve tweets during peak engagement hours

### Railway Production
- **Environment Variables**: All credentials are safely stored in Railway
- **Auto-scaling**: Railway handles traffic spikes automatically
- **Custom Domain**: Connect your own domain in Railway settings
- **SSL**: HTTPS is automatically enabled

## 🎯 Dashboard Commands

- **Generate New Tweet**: Creates a random DJ-focused tweet
- **Clear Posted**: Removes all posted tweets from the queue
- **Edit Tweet**: Click in text area to modify content
- **Approve & Post**: Sends tweet to Twitter immediately
- **Reject**: Removes tweet without posting

---

**🎵 Your Creative Tech DJ Twitter Bot is ready to build your audience!** 🎶🤖

**Local Dashboard**: http://localhost:3000  
**Railway Deploy**: Ready for production deployment  
**Tweet Approval**: Full control over your content  

Happy DJing! 🎧✨