const { twitterAgentFactory } = require('./TwitterContentAgents.js');
const openaiClient = require('../api/openaiClient.js');

class MultiAgentOrchestrator {
  constructor(config = {}) {
    this.name = 'MultiAgentOrchestrator';
    this.config = {
      complexityThreshold: config.complexityThreshold || 3,
      enableWorkflows: config.enableWorkflows !== false,
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      ...config
    };

    this.agentFactory = twitterAgentFactory;
    this.activeWorkflows = new Map();
    this.completedWorkflows = new Map();
    
    console.log('🎯 MultiAgentOrchestrator initialized', {
      availableAgents: this.agentFactory.getAvailableAgentTypes(),
      config: this.config
    });
  }

  /**
   * Main entry point - process requests and route to appropriate agents
   */
  async processRequest(input, context = {}) {
    try {
      console.log('🚀 Processing multi-agent request', { 
        inputLength: input.length,
        hasContext: Object.keys(context).length > 0 
      });

      // Analyze request complexity and requirements
      const analysis = await this.analyzeRequest(input, context);
      
      console.log('📊 Request analysis', analysis);

      // Route based on complexity and requirements
      if (analysis.requiresMultiAgent || analysis.complexity >= this.config.complexityThreshold) {
        return await this.handleComplexWorkflow(input, context, analysis);
      } else {
        return await this.handleSimpleTask(input, context, analysis);
      }
    } catch (error) {
      console.error('❌ Multi-agent request processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze request to determine routing strategy
   */
  async analyzeRequest(input, context) {
    let complexity = 0;
    let requiresMultiAgent = false;
    let suggestedAgents = [];
    let workflow = 'simple';

    const inputLower = input.toLowerCase();

    // Check for content creation indicators
    if (inputLower.includes('create') || inputLower.includes('write') || inputLower.includes('generate')) {
      complexity += 1;
      suggestedAgents.push('content_creator');
    }

    // Check for hashtag optimization requests
    if (inputLower.includes('hashtag') || inputLower.includes('#') || inputLower.includes('tag')) {
      complexity += 1;
      suggestedAgents.push('hashtag_specialist');
    }

    // Check for engagement optimization
    if (inputLower.includes('engagement') || inputLower.includes('viral') || inputLower.includes('optimize')) {
      complexity += 1;
      suggestedAgents.push('engagement_optimizer');
    }

    // Check for trend analysis
    if (inputLower.includes('trend') || inputLower.includes('trending') || inputLower.includes('popular')) {
      complexity += 1;
      suggestedAgents.push('trend_analyst');
    }

    // Check for scheduling requests
    if (inputLower.includes('schedule') || inputLower.includes('time') || inputLower.includes('when')) {
      complexity += 1;
      suggestedAgents.push('scheduler');
    }

    // Check for comprehensive content strategy requests
    if (inputLower.includes('strategy') || inputLower.includes('campaign') || inputLower.includes('comprehensive')) {
      complexity += 2;
      requiresMultiAgent = true;
      workflow = 'comprehensive';
      suggestedAgents = ['content_creator', 'hashtag_specialist', 'engagement_optimizer', 'scheduler'];
    }

    // Check for multi-step indicators
    const multiStepIndicators = [
      'analyze and create', 'research then', 'first...then', 'step by step',
      'optimize and improve', 'create and schedule', 'complete solution'
    ];
    
    const hasMultiStep = multiStepIndicators.some(indicator => inputLower.includes(indicator));
    if (hasMultiStep) {
      complexity += 2;
      requiresMultiAgent = true;
      workflow = 'sequential';
    }

    // Determine workflow complexity
    if (complexity >= 5) {
      workflow = 'comprehensive';
      requiresMultiAgent = true;
    } else if (complexity >= 3) {
      workflow = 'moderate';
      requiresMultiAgent = true;
    }

    // Ensure we have at least one agent if none were identified
    if (suggestedAgents.length === 0) {
      suggestedAgents.push('content_creator'); // Default to content creation
    }

    return {
      complexity,
      requiresMultiAgent,
      suggestedAgents: [...new Set(suggestedAgents)], // Remove duplicates
      workflow,
      reasoning: `Complexity: ${complexity}, Multi-step: ${hasMultiStep}, Agents: ${suggestedAgents.join(', ')}`
    };
  }

  /**
   * Handle simple tasks with single agent
   */
  async handleSimpleTask(input, context, analysis) {
    console.log('🎯 Handling simple task', { agent: analysis.suggestedAgents[0] });

    try {
      const agentType = analysis.suggestedAgents[0];
      const agent = this.agentFactory.getAgent(agentType);
      
      const result = await agent.executeTask(input, context);

      if (!result.success) {
        throw new Error(`Agent ${agentType} failed: ${result.error}`);
      }

      return {
        success: true,
        workflow: 'simple',
        results: [result.result],
        agents: [agentType],
        executionTime: result.executionTime,
        metadata: {
          complexity: analysis.complexity,
          workflow: analysis.workflow,
          totalAgents: 1
        }
      };

    } catch (error) {
      console.error('❌ Simple task execution failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle complex workflows using multiple agents
   */
  async handleComplexWorkflow(input, context, analysis) {
    const workflowId = this.generateWorkflowId();
    console.log('🔄 Handling complex workflow', { 
      workflowId,
      workflow: analysis.workflow,
      agents: analysis.suggestedAgents 
    });

    try {
      let result;
      
      switch (analysis.workflow) {
        case 'comprehensive':
          result = await this.executeComprehensiveWorkflow(workflowId, input, context, analysis.suggestedAgents);
          break;
        case 'sequential':
          result = await this.executeSequentialWorkflow(workflowId, input, context, analysis.suggestedAgents);
          break;
        default:
          result = await this.executeParallelWorkflow(workflowId, input, context, analysis.suggestedAgents);
      }

      // Store completed workflow
      this.completedWorkflows.set(workflowId, {
        id: workflowId,
        input,
        context,
        analysis,
        result,
        completedAt: new Date().toISOString()
      });

      return result;

    } catch (error) {
      console.error('❌ Complex workflow execution failed', { workflowId, error: error.message });
      throw error;
    }
  }

  /**
   * Execute comprehensive workflow - all agents contribute to final output
   */
  async executeComprehensiveWorkflow(workflowId, input, context, agents) {
    console.log('📋 Executing comprehensive workflow', { workflowId, agents });

    const results = new Map();
    let enrichedContext = { ...context, originalInput: input };

    // Execute agents in optimal order for comprehensive content creation
    const executionOrder = [
      'trend_analyst',      // First: analyze current trends
      'content_creator',    // Second: create content based on trends
      'hashtag_specialist', // Third: optimize hashtags for the content
      'engagement_optimizer', // Fourth: optimize for engagement
      'scheduler'           // Fifth: recommend timing
    ];

    for (const agentType of executionOrder) {
      if (!agents.includes(agentType)) continue;

      try {
        const agent = this.agentFactory.getAgent(agentType);
        
        // Enhance context with previous results
        const taskContext = {
          ...enrichedContext,
          previousResults: Object.fromEntries(results),
          workflowId,
          step: results.size + 1,
          totalSteps: agents.length
        };

        const result = await agent.executeTask(input, taskContext);
        
        if (result.success) {
          results.set(agentType, result.result);
          
          // Update context with new insights
          enrichedContext = this.enrichContextWithResults(enrichedContext, agentType, result.result);
        } else {
          console.warn(`⚠️ Agent ${agentType} failed in comprehensive workflow:`, result.error);
        }

      } catch (error) {
        console.error(`❌ Agent ${agentType} error in comprehensive workflow:`, error.message);
      }
    }

    // Synthesize final comprehensive output
    const finalOutput = await this.synthesizeComprehensiveResults(input, results);

    return {
      success: true,
      workflow: 'comprehensive',
      results: Array.from(results.values()),
      finalOutput,
      agents: Array.from(results.keys()),
      executionTime: null, // Could track total time
      metadata: {
        workflowId,
        stepCount: results.size,
        synthesized: true
      }
    };
  }

  /**
   * Execute sequential workflow - agents build on each other's output
   */
  async executeSequentialWorkflow(workflowId, input, context, agents) {
    console.log('🔗 Executing sequential workflow', { workflowId, agents });

    const results = [];
    let currentInput = input;
    let enrichedContext = { ...context, originalInput: input };

    for (let i = 0; i < agents.length; i++) {
      const agentType = agents[i];
      try {
        const agent = this.agentFactory.getAgent(agentType);
        
        const taskContext = {
          ...enrichedContext,
          previousResults: results,
          workflowId,
          step: i + 1,
          totalSteps: agents.length
        };

        const result = await agent.executeTask(currentInput, taskContext);
        
        if (result.success) {
          results.push(result.result);
          
          // Use agent output as input for next agent
          currentInput = result.result.content || result.result.recommendations || currentInput;
          enrichedContext = this.enrichContextWithResults(enrichedContext, agentType, result.result);
        } else {
          console.warn(`⚠️ Agent ${agentType} failed in sequential workflow:`, result.error);
          results.push({ error: result.error, agent: agentType });
        }

      } catch (error) {
        console.error(`❌ Agent ${agentType} error in sequential workflow:`, error.message);
        results.push({ error: error.message, agent: agentType });
      }
    }

    return {
      success: true,
      workflow: 'sequential',
      results,
      agents,
      executionTime: null,
      metadata: {
        workflowId,
        stepCount: results.length
      }
    };
  }

  /**
   * Execute parallel workflow - agents work independently
   */
  async executeParallelWorkflow(workflowId, input, context, agents) {
    console.log('⚡ Executing parallel workflow', { workflowId, agents });

    const taskPromises = agents.map(agentType => {
      const agent = this.agentFactory.getAgent(agentType);
      const taskContext = {
        ...context,
        originalInput: input,
        workflowId,
        parallelExecution: true
      };
      
      return agent.executeTask(input, taskContext)
        .then(result => ({ agentType, ...result }))
        .catch(error => ({ agentType, success: false, error: error.message }));
    });

    const results = await Promise.all(taskPromises);
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    if (failedResults.length > 0) {
      console.warn('⚠️ Some agents failed in parallel workflow:', failedResults);
    }

    return {
      success: successfulResults.length > 0,
      workflow: 'parallel',
      results: successfulResults.map(r => r.result),
      agents: successfulResults.map(r => r.agentType),
      failedAgents: failedResults.map(r => r.agentType),
      executionTime: null,
      metadata: {
        workflowId,
        successCount: successfulResults.length,
        failureCount: failedResults.length
      }
    };
  }

  /**
   * Enrich context with results from previous agents
   */
  enrichContextWithResults(context, agentType, result) {
    const enrichments = {
      trend_analyst: {
        trends: result.trends || [],
        trendAnalysis: result.analysis
      },
      content_creator: {
        generatedContent: result.content,
        contentType: result.type
      },
      hashtag_specialist: {
        optimizedHashtags: result.hashtags || [],
        hashtagStrategy: result.recommendations
      },
      engagement_optimizer: {
        engagementTips: result.recommendations,
        optimizedContent: result.optimizedContent
      },
      scheduler: {
        schedulingAdvice: result.recommendations,
        optimalTimes: result.optimalTimes || []
      }
    };

    return {
      ...context,
      ...enrichments[agentType] || {}
    };
  }

  /**
   * Synthesize comprehensive results into final actionable output
   */
  async synthesizeComprehensiveResults(originalInput, results) {
    try {
      const synthesisPrompt = `Based on the following multi-agent analysis, provide a comprehensive Twitter content strategy:

Original Request: ${originalInput}

Agent Results:
${Array.from(results.entries()).map(([agent, result]) => 
  `${agent.toUpperCase()}:\n${JSON.stringify(result, null, 2)}`
).join('\n\n')}

Synthesize this into a clear, actionable Twitter content plan including:
1. Final optimized tweet content
2. Best hashtags to use
3. Optimal posting time
4. Engagement strategy
5. Key insights from trend analysis

Provide a concise but complete strategy:`;

      const synthesis = await openaiClient.runCompletion(synthesisPrompt, null, {
        temperature: 0.6,
        max_tokens: 800
      });

      return {
        type: 'comprehensive_strategy',
        strategy: synthesis.response,
        agentContributions: results.size,
        synthesized: true
      };

    } catch (error) {
      console.error('❌ Failed to synthesize results:', error.message);
      return {
        type: 'individual_results',
        message: 'Synthesis failed, showing individual agent results',
        results: Object.fromEntries(results)
      };
    }
  }

  /**
   * Get system status and statistics
   */
  getSystemStatus() {
    const agentStats = this.agentFactory.getSystemStats();
    
    return {
      orchestrator: {
        name: this.name,
        status: 'operational',
        config: this.config,
        activeWorkflows: this.activeWorkflows.size,
        completedWorkflows: this.completedWorkflows.size
      },
      agents: agentStats,
      capabilities: this.agentFactory.getAvailableAgentTypes(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get available agent types and their capabilities
   */
  getAvailableCapabilities() {
    return this.agentFactory.getAvailableAgentTypes().map(type => {
      const agent = this.agentFactory.getAgent(type);
      return {
        type,
        name: agent.name,
        specializations: agent.specializations,
        stats: agent.getStats()
      };
    });
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Shutdown orchestrator
   */
  shutdown() {
    this.activeWorkflows.clear();
    console.log('🔴 MultiAgentOrchestrator shutdown completed');
  }
}

// Singleton instance
const multiAgentOrchestrator = new MultiAgentOrchestrator();

module.exports = { 
  MultiAgentOrchestrator,
  multiAgentOrchestrator
}; 