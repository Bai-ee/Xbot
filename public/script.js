// Twitter Bot Dashboard Frontend Script

class TwitterBotDashboard {
    constructor() {
        this.tweets = [];
        this.currentTab = 'tweets';
        this.updateDebounceTimer = null;
        this.autoRefreshTimer = null;
        this.loading = false;
        this.mediaFiles = []; // Store uploaded media files
        this.maxMediaFiles = 4; // Twitter's limit
        this.maxFileSize = 15 * 1024 * 1024; // 15MB max file size
        this.supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        this.supportedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTweets();
        this.startAutoRefresh();
        this.showTab('tweets');
        this.initializeCompose();
    }

    initializeCompose() {
        // Initialize character counter and button states
        const composeTextarea = document.getElementById('new-tweet-content');
        const charCountEl = document.getElementById('new-tweet-char-count');
        const postBtn = document.getElementById('post-directly');
        const saveBtn = document.getElementById('save-draft');
        
        if (charCountEl) {
            charCountEl.textContent = '0/280 characters';
        }
        
        if (postBtn) {
            postBtn.disabled = true;
        }
        
        if (saveBtn) {
            saveBtn.disabled = true;
        }
        
        // Focus on compose area for immediate use
        if (composeTextarea) {
            composeTextarea.focus();
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Tweet management buttons
        document.getElementById('generate-tweet')?.addEventListener('click', () => this.generateTweet());
        document.getElementById('clear-posted')?.addEventListener('click', () => this.clearPostedTweets());

        // New compose functionality
        document.getElementById('post-directly')?.addEventListener('click', () => this.postDirectly());
        document.getElementById('save-draft')?.addEventListener('click', () => this.saveDraft());
        
        // Character counting for compose area
        const composeTextarea = document.getElementById('new-tweet-content');
        if (composeTextarea) {
            composeTextarea.addEventListener('input', (e) => this.handleComposeInput(e));
        }

        // Analytics refresh button
        document.getElementById('refresh-analytics')?.addEventListener('click', () => this.refreshAnalytics());

        // Media upload event listeners
        const mediaUploadInput = document.getElementById('media-upload');
        const clearMediaBtn = document.getElementById('clear-media');
        
        if (mediaUploadInput) {
            mediaUploadInput.addEventListener('change', (e) => this.handleMediaUpload(e));
        }
        
        if (clearMediaBtn) {
            clearMediaBtn.addEventListener('click', () => this.clearAllMedia());
        }

        // Auto-refresh when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentTab === 'tweets') {
                this.loadTweets();
            }
        });

        // Chat functionality
        const sendChatBtn = document.getElementById('send-chat');
        const chatInput = document.getElementById('chat-input');
        
        if (sendChatBtn) {
            sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        }
        
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }

        // Multi-Agent functionality
        this.setupMultiAgentEventListeners();
    }

    showTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load tab-specific data
        switch (tabName) {
            case 'tweets':
                this.loadTweets();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'profile':
                this.loadProfile();
                break;
            case 'video':
                console.log('🎬 Switching to video tab - initializing video generation');
                // Small delay to ensure DOM elements are fully rendered
                setTimeout(() => {
                    this.initializeVideoGeneration();
                }, 100);
                break;
            case 'audio':
                console.log('🎵 Switching to audio tab - initializing audio generation');
                // Small delay to ensure DOM elements are fully rendered
                setTimeout(() => {
                    this.initializeAudioGeneration();
                }, 100);
                break;
        }
    }

    async loadTweets() {
        try {
            const response = await fetch('/api/tweets');
            if (response.ok) {
                this.tweets = await response.json();
                this.renderTweets();
                this.updateStats();
            } else {
                console.error('Failed to load tweets');
                this.showToast('Failed to load tweets', 'error');
            }
        } catch (error) {
            console.error('Error loading tweets:', error);
            this.showToast('Network error loading tweets', 'error');
        }
    }

    async loadAnalytics() {
        // Load rate limit info first
        await this.loadRateLimitInfo();

        this.showLoading(true);
        try {
            // Load cached analytics data (no forced refresh)
            const analyticsResponse = await fetch('/api/analytics');
            if (analyticsResponse.ok) {
                const analytics = await analyticsResponse.json();
                this.renderAnalytics(analytics);
                this.updateCacheInfo(analytics);
            } else {
                console.error('Failed to load analytics');
                this.showAnalyticsError('Failed to load analytics data');
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showAnalyticsError('Network error loading analytics');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshAnalytics() {
        const refreshBtn = document.getElementById('refresh-analytics');
        const originalText = refreshBtn?.textContent;
        
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('loading');
            refreshBtn.textContent = '🔄 Refreshing...';
        }

        try {
            console.log('Manual analytics refresh requested...');
            const response = await fetch('/api/refresh-analytics', { method: 'POST' });
            const result = await response.json();

            if (response.ok) {
                this.renderAnalytics(result.data);
                this.updateCacheInfo(result.data);
                this.loadRateLimitInfo(); // Update rate limit display
                this.showToast('📊 Analytics refreshed successfully!', 'success');
            } else {
                // Handle rate limit or other errors
                if (response.status === 429) {
                    this.showToast(`Rate limit reached: ${result.message}`, 'warning');
                    // Still show cached data if available
                    if (result.cached_data) {
                        this.renderAnalytics(result.cached_data);
                        this.updateCacheInfo(result.cached_data);
                    }
                } else {
                    this.showToast(`Refresh failed: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error refreshing analytics:', error);
            this.showToast('Network error during refresh', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('loading');
                refreshBtn.textContent = originalText;
            }
        }
    }

    async loadRateLimitInfo() {
        try {
            const response = await fetch('/api/rate-limit');
            if (response.ok) {
                const rateLimitData = await response.json();
                this.updateRateLimitDisplay(rateLimitData);
            }
        } catch (error) {
            console.error('Error loading rate limit info:', error);
        }
    }

    updateRateLimitDisplay(rateLimitData) {
        const remainingEl = document.getElementById('rate-limit-remaining');
        const totalEl = document.getElementById('rate-limit-total');
        const resetEl = document.getElementById('rate-limit-reset');
        const refreshBtn = document.getElementById('refresh-analytics');

        const remaining = rateLimitData.remaining || 0;
        const limit = rateLimitData.limit || 25;
        const isRateLimited = remaining <= 0;

        if (remainingEl) remainingEl.textContent = remaining;
        if (totalEl) totalEl.textContent = limit;

        // Update reset time with better formatting
        if (resetEl) {
            if (rateLimitData.timeUntilResetHours && isRateLimited) {
                resetEl.textContent = `Resets in ${rateLimitData.timeUntilResetHours}h`;
                resetEl.style.color = '#e74c3c'; // Red for rate limited
            } else if (rateLimitData.timeUntilResetHours) {
                resetEl.textContent = `Resets in ${rateLimitData.timeUntilResetHours}h`;
                resetEl.style.color = '#95a5a6'; // Gray for normal
            } else {
                resetEl.textContent = '';
            }
        }

        // Update refresh button state with better messaging
        if (refreshBtn) {
            if (isRateLimited) {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '🚫 Rate Limited';
                refreshBtn.title = `Rate limit reached (0/${limit}). Resets in ${rateLimitData.timeUntilResetHours || '?'}h`;
                refreshBtn.classList.add('disabled');
            } else {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Analytics';
                refreshBtn.title = `Manually refresh analytics data (${remaining}/${limit} remaining)`;
                refreshBtn.classList.remove('disabled');
            }
        }

        // Update rate limit info display colors
        const rateLimitInfoEl = document.getElementById('rate-limit-info');
        if (rateLimitInfoEl) {
            if (isRateLimited) {
                rateLimitInfoEl.style.color = '#e74c3c'; // Red
                rateLimitInfoEl.title = 'Rate limit exceeded - analytics unavailable until reset';
            } else if (remaining <= 5) {
                rateLimitInfoEl.style.color = '#f39c12'; // Orange warning
                rateLimitInfoEl.title = `Low on refreshes - ${remaining} remaining`;
            } else {
                rateLimitInfoEl.style.color = '#27ae60'; // Green
                rateLimitInfoEl.title = `${remaining} analytics refreshes available`;
            }
        }
    }

    updateCacheInfo(analytics) {
        const cacheStatusEl = document.getElementById('cache-status');
        const lastUpdatedEl = document.getElementById('last-updated');

        if (!cacheStatusEl || !lastUpdatedEl || !analytics) return;

        const cacheInfo = analytics.cache_info || {};
        const rateLimit = analytics.rate_limit || {};
        
        // Update cache status with rich information
        cacheStatusEl.className = 'cache-status';
        
        if (cacheInfo.rate_limited) {
            // Rate limited - show prominent message
            cacheStatusEl.textContent = `🚫 Rate Limited (${cacheInfo.refreshes_remaining || 0}/${cacheInfo.total_refreshes || 25} refreshes)`;
            cacheStatusEl.classList.add('error');
            
            // Show detailed message in last updated
            if (cacheInfo.hours_until_reset) {
                lastUpdatedEl.textContent = `⏰ Resets in ${cacheInfo.hours_until_reset} hours`;
            } else {
                lastUpdatedEl.textContent = '⏰ Reset time unknown';
            }
        } else if (cacheInfo.no_data) {
            // No data available but not rate limited
            cacheStatusEl.textContent = `⚠️ No data - ${cacheInfo.refreshes_remaining || 0}/${cacheInfo.total_refreshes || 25} refreshes available`;
            cacheStatusEl.classList.add('error');
            lastUpdatedEl.textContent = 'Try manually refreshing analytics';
        } else if (cacheInfo.from_cache) {
            // Cached data
            const ageHours = cacheInfo.cache_age_hours || 0;
            cacheStatusEl.textContent = `📦 Cached data (${ageHours}h old)`;
            cacheStatusEl.classList.add('from-cache');
            
            const lastUpdated = cacheInfo.last_cached;
            if (lastUpdated) {
                const updateTime = new Date(lastUpdated);
                lastUpdatedEl.textContent = `Cached: ${this.formatDate(updateTime)}`;
            }
        } else if (cacheInfo.refreshed_at) {
            // Fresh data
            cacheStatusEl.textContent = `✨ Fresh data (${rateLimit.remaining || 0}/${rateLimit.limit || 25} refreshes left)`;
            cacheStatusEl.classList.add('fresh');
            
            const updateTime = new Date(cacheInfo.refreshed_at);
            lastUpdatedEl.textContent = `Updated: ${this.formatDate(updateTime)}`;
        } else {
            // Default state
            cacheStatusEl.textContent = '📊 Analytics loaded';
            lastUpdatedEl.textContent = '';
        }
    }

    showAnalyticsError(message) {
        const cacheStatusEl = document.getElementById('cache-status');
        if (cacheStatusEl) {
            cacheStatusEl.className = 'cache-status error';
            cacheStatusEl.textContent = '❌ ' + message;
        }
    }

    async loadProfile() {
        this.showLoading(true);
        try {
            const response = await fetch('/api/profile');
            if (response.ok) {
                const profile = await response.json();
                this.renderProfile(profile);
            } else {
                console.error('Failed to load profile');
                this.showToast('Failed to load profile data', 'error');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showToast('Network error loading profile', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderAnalytics(analytics) {
        if (!analytics) return;

        // Handle profile metrics - show clear messaging for rate limited data
        const profile = analytics.profile || {};
        const profileMetrics = profile.public_metrics || {};
        const engagement = analytics.recent_engagement || {};
        const cacheInfo = analytics.cache_info || {};
        
        // If rate limited, show special messaging
        const isRateLimited = cacheInfo.rate_limited || false;
        const hasNoData = cacheInfo.no_data || false;
        
        if (isRateLimited || hasNoData) {
            // Update profile display with rate limit messaging
            this.updateFollowersData({
                followers_count: profileMetrics.followers_count || 0,
                following_count: profileMetrics.following_count || 0,
                tweet_count: profileMetrics.tweet_count || 0,
                listed_count: profileMetrics.listed_count || 0,
                username: isRateLimited ? 'Rate Limited' : (profile.username || 'N/A'),
                name: isRateLimited ? 'Data Unavailable' : (profile.name || 'N/A'),
                total_likes: engagement.total_likes || 0,
                rate_limited: isRateLimited
            });
        } else {
            // Normal display
            this.updateFollowersData({
                followers_count: profileMetrics.followers_count || 0,
                following_count: profileMetrics.following_count || 0,
                tweet_count: profileMetrics.tweet_count || 0,
                listed_count: profileMetrics.listed_count || 0,
                username: profile.username || 'N/A',
                name: profile.name || 'N/A',
                total_likes: engagement.total_likes || 0
            });
        }

        // Update recent engagement stats with special messaging for rate limited
        const recentLikesEl = document.getElementById('recent-likes');
        const recentRetweetsEl = document.getElementById('recent-retweets');
        const recentRepliesEl = document.getElementById('recent-replies');
        const avgLikesEl = document.getElementById('avg-likes');

        if (isRateLimited) {
            // Show rate limited message in engagement stats
            if (recentLikesEl) {
                recentLikesEl.textContent = '-';
                recentLikesEl.title = 'Unavailable due to rate limits';
            }
            if (recentRetweetsEl) {
                recentRetweetsEl.textContent = '-';
                recentRetweetsEl.title = 'Unavailable due to rate limits';
            }
            if (recentRepliesEl) {
                recentRepliesEl.textContent = '-';
                recentRepliesEl.title = 'Unavailable due to rate limits';
            }
            if (avgLikesEl) {
                avgLikesEl.textContent = '-';
                avgLikesEl.title = 'Unavailable due to rate limits';
            }
        } else {
            // Normal display
            if (recentLikesEl) {
                recentLikesEl.textContent = this.formatNumber(engagement.total_likes || 0);
                recentLikesEl.title = '';
            }
            if (recentRetweetsEl) {
                recentRetweetsEl.textContent = this.formatNumber(engagement.total_retweets || 0);
                recentRetweetsEl.title = '';
            }
            if (recentRepliesEl) {
                recentRepliesEl.textContent = this.formatNumber(engagement.total_replies || 0);
                recentRepliesEl.title = '';
            }
            if (avgLikesEl) {
                avgLikesEl.textContent = this.formatNumber(engagement.avg_likes_per_tweet || 0);
                avgLikesEl.title = '';
            }
        }

        // Handle recent tweets - show message if none due to rate limits
        const recentTweets = analytics.recent_tweets || [];
        if (isRateLimited && recentTweets.length === 0) {
            this.renderRecentTweets([], 'Recent tweets unavailable due to API rate limits');
        } else {
            this.renderRecentTweets(recentTweets);
        }

        // Update rate limit info if available
        if (analytics.rate_limit) {
            this.updateRateLimitDisplay(analytics.rate_limit);
        }
    }

    updateFollowersData(followers) {
        // Update account overview stats
        const followersCountEl = document.getElementById('followers-count');
        const followingCountEl = document.getElementById('following-count');
        const totalTweetsCountEl = document.getElementById('total-tweets-count');
        const totalLikesCountEl = document.getElementById('total-likes-count');

        const isRateLimited = followers.rate_limited || false;
        const displayValue = isRateLimited ? '-' : (value) => this.formatNumber(value || 0);

        if (followersCountEl) {
            followersCountEl.textContent = isRateLimited ? '-' : this.formatNumber(followers.followers_count || 0);
            followersCountEl.title = isRateLimited ? 'Unavailable due to rate limits' : '';
        }
        if (followingCountEl) {
            followingCountEl.textContent = isRateLimited ? '-' : this.formatNumber(followers.following_count || 0);
            followingCountEl.title = isRateLimited ? 'Unavailable due to rate limits' : '';
        }
        if (totalTweetsCountEl) {
            totalTweetsCountEl.textContent = isRateLimited ? '-' : this.formatNumber(followers.tweet_count || 0);
            totalTweetsCountEl.title = isRateLimited ? 'Unavailable due to rate limits' : '';
        }
        if (totalLikesCountEl) {
            totalLikesCountEl.textContent = isRateLimited ? '-' : this.formatNumber(followers.total_likes || 0);
            totalLikesCountEl.title = isRateLimited ? 'Unavailable due to rate limits' : '';
        }
    }

    renderRecentTweets(tweets, message = '') {
        const container = document.getElementById('recent-tweets-list');
        if (message) {
            container.innerHTML = `<div class="loading">${message}</div>`;
            return;
        }

        if (!tweets || tweets.length === 0) {
            container.innerHTML = '<div class="loading">No recent tweets available</div>';
            return;
        }

        container.innerHTML = tweets.map(tweet => `
            <div class="recent-tweet-item">
                <div class="recent-tweet-text">${this.escapeHtml(tweet.text)}</div>
                <div class="recent-tweet-meta">
                    <span>${this.formatDate(tweet.created_at)}</span>
                    <div class="recent-tweet-metrics">
                        <span>❤️ ${tweet.public_metrics?.like_count || 0}</span>
                        <span>🔁 ${tweet.public_metrics?.retweet_count || 0}</span>
                        <span>💬 ${tweet.public_metrics?.reply_count || 0}</span>
                        <span>🔗 ${tweet.public_metrics?.quote_count || 0}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showRecentTweetsRateLimit() {
        const container = document.getElementById('recent-tweets-list');
        container.innerHTML = `
            <div class="loading">
                <p>⏱️ Recent tweets temporarily unavailable due to API rate limits</p>
                <p style="font-size: 0.9rem; margin-top: 10px; opacity: 0.8;">
                    Twitter API allows 15 requests per 15 minutes. Try again in a few minutes.
                </p>
            </div>
        `;
    }

    renderProfile(profile) {
        document.getElementById('profile-image').src = profile.profile_image_url || '';
        document.getElementById('profile-name').textContent = profile.name || '-';
        document.getElementById('profile-username').textContent = '@' + (profile.username || '-');
        document.getElementById('profile-description').textContent = profile.description || 'No bio available';
        
        if (profile.public_metrics) {
            document.getElementById('profile-followers').textContent = this.formatNumber(profile.public_metrics.followers_count);
            document.getElementById('profile-following').textContent = this.formatNumber(profile.public_metrics.following_count);
            document.getElementById('profile-tweets').textContent = this.formatNumber(profile.public_metrics.tweet_count);
            document.getElementById('profile-media').textContent = this.formatNumber(profile.public_metrics.media_count || 0);
        }

        document.getElementById('profile-joined').textContent = this.formatDate(profile.created_at);
        document.getElementById('profile-location').textContent = profile.location || 'Not specified';
        
        const urlElement = document.getElementById('profile-url');
        if (profile.url) {
            urlElement.href = profile.url;
            urlElement.textContent = profile.entities?.url?.urls?.[0]?.display_url || profile.url;
            urlElement.style.display = 'inline';
        } else {
            urlElement.style.display = 'none';
            urlElement.parentElement.style.display = 'none';
        }
    }

    renderTweets() {
        const container = document.getElementById('tweet-queue');
        
        if (this.tweets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🎶 No tweets in queue</h3>
                    <p>Generate some fresh DJ content to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tweets.map(tweet => this.renderTweetCard(tweet)).join('');
        this.attachTweetEventListeners();
    }

    renderTweetCard(tweet) {
        const isPosted = tweet.status === 'posted';
        const charCount = tweet.content.length;
        const charClass = charCount > 280 ? 'error' : charCount > 260 ? 'warning' : '';
        
        return `
            <div class="tweet-card" data-tweet-id="${tweet.id}">
                <div class="tweet-header">
                    <span class="tweet-status status-${tweet.status}">${tweet.status}</span>
                    <small>Created: ${this.formatDate(tweet.createdAt)}</small>
                </div>
                
                <div class="tweet-content">
                    <textarea 
                        class="tweet-textarea" 
                        ${isPosted ? 'readonly' : ''}
                        placeholder="Write your tweet here..."
                    >${tweet.content}</textarea>
                    <div class="character-count ${charClass}">
                        ${charCount}/280 characters
                    </div>
                </div>
                
                <div class="tweet-actions">
                    ${!isPosted ? `
                        <button class="btn btn-success" onclick="dashboard.approveTweet('${tweet.id}')">
                            ✅ Post to Twitter
                        </button>
                        <button class="btn btn-danger" onclick="dashboard.rejectTweet('${tweet.id}')">
                            ❌ Delete
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="dashboard.rejectTweet('${tweet.id}')">
                            🗑️ Remove
                        </button>
                        ${tweet.twitterId ? `
                            <a href="https://twitter.com/user/status/${tweet.twitterId}" 
                               target="_blank" class="btn btn-primary">
                                🔗 View on Twitter
                            </a>
                        ` : ''}
                    `}
                </div>
            </div>
        `;
    }

    attachTweetEventListeners() {
        document.querySelectorAll('.tweet-textarea').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                this.handleTweetInput(e);
            });
        });
    }

    handleTweetInput(event) {
        const textarea = event.target;
        const tweetCard = textarea.closest('.tweet-card');
        const tweetId = tweetCard.dataset.tweetId;
        const content = textarea.value;
        const charCount = content.length;
        
        // Update character count
        const charCountEl = tweetCard.querySelector('.character-count');
        charCountEl.textContent = `${charCount}/280 characters`;
        charCountEl.className = `character-count ${charCount > 280 ? 'error' : charCount > 260 ? 'warning' : ''}`;
        
        // Debounce the update
        clearTimeout(this.updateDebounceTimer);
        this.updateDebounceTimer = setTimeout(() => {
            this.updateTweet(tweetId, content);
        }, 1000);
    }

    async generateTweet() {
        this.showLoading(true);
        try {
            const response = await fetch('/api/generate', { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                this.tweets.unshift(result.tweet);
                this.renderTweets();
                this.updateStats();
                this.showToast('🎵 New DJ tweet generated!', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Failed to generate tweet: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error generating tweet:', error);
            this.showToast('Failed to generate tweet. Try writing one manually instead!', 'info');
        } finally {
            this.showLoading(false);
        }
    }

    handleComposeInput(event) {
        const content = event.target.value;
        const charCount = content.length;
        const charCountEl = document.getElementById('new-tweet-char-count');
        
        if (charCountEl) {
            charCountEl.textContent = `${charCount}/280 characters`;
            
            // Update character count color based on limit
            if (charCount > 280) {
                charCountEl.style.color = '#e74c3c';
            } else if (charCount > 250) {
                charCountEl.style.color = '#f39c12';
            } else {
                charCountEl.style.color = '#7f8c8d';
            }
        }
        
        this.updateComposeButtons();
    }

    handleMediaUpload(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) return;
        
        // Check if adding these files would exceed the limit
        if (this.mediaFiles.length + files.length > this.maxMediaFiles) {
            this.showToast(`Maximum ${this.maxMediaFiles} media files allowed`, 'error');
            return;
        }
        
        files.forEach(file => {
            if (this.validateMediaFile(file)) {
                this.addMediaFile(file);
            }
        });
        
        // Clear the input so the same file can be selected again
        event.target.value = '';
        
        this.updateMediaDisplay();
        this.updateComposeButtons();
    }

    validateMediaFile(file) {
        // Check file size
        if (file.size > this.maxFileSize) {
            this.showToast(`File "${file.name}" is too large. Maximum size is 15MB.`, 'error');
            return false;
        }
        
        // Check file type
        const isImage = this.supportedImageTypes.includes(file.type);
        const isVideo = this.supportedVideoTypes.includes(file.type);
        
        if (!isImage && !isVideo) {
            this.showToast(`File "${file.name}" is not a supported format.`, 'error');
            return false;
        }
        
        return true;
    }

    addMediaFile(file) {
        const mediaFile = {
            id: Date.now() + Math.random(), // Unique ID
            file: file,
            type: file.type.startsWith('image/') ? 'image' : 'video',
            name: file.name,
            size: file.size,
            preview: null
        };
        
        this.mediaFiles.push(mediaFile);
        this.generateMediaPreview(mediaFile);
    }

    generateMediaPreview(mediaFile) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            mediaFile.preview = e.target.result;
            this.updateMediaDisplay();
        };
        
        reader.onerror = () => {
            this.showToast(`Failed to load preview for "${mediaFile.name}"`, 'error');
            this.removeMediaFile(mediaFile.id);
        };
        
        reader.readAsDataURL(mediaFile.file);
    }

    removeMediaFile(mediaId) {
        this.mediaFiles = this.mediaFiles.filter(media => media.id !== mediaId);
        this.updateMediaDisplay();
        this.updateComposeButtons();
    }

    clearAllMedia() {
        this.mediaFiles = [];
        this.updateMediaDisplay();
        this.updateComposeButtons();
    }

    updateMediaDisplay() {
        const mediaPreview = document.getElementById('media-preview');
        const mediaPreviewContainer = document.getElementById('media-preview-container');
        const clearMediaBtn = document.getElementById('clear-media');
        const mediaInfo = document.getElementById('media-info');
        const mediaCountText = document.getElementById('media-count-text');
        
        if (this.mediaFiles.length === 0) {
            mediaPreview.style.display = 'none';
            clearMediaBtn.style.display = 'none';
            mediaInfo.style.display = 'none';
            return;
        }
        
        // Show media preview section
        mediaPreview.style.display = 'block';
        clearMediaBtn.style.display = 'inline-block';
        mediaInfo.style.display = 'block';
        
        // Update media count
        const fileText = this.mediaFiles.length === 1 ? 'file' : 'files';
        mediaCountText.textContent = `${this.mediaFiles.length} ${fileText}`;
        
        // Clear and rebuild preview container
        mediaPreviewContainer.innerHTML = '';
        
        this.mediaFiles.forEach(mediaFile => {
            const previewItem = this.createMediaPreviewItem(mediaFile);
            mediaPreviewContainer.appendChild(previewItem);
        });
    }

    createMediaPreviewItem(mediaFile) {
        const item = document.createElement('div');
        item.className = 'media-preview-item';
        item.setAttribute('data-type', mediaFile.type);
        
        if (mediaFile.preview) {
            // Create media element
            let mediaElement;
            if (mediaFile.type === 'image') {
                mediaElement = document.createElement('img');
                mediaElement.src = mediaFile.preview;
                mediaElement.alt = mediaFile.name;
            } else {
                mediaElement = document.createElement('video');
                mediaElement.src = mediaFile.preview;
                mediaElement.controls = false;
                mediaElement.muted = true;
            }
            
            item.appendChild(mediaElement);
        } else {
            // Show loading state
            item.classList.add('loading');
            const spinner = document.createElement('div');
            spinner.className = 'media-loading-spinner';
            item.appendChild(spinner);
        }
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'media-remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove media';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeMediaFile(mediaFile.id);
        });
        item.appendChild(removeBtn);
        
        // File info
        const fileInfo = document.createElement('div');
        fileInfo.className = 'media-file-info';
        fileInfo.textContent = `${mediaFile.name} (${this.formatFileSize(mediaFile.size)})`;
        item.appendChild(fileInfo);
        
        return item;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateComposeButtons() {
        const postBtn = document.getElementById('post-directly');
        const saveDraftBtn = document.getElementById('save-draft');
        const textarea = document.getElementById('new-tweet-content');
        
        const hasContent = textarea.value.trim().length > 0;
        const hasMedia = this.mediaFiles.length > 0;
        const canPost = hasContent || hasMedia;
        
        if (postBtn) {
            postBtn.disabled = !canPost;
            postBtn.title = canPost ? 'Post tweet with media' : 'Add content or media to post';
        }
        
        if (saveDraftBtn) {
            saveDraftBtn.disabled = !canPost;
            saveDraftBtn.title = canPost ? 'Save tweet as draft' : 'Add content or media to save';
        }
    }

    async postDirectly() {
        const content = document.getElementById('new-tweet-content').value.trim();
        
        if (!content && this.mediaFiles.length === 0) {
            this.showToast('Please add content or media to your tweet', 'error');
            return;
        }
        
        const postBtn = document.getElementById('post-directly');
        const originalText = postBtn.textContent;
        
        try {
            postBtn.disabled = true;
            postBtn.textContent = '🚀 Posting...';
            
            // Create FormData to handle file uploads
            const formData = new FormData();
            formData.append('content', content);
            
            // Add media files
            this.mediaFiles.forEach((mediaFile, index) => {
                formData.append(`media_${index}`, mediaFile.file);
            });
            
            const response = await fetch('/api/post-direct', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showToast('Tweet posted successfully! 🎉', 'success');
                
                // Clear the compose area
                document.getElementById('new-tweet-content').value = '';
                this.clearAllMedia();
                this.handleComposeInput({ target: { value: '' } });
                
                // Refresh the queue
                await this.loadQueue();
            } else {
                throw new Error(result.error || 'Failed to post tweet');
            }
        } catch (error) {
            console.error('Error posting tweet:', error);
            this.showToast(error.message || 'Failed to post tweet', 'error');
        } finally {
            postBtn.disabled = false;
            postBtn.textContent = originalText;
            this.updateComposeButtons();
        }
    }

    async saveDraft() {
        const content = document.getElementById('new-tweet-content').value.trim();
        
        if (!content && this.mediaFiles.length === 0) {
            this.showToast('Please add content or media to save as draft', 'error');
            return;
        }
        
        const saveDraftBtn = document.getElementById('save-draft');
        const originalText = saveDraftBtn.textContent;
        
        try {
            saveDraftBtn.disabled = true;
            saveDraftBtn.textContent = '💾 Saving...';
            
            // Create FormData to handle file uploads
            const formData = new FormData();
            formData.append('content', content);
            formData.append('draft', 'true');
            
            // Add media files
            this.mediaFiles.forEach((mediaFile, index) => {
                formData.append(`media_${index}`, mediaFile.file);
            });
            
            const response = await fetch('/api/save-draft', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showToast('Draft saved successfully! 💾', 'success');
                
                // Clear the compose area
                document.getElementById('new-tweet-content').value = '';
                this.clearAllMedia();
                this.handleComposeInput({ target: { value: '' } });
                
                // Refresh the queue
                await this.loadQueue();
            } else {
                throw new Error(result.error || 'Failed to save draft');
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            this.showToast(error.message || 'Failed to save draft', 'error');
        } finally {
            saveDraftBtn.disabled = false;
            saveDraftBtn.textContent = originalText;
            this.updateComposeButtons();
        }
    }

    async updateTweet(id, content) {
        try {
            const response = await fetch(`/api/tweets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            
            if (response.ok) {
                const result = await response.json();
                const index = this.tweets.findIndex(t => t.id === id);
                if (index !== -1) {
                    this.tweets[index] = result.tweet;
                }
            }
        } catch (error) {
            console.error('Error updating tweet:', error);
        }
    }

    async approveTweet(id) {
        this.showLoading(true);
        try {
            const response = await fetch(`/api/tweets/${id}/approve`, { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                const index = this.tweets.findIndex(t => t.id === id);
                if (index !== -1) {
                    this.tweets[index] = result.tweet;
                }
                this.renderTweets();
                this.updateStats();
                this.showToast('🎉 Tweet posted successfully to Twitter!', 'success');
            } else {
                const errorData = await response.json();
                console.error('Tweet approval failed:', errorData);
                if (response.status >= 500) {
                    this.showToast(`Failed to post tweet: ${errorData.error}`, 'error');
                } else if (response.status === 403) {
                    // Check if tweet actually posted despite duplicate warning
                    setTimeout(() => {
                        this.loadTweets();
                    }, 1000);
                    this.showToast('Checking tweet status...', 'info');
                } else {
                    this.showToast(`Warning: ${errorData.error}`, 'info');
                }
            }
        } catch (error) {
            console.error('Network error approving tweet:', error);
            this.showToast('Network error - please check your connection', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async rejectTweet(id) {
        try {
            const response = await fetch(`/api/tweets/${id}/reject`, { method: 'POST' });
            if (response.ok) {
                this.tweets = this.tweets.filter(t => t.id !== id);
                this.renderTweets();
                this.updateStats();
                this.showToast('Tweet deleted', 'info');
            } else {
                this.showToast('Failed to delete tweet', 'error');
            }
        } catch (error) {
            console.error('Error rejecting tweet:', error);
            this.showToast('Network error', 'error');
        }
    }

    async clearPostedTweets() {
        try {
            const response = await fetch('/api/tweets/posted', { method: 'DELETE' });
            if (response.ok) {
                this.tweets = this.tweets.filter(t => t.status !== 'posted');
                this.renderTweets();
                this.updateStats();
                this.showToast('Posted tweets cleared', 'info');
            } else {
                this.showToast('Failed to clear posted tweets', 'error');
            }
        } catch (error) {
            console.error('Error clearing posted tweets:', error);
            this.showToast('Network error', 'error');
        }
    }

    updateStats() {
        const pending = this.tweets.filter(t => t.status === 'pending').length;
        const posted = this.tweets.filter(t => t.status === 'posted').length;
        const total = this.tweets.length;

        document.getElementById('pending-count').textContent = pending;
        document.getElementById('posted-count').textContent = posted;
        document.getElementById('total-count').textContent = total;
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        // Clear any existing duplicate toasts
        const existingToasts = container.querySelectorAll('.toast');
        existingToasts.forEach(toast => {
            if (toast.textContent === message) {
                toast.remove();
            }
        });
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    startAutoRefresh() {
        // Refresh tweet data every 30 seconds when on tweets tab
        this.autoRefreshTimer = setInterval(() => {
            if (!document.hidden && this.currentTab === 'tweets') {
                this.loadTweets();
            }
        }, 30000);
    }

    formatNumber(num) {
        if (num === undefined || num === null) return '-';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatDate(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Chat functionality methods
    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab content
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.style.display = 'block';
        }
        
        // Add active class to selected tab button
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update current tab
        this.currentTab = tabName;
        
        // Load tab-specific data
        if (tabName === 'queue') {
            this.loadQueue();
        } else if (tabName === 'analytics') {
            this.loadAnalytics();
        } else if (tabName === 'video') {
            console.log('🎬 Switching to video tab - initializing video generation');
            setTimeout(() => {
                this.initializeVideoGeneration();
            }, 100);
        } else if (tabName === 'audio') {
            console.log('🎵 Switching to audio tab - initializing audio generation');
            setTimeout(() => {
                this.initializeAudioGeneration();
            }, 100);
        } else if (tabName === 'image') {
            console.log('🖼️ Switching to image tab - initializing image generation');
            setTimeout(() => {
                this.initializeImageGeneration();
            }, 100);
        }
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-chat');
        const sendText = sendBtn.querySelector('.send-text');
        const sendLoading = sendBtn.querySelector('.send-loading');
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        this.addChatMessage(message, 'user');
        
        // Clear input and disable send button
        chatInput.value = '';
        sendBtn.disabled = true;
        sendText.style.display = 'none';
        sendLoading.style.display = 'flex';
        
        try {
            // Get current context for the AI
            const context = await this.getChatContext();
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message, context })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Add AI response to chat
                this.addChatMessage(result.response, 'ai');
            } else {
                throw new Error(result.error || 'Failed to get AI response');
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage(
                'Sorry, I encountered an error. Please try again or check if your OpenAI API key is configured correctly.',
                'ai',
                true
            );
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            sendText.style.display = 'inline';
            sendLoading.style.display = 'none';
            
            // Focus back to input
            chatInput.focus();
        }
    }

    addChatMessage(content, sender, isError = false) {
        const chatMessages = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (isError) {
            messageContent.style.background = '#e74c3c';
            messageContent.style.color = 'white';
        }
        
        // Convert markdown-like formatting to HTML
        let formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        messageContent.innerHTML = formattedContent;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async getChatContext() {
        // Gather current dashboard context for the AI
        try {
            const context = {};
            
            // Get Twitter rate limit info if available
            if (typeof rateLimitInfo !== 'undefined') {
                context.remainingTweets = rateLimitInfo.remaining;
                context.analyticsRemaining = rateLimitInfo.remaining;
            }
            
            // Get recent engagement data if available
            if (this.currentTab === 'analytics') {
                const analyticsData = document.getElementById('analytics-tab');
                if (analyticsData && analyticsData.style.display !== 'none') {
                    // Try to extract some analytics context
                    const totalLikes = document.getElementById('total-likes-count')?.textContent;
                    const followers = document.getElementById('followers-count')?.textContent;
                    
                    if (totalLikes && followers) {
                        context.recentEngagement = `${followers} followers, ${totalLikes} total likes`;
                    }
                }
            }
            
            return context;
        } catch (error) {
            console.warn('Error getting chat context:', error);
            return {};
        }
    }

    // ============================================================================
    // MULTI-AGENT FRAMEWORK METHODS
    // ============================================================================

    setupMultiAgentEventListeners() {
        // Workflow selection buttons
        document.querySelectorAll('.workflow-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectWorkflow(e.target.dataset.workflow);
            });
        });

        // Multi-agent processing
        const processBtn = document.getElementById('process-multi-agent');
        const clearBtn = document.getElementById('clear-multi-agent');
        const refreshStatusBtn = document.getElementById('refresh-agent-status');

        if (processBtn) {
            processBtn.addEventListener('click', () => this.processMultiAgent());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearMultiAgent());
        }

        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', () => this.refreshAgentStatus());
        }

        // Result action buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'use-content') {
                this.useMultiAgentContent();
            } else if (e.target.id === 'refine-results') {
                this.refineMultiAgentResults();
            } else if (e.target.id === 'save-strategy') {
                this.saveMultiAgentStrategy();
            }
        });

        // Load initial agent status
        this.refreshAgentStatus();
    }

    selectWorkflow(workflowType) {
        // Update button states
        document.querySelectorAll('.workflow-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const selectedBtn = document.querySelector(`[data-workflow="${workflowType}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        this.selectedWorkflow = workflowType;
        console.log('Selected workflow:', workflowType);
    }

    async processMultiAgent() {
        const input = document.getElementById('multi-agent-input');
        const processBtn = document.getElementById('process-multi-agent');
        const processText = processBtn.querySelector('.process-text');
        const processLoading = processBtn.querySelector('.process-loading');

        if (!input.value.trim()) {
            this.showToast('Please describe your content goal', 'warning');
            return;
        }

        try {
            // Update button state
            processText.style.display = 'none';
            processLoading.style.display = 'inline-flex';
            processBtn.disabled = true;

            console.log('🚀 Processing multi-agent request:', input.value);

            // Prepare request
            const requestData = {
                input: input.value.trim(),
                context: this.getChatContext(),
                workflow: this.selectedWorkflow || 'auto'
            };

            // Choose endpoint based on workflow selection
            const endpoint = this.selectedWorkflow && this.selectedWorkflow !== 'auto' 
                ? `/api/workflow/${this.selectedWorkflow}`
                : '/api/multi-agent';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.displayMultiAgentResults(result);
                this.showToast('Multi-agent processing completed!', 'success');
            } else {
                throw new Error(result.error || 'Multi-agent processing failed');
            }

        } catch (error) {
            console.error('❌ Multi-agent processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
        } finally {
            // Reset button state
            processText.style.display = 'inline';
            processLoading.style.display = 'none';
            processBtn.disabled = false;
        }
    }

    displayMultiAgentResults(result) {
        const resultsContainer = document.getElementById('multi-agent-results');
        const workflowType = document.getElementById('result-workflow-type');
        const agentsUsed = document.getElementById('result-agents-used');
        const finalOutputSection = document.getElementById('final-output-section');
        const finalOutputContent = document.getElementById('final-output-content');
        const agentResultsContainer = document.getElementById('agent-results-container');
        const useContentBtn = document.getElementById('use-content');

        // Show the results container
        resultsContainer.style.display = 'block';

        // Update workflow info
        if (workflowType) {
            workflowType.textContent = result.workflow || result.workflowType || 'auto';
        }
        
        if (agentsUsed) {
            const agentCount = result.agents ? result.agents.length : 0;
            agentsUsed.textContent = `${agentCount} agent${agentCount !== 1 ? 's' : ''} used`;
        }

        // Display final output if available
        if (result.finalOutput && result.finalOutput.strategy) {
            finalOutputSection.style.display = 'block';
            finalOutputContent.innerHTML = this.formatMultiAgentContent(result.finalOutput.strategy);
            
            // Show use content button for final output
            if (useContentBtn) {
                useContentBtn.style.display = 'inline-block';
                useContentBtn.dataset.content = result.finalOutput.strategy;
            }
        } else {
            finalOutputSection.style.display = 'none';
        }

        // Display individual agent results
        agentResultsContainer.innerHTML = '';
        
        if (result.results && result.results.length > 0) {
            result.results.forEach((agentResult, index) => {
                const agentName = result.agents ? result.agents[index] : `Agent ${index + 1}`;
                const resultElement = this.createAgentResultElement(agentName, agentResult);
                agentResultsContainer.appendChild(resultElement);
            });
        }

        // Store results for later use
        this.lastMultiAgentResults = result;

        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    createAgentResultElement(agentName, result) {
        const div = document.createElement('div');
        div.className = 'agent-result';

        const header = document.createElement('div');
        header.className = 'agent-result-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'agent-name';
        nameSpan.textContent = this.formatAgentName(agentName);

        const typeSpan = document.createElement('span');
        typeSpan.className = 'agent-type';
        typeSpan.textContent = result.type || 'result';

        header.appendChild(nameSpan);
        header.appendChild(typeSpan);

        const content = document.createElement('div');
        content.className = 'agent-result-content';

        // Format different types of agent results
        if (result.content) {
            content.innerHTML = this.formatMultiAgentContent(result.content);
        } else if (result.recommendations) {
            content.innerHTML = this.formatMultiAgentContent(result.recommendations);
        } else if (result.analysis) {
            content.innerHTML = this.formatMultiAgentContent(result.analysis);
        } else if (typeof result === 'string') {
            content.innerHTML = this.formatMultiAgentContent(result);
        } else {
            content.innerHTML = this.formatMultiAgentContent(JSON.stringify(result, null, 2));
        }

        div.appendChild(header);
        div.appendChild(content);

        return div;
    }

    formatAgentName(agentName) {
        const nameMap = {
            'content_creator': 'Content Creator',
            'hashtag_specialist': 'Hashtag Specialist',
            'engagement_optimizer': 'Engagement Optimizer',
            'trend_analyst': 'Trend Analyst',
            'scheduler': 'Scheduler',
            'ContentCreator': 'Content Creator',
            'HashtagSpecialist': 'Hashtag Specialist',
            'EngagementOptimizer': 'Engagement Optimizer',
            'TrendAnalyst': 'Trend Analyst',
            'Scheduler': 'Scheduler'
        };

        return nameMap[agentName] || agentName;
    }

    formatMultiAgentContent(content) {
        if (!content) return '';

        // Convert string to HTML with basic formatting
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
            .replace(/^- (.*)$/gm, '<li>$1</li>') // List items
            .replace(/`{3}([\s\S]*?)`{3}/g, '<pre><code>$1</code></pre>') // Code blocks
            .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
            .replace(/\n\n/g, '</p><p>') // Paragraphs
            .replace(/\n/g, '<br>'); // Line breaks

        // Wrap in paragraph tags if list items are present
        if (formatted.includes('<li>')) {
            formatted = formatted.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
        }

        // Wrap in paragraph tags
        if (!formatted.startsWith('<')) {
            formatted = `<p>${formatted}</p>`;
        }

        return formatted;
    }

    async refreshAgentStatus() {
        try {
            const response = await fetch('/api/agents/status');
            const statusData = await response.json();

            if (response.ok && statusData.success) {
                this.updateAgentStatusDisplay(statusData);
            } else {
                throw new Error(statusData.error || 'Failed to get agent status');
            }
        } catch (error) {
            console.error('❌ Failed to refresh agent status:', error);
            this.showToast('Failed to refresh agent status', 'error');
        }
    }

    updateAgentStatusDisplay(statusData) {
        const activeAgentsEl = document.getElementById('active-agents');
        const systemHealthEl = document.getElementById('system-health');
        const workflowsCompletedEl = document.getElementById('workflows-completed');

        if (activeAgentsEl) {
            const agentCount = statusData.system?.agents?.totalAgents || 0;
            activeAgentsEl.textContent = agentCount;
        }

        if (systemHealthEl) {
            const health = statusData.system?.agents?.systemHealth || 'unknown';
            systemHealthEl.textContent = health;
            systemHealthEl.className = `stat-value status-${health}`;
        }

        if (workflowsCompletedEl) {
            const completed = statusData.system?.orchestrator?.completedWorkflows || 0;
            workflowsCompletedEl.textContent = completed;
        }

        console.log('📊 Agent status updated:', statusData);
    }

    useMultiAgentContent() {
        const useContentBtn = document.getElementById('use-content');
        const content = useContentBtn?.dataset.content;

        if (!content) {
            this.showToast('No content available to use', 'warning');
            return;
        }

        // Extract the main tweet content from the strategy
        const tweetContent = this.extractTweetFromStrategy(content);

        // Switch to queue tab and populate compose area
        this.switchTab('queue');
        
        const composeTextarea = document.getElementById('new-tweet-content');
        if (composeTextarea) {
            composeTextarea.value = tweetContent;
            this.handleComposeInput({ target: composeTextarea });
            composeTextarea.focus();
        }

        this.showToast('Content added to compose area!', 'success');
    }

    extractTweetFromStrategy(strategy) {
        // Simple extraction - look for tweet content patterns
        const lines = strategy.split('\n');
        
        // Look for lines that look like tweets (short, hashtags, emojis)
        for (const line of lines) {
            const cleaned = line.trim().replace(/^[*-]\s*/, '');
            if (cleaned.length > 20 && cleaned.length <= 280 && 
                (cleaned.includes('#') || cleaned.includes('🎵') || cleaned.includes('DJ'))) {
                return cleaned;
            }
        }

        // Fallback: take first substantial line
        for (const line of lines) {
            const cleaned = line.trim().replace(/^[*-]\s*/, '');
            if (cleaned.length > 20 && cleaned.length <= 280) {
                return cleaned;
            }
        }

        return strategy.substring(0, 280).trim();
    }

    refineMultiAgentResults() {
        if (!this.lastMultiAgentResults) {
            this.showToast('No results to refine', 'warning');
            return;
        }

        // Switch back to input area with current results as context
        const input = document.getElementById('multi-agent-input');
        if (input) {
            const currentValue = input.value;
            input.value = `${currentValue}\n\nPlease refine and improve the above results.`;
            input.focus();
        }

        this.showToast('Ready to refine results - please provide additional guidance', 'info');
    }

    saveMultiAgentStrategy() {
        if (!this.lastMultiAgentResults) {
            this.showToast('No strategy to save', 'warning');
            return;
        }

        // Create a downloadable strategy file
        const strategy = {
            timestamp: new Date().toISOString(),
            workflow: this.lastMultiAgentResults.workflow,
            agents: this.lastMultiAgentResults.agents,
            results: this.lastMultiAgentResults.results,
            finalOutput: this.lastMultiAgentResults.finalOutput
        };

        const blob = new Blob([JSON.stringify(strategy, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `twitter-strategy-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Strategy saved successfully!', 'success');
    }

    clearMultiAgent() {
        const input = document.getElementById('multi-agent-input');
        const results = document.getElementById('multi-agent-results');

        if (input) {
            input.value = '';
        }

        if (results) {
            results.style.display = 'none';
        }

        // Clear workflow selection
        document.querySelectorAll('.workflow-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        this.selectedWorkflow = null;
        this.lastMultiAgentResults = null;

        this.showToast('Multi-agent interface cleared', 'info');
    }

    // ============================================================================
    // VIDEO GENERATION FUNCTIONALITY
    // ============================================================================

    initializeVideoGeneration() {
        // Load available artists
        this.loadAvailableArtists();
        
        // Setup video generation event listeners
        const quickVideoBtn = document.getElementById('generate-quick-video');
        const customVideoBtn = document.getElementById('generate-custom-video');
        const regenerateBtn = document.getElementById('regenerate-video');
        const refreshHistoryBtn = document.getElementById('refresh-video-history');
        const testPipelineBtn = document.getElementById('test-pipeline');
        const refreshArtistsBtn = document.getElementById('refresh-artists');
        const testComponentsBtn = document.getElementById('test-components');
        const cleanupBtn = document.getElementById('cleanup-video-files');

        if (quickVideoBtn) {
            quickVideoBtn.addEventListener('click', () => this.generateQuickVideo());
        }

        if (customVideoBtn) {
            customVideoBtn.addEventListener('click', () => this.generateCustomVideo());
        }

        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => this.regenerateVideo());
        }

        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', () => this.loadVideoHistory());
        }

        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => this.cleanupVideoFiles());
        }

        if (refreshArtistsBtn) {
            refreshArtistsBtn.addEventListener('click', () => {
                console.log('🔄 Manual artist refresh requested');
                refreshArtistsBtn.textContent = '⏳';
                refreshArtistsBtn.disabled = true;
                
                this.loadAvailableArtists().then(() => {
                    refreshArtistsBtn.textContent = '🔄';
                    refreshArtistsBtn.disabled = false;
                    this.showToast('✅ Artists refreshed successfully!', 'success');
                }).catch((error) => {
                    refreshArtistsBtn.textContent = '🔄';
                    refreshArtistsBtn.disabled = false;
                    this.showToast('❌ Failed to refresh artists', 'error');
                    console.error('Failed to refresh artists:', error);
                });
            });
        }

        // Load video history on initialization
        this.loadVideoHistory();
    }

    async loadAvailableArtists() {
        console.log('🎵 Loading available artists...');
        try {
            const response = await fetch('/api/video/artists');
            console.log('📡 API response status:', response.status);
            
            const data = await response.json();
            console.log('📊 API data received:', data);

            if (data.success) {
                console.log(`✅ Successfully loaded ${data.artists.length} artists`);
                this.populateArtistSelect(data.artists);
                this.displayArtistsGrid(data.artists);
            } else {
                console.warn('Failed to load artists:', data.error);
            }
        } catch (error) {
            console.error('Error loading artists:', error);
        }
    }

    populateArtistSelect(artists, retryCount = 0) {
        console.log(`🎨 Populating artist select dropdown (attempt ${retryCount + 1})...`);
        const artistSelect = document.getElementById('video-artist');
        
        if (!artistSelect) {
            console.error(`❌ Could not find video-artist dropdown element (attempt ${retryCount + 1})`);
            
            // Retry up to 3 times with increasing delays
            if (retryCount < 3) {
                const delay = (retryCount + 1) * 200; // 200ms, 400ms, 600ms
                console.log(`🔄 Retrying in ${delay}ms...`);
                setTimeout(() => {
                    this.populateArtistSelect(artists, retryCount + 1);
                }, delay);
            } else {
                console.error('❌ Failed to find dropdown element after 3 attempts');
            }
            return;
        }

        console.log('📋 Found dropdown element, adding options...');

        // Clear existing options except "random"
        artistSelect.innerHTML = `<option value="random">🎲 Random Artist</option>`;

        // Add artist options
        artists.forEach((artist, index) => {
            const option = document.createElement('option');
            option.value = artist.name;
            option.textContent = `🎤 ${artist.name} (${artist.genre}) - ${artist.mixCount} mixes`;
            artistSelect.appendChild(option);
            console.log(`➕ Added artist ${index + 1}: ${artist.name}`);
        });

        console.log(`✅ Populated artist select with ${artists.length} real artists from Arweave network`);
        console.log('🔍 Final dropdown innerHTML:', artistSelect.innerHTML.substring(0, 200) + '...');
    }

    displayArtistsGrid(artists) {
        const artistsGrid = document.getElementById('artists-grid');
        if (!artistsGrid) return;

        artistsGrid.innerHTML = '';

        artists.forEach(artist => {
            const artistCard = document.createElement('div');
            artistCard.className = 'artist-card';
            artistCard.innerHTML = `
                <div class="artist-name">${artist.name}</div>
                <div class="artist-genre">${artist.genre}</div>
                <div class="artist-mixes">${artist.mixCount} mix${artist.mixCount !== 1 ? 'es' : ''}</div>
            `;
            artistsGrid.appendChild(artistCard);
        });
    }

    async generateQuickVideo() {
        const quickVideoBtn = document.getElementById('generate-quick-video');
        const generateText = quickVideoBtn?.querySelector('.generate-text');
        const generateLoading = quickVideoBtn?.querySelector('.generate-loading');

        // Get form values for quick video
        const artist = document.getElementById('video-artist')?.value || 'random';
        const duration = parseInt(document.getElementById('video-duration')?.value) || 30;

        console.log(`🚀 Quick video generation starting: ${artist}, ${duration}s`);

        try {
            this.setVideoGenerationLoading(true, quickVideoBtn, generateText, generateLoading);

            const response = await fetch('/api/video/quick', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    artist: artist,
                    duration: duration
                })
            });

            const data = await response.json();
            console.log('Quick video response:', data);

            if (data.success) {
                this.displayVideoResult(data.video, data.workflow, data.metadata);
                this.showToast('Quick video generated successfully!', 'success');
                this.loadVideoHistory(); // Refresh history
            } else {
                throw new Error(data.error || 'Failed to generate quick video');
            }
        } catch (error) {
            console.error('Quick video generation error:', error);
            this.showToast(`Quick video generation failed: ${error.message}`, 'error');
        } finally {
            this.setVideoGenerationLoading(false, quickVideoBtn, generateText, generateLoading);
        }
    }

    async generateCustomVideo() {
        const customVideoBtn = document.getElementById('generate-custom-video');
        const generateText = customVideoBtn?.querySelector('.generate-text');
        const generateLoading = customVideoBtn?.querySelector('.generate-loading');

        // Get form values
        const prompt = document.getElementById('video-prompt')?.value?.trim();
        const artist = document.getElementById('video-artist')?.value || 'random';
        const duration = parseInt(document.getElementById('video-duration')?.value) || 30;
        const style = document.getElementById('video-style')?.value || 'classic';

        if (!prompt) {
            this.showToast('Please describe your video before generating', 'warning');
            return;
        }

        try {
            this.setVideoGenerationLoading(true, customVideoBtn, generateText, generateLoading);

            console.log(`🎬 Custom video generation starting:`, { prompt, artist, duration, style });

            const response = await fetch('/api/video/custom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt,
                    artist,
                    duration,
                    style
                })
            });

            const data = await response.json();

            if (data.success) {
                this.displayVideoResult(data.video, data.workflow, data.metadata);
                this.showToast('Custom video generated successfully!', 'success');
                this.loadVideoHistory(); // Refresh history
            } else {
                throw new Error(data.error || 'Failed to generate custom video');
            }
        } catch (error) {
            console.error('Custom video generation error:', error);
            this.showToast(`Custom video generation failed: ${error.message}`, 'error');
        } finally {
            this.setVideoGenerationLoading(false, customVideoBtn, generateText, generateLoading);
        }
    }

    regenerateVideo() {
        // Use the same settings as the last generation
        const prompt = document.getElementById('video-prompt')?.value?.trim();
        if (prompt) {
            this.generateCustomVideo();
        } else {
            this.generateQuickVideo();
        }
    }

    displayVideoResult(videoData, workflow, metadata) {
        const resultsSection = document.getElementById('video-results');
        if (!resultsSection) return;

        // Show results section
        resultsSection.style.display = 'block';

        // Update video info
        const artistSpan = document.getElementById('result-video-artist');
        const durationSpan = document.getElementById('result-video-duration');
        const workflowSpan = document.getElementById('result-video-workflow');

        if (artistSpan) artistSpan.textContent = `🎤 ${videoData.artist || 'Unknown'}`;
        if (durationSpan) durationSpan.textContent = `⏱️ ${videoData.duration || 30}s`;
        if (workflowSpan) workflowSpan.textContent = `🔄 ${workflow || 'simple'}`;

        // Update video preview
        const videoTitle = document.getElementById('video-title');
        const videoSubtitle = document.getElementById('video-subtitle');

        if (videoTitle) videoTitle.textContent = `${videoData.artist || 'Sample Artist'} Video`;
        if (videoSubtitle) videoSubtitle.textContent = `${videoData.duration || 30}s • ${workflow || 'simple'} workflow`;

        // Update video details
        document.getElementById('detail-artist').textContent = videoData.artist || 'Unknown';
        document.getElementById('detail-duration').textContent = `${videoData.duration || 30} seconds`;
        document.getElementById('detail-style').textContent = videoData.metadata?.style || 'classic';
        document.getElementById('detail-workflow').textContent = videoData.workflow || workflow || 'simple';
        document.getElementById('detail-created').textContent = new Date().toLocaleString();

        // Enable action buttons (mock for now)
        const downloadBtn = document.getElementById('download-video');
        const shareBtn = document.getElementById('share-video');

        if (downloadBtn) {
            downloadBtn.disabled = videoData.mock !== false; // Enable only for real videos
            downloadBtn.title = videoData.mock ? 'Download not available for mock videos' : 'Download video file';
        }

        if (shareBtn) {
            shareBtn.disabled = videoData.mock !== false; // Enable only for real videos
            shareBtn.title = videoData.mock ? 'Share not available for mock videos' : 'Share video';
        }

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async loadVideoHistory() {
        try {
            const response = await fetch('/api/video/history');
            const data = await response.json();

            const historyContainer = document.getElementById('video-history');
            if (!historyContainer) return;

            if (data.success && data.videos.length > 0) {
                historyContainer.innerHTML = '';
                
                data.videos.forEach(video => {
                    const videoItem = document.createElement('div');
                    videoItem.className = 'history-item';
                    videoItem.innerHTML = `
                        <div class="history-video">
                            <div class="history-icon">🎬</div>
                            <div class="history-details">
                                <div class="history-filename">${video.filename}</div>
                                <div class="history-date">${new Date(video.created).toLocaleString()}</div>
                            </div>
                        </div>
                    `;
                    historyContainer.appendChild(videoItem);
                });
            } else {
                historyContainer.innerHTML = `
                    <div class="history-empty">
                        <p>No videos generated yet. Create your first video above!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading video history:', error);
            this.showToast('Failed to load video history', 'warning');
        }
    }

    async cleanupVideoFiles() {
        try {
            const response = await fetch('/api/video/cleanup', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Video cleanup completed successfully', 'success');
            } else {
                throw new Error(data.error || 'Cleanup failed');
            }
        } catch (error) {
            console.error('Cleanup error:', error);
            this.showToast(`Cleanup failed: ${error.message}`, 'error');
        }
    }

    setVideoGenerationLoading(loading, button, textElement, loadingElement) {
        if (button) {
            button.disabled = loading;
        }

        if (textElement) {
            textElement.style.display = loading ? 'none' : 'inline';
        }

        if (loadingElement) {
            loadingElement.style.display = loading ? 'inline' : 'none';
        }
    }

    // ============================================================================
    // AUDIO GENERATION FUNCTIONALITY
    // ============================================================================

    initializeAudioGeneration() {
        console.log('🎵 Initializing audio generation...');
        
        // Load available artists for audio generation
        this.loadAudioArtists();
        
        // Setup audio generation event listeners
        const generateAudioBtn = document.getElementById('generate-audio-btn');
        const getMetadataBtn = document.getElementById('get-metadata-btn');
        const randomArtistBtn = document.getElementById('random-artist-btn');
        const loadAllArtistsBtn = document.getElementById('load-all-artists');
        const refreshAudioHistoryBtn = document.getElementById('refresh-audio-history');
        const cleanupAudioBtn = document.getElementById('cleanup-audio-files');
        
        // Action buttons
        const downloadAudioBtn = document.getElementById('download-audio');
        const copyAudioLinkBtn = document.getElementById('copy-audio-link');
        const regenerateAudioBtn = document.getElementById('regenerate-audio');

        if (generateAudioBtn) {
            generateAudioBtn.addEventListener('click', () => this.generateAudioClip());
        }

        if (getMetadataBtn) {
            getMetadataBtn.addEventListener('click', () => this.getArtistMetadata());
        }

        if (randomArtistBtn) {
            randomArtistBtn.addEventListener('click', () => this.getRandomArtistInfo());
        }

        if (loadAllArtistsBtn) {
            loadAllArtistsBtn.addEventListener('click', () => this.loadAllArtistsMetadata());
        }

        if (refreshAudioHistoryBtn) {
            refreshAudioHistoryBtn.addEventListener('click', () => this.loadAudioHistory());
        }

        if (cleanupAudioBtn) {
            cleanupAudioBtn.addEventListener('click', () => this.cleanupAudioFiles());
        }

        if (downloadAudioBtn) {
            downloadAudioBtn.addEventListener('click', () => this.downloadAudio());
        }

        if (copyAudioLinkBtn) {
            copyAudioLinkBtn.addEventListener('click', () => this.copyAudioLink());
        }

        if (regenerateAudioBtn) {
            regenerateAudioBtn.addEventListener('click', () => this.regenerateAudio());
        }

        console.log('✅ Audio generation initialized');
    }

    async loadAudioArtists() {
        try {
            console.log('🎭 Loading artists for audio generation...');
            
            const response = await fetch('/api/audio/artists');
            const result = await response.json();
            
            console.log('🔍 API Response:', result);
            console.log('🔍 Response success:', result.success);
            console.log('🔍 Data success:', result.data?.success);
            console.log('🔍 Artists array:', result.data?.artists);
            console.log('🔍 Artists length:', result.data?.artists?.length);
            
            if (result.success && result.data.success) {
                const artists = result.data.artists;
                const audioArtistSelect = document.getElementById('audio-artist-select');
                
                console.log('🔍 Found audio-artist-select element:', !!audioArtistSelect);
                
                if (audioArtistSelect) {
                    // Clear existing options except random
                    audioArtistSelect.innerHTML = '<option value="">🎲 Random Artist</option>';
                    
                    // Add artists
                    artists.forEach(artist => {
                        const option = document.createElement('option');
                        option.value = artist.name;
                        option.textContent = `${artist.name} (${artist.totalMixes} mixes)`;
                        audioArtistSelect.appendChild(option);
                    });
                    
                    console.log(`✅ Loaded ${artists.length} artists for audio generation`);
                } else {
                    console.error('❌ audio-artist-select element not found');
                }
                
                // Update total artists count
                const totalArtistsCount = document.getElementById('total-artists-count');
                if (totalArtistsCount) {
                    totalArtistsCount.textContent = artists.length;
                }
                
            } else {
                console.error('❌ API response indicates failure:', result);
                throw new Error(result.error || 'Failed to load artists');
            }
            
        } catch (error) {
            console.error('❌ Error loading audio artists:', error);
            this.showToast('Failed to load artists: ' + error.message, 'error');
        }
    }

    async generateAudioClip() {
        try {
            console.log('🎵 Generating audio clip...');
            
            const artist = document.getElementById('audio-artist-select').value;
            const duration = parseInt(document.getElementById('audio-duration').value) || 15;
            const fadeIn = parseFloat(document.getElementById('audio-fade-in').value) || 2;
            const fadeOut = parseFloat(document.getElementById('audio-fade-out').value) || 2;
            
            // Show loading state
            this.showAudioLoading(true);
            this.updateAudioStatus('⏳', 'Generating audio clip...');
            
            const response = await fetch('/api/audio/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    artist: artist || null,
                    duration,
                    fadeIn,
                    fadeOut
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.audio) {
                console.log('✅ Audio generated successfully');
                this.displayAudioResult(result.audio, result.metadata);
                this.updateAudioStatus('✅', 'Audio generated successfully!');
                this.showToast(`Audio clip generated: ${result.audio.artist} - ${result.audio.mixTitle}`, 'success');
            } else {
                throw new Error(result.error || 'Audio generation failed');
            }
            
        } catch (error) {
            console.error('❌ Audio generation error:', error);
            this.updateAudioStatus('❌', 'Audio generation failed');
            this.showToast('Audio generation failed: ' + error.message, 'error');
        } finally {
            this.showAudioLoading(false);
        }
    }

    async getArtistMetadata() {
        try {
            console.log('📋 Getting artist metadata...');
            
            const artist = document.getElementById('audio-artist-select').value;
            
            // Show loading state
            this.showAudioLoading(true);
            this.updateAudioStatus('⏳', 'Fetching artist metadata...');
            
            const response = await fetch('/api/audio/metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    artist: artist || null
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data) {
                console.log('✅ Metadata retrieved successfully');
                this.displayArtistMetadata(result.data);
                this.updateAudioStatus('✅', 'Metadata retrieved successfully!');
                this.showToast(`Metadata retrieved: ${result.data.artist}`, 'success');
            } else {
                throw new Error(result.error || 'Metadata retrieval failed');
            }
            
        } catch (error) {
            console.error('❌ Metadata retrieval error:', error);
            this.updateAudioStatus('❌', 'Metadata retrieval failed');
            this.showToast('Metadata retrieval failed: ' + error.message, 'error');
        } finally {
            this.showAudioLoading(false);
        }
    }

    async getRandomArtistInfo() {
        try {
            console.log('🎲 Getting random artist info...');
            
            // Clear artist selection to ensure random
            document.getElementById('audio-artist-select').value = '';
            
            // Use metadata endpoint for random artist
            await this.getArtistMetadata();
            
        } catch (error) {
            console.error('❌ Random artist info error:', error);
            this.showToast('Failed to get random artist info: ' + error.message, 'error');
        }
    }

    async loadAllArtistsMetadata() {
        try {
            console.log('🎭 Loading all artists metadata...');
            
            const loadButton = document.getElementById('load-all-artists');
            if (loadButton) {
                loadButton.textContent = '⏳';
                loadButton.disabled = true;
            }
            
            const response = await fetch('/api/audio/artists');
            const result = await response.json();
            
            if (result.success && result.data.success) {
                this.displayAllArtistsMetadata(result.data.artists);
                this.showToast(`Loaded metadata for ${result.data.totalArtists} artists`, 'success');
            } else {
                throw new Error(result.error || 'Failed to load all artists metadata');
            }
            
        } catch (error) {
            console.error('❌ Error loading all artists metadata:', error);
            this.showToast('Failed to load artists metadata: ' + error.message, 'error');
        } finally {
            const loadButton = document.getElementById('load-all-artists');
            if (loadButton) {
                loadButton.textContent = '🔄 Load Artists';
                loadButton.disabled = false;
            }
        }
    }

    displayAudioResult(audio, metadata) {
        // Show results section
        const resultsSection = document.getElementById('audio-results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
        
        // Update audio info
        document.getElementById('audio-artist-name').textContent = audio.artist;
        document.getElementById('audio-mix-title').textContent = audio.mixTitle;
        document.getElementById('audio-duration-display').textContent = this.formatDuration(audio.duration);
        document.getElementById('audio-file-size').textContent = audio.fileSize;
        
        // Setup audio player
        const audioPlayer = document.getElementById('audio-player');
        if (audioPlayer && audio.url) {
            audioPlayer.src = audio.url;
            audioPlayer.style.display = 'block';
        }
        
        // Update metadata
        if (metadata) {
            document.getElementById('meta-artist').textContent = audio.artist;
            document.getElementById('meta-mix').textContent = audio.mixTitle;
            document.getElementById('meta-duration').textContent = audio.duration + 's';
            document.getElementById('meta-year').textContent = metadata.generated ? new Date(metadata.generated).getFullYear() : '-';
            document.getElementById('meta-genre').textContent = metadata.genre || '-';
            
            const arweaveLink = document.getElementById('meta-arweave-url');
            if (arweaveLink && metadata.arweaveUrl) {
                arweaveLink.href = metadata.arweaveUrl;
                arweaveLink.textContent = 'View on Arweave';
            }
        }
        
        // Enable action buttons
        document.getElementById('download-audio').disabled = false;
        document.getElementById('copy-audio-link').disabled = false;
        
        // Store current audio data
        this.currentAudio = audio;
    }

    displayArtistMetadata(data) {
        // Show results section
        const resultsSection = document.getElementById('audio-results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
        
        // Hide audio player for metadata-only requests
        const audioPlayer = document.getElementById('audio-player');
        if (audioPlayer) {
            audioPlayer.style.display = 'none';
        }
        
        // Update artist info (metadata-only display)
        document.getElementById('audio-artist-name').textContent = data.artist;
        document.getElementById('audio-mix-title').textContent = data.mixTitle;
        document.getElementById('audio-duration-display').textContent = data.mixDuration;
        document.getElementById('audio-file-size').textContent = 'Metadata Only';
        
        // Update detailed metadata
        document.getElementById('meta-artist').textContent = data.artist;
        document.getElementById('meta-mix').textContent = data.mixTitle;
        document.getElementById('meta-duration').textContent = data.mixDuration;
        document.getElementById('meta-year').textContent = data.mixDateYear || '-';
        document.getElementById('meta-genre').textContent = data.mixGenre || '-';
        
        const arweaveLink = document.getElementById('meta-arweave-url');
        if (arweaveLink && data.arweaveUrl) {
            arweaveLink.href = data.arweaveUrl;
            arweaveLink.textContent = 'View on Arweave';
        }
        
        // Disable download/copy for metadata-only
        document.getElementById('download-audio').disabled = true;
        document.getElementById('copy-audio-link').disabled = true;
        
        // Clear current audio data
        this.currentAudio = null;
    }

    displayAllArtistsMetadata(artists) {
        const artistsOverview = document.getElementById('artists-overview');
        if (!artistsOverview) return;
        
        artistsOverview.innerHTML = '';
        
        artists.forEach(artist => {
            const artistCard = document.createElement('div');
            artistCard.className = 'artist-metadata-card';
            artistCard.innerHTML = `
                <div class="artist-header">
                    <h5>${artist.name}</h5>
                    <span class="artist-genre">${artist.genre}</span>
                </div>
                <div class="artist-stats">
                    <span class="stat-item">📼 ${artist.totalMixes} mixes</span>
                </div>
                <div class="artist-mixes">
                    ${artist.mixes.slice(0, 3).map(mix => `
                        <div class="mix-item">
                            <span class="mix-title">${mix.title}</span>
                            <span class="mix-duration">${mix.duration}</span>
                        </div>
                    `).join('')}
                    ${artist.mixes.length > 3 ? `<div class="mix-item">... and ${artist.mixes.length - 3} more</div>` : ''}
                </div>
            `;
            artistsOverview.appendChild(artistCard);
        });
    }

    showAudioLoading(loading) {
        const generateBtn = document.getElementById('generate-audio-btn');
        const metadataBtn = document.getElementById('get-metadata-btn');
        const randomBtn = document.getElementById('random-artist-btn');

        if (generateBtn) {
            generateBtn.disabled = loading;
            generateBtn.textContent = loading ? '⏳ Generating...' : '🎵 Generate Audio Clip';
        }

        if (metadataBtn) {
            metadataBtn.disabled = loading;
            metadataBtn.textContent = loading ? '⏳ Loading...' : '📋 Get Artist Info Only';
        }

        if (randomBtn) {
            randomBtn.disabled = loading;
            randomBtn.textContent = loading ? '⏳ Loading...' : '🎲 Random Artist Info';
        }
    }

    updateAudioStatus(indicator, text) {
        const statusIndicator = document.querySelector('#audio-status .status-indicator');
        const statusText = document.querySelector('#audio-status .status-text');
        
        if (statusIndicator) statusIndicator.textContent = indicator;
        if (statusText) statusText.textContent = text;
    }

    downloadAudio() {
        if (this.currentAudio && this.currentAudio.url) {
            const link = document.createElement('a');
            link.href = this.currentAudio.url;
            link.download = this.currentAudio.filename || 'audio-clip.m4a';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showToast('Audio download started', 'success');
        }
    }

    copyAudioLink() {
        if (this.currentAudio && this.currentAudio.url) {
            const fullUrl = window.location.origin + this.currentAudio.url;
            navigator.clipboard.writeText(fullUrl).then(() => {
                this.showToast('Audio link copied to clipboard', 'success');
            }).catch(() => {
                this.showToast('Failed to copy link', 'error');
            });
        }
    }

    regenerateAudio() {
        this.generateAudioClip();
    }

    async loadAudioHistory() {
        // This would load recent audio files from the server
        console.log('🔄 Loading audio history...');
        // Implementation would be similar to video history
    }

    async cleanupAudioFiles() {
        try {
            console.log('🧹 Cleaning up audio files...');
            this.showToast('Audio cleanup functionality would be implemented here', 'info');
        } catch (error) {
            console.error('❌ Audio cleanup error:', error);
            this.showToast('Audio cleanup failed: ' + error.message, 'error');
        }
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ============================================================================
    // IMAGE GENERATION
    // ============================================================================

    initializeImageGeneration() {
        console.log('🖼️ Initializing image generation...');
        
        // Setup image generation event listeners
        const quickImageBtn = document.getElementById('generate-quick-image');
        const customImageBtn = document.getElementById('generate-custom-image');
        const refreshHistoryBtn = document.getElementById('refresh-image-history');
        const cleanupBtn = document.getElementById('cleanup-image-files');

        if (quickImageBtn) {
            quickImageBtn.addEventListener('click', () => this.generateQuickImage());
        }

        if (customImageBtn) {
            customImageBtn.addEventListener('click', () => this.generateCustomImage());
        }

        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', () => this.loadImageHistory());
        }

        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => this.cleanupImageFiles());
        }

        // Load image history on initialization
        this.loadImageHistory();
    }

    async generateQuickImage() {
        console.log('⚡ Generating quick image...');
        
        const button = document.getElementById('generate-quick-image');
        const textElement = button.querySelector('.generate-text');
        const loadingElement = button.querySelector('.generate-loading');
        
        this.setImageGenerationLoading(true, button, textElement, loadingElement);
        
        try {
            const response = await fetch('/api/image/quick', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Quick image generated successfully:', data.image);
                this.displayImageResult(data.image, 'quick', data.metadata);
                this.showToast('✅ Quick image generated successfully!', 'success');
            } else {
                console.error('❌ Quick image generation failed:', data.error);
                this.showToast(`❌ Image generation failed: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Quick image generation error:', error);
            this.showToast('❌ Failed to generate image', 'error');
        } finally {
            this.setImageGenerationLoading(false, button, textElement, loadingElement);
        }
    }

    async generateCustomImage() {
        console.log('🎨 Generating custom image...');
        
        const prompt = document.getElementById('image-prompt').value.trim();
        const style = document.getElementById('image-style').value;
        const size = document.getElementById('image-size').value;
        const quality = document.getElementById('image-quality').value;
        
        if (!prompt) {
            this.showToast('❌ Please enter an image prompt', 'error');
            return;
        }
        
        const button = document.getElementById('generate-custom-image');
        const textElement = button.querySelector('.generate-text');
        const loadingElement = button.querySelector('.generate-loading');
        
        this.setImageGenerationLoading(true, button, textElement, loadingElement);
        
        try {
            const response = await fetch('/api/image/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt,
                    style,
                    size,
                    quality
                })
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Custom image generated successfully:', data.image);
                this.displayImageResult(data.image, 'custom', data.metadata);
                this.showToast('✅ Custom image generated successfully!', 'success');
            } else {
                console.error('❌ Custom image generation failed:', data.error);
                this.showToast(`❌ Image generation failed: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Custom image generation error:', error);
            this.showToast('❌ Failed to generate image', 'error');
        } finally {
            this.setImageGenerationLoading(false, button, textElement, loadingElement);
        }
    }

    displayImageResult(image, workflow, metadata) {
        console.log('🖼️ Displaying image result:', image);
        
        const resultsContainer = document.getElementById('image-results');
        const imageElement = document.getElementById('generated-image');
        const promptElement = document.getElementById('result-image-prompt');
        const sizeElement = document.getElementById('result-image-size');
        const styleElement = document.getElementById('result-image-style');
        
        // Update image display
        imageElement.src = image.imageUrl;
        imageElement.alt = `Generated image: ${image.prompt}`;
        
        // Update metadata
        promptElement.textContent = image.prompt;
        sizeElement.textContent = image.dimensions;
        styleElement.textContent = metadata.style;
        
        // Update detailed metadata
        document.getElementById('meta-image-dimensions').textContent = image.dimensions;
        document.getElementById('meta-image-size').textContent = image.fileSize;
        document.getElementById('meta-image-style').textContent = metadata.style;
        document.getElementById('meta-image-url').textContent = image.imageUrl;
        
        // Show results
        resultsContainer.style.display = 'block';
        
        // Setup action buttons
        this.setupImageActionButtons(image);
    }

    setupImageActionButtons(image) {
        // Download button
        const downloadBtn = document.getElementById('download-image');
        downloadBtn.onclick = () => this.downloadImage(image);
        
        // Share button
        const shareBtn = document.getElementById('share-image');
        shareBtn.onclick = () => this.copyImageLink(image);
        
        // Use in video button
        const useInVideoBtn = document.getElementById('use-in-video');
        useInVideoBtn.onclick = () => this.useImageInVideo(image);
        
        // Use in tweet button
        const useInTweetBtn = document.getElementById('use-in-tweet');
        useInTweetBtn.onclick = () => this.useImageInTweet(image);
    }

    downloadImage(image) {
        const link = document.createElement('a');
        link.href = image.imageUrl;
        link.download = image.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('✅ Image download started', 'success');
    }

    copyImageLink(image) {
        const fullUrl = `${window.location.origin}${image.imageUrl}`;
        navigator.clipboard.writeText(fullUrl).then(() => {
            this.showToast('✅ Image link copied to clipboard', 'success');
        }).catch(() => {
            this.showToast('❌ Failed to copy link', 'error');
        });
    }

    useImageInVideo(image) {
        // Switch to video tab and pre-fill with image context
        this.showTab('video');
        this.showToast('🎬 Switched to video generation. Image will be used as background.', 'info');
        
        // Store image context for video generation
        window.imageContextForVideo = {
            backgroundImage: image.imagePath,
            backgroundUrl: image.imageUrl,
            prompt: image.prompt
        };
    }

    useImageInTweet(image) {
        // Switch to queue tab and pre-fill with image
        this.showTab('queue');
        this.showToast('📝 Switched to tweet composition. Image will be added to media.', 'info');
        
        // Add image to media uploads
        const mediaFile = {
            id: `img_${Date.now()}`,
            name: image.fileName,
            type: 'image/png',
            size: 0, // Will be updated when actually uploaded
            url: image.imageUrl,
            isGenerated: true
        };
        
        this.addMediaFile(mediaFile);
    }

    setImageGenerationLoading(loading, button, textElement, loadingElement) {
        if (loading) {
            button.disabled = true;
            textElement.style.display = 'none';
            loadingElement.style.display = 'inline';
        } else {
            button.disabled = false;
            textElement.style.display = 'inline';
            loadingElement.style.display = 'none';
        }
    }

    async loadImageHistory() {
        console.log('📚 Loading image history...');
        
        try {
            const response = await fetch('/api/image/history');
            const data = await response.json();
            
            if (data.success) {
                this.displayImageHistory(data.images);
            } else {
                console.error('Failed to load image history:', data.error);
            }
        } catch (error) {
            console.error('Error loading image history:', error);
        }
    }

    displayImageHistory(images) {
        const historyContainer = document.getElementById('image-history');
        
        if (images.length === 0) {
            historyContainer.innerHTML = `
                <div class="history-empty">
                    <p>No images generated yet. Create your first image above!</p>
                </div>
            `;
            return;
        }
        
        const historyHTML = images.map(image => `
            <div class="history-item">
                <div class="history-image">
                    <img src="${image.fileUrl}" alt="Generated image" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                </div>
                <div class="history-details">
                    <div class="history-name">${image.fileName}</div>
                    <div class="history-meta">${image.fileSize} • ${new Date(image.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="history-actions">
                    <button onclick="dashboard.downloadImage({imageUrl: '${image.fileUrl}', fileName: '${image.fileName}'})" class="btn btn-small">💾</button>
                    <button onclick="dashboard.copyImageLink({imageUrl: '${image.fileUrl}'})" class="btn btn-small">🔗</button>
                </div>
            </div>
        `).join('');
        
        historyContainer.innerHTML = historyHTML;
    }

    async cleanupImageFiles() {
        console.log('🧹 Cleaning up image files...');
        
        try {
            const response = await fetch('/api/image/cleanup', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast(`✅ Cleaned up ${data.cleanedCount} old image files`, 'success');
                this.loadImageHistory(); // Refresh history
            } else {
                this.showToast(`❌ Cleanup failed: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Error cleaning up image files:', error);
            this.showToast('❌ Failed to cleanup image files', 'error');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TwitterBotDashboard();
}); 