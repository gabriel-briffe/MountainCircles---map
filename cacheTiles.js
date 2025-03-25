/**
 * Tile caching module for MountainCircles Map
 * Handles MBTiles extraction for offline tile caching
 */

import mbtilesHandler from './mbtiles.js';

// Cache name to use for tiles (must match the one used in sw.js)
const TILE_CACHE_NAME = 'mountaincircles-tiles-v1';

/**
 * Gets the existing progress UI elements
 * @returns {Object} Progress UI elements
 */
function getProgressUI() {
  const progressElement = document.getElementById('mapCacheProgress');
  const progressBar = document.getElementById('mapProgressBar');
  const countElement = document.getElementById('mapCacheCount');
  const totalElement = document.getElementById('mapTotalTiles');
  
  // Create status text element if it doesn't exist
  let statusElement = progressElement.querySelector('.status-text');
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.className = 'status-text';
    statusElement.style.marginBottom = '5px';
    
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
 * Caches map tiles from an MBTiles file
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheTilesFromMBTiles() {
  console.log('[DEBUG] Starting MBTiles import process');
  
  // Get existing progress UI
  const ui = getProgressUI();
  ui.container.style.display = 'block';
  ui.progressBar.style.width = '0%';
  ui.statusElement.textContent = 'Select an MBTiles file...';
  ui.countElement.textContent = '0';
  ui.totalElement.textContent = '0';
  
  try {
    // Prompt for MBTiles file
    const file = await selectMBTilesFile();
    
    if (!file) {
      console.log('[DEBUG] No file selected');
      ui.container.style.display = 'none';
      return { success: false, canceled: true };
    }
    
    // Display file info
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    ui.statusElement.textContent = `Loading ${file.name} (${fileSizeMB} MB)`;
    console.log(`[DEBUG] Selected file: ${file.name} (${fileSizeMB} MB)`);
    
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
    const loadSuccess = await mbtilesHandler.loadFile(file, (progress, loaded, total, message) => {
      updateProgressUI(progress, 0, 0, message || `Loading file (${(loaded / (1024 * 1024)).toFixed(2)}/${(total / (1024 * 1024)).toFixed(2)} MB)`);
    });
    
    if (!loadSuccess) {
      throw new Error('Failed to load MBTiles file');
    }
    
    // Extract and cache tiles
    const extractSuccess = await mbtilesHandler.extractAndCacheTiles(
      TILE_CACHE_NAME, 
      (progress, processed, total, message) => {
        updateProgressUI(progress, processed, total, message || 'Extracting tiles...');
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
    ui.progressBar.style.backgroundColor = '#f44336'; // Red for error
    
    // Close database connection if open
    mbtilesHandler.close();
    
    // Hide the progress overlay after a delay
    setTimeout(() => {
      ui.container.style.display = 'none';
      // Reset the progress bar color
      ui.progressBar.style.backgroundColor = '#4CAF50';
    }, 5000);
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Main cacheTiles function - directly uses MBTiles extraction
 * @returns {Promise<Object>} Result of the caching operation
 */
export async function cacheTiles() {
  return cacheTilesFromMBTiles();
} 