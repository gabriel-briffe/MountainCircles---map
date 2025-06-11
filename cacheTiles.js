/**
 * Tile caching module for MountainCircles Map
 * Handles MBTiles extraction for offline tile caching
 */

import mbtilesHandler from './mbtiles.js';

// Cache name to use for tiles (must match the one used in sw.js)
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';

// URLs for the MBTiles files
const ALPS_MBTILES_URL = 'https://github.com/gabriel-briffe/MountainCircles---map/releases/download/alpes/alpes.mbtiles';
const PYRENEES_MBTILES_URL = 'https://github.com/gabriel-briffe/MountainCircles---map/releases/download/pyrenees/pyrenees.mbtiles';
const JURA_NORD_VOSGES_MBTILES_URL = 'https://github.com/gabriel-briffe/MountainCircles---map/releases/download/jura_nord_vosges/jura_nord_vosges.mbtiles';
const NORWAY_MBTILES_URL = 'https://github.com/gabriel-briffe/MountainCircles---map/releases/download/norway/norway.mbtiles';
const PROXY_URL = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=';

/**
 * Gets the existing progress UI elements
 * @param {string} region - 'alps', 'pyrenees', 'jura_nord_vosges', or 'norway' to determine which UI elements to use
 * @returns {Object} Progress UI elements
 */
function getProgressUI(region = 'alps') {
  let prefix;
  if (region === 'pyrenees') {
    prefix = 'pyreneesMap';
  } else if (region === 'jura_nord_vosges') {
    prefix = 'juraNordVosgesMap';
  } else if (region === 'norway') {
    prefix = 'norwayMap';
  } else {
    prefix = 'map';
  }
  
  const progressElement = document.getElementById(`${prefix}CacheProgress`);
  const progressBar = document.getElementById(`${prefix}ProgressBar`);
  const countElement = document.getElementById(`${prefix}CacheCount`);
  const totalElement = document.getElementById(`${prefix}TotalTiles`);
  
  // Create status text element if it doesn't exist
  let statusElement = progressElement.querySelector('.status-text');
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.className = 'status-text';
    
    // Insert at the beginning of the progress element
    const firstChild = progressElement.firstChild;
    progressElement.insertBefore(statusElement, firstChild);
  }
  
  return {
    container: progressElement,
    progressBar: progressBar,
    countElement: countElement,
    totalElement: totalElement,
    statusElement: statusElement
  };
}

/**
 * Shows a file selection dialog for MBTiles files
 * @returns {Promise<File|null>} Selected file or null if cancelled
 */
function selectMBTilesFile() {
  return new Promise((resolve) => {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.mbtiles';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Handle file selection
    fileInput.onchange = (event) => {
      const file = event.target.files.length > 0 ? event.target.files[0] : null;
      document.body.removeChild(fileInput);
      resolve(file);
    };
    
    // Handle cancellation
    document.addEventListener('click', function cancelHandler(e) {
      if (e.target !== fileInput && !fileInput.contains(e.target)) {
        document.removeEventListener('click', cancelHandler);
        if (document.body.contains(fileInput)) {
          document.body.removeChild(fileInput);
          resolve(null);
        }
      }
    }, { once: true, capture: true });
    
    // Open file dialog
    fileInput.click();
  });
}

/**
 * Downloads an MBTiles file from the specified URL with progress tracking
 * @param {string} mbtilesUrl - The URL of the MBTiles file to download
 * @param {Function} progressCallback - Callback for download progress updates
 * @returns {Promise<File|null>} Downloaded file or null if failed
 */
async function downloadMBTilesFile(mbtilesUrl, progressCallback) {
  try {
    const proxyMbtilesUrl = `${PROXY_URL}${encodeURIComponent(mbtilesUrl)}`;
    
    // Fetch the file through the proxy
    const response = await fetch(proxyMbtilesUrl);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    // Get content length from headers if available
    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;
    
    // Create a stream reader
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;
    
    // Process the stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Store this chunk
      chunks.push(value);
      receivedBytes += value.length;
      
      // Calculate and report progress
      if (totalBytes) {
        const progress = receivedBytes / totalBytes;
        const receivedMB = (receivedBytes / (1024 * 1024)).toFixed(2);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        progressCallback(progress, receivedMB, totalMB, `Downloading map file: ${receivedMB} MB / ${totalMB} MB`);
      } else {
        // If we don't know the total size, just show received bytes
        const receivedMB = (receivedBytes / (1024 * 1024)).toFixed(2);
        progressCallback(0.5, receivedMB, '?', `Downloading map file: ${receivedMB} MB downloaded`);
      }
    }
    
    // Combine all chunks into a single Uint8Array
    const allChunks = new Uint8Array(receivedBytes);
    let position = 0;
    
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }
    
    // Convert to a file object
    const fileName = mbtilesUrl.split('/').pop();
    const fileBlob = new Blob([allChunks], { type: 'application/octet-stream' });
    const file = new File([fileBlob], fileName, { type: 'application/octet-stream' });
    
    return file;
  } catch (error) {
    console.error('[DEBUG] Error downloading MBTiles file:', error);
    return null;
  }
}

/**
 * Caches map tiles from an MBTiles file
 * @param {string} region - 'alps', 'pyrenees', 'jura_nord_vosges', or 'norway' to determine which map to cache
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheTilesFromMBTiles(region = 'alps') {
  const mbtilesUrl = region === 'pyrenees' ? PYRENEES_MBTILES_URL : region === 'jura_nord_vosges' ? JURA_NORD_VOSGES_MBTILES_URL : region === 'norway' ? NORWAY_MBTILES_URL : ALPS_MBTILES_URL;
  console.log(`[DEBUG] Starting MBTiles import process for ${region}`);
  
  // Get existing progress UI
  const ui = getProgressUI(region);
  ui.container.style.display = 'flex';
  ui.progressBar.style.width = '0%';
  ui.statusElement.textContent = 'Preparing to download map file...';
  ui.countElement.textContent = '0';
  ui.totalElement.textContent = '0';
  
  // Track downloaded file reference for cleanup
  let downloadedFile = null;
  
  try {
    // Download the MBTiles file
    ui.statusElement.textContent = 'Starting download...';
    downloadedFile = await downloadMBTilesFile(mbtilesUrl, (progress, loaded, total, message) => {
      ui.progressBar.style.width = `${progress * 100}%`;
      ui.statusElement.textContent = message;
    });
    
    if (!downloadedFile) {
      throw new Error('Failed to download map file');
    }
    
    // Reset progress for processing phase
    ui.progressBar.style.width = '0%';
    ui.statusElement.textContent = 'Download complete. Processing map file...';
    
    // Display file info
    const fileSizeMB = (downloadedFile.size / (1024 * 1024)).toFixed(2);
    console.log(`[DEBUG] Downloaded file: ${downloadedFile.name} (${fileSizeMB} MB)`);
    
    // Setup debounced UI update to prevent flickering
    let lastUpdateTime = 0;
    const updateThreshold = 300; // ms
    
    // Function to update UI with progress information
    const updateProgressUI = (progress, processed, total, message) => {
      const now = Date.now();
      if (now - lastUpdateTime < updateThreshold && progress < 1.0) {
        return; // Skip update if not enough time has passed
      }
      
      lastUpdateTime = now;
      ui.progressBar.style.width = `${progress * 100}%`;
      ui.countElement.textContent = processed;
      ui.totalElement.textContent = total;
      
      if (message) {
        ui.statusElement.textContent = message;
      }
    };
    
    // Load MBTiles file
    const loadSuccess = await mbtilesHandler.loadFile(downloadedFile, (progress, loaded, total, message) => {
      updateProgressUI(progress, 0, 0, message || `Processing file (${(loaded / (1024 * 1024)).toFixed(2)}/${(total / (1024 * 1024)).toFixed(2)} MB)`);
    });
    
    if (!loadSuccess) {
      throw new Error('Failed to load MBTiles file');
    }
    
    // Extract and store tiles to IndexedDB
    const extractSuccess = await mbtilesHandler.extractAndStoreToIndexedDB(
      region,
      (progress, processed, total, message) => {
        updateProgressUI(progress, processed, total, message || 'Storing tiles...');
      }
    );
    
    if (!extractSuccess) {
      throw new Error('Failed to extract tiles from MBTiles file');
    }
    
    // Complete - ensure 100% is shown
    ui.progressBar.style.width = '100%';
    ui.statusElement.textContent = 'Tile extraction complete!';
    ui.countElement.textContent = mbtilesHandler.processedTiles;
    ui.totalElement.textContent = mbtilesHandler.totalTiles;
    
    // Close the database connection
    mbtilesHandler.close();
    
    // Hide the progress overlay after a delay
    setTimeout(() => {
      ui.container.style.display = 'none';
    }, 5000);
    
    return { 
      success: true, 
      tileCount: mbtilesHandler.processedTiles
    };
  } catch (error) {
    console.error('[DEBUG] Error in MBTiles process:', error);
    
    // Show error message
    ui.statusElement.textContent = `Error: ${error.message}`;
    ui.progressBar.classList.add('progress-bar-error');
    
    // Close database connection if open
    mbtilesHandler.close();
    
    // Hide the progress overlay after a delay
    setTimeout(() => {
      ui.container.style.display = 'none';
      // Reset the progress bar color
      ui.progressBar.classList.remove('progress-bar-error');
    }, 5000);
    
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    // Clean up downloaded file by releasing all references
    // The browser garbage collector will handle the actual memory cleanup
    downloadedFile = null;
  }
}

/**
 * Main cacheTiles function - now automatically downloads the Alps MBTiles file
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheTiles() {
  return cacheTilesFromMBTiles('alps');
}

/**
 * Cache Alps map tiles
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheAlpsTiles() {
  return cacheTilesFromMBTiles('alps');
}

/**
 * Cache Pyrenees map tiles
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cachePyreneesTiles() {
  return cacheTilesFromMBTiles('pyrenees');
}

/**
 * Cache Jura Nord Vosges map tiles
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheJuraNordVosgesTiles() {
  return cacheTilesFromMBTiles('jura_nord_vosges');
}

/**
 * Cache Norway map tiles
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheNorwayTiles() {
  return cacheTilesFromMBTiles('norway');
} 