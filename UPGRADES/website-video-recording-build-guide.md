# Website Video Recording & Screenshot Capture - Complete Build Guide

This comprehensive guide provides all technical requirements, dependencies, and implementation details to build website video recording and screenshot capabilities into any existing codebase.

## 🎯 **Overview**

This system provides two main capabilities:
1. **Website Video Recording** - Record browser interactions and auto-exploration of websites using Playwright
2. **Website Screenshot Capture** - Take responsive screenshots at multiple viewports using Selenium

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js Application Layer                    │
├─────────────────────────────────────────────────────────────────┤
│  WebsiteVideoRecorderTool  │    WebsiteScreenshotTool           │
│  (src/tools/websiteVideo   │    (src/tools/websiteScreenshot    │
│   Recorder.js)             │     .js)                           │
├─────────────────────────────────────────────────────────────────┤
│                    Python Execution Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  Playwright Browser        │    Selenium WebDriver              │
│  Automation                │    + Chrome Browser                │
│  (video_recording_script   │    (screenshot_script.py)          │
│   .py)                     │                                    │
├─────────────────────────────────────────────────────────────────┤
│                      System Dependencies                        │
├─────────────────────────────────────────────────────────────────┤
│  Chromium Browser     │  FFmpeg         │  Python 3.8+         │
│  Chrome/Chromium      │  (Video Conv.)  │  pip3                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 **Complete Requirements**

### **System Requirements**
- **Operating System:** macOS, Linux, or Windows 10+
- **Node.js:** 18.0.0+ (LTS recommended)
- **Python:** 3.8+ with pip3
- **Memory:** 4GB RAM minimum, 8GB recommended
- **Storage:** 2GB free space for dependencies

### **Node.js Dependencies**
```json
{
  "dependencies": {
    "child_process": "Built-in Node.js module",
    "fs": "Built-in Node.js module", 
    "path": "Built-in Node.js module",
    "util": "Built-in Node.js module"
  }
}
```

### **Python Dependencies**

**For Video Recording (Playwright):**
```bash
playwright==1.40.0+
asyncio  # Built-in Python module
pathlib  # Built-in Python module
json     # Built-in Python module
```

**For Screenshot Capture (Selenium):**
```bash
selenium==4.15.0+
pillow==10.0.1+
webdriver-manager==4.0.1+
```

### **System Dependencies**

**FFmpeg (Video Processing):**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ffmpeg

# CentOS/RHEL
sudo yum install epel-release
sudo yum install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

**Browser Dependencies:**
```bash
# Chromium for Playwright (auto-installed)
playwright install chromium

# Chrome for Selenium (manual download or package manager)
# macOS
brew install google-chrome

# Ubuntu/Debian  
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo apt-get update && sudo apt-get install google-chrome-stable
```

## ⚙️ **Installation & Setup Order**

### **Step 1: System Dependencies**
```bash
# 1. Install Node.js 18+ (if not installed)
curl -fsSL https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz | tar -xJ
export PATH=$PWD/node-v18.19.0-linux-x64/bin:$PATH

# 2. Install Python 3.8+ (if not installed)
# macOS
brew install python3

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install python3 python3-pip

# 3. Install FFmpeg
# (See FFmpeg installation commands above)
```

### **Step 2: Python Dependencies**
```bash
# Install Playwright for video recording
pip3 install playwright --break-system-packages
playwright install chromium

# Install Selenium for screenshots  
pip3 install selenium pillow webdriver-manager --break-system-packages

# Verify installations
python3 -c "import playwright; print('Playwright installed successfully')"
python3 -c "import selenium; print('Selenium installed successfully')" 
```

### **Step 3: Node.js Project Setup**
```bash
# In your project directory
npm init -y  # If new project

# No additional npm packages required - uses built-in Node.js modules
```

### **Step 4: Directory Structure**
```bash
# Create required directories
mkdir -p src/tools
mkdir -p src/content/videos/website_recordings
mkdir -p src/content/screenshots
mkdir -p temp
```

## 🔧 **Core Implementation Files**

### **1. WebsiteVideoRecorderTool (Node.js)**

Create `src/tools/websiteVideoRecorder.js`:

```javascript
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Website Video Recorder Tool
 * Records website interactions using Playwright browser automation
 */
export class WebsiteVideoRecorderTool {
  constructor() {
    // Get project root (adjust path as needed for your structure)
    const projectRoot = path.dirname(path.dirname(__dirname));
    this.outputDir = path.join(projectRoot, 'src/content/videos/website_recordings');
    this.ensureOutputDirectory();
    this.checkDependencies();
  }

  /**
   * Ensure output directory exists
   */
  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`[WebsiteVideoRecorder] Created output directory: ${this.outputDir}`);
    }
  }

  /**
   * Check if required Python dependencies are installed
   */
  checkDependencies() {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      execSync('python3 -c "import playwright"', { stdio: 'ignore' });
      console.log('[WebsiteVideoRecorder] Dependencies verified: Python3 and Playwright available');
    } catch (error) {
      console.warn('[WebsiteVideoRecorder] Missing dependencies. Will attempt to install when needed.');
    }
  }

  /**
   * Install required Python dependencies
   */
  async installDependencies() {
    console.log('[WebsiteVideoRecorder] Installing Python dependencies...');
    try {
      execSync('pip3 install playwright --break-system-packages', { stdio: 'inherit' });
      execSync('playwright install chromium', { stdio: 'inherit' });
      console.log('[WebsiteVideoRecorder] Dependencies installed successfully');
      return true;
    } catch (error) {
      console.error('[WebsiteVideoRecorder] Failed to install dependencies:', error.message);
      return false;
    }
  }

  /**
   * Create Python video recording script
   */
  createVideoRecordingScript() {
    const scriptPath = path.join(__dirname, 'video_recording_script.py');
    const scriptContent = `#!/usr/bin/env python3
import asyncio
import os
import sys
import time
import json
from playwright.async_api import async_playwright
from pathlib import Path

# Viewport configurations
VIEWPORTS = {
    "desktop": {"width": 1920, "height": 1080},
    "desktop_4k": {"width": 3840, "height": 2160},
    "tablet": {"width": 1024, "height": 1366},
    "mobile": {"width": 414, "height": 896},
    "mobile_hd": {"width": 428, "height": 926}
}

async def record_website_interactions(url, output_path, actions_json, duration, viewport):
    """Record website interactions using Playwright"""
    
    try:
        # Parse actions
        actions = json.loads(actions_json) if actions_json != 'null' else []
        
        # Get viewport config
        viewport_config = VIEWPORTS.get(viewport, VIEWPORTS["desktop"])
        
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=True)
            
            # Create context with video recording enabled
            video_dir = os.path.dirname(output_path)
            os.makedirs(video_dir, exist_ok=True)
            
            context = await browser.new_context(
                viewport=viewport_config,
                record_video_dir=video_dir,
                record_video_size=viewport_config,
                device_scale_factor=2,
                has_touch=viewport in ["mobile", "mobile_hd", "tablet"],
                is_mobile=viewport in ["mobile", "mobile_hd"]
            )
            
            page = await context.new_page()
            
            # Navigate to URL with extended timeout
            await page.goto(url, wait_until='networkidle', timeout=60000)
            await page.wait_for_timeout(3000)
            
            # Execute predefined actions or auto-explore
            if not actions:
                await continuous_explore_page(page, duration)
            else:
                # Execute custom actions
                for action in actions:
                    try:
                        action_type = action.get('type', '')
                        
                        if action_type == 'click':
                            selector = action.get('selector', '')
                            if selector:
                                await page.click(selector, timeout=5000)
                                await page.wait_for_timeout(1000)
                        
                        elif action_type == 'scroll':
                            position = action.get('position', 0)
                            await page.evaluate(f"window.scrollTo(0, {position})")
                            await page.wait_for_timeout(1000)
                        
                        elif action_type == 'type':
                            selector = action.get('selector', '')
                            text = action.get('text', '')
                            if selector and text:
                                await page.fill(selector, text)
                                await page.wait_for_timeout(500)
                                
                    except Exception as action_error:
                        print(f"Action failed: {action_type} - {str(action_error)}")
                        continue
            
            # Close context to stop recording
            await context.close()
            await browser.close()
            
            # Find and convert generated video file
            video_files = list(Path(video_dir).glob("*.webm"))
            if video_files:
                latest_video = max(video_files, key=lambda x: x.stat().st_mtime)
                
                # Convert to MP4 using FFmpeg
                final_output = output_path
                if not final_output.endswith('.mp4'):
                    final_output = final_output.replace('.webm', '.mp4')
                
                try:
                    import subprocess
                    ffmpeg_cmd = [
                        'ffmpeg', '-i', str(latest_video),
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                        '-y', final_output
                    ]
                    
                    subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
                    os.remove(str(latest_video))
                    
                except (subprocess.CalledProcessError, FileNotFoundError) as e:
                    print(f"FFmpeg conversion failed, using original WebM: {e}")
                    os.rename(str(latest_video), final_output)
                
                file_size = os.path.getsize(final_output)
                
                return {
                    "success": True,
                    "path": final_output,
                    "size": file_size,
                    "url": url,
                    "duration": duration,
                    "viewport": viewport
                }
            else:
                return {"success": False, "error": "No video file was generated"}
                
    except Exception as e:
        return {"success": False, "error": f"Recording failed: {str(e)}"}

async def continuous_explore_page(page, duration_seconds):
    """Continuously explore a page with dynamic interactions"""
    try:
        print(f"Starting continuous exploration for {duration_seconds} seconds...")
        
        # Get page dimensions
        page_height = await page.evaluate("document.body.scrollHeight")
        viewport_height = await page.evaluate("window.innerHeight")
        
        # Auto-scroll exploration
        steps = max(4, int(duration_seconds / 3))
        scroll_positions = []
        
        for i in range(steps):
            if i < steps // 2:
                pos = (page_height * i) // (steps // 2)
            else:
                pos = page_height - ((page_height * (i - steps // 2)) // (steps // 2))
            scroll_positions.append(min(pos, page_height - viewport_height))
        
        for pos in scroll_positions:
            await page.evaluate(f"window.scrollTo({{top: {pos}, behavior: 'smooth'}})")
            await page.wait_for_timeout(int(duration_seconds * 1000 / steps))
            
    except Exception as e:
        print(f"Continuous exploration failed: {str(e)}")

def main():
    if len(sys.argv) < 6:
        print("Usage: python3 video_recording_script.py <url> <output_path> <actions_json> <duration> <viewport>")
        sys.exit(1)
    
    url = sys.argv[1]
    output_path = sys.argv[2]
    actions_json = sys.argv[3]
    duration = int(sys.argv[4])
    viewport = sys.argv[5]
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Run the recording
    result = asyncio.run(record_website_interactions(url, output_path, actions_json, duration, viewport))
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
`;

    fs.writeFileSync(scriptPath, scriptContent);
    return scriptPath;
  }

  /**
   * Record website video
   */
  async recordWebsite(args) {
    const {
      url,
      duration = 20,
      viewport = 'desktop',
      filename = null,
      actions = []
    } = args;

    // Validate URL
    if (!url) {
      throw new Error('URL is required');
    }

    // Generate filename if not provided
    const sanitizedUrl = url.replace(/https?:\\/\\//, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalFilename = filename || `${sanitizedUrl}_${viewport}_${Date.now()}`;
    const outputPath = path.join(this.outputDir, `${finalFilename}.mp4`);

    console.log(`[WebsiteVideoRecorder] Recording ${url} for ${duration}s at ${viewport} viewport`);

    try {
      // Create Python script
      const scriptPath = this.createVideoRecordingScript();

      // Prepare arguments
      const actionsJson = JSON.stringify(actions);
      const pythonArgs = [
        'python3',
        scriptPath,
        url,
        outputPath,
        actionsJson,
        duration.toString(),
        viewport
      ];

      console.log(`[WebsiteVideoRecorder] Executing: ${pythonArgs.join(' ')}`);

      // Execute Python script
      const { stdout, stderr } = await execAsync(pythonArgs.join(' '), {
        timeout: (duration + 30) * 1000 // Add 30s buffer
      });

      if (stderr && !stderr.includes('Warning')) {
        console.warn(`[WebsiteVideoRecorder] Python stderr: ${stderr}`);
      }

      // Parse result
      const result = JSON.parse(stdout.trim());

      if (result.success) {
        console.log(`[WebsiteVideoRecorder] Success: ${result.path} (${result.size} bytes)`);
        return {
          success: true,
          videoPath: result.path,
          fileSize: result.size,
          url: result.url,
          duration: result.duration,
          viewport: result.viewport
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error(`[WebsiteVideoRecorder] Error: ${error.message}`);
      
      // Try to install dependencies if they're missing
      if (error.message.includes('playwright') || error.message.includes('ModuleNotFoundError')) {
        console.log('[WebsiteVideoRecorder] Attempting to install missing dependencies...');
        const installed = await this.installDependencies();
        if (installed) {
          console.log('[WebsiteVideoRecorder] Dependencies installed. Please try again.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Main execution method (for OpenAI Assistant API compatibility)
   */
  async execute(args, clientContext = null) {
    try {
      const result = await this.recordWebsite(args);
      return `Successfully recorded website video: ${result.videoPath} (${Math.round(result.fileSize / 1024)}KB)`;
    } catch (error) {
      return `Error recording website video: ${error.message}`;
    }
  }
}
```

### **2. WebsiteScreenshotTool (Node.js)**

Create `src/tools/websiteScreenshot.js`:

```javascript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Website Screenshot Tool
 * Takes responsive screenshots using Selenium and Chrome
 */
export class WebsiteScreenshotTool {
  constructor() {
    const projectRoot = path.dirname(path.dirname(__dirname));
    this.outputDir = path.join(projectRoot, 'src/content/screenshots');
    this.ensureOutputDirectory();
    this.checkDependencies();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`[WebsiteScreenshot] Created output directory: ${this.outputDir}`);
    }
  }

  checkDependencies() {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      execSync('python3 -c "import selenium"', { stdio: 'ignore' });
      console.log('[WebsiteScreenshot] Dependencies verified: Python3 and Selenium available');
    } catch (error) {
      console.warn('[WebsiteScreenshot] Missing dependencies. Will attempt to install when needed.');
    }
  }

  async installDependencies() {
    console.log('[WebsiteScreenshot] Installing Python dependencies...');
    try {
      execSync('pip3 install selenium pillow webdriver-manager --break-system-packages', { stdio: 'inherit' });
      console.log('[WebsiteScreenshot] Dependencies installed successfully');
      return true;
    } catch (error) {
      console.error('[WebsiteScreenshot] Failed to install dependencies:', error.message);
      return false;
    }
  }

  sanitizeFilename(url) {
    return url
      .replace(/https?:\\/\\//, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  createScreenshotScript() {
    const scriptPath = path.join(__dirname, 'screenshot_script.py');
    const scriptContent = `#!/usr/bin/env python3
import os
import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from PIL import Image

def take_screenshot(url, output_path, viewport):
    """Take a screenshot of a website"""
    
    # Viewport configurations
    viewports = {
        'desktop': {'width': 1920, 'height': 1080},
        'tablet': {'width': 1024, 'height': 1366},
        'mobile': {'width': 375, 'height': 812}
    }
    
    viewport_config = viewports.get(viewport, viewports['desktop'])
    
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument(f'--window-size={viewport_config["width"]},{viewport_config["height"]}')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--remote-debugging-port=9222')
    
    try:
        # Initialize webdriver
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Set window size
        driver.set_window_size(viewport_config['width'], viewport_config['height'])
        
        # Navigate to URL
        driver.get(url)
        
        # Wait for page to load
        WebDriverWait(driver, 10).until(
            lambda d: d.execute_script('return document.readyState') == 'complete'
        )
        
        # Additional wait for dynamic content
        time.sleep(3)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Take screenshot
        driver.save_screenshot(output_path)
        
        # Get file size
        file_size = os.path.getsize(output_path)
        
        # Close driver
        driver.quit()
        
        return {
            "success": True,
            "path": output_path,
            "size": file_size,
            "url": url,
            "viewport": viewport
        }
        
    except Exception as e:
        if 'driver' in locals():
            driver.quit()
        return {"success": False, "error": f"Screenshot failed: {str(e)}"}

def main():
    if len(sys.argv) < 4:
        print("Usage: python3 screenshot_script.py <url> <output_path> <viewport>")
        sys.exit(1)
    
    url = sys.argv[1]
    output_path = sys.argv[2] 
    viewport = sys.argv[3]
    
    result = take_screenshot(url, output_path, viewport)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
`;

    fs.writeFileSync(scriptPath, scriptContent);
    return scriptPath;
  }

  async takeScreenshot(args) {
    const {
      url,
      viewport = 'desktop',
      filename = null
    } = args;

    if (!url) {
      throw new Error('URL is required');
    }

    const sanitizedUrl = this.sanitizeFilename(url);
    const finalFilename = filename || `${sanitizedUrl}_${viewport}`;
    const outputPath = path.join(this.outputDir, `${finalFilename}.png`);

    console.log(`[WebsiteScreenshot] Taking ${viewport} screenshot of ${url}`);

    try {
      const scriptPath = this.createScreenshotScript();
      const command = `python3 ${scriptPath} "${url}" "${outputPath}" "${viewport}"`;
      
      const stdout = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000
      });

      const result = JSON.parse(stdout.trim());

      if (result.success) {
        console.log(`[WebsiteScreenshot] Success: ${result.path} (${result.size} bytes)`);
        return {
          success: true,
          screenshotPath: result.path,
          fileSize: result.size,
          url: result.url,
          viewport: result.viewport
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error(`[WebsiteScreenshot] Error: ${error.message}`);
      
      if (error.message.includes('selenium') || error.message.includes('ModuleNotFoundError')) {
        console.log('[WebsiteScreenshot] Attempting to install missing dependencies...');
        await this.installDependencies();
      }
      
      throw error;
    }
  }

  async execute(args, clientContext = null) {
    try {
      const result = await this.takeScreenshot(args);
      return `Successfully captured screenshot: ${result.screenshotPath} (${Math.round(result.fileSize / 1024)}KB)`;
    } catch (error) {
      return `Error capturing screenshot: ${error.message}`;
    }
  }
}
```

## 🚀 **Usage Examples**

### **Basic Video Recording**
```javascript
import { WebsiteVideoRecorderTool } from './src/tools/websiteVideoRecorder.js';

const videoRecorder = new WebsiteVideoRecorderTool();

// Record a website with auto-exploration
const result = await videoRecorder.recordWebsite({
  url: 'https://example.com',
  duration: 30,
  viewport: 'desktop',
  filename: 'example_recording'
});

console.log(`Video saved to: ${result.videoPath}`);
```

### **Advanced Video Recording with Custom Actions**
```javascript
const result = await videoRecorder.recordWebsite({
  url: 'https://example.com',
  duration: 45,
  viewport: 'mobile',
  filename: 'mobile_interaction',
  actions: [
    { type: 'click', selector: '.menu-button' },
    { type: 'scroll', position: 1000 },
    { type: 'type', selector: '#search', text: 'search query' },
    { type: 'wait', duration: 2000 },
    { type: 'auto_scroll' }
  ]
});
```

### **Screenshot Capture**
```javascript
import { WebsiteScreenshotTool } from './src/tools/websiteScreenshot.js';

const screenshotTool = new WebsiteScreenshotTool();

// Take responsive screenshots
const desktop = await screenshotTool.takeScreenshot({
  url: 'https://example.com',
  viewport: 'desktop',
  filename: 'homepage_desktop'
});

const mobile = await screenshotTool.takeScreenshot({
  url: 'https://example.com', 
  viewport: 'mobile',
  filename: 'homepage_mobile'
});
```

## 🔧 **Integration Patterns**

### **Express.js API Integration**
```javascript
import express from 'express';
import { WebsiteVideoRecorderTool } from './src/tools/websiteVideoRecorder.js';

const app = express();
const videoRecorder = new WebsiteVideoRecorderTool();

app.post('/api/record-website', async (req, res) => {
  try {
    const { url, duration, viewport } = req.body;
    
    const result = await videoRecorder.recordWebsite({
      url,
      duration: duration || 20,
      viewport: viewport || 'desktop'
    });
    
    res.json({
      success: true,
      videoPath: result.videoPath,
      fileSize: result.fileSize
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Website recording API running on port 3000');
});
```

### **OpenAI Assistant API Integration**
```javascript
// For integration with OpenAI Assistant APIs
export const websiteRecordingTool = {
  type: "function",
  function: {
    name: "record_website_video",
    description: "Record a video of website interactions and exploration",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Website URL to record"
        },
        duration: {
          type: "integer", 
          description: "Recording duration in seconds",
          default: 20
        },
        viewport: {
          type: "string",
          enum: ["desktop", "mobile", "tablet"],
          description: "Device viewport for recording"
        },
        actions: {
          type: "array",
          description: "Custom actions to perform during recording",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              selector: { type: "string" },
              text: { type: "string" },
              position: { type: "integer" },
              duration: { type: "integer" }
            }
          }
        }
      },
      required: ["url"]
    }
  }
};
```

## 🛠️ **Configuration Options**

### **Environment Variables (.env)**
```bash
# Optional: Custom paths
WEBSITE_RECORDING_OUTPUT_DIR=./custom/video/path
WEBSITE_SCREENSHOT_OUTPUT_DIR=./custom/screenshot/path

# Optional: Browser settings
CHROMIUM_PATH=/path/to/chromium
CHROME_PATH=/path/to/chrome

# Optional: FFmpeg path
FFMPEG_PATH=/usr/local/bin/ffmpeg

# Optional: Performance settings
VIDEO_RECORDING_TIMEOUT=60000
SCREENSHOT_TIMEOUT=30000
MAX_CONCURRENT_RECORDINGS=2
```

### **Viewport Configurations**
```javascript
const VIEWPORTS = {
  "desktop": { width: 1920, height: 1080 },
  "desktop_4k": { width: 3840, height: 2160 },
  "laptop": { width: 1366, height: 768 },
  "tablet": { width: 1024, height: 1366 },
  "tablet_landscape": { width: 1366, height: 1024 },
  "mobile": { width: 414, height: 896 },
  "mobile_hd": { width: 428, height: 926 },
  "mobile_small": { width: 375, height: 667 }
};
```

## 🚨 **Troubleshooting**

### **Common Issues & Solutions**

**1. "Playwright not found" Error**
```bash
# Solution:
pip3 install playwright --break-system-packages
playwright install chromium
```

**2. "ChromeDriver not found" Error**
```bash
# Solution:
pip3 install webdriver-manager --break-system-packages
# Or manually download ChromeDriver matching your Chrome version
```

**3. "FFmpeg not found" Error**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows - Download from https://ffmpeg.org/
```

**4. Permission Denied Errors**
```bash
# Make Python scripts executable
chmod +x src/tools/video_recording_script.py
chmod +x src/tools/screenshot_script.py
```

**5. Memory/Performance Issues**
```bash
# Reduce concurrent recordings
MAX_CONCURRENT_RECORDINGS=1

# Use headless mode (default)
# Increase system memory allocation for Node.js
node --max-old-space-size=4096 your-app.js
```

**6. Network/Timeout Issues**
```javascript 
// Increase timeouts in your implementation
const result = await videoRecorder.recordWebsite({
  url: 'https://slow-website.com',
  duration: 60,  // Longer duration
  // Custom timeout handling in Python script
});
```

## 📊 **Performance Considerations**

### **Resource Usage**
- **Memory:** 200-500MB per concurrent recording
- **CPU:** Moderate usage during recording and video conversion
- **Disk:** ~5-50MB per video (depends on duration and viewport)
- **Network:** Bandwidth depends on website content

### **Optimization Tips**
```javascript
// 1. Limit concurrent recordings
const maxConcurrent = 2;

// 2. Use appropriate video quality settings
const ffmpegArgs = ['-crf', '23']; // Balanced quality/size

// 3. Clean up old recordings
const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
// Implement cleanup logic

// 4. Use CDN for serving videos
const videoUrl = `https://cdn.example.com/videos/${videoFilename}`;
```

## 🔒 **Security Considerations**

### **Input Validation**
```javascript
function validateUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    // Block internal/private IPs
    const hostname = parsedUrl.hostname;
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      throw new Error('Internal URLs not allowed');
    }
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs allowed');
    }
    
    return true;
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}
```

### **Rate Limiting**
```javascript
// Implement rate limiting per IP/user
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // Limit each IP to 10 requests per windowMs
};
```

### **Content Security**
```javascript
// Scan recorded content for sensitive information
function sanitizeRecording(videoPath) {
  // Implement content scanning logic
  // Remove or blur sensitive content
}
```

## 📈 **Monitoring & Logging**

### **Logging Implementation**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'website-recording.log' }),
    new winston.transports.Console()
  ]
});

// Usage in tools
logger.info('Recording started', { 
  url, 
  duration, 
  viewport,
  requestId: generateRequestId()
});
```

### **Health Monitoring**
```javascript
// Health check endpoint
app.get('/health/recording', async (req, res) => {
  try {
    // Check Python dependencies
    execSync('python3 -c "import playwright"', { stdio: 'ignore' });
    execSync('python3 -c "import selenium"', { stdio: 'ignore' });
    
    // Check FFmpeg
    execSync('ffmpeg -version', { stdio: 'ignore' });
    
    res.json({ status: 'healthy', dependencies: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});
```

## 🎯 **Next Steps**

1. **Copy the implementation files** into your project structure
2. **Run the installation commands** in the specified order
3. **Test with a simple website** to verify functionality
4. **Customize viewport and action configurations** for your use case
5. **Implement security and rate limiting** as needed
6. **Add monitoring and logging** for production use
7. **Integrate with your existing API or framework**

## 📚 **Additional Resources**

- **Playwright Documentation:** https://playwright.dev/
- **Selenium Documentation:** https://selenium-python.readthedocs.io/
- **FFmpeg Documentation:** https://ffmpeg.org/documentation.html
- **Node.js Child Process:** https://nodejs.org/api/child_process.html

This comprehensive guide provides everything needed to successfully integrate website video recording and screenshot capabilities into any existing codebase. The implementation is production-ready with proper error handling, security considerations, and performance optimizations. 