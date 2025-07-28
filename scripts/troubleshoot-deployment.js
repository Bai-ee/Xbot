#!/usr/bin/env node

/**
 * Railway Deployment Troubleshooting Script
 * Helps identify and diagnose deployment issues
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://xbot-production.up.railway.app';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        data: data
      }));
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function troubleshootDeployment() {
  console.log('🔍 Railway Deployment Troubleshooting');
  console.log('=====================================\n');
  
  const endpoints = [
    { path: '/', name: 'Root Endpoint' },
    { path: '/health', name: 'Health Check' },
    { path: '/api/tweets', name: 'API - Tweets' },
    { path: '/api/analytics', name: 'API - Analytics' },
    { path: '/debug-env', name: 'Debug - Environment' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing ${endpoint.name}...`);
      const response = await makeRequest(`${BASE_URL}${endpoint.path}`);
      
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
      
      if (response.statusCode === 200) {
        console.log(`   ✅ ${endpoint.name} is working`);
        
        // Show a snippet of the response for debugging
        if (endpoint.path === '/health') {
          try {
            const healthData = JSON.parse(response.data);
            console.log(`   📊 Health Data: ${JSON.stringify(healthData, null, 2)}`);
          } catch (e) {
            console.log(`   📄 Response snippet: ${response.data.substring(0, 100)}...`);
          }
        }
      } else {
        console.log(`   ❌ ${endpoint.name} returned ${response.statusCode}`);
        console.log(`   📄 Response: ${response.data.substring(0, 200)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ ${endpoint.name} failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Test static file serving
  console.log('🔍 Testing static file serving...');
  try {
    const staticResponse = await makeRequest(`${BASE_URL}/style.css`);
    console.log(`   CSS Status: ${staticResponse.statusCode}`);
    console.log(`   CSS Size: ${staticResponse.data.length} bytes`);
  } catch (error) {
    console.log(`   ❌ Static files failed: ${error.message}`);
  }
  
  console.log('\n📋 Troubleshooting Summary:');
  console.log('============================');
  console.log('✅ If health check works but root fails: Static file serving issue');
  console.log('✅ If all endpoints fail: Server startup issue');
  console.log('✅ If some APIs fail: Specific feature initialization issue');
  console.log('✅ If everything works: Railway health check configuration issue');
}

// Run the troubleshooting
if (require.main === module) {
  troubleshootDeployment();
}

module.exports = { troubleshootDeployment }; 