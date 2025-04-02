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
 * @param {boolean} useYesterdayForecast - Whether to use yesterday's forecast data
 * @returns {Array} Array of URL objects with metadata
 */
function buildMBTilesUrlList(isTomorrow = false, useYesterdayForecast = false) {
  // Use current date in UTC
  const cdate = new Date();
  const dayList = [cdate];
  
  const urlList = [];
  
  // Get the forecast date (today in UTC or yesterday if useYesterdayForecast is true)
  const utcToday = new Date(Date.UTC(cdate.getUTCFullYear(), cdate.getUTCMonth(), cdate.getUTCDate()));
  
  // If useYesterdayForecast is true, subtract 24 hours to get yesterday's date
  const forecastDate = useYesterdayForecast 
    ? new Date(utcToday.getTime() - 86400000) 
    : utcToday;
  
  const forecastDateStr = forecastDate.toISOString().slice(0, 10);
  
  // Create a list of dates to fetch - today or tomorrow based on parameter
  const targetDates = [];
  
  if (isTomorrow) {
    // Create tomorrow's date by adding 24 hours (86400000 milliseconds) to today's UTC date
    // This properly handles month/year boundaries
    const utcTomorrow = new Date(utcToday.getTime() + 86400000);
    targetDates.push(utcTomorrow);
    console.log(`[MODIFIED] cacheEdl.js - Getting ${useYesterdayForecast ? 'yesterday\'s' : 'today\'s'} forecast for tomorrow:`, utcTomorrow.toISOString().slice(0, 10));
  } else {
    // Today
    targetDates.push(utcToday);
    console.log(`[MODIFIED] cacheEdl.js - Getting ${useYesterdayForecast ? 'yesterday\'s' : 'today\'s'} forecast for today:`, utcToday.toISOString().slice(0, 10));
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
        
        console.log(`[MODIFIED] cacheEdl.js - Created URL for ${isTomorrow ? 'tomorrow' : 'today'} using ${useYesterdayForecast ? 'yesterday\'s' : 'today\'s'} forecast: ${url}`);
        
        // UPDATED: Include forecast date in the tile path
        // Format: edl_tiles/forecastDateStr/targetDateStr_hre_isb
        const tilePath = `edl_tiles/${forecastDateStr}/${targetDateStr}_${hre}_${isb}`;
        
        urlList.push({
          forecastDate: new Date(forecastDate), // The date the forecast was issued (could be yesterday)
          date: new Date(targetDate), // The date the forecast is for (today or tomorrow)
          isobare: isb, // Now in hPa
          hour: hre,
          label: `${targetDateStr} ${hre}:00 - ${isb}hPa (${useYesterdayForecast ? 'Yesterday\'s forecast' : 'Today\'s forecast'})`, 
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
    
    // Organize by forecast date, then target date, then by hour, then list available pressure levels
    processedFiles.forEach(file => {
      if (!file.success) return;
      
      // Parse forecast date, target date, hour, and pressure from the tilePath
      // Updated format: edl_tiles/forecastDate/targetDate_hour_pressure
      const pathParts = file.tilePath.split('/');
      
      // Should have at least 3 parts
      if (pathParts.length < 3) {
        console.warn(`[edlCache] Invalid tilePath format: ${file.tilePath}`);
        return;
      }
      
      // Get the forecast date (second part)
      const forecastDate = pathParts[1];
      
      // Get the last part which contains targetDate_hour_pressure
      const dirName = pathParts[pathParts.length - 1];
      
      console.log(`[edlCache] Parsing metadata from tilePath: ${file.tilePath}`);
      console.log(`[edlCache] Forecast date: ${forecastDate}, target info: ${dirName}`);
      
      // Parse the components from the directory name (e.g., "2025-03-30_15_700")
      const parts = dirName.split('_');
      if (parts.length !== 3) {
        console.warn(`[edlCache] Could not parse target info from: ${dirName}`);
        return;
      }
      
      const targetDate = parts[0];
      const hour = parseInt(parts[1]);
      const pressure = parseInt(parts[2]);
      
      console.log(`[edlCache] Adding to metadata: forecastDate=${forecastDate}, targetDate=${targetDate}, hour=${hour}, pressure=${pressure}`);
      
      // Add to metadata structure
      if (!metadata.availableLayers[forecastDate]) {
        metadata.availableLayers[forecastDate] = {};
      }
      
      if (!metadata.availableLayers[forecastDate][targetDate]) {
        metadata.availableLayers[forecastDate][targetDate] = {};
      }
      
      if (!metadata.availableLayers[forecastDate][targetDate][hour]) {
        metadata.availableLayers[forecastDate][targetDate][hour] = [];
      }
      
      // Add pressure if not already in the array
      if (!metadata.availableLayers[forecastDate][targetDate][hour].includes(pressure)) {
        metadata.availableLayers[forecastDate][targetDate][hour].push(pressure);
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
    
    const metadata = JSON.parse(metadataStr);
    
    // If metadata doesn't have the lastUsedForecastDate field, add it
    if (metadata && metadata.availableLayers && !metadata.lastUsedForecastDate) {
      // Set the most recent forecast date as the default
      const forecastDates = Object.keys(metadata.availableLayers);
      if (forecastDates.length > 0) {
        // Sort dates in descending order (newest first)
        forecastDates.sort((a, b) => new Date(b) - new Date(a));
        metadata.lastUsedForecastDate = forecastDates[0];
        
        // Save the updated metadata
        localStorage.setItem('edl_metadata', JSON.stringify(metadata));
      }
    }
    
    return metadata;
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
 * @param {boolean} useYesterdayForecast - Whether to use yesterday's forecast data for today
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheEDLTiles(isTomorrow = false, useYesterdayForecast = false) {
  console.debug(`[edlCache] Starting cacheEDLTiles function for ${isTomorrow ? 'tomorrow' : 'today'} using ${useYesterdayForecast ? 'yesterday\'s' : 'today\'s'} forecast`);
  
  // Get UI elements
  const ui = getProgressUI();
  
  // Show progress UI
  ui.container.style.display = 'flex';
  ui.progressBar.style.width = '0%';
  ui.statusElement.textContent = `Preparing EDL tiles caching for ${isTomorrow ? 'tomorrow' : 'today'} using ${useYesterdayForecast ? 'yesterday\'s' : 'today\'s'} forecast...`;
  ui.countElement.textContent = '0';
  
  try {
    // First test the proxy
    ui.statusElement.textContent = 'Testing EDL proxy connection...';
    const proxyTestResult = await testEDLProxy();
    
    if (!proxyTestResult) {
      throw new Error('EDL proxy test failed. The server may be unavailable or not returning proper MBTiles files.');
    }
    
    // Build URL list with the isTomorrow and useYesterdayForecast parameters
    const urlList = buildMBTilesUrlList(isTomorrow, useYesterdayForecast);
    
    // NEW: Check existing metadata to skip already cached files
    const existingMetadata = getEDLMetadata() || { availableLayers: {} };
    console.log('[edlCache] Checking existing metadata:', existingMetadata);
    
    // Filter the URL list to only include files that aren't already cached
    const filteredUrlList = urlList.filter(urlInfo => {
      // Parse the components from the tilePath using the new structure
      // Format is now: edl_tiles/forecastDate/targetDate_hour_pressure
      const pathParts = urlInfo.tilePath.split('/');
      
      if (pathParts.length < 3) {
        console.warn(`[edlCache] Could not parse path structure: ${urlInfo.tilePath}`);
        return true; // Include this file since we can't determine if it's cached
      }
      
      const forecastDate = pathParts[1];
      const dirName = pathParts[pathParts.length - 1];
      const parts = dirName.split('_');
      
      if (parts.length !== 3) {
        console.warn(`[edlCache] Could not parse components from: ${dirName}`);
        return true; // Include this file since we can't determine if it's cached
      }
      
      const targetDate = parts[0];
      const hour = parseInt(parts[1]);
      const pressure = parseInt(parts[2]);
      
      // Check if this combination exists in metadata with the new structure
      const isAlreadyCached = 
        existingMetadata.availableLayers[forecastDate] && 
        existingMetadata.availableLayers[forecastDate][targetDate] && 
        existingMetadata.availableLayers[forecastDate][targetDate][hour] && 
        existingMetadata.availableLayers[forecastDate][targetDate][hour].includes(pressure);
      
      if (isAlreadyCached) {
        console.log(`[edlCache] Skipping already cached file: ${urlInfo.label} (forecast: ${forecastDate})`);
      }
      
      return !isAlreadyCached; // Only include files that aren't already cached
    });
    
    const skippedCount = urlList.length - filteredUrlList.length;
    console.log(`[edlCache] Skipping ${skippedCount} already cached files. Processing ${filteredUrlList.length} files.`);
    
    // If all files are already cached, show success message and return
    if (filteredUrlList.length === 0) {
      ui.statusElement.textContent = `All ${urlList.length} files are already cached. Nothing to download.`;
      ui.progressBar.style.width = '100%';
      
      // Hide progress UI after a delay
      setTimeout(() => {
        ui.container.style.display = 'none';
      }, 3000);
      
      return {
        success: true,
        message: 'All files already cached',
        filesProcessed: 0,
        filesSkipped: skippedCount
      };
    }
    
    const totalFiles = filteredUrlList.length;
    ui.totalElement.textContent = totalFiles;
    
    console.debug(`[edlCache] Starting to cache ${totalFiles} EDL MBTiles files for ${isTomorrow ? 'tomorrow' : 'today'} using ${useYesterdayForecast ? 'yesterday\'s' : 'today\'s'} forecast`);
    
    // Process files sequentially
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let totalTiles = 0;
    
    // Keep track of successfully processed files for metadata
    const processedFiles = [];
    
    // Setup a function to update UI with progress information
    let lastUpdateTime = 0;
    const updateThreshold = 300;
    
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
    
    // Process each file in sequence
    for (const urlInfo of filteredUrlList) {
      // Update progress UI
      processed++;
      ui.countElement.textContent = processed;
      ui.progressBar.style.width = `${(processed / totalFiles) * 100}%`;
      ui.statusElement.textContent = `Processing ${processed}/${totalFiles}: ${urlInfo.label}`;
      
      console.log(`[edlCache] Processing file ${processed}/${totalFiles}: ${urlInfo.label}`);
      
      // Process the file with progress updates
      const result = await downloadAndExtractMBTiles(urlInfo, (progress, message) => {
        // Only update UI if progress has changed significantly or message has changed
        const currentTime = Date.now();
        if (currentTime - lastUpdateTime > updateThreshold) {
          // Calculate overall progress:
          // - File progress counts for current file (0-1)
          // - Each completed file counts for 1 unit
          const overallProgress = ((processed - 1) + progress) / totalFiles;
          ui.progressBar.style.width = `${overallProgress * 100}%`;
          ui.statusElement.textContent = `${message} (${processed}/${totalFiles})`;
          lastUpdateTime = currentTime;
        }
      });
      
      // Track result
      if (result.success) {
        succeeded++;
        totalTiles += result.tileCount || 0;
        console.log(`[edlCache] Successfully processed: ${urlInfo.label}`);
      } else {
        failed++;
        console.error(`[edlCache] Failed to process: ${urlInfo.label} - ${result.error}`);
      }
      
      // Add to processed files list
      processedFiles.push(result);
      
      // NEW: Update metadata after each successful file to handle interruptions
      if (result.success) {
        await saveEDLMetadataIncremental([result]);
      }
    }
    
    // Completion
    ui.progressBar.style.width = '100%';
    
    const summaryMessage = `Completed: ${succeeded} files processed, ${totalTiles} tiles extracted, ${failed} files failed`;
    ui.statusElement.textContent = summaryMessage;
    console.debug(`[edlCache] ${summaryMessage}`);
    
    // Status text
    ui.statusElement.textContent = `Completed caching EDL tiles: ${succeeded} successful, ${failed} failed, ${totalTiles} total tiles`;
    
    // Hide progress UI after a delay
    setTimeout(() => {
      ui.container.style.display = 'none';
    }, 5000);
    
    // After successful caching, show the EDL navigation button if it's not already visible
    if (succeeded > 0) {
      console.log('[edlCache] EDL tiles cached successfully, showing navigation button');
      const button = document.getElementById('toggleEDLNavigationBtn');
      if (button && button.style.display === 'none') {
          button.style.display = '';
          console.log('[Dock] EDL navigation toggle button shown after download');
      }
      
      // Update the forecast date dropdown to show newly cached dates
      try {
        // Dynamically import edlUI module to avoid circular dependencies
        const module = await import('./edlUI.js');
        // Check if the function exists before calling it
        if (typeof module.updateForecastDateOptions === 'function') {
            console.log('[Cache EDL] Updating forecast date options after caching');
            module.updateForecastDateOptions();
        }
      } catch (error) {
        console.error('[Cache EDL] Error updating forecast date options:', error);
      }
    }
    
    return {
      success: true,
      filesProcessed: succeeded + failed,
      filesSucceeded: succeeded,
      filesFailed: failed,
      totalTiles: totalTiles
    };
  } catch (error) {
    console.error(`[edlCache] Error caching EDL tiles:`, error);
    
    // Update UI with error
    ui.statusElement.textContent = `Error: ${error.message}`;
    ui.progressBar.style.width = '100%';
    ui.progressBar.style.backgroundColor = '#ff3333';
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Saves metadata for a single or set of processed files incrementally
 * This is similar to saveEDLMetadata but designed to be called after each file
 * @param {Array} newlyProcessedFiles - Array of successfully processed files
 */
async function saveEDLMetadataIncremental(newlyProcessedFiles) {
  try {
    console.log('[edlCache] Incrementally updating EDL metadata');
    
    // Get existing metadata first
    let metadata = { availableLayers: {} };
    const existingMetadataStr = localStorage.getItem('edl_metadata');
    
    if (existingMetadataStr) {
      try {
        const existingMetadata = JSON.parse(existingMetadataStr);
        if (existingMetadata && existingMetadata.availableLayers) {
          // Use existing metadata as base
          metadata = existingMetadata;
          console.log('[edlCache] Using existing metadata as base');
        }
      } catch (parseError) {
        console.error('[edlCache] Error parsing existing metadata, starting fresh:', parseError);
        // Continue with empty metadata
      }
    }
    
    // Add only the new successful files to metadata
    newlyProcessedFiles.forEach(file => {
      if (!file.success) return;
      
      // Parse date, hour, and pressure from the tilePath
      // Updated to handle new path format: edl_tiles/forecastDate/targetDate_hour_pressure
      const pathParts = file.tilePath.split('/');
      
      // Should have at least 3 parts: edl_tiles/forecastDate/targetDate_hour_pressure
      if (pathParts.length < 3) {
        console.warn(`[edlCache] Invalid tilePath format: ${file.tilePath}`);
        return;
      }
      
      // Get the forecast date (second part)
      const forecastDate = pathParts[1];
      
      // Get the last part which contains targetDate_hour_pressure
      const dirName = pathParts[pathParts.length - 1];
      
      console.log(`[edlCache] Parsing metadata from tilePath: ${file.tilePath}`);
      console.log(`[edlCache] Forecast date: ${forecastDate}, target info: ${dirName}`);
      
      // Parse the components from the directory name (e.g., "2025-03-30_15_700")
      const parts = dirName.split('_');
      if (parts.length !== 3) {
        console.warn(`[edlCache] Could not parse target info from: ${dirName}`);
        return;
      }
      
      const targetDate = parts[0];
      const hour = parseInt(parts[1]);
      const pressure = parseInt(parts[2]);
      
      console.log(`[edlCache] Incrementally adding to metadata: forecastDate=${forecastDate}, targetDate=${targetDate}, hour=${hour}, pressure=${pressure}`);
      
      // Update metadata structure to include forecast date
      if (!metadata.availableLayers[forecastDate]) {
        metadata.availableLayers[forecastDate] = {};
      }
      
      if (!metadata.availableLayers[forecastDate][targetDate]) {
        metadata.availableLayers[forecastDate][targetDate] = {};
      }
      
      if (!metadata.availableLayers[forecastDate][targetDate][hour]) {
        metadata.availableLayers[forecastDate][targetDate][hour] = [];
      }
      
      // Add pressure if not already in the array
      if (!metadata.availableLayers[forecastDate][targetDate][hour].includes(pressure)) {
        metadata.availableLayers[forecastDate][targetDate][hour].push(pressure);
      }
    });
    
    // Save to localStorage
    localStorage.setItem('edl_metadata', JSON.stringify(metadata));
    console.log('[edlCache] EDL metadata incrementally updated in localStorage');
    
    // Dispatch an event to notify other parts of the application
    const event = new CustomEvent('edl_metadata_updated', { detail: metadata });
    window.dispatchEvent(event);
    
    return metadata;
  } catch (error) {
    console.error('[edlCache] Error saving incremental EDL metadata:', error);
    return null;
  }
} 