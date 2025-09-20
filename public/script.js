// The Most Interesting Trader in the World - Enhanced JavaScript

let refreshInterval;
let loadingOverlay;

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
    loadConfiguration();
    refreshStatus();
    startAutoRefresh();
    addAnimationClasses();
});

// Initialize UI elements
function initializeUI() {
    loadingOverlay = document.getElementById('loading-overlay');

    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    // Add intersection observer for animations
    if ('IntersectionObserver' in window) {
        observeElements();
    }
}

// Add CSS animation classes to elements as they come into view
function observeElements() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, { threshold: 0.1 });

    // Observe all cards
    document.querySelectorAll('.card').forEach(card => {
        observer.observe(card);
    });
}

// Add animation classes to existing elements
function addAnimationClasses() {
    const elements = document.querySelectorAll('.card, .hero-content');
    elements.forEach((el, index) => {
        setTimeout(() => {
            el.classList.add('fade-in');
        }, index * 100);
    });
}

// Load initial configuration
async function loadConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        updateNetworkInfo(config.gswapUrls);
        updateConfigurationDisplay(config);
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

// Update network configuration display
function updateNetworkInfo(gswapUrls) {
    if (!gswapUrls) return;

    document.getElementById('gateway-url').textContent =
        truncateUrl(gswapUrls.gatewayBaseUrl);
    document.getElementById('bundler-url').textContent =
        truncateUrl(gswapUrls.bundlerBaseUrl);
    document.getElementById('backend-url').textContent =
        truncateUrl(gswapUrls.dexBackendBaseUrl);
}

// Update configuration display
function updateConfigurationDisplay(config) {
    if (config.transactionTimeoutMs) {
        const minutes = Math.round(config.transactionTimeoutMs / 60000);
        document.getElementById('transaction-timeout').textContent = `${minutes}m`;
    }
}

// Auto-refresh status every 10 seconds
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshStatus, 10000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Show loading overlay
function showLoading(message = 'Processing...') {
    if (loadingOverlay) {
        loadingOverlay.querySelector('p').textContent = message;
        loadingOverlay.style.display = 'flex';
        loadingOverlay.classList.add('fade-in');
    }
}

// Hide loading overlay
function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('fade-in');
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 200);
    }
}

// Fetch and update bot status with enhanced error handling
async function refreshStatus() {
    try {
        const response = await fetch('/api/status');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const status = await response.json();
        updateUI(status);

        // Update page title based on status
        updatePageTitle(status);

    } catch (error) {
        console.error('Error fetching status:', error);
        handleConnectionError(error);
    }
}

// Update page title with status
function updatePageTitle(status) {
    const baseTitle = 'The Most Interesting Trader';
    if (status.isRunning) {
        document.title = `🟢 ${baseTitle} - Active`;
    } else {
        document.title = `🔴 ${baseTitle} - Inactive`;
    }
}

// Handle connection errors gracefully
function handleConnectionError(error) {
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');

    statusDot.className = 'status-dot stopped';
    statusText.textContent = 'Connection Error';

    showError(`Connection failed: ${error.message}`);
}

// Enhanced UI update with animations
function updateUI(status) {
    // Update status indicator with animation
    updateStatusIndicator(status);

    // Update tagline
    updateTagline(status);

    // Update balance information with animations
    updateBalanceInfo(status);

    // Update statistics with counters
    updateStatistics(status);

    // Update configuration
    updateConfiguration(status);

    // Update recent activity with slide-in animations
    updateRecentActivity(status.recentTrades || []);

    // Update button states
    updateButtonStates(status.isRunning);
}

// Update status indicator with smooth transitions
function updateStatusIndicator(status) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    // Remove existing classes
    statusDot.classList.remove('running', 'stopped');

    if (status.isRunning) {
        statusDot.classList.add('running');
        statusText.textContent = 'Trading Active';
    } else {
        statusDot.classList.add('stopped');
        statusText.textContent = status.error || 'Inactive';
    }

    // Add pulse animation
    statusDot.style.animation = 'none';
    setTimeout(() => {
        statusDot.style.animation = '';
    }, 10);
}

// Update tagline with typing effect
function updateTagline(status) {
    if (status.config?.tagline) {
        const taglineElement = document.getElementById('tagline');
        const newText = status.config.tagline;

        if (taglineElement.textContent !== newText) {
            typeText(taglineElement, newText);
        }
    }
}

// Typing animation effect
function typeText(element, text) {
    element.style.opacity = '0.5';
    setTimeout(() => {
        element.textContent = text;
        element.style.opacity = '1';
    }, 300);
}

// Update balance info with number animations
function updateBalanceInfo(status) {
    if (!status.lastBalance) return;

    const balance = status.lastBalance;

    animateNumber('preferred-balance', balance.preferredTokenBalance, 4,
                  ` ${status.config?.preferredToken || ''}`);
    animateNumber('gala-balance', balance.galaTokenBalance, 4, ' GALA');
    animateValue('other-tokens-count', balance.otherTokens.length.toString());

    // Update token list with staggered animations
    updateTokenList(balance.otherTokens, status.config?.preferredToken);
}

// Animate number changes
function animateNumber(elementId, newValue, decimals = 2, suffix = '') {
    const element = document.getElementById(elementId);
    const currentText = element.textContent.replace(suffix, '');
    const currentValue = parseFloat(currentText) || 0;

    if (Math.abs(currentValue - newValue) < 0.0001) return;

    const steps = 20;
    const stepValue = (newValue - currentValue) / steps;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        const value = currentValue + (stepValue * step);
        element.textContent = `${value.toFixed(decimals)}${suffix}`;

        if (step >= steps) {
            clearInterval(interval);
            element.textContent = `${newValue.toFixed(decimals)}${suffix}`;
        }
    }, 20);
}

// Animate value changes
function animateValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (element.textContent !== newValue) {
        element.style.transform = 'scale(1.1)';
        element.style.color = 'var(--accent-light)';
        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'scale(1)';
            element.style.color = '';
        }, 150);
    }
}

// Update statistics with progress indicators
function updateStatistics(status) {
    if (!status.statistics) return;

    const stats = status.statistics;

    animateValue('total-trades', stats.totalTrades?.toString() || '0');

    const successRate = stats.successRate || 0;
    const successElement = document.getElementById('success-rate');
    successElement.textContent = `${successRate.toFixed(1)}%`;

    // Add color coding for success rate
    if (successRate >= 80) {
        successElement.style.color = 'var(--success-light)';
    } else if (successRate >= 60) {
        successElement.style.color = 'var(--warning)';
    } else {
        successElement.style.color = 'var(--danger)';
    }

    // Update uptime
    if (status.uptime?.readable) {
        document.getElementById('uptime').textContent = status.uptime.readable;
    }
}

// Update configuration display
function updateConfiguration(status) {
    if (!status.config) return;

    const config = status.config;

    document.getElementById('wallet-address').textContent =
        truncateAddress(config.walletAddress) || '--';
    document.getElementById('trade-interval').textContent =
        `${Math.floor((config.tradeInterval || 0) / 1000)}s`;

    const tradingEnabled = document.getElementById('trading-enabled');
    tradingEnabled.textContent = config.tradingEnabled ? 'Enabled' : 'Disabled';
    tradingEnabled.style.color = config.tradingEnabled ? 'var(--success-light)' : 'var(--danger)';
}

// Enhanced token list with animations
function updateTokenList(tokens, preferredToken) {
    const tokenList = document.getElementById('token-list');

    if (!tokens || tokens.length === 0) {
        tokenList.innerHTML = '<div class="no-tokens"><span>No other tokens held</span></div>';
        return;
    }

    const tokenItems = tokens.map((token, index) => `
        <div class="token-item" style="animation-delay: ${index * 0.1}s">
            <span class="token-symbol">${token.symbol}</span>
            <span class="token-amount">${token.quantity.toFixed(4)}</span>
        </div>
    `).join('');

    tokenList.innerHTML = tokenItems;
}

// Enhanced recent activity with better formatting
function updateRecentActivity(trades) {
    const activityList = document.getElementById('activity-list');

    if (!trades || trades.length === 0) {
        activityList.innerHTML = '<div class="no-activity"><span>No recent trading activity</span></div>';
        return;
    }

    const tradeItems = trades.slice(-5).reverse().map((trade, index) => {
        const statusClass = trade.success ? 'success' : 'failed';
        const statusText = trade.success ? 'Success' : 'Failed';
        const time = formatTime(trade.timestamp);
        const fromSymbol = getTokenSymbol(trade.fromToken);
        const toSymbol = getTokenSymbol(trade.toToken);

        return `
            <div class="trade-item ${statusClass}" style="animation-delay: ${index * 0.1}s">
                <div class="trade-details">
                    <div class="trade-amount">
                        ${trade.amountIn.toFixed(4)} ${fromSymbol}
                        → ${trade.amountOut ? trade.amountOut.toFixed(6) : '?'} ${toSymbol}
                    </div>
                    <div class="trade-time">${time}</div>
                    ${trade.transactionId ? `<div class="trade-tx" title="${trade.transactionId}">TX: ${truncateAddress(trade.transactionId)}</div>` : ''}
                    ${trade.error ? `<div class="trade-error">${trade.error}</div>` : ''}
                </div>
                <div class="trade-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');

    activityList.innerHTML = tradeItems;
}

// Enhanced button states with loading indicators
function updateButtonStates(isRunning) {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');

    startBtn.disabled = isRunning;
    stopBtn.disabled = !isRunning;

    if (isRunning) {
        startBtn.innerHTML = '<span>Trading Active</span>';
        stopBtn.innerHTML = '<span>Stop Trading</span>';
    } else {
        startBtn.innerHTML = '<span>Start Trading</span>';
        stopBtn.innerHTML = '<span>Stopped</span>';
    }
}

// Enhanced start bot function
async function startBot() {
    const startBtn = document.getElementById('start-btn');
    const originalContent = startBtn.innerHTML;

    try {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="loading"></span> Starting...';

        showLoading('Starting trading bot...');

        const response = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            showSuccess(result.message || 'Bot started successfully');
            setTimeout(refreshStatus, 1000);
        } else {
            throw new Error(result.error || 'Failed to start bot');
        }
    } catch (error) {
        console.error('Error starting bot:', error);
        showError(error.message);
        startBtn.disabled = false;
        startBtn.innerHTML = originalContent;
    } finally {
        hideLoading();
    }
}

// Enhanced stop bot function
async function stopBot() {
    const stopBtn = document.getElementById('stop-btn');
    const originalContent = stopBtn.innerHTML;

    try {
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<span class="loading"></span> Stopping...';

        showLoading('Stopping trading bot...');

        const response = await fetch('/api/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            showSuccess(result.message || 'Bot stopped successfully');
            setTimeout(refreshStatus, 1000);
        } else {
            throw new Error(result.error || 'Failed to stop bot');
        }
    } catch (error) {
        console.error('Error stopping bot:', error);
        showError(error.message);
        stopBtn.disabled = false;
        stopBtn.innerHTML = originalContent;
    } finally {
        hideLoading();
    }
}

// Enhanced utility functions
function truncateAddress(address) {
    if (!address) return '--';
    if (address.length <= 20) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function truncateUrl(url) {
    if (!url) return '--';
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url.length > 30 ? `${url.slice(0, 30)}...` : url;
    }
}

function getTokenSymbol(tokenKey) {
    if (!tokenKey) return '?';
    return tokenKey.split('|')[0] || '?';
}

function formatTime(timestamp) {
    if (!timestamp) return '--';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleDateString();
}

// Enhanced message system
function showSuccess(message) {
    showMessage(message, 'success', '✅');
}

function showError(message) {
    showMessage(message, 'error', '❌');
}

function showMessage(message, type, icon = '') {
    // Remove existing messages
    document.querySelectorAll('.message').forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} fade-in`;
    messageDiv.setAttribute('data-icon', icon);
    messageDiv.innerHTML = `<span>${message}</span>`;

    // Insert after controls section
    const controlsSection = document.querySelector('.controls-section');
    controlsSection.parentNode.insertBefore(messageDiv, controlsSection.nextSibling);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.classList.remove('fade-in');
        setTimeout(() => messageDiv.remove(), 300);
    }, 5000);
}

// Enhanced visibility handling
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        refreshStatus();
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'r':
                e.preventDefault();
                refreshStatus();
                break;
            case 's':
                e.preventDefault();
                const startBtn = document.getElementById('start-btn');
                if (!startBtn.disabled) startBot();
                break;
        }
    }
});

// Add scroll-to-top functionality
function addScrollToTop() {
    const scrollBtn = document.createElement('button');
    scrollBtn.innerHTML = '↑';
    scrollBtn.className = 'scroll-to-top';
    scrollBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--gradient-accent);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 20px;
        display: none;
        z-index: 999;
        transition: var(--transition);
    `;

    scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(scrollBtn);

    window.addEventListener('scroll', () => {
        scrollBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
    });
}

// Initialize scroll-to-top when DOM is ready
document.addEventListener('DOMContentLoaded', addScrollToTop);