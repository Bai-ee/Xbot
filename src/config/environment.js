const { config } = require('dotenv');

config(); // Load .env file

class EnvironmentConfig {
  constructor() {
    this.config = this.loadConfig();
    this.validatedKeys = new Map();
  }

  async initializeValidation() {
    if (this.config.openai.apiKey) {
      const isValid = await this.validateOpenAIKey();
      this.validatedKeys.set('openai', isValid);
      
      if (isValid) {
        console.log('✅ OpenAI API key validation successful!');
      } else {
        console.log('❌ OpenAI API key validation failed');
      }
    }
    this.validateRequired();
  }

  loadConfig() {
    return {
      openai: {
        apiKey: this.stripQuotes(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1500
      },
      twitter: {
        apiKey: this.stripQuotes(process.env.TWITTER_API_KEY),
        apiSecret: this.stripQuotes(process.env.TWITTER_API_SECRET),
        accessToken: this.stripQuotes(process.env.ACCESS_TOKEN),
        accessSecret: this.stripQuotes(process.env.ACCESS_SECRET)
      },
      app: {
        logLevel: process.env.TASKMASTER_LOG_LEVEL || 'info',
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3000
      }
    };
  }

  stripQuotes(value) {
    if (!value) return value;
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    return value;
  }

  async validateOpenAIKey() {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.openai.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  validateRequired() {
    const hasValidOpenAI = this.validatedKeys.get('openai') === true;
    const hasTwitterKeys = !!(this.config.twitter.apiKey && this.config.twitter.apiSecret);

    if (!hasValidOpenAI) {
      const message = 'Missing or invalid OpenAI API key';
      if (this.config.app.nodeEnv === 'production') {
        console.warn(message + ' - AI features may not work');
      } else {
        console.warn(message + ' - some features may not work');
      }
    }

    if (!hasTwitterKeys) {
      console.warn('Missing Twitter API keys - Twitter posting may not work');
    }
  }

  getOpenAIConfig() { return this.config.openai; }
  getTwitterConfig() { return this.config.twitter; }
  getAppConfig() { return this.config.app; }
  
  isOpenAIConfigured() {
    return this.validatedKeys.get('openai') === true;
  }
}

// Singleton instance
const environmentConfig = new EnvironmentConfig();

module.exports = { EnvironmentConfig, environmentConfig }; 