/**
 * Web Worker for checking file updates in MountainCircles Map
 * Handles both airspace data and core app files update checking
 */

// Constants
const AIRSPACE_URL = 'https://github.com/gabriel-briffe/openaip_airspace/releases/latest/download/airspace.geojson';
const PROXY_URL = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=';

// Store values received from main thread
let storedAirspaceETag = null;
let storedCoreFilesETag = null;

/**
 * Handle worker messages
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'init':
            // Store values from main thread
            storedAirspaceETag = data.airspaceETag;
            storedCoreFilesETag = data.coreFilesETag;
            console.log('[UpdateChecker] Initialized with stored ETags:', data);
            if (data.coreFilesETag) {
                console.log(`[DEBUG] Core ETags: Worker initialized with stored ETag=${data.coreFilesETag}`);
            } else {
                console.log(`[DEBUG] Core ETags: Worker initialized with no stored ETag`);
            }
            break;
        case 'checkAirspaceUpdate':
            checkAirspaceUpdate();
            break;
        case 'checkCoreFilesUpdate':
            checkCoreFilesUpdate(data.files, data.basePath);
            break;
        case 'checkAllUpdates':
            checkAllUpdates(data.files, data.basePath);
            break;
        default:
            console.error('[UpdateChecker] Unknown message type:', type);
    }
});

/**
 * Check for airspace data updates
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
        // Make a HEAD request to check headers without downloading the full file
        const proxyAirspaceUrl = `${PROXY_URL}${encodeURIComponent(AIRSPACE_URL)}`;
        const response = await fetch(proxyAirspaceUrl, { method: 'HEAD' });
        
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
        console.error('[UpdateChecker] Error checking for airspace updates:', error);
        self.postMessage({ 
            type: 'airspaceUpdateResult', 
            result: { hasUpdate: false, error: error.message } 
        });
    }
}

/**
 * Check core files for updates
 * @param {Array} files - List of files to check
 * @param {string} basePath - Base path for files
 */
async function checkCoreFilesUpdate(files, basePath) {
    console.log('[UpdateChecker] Checking for core files updates');
    
    if (!files || !Array.isArray(files) || files.length === 0) {
        console.error('[UpdateChecker] No files provided for checking');
        self.postMessage({ 
            type: 'coreFilesUpdateResult', 
            result: { hasUpdate: false, error: 'No files provided' } 
        });
        return;
    }
    
    try {
        // Check each file
        let etags = [];
        let filesChecked = 0;
        let hasUpdate = false;
        
        // Process files in chunks to avoid overwhelming the browser
        const CHUNK_SIZE = 5;
        for (let i = 0; i < files.length; i += CHUNK_SIZE) {
            const chunk = files.slice(i, i + CHUNK_SIZE);
            
            // Process each file in the chunk
            await Promise.all(chunk.map(async (file) => {
                try {
                    const fullPath = `${basePath}/${file}`;
                    
                    // Add a cache-busting parameter to avoid getting cached responses
                    const url = new URL(fullPath, self.location.origin);
                    url.searchParams.set('check', Date.now());
                    
                    const response = await fetch(url.toString(), { 
                        method: 'HEAD',
                        cache: 'no-store'
                    });
                    
                    if (!response.ok) {
                        console.warn(`[UpdateChecker] Failed to check file: ${file}`);
                        return;
                    }
                    
                    // Get preferred ETag or Last-Modified
                    let fileEtag = getPreferredVersionIdentifier(response, file);
                    
                    // Log each file's ETag
                    console.log(`[DEBUG] Core ETags: File ${file} has remote ETag=${fileEtag}`);
                    
                    // Add to our list
                    etags.push(fileEtag);
                    filesChecked++;
                    
                    // Report progress
                    self.postMessage({ 
                        type: 'coreFilesCheckProgress', 
                        progress: { 
                            completed: filesChecked, 
                            total: files.length, 
                            currentFile: file 
                        } 
                    });
                } catch (error) {
                    console.error(`[UpdateChecker] Error checking file ${file}:`, error);
                }
            }));
        }
        
        // Calculate a combined "hash" of all ETags
        const combinedETag = etags.sort().join('|');
        
        // If we have a stored combined ETag, compare
        if (storedCoreFilesETag) {
            // Direct comparison - assumes consistent formats
            hasUpdate = storedCoreFilesETag !== combinedETag;
            console.log(`[DEBUG] Core ETags: Comparison complete. Stored=${storedCoreFilesETag}, New combined=${combinedETag}, hasUpdate=${hasUpdate}`);
        } else {
            // If no stored ETag, consider it an update available
            hasUpdate = true;
            console.log(`[DEBUG] Core ETags: No stored ETag to compare against. New combined=${combinedETag}, hasUpdate=${hasUpdate}`);
        }
        
        console.log(`[UpdateChecker] Core files check complete: ${filesChecked}/${files.length} files checked, hasUpdate=${hasUpdate}`);
        
        // Send the result
        self.postMessage({ 
            type: 'coreFilesUpdateResult', 
            result: { 
                hasUpdate, 
                filesChecked, 
                totalFiles: files.length,
                combinedETag: combinedETag,
                storedETag: storedCoreFilesETag
            } 
        });
        
    } catch (error) {
        console.error('[UpdateChecker] Error checking core files:', error);
        self.postMessage({ 
            type: 'coreFilesUpdateResult', 
            result: { hasUpdate: false, error: error.message } 
        });
    }
}

/**
 * Get the preferred version identifier from a response
 * @param {Response} response - The response object
 * @param {string} filename - The filename
 * @returns {string} - The version identifier
 */
function getPreferredVersionIdentifier(response, filename) {
    // Get Last-Modified as preferred option
    const lastModified = response.headers.get('Last-Modified');
    if (lastModified) {
        return `${filename}:last-modified:${lastModified}`;
    }
    
    // ETag as second option
    const etag = response.headers.get('ETag');
    if (etag) {
        return `${filename}:${etag}`;
    }
    
    // Content-Length as fallback
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
        return `${filename}:size:${contentLength}`;
    }
    
    // Last resort
    return `${filename}:time:${Date.now()}`;
}

/**
 * Check both airspace and core files for updates
 * @param {Array} files - List of files to check
 * @param {string} basePath - Base path for files
 */
async function checkAllUpdates(files, basePath) {
    // Start both checks
    checkAirspaceUpdate();
    checkCoreFilesUpdate(files, basePath);
}

// Log when worker is loaded
console.log('[UpdateChecker] Web worker initialized'); 