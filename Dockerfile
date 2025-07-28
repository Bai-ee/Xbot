FROM node:18-slim

# Install FFmpeg system-wide
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p content/audio outputs/renders outputs/backgrounds temp-uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 