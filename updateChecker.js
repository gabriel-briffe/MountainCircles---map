/**
 * Web Worker for checking version updates in MountainCircles Map
 * Simple version-based update checking using version.txt
 */

// Constants
// Airspace URL removed - no longer checking for airspace updates
const PROXY_URL = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=';

// Store cached version
let cachedVersion = 0;
// Airspace ETag tracking removed

/**
 * Handle worker messages
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'init':
                // Store cached version
    cachedVersion = data.version || 0;
            console.log('[UpdateChecker] Initialized with cached version:', cachedVersion);
            break;
        // Airspace update checking removed
        case 'checkCoreFilesUpdate':
            checkVersionUpdate(data.basePath);
            break;
        case 'checkAllUpdates':
            checkAllUpdates(data.basePath);
            break;
        default:
            console.error('[UpdateChecker] Unknown message type:', type);
    }
});

// Airspace update checking function removed

/**
 * Check for version updates using version.txt
 * @param {string} basePath - Base path for files
 */
async function checkVersionUpdate(basePath) {
    console.log('[UpdateChecker] Checking for version updates');
    
    try {
        // Fetch current version.txt from server
        const versionUrl = `${basePath}/version.txt`;
        const url = new URL(versionUrl, self.location.origin);
        url.searchParams.set('check', Date.now()); // Cache busting
        
        const response = await fetch(url.toString(), { 
            method: 'GET',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch version.txt: ${response.status} ${response.statusText}`);
        }
        
        const versionText = await response.text();
        const serverVersion = parseInt(versionText.trim());
        
        if (isNaN(serverVersion)) {
            throw new Error(`Invalid version number in version.txt: ${versionText}`);
        }
        
        // Compare versions
        const hasUpdate = serverVersion > cachedVersion;
        
        console.log(`[UpdateChecker] Version check: cached=${cachedVersion}, server=${serverVersion}, hasUpdate=${hasUpdate}`);
        
        self.postMessage({ 
            type: 'coreFilesUpdateResult', 
            result: { 
                hasUpdate, 
                cachedVersion,
                serverVersion
            } 
        });
        
    } catch (error) {
        console.error('[UpdateChecker] Error checking version updates:', error);
        self.postMessage({ 
            type: 'coreFilesUpdateResult', 
            result: { hasUpdate: false, error: error.message } 
        });
    }
}

/**
 * Check all updates (only version now)
 * @param {string} basePath - Base path for files
 */
async function checkAllUpdates(basePath) {
    console.log('[UpdateChecker] Checking version updates');
    
    // Only check version (airspace checking removed)
    checkVersionUpdate(basePath);
}

// Log when worker is loaded
console.log('[UpdateChecker] Web worker initialized'); 