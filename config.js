/**
 * Configuration file for MountainCircles Map
 * Contains constants, settings, and configuration objects
 */

// Import color mappings
import { COLOR_MAPPING, AIRSPACE_TYPE_ORDER } from "./mappings.js";

// Determine the base path consistently for all modules
function getBasePath() {
    try {
        // Check if we're on GitHub Pages
        if (typeof window !== 'undefined' && window.location) {
            const hostname = window.location.hostname;
            
            if (hostname === 'gabriel-briffe.github.io') {
                return '/MountainCircles---map';
            }

            // Check for Cloudflare Pages custom domain
            if (hostname === 'map.mountain-circles.org') {
                return '';  // Root path for custom domain
            }
            
            // For local development server
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return '';
            }
        }
        
        // Default fallback for other scenarios
        return '.';
    } catch (e) {
        console.error('Config - Error in getBasePath:', e);
        return '.';
    }
}

// R2 data storage base URL via custom domain
function getDataBasePath() {
    // Use custom domain for clean, fast access without proxy
    return 'https://data.mountain-circles.org';
}

// Compute the BASE_PATH
export const BASE_PATH = getBasePath();

// Compute the DATA_BASE_PATH
export const DATA_BASE_PATH = getDataBasePath();

// Also set it as a global for use by service worker during cache updates
if (typeof window !== 'undefined') {
    window.mountainCirclesBasePathForCache = BASE_PATH;
}

// Single cache name for all app resources
export const CACHE_NAME = 'mountaincircles-cache';

// Default text size for labels
export const DEFAULT_TEXT_SIZE = 14;

// Map bounds - REMOVED to allow global map access
// export const MAP_BOUNDS = [[4.9698169, 43.6088902], [13.696105, 47.5644488]];
// export const MAP_MAX_BOUNDS = [[4.57526, 43.45699], [13.96581, 47.98810]];

// Default visibility settings
export const DEFAULT_PEAKS_VISIBLE = true;
export const DEFAULT_PASSES_VISIBLE = true;

// Policy configurations
export const POLICIES = {
    'alpes': [
        '10-100-250-4220',
        '20-100-250-4220',
        '25-100-250-4220',
        '30-100-250-4220',
    ],
    'West_alps_with_fields': [
        '10-100-250-4220',
        '20-100-250-4220',
        '25-100-250-4220',
        '30-100-250-4220',
    ],
    'Pyrenees': [
        '10-100-250-4220',
        '20-100-250-4220',
        '25-100-250-4220',
        '30-100-250-4220',
    ],
    'vosges': [
        '10-100-250-4220',
        '20-100-250-4220',
        '25-100-250-4220',
        '30-100-250-4220',
    ],
    'norway': [
        '10-100-250-4220',
        '20-100-250-4220',
        '25-100-250-4220',
        '30-100-250-4220',
    ]
};

// Default policy and configuration
export const DEFAULT_POLICY = 'alpes';
export const DEFAULT_CONFIG = DEFAULT_POLICY + '/' + '20-100-250-4220';

// Map settings
export const MAP_SETTINGS = {
    maxZoom: 16,
    fitBoundsOptions: {
        padding: 50,
        maxZoom: 12,
        duration: 1000
    },
    attributionControl: false,
    renderWorldCopies: true
};

// Tile caching settings
export const TILE_CACHE_SETTINGS = {
    minZoom: 1,
    maxZoom: 12,
    basePath: './tiles'
};

// Re-export color mappings for convenience
export { COLOR_MAPPING, AIRSPACE_TYPE_ORDER }; 