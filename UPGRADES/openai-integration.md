# OpenAI Integration Guide

This document explains how to use the OpenAI integration in the Multi-Agent Orchestrator system.

## Overview

The system now supports both traditional mock agents and AI-powered agents using OpenAI's API. The integration includes:

- **OpenAI Client**: Handles API calls with retry logic and error handling
- **AI Agent Support**: Create agents powered by OpenAI models
- **Thread Management**: Support for conversation threads and context
- **Tool Integration**: Support for OpenAI function calling

## Setup

### 1. Environment Configuration

Create a `.env` file in your project root:

```bash
# Required for AI agents
OPENAI_API_KEY=sk-proj-your-openai-api-key-here

# Optional configurations
OPENAI_MODEL=gpt-4
OPENAI_ASSISTANT_ID=asst_your-assistant-id-here
```

### 2. Basic Usage

```javascript
import { Orchestrator } from './src/agents/orchestrator.js';

const orchestrator = new Orchestrator();

// Register a traditional mock agent
orchestrator.registerAgent({
  name: 'echo',
  handleMessage: async (input) => `Echo: ${input}`
});

// Register an AI-powered agent
await orchestrator.registerAIAgent({
  name: 'assistant',
  systemPrompt: 'You are a helpful coding assistant.',
  tools: [] // Optional: OpenAI function tools
});
```

## Features

### AI Agent Registration

```javascript
await orchestrator.registerAIAgent({
  name: 'code-helper',
  systemPrompt: 'You are an expert JavaScript developer.',
  assistantId: 'asst_123', // Optional: Use existing OpenAI Assistant
  tools: [
    {
      type: 'function',
      function: {
        name: 'execute_code',
        description: 'Execute JavaScript code',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          }
        }
      }
    }
  ]
});
```

### Message Routing

```javascript
// Route to specific agent
const response = await orchestrator.routeMessage({
  message: 'Help me debug this code',
  agent: 'code-helper'
});

// Route to first available agent
const response = await orchestrator.routeMessage({
  message: 'Hello!'
});
```

### Conversation Management

```javascript
// Reset conversation for an AI agent
orchestrator.resetAgentConversation('assistant');

// Get agent details
const details = orchestrator.getAgentDetails();
console.log(details);
```

### Direct OpenAI Assistant Usage

```javascript
// Run an OpenAI Assistant directly
const result = await orchestrator.runOpenAIAssistant(
  'asst_123',
  'Hello, how can you help me?'
);
```

## Error Handling

The system includes comprehensive error handling:

- **API Key Missing**: Graceful fallback with error messages
- **Rate Limiting**: Automatic retry with exponential backoff
- **Network Errors**: Retry logic for temporary failures
- **Invalid Requests**: Clear error messages for debugging

## CLI Integration

The orchestrator includes an enhanced CLI with AI support:

```bash
node src/main.js
```

Available commands:
- `/agents` - List all registered agents
- `/details` - Show detailed agent information
- `/reset <name>` - Reset conversation for an agent
- `/agentName: message` - Send message to specific agent
- `/exit` - Quit the session

## Testing

The integration includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/unit/openaiClient.test.js
npm test -- tests/unit/orchestrator.test.js
```

## Architecture

### OpenAI Client (`src/api/openaiClient.js`)

- Singleton pattern for efficient resource usage
- Retry logic with exponential backoff
- Support for both completion and thread-based operations
- Environment variable validation

### Orchestrator Integration (`src/agents/orchestrator.js`)

- Backward compatible with existing mock agents
- AI agent wrapper with OpenAI integration
- Thread management for conversation context
- Enhanced CLI with AI-specific commands

## Best Practices

1. **API Key Security**: Never commit API keys to version control
2. **Error Handling**: Always handle API failures gracefully
3. **Rate Limiting**: Use appropriate delays between requests
4. **Context Management**: Reset conversations when needed
5. **Testing**: Test both with and without API keys

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY environment variable is required"**
   - Ensure your `.env` file contains a valid OpenAI API key
   - Check that the key starts with `sk-proj-` or `sk-`

2. **"OpenAI client not initialized"**
   - Verify the API key is properly loaded
   - Check for typos in the environment variable name

3. **Rate limit errors**
   - The system automatically retries with backoff
   - Consider upgrading your OpenAI plan for higher limits

4. **Thread errors**
   - Ensure you have access to the Assistants API
   - Check that the assistant ID is valid

## Next Steps

- Add custom tool implementations
- Integrate with additional OpenAI features
- Implement conversation persistence
- Add streaming response support 