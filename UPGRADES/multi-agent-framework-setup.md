# Multi-Agent Framework & OpenAI Integration Setup

This guide provides everything needed to replicate the multi-agent framework and OpenAI integration from TaskMaster in other projects.

## 🏗️ Architecture Overview

The system consists of several key components working together:

1. **MultiAgentOrchestrator** - Main coordination and routing
2. **AgentRegistry** - Agent discovery, health monitoring, and load balancing
3. **WorkflowExecutor** - Multi-step workflow coordination
4. **OpenAI Client** - Standardized OpenAI API integration
5. **Specialized Agents** - Task-specific intelligent agents
6. **Environment Configuration** - Centralized API key and settings management

## 📦 Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "openai": "^4.104.0",
    "dotenv": "^16.5.0",
    "axios": "^1.9.0",
    "uuid": "^9.0.1",
    "node-fetch": "^3.3.2",
    "chalk": "^5.3.0",
    "fs-extra": "^11.3.0"
  }
}
```

### Installation
```bash
npm install openai dotenv axios uuid node-fetch chalk fs-extra
```

## 🔑 Environment Configuration

### 1. Environment Variables (.env)
```bash
# Required: OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_ASSISTANT_ID=asst_your-assistant-id-here
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=1500

# Optional: Alternative AI Providers
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
ANTHROPIC_API_KEY=your-anthropic-key
PERPLEXITY_API_KEY=your-perplexity-key

# Optional: Application Settings
TASKMASTER_LOG_LEVEL=info
NODE_ENV=development
```

### 2. Environment Configuration Class
```javascript
// src/config/environment.js
import { config } from 'dotenv';
import { log } from '../utils/index.js';

config(); // Load .env file

export class EnvironmentConfig {
  constructor() {
    this.config = this.loadConfig();
    this.validatedKeys = new Map();
  }

  async initializeValidation() {
    if (this.config.openai.apiKey) {
      const isValid = await this.validateOpenAIKey();
      this.validatedKeys.set('openai', isValid);
      
      if (isValid) {
        log('info', '✅ OpenAI API key validation successful!');
      } else {
        log('error', '❌ OpenAI API key validation failed');
      }
    }
    this.validateRequired();
  }

  loadConfig() {
    return {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        assistantId: process.env.OPENAI_ASSISTANT_ID,
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1500
      },
      azure: {
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT
      },
      providers: {
        anthropic: process.env.ANTHROPIC_API_KEY,
        perplexity: process.env.PERPLEXITY_API_KEY,
        google: process.env.GOOGLE_API_KEY
      },
      app: {
        logLevel: process.env.TASKMASTER_LOG_LEVEL || 'info',
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };
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
    const hasAzure = !!(this.config.azure.apiKey && this.config.azure.endpoint);
    const hasAnthropic = !!(this.config.providers.anthropic);

    if (!hasValidOpenAI && !hasAzure && !hasAnthropic) {
      const message = 'Missing required AI provider API key (OpenAI, Azure, or Anthropic)';
      if (this.config.app.nodeEnv === 'production') {
        throw new Error(message);
      } else {
        log('warn', message + ' - some features may not work');
      }
    }
  }

  getOpenAIConfig() { return this.config.openai; }
  getProviderKey(provider) {
    switch (provider.toLowerCase()) {
      case 'openai': return this.config.openai.apiKey;
      case 'azure': return this.config.azure.apiKey;
      case 'anthropic': return this.config.providers.anthropic;
      default: return null;
    }
  }
  isProviderConfigured(provider) {
    const key = this.getProviderKey(provider);
    return !!(key && key.length > 10);
  }
}

// Singleton instance
export const environmentConfig = new EnvironmentConfig();
export const getOpenAIConfig = () => environmentConfig.getOpenAIConfig();
export const isProviderConfigured = (provider) => environmentConfig.isProviderConfigured(provider);
```

## 🤖 OpenAI Client Integration

### Core OpenAI Client
```javascript
// src/api/openaiClient.js
import OpenAI from 'openai';
import { environmentConfig } from '../config/environment.js';
import { log } from '../utils/index.js';

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
      log('warn', 'OpenAI API key not found. Client not initialized.');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        timeout: 60000, // 60 second timeout
        maxRetries: this.retryConfig.maxRetries
      });
      log('info', '✅ OpenAI client initialized successfully');
    } catch (error) {
      log('error', `Failed to initialize OpenAI client: ${error.message}`);
      throw error;
    }
  }

  async runOpenAICompletion(prompt, tools = null, thread = null, options = {}) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Check your API key.');
    }

    const config = environmentConfig.getOpenAIConfig();
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Use Assistants API if thread provided
        if (thread) {
          return await this.runThreadCompletion(prompt, thread, tools, options);
        }

        // Standard Chat Completions API
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

        log('info', `Making OpenAI request (attempt ${attempt + 1})`, {
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
        log('warn', `OpenAI attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt === this.retryConfig.maxRetries) {
          throw error;
        }
        
        await this.sleep(this.retryConfig.retryDelay * Math.pow(2, attempt));
      }
    }
  }

  async runThreadCompletion(message, threadId, tools = null, options = {}) {
    try {
      // Add message to thread
      await this.client.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message
      });

      // Create and run assistant
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: options.assistantId || environmentConfig.config.openai.assistantId,
        tools: tools || [],
        temperature: options.temperature,
        max_tokens: options.max_tokens
      });

      // Poll for completion
      let runStatus = await this.client.beta.threads.runs.retrieve(threadId, run.id);
      
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        await this.sleep(1000);
        runStatus = await this.client.beta.threads.runs.retrieve(threadId, run.id);
      }

      if (runStatus.status === 'completed') {
        const messages = await this.client.beta.threads.messages.list(threadId);
        const latestMessage = messages.data[0];
        
        return {
          success: true,
          response: latestMessage.content[0].text.value,
          threadId,
          runId: run.id,
          usage: runStatus.usage,
          toolCalls: runStatus.required_action?.submit_tool_outputs?.tool_calls || null
        };
      } else {
        throw new Error(`Thread run failed with status: ${runStatus.status}`);
      }

    } catch (error) {
      throw new Error(`Thread completion failed: ${error.message}`);
    }
  }

  async createThread() {
    const thread = await this.client.beta.threads.create();
    return thread.id;
  }

  async addMessage(threadId, content, role = 'user') {
    return await this.client.beta.threads.messages.create(threadId, {
      role,
      content
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const openaiClient = new OpenAIClient();
export default openaiClient;
```

## 🎭 Agent Registry System

### Agent Registry for Discovery and Health Monitoring
```javascript
// src/agents/agentRegistry.js
import { log } from '../utils/index.js';

export class AgentRegistry {
  constructor(config = {}) {
    this.config = {
      enableHealthMonitoring: config.enableHealthMonitoring !== false,
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
      enableLoadBalancing: config.enableLoadBalancing !== false,
      maxRetries: config.maxRetries || 3,
      ...config
    };

    this.agents = new Map();
    this.agentHealth = new Map();
    this.agentCapabilities = new Map();
    this.agentStats = new Map();
    this.healthCheckTimer = null;

    if (this.config.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }

    log('AgentRegistry initialized', { 
      agentCount: this.agents.size,
      healthMonitoring: this.config.enableHealthMonitoring
    });
  }

  registerAgent(agentId, config) {
    const {
      instance,
      capabilities = [],
      specializations = [],
      complexity = 'medium',
      estimatedDuration = { min: 30, max: 120 },
      maxConcurrentTasks = 3,
      metadata = {}
    } = config;

    if (!instance) {
      throw new Error(`Agent instance is required for registration: ${agentId}`);
    }

    this.agents.set(agentId, {
      instance,
      complexity,
      estimatedDuration,
      maxConcurrentTasks,
      metadata,
      registeredAt: Date.now()
    });

    this.agentCapabilities.set(agentId, {
      capabilities: new Set(capabilities),
      specializations: new Set(specializations),
      lastUpdated: Date.now()
    });

    // Initialize health tracking
    this.agentHealth.set(agentId, {
      status: 'healthy',
      lastCheck: Date.now(),
      uptime: 0,
      errorCount: 0,
      successRate: 100
    });

    // Initialize statistics
    this.agentStats.set(agentId, {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      concurrentTasks: 0,
      lastActivity: Date.now()
    });

    log(`Agent registered: ${agentId}`, {
      capabilities: capabilities.length,
      specializations: specializations.length,
      complexity
    });

    return agentId;
  }

  getAgent(agentId) {
    const agentConfig = this.agents.get(agentId);
    if (!agentConfig) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return {
      id: agentId,
      instance: agentConfig.instance,
      config: agentConfig,
      capabilities: this.agentCapabilities.get(agentId),
      health: this.agentHealth.get(agentId),
      stats: this.agentStats.get(agentId)
    };
  }

  findBestAgent(requirements = {}) {
    const {
      capabilities = [],
      specializations = [],
      complexity = 'medium',
      preferredAgent = null,
      excludeAgents = [],
      requireHealthy = true
    } = requirements;

    let candidateAgents = Array.from(this.agents.keys());

    // Filter by excluded agents
    if (excludeAgents.length > 0) {
      candidateAgents = candidateAgents.filter(id => !excludeAgents.includes(id));
    }

    // Prefer specific agent if requested and available
    if (preferredAgent && candidateAgents.includes(preferredAgent)) {
      const agent = this.getAgent(preferredAgent);
      if (!requireHealthy || agent.health.status === 'healthy') {
        return agent;
      }
    }

    // Filter by capabilities
    if (capabilities.length > 0) {
      candidateAgents = candidateAgents.filter(agentId => {
        const agentCapabilities = this.agentCapabilities.get(agentId);
        return capabilities.some(cap => agentCapabilities.capabilities.has(cap));
      });
    }

    // Filter by specializations
    if (specializations.length > 0) {
      candidateAgents = candidateAgents.filter(agentId => {
        const agentCapabilities = this.agentCapabilities.get(agentId);
        return specializations.some(spec => agentCapabilities.specializations.has(spec));
      });
    }

    // Filter by health status
    if (requireHealthy) {
      candidateAgents = candidateAgents.filter(agentId => {
        const health = this.agentHealth.get(agentId);
        return health.status === 'healthy';
      });
    }

    if (candidateAgents.length === 0) {
      return null;
    }

    // Score and rank remaining candidates
    const scoredAgents = candidateAgents.map(agentId => {
      const agent = this.getAgent(agentId);
      const score = this.calculateAgentScore(agent, requirements);
      return { agent, score };
    });

    // Sort by score (highest first)
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }

  calculateAgentScore(agent, requirements) {
    let score = 0;

    // Health and reliability (40% of score)
    if (agent.health.status === 'healthy') {
      score += 40;
    } else if (agent.health.status === 'degraded') {
      score += 20;
    }

    score += (agent.health.successRate / 100) * 20;

    // Capability match (30% of score)
    const { capabilities = [], specializations = [] } = requirements;
    let capabilityScore = 0;

    if (capabilities.length > 0) {
      const matchingCapabilities = capabilities.filter(cap => 
        agent.capabilities.capabilities.has(cap)
      );
      capabilityScore += (matchingCapabilities.length / capabilities.length) * 15;
    }

    if (specializations.length > 0) {
      const matchingSpecializations = specializations.filter(spec => 
        agent.capabilities.specializations.has(spec)
      );
      capabilityScore += (matchingSpecializations.length / specializations.length) * 15;
    }

    score += capabilityScore;

    // Load balancing (20% of score)
    const loadFactor = agent.stats.concurrentTasks / agent.config.maxConcurrentTasks;
    score += Math.max(0, 20 * (1 - loadFactor));

    // Performance history (10% of score)
    if (agent.stats.tasksExecuted > 0) {
      const successRate = agent.stats.tasksSucceeded / agent.stats.tasksExecuted;
      score += successRate * 10;
    } else {
      score += 5; // Neutral score for new agents
    }

    return score;
  }

  recordTaskExecution(agentId, executionTime, success = true) {
    if (!this.agentStats.has(agentId)) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const stats = this.agentStats.get(agentId);
    
    stats.tasksExecuted++;
    stats.totalExecutionTime += executionTime;
    stats.averageExecutionTime = Math.round(stats.totalExecutionTime / stats.tasksExecuted);
    stats.lastActivity = Date.now();

    if (success) {
      stats.tasksSucceeded++;
    } else {
      stats.tasksFailed++;
    }

    // Update health success rate
    const health = this.agentHealth.get(agentId);
    health.successRate = Math.round((stats.tasksSucceeded / stats.tasksExecuted) * 100);
    
    if (health.successRate < 70) {
      health.status = 'degraded';
    } else if (health.successRate >= 90) {
      health.status = 'healthy';
    }

    this.agentStats.set(agentId, stats);
    this.agentHealth.set(agentId, health);
  }

  async performHealthCheck(agentId) {
    try {
      const agent = this.getAgent(agentId);
      
      // Call health check method if available
      if (typeof agent.instance.healthCheck === 'function') {
        const healthResult = await agent.instance.healthCheck();
        
        this.updateAgentHealth(agentId, {
          status: healthResult.healthy ? 'healthy' : 'degraded',
          lastCheck: Date.now(),
          ...healthResult
        });

        return healthResult;
      } else {
        // Basic health check - agent is responsive
        this.updateAgentHealth(agentId, {
          status: 'healthy',
          lastCheck: Date.now()
        });

        return { healthy: true, message: 'Basic health check passed' };
      }
    } catch (error) {
      this.updateAgentHealth(agentId, {
        status: 'unhealthy',
        lastCheck: Date.now(),
        errorCount: (this.agentHealth.get(agentId)?.errorCount || 0) + 1
      });

      log(`Health check failed for agent: ${agentId}`, { error: error.message });
      return { healthy: false, error: error.message };
    }
  }

  updateAgentHealth(agentId, healthUpdate) {
    if (!this.agentHealth.has(agentId)) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const currentHealth = this.agentHealth.get(agentId);
    const updatedHealth = {
      ...currentHealth,
      ...healthUpdate,
      lastCheck: Date.now()
    };

    this.agentHealth.set(agentId, updatedHealth);
  }

  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      return; // Already running
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performAllHealthChecks();
        log('Health monitoring check completed', {
          agentCount: this.agents.size,
          healthyCount: this.getHealthyAgents().length
        });
      } catch (error) {
        log(`Health monitoring error: ${error.message}`);
      }
    }, this.config.healthCheckInterval);

    log('Health monitoring started', {
      interval: this.config.healthCheckInterval
    });
  }

  async performAllHealthChecks() {
    const results = {};
    
    for (const agentId of this.agents.keys()) {
      results[agentId] = await this.performHealthCheck(agentId);
    }

    return results;
  }

  getHealthyAgents() {
    return this.getAllAgents().filter(agent => agent.health.status === 'healthy');
  }

  getAllAgents() {
    const agents = [];
    for (const agentId of this.agents.keys()) {
      agents.push(this.getAgent(agentId));
    }
    return agents;
  }

  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      log('Health monitoring stopped');
    }
  }

  shutdown() {
    this.stopHealthMonitoring();
    this.agents.clear();
    this.agentCapabilities.clear();
    this.agentHealth.clear();
    this.agentStats.clear();
    
    log('Agent registry shutdown completed');
  }
}
```

## 🎯 Multi-Agent Orchestrator

### Main Orchestration System
```javascript
// src/agents/multiAgentOrchestrator.js
import { AgentRegistry } from './agentRegistry.js';
import { WorkflowExecutor } from './workflows/workflowExecutor.js';
import { log } from '../utils/index.js';
import openaiClient from '../api/openaiClient.js';

export class MultiAgentOrchestrator {
  constructor(config = {}) {
    this.name = 'multi-agent-orchestrator';
    this.config = {
      complexityThreshold: config.complexityThreshold || 5,
      enableWorkflows: config.enableWorkflows !== false,
      enableAgentRegistry: config.enableAgentRegistry !== false,
      ...config
    };

    // Initialize agent registry
    if (this.config.enableAgentRegistry) {
      this.agentRegistry = new AgentRegistry(config.agentRegistry);
    }
    
    // Initialize workflow system
    if (this.config.enableWorkflows) {
      this.workflowExecutor = new WorkflowExecutor(this, config.workflowExecutor);
    }
    
    // Initialize specialized agent instances
    this.specializedAgents = {};
    
    log('MultiAgentOrchestrator initialized', {
      config: this.config,
      workflowsEnabled: !!this.workflowExecutor,
      registryEnabled: !!this.agentRegistry
    });
  }

  /**
   * Main entry point - route requests based on complexity
   */
  async processRequest(input, context = {}) {
    try {
      log('Processing multi-agent request', { 
        inputLength: input.length,
        hasContext: Object.keys(context).length > 0 
      });

      // Analyze request complexity
      const complexity = await this.analyzeComplexity(input, context);
      
      log('Request complexity analysis', complexity);

      // Route based on complexity and requirements
      if (complexity.requiresMultiAgent || complexity.score >= this.config.complexityThreshold) {
        return await this.handleComplexWorkflow(input, context, complexity);
      } else {
        return await this.handleSimpleTask(input, context);
      }
    } catch (error) {
      log('Error in multi-agent request processing', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze request complexity to determine routing
   */
  async analyzeComplexity(input, context) {
    // Simple heuristics for complexity analysis
    let score = 0;
    let requiresMultiAgent = false;
    let suggestedAgents = [];
    let workflow = 'simple';

    // Check for multi-step indicators
    const multiStepIndicators = [
      'research and analyze', 'step by step', 'first...then', 'analyze then',
      'research', 'investigate', 'compare', 'summarize', 'generate report'
    ];
    
    const hasMultiStep = multiStepIndicators.some(indicator => 
      input.toLowerCase().includes(indicator)
    );
    
    if (hasMultiStep) {
      score += 3;
      requiresMultiAgent = true;
      workflow = 'sequential';
    }

    // Check for research requirements
    if (input.toLowerCase().includes('research') || 
        input.toLowerCase().includes('find information') ||
        input.toLowerCase().includes('search for')) {
      score += 2;
      suggestedAgents.push('researcher');
    }

    // Check for content processing
    if (input.toLowerCase().includes('process') || 
        input.toLowerCase().includes('extract') ||
        input.toLowerCase().includes('convert')) {
      score += 2;
      suggestedAgents.push('content-processor');
    }

    // Check for analysis requirements
    if (input.toLowerCase().includes('analyze') || 
        input.toLowerCase().includes('insights') ||
        input.toLowerCase().includes('trends')) {
      score += 2;
      suggestedAgents.push('analyst');
    }

    // Check input length (longer inputs tend to be more complex)
    if (input.length > 500) {
      score += 1;
    }

    // Determine workflow complexity
    if (score >= 7) {
      workflow = 'complex';
    } else if (score >= 5) {
      workflow = 'moderate';
    }

    return {
      score,
      requiresMultiAgent: requiresMultiAgent || score >= this.config.complexityThreshold,
      suggestedAgents,
      workflow,
      reasoning: `Complexity score: ${score}, Multi-step: ${hasMultiStep}`
    };
  }

  /**
   * Handle simple tasks with single agent
   */
  async handleSimpleTask(input, context) {
    log('Handling simple task with single agent');

    try {
      // Use OpenAI directly for simple tasks
      const result = await openaiClient.runOpenAICompletion(
        input,
        null, // No tools needed for simple tasks
        context.threadId,
        {
          model: context.model || 'gpt-4o',
          temperature: context.temperature || 0.7
        }
      );

      return {
        success: true,
        results: [result.response],
        source: 'single-agent',
        workflow: 'simple',
        usage: result.usage
      };

    } catch (error) {
      log('Simple task execution failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle complex workflows using multi-agent coordination
   */
  async handleComplexWorkflow(input, context, complexity) {
    log('Handling complex workflow', { 
      workflow: complexity.workflow,
      agents: complexity.suggestedAgents 
    });

    // Use workflow executor if available
    if (this.workflowExecutor) {
      return await this.workflowExecutor.executeWorkflow(
        complexity.workflow,
        input,
        {
          ...context,
          suggestedAgents: complexity.suggestedAgents,
          complexity: complexity.score
        }
      );
    }

    // Fallback to sequential execution
    return await this.executeSequentialAgents(input, context, complexity.suggestedAgents);
  }

  /**
   * Execute agents sequentially (fallback method)
   */
  async executeSequentialAgents(input, context, suggestedAgents) {
    const results = [];
    let currentContext = { ...context, originalInput: input };

    for (const agentType of suggestedAgents) {
      try {
        const result = await this.executeAgent(agentType, input, currentContext);
        results.push(result);
        
        // Update context with results
        currentContext = {
          ...currentContext,
          previousResults: results,
          lastResult: result
        };

      } catch (error) {
        log(`Agent execution failed: ${agentType}`, { error: error.message });
        results.push({
          agent: agentType,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      results,
      source: 'sequential-agents',
      workflow: 'sequential'
    };
  }

  /**
   * Execute specific agent
   */
  async executeAgent(agentType, input, context) {
    // Find best agent for the task
    if (this.agentRegistry) {
      const agent = this.agentRegistry.findBestAgent({
        specializations: [agentType],
        requireHealthy: true
      });

      if (agent) {
        const startTime = Date.now();
        try {
          const result = await agent.instance.handleMessage(input, context);
          const executionTime = Date.now() - startTime;
          
          // Record successful execution
          this.agentRegistry.recordTaskExecution(agent.id, executionTime, true);
          
          return {
            agent: agentType,
            success: true,
            result,
            executionTime
          };

        } catch (error) {
          const executionTime = Date.now() - startTime;
          
          // Record failed execution
          this.agentRegistry.recordTaskExecution(agent.id, executionTime, false);
          
          throw error;
        }
      }
    }

    // Fallback to OpenAI with specialized prompt
    const specializedPrompt = this.createSpecializedPrompt(agentType, input);
    const result = await openaiClient.runOpenAICompletion(
      specializedPrompt,
      null,
      context.threadId,
      context
    );

    return {
      agent: agentType,
      success: true,
      result: result.response,
      usage: result.usage
    };
  }

  createSpecializedPrompt(agentType, input) {
    const prompts = {
      'researcher': `As a research specialist, thoroughly investigate and provide detailed information about: ${input}`,
      'content-processor': `As a content processing expert, analyze and process the following content: ${input}`,
      'analyst': `As a data analyst, provide insights and analysis for: ${input}`,
      'qa-specialist': `As a quality assurance specialist, review and validate: ${input}`
    };

    return prompts[agentType] || `As a ${agentType} specialist, help with: ${input}`;
  }

  /**
   * Register a new specialized agent
   */
  registerAgent(agentId, agentInstance, capabilities = [], specializations = []) {
    if (this.agentRegistry) {
      return this.agentRegistry.registerAgent(agentId, {
        instance: agentInstance,
        capabilities,
        specializations,
        complexity: 'medium',
        maxConcurrentTasks: 3
      });
    } else {
      this.specializedAgents[agentId] = agentInstance;
      log(`Agent registered: ${agentId}`);
      return agentId;
    }
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    const baseStats = {
      registeredAgents: Object.keys(this.specializedAgents).length,
      workflowsEnabled: !!this.workflowExecutor,
      registryEnabled: !!this.agentRegistry
    };

    if (this.agentRegistry) {
      const registryStats = this.agentRegistry.getRegistryStats();
      return { ...baseStats, ...registryStats };
    }

    return baseStats;
  }

  /**
   * Shutdown orchestrator
   */
  shutdown() {
    if (this.agentRegistry) {
      this.agentRegistry.shutdown();
    }
    
    this.specializedAgents = {};
    log('MultiAgentOrchestrator shutdown completed');
  }
}
```

## 🔄 Workflow Executor

### Workflow Coordination System
```javascript
// src/agents/workflows/workflowExecutor.js
import { log } from '../../utils/index.js';
import { createSuccessResponse, createErrorResponse } from '../../utils/responseFormatter.js';

export class WorkflowExecutor {
  constructor(orchestrator, config = {}) {
    this.orchestrator = orchestrator;
    this.config = {
      enableParallelExecution: config.enableParallelExecution !== false,
      maxRetries: config.maxRetries || 2,
      retryDelay: config.retryDelay || 1000,
      timeoutMs: config.timeoutMs || 300000, // 5 minutes default
      ...config
    };

    this.activeWorkflows = new Map();
    this.completedWorkflows = new Map();
    
    log('WorkflowExecutor initialized', { config: this.config });
  }

  /**
   * Execute a workflow by template type
   */
  async executeWorkflow(templateType, input, context = {}) {
    const workflowId = this.generateWorkflowId();
    const startTime = Date.now();

    try {
      // Create workflow template based on type
      const template = this.createWorkflowTemplate(templateType, context);

      log(`Starting workflow execution: ${template.name}`, {
        workflowId,
        templateType,
        agents: template.agents.length,
        steps: template.steps.length
      });

      // Initialize workflow state
      const workflowState = {
        id: workflowId,
        template,
        input,
        context,
        startTime,
        status: 'running',
        currentStep: 0,
        results: new Map(),
        errors: [],
        progress: 0
      };

      this.activeWorkflows.set(workflowId, workflowState);

      // Execute workflow based on execution mode
      let result;
      switch (template.executionMode) {
        case 'sequential':
          result = await this.executeSequentialWorkflow(workflowState);
          break;
        case 'parallel':
          result = await this.executeParallelWorkflow(workflowState);
          break;
        default:
          result = await this.executeSequentialWorkflow(workflowState);
      }

      // Finalize workflow
      const duration = Date.now() - startTime;
      workflowState.status = 'completed';
      workflowState.duration = duration;
      workflowState.progress = 100;

      this.activeWorkflows.delete(workflowId);
      this.completedWorkflows.set(workflowId, workflowState);

      log(`Workflow completed successfully: ${template.name}`, {
        workflowId,
        duration,
        stepCount: template.steps.length,
        resultCount: Object.keys(result).length
      });

      return createSuccessResponse(result, {
        source: `workflow-${template.name}`,
        executionTime: duration,
        metadata: {
          workflowId,
          template: template.name,
          stepCount: template.steps.length,
          agentCount: template.agents.length,
          executionMode: template.executionMode
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      log(`Workflow execution failed: ${error.message}`, {
        workflowId,
        templateType,
        duration,
        error: error.message
      });

      // Move to completed with error state
      if (this.activeWorkflows.has(workflowId)) {
        const workflowState = this.activeWorkflows.get(workflowId);
        workflowState.status = 'failed';
        workflowState.error = error.message;
        workflowState.duration = duration;
        
        this.activeWorkflows.delete(workflowId);
        this.completedWorkflows.set(workflowId, workflowState);
      }

      return createErrorResponse(error, {
        source: `workflow-${templateType}`,
        executionTime: duration,
        metadata: { workflowId, template: templateType }
      });
    }
  }

  /**
   * Create workflow template based on type and context
   */
  createWorkflowTemplate(templateType, context) {
    const templates = {
      'simple': {
        name: 'Simple Task',
        executionMode: 'sequential',
        agents: ['assistant'],
        steps: [
          {
            id: 'main_task',
            name: 'Main Task',
            agent: 'assistant',
            description: 'Execute the main task'
          }
        ],
        finalOutputs: ['main_task']
      },
      'research': {
        name: 'Research Workflow',
        executionMode: 'sequential',
        agents: ['researcher', 'analyst'],
        steps: [
          {
            id: 'research',
            name: 'Research Phase',
            agent: 'researcher',
            description: 'Gather information and sources'
          },
          {
            id: 'analysis',
            name: 'Analysis Phase',
            agent: 'analyst',
            description: 'Analyze gathered information',
            dependsOn: ['research'],
            inputs: ['research']
          }
        ],
        finalOutputs: ['analysis']
      },
      'content_processing': {
        name: 'Content Processing Workflow',
        executionMode: 'sequential',
        agents: ['content-processor', 'qa-specialist'],
        steps: [
          {
            id: 'process',
            name: 'Process Content',
            agent: 'content-processor',
            description: 'Process and extract content'
          },
          {
            id: 'validate',
            name: 'Validate Quality',
            agent: 'qa-specialist',
            description: 'Validate processed content',
            dependsOn: ['process'],
            inputs: ['process']
          }
        ],
        finalOutputs: ['validate']
      },
      'complex': {
        name: 'Complex Multi-Agent Workflow',
        executionMode: 'parallel',
        agents: ['researcher', 'content-processor', 'analyst', 'qa-specialist'],
        steps: [
          {
            id: 'research',
            name: 'Research Phase',
            agent: 'researcher',
            description: 'Gather comprehensive information'
          },
          {
            id: 'process',
            name: 'Content Processing',
            agent: 'content-processor',
            description: 'Process available content'
          },
          {
            id: 'analysis',
            name: 'Analysis Phase',
            agent: 'analyst',
            description: 'Analyze all gathered data',
            dependsOn: ['research', 'process'],
            inputs: ['research', 'process']
          },
          {
            id: 'validation',
            name: 'Quality Validation',
            agent: 'qa-specialist',
            description: 'Final quality check',
            dependsOn: ['analysis'],
            inputs: ['analysis']
          }
        ],
        finalOutputs: ['validation']
      }
    };

    return templates[templateType] || templates['simple'];
  }

  /**
   * Execute workflow steps sequentially
   */
  async executeSequentialWorkflow(workflowState) {
    const { template, input, context } = workflowState;
    const results = {};
    let currentContext = { ...context, originalInput: input };

    for (let i = 0; i < template.steps.length; i++) {
      const step = template.steps[i];
      workflowState.currentStep = i;
      workflowState.progress = Math.round((i / template.steps.length) * 100);

      try {
        // Check dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          this.validateStepDependencies(step, results);
        }

        // Prepare step input
        const stepInput = this.prepareStepInput(step, input, results, currentContext);
        
        // Execute step
        const stepResult = await this.executeStep(step, stepInput, currentContext);
        
        // Store results
        results[step.id] = stepResult;
        
        // Update context with new results
        currentContext = {
          ...currentContext,
          previousResults: results,
          lastStepResult: stepResult
        };

        log(`Workflow step completed: ${step.name}`, {
          workflowId: workflowState.id,
          stepId: step.id,
          stepNumber: i + 1,
          totalSteps: template.steps.length
        });

      } catch (error) {
        throw new Error(`Step ${step.id} failed: ${error.message}`);
      }
    }

    return this.aggregateWorkflowResults(template, results);
  }

  /**
   * Execute workflow steps in parallel where possible
   */
  async executeParallelWorkflow(workflowState) {
    const { template, input, context } = workflowState;
    const results = {};
    const executionGroups = this.groupStepsByDependencies(template.steps);

    let currentContext = { ...context, originalInput: input };

    for (const group of executionGroups) {
      // Execute all steps in the group in parallel
      const groupPromises = group.map(step => {
        const stepInput = this.prepareStepInput(step, input, results, currentContext);
        return this.executeStepWithRetry(step, stepInput, currentContext);
      });

      try {
        const groupResults = await Promise.all(groupPromises);
        
        // Aggregate group results
        group.forEach((step, index) => {
          results[step.id] = groupResults[index];
        });

        // Update context
        currentContext = {
          ...currentContext,
          previousResults: results
        };

        // Update progress
        const completedSteps = Object.keys(results).length;
        workflowState.progress = Math.round((completedSteps / template.steps.length) * 100);

        log(`Workflow group completed`, {
          workflowId: workflowState.id,
          groupSize: group.length,
          completedSteps,
          totalSteps: template.steps.length
        });

      } catch (error) {
        throw new Error(`Parallel execution group failed: ${error.message}`);
      }
    }

    return this.aggregateWorkflowResults(template, results);
  }

  /**
   * Execute a single step with the appropriate agent
   */
  async executeStep(step, input, context) {
    const stepContext = {
      ...context,
      stepConfig: step.config || {},
      stepName: step.name,
      stepDescription: step.description
    };

    // Route to orchestrator for agent execution
    return await this.orchestrator.executeAgent(step.agent, input, stepContext);
  }

  /**
   * Execute step with retry logic
   */
  async executeStepWithRetry(step, input, context) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          log(`Retrying step execution: ${step.name}`, { 
            stepId: step.id,
            attempt,
            maxRetries: this.config.maxRetries
          });
          await this.delay(this.config.retryDelay);
        }

        return await this.executeStep(step, input, context);
        
      } catch (error) {
        lastError = error;
        log(`Step execution attempt ${attempt + 1} failed: ${step.name}`, {
          stepId: step.id,
          error: error.message
        });
      }
    }

    throw lastError;
  }

  /**
   * Prepare input for a specific step
   */
  prepareStepInput(step, originalInput, results, context) {
    if (!step.inputs || step.inputs.length === 0) {
      return originalInput;
    }

    // Collect specified inputs from previous results
    const stepInput = {};
    for (const inputKey of step.inputs) {
      // Find the output in previous results
      for (const [stepId, stepResult] of Object.entries(results)) {
        if (stepResult && stepResult[inputKey]) {
          stepInput[inputKey] = stepResult[inputKey];
          break;
        }
      }
    }

    // If no specific inputs found, use original input
    return Object.keys(stepInput).length > 0 ? stepInput : originalInput;
  }

  /**
   * Validate step dependencies are satisfied
   */
  validateStepDependencies(step, results) {
    if (!step.dependsOn) return true;

    for (const dependency of step.dependsOn) {
      if (!results[dependency]) {
        throw new Error(`Step ${step.id} dependency not satisfied: ${dependency}`);
      }
    }

    return true;
  }

  /**
   * Group steps by their dependencies for parallel execution
   */
  groupStepsByDependencies(steps) {
    const groups = [];
    const processed = new Set();

    while (processed.size < steps.length) {
      const currentGroup = [];

      for (const step of steps) {
        if (processed.has(step.id)) continue;

        // Check if all dependencies are satisfied
        const dependenciesSatisfied = !step.dependsOn || 
          step.dependsOn.every(dep => processed.has(dep));

        if (dependenciesSatisfied) {
          currentGroup.push(step);
          processed.add(step.id);
        }
      }

      if (currentGroup.length === 0) {
        throw new Error('Circular dependency detected or unsatisfiable dependencies');
      }

      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Aggregate workflow results based on template specification
   */
  aggregateWorkflowResults(template, stepResults) {
    const finalResults = {};

    // Include final outputs as specified in template
    if (template.finalOutputs && template.finalOutputs.length > 0) {
      for (const outputKey of template.finalOutputs) {
        // Find the output in step results
        for (const [stepId, stepResult] of Object.entries(stepResults)) {
          if (stepResult && stepResult[outputKey]) {
            finalResults[outputKey] = stepResult[outputKey];
            break;
          }
        }
      }
    } else {
      // If no final outputs specified, include all step results
      Object.assign(finalResults, stepResults);
    }

    // Add workflow metadata
    finalResults._workflow = {
      template: template.name,
      executionMode: template.executionMode,
      stepCount: template.steps.length,
      agentCount: template.agents.length,
      allStepResults: stepResults
    };

    return finalResults;
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 🚀 Example Usage

### Basic Setup and Usage
```javascript
// main.js - Example implementation
import { MultiAgentOrchestrator } from './src/agents/multiAgentOrchestrator.js';
import { environmentConfig } from './src/config/environment.js';

async function initializeSystem() {
  // Initialize environment config with API key validation
  await environmentConfig.initializeValidation();
  
  // Create orchestrator with configuration
  const orchestrator = new MultiAgentOrchestrator({
    complexityThreshold: 5,
    enableWorkflows: true,
    enableAgentRegistry: true,
    agentRegistry: {
      enableHealthMonitoring: true,
      healthCheckInterval: 300000 // 5 minutes
    },
    workflowExecutor: {
      enableParallelExecution: true,
      maxRetries: 2,
      timeoutMs: 300000 // 5 minutes
    }
  });

  return orchestrator;
}

async function processRequest(orchestrator, input, context = {}) {
  try {
    const result = await orchestrator.processRequest(input, context);
    
    console.log('Processing Result:', {
      success: result.success,
      source: result.source,
      workflow: result.workflow,
      resultCount: Array.isArray(result.results) ? result.results.length : 1
    });

    return result;
  } catch (error) {
    console.error('Processing failed:', error.message);
    throw error;
  }
}

// Example usage
async function main() {
  const orchestrator = await initializeSystem();
  
  // Simple task
  const simpleResult = await processRequest(
    orchestrator,
    "What is the capital of France?"
  );
  
  // Complex task requiring multiple agents
  const complexResult = await processRequest(
    orchestrator,
    "Research the latest trends in AI technology, analyze the market impact, and provide a comprehensive report with insights and recommendations."
  );
  
  // Shutdown gracefully
  orchestrator.shutdown();
}

main().catch(console.error);
```

### Custom Agent Registration
```javascript
// Custom specialized agent example
class CustomResearchAgent {
  constructor() {
    this.name = 'custom-researcher';
  }

  async handleMessage(input, context) {
    // Custom research implementation
    return `Research result for: ${input}`;
  }

  async healthCheck() {
    return { healthy: true, message: 'Custom research agent is healthy' };
  }
}

// Register custom agent
const customAgent = new CustomResearchAgent();
orchestrator.registerAgent('custom-researcher', customAgent, 
  ['research', 'web-search', 'data-gathering'], 
  ['research', 'investigation']
);
```

## 🔧 Build Specifications

### Project Structure
```
your-project/
├── src/
│   ├── agents/
│   │   ├── agentRegistry.js
│   │   ├── multiAgentOrchestrator.js
│   │   └── workflows/
│   │       └── workflowExecutor.js
│   ├── api/
│   │   └── openaiClient.js
│   ├── config/
│   │   └── environment.js
│   ├── utils/
│   │   └── index.js
│   └── main.js
├── .env
├── package.json
└── README.md
```

### Required Scripts (package.json)
```json
{
  "scripts": {
    "start": "node src/main.js",
    "dev": "node --watch src/main.js",
    "test": "jest",
    "setup": "npm install && echo 'Configure .env with your API keys!'"
  }
}
```

### Logging Utility (src/utils/index.js)
```javascript
export function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  const logLevel = process.env.TASKMASTER_LOG_LEVEL || 'info';
  
  if (typeof message === 'string') {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}]`, message, data);
  }
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### Response Formatter Utility (src/utils/responseFormatter.js)
```javascript
export function createSuccessResponse(data, metadata = {}) {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

export function createErrorResponse(error, metadata = {}) {
  return {
    success: false,
    error: error.message || error,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}
```

## 🎯 Key Features Replicated

1. **Intelligent Request Routing** - Complexity analysis determines single vs multi-agent execution
2. **Agent Discovery & Health Monitoring** - Automatic agent registration, health checks, and load balancing
3. **Workflow Coordination** - Sequential and parallel workflow execution with dependency management
4. **OpenAI Integration** - Robust API client with retry logic, thread support, and tool integration
5. **Environment Management** - Centralized configuration with API key validation
6. **Error Handling & Resilience** - Comprehensive error handling with graceful fallbacks
7. **Performance Monitoring** - Agent statistics tracking and performance metrics
8. **Extensibility** - Easy integration of custom agents and workflows

## 🔐 Security Best Practices

1. **API Key Protection** - Never commit API keys to version control
2. **Environment Validation** - Validate API keys at startup
3. **Request Timeouts** - Set appropriate timeouts for all API calls
4. **Rate Limiting** - Implement rate limiting for external API calls
5. **Error Sanitization** - Don't expose sensitive information in error messages
6. **Health Monitoring** - Monitor agent health and performance metrics

This framework provides a solid foundation for building sophisticated multi-agent AI systems with OpenAI integration, following the same patterns and architecture as the TaskMaster system. 