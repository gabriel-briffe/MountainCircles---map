/**
 * Web Worker for checking version updates in MountainCircles Map
 * Simple version-based update checking using version.txt
 */

// Constants
const AIRSPACE_URL = 'https://github.com/gabriel-briffe/openaip_airspace/releases/latest/download/airspace.geojson';
const PROXY_URL = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=';

// Store cached version
let cachedVersion = 0;
let storedAirspaceETag = null; // Keep airspace checking as-is for now

/**
 * Handle worker messages
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'init':
            // Store cached version and airspace ETag
            cachedVersion = data.version || 0;
            storedAirspaceETag = data.airspaceETag;
            console.log('[UpdateChecker] Initialized with cached version:', cachedVersion);
            break;
        case 'checkAirspaceUpdate':
            checkAirspaceUpdate();
            break;
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

/**
 * Check for airspace data updates (keeping existing logic)
 */
async function checkAirspaceUpdate() {
    console.log('[UpdateChecker] Checking for airspace updates');
    
    // If we don't have a stored ETag, no need to check
    if (!storedAirspaceETag) {
        console.log('[UpdateChecker] No stored airspace ETag, skipping check');
        self.postMessage({ 
            type: 'airspaceUpdateResult', 
            result: { hasUpdate: false, noETag: true } 
        });
        return;
    }
    
    try {
        // Create an AbortController for the timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 10000); // 10 seconds timeout
        
        // Make a HEAD request to check headers without downloading the full file
        const proxyAirspaceUrl = `${PROXY_URL}${encodeURIComponent(AIRSPACE_URL)}`;
        const response = await fetch(proxyAirspaceUrl, { 
            method: 'HEAD',
            signal: controller.signal
        });
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Failed to check for updates: ${response.status} ${response.statusText}`);
        }
        
        // Get the current ETag
        let currentEtag = response.headers.get('ETag');
        
        // If no ETag, try Last-Modified as fallback
        if (!currentEtag) {
            const lastModified = response.headers.get('Last-Modified');
            if (lastModified) {
                currentEtag = `last-modified:${lastModified}`;
            }
        }
        
        // If we couldn't get any version identifier, return false
        if (!currentEtag) {
            console.log('[UpdateChecker] No version identifier in response');
            self.postMessage({ 
                type: 'airspaceUpdateResult', 
                result: { hasUpdate: false, noVersionInfo: true } 
            });
            return;
        }
        
        // Compare the ETags
        const hasUpdate = storedAirspaceETag !== currentEtag;
        console.log(`[UpdateChecker] Airspace update check: stored=${storedAirspaceETag}, current=${currentEtag}, hasUpdate=${hasUpdate}`);
        
        self.postMessage({ 
            type: 'airspaceUpdateResult', 
            result: { hasUpdate, currentEtag, storedEtag: storedAirspaceETag }
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('[UpdateChecker] Airspace update check timed out after 10 seconds');
            self.postMessage({ 
                type: 'airspaceUpdateResult', 
                result: { hasUpdate: false, error: 'Timeout after 10 seconds' } 
            });
        } else {
            console.error('[UpdateChecker] Error checking for airspace updates:', error);
            self.postMessage({ 
                type: 'airspaceUpdateResult', 
                result: { hasUpdate: false, error: error.message } 
            });
        }
    }
}

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
 * Check all updates (airspace and version)
 * @param {string} basePath - Base path for files
 */
async function checkAllUpdates(basePath) {
    console.log('[UpdateChecker] Checking all updates');
    
    // Check airspace first
    checkAirspaceUpdate();
    
    // Then check version
    checkVersionUpdate(basePath);
}

// Log when worker is loaded
console.log('[UpdateChecker] Web worker initialized'); 