#!/usr/bin/env node

/**
 * Railway Deployment Monitor
 * Monitors the deployment status and provides real-time updates
 */

const https = require('https');
const http = require('http');

const DEPLOYMENT_URL = 'https://xbot-production.up.railway.app/';
const HEALTH_URL = 'https://xbot-production.up.railway.app/health';

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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkDeployment() {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Checking deployment status...');
    
    // Check main endpoint
    const mainResponse = await makeRequest(DEPLOYMENT_URL);
    const mainTime = Date.now() - startTime;
    
    console.log(`📊 Main endpoint: ${mainResponse.statusCode} (${mainTime}ms)`);
    
    // Check health endpoint
    const healthResponse = await makeRequest(HEALTH_URL);
    const healthTime = Date.now() - startTime;
    
    console.log(`🏥 Health endpoint: ${healthResponse.statusCode} (${healthTime}ms)`);
    
    if (healthResponse.statusCode === 200) {
      try {
        const healthData = JSON.parse(healthResponse.data);
        console.log(`⏰ Uptime: ${Math.round(healthData.uptime)}s`);
        console.log(`🕐 Last check: ${healthData.timestamp}`);
      } catch (e) {
        console.log('⚠️ Could not parse health data');
      }
    }
    
    // Overall status
    if (mainResponse.statusCode === 200 && healthResponse.statusCode === 200) {
      console.log('✅ Deployment is healthy and responding');
      return true;
    } else {
      console.log('❌ Deployment has issues');
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Deployment check failed: ${error.message}`);
    return false;
  }
}

async function monitorDeployment(interval = 30000) {
  console.log('🚀 Railway Deployment Monitor Started');
  console.log(`📡 Monitoring: ${DEPLOYMENT_URL}`);
  console.log(`⏱️ Check interval: ${interval/1000}s`);
  console.log('---');
  
  let checkCount = 0;
  
  const monitor = async () => {
    checkCount++;
    console.log(`\n🔍 Check #${checkCount} - ${new Date().toLocaleTimeString()}`);
    
    const isHealthy = await checkDeployment();
    
    if (isHealthy) {
      console.log('✅ All systems operational');
    } else {
      console.log('⚠️ Issues detected - check Railway dashboard');
    }
    
    console.log('---');
  };
  
  // Initial check
  await monitor();
  
  // Set up periodic monitoring
  setInterval(monitor, interval);
}

// Run the monitor
if (require.main === module) {
  const interval = process.argv[2] ? parseInt(process.argv[2]) * 1000 : 30000;
  monitorDeployment(interval);
}

module.exports = { checkDeployment, monitorDeployment }; 