/**
 * HandoffManager - Implements OpenAI Agents SDK best practices for agent handoffs
 * Based on: https://openai.github.io/openai-agents-python/handoffs/
 */

const { BaseAgent } = require('./BaseAgent.js');

class HandoffManager {
  constructor() {
    this.handoffs = new Map();
    this.inputFilters = new Map();
    this.onHandoffCallbacks = new Map();
  }

  /**
   * Create a handoff between agents (equivalent to handoff() function in OpenAI SDK)
   */
  createHandoff(fromAgent, toAgent, options = {}) {
    const {
      toolNameOverride = null,
      toolDescriptionOverride = null,
      onHandoff = null,
      inputType = null,
      inputFilter = null
    } = options;

    const handoffId = `${fromAgent.name}_to_${toAgent.name}`;
    const toolName = toolNameOverride || `transfer_to_${toAgent.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const handoff = {
      id: handoffId,
      fromAgent: fromAgent.name,
      toAgent: toAgent.name,
      toolName,
      toolDescription: toolDescriptionOverride || `Transfer to ${toAgent.name} for specialized handling`,
      inputType,
      inputFilter,
      onHandoff
    };

    this.handoffs.set(handoffId, handoff);
    
    // Register input filter if provided
    if (inputFilter) {
      this.inputFilters.set(handoffId, inputFilter);
    }

    // Register callback if provided
    if (onHandoff) {
      this.onHandoffCallbacks.set(handoffId, onHandoff);
    }

    console.log(`🤝 Handoff created: ${fromAgent.name} -> ${toAgent.name} (${toolName})`);
    return handoff;
  }

  /**
   * Execute a handoff between agents
   */
  async executeHandoff(handoffId, input, context = {}) {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff ${handoffId} not found`);
    }

    console.log(`🔄 Executing handoff: ${handoff.fromAgent} -> ${handoff.toAgent}`);

    // Execute onHandoff callback if present
    if (this.onHandoffCallbacks.has(handoffId)) {
      const callback = this.onHandoffCallbacks.get(handoffId);
      try {
        await callback(context, input);
      } catch (error) {
        console.error(`❌ Handoff callback failed:`, error);
      }
    }

    // Apply input filter if present
    let filteredInput = input;
    let filteredContext = context;
    
    if (this.inputFilters.has(handoffId)) {
      const filter = this.inputFilters.get(handoffId);
      const filtered = filter({ input, context });
      filteredInput = filtered.input;
      filteredContext = filtered.context;
    }

    return {
      handoff,
      filteredInput,
      filteredContext
    };
  }

  /**
   * Get available handoffs for an agent
   */
  getHandoffsForAgent(agentName) {
    return Array.from(this.handoffs.values())
      .filter(handoff => handoff.fromAgent === agentName);
  }

  /**
   * Get handoff tool definitions for an agent
   */
  getHandoffToolsForAgent(agentName) {
    const handoffs = this.getHandoffsForAgent(agentName);
    return handoffs.map(handoff => ({
      name: handoff.toolName,
      description: handoff.toolDescription,
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for handoff'
          },
          context: {
            type: 'object',
            description: 'Additional context for the handoff'
          }
        },
        required: ['reason']
      }
    }));
  }
}

/**
 * Common input filters (equivalent to handoff_filters in OpenAI SDK)
 */
class HandoffFilters {
  /**
   * Remove all tool calls from history (equivalent to remove_all_tools)
   */
  static removeAllTools(handoffData) {
    const { input, context } = handoffData;
    
    // Clean context by removing tool-specific data
    const cleanedContext = { ...context };
    delete cleanedContext.toolCalls;
    delete cleanedContext.toolResults;
    
    return {
      input: input,
      context: cleanedContext
    };
  }

  /**
   * Keep only essential context for the handoff
   */
  static keepEssentialContext(handoffData) {
    const { input, context } = handoffData;
    
    const essentialContext = {
      userProfile: context.userProfile,
      timestamp: context.timestamp,
      // Keep audio context if present (for our use case)
      audioContext: context.audioContext,
      videoContext: context.videoContext
    };
    
    return {
      input: input,
      context: essentialContext
    };
  }

  /**
   * Preserve audio context for audio-related handoffs
   */
  static preserveAudioContext(handoffData) {
    const { input, context } = handoffData;
    
    const audioContext = {
      audioPath: context.audioPath,
      audioArtist: context.audioArtist,
      audioMixTitle: context.audioMixTitle,
      audioDuration: context.audioDuration,
      audioFileName: context.audioFileName
    };
    
    return {
      input: input,
      context: { ...context, audioContext }
    };
  }
}

/**
 * Recommended prompt prefix (equivalent to RECOMMENDED_PROMPT_PREFIX)
 */
const RECOMMENDED_PROMPT_PREFIX = `You are part of a multi-agent system. You can hand off tasks to other specialized agents when appropriate.

Available handoffs:
- transfer_to_audio_generator: For audio generation and processing tasks
- transfer_to_video_generator: For video creation and editing tasks
- transfer_to_content_creator: For content creation and writing tasks
- transfer_to_hashtag_specialist: For hashtag optimization and strategy
- transfer_to_engagement_optimizer: For engagement and optimization tasks

When you encounter a task that would be better handled by another agent, use the appropriate handoff tool. Always provide a clear reason for the handoff.

`;

module.exports = {
  HandoffManager,
  HandoffFilters,
  RECOMMENDED_PROMPT_PREFIX
}; 