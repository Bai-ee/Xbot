const openaiClient = require('../api/openaiClient.js');

// Base Agent Class
class BaseAgent {
  constructor(name, specializations = []) {
    this.name = name;
    this.specializations = specializations;
    this.stats = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
  }

  async executeTask(input, context = {}) {
    const startTime = Date.now();
    this.stats.tasksExecuted++;

    try {
      const result = await this.handleMessage(input, context);
      const executionTime = Date.now() - startTime;
      
      this.stats.tasksSucceeded++;
      this.stats.totalExecutionTime += executionTime;
      this.stats.averageExecutionTime = Math.round(this.stats.totalExecutionTime / this.stats.tasksExecuted);

      console.log(`✅ ${this.name} completed task`, {
        executionTime,
        success: true
      });

      return {
        success: true,
        result,
        agent: this.name,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.tasksFailed++;
      this.stats.totalExecutionTime += executionTime;

      console.error(`❌ ${this.name} failed task`, {
        executionTime,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        agent: this.name,
        executionTime
      };
    }
  }

  async healthCheck() {
    return {
      healthy: true,
      name: this.name,
      stats: this.stats,
      specializations: this.specializations
    };
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.tasksExecuted > 0 
        ? Math.round((this.stats.tasksSucceeded / this.stats.tasksExecuted) * 100) 
        : 100
    };
  }
}

// Content Creator Agent - Generates engaging Twitter content
class ContentCreatorAgent extends BaseAgent {
  constructor() {
    super('ContentCreator', ['content_creation', 'copywriting', 'social_media']);
  }

  async handleMessage(input, context = {}) {
    const result = await openaiClient.runSpecializedCompletion(
      'content_creator',
      input,
      {
        ...context,
        userProfile: context.profile || {},
        recentTweets: context.recentTweets || [],
        timestamp: new Date().toISOString()
      }
    );

    return {
      type: 'content',
      content: result.response,
      metadata: {
        model: result.model,
        usage: result.usage,
        agent: this.name
      }
    };
  }
}

// Hashtag Specialist Agent - Optimizes hashtags for maximum reach
class HashtagSpecialistAgent extends BaseAgent {
  constructor() {
    super('HashtagSpecialist', ['hashtag_optimization', 'seo', 'trends']);
  }

  async handleMessage(input, context = {}) {
    const result = await openaiClient.runSpecializedCompletion(
      'hashtag_specialist',
      input,
      {
        ...context,
        currentTrends: context.trends || [],
        userNiche: context.niche || 'general',
        timestamp: new Date().toISOString()
      }
    );

    return {
      type: 'hashtags',
      hashtags: this.extractHashtags(result.response),
      recommendations: result.response,
      metadata: {
        model: result.model,
        usage: result.usage,
        agent: this.name
      }
    };
  }

  extractHashtags(text) {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    return text.match(hashtagRegex) || [];
  }
}

// Engagement Optimizer Agent - Maximizes engagement potential
class EngagementOptimizerAgent extends BaseAgent {
  constructor() {
    super('EngagementOptimizer', ['engagement', 'analytics', 'optimization']);
  }

  async handleMessage(input, context = {}) {
    const result = await openaiClient.runSpecializedCompletion(
      'engagement_optimizer',
      input,
      {
        ...context,
        analytics: context.analytics || {},
        followers: context.followers || 0,
        engagementHistory: context.engagementHistory || [],
        timestamp: new Date().toISOString()
      }
    );

    return {
      type: 'engagement_optimization',
      recommendations: result.response,
      optimizedContent: this.extractOptimizedContent(result.response),
      metadata: {
        model: result.model,
        usage: result.usage,
        agent: this.name
      }
    };
  }

  extractOptimizedContent(text) {
    // Simple extraction - in a real implementation, this would be more sophisticated
    const lines = text.split('\n');
    return lines.find(line => line.toLowerCase().includes('optimized') || line.includes('👍')) || text;
  }
}

// Trend Analyst Agent - Analyzes trends and suggests trending content
class TrendAnalystAgent extends BaseAgent {
  constructor() {
    super('TrendAnalyst', ['trend_analysis', 'research', 'market_intelligence']);
  }

  async handleMessage(input, context = {}) {
    const result = await openaiClient.runSpecializedCompletion(
      'trend_analyst',
      input,
      {
        ...context,
        currentDate: new Date().toISOString().split('T')[0],
        userNiche: context.niche || 'general',
        recentAnalytics: context.analytics || {},
        timestamp: new Date().toISOString()
      }
    );

    return {
      type: 'trend_analysis',
      trends: this.extractTrends(result.response),
      analysis: result.response,
      contentSuggestions: this.extractContentSuggestions(result.response),
      metadata: {
        model: result.model,
        usage: result.usage,
        agent: this.name
      }
    };
  }

  extractTrends(text) {
    // Extract trending topics mentioned in the response
    const trendRegex = /#\w+|trending:\s*(.+)|trend:\s*(.+)/gi;
    const matches = text.match(trendRegex) || [];
    return matches.slice(0, 5); // Top 5 trends
  }

  extractContentSuggestions(text) {
    // Extract content suggestions from the response
    const lines = text.split('\n');
    return lines
      .filter(line => line.includes('💡') || line.includes('suggestion') || line.includes('idea'))
      .slice(0, 3); // Top 3 suggestions
  }
}

// Scheduler Agent - Optimizes posting timing and frequency
class SchedulerAgent extends BaseAgent {
  constructor() {
    super('Scheduler', ['scheduling', 'timing_optimization', 'audience_analysis']);
  }

  async handleMessage(input, context = {}) {
    const result = await openaiClient.runSpecializedCompletion(
      'scheduler',
      input,
      {
        ...context,
        timezone: context.timezone || 'UTC',
        audienceLocation: context.audienceLocation || 'global',
        postingHistory: context.postingHistory || [],
        currentTime: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }
    );

    return {
      type: 'scheduling',
      recommendations: result.response,
      optimalTimes: this.extractOptimalTimes(result.response),
      frequency: this.extractFrequency(result.response),
      metadata: {
        model: result.model,
        usage: result.usage,
        agent: this.name
      }
    };
  }

  extractOptimalTimes(text) {
    // Extract time recommendations
    const timeRegex = /\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/gi;
    return text.match(timeRegex) || [];
  }

  extractFrequency(text) {
    // Extract posting frequency recommendations
    const freqRegex = /\d+\s*(times?\s*)?(per|every)\s*(day|hour|week)/gi;
    const match = text.match(freqRegex);
    return match ? match[0] : 'No specific frequency mentioned';
  }
}

// Agent Factory - Creates and manages agent instances
class TwitterAgentFactory {
  constructor() {
    this.agents = new Map();
    this.initializeAgents();
  }

  initializeAgents() {
    // Create all specialized agents
    this.agents.set('content_creator', new ContentCreatorAgent());
    this.agents.set('hashtag_specialist', new HashtagSpecialistAgent());
    this.agents.set('engagement_optimizer', new EngagementOptimizerAgent());  
    this.agents.set('trend_analyst', new TrendAnalystAgent());
    this.agents.set('scheduler', new SchedulerAgent());

    // Initialize video generation agent
    try {
      const { ArweaveVideoAgent } = require('./ArweaveVideoAgent.js');
      this.agents.set('video_generator', new ArweaveVideoAgent());
      console.log('✅ ArweaveVideoAgent initialized successfully');
    } catch (error) {
      console.warn('⚠️ Failed to initialize ArweaveVideoAgent:', error.message);
    }

    console.log('🤖 Initialized Agents:', Array.from(this.agents.keys()));
  }

  getAgent(agentType) {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`);
    }
    return agent;
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  getAvailableAgentTypes() {
    return Array.from(this.agents.keys());
  }

  async healthCheckAll() {
    const results = {};
    for (const [type, agent] of this.agents) {
      results[type] = await agent.healthCheck();
    }
    return results;
  }

  getSystemStats() {
    const stats = {};
    for (const [type, agent] of this.agents) {
      stats[type] = agent.getStats();
    }
    return {
      totalAgents: this.agents.size,
      agentStats: stats,
      systemHealth: 'operational'
    };
  }
}

// Singleton factory instance
const twitterAgentFactory = new TwitterAgentFactory();

module.exports = { 
  BaseAgent,
  ContentCreatorAgent,
  HashtagSpecialistAgent,
  EngagementOptimizerAgent,
  TrendAnalystAgent,
  SchedulerAgent,
  TwitterAgentFactory,
  twitterAgentFactory
}; 