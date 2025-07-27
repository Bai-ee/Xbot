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
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TwitterBotDashboard();
}); 