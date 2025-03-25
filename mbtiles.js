/**
 * MBTiles Handler for MountainCircles Map
 * Provides core functionality for working with MBTiles files
 */

// Import path utilities
import { latLngToTile } from './utils.js';
import { BASE_PATH } from './config.js';

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
   * Extract and cache tiles to browser cache
   * @param {string} cacheName - Cache name to use
   * @param {Function} progressCallback - Callback for extraction progress
   * @returns {Promise<boolean>} Success status
   */
  async extractAndCacheTiles(cacheName, progressCallback) {
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
      
      // Open the cache
      const cache = await caches.open(cacheName);
      
      // Get all tiles
      const tiles = await this.getAllTiles();
      
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
        
        // Process batch in parallel
        await Promise.all(batch.map(async (tile) => {
          try {
            // Determine tile URL with absolute path
            const url = `${BASE_PATH}/tiles/${tile.z}/${tile.x}/${tile.y}.png`;
            
            // Determine content type based on metadata
            let contentType = 'image/png';
            if (this.metadata && this.metadata.format) {
              if (['jpg', 'jpeg'].includes(this.metadata.format.toLowerCase())) {
                contentType = 'image/jpeg';
              } else if (['pbf', 'mvt'].includes(this.metadata.format.toLowerCase())) {
                contentType = 'application/x-protobuf';
              }
            }
            
            // Create response from tile data
            const response = new Response(
              new Blob([tile.data], { type: contentType }),
              { 
                status: 200,
                headers: { 'Content-Type': contentType }
              }
            );
            
            // Cache the response
            await cache.put(url, response);
            
            // Update progress count
            this.processedTiles++;
            this.extractionProgress = this.processedTiles / this.totalTiles;
            
            // No individual tile progress updates to prevent UI flickering
          } catch (error) {
            console.error('[DEBUG] Error processing tile:', error);
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
            `Extracting tiles: batch ${batchIndex + 1}/${totalBatches}`
          );
        }
      }
      
      // Final progress update
      if (typeof progressCallback === 'function') {
        progressCallback(
          1.0,
          this.processedTiles,
          this.totalTiles,
          'Tile extraction complete!'
        );
      }
      
      console.log(`[DEBUG] Extracted ${this.processedTiles} tiles from MBTiles file`);
      return true;
    } catch (error) {
      console.error('[DEBUG] Error extracting tiles:', error);
      return false;
    }
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