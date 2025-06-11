/**
 * MBTiles Handler for MountainCircles Map
 * Provides core functionality for working with MBTiles files
 */

// Import path utilities
import { latLngToTile } from './utils.js';
import { BASE_PATH } from './config.js';
import { unifiedTileStorage } from './unifiedTileStorage.js';

/**
 * MBTiles handler class
 * Handles loading and extracting tiles from MBTiles files
 */
export class MBTilesHandler {
  constructor() {
    this.db = null;
    this.metadata = null;
    this.isLoaded = false;
    this.extractionProgress = 0;
    this.processedTiles = 0;
    this.totalTiles = 0;
  }

  /**
   * Load an MBTiles file
   * @param {File} file - The MBTiles file to load
   * @param {Function} progressCallback - Callback for load progress
   * @returns {Promise<boolean>} Success status
   */
  async loadFile(file, progressCallback) {
    try {
      // If SQL.js is not loaded, load it
      if (typeof SQL === 'undefined') {
        console.log('[DEBUG] Loading SQL.js library');
        await this.loadSQLJS();
      }
      
      // Read the file
      console.log('[DEBUG] Reading MBTiles file');
      const buffer = await this.readFileAsArrayBuffer(file, progressCallback);
      
      // Create a new database from the file
      console.log('[DEBUG] Creating database from MBTiles file');
      this.db = new SQL.Database(new Uint8Array(buffer));
      
      // Load metadata
      console.log('[DEBUG] Loading metadata from MBTiles file');
      this.metadata = await this.loadMetadata();
      
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('[DEBUG] Error loading MBTiles file:', error);
      return false;
    }
  }

  /**
   * Load an MBTiles file from an ArrayBuffer
   * @param {ArrayBuffer} buffer - The MBTiles data as ArrayBuffer
   * @param {Function} progressCallback - Callback for load progress
   * @returns {Promise<boolean>} Success status
   */
  async loadFromBuffer(buffer, progressCallback) {
    try {
      // If SQL.js is not loaded, load it
      if (typeof SQL === 'undefined') {
        console.log('[DEBUG] Loading SQL.js library');
        await this.loadSQLJS();
      }
      
      // Create a new database from the buffer
      console.log('[DEBUG] Creating database from ArrayBuffer');
      if (progressCallback) {
        progressCallback(0.5, 'Creating database...');
      }
      
      this.db = new SQL.Database(new Uint8Array(buffer));
      
      // Load metadata
      console.log('[DEBUG] Loading metadata from MBTiles file');
      this.metadata = await this.loadMetadata();
      
      if (progressCallback) {
        progressCallback(1.0, 'Database loaded');
      }
      
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('[DEBUG] Error loading MBTiles from buffer:', error);
      return false;
    }
  }

  /**
   * Load the SQL.js library dynamically
   * @returns {Promise<void>}
   */
  async loadSQLJS() {
    return new Promise((resolve, reject) => {
      // Create script element
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js';
      script.onload = async () => {
        try {
          // Initialize SQL.js
          console.log('[DEBUG] SQL.js loaded, initializing');
          const SQL = await initSqlJs({
            locateFile: filename => `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${filename}`
          });
          window.SQL = SQL;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => reject(new Error('Failed to load SQL.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Read a file as ArrayBuffer
   * @param {File} file - The file to read
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<ArrayBuffer>} File contents as ArrayBuffer
   */
  readFileAsArrayBuffer(file, progressCallback) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable && typeof progressCallback === 'function') {
          const progress = event.loaded / event.total;
          progressCallback(progress, event.loaded, event.total, 'Loading MBTiles file...');
        }
      };
      
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Error reading file'));
      
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Load metadata from the MBTiles file
   * @returns {Promise<Object>} Metadata object
   */
  async loadMetadata() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Query the metadata table
      const result = this.db.exec('SELECT name, value FROM metadata');
      
      // If no results, return empty object
      if (!result || !result.length || !result[0].values) {
        return {};
      }
      
      // Convert array of name/value pairs to object
      const metadata = {};
      for (const [name, value] of result[0].values) {
        metadata[name] = value;
      }
      
      console.log('[DEBUG] Loaded metadata:', metadata);
      return metadata;
    } catch (error) {
      console.error('[DEBUG] Error loading metadata:', error);
      return {};
    }
  }

  /**
   * Get all tiles from the MBTiles file
   * @returns {Promise<Array>} Array of tile objects
   */
  async getAllTiles() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Query the tiles table
      const result = this.db.exec(
        'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles'
      );
      
      // If no results, return empty array
      if (!result || !result.length || !result[0].values) {
        return [];
      }
      
      // Convert to array of tile objects
      return result[0].values.map(([zoom, x, tmsY, data]) => {
        // Convert TMS y coordinate to XYZ (flip)
        const y = (1 << zoom) - 1 - tmsY;
        
        return {
          z: zoom,
          x: x,
          y: y,
          data: data
        };
      });
    } catch (error) {
      console.error('[DEBUG] Error getting tiles:', error);
      return [];
    }
  }

  /**
   * Get a tile by coordinates
   * @param {number} z - Zoom level
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Promise<Uint8Array|null>} Tile data or null if not found
   */
  async getTile(z, x, y) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    try {
      // Convert XYZ y coordinate to TMS (flip)
      const tmsY = (1 << z) - 1 - y;
      
      // Query the tiles table
      const result = this.db.exec(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
        [z, x, tmsY]
      );
      
      // If no results, return null
      if (!result || !result.length || !result[0].values.length === 0) {
        return null;
      }
      
      return result[0].values[0][0];
    } catch (error) {
      console.error('[DEBUG] Error getting tile:', error);
      return null;
    }
  }

  /**
   * Extract and store tiles to IndexedDB
   * @param {string} region - Region identifier for the tiles
   * @param {Function} progressCallback - Callback for extraction progress
   * @returns {Promise<boolean>} Success status
   */
  async extractAndStoreToIndexedDB(region, progressCallback) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Count total tiles
      const countResult = this.db.exec("SELECT COUNT(*) FROM tiles");
      this.totalTiles = countResult[0].values[0][0];
      this.processedTiles = 0;
      console.log(`[DEBUG] Total tiles to extract: ${this.totalTiles}`);
      
      // Initial progress update
      if (typeof progressCallback === 'function') {
        progressCallback(
          0,
          0,
          this.totalTiles,
          'Starting tile extraction...'
        );
      }
      
      // Initialize unified IndexedDB storage
      await unifiedTileStorage.initRegionsDB();
      
      // Get all tiles
      const tiles = await this.getAllTiles();
      
      // Determine content type from metadata
      let contentType = 'image/png';
      if (this.metadata && this.metadata.format) {
        if (['jpg', 'jpeg'].includes(this.metadata.format.toLowerCase())) {
          contentType = 'image/jpeg';
        } else if (['pbf', 'mvt'].includes(this.metadata.format.toLowerCase())) {
          contentType = 'application/x-protobuf';
        }
      }
      
      // Store metadata
      await unifiedTileStorage.storeRegionalMetadata(region, this.metadata);
      
      // Determine batch size based on total number of tiles
      const batchSize = this.totalTiles > 5000 ? 100 : 50;
      const totalBatches = Math.ceil(this.totalTiles / batchSize);
      
      // To avoid UI flickering, we'll use a throttled progress update
      let lastUpdateTime = 0;
      const updateThreshold = 500; // Only update UI every 500ms
      
      // Process tiles in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, this.totalTiles);
        const batch = tiles.slice(start, end);
        
        console.log(`[DEBUG] Processing batch ${batchIndex + 1}/${totalBatches}: tiles ${start}-${end}`);
        
        // Process batch in parallel
        await Promise.all(batch.map(async (tile) => {
          try {
            // Log tile processing for debugging
            if (batchIndex === 0 || this.processedTiles % 50 === 0) {
              console.log(`[DEBUG] Storing tile: z:${tile.z}, x:${tile.x}, y:${tile.y}`);
            }
            
            // Store tile to unified IndexedDB
            await unifiedTileStorage.storeRegionalTile(
              tile.z, 
              tile.x, 
              tile.y, 
              tile.data, 
              region, 
              contentType
            );
            
            // Update progress count
            this.processedTiles++;
            this.extractionProgress = this.processedTiles / this.totalTiles;
          } catch (error) {
            console.error(`[DEBUG] Error storing tile ${tile.z}/${tile.x}/${tile.y}:`, error);
          }
        }));
        
        // Only update progress at batch completion and if enough time has passed
        const now = Date.now();
        if (typeof progressCallback === 'function' && (now - lastUpdateTime > updateThreshold || batchIndex === totalBatches - 1)) {
          lastUpdateTime = now;
          progressCallback(
            this.extractionProgress,
            this.processedTiles, 
            this.totalTiles,
            `Storing tiles: batch ${batchIndex + 1}/${totalBatches}`
          );
        }
      }
      
      // Final progress update
      if (typeof progressCallback === 'function') {
        progressCallback(
          1.0,
          this.processedTiles,
          this.totalTiles,
          'Tile storage complete!'
        );
      }
      
      console.log(`[DEBUG] Stored ${this.processedTiles} tiles to IndexedDB for region: ${region}`);
      return true;
    } catch (error) {
      console.error('[DEBUG] Error storing tiles to IndexedDB:', error);
      return false;
    }
  }

  /**
   * Extract and store EDL tiles to unified IndexedDB
   * @param {string} forecastDate - ISO date string for forecast date (e.g., "2024-01-15")
   * @param {Function} progressCallback - Callback for extraction progress
   * @returns {Promise<boolean>} Success status
   */
  async extractAndStoreEDLTiles(forecastDate, progressCallback) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Count total tiles
      const countResult = this.db.exec("SELECT COUNT(*) FROM tiles");
      this.totalTiles = countResult[0].values[0][0];
      this.processedTiles = 0;
      console.log(`[DEBUG] Total EDL tiles to extract: ${this.totalTiles}`);
      
      // Initial progress update
      if (typeof progressCallback === 'function') {
        progressCallback(
          0,
          0,
          this.totalTiles,
          'Starting EDL tile extraction...'
        );
      }
      
      // Initialize EDL IndexedDB storage
      await unifiedTileStorage.initEDLDB();
      
      // Get all tiles
      const tiles = await this.getAllTiles();
      
      // Determine content type from metadata
      let contentType = 'image/png';
      if (this.metadata && this.metadata.format) {
        if (['jpg', 'jpeg'].includes(this.metadata.format.toLowerCase())) {
          contentType = 'image/jpeg';
        } else if (['pbf', 'mvt'].includes(this.metadata.format.toLowerCase())) {
          contentType = 'application/x-protobuf';
        }
      }
      
      // Store metadata
      await unifiedTileStorage.storeEDLMetadata(forecastDate, this.metadata);
      
      // Determine batch size based on total number of tiles
      const batchSize = this.totalTiles > 5000 ? 100 : 50;
      const totalBatches = Math.ceil(this.totalTiles / batchSize);
      
      // To avoid UI flickering, we'll use a throttled progress update
      let lastUpdateTime = 0;
      const updateThreshold = 500; // Only update UI every 500ms
      
      // Process tiles in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, this.totalTiles);
        const batch = tiles.slice(start, end);
        
        console.log(`[DEBUG] Processing EDL batch ${batchIndex + 1}/${totalBatches}: tiles ${start}-${end}`);
        
        // Process batch in parallel
        await Promise.all(batch.map(async (tile) => {
          try {
            // Log tile processing for debugging
            if (batchIndex === 0 || this.processedTiles % 50 === 0) {
              console.log(`[DEBUG] Storing EDL tile: z:${tile.z}, x:${tile.x}, y:${tile.y} for ${forecastDate}`);
            }
            
            // Store tile to EDL IndexedDB
            await unifiedTileStorage.storeEDLTile(
              tile.z, 
              tile.x, 
              tile.y, 
              tile.data, 
              forecastDate,
              contentType
            );
            
            // Update progress count
            this.processedTiles++;
            this.extractionProgress = this.processedTiles / this.totalTiles;
          } catch (error) {
            console.error(`[DEBUG] Error storing EDL tile ${tile.z}/${tile.x}/${tile.y}:`, error);
          }
        }));
        
        // Only update progress at batch completion and if enough time has passed
        const now = Date.now();
        if (typeof progressCallback === 'function' && (now - lastUpdateTime > updateThreshold || batchIndex === totalBatches - 1)) {
          lastUpdateTime = now;
          progressCallback(
            this.extractionProgress,
            this.processedTiles, 
            this.totalTiles,
            `Storing EDL tiles: batch ${batchIndex + 1}/${totalBatches}`
          );
        }
      }
      
      // Final progress update
      if (typeof progressCallback === 'function') {
        progressCallback(
          1.0,
          this.processedTiles,
          this.totalTiles,
          'EDL tile storage complete!'
        );
      }
      
      console.log(`[DEBUG] Stored ${this.processedTiles} EDL tiles to IndexedDB for forecast: ${forecastDate}`);
      return true;
    } catch (error) {
      console.error('[DEBUG] Error storing EDL tiles to IndexedDB:', error);
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility - now uses IndexedDB
   * @param {string} cacheName - Ignored, kept for compatibility
   * @param {Function} progressCallback - Callback for extraction progress
   * @param {string} customBasePath - Used to determine region from path
   * @returns {Promise<boolean>} Success status
   */
  async extractAndCacheTiles(cacheName, progressCallback, customBasePath) {
    // Extract region from customBasePath or use default
    let region = 'default';
    if (customBasePath) {
      const pathParts = customBasePath.split('/');
      region = pathParts[pathParts.length - 1] || 'default';
    }
    
    return this.extractAndStoreToIndexedDB(region, progressCallback);
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isLoaded = false;
    }
  }
}

// Create and export a singleton instance
const mbtilesHandler = new MBTilesHandler();
export default mbtilesHandler; 