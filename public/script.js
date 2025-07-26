// Twitter Bot Dashboard Frontend Script

class TwitterBotDashboard {
    constructor() {
        this.tweets = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTweets();
        
        // Refresh data every 30 seconds
        setInterval(() => this.loadTweets(), 30000);
    }

    setupEventListeners() {
        // Generate tweet button
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateTweet();
        });

        // Clear posted tweets button
        document.getElementById('clearPostedBtn').addEventListener('click', () => {
            this.clearPostedTweets();
        });
    }

    async loadTweets() {
        try {
            const response = await fetch('/api/tweets');
            if (response.ok) {
                this.tweets = await response.json();
                this.renderTweets();
                this.updateStats();
            }
        } catch (error) {
            console.error('Error loading tweets:', error);
            // Only show error if it's a real network issue
            if (!navigator.onLine) {
                this.showToast('Network connection lost', 'error');
            }
        }
    }

    async generateTweet() {
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const newTweet = await response.json();
                this.tweets.push(newTweet);
                this.renderTweets();
                this.updateStats();
                this.showToast('New tweet generated! ✨', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate tweet');
            }
        } catch (error) {
            console.error('Error generating tweet:', error);
            this.showToast('Failed to generate tweet', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async updateTweet(id, content) {
        try {
            const response = await fetch(`/api/tweets/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });

            if (response.ok) {
                const updatedTweet = await response.json();
                const index = this.tweets.findIndex(t => t.id === id);
                if (index !== -1) {
                    this.tweets[index] = updatedTweet;
                }
                // Don't show toast for every edit - too noisy
                console.log('Tweet updated successfully');
            }
        } catch (error) {
            console.error('Error updating tweet:', error);
        }
    }

    async approveTweet(id) {
        this.showLoading(true);
        
        try {
            const response = await fetch(`/api/tweets/${id}/approve`, {
                method: 'POST'
            });

            if (response.ok) {
                // Tweet posted successfully
                const result = await response.json();
                const index = this.tweets.findIndex(t => t.id === id);
                if (index !== -1) {
                    this.tweets[index] = result.tweet;
                }
                this.renderTweets();
                this.updateStats();
                this.showToast('🎉 Tweet posted successfully to Twitter!', 'success');
            } else {
                // Only show error if tweet actually failed
                const errorData = await response.json();
                console.error('Tweet approval failed:', errorData);
                
                // Check if it's really a failure or just a warning
                if (response.status >= 500) {
                    this.showToast(`Failed to post tweet: ${errorData.error}`, 'error');
                } else if (response.status === 403) {
                    // For 403 errors, check if tweet actually went through by refreshing
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
            const response = await fetch(`/api/tweets/${id}/reject`, {
                method: 'POST'
            });

            if (response.ok) {
                this.tweets = this.tweets.filter(t => t.id !== id);
                this.renderTweets();
                this.updateStats();
                this.showToast('Tweet rejected', 'info');
            } else {
                throw new Error('Failed to reject tweet');
            }
        } catch (error) {
            console.error('Error rejecting tweet:', error);
            this.showToast('Failed to reject tweet', 'error');
        }
    }

    async clearPostedTweets() {
        if (!confirm('Are you sure you want to clear all posted tweets?')) {
            return;
        }

        try {
            const response = await fetch('/api/tweets/posted', {
                method: 'DELETE'
            });

            if (response.ok) {
                this.tweets = this.tweets.filter(t => t.status !== 'posted');
                this.renderTweets();
                this.updateStats();
                this.showToast('Posted tweets cleared', 'info');
            } else {
                throw new Error('Failed to clear posted tweets');
            }
        } catch (error) {
            console.error('Error clearing posted tweets:', error);
            this.showToast('Failed to clear posted tweets', 'error');
        }
    }

    renderTweets() {
        const container = document.getElementById('tweetsContainer');
        const emptyState = document.getElementById('emptyState');

        if (this.tweets.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort tweets: pending first, then by creation date
        const sortedTweets = [...this.tweets].sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        container.innerHTML = sortedTweets.map(tweet => this.renderTweetCard(tweet)).join('');
    }

    renderTweetCard(tweet) {
        const createdAt = new Date(tweet.createdAt).toLocaleString();
        const characterCount = tweet.content.length;
        const isOverLimit = characterCount > 280;
        
        return `
            <div class="tweet-card" data-id="${tweet.id}">
                <div class="tweet-header">
                    <div class="tweet-meta">
                        ${tweet.autoGenerated ? '🤖 Auto-generated' : '✍️ Manual'} • ${createdAt}
                    </div>
                    <span class="tweet-status status-${tweet.status}">${tweet.status}</span>
                </div>
                
                <div class="tweet-content">
                    <textarea 
                        class="tweet-textarea" 
                        ${tweet.status === 'posted' ? 'readonly' : ''}
                        placeholder="Enter your tweet content..."
                        onInput="dashboard.handleTweetInput('${tweet.id}', this.value)"
                    >${tweet.content}</textarea>
                    <div class="character-count ${isOverLimit ? 'over-limit' : ''}">
                        ${characterCount}/280 characters
                    </div>
                </div>
                
                ${tweet.status === 'pending' ? `
                    <div class="tweet-actions">
                        <button 
                            class="btn btn-danger" 
                            onclick="dashboard.rejectTweet('${tweet.id}')"
                        >
                            Reject
                        </button>
                        <button 
                            class="btn btn-success" 
                            onclick="dashboard.approveTweet('${tweet.id}')"
                            ${isOverLimit ? 'disabled' : ''}
                        >
                            ${isOverLimit ? 'Too Long' : 'Approve & Post'}
                        </button>
                    </div>
                ` : tweet.status === 'posted' ? `
                    <div class="tweet-actions">
                        <div style="color: var(--success-color); font-weight: 500;">
                            ✅ Posted ${tweet.postedAt ? new Date(tweet.postedAt).toLocaleString() : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    handleTweetInput(id, content) {
        // Debounce the update
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.updateTweet(id, content);
        }, 1000); // Increased debounce time

        // Update character count immediately
        const tweetCard = document.querySelector(`[data-id="${id}"]`);
        if (!tweetCard) return;
        
        const characterCount = content.length;
        const countElement = tweetCard.querySelector('.character-count');
        const approveButton = tweetCard.querySelector('.btn-success');
        
        if (countElement) {
            countElement.textContent = `${characterCount}/280 characters`;
            countElement.className = `character-count ${characterCount > 280 ? 'over-limit' : ''}`;
        }
        
        if (approveButton) {
            if (characterCount > 280) {
                approveButton.disabled = true;
                approveButton.textContent = 'Too Long';
            } else {
                approveButton.disabled = false;
                approveButton.textContent = 'Approve & Post';
            }
        }
    }

    updateStats() {
        const pendingCount = this.tweets.filter(t => t.status === 'pending').length;
        const today = new Date().toDateString();
        const postedTodayCount = this.tweets.filter(t => 
            t.status === 'posted' && 
            t.postedAt && 
            new Date(t.postedAt).toDateString() === today
        ).length;
        const totalCount = this.tweets.length;

        document.getElementById('pendingCount').textContent = pendingCount;
        document.getElementById('postedCount').textContent = postedTodayCount;
        document.getElementById('queueCount').textContent = totalCount;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('hidden', !show);
    }

    showToast(message, type = 'info') {
        // Clear any existing duplicate toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => {
            if (toast.textContent === message) {
                toast.remove();
            }
        });

        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);

        // Remove on click
        toast.addEventListener('click', () => {
            toast.remove();
        });
    }
}

// Global functions for onclick handlers
window.generateTweet = () => dashboard.generateTweet();

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new TwitterBotDashboard();
}); 