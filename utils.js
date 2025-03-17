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
