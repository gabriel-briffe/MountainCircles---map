/**
 * Unified IndexedDB Tile Storage Service for MountainCircles Map
 * Consolidates all regional tiles into a single database
 * Keeps EDL tiles separate due to different lifecycle
 */

const REGIONS_DB_NAME = 'mountaincircles-regions';
const EDL_DB_NAME = 'mountaincircles-edl';
const DB_VERSION = 1;
const TILES_STORE = 'tiles';
const METADATA_STORE = 'metadata';

class UnifiedTileStorage {
  constructor() {
    this.regionsDB = null;
    this.edlDB = null;
    this.regionsInitPromise = null;
    this.edlInitPromise = null;
  }

  async initRegionsDB() {
    if (this.regionsInitPromise) {
      return this.regionsInitPromise;
    }

    this.regionsInitPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(REGIONS_DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('Failed to open Regions IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.regionsDB = request.result;
        console.log('Regions IndexedDB initialized');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Setting up Regions IndexedDB schema');
        
        // Tiles store: key = "z/x/y", value = tile blob + metadata
        const tilesStore = db.createObjectStore(TILES_STORE, { keyPath: 'id' });
        tilesStore.createIndex('region', 'region', { unique: false });
        tilesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        tilesStore.createIndex('coordinates', ['z', 'x', 'y'], { unique: false });
        
        // Metadata store for region information
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        metadataStore.createIndex('region', 'region', { unique: false });
        
        console.log('Regions IndexedDB schema created');
      };
    });

    return this.regionsInitPromise;
  }

  async initEDLDB() {
    if (this.edlInitPromise) {
      return this.edlInitPromise;
    }

    this.edlInitPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(EDL_DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('Failed to open EDL IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.edlDB = request.result;
        console.log('EDL IndexedDB initialized');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Setting up EDL IndexedDB schema');
        
        // Tiles store for EDL tiles
        const tilesStore = db.createObjectStore(TILES_STORE, { keyPath: 'id' });
        tilesStore.createIndex('forecastDate', 'forecastDate', { unique: false });
        tilesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        tilesStore.createIndex('coordinates', ['z', 'x', 'y'], { unique: false });
        
        // Metadata store for EDL forecast information
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        metadataStore.createIndex('forecastDate', 'forecastDate', { unique: false });
        
        console.log('EDL IndexedDB schema created');
      };
    });

    return this.edlInitPromise;
  }

  // Regional tile methods
  async storeRegionalTile(z, x, y, tileData, region, contentType = 'image/png') {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);
    
    const tileRecord = {
      id: `${z}/${x}/${y}`,
      z, x, y,
      data: tileData,
      contentType,
      region,
      lastAccessed: Date.now(),
      size: tileData.byteLength
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(tileRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async storeMapterhornTile(z, x, y, tileData, contentType = 'image/webp') {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);

    const tileRecord = {
      id: `dem/${z}/${x}/${y}`,
      z, x, y,
      data: tileData,
      contentType,
      region: 'mapterhorn',
      lastAccessed: Date.now(),
      size: tileData.byteLength
    };

    return new Promise((resolve, reject) => {
      const request = store.put(tileRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMapterhornTile(z, x, y) {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(`dem/${z}/${x}/${y}`);

      getRequest.onsuccess = () => {
        const tile = getRequest.result;
        if (tile) {
          tile.lastAccessed = Date.now();
          const updateRequest = store.put(tile);
          updateRequest.onsuccess = () => resolve(tile);
          updateRequest.onerror = () => resolve(tile);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getRegionalTile(z, x, y) {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(`${z}/${x}/${y}`);
      
      getRequest.onsuccess = () => {
        const tile = getRequest.result;
        if (tile) {
          // Update last accessed time
          tile.lastAccessed = Date.now();
          const updateRequest = store.put(tile);
          updateRequest.onsuccess = () => resolve(tile);
          updateRequest.onerror = () => resolve(tile); // Still return tile even if update fails
        } else {
          resolve(null);
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // EDL tile methods
  async storeEDLTile(z, x, y, tileData, forecastDate, contentType = 'image/png') {
    if (!this.edlDB) {
      await this.initEDLDB();
    }

    const transaction = this.edlDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);
    
    const tileRecord = {
      id: `${forecastDate}/${z}/${x}/${y}`,
      z, x, y,
      data: tileData,
      contentType,
      forecastDate,
      lastAccessed: Date.now(),
      size: tileData.byteLength
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(tileRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEDLTile(z, x, y, forecastDate) {
    if (!this.edlDB) {
      await this.initEDLDB();
    }

    const transaction = this.edlDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(`${forecastDate}/${z}/${x}/${y}`);
      
      getRequest.onsuccess = () => {
        const tile = getRequest.result;
        if (tile) {
          // Update last accessed time
          tile.lastAccessed = Date.now();
          const updateRequest = store.put(tile);
          updateRequest.onsuccess = () => resolve(tile);
          updateRequest.onerror = () => resolve(tile); // Still return tile even if update fails
        } else {
          resolve(null);
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Metadata methods
  async storeRegionalMetadata(region, metadata) {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    
    const metadataRecord = {
      id: region,
      region,
      metadata,
      dateStored: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(metadataRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async storeEDLMetadata(forecastDate, metadata) {
    if (!this.edlDB) {
      await this.initEDLDB();
    }

    const transaction = this.edlDB.transaction([METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    
    const metadataRecord = {
      id: forecastDate,
      forecastDate,
      metadata,
      dateStored: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(metadataRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear methods
  async clearRegion(region) {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);
    const index = store.index('region');
    
    return new Promise((resolve, reject) => {
      let deletedCount = 0;
      const request = index.openCursor(region);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`Cleared ${deletedCount} tiles from region: ${region}`);
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clearEDLForecast(forecastDate) {
    if (!this.edlDB) {
      await this.initEDLDB();
    }

    const transaction = this.edlDB.transaction([TILES_STORE], 'readwrite');
    const store = transaction.objectStore(TILES_STORE);
    const index = store.index('forecastDate');
    
    return new Promise((resolve, reject) => {
      let deletedCount = 0;
      const request = index.openCursor(forecastDate);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`Cleared ${deletedCount} EDL tiles from forecast: ${forecastDate}`);
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Storage info methods
  async getStorageInfo() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage,
        available: estimate.quota,
        percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
      };
    }
    return null;
  }

  async getRegionalTileCount(region = null) {
    if (!this.regionsDB) {
      await this.initRegionsDB();
    }

    const transaction = this.regionsDB.transaction([TILES_STORE], 'readonly');
    const store = transaction.objectStore(TILES_STORE);
    
    return new Promise((resolve, reject) => {
      if (region) {
        const index = store.index('region');
        const request = index.count(region);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async getEDLTileCount(forecastDate = null) {
    if (!this.edlDB) {
      await this.initEDLDB();
    }

    const transaction = this.edlDB.transaction([TILES_STORE], 'readonly');
    const store = transaction.objectStore(TILES_STORE);
    
    return new Promise((resolve, reject) => {
      if (forecastDate) {
        const index = store.index('forecastDate');
        const request = index.count(forecastDate);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    });
  }

  // Migration helper to consolidate existing regional databases
  async migrateFromLegacyStorage() {
    console.log('Starting migration from legacy tile storage...');
    
    // List of known legacy databases that might exist
    const legacyRegions = ['alps', 'jura-nord-vosges', 'pyrenees', 'norway'];
    let totalMigrated = 0;

    for (const region of legacyRegions) {
      try {
        const legacyDBName = `mountaincircles-tiles-${region}`;
        
        // Try to open legacy database
        const legacyDB = await new Promise((resolve, reject) => {
          const request = indexedDB.open(legacyDBName);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null); // Database doesn't exist
        });

        if (!legacyDB) {
          console.log(`No legacy database found for region: ${region}`);
          continue;
        }

        console.log(`Migrating tiles from legacy database: ${region}`);
        
        // Get all tiles from legacy database
        const transaction = legacyDB.transaction(['tiles'], 'readonly');
        const store = transaction.objectStore('tiles');
        const tiles = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        // Store tiles in unified database
        let regionMigrated = 0;
        for (const tile of tiles) {
          await this.storeRegionalTile(
            tile.z, tile.x, tile.y, 
            tile.data, 
            tile.region || region, 
            tile.contentType
          );
          regionMigrated++;
        }

        totalMigrated += regionMigrated;
        console.log(`Migrated ${regionMigrated} tiles from region: ${region}`);
        
        legacyDB.close();
        
        // Optional: Delete legacy database after successful migration
        // indexedDB.deleteDatabase(legacyDBName);
        
      } catch (error) {
        console.error(`Error migrating region ${region}:`, error);
      }
    }

    console.log(`Migration completed. Total tiles migrated: ${totalMigrated}`);
    return totalMigrated;
  }
}

// Create and export a singleton instance
export const unifiedTileStorage = new UnifiedTileStorage();

// Legacy compatibility exports
export const tileStorage = {
  async storeTile(z, x, y, tileData, region, contentType) {
    return unifiedTileStorage.storeRegionalTile(z, x, y, tileData, region, contentType);
  },
  async getTile(z, x, y) {
    return unifiedTileStorage.getRegionalTile(z, x, y);
  },
  async clearRegion(region) {
    return unifiedTileStorage.clearRegion(region);
  },
  async storeMetadata(region, metadata) {
    return unifiedTileStorage.storeRegionalMetadata(region, metadata);
  },
  async getStorageInfo() {
    return unifiedTileStorage.getStorageInfo();
  },
  async getTileCount(region) {
    return unifiedTileStorage.getRegionalTileCount(region);
  }
}; 