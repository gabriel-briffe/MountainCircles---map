/**
 * Notification module for MountainCircles Map
 * Provides functions for creating and managing notifications
 */

/**
 * Creates a notification element
 * @param {string} content - The text content for the notification
 * @param {string} icon - Material icon name
 * @param {Object} options - Optional configuration
 * @param {boolean} options.showCloseButton - Whether to show a close button
 * @param {boolean} options.showRefreshButton - Whether to show a refresh button
 * @param {string} options.refreshUrl - URL to navigate to when refresh button is clicked
 * @param {number} options.autoHideDelay - Time in ms before auto-hiding (0 = don't auto-hide)
 * @returns {HTMLElement} The created notification element
 */
export function createNotification(content, icon, options = {}) {
    const {
        showCloseButton = true,
        showRefreshButton = false,
        refreshUrl = '',
        autoHideDelay = 5000 // 5 seconds by default
    } = options;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // Create content container with icon
    const contentContainer = document.createElement('div');
    contentContainer.className = 'notification-content';
    
    // Add icon if provided
    if (icon) {
        const iconEl = document.createElement('span');
        iconEl.className = 'material-icons';
        iconEl.textContent = icon;
        contentContainer.appendChild(iconEl);
    }
    
    // Add content text
    const textEl = document.createElement('span');
    textEl.textContent = content;
    contentContainer.appendChild(textEl);
    
    // Add content container to notification
    notification.appendChild(contentContainer);
    
    // Add refresh button if needed
    if (showRefreshButton && refreshUrl) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'refresh-button';
        refreshBtn.innerHTML = '<span class="material-icons">refresh</span> Refresh Now';
        
        // Add click event
        refreshBtn.addEventListener('click', () => {
            window.location.href = refreshUrl;
        });
        
        notification.appendChild(refreshBtn);
    }
    
    // Add close button if needed
    if (showCloseButton) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '<span class="material-icons">close</span>';
        
        // Add click event
        closeBtn.addEventListener('click', () => {
            hideNotification(notification);
        });
        
        notification.appendChild(closeBtn);
    }
    
    // Add to the DOM
    const container = document.getElementById('notifications-container');
    if (container) {
        container.appendChild(notification);
    } else {
        console.error('Notifications container not found');
        return notification; // Return but don't add to DOM
    }
    
    // Auto-hide if needed
    if (autoHideDelay > 0) {
        setTimeout(() => {
            hideNotification(notification);
        }, autoHideDelay);
    }
    
    return notification;
}

/**
 * Hides and removes a notification with a fade effect
 * @param {HTMLElement} notification - The notification element to hide
 */
export function hideNotification(notification) {
    notification.style.opacity = '0';
    
    // Remove after transition completes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300); // Match the CSS transition duration
}

/**
 * Clears all notifications
 */
export function clearAllNotifications() {
    const container = document.getElementById('notifications-container');
    if (container) {
        container.innerHTML = '';
    }
} 