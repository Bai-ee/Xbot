# OpenAI API Key Handling & Troubleshooting Guide

This comprehensive guide covers how OpenAI API keys are used in the agent framework, common issues causing 401 errors, and best practices for other implementations.

## 🔑 API Key Flow Architecture

### 1. Environment Loading Chain
```
.env file → process.env → EnvironmentConfig → OpenAI Client → API Requests
```

### 2. Key Usage Points in Framework
```javascript
// Environment Configuration (src/config/environment.js)
OPENAI_API_KEY → environmentConfig.config.openai.apiKey

// OpenAI Client (src/api/openaiClient.js)  
environmentConfig.apiKey → this.client = new OpenAI({ apiKey })

// Multi-Agent Orchestrator
OpenAI Client → Chat Completions API
OpenAI Client → Assistants API  
OpenAI Client → TTS API
OpenAI Client → Whisper API
```

## 🔍 Detailed API Key Implementation

### Environment Configuration Pattern
```javascript
// src/config/environment.js - How the key is loaded
export class EnvironmentConfig {
  loadConfig() {
    return {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,        // ← PRIMARY SOURCE
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        assistantId: process.env.OPENAI_ASSISTANT_ID,
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1500
      }
    };
  }

  // ✅ CRITICAL: API Key Validation
  async validateOpenAIKey() {
    if (!this.config.openai.apiKey) {
      return false;
    }

    // Actual validation request to OpenAI
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.openai.apiKey}`,  // ← KEY USAGE
          'Content-Type': 'application/json'
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
```

### OpenAI Client Initialization
```javascript
// src/api/openaiClient.js - How the client uses the key
class OpenAIClient {
  initializeClient() {
    const config = environmentConfig.getOpenAIConfig();
    
    // ⚠️ FAILURE POINT: Missing or invalid key
    if (!config.apiKey) {
      log('warn', 'OpenAI API key not found. Client not initialized.');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: config.apiKey,           // ← DIRECT KEY USAGE
        timeout: 60000,
        maxRetries: this.retryConfig.maxRetries
      });
    } catch (error) {
      log('error', `Failed to initialize OpenAI client: ${error.message}`);
      throw error;
    }
  }

  // How the key is used in API calls
  async runOpenAICompletion(prompt, tools = null, thread = null, options = {}) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Check your API key.');
    }

    // The OpenAI library handles the Authorization header internally
    const completion = await this.client.chat.completions.create({
      model: options.model || config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || config.temperature
    });
  }
}
```

### TTS Service Key Usage
```javascript
// src/services/ttsService.js - Direct API key usage for TTS
async generateSpeech(text, options = {}) {
  // ⚠️ FAILURE POINT: Direct fetch with manual Authorization header
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,  // ← DIRECT ENV ACCESS
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: format,
      speed
    })
  });
}
```

### Audio Transcription Key Usage
```javascript
// src/tools/audioTranscriber.js - Whisper API key usage
async transcribeWithOpenAIAPI(audioFilePath, language = 'auto') {
  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');

  // ⚠️ FAILURE POINT: Direct env access in transcription
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`  // ← DIRECT ENV ACCESS
    },
    body: formData
  });
}
```

## ❌ Common 401 Error Causes & Solutions

### 1. **Missing API Key**
```bash
# ❌ WRONG: Empty or undefined
OPENAI_API_KEY=
# or missing entirely

# ✅ CORRECT: Proper format
OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef12
```

**Symptoms:**
- `OpenAI client not initialized. Check your API key.`
- `401 Unauthorized` on first API call

**Debug Steps:**
```javascript
// Add to your initialization
console.log('API Key present:', !!process.env.OPENAI_API_KEY);
console.log('API Key length:', process.env.OPENAI_API_KEY?.length);
console.log('API Key starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-'));
```

### 2. **Malformed API Key Format**
```bash
# ❌ WRONG: Missing 'sk-' prefix
OPENAI_API_KEY=1234567890abcdef1234567890abcdef1234567890abcdef12

# ❌ WRONG: Extra characters/spaces
OPENAI_API_KEY=" sk-1234567890abcdef1234567890abcdef1234567890abcdef12 "

# ❌ WRONG: Truncated key
OPENAI_API_KEY=sk-1234567890abcdef123456

# ✅ CORRECT: Exact format from OpenAI
OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef12
```

**Validation Function:**
```javascript
function validateOpenAIKeyFormat(apiKey) {
  if (!apiKey) return { valid: false, error: 'API key is missing' };
  
  if (typeof apiKey !== 'string') {
    return { valid: false, error: 'API key must be a string' };
  }
  
  const trimmed = apiKey.trim();
  if (trimmed !== apiKey) {
    return { valid: false, error: 'API key has leading/trailing whitespace' };
  }
  
  if (!trimmed.startsWith('sk-')) {
    return { valid: false, error: 'API key must start with "sk-"' };
  }
  
  if (trimmed.length < 50) {
    return { valid: false, error: 'API key appears too short' };
  }
  
  if (!/^sk-[A-Za-z0-9]+$/.test(trimmed)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }
  
  return { valid: true };
}
```

### 3. **Environment Loading Issues**
```javascript
// ❌ PROBLEM: .env not loaded before usage
import openaiClient from './api/openaiClient.js'; // Uses process.env immediately
import { config } from 'dotenv';
config(); // Too late!

// ✅ SOLUTION: Load .env first
import { config } from 'dotenv';
config(); // Load first
import openaiClient from './api/openaiClient.js';
```

### 4. **Inconsistent Key Access Patterns**
```javascript
// ❌ PROBLEM: Mixed access patterns in same codebase
// File 1: Uses environmentConfig
const config = environmentConfig.getOpenAIConfig();
const key = config.apiKey;

// File 2: Direct env access
const key = process.env.OPENAI_API_KEY;

// ✅ SOLUTION: Consistent access pattern
// Always use environmentConfig for centralized management
const config = environmentConfig.getOpenAIConfig();
const key = config.apiKey;
```

### 5. **Expired or Revoked Keys**
```javascript
// Validation with actual API call
async function validateKeyWithAPI(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      const error = await response.json();
      return { 
        valid: false, 
        error: 'API key is invalid, expired, or revoked',
        details: error.error?.message 
      };
    }
    
    if (response.status === 429) {
      return { 
        valid: true, // Key is valid but rate limited
        warning: 'API key is valid but rate limited'
      };
    }
    
    return { valid: response.status === 200 };
    
  } catch (error) {
    return { 
      valid: false, 
      error: 'Network error during validation',
      details: error.message 
    };
  }
}
```

## 🔧 Comprehensive Troubleshooting Steps

### Step 1: Environment Verification
```javascript
// Add this debug function to your codebase
function debugEnvironmentSetup() {
  console.log('\n=== OPENAI API KEY DEBUG ===');
  
  // Check if .env is loaded
  console.log('1. Environment file loaded:', !!process.env.NODE_ENV);
  
  // Check raw environment variable
  const rawKey = process.env.OPENAI_API_KEY;
  console.log('2. Raw API key present:', !!rawKey);
  console.log('3. Raw API key length:', rawKey?.length || 0);
  console.log('4. Raw API key preview:', rawKey ? `${rawKey.substring(0, 8)}...` : 'MISSING');
  
  // Check format validation
  const formatCheck = validateOpenAIKeyFormat(rawKey);
  console.log('5. Format validation:', formatCheck);
  
  // Check environment config processing
  const config = environmentConfig.getOpenAIConfig();
  console.log('6. Config processed key present:', !!config.apiKey);
  console.log('7. Config matches raw:', config.apiKey === rawKey);
  
  console.log('=== END DEBUG ===\n');
}

// Call during initialization
debugEnvironmentSetup();
```

### Step 2: API Client Validation
```javascript
// Add to OpenAI client initialization
class OpenAIClient {
  async validateInitialization() {
    console.log('\n=== OPENAI CLIENT DEBUG ===');
    
    const config = environmentConfig.getOpenAIConfig();
    console.log('1. Config API key present:', !!config.apiKey);
    console.log('2. Client initialized:', !!this.client);
    
    if (this.client) {
      try {
        // Test with a simple API call
        const models = await this.client.models.list();
        console.log('3. API call successful:', !!models.data);
        console.log('4. Available models count:', models.data?.length || 0);
      } catch (error) {
        console.log('3. API call failed:', error.message);
        console.log('4. Error status:', error.status);
        console.log('5. Error type:', error.type);
      }
    }
    
    console.log('=== END CLIENT DEBUG ===\n');
  }
}
```

### Step 3: Service-Level Validation
```javascript
// Add validation to each service that uses OpenAI
class TTSService {
  async validateAPIAccess() {
    const testPayload = {
      model: 'tts-1',
      input: 'test',
      voice: 'alloy'
    };
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });
      
      console.log('TTS API validation:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.status === 401) {
        const error = await response.json();
        console.log('TTS 401 Error details:', error);
      }
      
      return response.status === 200;
      
    } catch (error) {
      console.log('TTS API validation error:', error);
      return false;
    }
  }
}
```

## ✅ Best Practices for Other Implementations

### 1. **Centralized API Key Management**
```javascript
// ✅ RECOMMENDED: Single source of truth
class APIKeyManager {
  constructor() {
    this.keys = new Map();
    this.validated = new Map();
    this.lastValidation = new Map();
  }
  
  async getValidatedKey(provider) {
    const key = this.keys.get(provider);
    if (!key) throw new Error(`No API key configured for ${provider}`);
    
    // Cache validation for 5 minutes
    const lastCheck = this.lastValidation.get(provider);
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    if (!lastCheck || lastCheck < fiveMinutesAgo) {
      const isValid = await this.validateKey(provider, key);
      this.validated.set(provider, isValid);
      this.lastValidation.set(provider, Date.now());
      
      if (!isValid) {
        throw new Error(`Invalid API key for ${provider}`);
      }
    }
    
    return key;
  }
  
  setKey(provider, key) {
    const validation = validateOpenAIKeyFormat(key);
    if (!validation.valid) {
      throw new Error(`Invalid key format for ${provider}: ${validation.error}`);
    }
    
    this.keys.set(provider, key.trim());
    this.validated.delete(provider); // Force revalidation
  }
  
  async validateKey(provider, key) {
    switch (provider) {
      case 'openai':
        return await this.validateOpenAIKey(key);
      default:
        return false;
    }
  }
  
  async validateOpenAIKey(key) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const apiKeyManager = new APIKeyManager();
```

### 2. **Robust Error Handling Pattern**
```javascript
// ✅ RECOMMENDED: Comprehensive error handling
class OpenAIService {
  async makeAPICall(endpoint, options = {}) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const key = await apiKeyManager.getValidatedKey('openai');
        
        const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
        
        if (response.status === 401) {
          // Invalidate cached key and force revalidation
          apiKeyManager.validated.delete('openai');
          
          const errorData = await response.json();
          throw new APIKeyError('Invalid or expired API key', {
            status: 401,
            details: errorData.error?.message,
            suggestion: 'Please check your OPENAI_API_KEY environment variable'
          });
        }
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || 1;
          await this.delay(retryAfter * 1000);
          continue;
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new APIError(`OpenAI API error: ${response.status}`, {
            status: response.status,
            details: errorData.error?.message
          });
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        if (error instanceof APIKeyError) {
          throw error; // Don't retry API key errors
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await this.delay(1000 * attempt);
      }
    }
    
    throw lastError;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Custom error classes
class APIKeyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'APIKeyError';
    this.details = details;
  }
}

class APIError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'APIError';
    this.details = details;
  }
}
```

### 3. **Environment Loading Best Practices**
```javascript
// ✅ RECOMMENDED: Proper environment setup
// config/environment.js
import { config } from 'dotenv';
import path from 'path';

// Load environment files in order of precedence
const envFiles = [
  '.env.local',
  '.env.development',
  '.env'
];

function loadEnvironment() {
  let loaded = false;
  
  for (const envFile of envFiles) {
    try {
      const result = config({ path: envFile });
      if (result.parsed) {
        console.log(`✅ Loaded environment from ${envFile}`);
        loaded = true;
        break;
      }
    } catch (error) {
      console.log(`⚠️  Could not load ${envFile}: ${error.message}`);
    }
  }
  
  if (!loaded) {
    console.log('⚠️  No .env file found, using system environment variables');
  }
  
  return loaded;
}

// Call immediately when module is imported
loadEnvironment();

export class EnvironmentConfig {
  constructor() {
    // Validate critical environment variables
    this.validateEnvironment();
  }
  
  validateEnvironment() {
    const required = ['OPENAI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Validate API key format
    const keyValidation = validateOpenAIKeyFormat(process.env.OPENAI_API_KEY);
    if (!keyValidation.valid) {
      throw new Error(`Invalid OPENAI_API_KEY format: ${keyValidation.error}`);
    }
  }
}
```

### 4. **Initialization Sequence**
```javascript
// ✅ RECOMMENDED: Proper initialization order
// main.js
async function initializeApplication() {
  try {
    console.log('🚀 Starting application initialization...');
    
    // Step 1: Load and validate environment
    console.log('1️⃣ Loading environment configuration...');
    const environmentConfig = new EnvironmentConfig();
    
    // Step 2: Validate API keys
    console.log('2️⃣ Validating API keys...');
    await environmentConfig.initializeValidation();
    
    // Step 3: Initialize OpenAI client
    console.log('3️⃣ Initializing OpenAI client...');
    const openaiClient = new OpenAIClient();
    await openaiClient.validateInitialization();
    
    // Step 4: Initialize services
    console.log('4️⃣ Initializing services...');
    const ttsService = new TTSService();
    const transcriptionService = new TranscriptionService();
    
    // Step 5: Test all services
    console.log('5️⃣ Testing service connectivity...');
    const serviceTests = await Promise.allSettled([
      ttsService.validateAPIAccess(),
      transcriptionService.validateAPIAccess()
    ]);
    
    serviceTests.forEach((result, index) => {
      const serviceName = ['TTS', 'Transcription'][index];
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ ${serviceName} service validated`);
      } else {
        console.log(`❌ ${serviceName} service validation failed`);
      }
    });
    
    console.log('🎉 Application initialized successfully');
    return true;
    
  } catch (error) {
    console.error('💥 Application initialization failed:', error.message);
    
    if (error instanceof APIKeyError) {
      console.error('🔑 API Key Issue:');
      console.error('   - Check your .env file exists');
      console.error('   - Verify OPENAI_API_KEY is set correctly');
      console.error('   - Ensure the key starts with "sk-"');
      console.error('   - Try generating a new key from OpenAI dashboard');
    }
    
    throw error;
  }
}

// Initialize with proper error handling
initializeApplication()
  .then(() => {
    console.log('Application ready to serve requests');
  })
  .catch(error => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
```

## 🔍 Debugging Tools

### API Key Inspector Tool
```javascript
// debugging/apiKeyInspector.js
export function inspectAPIKey(key = process.env.OPENAI_API_KEY) {
  console.log('\n🔍 API Key Inspector Report');
  console.log('================================');
  
  if (!key) {
    console.log('❌ No API key provided');
    return;
  }
  
  console.log(`✅ Key present: ${key.length} characters`);
  console.log(`✅ Starts with 'sk-': ${key.startsWith('sk-')}`);
  console.log(`✅ Preview: ${key.substring(0, 10)}...`);
  
  // Check for common issues
  const issues = [];
  
  if (key !== key.trim()) {
    issues.push('Has leading/trailing whitespace');
  }
  
  if (key.includes(' ')) {
    issues.push('Contains spaces');
  }
  
  if (key.includes('\n') || key.includes('\r')) {
    issues.push('Contains line breaks');
  }
  
  if (!/^sk-[A-Za-z0-9]+$/.test(key)) {
    issues.push('Contains invalid characters');
  }
  
  if (key.length < 50) {
    issues.push('Appears too short for OpenAI key');
  }
  
  if (issues.length > 0) {
    console.log('⚠️  Potential issues:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log('✅ Format validation passed');
  }
  
  console.log('================================\n');
}

// Usage: inspectAPIKey() in your initialization
```

### Service Health Checker
```javascript
// debugging/serviceHealthChecker.js
export async function checkAllServices() {
  const services = [
    { name: 'Models API', endpoint: '/models' },
    { name: 'Chat Completions', endpoint: '/chat/completions', method: 'POST', body: { model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'test' }], max_tokens: 1 } },
    { name: 'TTS API', endpoint: '/audio/speech', method: 'POST', body: { model: 'tts-1', input: 'test', voice: 'alloy' } },
    { name: 'Whisper API', endpoint: '/audio/transcriptions', method: 'POST', body: new FormData() }
  ];
  
  console.log('\n🏥 Service Health Check');
  console.log('========================');
  
  for (const service of services) {
    try {
      const options = {
        method: service.method || 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (service.body && service.name !== 'Whisper API') {
        options.body = JSON.stringify(service.body);
      }
      
      const response = await fetch(`https://api.openai.com/v1${service.endpoint}`, options);
      
      const status = response.status === 200 ? '✅' : 
                    response.status === 401 ? '🔑' :
                    response.status === 429 ? '⏱️' : '❌';
      
      console.log(`${status} ${service.name}: ${response.status} ${response.statusText}`);
      
      if (response.status === 401) {
        const error = await response.json();
        console.log(`   Error: ${error.error?.message || 'Authentication failed'}`);
      }
      
    } catch (error) {
      console.log(`❌ ${service.name}: ${error.message}`);
    }
  }
  
  console.log('========================\n');
}
```

## 🚨 Emergency Troubleshooting Checklist

When facing 401 errors, work through this checklist:

1. **✅ Environment File**
   - [ ] `.env` file exists in project root
   - [ ] `OPENAI_API_KEY=sk-...` line present
   - [ ] No extra quotes, spaces, or characters
   - [ ] File is actually being loaded (`console.log(process.env.OPENAI_API_KEY)`)

2. **✅ API Key Format**
   - [ ] Starts with `sk-`
   - [ ] Approximately 51 characters long
   - [ ] Only contains letters, numbers, no special characters
   - [ ] No line breaks or spaces

3. **✅ API Key Status**
   - [ ] Key exists in OpenAI dashboard
   - [ ] Key is not expired or revoked
   - [ ] Account has available credits
   - [ ] Key has appropriate permissions

4. **✅ Code Implementation**
   - [ ] Environment loaded before client initialization
   - [ ] Consistent key access pattern throughout codebase
   - [ ] Proper Authorization header format: `Bearer ${key}`
   - [ ] No double Bearer prefixes or other header issues

5. **✅ Network & Infrastructure**
   - [ ] Network connectivity to `api.openai.com`
   - [ ] No proxy or firewall blocking requests
   - [ ] Correct Content-Type headers for different endpoints
   - [ ] Request body format matches API requirements

This comprehensive guide should help you identify and resolve any OpenAI API key related issues in your multi-agent framework implementation. 