// Most Interesting Trader in the World - JavaScript

let refreshInterval;

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    refreshStatus();
    startAutoRefresh();
});

// Auto-refresh status every 10 seconds
function startAutoRefresh() {
    refreshInterval = setInterval(refreshStatus, 10000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Fetch and update bot status
async function refreshStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();

        updateUI(status);
    } catch (error) {
        console.error('Error fetching status:', error);
        showError('Failed to fetch bot status');
    }
}

// Update the UI with current status
function updateUI(status) {
    // Update status indicator
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (status.isRunning) {
        statusDot.className = 'status-dot running';
        statusText.textContent = 'Trading Active';
    } else {
        statusDot.className = 'status-dot stopped';
        statusText.textContent = status.error || 'Inactive';
    }

    // Update tagline
    if (status.config && status.config.tagline) {
        document.getElementById('tagline').textContent = status.config.tagline;
    }

    // Update balance information
    if (status.lastBalance) {
        const balance = status.lastBalance;
        document.getElementById('preferred-balance').textContent =
            `${balance.preferredTokenBalance.toFixed(4)} ${status.config?.preferredToken || ''}`;
        document.getElementById('gala-balance').textContent =
            `${balance.galaTokenBalance.toFixed(4)} GALA`;
        document.getElementById('other-tokens-count').textContent =
            balance.otherTokens.length.toString();

        // Update token list
        updateTokenList(balance.otherTokens, status.config?.preferredToken);
    }

    // Update statistics
    if (status.statistics) {
        const stats = status.statistics;
        document.getElementById('total-trades').textContent = stats.totalTrades || '0';
        document.getElementById('success-rate').textContent =
            `${(stats.successRate || 0).toFixed(1)}%`;
    }

    // Update uptime
    if (status.uptime) {
        document.getElementById('uptime').textContent = status.uptime.readable || '--';
    }

    // Update configuration
    if (status.config) {
        const config = status.config;
        document.getElementById('wallet-address').textContent =
            truncateAddress(config.walletAddress) || '--';
        document.getElementById('trade-interval').textContent =
            `${Math.floor((config.tradeInterval || 0) / 1000)}s`;
        document.getElementById('trading-enabled').textContent =
            config.tradingEnabled ? 'Enabled' : 'Disabled';
    }

    // Update recent activity
    updateRecentActivity(status.recentTrades || []);

    // Update button states
    updateButtonStates(status.isRunning);
}

// Update token holdings list
function updateTokenList(tokens, preferredToken) {
    const tokenList = document.getElementById('token-list');

    if (!tokens || tokens.length === 0) {
        tokenList.innerHTML = '<p class="no-tokens">No other tokens held</p>';
        return;
    }

    const tokenItems = tokens.map(token => `
        <div class="token-item">
            <span class="token-symbol">${token.symbol}</span>
            <span class="token-amount">${token.quantity.toFixed(4)}</span>
        </div>
    `).join('');

    tokenList.innerHTML = tokenItems;
}

// Update recent trading activity
function updateRecentActivity(trades) {
    const activityList = document.getElementById('activity-list');

    if (!trades || trades.length === 0) {
        activityList.innerHTML = '<p class="no-activity">No recent trading activity</p>';
        return;
    }

    const tradeItems = trades.slice(-5).reverse().map(trade => {
        const statusClass = trade.success ? 'success' : 'failed';
        const statusText = trade.success ? 'Success' : 'Failed';
        const time = new Date(trade.timestamp).toLocaleTimeString();

        return `
            <div class="trade-item ${statusClass}">
                <div class="trade-details">
                    <div class="trade-amount">
                        ${trade.amountIn.toFixed(4)} ${getTokenSymbol(trade.fromToken)}
                        → ${trade.amountOut ? trade.amountOut.toFixed(4) : '?'} ${getTokenSymbol(trade.toToken)}
                    </div>
                    <div class="trade-time">${time}</div>
                    ${trade.error ? `<div class="trade-error">${trade.error}</div>` : ''}
                </div>
                <div class="trade-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');

    activityList.innerHTML = tradeItems;
}

// Update button states based on bot status
function updateButtonStates(isRunning) {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    startBtn.disabled = isRunning;
    stopBtn.disabled = !isRunning;

    if (isRunning) {
        startBtn.textContent = 'Trading Active';
        stopBtn.textContent = 'Stop Trading';
    } else {
        startBtn.textContent = 'Start Trading';
        stopBtn.textContent = 'Stopped';
    }
}

// Start the trading bot
async function startBot() {
    const startBtn = document.getElementById('start-btn');
    const originalText = startBtn.textContent;

    try {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="loading"></span> Starting...';

        const response = await fetch('/api/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            showSuccess(result.message || 'Bot started successfully');
            setTimeout(refreshStatus, 1000); // Refresh after a second
        } else {
            throw new Error(result.error || 'Failed to start bot');
        }
    } catch (error) {
        console.error('Error starting bot:', error);
        showError(error.message);
        startBtn.disabled = false;
        startBtn.textContent = originalText;
    }
}

// Stop the trading bot
async function stopBot() {
    const stopBtn = document.getElementById('stop-btn');
    const originalText = stopBtn.textContent;

    try {
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<span class="loading"></span> Stopping...';

        const response = await fetch('/api/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok) {
            showSuccess(result.message || 'Bot stopped successfully');
            setTimeout(refreshStatus, 1000); // Refresh after a second
        } else {
            throw new Error(result.error || 'Failed to stop bot');
        }
    } catch (error) {
        console.error('Error stopping bot:', error);
        showError(error.message);
        stopBtn.disabled = false;
        stopBtn.textContent = originalText;
    }
}

// Utility functions
function truncateAddress(address) {
    if (!address) return '--';
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function getTokenSymbol(tokenKey) {
    if (!tokenKey) return '?';
    return tokenKey.split('|')[0] || '?';
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    // Insert after controls section
    const controlsSection = document.querySelector('.controls-section');
    controlsSection.parentNode.insertBefore(messageDiv, controlsSection.nextSibling);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Handle window visibility change (pause auto-refresh when tab is hidden)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        refreshStatus(); // Refresh immediately when tab becomes visible
    }
});