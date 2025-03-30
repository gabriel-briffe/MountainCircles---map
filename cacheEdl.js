/**
 * EDL Tiles caching module for MountainCircles Map
 * Handles downloading and caching of EDL MBTiles files for offline use
 */

import mbtilesHandler from './mbtiles.js';

// Constants from multiload.js
export const isobareList = [500, 600, 700, 800, 900];
// const hourList = [7];
export const hourList = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const mbtilesURLBase = 'https://edl-proxy.gabriel-briffe.workers.dev/?url=https://github.com/gabriel-briffe/arome/releases/download/';
console.log('[MODIFIED] cacheEdl.js - Changed isobareList to use hPa values and updated mbtilesURLBase');

// Cache name to use for EDL tiles (reusing the same cache for all tiles)
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';

// Base path for tiles in the cache
import { BASE_PATH } from './config.js';

/**
 * Gets the existing progress UI elements
 * @returns {Object} Progress UI elements
 */
function getProgressUI() {
  console.debug('[edlCache] Getting progress UI elements');
  const progressElement = document.getElementById('edlCacheProgress');
  const progressBar = document.getElementById('edlProgressBar');
  const countElement = document.getElementById('edlCacheCount');
  const totalElement = document.getElementById('edlTotalFiles');
  
  console.debug('[edlCache] Found progress UI elements:', { 
    progressElement: !!progressElement, 
    progressBar: !!progressBar, 
    countElement: !!countElement, 
    totalElement: !!totalElement 
  });
  
  // Create status text element if it doesn't exist
  let statusElement = progressElement.querySelector('.status-text');
  if (!statusElement) {
    console.debug('[edlCache] Creating new status text element');
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
 * Builds a list of all MBTiles URLs to cache
 * @param {boolean} isTomorrow - Whether to get tomorrow's forecast
 * @returns {Array} Array of URL objects with metadata
 */
function buildMBTilesUrlList(isTomorrow = false) {
  // Use current date in UTC
  const cdate = new Date();
  const dayList = [cdate];
  
  const urlList = [];
  
  // Get the forecast date (today in UTC)
  const utcToday = new Date(Date.UTC(cdate.getUTCFullYear(), cdate.getUTCMonth(), cdate.getUTCDate()));
  const forecastDateStr = utcToday.toISOString().slice(0, 10);
  
  // Create a list of dates to fetch - today or tomorrow based on parameter
  const targetDates = [];
  
  if (isTomorrow) {
    // Create tomorrow's date by adding 24 hours (86400000 milliseconds) to today's UTC date
    // This properly handles month/year boundaries
    const utcTomorrow = new Date(utcToday.getTime() + 86400000);
    targetDates.push(utcTomorrow);
    console.log('[MODIFIED] cacheEdl.js - Getting tomorrow\'s forecast for date:', utcTomorrow.toISOString().slice(0, 10));
  } else {
    // Today
    targetDates.push(utcToday);
    console.log('[MODIFIED] cacheEdl.js - Getting today\'s forecast for date:', utcToday.toISOString().slice(0, 10));
  }
  
  targetDates.forEach(targetDate => {
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    
    hourList.forEach(hre => {
      isobareList.forEach(isb => {
        // Format using new URL pattern:
        // arome_vv_forecastDate_forDate_forHour_for_pressure.mbtiles
        const releaseTag = `arome-${forecastDateStr}`;
        const filename = `arome_vv_${forecastDateStr}_${targetDateStr}_${hre.toString().padStart(2, '0')}_${isb}.mbtiles`;
        const url = `${mbtilesURLBase}${releaseTag}/${filename}`;
        
        console.log(`[MODIFIED] cacheEdl.js - Created URL for ${isTomorrow ? 'tomorrow' : 'today'}: ${url}`);
        
        // Cache path with target date and hour. 
        // This will be used for extracted tiles and should match the path expected by the app
        const tilePath = `edl_tiles/${targetDateStr}_${hre}_${isb}`;
        
        urlList.push({
          forecastDate: new Date(utcToday), // The date the forecast was issued
          date: new Date(targetDate), // The date the forecast is for
          isobare: isb, // Now in hPa
          hour: hre,
          label: `${targetDateStr} ${hre}:00 - ${isb}hPa`, // Updated label with target date 
          url: url,
          tilePath: tilePath
        });
      });
    });
  });
  
  return urlList;
}

/**
 * Downloads and processes a single MBTiles file
 * @param {Object} urlInfo - URL information object
 * @param {Function} progressCallback - Callback for extraction progress
 * @returns {Promise<Object>} Result of download and extraction operation
 */
async function downloadAndExtractMBTiles(urlInfo, progressCallback) {
  try {
    // Start download
    if (progressCallback) {
      progressCallback(0, `Downloading: ${urlInfo.label}`);
    }
    
    // Log the attempt to fetch
    console.log(`[edlCache] Attempting to fetch: ${urlInfo.url}`);
    
    // Fetch the file
    const response = await fetch(urlInfo.url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    // Check the content type
    const contentType = response.headers.get('content-type');
    console.log(`[edlCache] Response content type: ${contentType}`);
    
    // Get the MBTiles data as ArrayBuffer
    const buffer = await response.arrayBuffer();
    console.log(`[edlCache] Received ${buffer.byteLength} bytes from: ${urlInfo.url}`);
    
    // Log the first few bytes to check if it's an SQLite file (should start with "SQLite format 3\0")
    const firstBytes = new Uint8Array(buffer.slice(0, 16));
    const header = Array.from(firstBytes).map(b => String.fromCharCode(b)).join('');
    console.log(`[edlCache] File header: ${JSON.stringify(header)}`);
    
    // Check if it's a valid SQLite file
    if (!header.startsWith('SQLite format 3')) {
      // Get a text representation of the response to see what we're dealing with
      const textDecoder = new TextDecoder('utf-8');
      const text = textDecoder.decode(buffer.slice(0, 1000)); // First 1000 bytes
      console.log(`[edlCache] Response is not a valid SQLite file. First 1000 bytes: ${text}`);
      throw new Error('Response is not a valid MBTiles file (SQLite format)');
    }
    
    if (progressCallback) {
      progressCallback(0.3, `Loading MBTiles file: ${urlInfo.label}`);
    }
    
    // Log the attempt to load the file
    console.log(`[edlCache] Loading MBTiles into handler: ${urlInfo.label}`);
    
    // Load the MBTiles file into the handler
    const loadSuccess = await mbtilesHandler.loadFromBuffer(buffer, (progress) => {
      // Map progress from 0-1 to 0.3-0.5 for loading phase
      const adjustedProgress = 0.3 + (progress * 0.2);
      if (progressCallback) {
        progressCallback(adjustedProgress, `Loading MBTiles: ${urlInfo.label}`);
      }
    });
    
    if (!loadSuccess) {
      throw new Error('Failed to load MBTiles file');
    }
    
    if (progressCallback) {
      progressCallback(0.5, `Extracting tiles from: ${urlInfo.label}`);
    }
    
    // Extract tiles with a custom path pattern
    const customBaseUrl = `${BASE_PATH}/${urlInfo.tilePath}`;
    console.log(`[edlCache] Extracting tiles with base path: ${customBaseUrl}`);
    
    const extractSuccess = await mbtilesHandler.extractAndCacheTiles(
      TILE_CACHE_NAME,
      (progress, processed, total, message) => {
        // Map progress from 0-1 to 0.5-1.0 for extraction phase
        const adjustedProgress = 0.5 + (progress * 0.5);
        if (progressCallback) {
          progressCallback(
            adjustedProgress,
            `Extracting tiles: ${processed}/${total} - ${urlInfo.label}`
          );
        }
      },
      customBaseUrl
    );
    
    if (!extractSuccess) {
      throw new Error('Failed to extract tiles from MBTiles file');
    }
    
    // Close the database connection
    mbtilesHandler.close();
    
    if (progressCallback) {
      progressCallback(1.0, `Completed: ${urlInfo.label}`);
    }
    
    return {
      success: true,
      tileCount: mbtilesHandler.processedTiles,
      url: urlInfo.url,
      tilePath: urlInfo.tilePath
    };
  } catch (error) {
    // Close database connection if open
    mbtilesHandler.close();
    
    console.error(`[edlCache] Error processing file: ${error.message}`);
    return { 
      success: false, 
      error: error.message, 
      url: urlInfo.url 
    };
  }
}

/**
 * Test the EDL proxy and URL construction to ensure we're getting valid responses
 * @returns {Promise<boolean>} Success status
 */
async function testEDLProxy() {
  try {
    console.log('[edlCache] Testing EDL proxy with new GitHub URL format...');
    
    // Create a test URL using today's UTC date
    const currentDate = new Date();
    const hour = 15; // Use 15 as default test hour
    const pressure = 700; // Use 700 hPa as default test pressure
    
    // Create a Date object with proper UTC time
    const utcDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
    
    // Forecast date is today
    const forecastDate = utcDate.toISOString().slice(0, 10);
    
    // Target date is also today for the test
    const targetDate = forecastDate;
    
    console.log(`[MODIFIED] cacheEdl.js - Using forecast date: ${forecastDate}, target date: ${targetDate} for testing`);
    
    // Format using new URL pattern:
    // arome_vv_forecastDate_forDate_forHour_for_pressure.mbtiles
    const releaseTag = `arome-${forecastDate}`;
    const filename = `arome_vv_${forecastDate}_${targetDate}_${hour.toString().padStart(2, '0')}_${pressure}.mbtiles`;
    const testUrl = `${mbtilesURLBase}${releaseTag}/${filename}`;
    
    console.log(`[MODIFIED] cacheEdl.js - Test URL with new format: ${testUrl}`);
    console.log(`[edlCache] Attempting to fetch (HEAD): ${testUrl}`);
    
    // Attempt a simple HEAD request to check if the endpoint is available
    const headResponse = await fetch(testUrl, { method: 'HEAD' }).catch(e => {
      console.log(`[edlCache] HEAD request error: ${e.message}`);
      return null;
    });
    
    if (!headResponse || !headResponse.ok) {
      console.error(`[edlCache] HEAD request failed with status: ${headResponse ? headResponse.status : 'unknown'}`);
      
      // Try a GET request instead
      console.log(`[edlCache] Attempting to fetch (GET): ${testUrl}`);
      const response = await fetch(testUrl);
      console.log(`[edlCache] GET response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[edlCache] Test GET failed with status ${response.status}`);
        return false;
      }
      
      const contentType = response.headers.get('content-type');
      console.log(`[edlCache] Response content-type: ${contentType}`);
      
      // Check if we're getting an HTML response (possibly an error page)
      if (contentType && contentType.includes('text/html')) {
        console.error('[edlCache] Server returned HTML instead of MBTiles data');
        
        // Get the first part of the response to see the error message
        const cloneResponse = response.clone();
        const text = await cloneResponse.text();
        console.log(`[edlCache] First 500 characters of response: ${text.substring(0, 500)}`);
        return false;
      }
      
      // Check if the response is a proper sqlite file
      const buffer = await response.arrayBuffer();
      console.log(`[edlCache] Received ${buffer.byteLength} bytes for test request`);
      
      const firstBytes = new Uint8Array(buffer.slice(0, 16));
      const header = Array.from(firstBytes).map(b => String.fromCharCode(b)).join('');
      console.log(`[edlCache] File header: ${JSON.stringify(header)}`);
      
      if (!header.startsWith('SQLite format 3')) {
        console.error(`[edlCache] Response is not a SQLite file. Header: ${JSON.stringify(header)}`);
        
        // Get a text representation of the response to see what we're dealing with
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(buffer.slice(0, 1000)); // First 1000 bytes
        console.log(`[edlCache] First 1000 bytes of response: ${text}`);
        
        return false;
      }
      
      console.log('[edlCache] EDL proxy test successful (GET request)');
      return true;
    }
    
    console.log('[edlCache] EDL proxy test successful via HEAD request');
    console.log('[edlCache] HEAD response headers:', Object.fromEntries([...headResponse.headers.entries()]));
    return true;
  } catch (error) {
    console.error(`[edlCache] Error testing EDL proxy: ${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * Saves metadata about the cached EDL tiles to localStorage
 * @param {Array} processedFiles - Array of successfully processed files
 */
async function saveEDLMetadata(processedFiles) {
  try {
    console.log('[edlCache] Saving EDL metadata to localStorage');
    
    // Get existing metadata first
    let metadata = { availableLayers: {} };
    const existingMetadataStr = localStorage.getItem('edl_metadata');
    
    if (existingMetadataStr) {
      try {
        const existingMetadata = JSON.parse(existingMetadataStr);
        if (existingMetadata && existingMetadata.availableLayers) {
          // Use existing metadata as base
          metadata = existingMetadata;
          console.log('[edlCache] Merging with existing metadata:', metadata);
        }
      } catch (parseError) {
        console.error('[edlCache] Error parsing existing metadata, starting fresh:', parseError);
        // Continue with empty metadata
      }
    }
    
    // Organize by date, then by hour, then list available pressure levels
    processedFiles.forEach(file => {
      if (!file.success) return;
      
      // Parse date, hour, and pressure from the tilePath
      // Format is: edl_tiles/YYYY-MM-DD_H_PPPPP
      const pathParts = file.tilePath.split('/');
      const dirName = pathParts[pathParts.length - 1]; // Get the last part
      
      // The important part is matching what we store as the path in buildMBTilesUrlList
      // which is edl_tiles/targetDateStr_hre_isb
      console.log(`[edlCache] Parsing metadata from tilePath: ${file.tilePath}`);
      
      // Parse the components from the directory name (e.g., "2025-03-30_15_700")
      const parts = dirName.split('_');
      if (parts.length !== 3) {
        console.warn(`[edlCache] Could not parse metadata from tilePath: ${file.tilePath}`);
        return;
      }
      
      const date = parts[0];
      const hour = parts[1];
      const pressure = parts[2];
      
      console.log(`[MODIFIED] cacheEdl.js - Parsed metadata: date=${date}, hour=${hour}, pressure=${pressure}`);
      
      // Add to metadata structure
      if (!metadata.availableLayers[date]) {
        metadata.availableLayers[date] = {};
      }
      
      if (!metadata.availableLayers[date][hour]) {
        metadata.availableLayers[date][hour] = [];
      }
      
      // Add pressure if not already in the array
      if (!metadata.availableLayers[date][hour].includes(parseInt(pressure))) {
        metadata.availableLayers[date][hour].push(parseInt(pressure));
      }
    });
    
    // Save to localStorage
    localStorage.setItem('edl_metadata', JSON.stringify(metadata));
    console.log('[edlCache] EDL metadata saved to localStorage:', metadata);
    
    // Also dispatch an event to notify other parts of the application
    const event = new CustomEvent('edl_metadata_updated', { detail: metadata });
    window.dispatchEvent(event);
    
    return metadata;
  } catch (error) {
    console.error('[edlCache] Error saving EDL metadata:', error);
    return null;
  }
}

/**
 * Gets metadata about available EDL layers
 * @returns {Object|null} Metadata object or null if not available
 */
export function getEDLMetadata() {
  try {
    const metadataStr = localStorage.getItem('edl_metadata');
    if (!metadataStr) return null;
    
    return JSON.parse(metadataStr);
  } catch (error) {
    console.error('[edlCache] Error reading EDL metadata:', error);
    return null;
  }
}

/**
 * Checks if any EDL tiles are available
 * @returns {boolean} True if EDL tiles are available
 */
export function hasEDLTiles() {
  const metadata = getEDLMetadata();
  return !!(metadata && metadata.availableLayers && Object.keys(metadata.availableLayers).length > 0);
}

/**
 * Processes all EDL MBTiles files sequentially
 * @param {boolean} isTomorrow - Whether to cache tomorrow's forecast
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheEDLTiles(isTomorrow = false) {
  console.debug(`[edlCache] Starting cacheEDLTiles function for ${isTomorrow ? 'tomorrow' : 'today'}`);
  
  // Get UI elements
  const ui = getProgressUI();
  
  // Show progress UI
  ui.container.style.display = 'flex';
  ui.progressBar.style.width = '0%';
  ui.statusElement.textContent = `Preparing EDL tiles caching for ${isTomorrow ? 'tomorrow' : 'today'}...`;
  ui.countElement.textContent = '0';
  
  try {
    // First test the proxy
    ui.statusElement.textContent = 'Testing EDL proxy connection...';
    const proxyTestResult = await testEDLProxy();
    
    if (!proxyTestResult) {
      throw new Error('EDL proxy test failed. The server may be unavailable or not returning proper MBTiles files.');
    }
    
    // Build URL list with the isTomorrow parameter
    const urlList = buildMBTilesUrlList(isTomorrow);
    const totalFiles = urlList.length;
    ui.totalElement.textContent = totalFiles;
    
    console.debug(`[edlCache] Starting to cache ${totalFiles} EDL MBTiles files for ${isTomorrow ? 'tomorrow' : 'today'}`);
    
    // Process files sequentially
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let totalTiles = 0;
    
    // Keep track of successfully processed files for metadata
    const processedFiles = [];
    
    // Setup a function to update UI with progress information
    let lastUpdateTime = 0;
    const updateThreshold = 300; // ms
    
    const updateProgressUI = (progress, message) => {
      const now = Date.now();
      if (now - lastUpdateTime < updateThreshold && progress < 1.0) {
        return; // Skip update if not enough time has passed
      }
      
      lastUpdateTime = now;
      ui.progressBar.style.width = `${progress * 100}%`;
      
      if (message) {
        ui.statusElement.textContent = message;
      }
    };
    
    for (let i = 0; i < urlList.length; i++) {
      const urlInfo = urlList[i];
      const fileNumber = i + 1;
      
      // Update UI with current file info
      updateProgressUI(
        processed / totalFiles,
        `Processing file ${fileNumber}/${totalFiles}: ${urlInfo.label}`
      );
      
      try {
        // Process current file
        const result = await downloadAndExtractMBTiles(urlInfo, (fileProgress, message) => {
          // Calculate overall progress: completed files + progress on current file
          const overallProgress = (processed + fileProgress) / totalFiles;
          updateProgressUI(overallProgress, message);
        });
        
        // Update counters
        processed++;
        ui.countElement.textContent = processed;
        
        if (result.success) {
          succeeded++;
          totalTiles += result.tileCount || 0;
          
          // Add to processed files for metadata
          processedFiles.push(result);
        } else {
          failed++;
          console.error(`[edlCache] Failed to process file: ${result.url}`, result.error);
        }
      } catch (error) {
        // Handle any uncaught errors during processing
        processed++;
        failed++;
        ui.countElement.textContent = processed;
        console.error(`[edlCache] Unexpected error processing file: ${urlInfo.url}`, error);
      }
      
      // Update overall progress
      const totalProgress = processed / totalFiles;
      ui.progressBar.style.width = `${totalProgress * 100}%`;
    }
    
    // Completion
    ui.progressBar.style.width = '100%';
    
    const summaryMessage = `Completed: ${succeeded} files processed, ${totalTiles} tiles extracted, ${failed} files failed`;
    ui.statusElement.textContent = summaryMessage;
    console.debug(`[edlCache] ${summaryMessage}`);
    
    // No completion alert, just show status in UI
    
    // Hide progress UI after a delay
    setTimeout(() => {
      ui.container.style.display = 'none';
    }, 5000);
    
    // Save metadata about the cached tiles
    await saveEDLMetadata(processedFiles);
    
    // After successful caching, show the EDL navigation button if it's not already visible
    if (succeeded > 0) {
      console.log('[edlCache] EDL tiles cached successfully, showing navigation button');
      const button = document.getElementById('toggleEDLNavigationBtn');
      if (button && button.style.display === 'none') {
          button.style.display = '';
          console.log('[Dock] EDL navigation toggle button shown after download');
      }
    }
    
    return {
      success: true,
      processed: processed,
      succeeded: succeeded,
      failed: failed,
      totalTiles: totalTiles
    };
  } catch (error) {
    console.error('[edlCache] Error in caching process:', error);
    
    // Show error in UI
    ui.statusElement.textContent = `Error: ${error.message}`;
    ui.progressBar.classList.add('progress-bar-error');
    
    // Show error alert
    setTimeout(() => {
      alert(`EDL Weather Forecast Caching Error: ${error.message}`);
    }, 500);
    
    // Hide progress UI after a delay
    setTimeout(() => {
      ui.container.style.display = 'none';
      // Reset progress bar color
      ui.progressBar.classList.remove('progress-bar-error');
    }, 5000);
    
    return {
      success: false,
      error: error.message
    };
  }
} 