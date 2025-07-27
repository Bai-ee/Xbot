# 🎬 Creative Tech DJ Twitter Bot

A comprehensive X Premium+ posting bot for DJs and Creative-Tech users with advanced video generation capabilities, web dashboard, and multi-agent orchestration.

## 🚀 Features

### Core Functionality
- **Automated Social Media Posting**: Intelligent content generation and scheduling
- **Multi-Agent System**: Orchestrated AI agents for content creation, video generation, and social media management
- **Web Dashboard**: Real-time monitoring and control interface
- **Arweave Integration**: Decentralized audio content from the Arweave network

### 🎬 Video Generation System
- **Professional Video Creation**: Generate branded videos with audio from Arweave
- **AI Background Generation**: Dynamic visual backgrounds using OpenAI
- **Multiple Video Styles**: Enhanced layouts with artist branding
- **Real-time Processing**: Live video generation with progress tracking
- **High-Quality Output**: 4K-ready video composition with professional encoding

### 🤖 AI Agents
- **ContentCreator**: Generates engaging social media content
- **ArweaveVideoAgent**: Handles video generation workflows
- **ImageGenerationAgent**: Creates custom visual assets
- **MultiAgentOrchestrator**: Coordinates complex multi-step workflows

## 📋 Requirements

### System Requirements
- **Node.js**: 18.0+ (LTS recommended)
- **FFmpeg**: 4.0+ (for audio/video processing)
- **Chrome/Chromium**: Latest (for Puppeteer rendering)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 5GB free space for dependencies + output files

### API Keys Required
- **OpenAI API Key**: For AI content generation and background creation
- **Twitter API Keys**: For social media posting (optional)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd creative-tech-dj-twitter-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory:
```bash
# Required API Keys
OPENAI_API_KEY=sk-proj-your_openai_api_key_here

# Optional Twitter API Keys (for social media posting)
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_SECRET=your_twitter_access_secret

# Optional Configuration
NODE_ENV=development
PORT=3000
```

### 4. Install System Dependencies
```bash
# macOS (via Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

## 🚀 Usage

### Start the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Test Audio Generation
```bash
# Quick test
npm run test-audio

# Full test with cleanup
npm run test-audio-full
```

### Test Video Generation
```bash
npm run test-video
```

### Clean Temporary Files
```bash
npm run clean
```

## 🎬 Video Generation

### Basic Video Generation
The system can generate professional videos by:
1. **Pulling audio from Arweave**: Downloads segments from decentralized storage
2. **Creating visual layouts**: Generates branded layouts with artist information
3. **Compositing final video**: Combines audio and visuals with professional encoding

### Video Generation Process
```javascript
const { ArweaveVideoGenerator } = require('./src/lib/ArweaveVideoGenerator');

const generator = new ArweaveVideoGenerator();
const result = await generator.generateVideoWithAudio(30); // 30-second video
```

### Supported Video Styles
- **Enhanced Classic**: Traditional layout with artist branding
- **Hierarchical Artist-Focused**: Artist-centric design
- **Hierarchical Logo-Focused**: Logo-centric design

## 🤖 Multi-Agent System

### Agent Types
- **ContentCreator**: Generates social media content and captions
- **ArweaveVideoAgent**: Handles video generation workflows
- **ImageGenerationAgent**: Creates custom visual assets
- **MultiAgentOrchestrator**: Coordinates complex workflows

### Workflow Types
- **Parallel**: Multiple agents work simultaneously
- **Sequential**: Agents work in sequence
- **Video Generation**: Specialized workflow for video creation

### Example Usage
```javascript
const { MultiAgentOrchestrator } = require('./src/agents/MultiAgentOrchestrator');

const orchestrator = new MultiAgentOrchestrator();
const result = await orchestrator.processRequest(
  "Create a 30-second video with Chicago skyline background"
);
```

## 🌐 Web Dashboard

### Access the Dashboard
1. Start the application: `npm run dev`
2. Open your browser to: `http://localhost:3000`
3. Navigate to the dashboard interface

### Dashboard Features
- **Real-time Monitoring**: Live status of agents and processes
- **Content Management**: View and manage generated content
- **Video Generation**: Trigger and monitor video creation
- **System Status**: Check system health and dependencies

## 📁 Project Structure

```
creative-tech-dj-twitter-bot/
├── src/
│   ├── agents/                 # AI agent implementations
│   │   ├── BaseAgent.js       # Base agent class
│   │   ├── ContentCreator.js  # Content generation agent
│   │   ├── ArweaveVideoAgent.js # Video generation agent
│   │   └── MultiAgentOrchestrator.js # Workflow coordination
│   ├── lib/                   # Core libraries
│   │   ├── ArweaveAudioClient.js # Audio processing
│   │   ├── ArweaveVideoGenerator.js # Video generation
│   │   └── ImageGenerator.js  # AI image generation
│   └── api/                   # API integrations
├── content/                   # Generated content storage
│   └── audio/                # Audio clips from Arweave
├── outputs/                   # Generated videos and assets
├── public/                    # Web dashboard files
├── data/                      # Configuration and data files
└── docs/                      # Documentation
```

## 🔧 Configuration

### Artist Database
The system uses a JSON database of artists and their mixes. See `data/sample-artists.json` for the format.

### Video Settings
- **Default Duration**: 30 seconds
- **Fade Effects**: 2-second fade in/out
- **Output Format**: MP4 with AAC audio
- **Quality**: High-quality encoding for social media

### Agent Configuration
- **Retry Logic**: Automatic retry with exponential backoff
- **Timeout Settings**: Configurable timeouts for network operations
- **Error Handling**: Comprehensive error handling and recovery

## 🧪 Testing

### Run Tests
```bash
# Test audio generation
npm run test-audio-full

# Test video generation
npm run test-video

# Test specific components
node test-audio-generation.js
```

### Test Coverage
- Audio generation from Arweave
- Video composition and encoding
- Multi-agent orchestration
- Error handling and recovery
- Network resilience

## 🚨 Troubleshooting

### Common Issues

#### FFmpeg Not Found
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg

# Verify installation
ffmpeg -version
```

#### Audio Generation Fails
- Check Arweave URLs in artist database
- Verify network connectivity
- Check FFmpeg installation
- Review error logs for specific issues

#### Video Generation Issues
- Ensure sufficient disk space
- Check Puppeteer/Chrome installation
- Verify OpenAI API key configuration
- Review system resources

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## 📈 Performance

### Optimization Tips
- Use shorter clip durations for faster processing
- Implement parallel processing for batch operations
- Cache frequently accessed Arweave URLs
- Monitor system resources during processing

### Resource Usage
- **Memory**: 2-4GB during video generation
- **CPU**: Multi-core utilization for parallel processing
- **Storage**: Temporary files cleaned up automatically
- **Network**: Efficient segment downloading from Arweave

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Arweave**: Decentralized storage for audio content
- **OpenAI**: AI-powered content generation
- **FFmpeg**: Audio/video processing
- **Puppeteer**: Web rendering for video generation

## 📞 Support

For support and questions:
- Check the troubleshooting section
- Review the documentation
- Open an issue on GitHub
- Contact the development team

---

**🎉 Ready to create amazing content with AI-powered video generation!**
