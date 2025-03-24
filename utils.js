/**
 * Utility functions for MountainCircles Map
 */

/**
 * Checks if the app is running in standalone mode (PWA)
 * @returns {boolean} True if running as standalone app
 */
export function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone ||
            document.referrer.includes('android-app://');
}

/**
 * Checks if the current device is a mobile device
 * @returns {boolean} True if running on a mobile device
 */
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Checks if the current device is running iOS
 * @returns {boolean} True if running on iOS
 */
export function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Requests and maintains a wake lock to prevent screen from sleeping
 * @returns {Promise<Object|null>} The wake lock object or null if not supported/failed
 */
export async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            // Request a screen wake lock
            const wakeLock = await navigator.wakeLock.request('screen');
            
            console.log('Wake lock activated');
            
            // Create a reacquisition function that doesn't cause infinite recursion
            const reacquireWakeLock = async () => {
                if (document.visibilityState === 'visible') {
                    try {
                        // Try to reacquire the wake lock
                        const newWakeLock = await navigator.wakeLock.request('screen');
                        console.log('Wake lock reacquired');
                        
                        // Update the wake lock in the app config if it exists
                        if (window.APP_CONFIG) {
                            window.APP_CONFIG.wakeLock = newWakeLock;
                        }
                        
                        return newWakeLock;
                    } catch (err) {
                        console.error('Failed to reacquire wake lock:', err);
                        return null;
                    }
                }
            };
            
            // Add a listener to reacquire the wake lock if it's released
            document.addEventListener('visibilitychange', reacquireWakeLock);
            
            // Also listen for the page becoming visible again
            wakeLock.addEventListener('release', () => {
                console.log('Wake lock released');
                // Try to reacquire when released (only if page is visible)
                if (document.visibilityState === 'visible') {
                    reacquireWakeLock();
                }
            });
            
            return wakeLock;
        } catch (err) {
            console.error('Failed to request wake lock:', err);
            return null;
        }
    } else {
        console.warn('Wake lock API not supported in this browser');
        return null;
    }
}

/**
 * Converts latitude and longitude to tile coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} zoom - Zoom level
 * @returns {Object} Object with x and y tile coordinates
 */
export function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

/**
 * Converts IGC file content to GeoJSON format
 * @param {string} igcContent - Content of an IGC file
 * @returns {Object} GeoJSON object representing the IGC track
 */
export function igcToGeoJSON(igcContent) {
    const lines = igcContent.split('\n');
    const coordinates = [];
    let metadata = {};

    for (const line of lines) {
        if (line.startsWith('B')) {
            try {
                const time = line.substring(1, 7);
                const latRaw = line.substring(7, 15);
                const latDeg = parseInt(latRaw.substring(0, 2));
                const latMin = parseFloat(latRaw.substring(2, 7)) / 1000;
                const latDir = latRaw.substring(7, 8);
                const lonRaw = line.substring(15, 24);
                const lonDeg = parseInt(lonRaw.substring(0, 3));
                const lonMin = parseFloat(lonRaw.substring(3, 8)) / 1000;
                const lonDir = lonRaw.substring(8, 9);
                const altPressure = parseInt(line.substring(25, 30));
                const altGNSS = parseInt(line.substring(30, 35));

                let latitude = latDeg + (latMin / 60);
                if (latDir === 'S') latitude = -latitude;

                let longitude = lonDeg + (lonMin / 60);
                if (lonDir === 'W') longitude = -longitude;

                const altitude = altPressure > 0 ? altPressure : altGNSS;

                coordinates.push([longitude, latitude, altitude]);
            } catch (error) {
                console.warn('Error parsing B record:', line, error);
            }
        }
        else if (line.startsWith('H')) {
            try {
                const headerType = line.substring(1, 5);
                const headerValue = line.substring(5).trim();

                if (headerType.startsWith('FDT')) metadata.date = headerValue;
                if (headerType.startsWith('FPL')) metadata.pilot = headerValue;
                if (headerType.startsWith('FGT')) metadata.gliderType = headerValue;
                if (headerType.startsWith('FGI')) metadata.gliderID = headerValue;
            } catch (error) {
                console.warn('Error parsing H record:', line, error);
            }
        }
    }

    const geojson = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            properties: {
                ...metadata,
                sourceFormat: 'IGC',
                coordinateProperties: {
                    altitudes: coordinates.map(coord => coord[2])
                }
            }
        }]
    };

    return geojson;
}

/**
 * Get the base path for the application
 * Used for constructing URLs to resources
 * @returns {string} The base path for the application
 */
export function getBasePath() {
    try {
        // Check for GitHub Pages project site
        if (window.location.hostname === 'gabriel-briffe.github.io') {
            return '/MountainCircles---map';
        }
        
        // Check for repository name in path as fallback
        const pathname = window.location.pathname;
        const pathSegments = pathname.split('/').filter(segment => segment);
                    
        // If path includes our repository name with correct case
        if (pathSegments.length > 0 && pathSegments[0] === 'MountainCircles---map') {
            return '/MountainCircles---map';
        }
        
        // Otherwise, we're running locally
        return '.';
    } catch (e) {
        console.error('Error in getBasePath:', e);
        return '.';
    }
}
