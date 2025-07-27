const OpenAI = require('openai');
const { environmentConfig } = require('../config/environment.js');

class OpenAIClient {
  constructor() {
    this.client = null;
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000
    };
    this.initializeClient();
  }

  initializeClient() {
    const config = environmentConfig.getOpenAIConfig();
    
    if (!config.apiKey) {
      console.warn('OpenAI API key not found. Client not initialized.');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        timeout: 60000, // 60 second timeout
        maxRetries: this.retryConfig.maxRetries
      });
      console.log('✅ OpenAI client initialized successfully');
    } catch (error) {
      console.error(`Failed to initialize OpenAI client: ${error.message}`);
      throw error;
    }
  }

  async runCompletion(prompt, tools = null, options = {}) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Check your API key.');
    }

    const config = environmentConfig.getOpenAIConfig();
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const messages = [{ role: 'user', content: prompt }];
        
        const requestOptions = {
          model: options.model || config.model,
          messages,
          temperature: options.temperature || config.temperature,
          max_tokens: options.max_tokens || config.maxTokens
        };

        if (tools && tools.length > 0) {
          requestOptions.tools = tools;
          requestOptions.tool_choice = 'auto';
        }

        console.log(`🤖 OpenAI request (attempt ${attempt + 1})`, {
          model: requestOptions.model,
          toolCount: tools ? tools.length : 0
        });

        const completion = await this.client.chat.completions.create(requestOptions);
        
        const response = completion.choices[0].message;
        
        return {
          success: true,
          response: response.content,
          toolCalls: response.tool_calls || null,
          usage: completion.usage,
          model: completion.model
        };

      } catch (error) {
        console.warn(`OpenAI attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }
        
        await this.sleep(this.retryConfig.retryDelay * Math.pow(2, attempt));
      }
    }
  }

  async runSpecializedCompletion(agentType, prompt, context = {}) {
    const specializedPrompt = this.createSpecializedPrompt(agentType, prompt, context);
    
    return await this.runCompletion(specializedPrompt, null, {
      temperature: this.getTemperatureForAgent(agentType),
      model: context.model
    });
  }

  createSpecializedPrompt(agentType, input, context = {}) {
    const prompts = {
      'content_creator': `You are a specialized Twitter content creator. Create engaging, authentic Twitter content.
        
Task: ${input}

Context: ${JSON.stringify(context, null, 2)}

Guidelines:
- Keep tweets under 280 characters
- Use relevant hashtags (2-3 max)
- Include emojis for engagement
- Match the user's authentic voice
- Focus on value and engagement

Create compelling Twitter content:`,

      'hashtag_specialist': `You are a hashtag optimization specialist. Analyze content and suggest the best hashtags for maximum reach and engagement.

Task: ${input}

Context: ${JSON.stringify(context, null, 2)}

Guidelines:
- Suggest 5-10 relevant hashtags
- Mix popular and niche hashtags
- Consider trending topics
- Avoid banned or spammy hashtags
- Optimize for the target audience

Provide hashtag recommendations:`,

      'engagement_optimizer': `You are an engagement optimization specialist. Analyze content and suggest improvements for maximum Twitter engagement.

Task: ${input}

Context: ${JSON.stringify(context, null, 2)}

Guidelines:
- Optimize for likes, retweets, and comments
- Suggest posting times
- Recommend engagement tactics
- Analyze sentiment and tone
- Consider viral potential

Provide engagement optimization:`,

      'trend_analyst': `You are a trend analysis specialist. Research and analyze current trends to inform content strategy.

Task: ${input}

Context: ${JSON.stringify(context, null, 2)}

Guidelines:
- Identify current trending topics
- Analyze relevance to user's niche
- Suggest trend-based content ideas
- Consider trend longevity
- Provide timing recommendations

Provide trend analysis:`,

      'scheduler': `You are a content scheduling specialist. Analyze content and audience data to recommend optimal posting times and strategies.

Task: ${input}

Context: ${JSON.stringify(context, null, 2)}

Guidelines:
- Consider timezone and audience activity
- Analyze historical performance data
- Suggest posting frequency
- Recommend content spacing
- Consider platform algorithms

Provide scheduling recommendations:`
    };

    return prompts[agentType] || `As a ${agentType} specialist, help with: ${input}`;
  }

  getTemperatureForAgent(agentType) {
    const temperatures = {
      'content_creator': 0.8,    // More creative
      'hashtag_specialist': 0.3, // More focused
      'engagement_optimizer': 0.6, // Balanced
      'trend_analyst': 0.4,      // More analytical
      'scheduler': 0.2           // Very focused
    };

    return temperatures[agentType] || 0.7;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const openaiClient = new OpenAIClient();
module.exports = openaiClient; 