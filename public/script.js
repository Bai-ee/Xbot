// Twitter Bot Dashboard Frontend Script

class TwitterBotDashboard {
    constructor() {
        this.tweets = [];
        this.currentTab = 'tweets';
        this.updateDebounceTimer = null;
        this.autoRefreshTimer = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTweets();
        this.startAutoRefresh();
        this.showTab('tweets');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.showTab(tab);
            });
        });

        // Tweet management buttons
        document.getElementById('generate-tweet')?.addEventListener('click', () => this.generateTweet());
        document.getElementById('clear-posted')?.addEventListener('click', () => this.clearPostedTweets());

        // Auto-refresh when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentTab === 'tweets') {
                this.loadTweets();
            }
        });
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
        this.showLoading(true);
        try {
            // Load analytics data
            const analyticsResponse = await fetch('/api/analytics');
            if (analyticsResponse.ok) {
                const analytics = await analyticsResponse.json();
                this.renderAnalytics(analytics);
            } else {
                console.error('Failed to load analytics');
                this.showToast('Failed to load analytics data', 'error');
            }

            // Load followers data
            const followersResponse = await fetch('/api/followers');
            if (followersResponse.ok) {
                const followers = await followersResponse.json();
                this.updateFollowersData(followers);
            }

            // Load recent tweets with rate limit handling
            try {
                const recentResponse = await fetch('/api/recent-tweets');
                if (recentResponse.ok) {
                    const recentTweets = await recentResponse.json();
                    this.renderRecentTweets(recentTweets);
                } else if (recentResponse.status === 429) {
                    this.showRecentTweetsRateLimit();
                }
            } catch (error) {
                console.log('Recent tweets unavailable due to rate limits');
                this.showRecentTweetsRateLimit();
            }

        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showToast('Network error loading analytics', 'error');
        } finally {
            this.showLoading(false);
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
        if (analytics.profile) {
            // Account overview
            document.getElementById('followers-count').textContent = this.formatNumber(analytics.profile.public_metrics.followers_count);
            document.getElementById('following-count').textContent = this.formatNumber(analytics.profile.public_metrics.following_count);
            document.getElementById('total-tweets-count').textContent = this.formatNumber(analytics.profile.public_metrics.tweet_count);
            document.getElementById('total-likes-count').textContent = this.formatNumber(analytics.profile.public_metrics.like_count || 0);
        }

        if (analytics.recent_engagement) {
            // Recent engagement
            document.getElementById('recent-likes').textContent = this.formatNumber(analytics.recent_engagement.total_likes);
            document.getElementById('recent-retweets').textContent = this.formatNumber(analytics.recent_engagement.total_retweets);
            document.getElementById('recent-replies').textContent = this.formatNumber(analytics.recent_engagement.total_replies);
            document.getElementById('avg-likes').textContent = this.formatNumber(analytics.recent_engagement.avg_likes_per_tweet);
        }

        if (analytics.recent_tweets) {
            this.renderRecentTweets(analytics.recent_tweets);
        }
    }

    updateFollowersData(followers) {
        document.getElementById('followers-count').textContent = this.formatNumber(followers.followers_count);
        document.getElementById('following-count').textContent = this.formatNumber(followers.following_count);
        document.getElementById('total-tweets-count').textContent = this.formatNumber(followers.tweet_count);
    }

    renderRecentTweets(tweets) {
        const container = document.getElementById('recent-tweets-list');
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
            this.showToast('Network error - please check your connection', 'error');
        } finally {
            this.showLoading(false);
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

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TwitterBotDashboard();
}); 