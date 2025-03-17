/**
 * Configuration file for MountainCircles Map
 * Contains constants, settings, and configuration objects
 */

// Import color mappings
import { COLOR_MAPPING, AIRSPACE_TYPE_ORDER } from "./mappings.js";

// Automatically determine if we're on GitHub Pages or running locally
function getBasePath() {
    if (typeof window === 'undefined') {
        // If running in a non-browser environment (like Node.js)
        return '.';
    }

    try {
        console.log('Config.js - Location:', {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            pathname: window.location.pathname,
            href: window.location.href
        });
        
        // Check for GitHub Pages site
        if (window.location.hostname === 'gabriel-briffe.github.io') {
            console.log('Config.js - Detected GitHub Pages site');
            // Use exact case for repository name
            return '/MountainCircles---map';
        }
        
        // Check for repository name in path as fallback
        const pathname = window.location.pathname;
        const pathSegments = pathname.split('/').filter(segment => segment);
        
        // If path includes our repository name with correct case
        if (pathSegments.length > 0 && pathSegments[0] === 'MountainCircles---map') {
            console.log('Config.js - Detected repository in path');
            return '/MountainCircles---map';
        }
        
        // Otherwise, we're running locally
        console.log('Config.js - Using local development path');
        return '.';
    } catch (e) {
        console.error('Error in getBasePath:', e);
        return '.';
    }
}

// Base path for API requests - automatically detects environment
export const BASE_PATH = getBasePath();

// Default text size for labels
export const DEFAULT_TEXT_SIZE = 14;

// Map bounds
export const MAP_BOUNDS = [[4.9698169, 43.6088902], [13.696105, 47.5644488]];
export const MAP_MAX_BOUNDS = [[4.57526, 43.45699], [13.96581, 47.98810]];

// Default visibility settings
export const DEFAULT_PEAKS_VISIBLE = true;
export const DEFAULT_PASSES_VISIBLE = true;

// Policy configurations
export const POLICIES = {
    'alps': [
        '10-100-250-4200',
        '20-100-250-4200',
        '25-100-250-4200',
        '30-100-250-4200',
    ],
    'West_alps_with_fields': [
        '10-100-250-4200',
        '20-100-250-4200',
        '25-100-250-4200',
        '30-100-250-4200',
    ]
};

// Default policy and configuration
export const DEFAULT_POLICY = 'alps';
export const DEFAULT_CONFIG = DEFAULT_POLICY + '/' + '20-100-250-4200';

// Cache settings
export const CACHE_NAME = 'mountaincircles-dynamic-v1';
export const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Map settings
export const MAP_SETTINGS = {
    maxZoom: 16,
    fitBoundsOptions: {
        padding: 50,
        maxZoom: 12,
        duration: 1000
    },
    attributionControl: false,
    renderWorldCopies: false
};

// Tile caching settings
export const TILE_CACHE_SETTINGS = {
    minZoom: 1,
    maxZoom: 12,
    basePath: './tiles'
};

// Re-export color mappings for convenience
export { COLOR_MAPPING, AIRSPACE_TYPE_ORDER }; 