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
            // Compare with time tolerance for Last-Modified timestamps
            hasUpdate = compareETagsWithTimeTolerance(storedCoreFilesETag, combinedETag, 60);
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
 * Compare ETags with time tolerance for Last-Modified timestamps
 * @param {string} storedETag - The stored ETag string
 * @param {string} newETag - The new ETag string
 * @param {number} toleranceSeconds - Tolerance in seconds for timestamp differences
 * @returns {boolean} - Whether there's an update (true) or not (false)
 */
function compareETagsWithTimeTolerance(storedETag, newETag, toleranceSeconds) {
    // If ETags are identical, there's no update
    if (storedETag === newETag) {
        return false;
    }
    
    // ETags are different, check if they're different only because of timestamps
    try {
        // Parse into file entries
        const storedEntries = parseETagString(storedETag);
        const newEntries = parseETagString(newETag);
        
        // Check if files lists are different
        const storedFiles = Object.keys(storedEntries);
        const newFiles = Object.keys(newEntries);
        
        // If file lists are different, it's an update
        if (storedFiles.length !== newFiles.length) {
            console.log('[UpdateChecker] Different number of files');
            return true;
        }
        
        // Check for added or removed files
        for (const file of storedFiles) {
            if (!newEntries[file]) {
                console.log(`[UpdateChecker] File removed: ${file}`);
                return true;
            }
        }
        
        for (const file of newFiles) {
            if (!storedEntries[file]) {
                console.log(`[UpdateChecker] File added: ${file}`);
                return true;
            }
        }
        
        // Now check each file's ETag with time tolerance
        for (const file of storedFiles) {
            const storedEntry = storedEntries[file];
            const newEntry = newEntries[file];
            
            // If entries have different formats (e.g. size vs last-modified), it's an update
            if (storedEntry.type !== newEntry.type) {
                console.log(`[UpdateChecker] Different ETag types for ${file}: ${storedEntry.type} vs ${newEntry.type}`);
                return true;
            }
            
            // For Last-Modified type, apply time tolerance
            if (storedEntry.type === 'last-modified') {
                const storedTime = new Date(storedEntry.value).getTime();
                const newTime = new Date(newEntry.value).getTime();
                
                // If time difference is within tolerance, consider identical
                const diffSeconds = Math.abs(storedTime - newTime) / 1000;
                if (diffSeconds <= toleranceSeconds) {
                    console.log(`[UpdateChecker] Timestamps for ${file} within tolerance: ${diffSeconds}s`);
                    continue; // Skip this file, move to next
                }
                
                console.log(`[UpdateChecker] Timestamp difference for ${file} exceeds tolerance: ${diffSeconds}s`);
                return true;
            }
            
            // For other types (size, ETag), exact match is required
            if (storedEntry.value !== newEntry.value) {
                console.log(`[UpdateChecker] Different ${storedEntry.type} for ${file}: ${storedEntry.value} vs ${newEntry.value}`);
                return true;
            }
        }
        
        // If we got here, all files are equivalent within tolerance
        console.log('[UpdateChecker] Files equivalent within time tolerance');
        return false;
    } catch (error) {
        console.error('[UpdateChecker] Error comparing ETags with tolerance:', error);
        // On error, fall back to direct comparison
        return storedETag !== newETag;
    }
}

/**
 * Parse an ETag string into a structured object
 * @param {string} etagString - The ETag string
 * @returns {Object} - Structured object mapping filenames to their info
 */
function parseETagString(etagString) {
    const result = {};
    
    // Split the string into individual entries
    const entries = etagString.split('|');
    
    for (const entry of entries) {
        // Parse each entry (e.g. "file.js:last-modified:Wed, 01 Jan 2025 12:00:00 GMT")
        const parts = entry.split(':');
        
        if (parts.length >= 3) {
            const filename = parts[0];
            const type = parts[1];
            // Rejoin the remaining parts in case the value itself contains colons
            const value = parts.slice(2).join(':');
            
            result[filename] = { type, value };
        } else if (parts.length === 2) {
            // Handle simpler format like "file.js:value"
            const filename = parts[0];
            const value = parts[1];
            
            result[filename] = { type: 'unknown', value };
        }
    }
    
    return result;
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
    
    // Last resort - use content length + response date if available, otherwise a stable fallback
    const responseDate = response.headers.get('Date');
    if (responseDate) {
        return `${filename}:date:${responseDate}`;
    }
    
    // If no headers available, use a stable identifier indicating no versioning
    return `${filename}:no-version:stable`;
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