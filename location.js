/**
 * Location tracking module for MountainCircles Map
 * Handles user location tracking, heading calculation, and position history
 */

import { getLayerManager, getMap, getGeolocationEnabled, setGeolocationEnabled, getNavboxesEnabled, setNavboxesEnabled, 
    setLastSuccessfulPositionTime, setGeolocationErrorState, GEOLOCATION_STATE, setLastPositionError, checkPositionStaleness, getLastSuccessfulPositionTime } from "./state.js";
import { initNavboxes, updateNavboxesWithPosition, updateNavboxesState, updateNavboxesByErrorState } from "./navboxManager.js";
import { isMobileDevice } from "./utils.js";


// Track previous positions to calculate heading
const positionHistory = [];
const MAX_HISTORY_LENGTH = 2; // Store only the last 2 positions

// Last calculated heading (degrees, 0-360, 0 = north)
let currentHeading = 0;

// Position check interval ID
let positionCheckIntervalId = null;

/**
 * Debug function to manually set the heading
 * Can be called from the console like: heading(45)
 * @param {number} degrees - The heading in degrees (0-360)
 */
export function heading(degrees) {
    // Ensure degrees is a number
    const newHeading = Number(degrees);
    
    // Check if valid number
    if (isNaN(newHeading)) {
        console.error('Heading must be a number (0-360)');
        return;
    }
    
    // Normalize to 0-360
    currentHeading = (newHeading + 360) % 360;
    console.log(`Heading manually set to: ${currentHeading.toFixed(2)}°`);
    
    // Update the marker with the new heading
    const map = getMap();
    if (map) {
        // First, create new rotated icon
        const imageData = createRotatedLocationIcon(currentHeading);
        
        // Remove and re-add the image to force a refresh
        if (map.hasImage('location-icon-rotated')) {
            map.removeImage('location-icon-rotated');
        }
        map.addImage('location-icon-rotated', imageData, { pixelRatio: 1 });
        
        // Update the source to trigger a redraw
        if (getLayerManager().hasSource('location-marker')) {
            // Get the current coordinates if they exist
            let coords = [0, 0];
            try {
                const source = map.getSource('location-marker');
                if (source && source._data && source._data.geometry) {
                    coords = source._data.geometry.coordinates;
                }
            } catch (e) {
                console.warn('Could not get existing coordinates:', e);
            }
            
            // Update the source with the same coordinates but new heading
            getLayerManager().addOrUpdateSource('location-marker', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coords
                    },
                    properties: {
                        heading: currentHeading
                    }
                }
            });
        }
    }
    
    return currentHeading;
}

// Make the function available globally for console access
window.heading = heading;

/**
 * Calculates the heading between two points in degrees
 * @param {Array} start - Start coordinates [longitude, latitude]
 * @param {Array} end - End coordinates [longitude, latitude]
 * @returns {number} Heading in degrees (0-360, 0 = north, clockwise)
 */
export function calculateHeading(start, end) {
    if (!start || !end || start.length < 2 || end.length < 2) {
        return 0;
    }
    
    // Convert to radians
    const startLat = start[1] * Math.PI / 180;
    const startLng = start[0] * Math.PI / 180;
    const endLat = end[1] * Math.PI / 180;
    const endLng = end[0] * Math.PI / 180;
    
    // Calculate heading
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    
    // Normalize to 0-360
    heading = (heading + 360) % 360;
    
    return heading;
}

/**
 * Updates the user's location on the map and calculates heading
 * @param {Object} position - Geolocation position object
 */
export function updateLocation(position) {
    if (!getLayerManager().hasSource('location-marker')) {
        console.warn('Location marker source not found');
        return;
    }
    
    // Update the last successful position time
    setLastSuccessfulPositionTime(Date.now());
    
    // Reset error state since we got a successful position
    setGeolocationErrorState(GEOLOCATION_STATE.OK);
    setLastPositionError(null);
    
    // Update the navboxes appearance based on the error state
    updateNavboxesByErrorState(GEOLOCATION_STATE.OK);
    
    const coords = [position.coords.longitude, position.coords.latitude];
    
    // Update position history
    positionHistory.push(coords);
    
    // Keep only the last MAX_HISTORY_LENGTH positions
    if (positionHistory.length > MAX_HISTORY_LENGTH) {
        positionHistory.shift();
    }
    
    // Calculate heading if we have enough history points
    if (positionHistory.length >= 2) {
        const prevPosition = positionHistory[positionHistory.length - 2];
        const currentPosition = positionHistory[positionHistory.length - 1];
        
        currentHeading = calculateHeading(prevPosition, currentPosition);
        console.log(`Heading: ${currentHeading.toFixed(2)}°`);
    }
    
    // Update the marker rotation
    const map = getMap();
    if (map) {
        // First, create new rotated icon
        const imageData = createRotatedLocationIcon(currentHeading);
        
        // Remove and re-add the image to force a refresh
        if (map.hasImage('location-icon-rotated')) {
            map.removeImage('location-icon-rotated');
        }
        map.addImage('location-icon-rotated', imageData, { pixelRatio: 1 });
    }
    
    // Update the marker with current position and rotation
    getLayerManager().addOrUpdateSource('location-marker', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: coords
            },
            properties: {
                heading: currentHeading
            }
        }
    });
    
    // Update navboxes with position data
    updateNavboxesWithPosition(position);
}

/**
 * Creates a rotated location icon based on the current heading
 * @param {number} heading - The heading in degrees
 * @returns {ImageData} The rotated icon image data
 */
export function createRotatedLocationIcon(heading) {
    // Increase the size for better resolution
    const size = 64; // Increased from 15
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Use antialiasing for smoother edges
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Translate to center
    ctx.translate(size/2, size/2);
    
    // Rotate based on heading
    ctx.rotate(heading * Math.PI / 180);
    
    // Draw elongated triangle pointing north (up in the canvas)
    // Make the triangle proportionally sized to the canvas
    const triangleHeight = size * 0.7; // 70% of canvas height
    const triangleWidth = triangleHeight * 0.5; // Width is half of height
    
    ctx.beginPath();
    ctx.moveTo(0, -triangleHeight/2);             // Top point
    ctx.lineTo(triangleWidth/2, triangleHeight/2); // Bottom right
    ctx.lineTo(-triangleWidth/2, triangleHeight/2); // Bottom left
    ctx.closePath();
    
    // Fill with gradient for better appearance
    const gradient = ctx.createLinearGradient(0, -triangleHeight/2, 0, triangleHeight/2);
    gradient.addColorStop(0, '#4a90e2'); // Lighter blue at the tip
    gradient.addColorStop(1, '#0066FF'); // Darker blue at the base
    ctx.fillStyle = gradient;
    
    // Improved stroke for better visibility
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4; // Scale line width with size
    ctx.lineJoin = 'round'; // Round corners
    
    // Apply shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // Fill and stroke
    ctx.fill();
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    
    // Reset transformation
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    return ctx.getImageData(0, 0, size, size);
}

/**
 * Initializes the location tracker and rotated icon
 */
export function initLocationTracker() {
    
    // Create initial rotated icon
    const map = getMap();
    if (map) {
        try {
            // Force remove any existing image to prevent conflicts
            if (map.hasImage('location-icon-rotated')) {
                map.removeImage('location-icon-rotated');
            }
            
            // Create a fresh icon
            const imageData = createRotatedLocationIcon(0);
            
            // Add the icon
            map.addImage('location-icon-rotated', imageData, { pixelRatio: 1 });
            
            // Initialize an empty source if it doesn't exist
            if (!getLayerManager().hasSource('location-marker')) {
                getLayerManager().addOrUpdateSource('location-marker', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [0, 0]
                        },
                        properties: {
                            heading: 0
                        }
                    }
                });
            }
        } catch (e) {
            console.error('Error initializing location icon:', e);
        }
    } else {
        console.warn('Cannot initialize location tracker - map not available');
    }
}

/**
 * Handles geolocation errors and updates UI accordingly
 * @param {PositionError} error - The position error object
 */
export function handleGeolocationError(error) {
    console.error('Error getting location:', error);
    
    // Save the error
    setLastPositionError(error);
    
    // Handle specific geolocation errors
    switch(error.code) {
        case error.PERMISSION_DENIED:
            // Permission denied is a critical error - disable location features
            setGeolocationErrorState(GEOLOCATION_STATE.ERROR);
            
            // Show alert only if this is a new permission denial, not a recurring check
            if (getGeolocationEnabled()) {
                alert('Geolocation permission denied. Please enable location access in your browser/device settings.');
            }
            
            // Reset toggle state to off
            setGeolocationEnabled(false);
            
            // Also turn off navboxes when geolocation is denied
            if (getNavboxesEnabled()) {
                setNavboxesEnabled(false);
            }
            
            // Update location toggle appearance
            const locationToggle = document.getElementById('location-toggle');
            if (locationToggle) {
                locationToggle.className = 'toggle-switch';
                locationToggle.setAttribute('aria-checked', 'false');
            }
            
            // Also update navboxes toggle appearance
            const navboxesToggle = document.getElementById('navboxes-toggle');
            if (navboxesToggle) {
                navboxesToggle.className = 'toggle-switch';
                navboxesToggle.setAttribute('aria-checked', 'false');
                navboxesToggle.disabled = true;
                navboxesToggle.style.opacity = '0.5';
                navboxesToggle.style.cursor = 'not-allowed';
            }
            
            // Update navboxes state to hide them
            updateNavboxesState();
            
            // Update navboxes appearance - they should show error state
            updateNavboxesByErrorState(GEOLOCATION_STATE.ERROR);
            
            // Clear the position check interval since location is disabled
            clearPositionCheckInterval();
            break;
        
        case error.POSITION_UNAVAILABLE:
        case error.TIMEOUT:
        default:
            // For other errors, we need to check when the last good position was
            const lastTime = getLastSuccessfulPositionTime();
            
            // Set error state based on whether we've ever had a good position
            if (!lastTime) {
                // If we've never had a good position, this is a critical error
                setGeolocationErrorState(GEOLOCATION_STATE.ERROR);
                updateNavboxesByErrorState(GEOLOCATION_STATE.ERROR);
            } else {
                // Let the position staleness checker determine the state
                const errorState = checkPositionStaleness();
                updateNavboxesByErrorState(errorState);
            }
            break;
    }
}

/**
 * Sets up geolocation tracking if available
 */
export function setupGeolocation() {
    // Only set up geolocation on mobile devices
    if (!isMobileDevice()) {
        console.log('Geolocation not set up - not a mobile device');
        return;
    }
    
    // Check if geolocation is enabled in state
    if (!getGeolocationEnabled()) {
        console.log('Geolocation is disabled in settings');
        return;
    }
    
    if ('geolocation' in navigator) {
        // Initialize the location tracker first
        initLocationTracker();
        
        // Initialize the navboxes only if they're enabled in settings
        if (getNavboxesEnabled()) {
            initNavboxes();
        }
        
        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        };
        
        navigator.geolocation.watchPosition(
            updateLocation,
            handleGeolocationError,
            options
        );
        
        // Set up position staleness checking interval
        setupPositionCheckInterval();
    } else {
        console.warn('Geolocation is not supported by this browser.');
        // Remove alert
        
        // Reset location toggle state
        setGeolocationEnabled(false);
        
        // Also turn off navboxes
        if (getNavboxesEnabled()) {
            setNavboxesEnabled(false);
        }
        
        // Update location toggle appearance
        const locationToggle = document.getElementById('location-toggle');
        if (locationToggle) {
            locationToggle.className = 'toggle-switch';
            locationToggle.setAttribute('aria-checked', 'false');
        }
        
        // Also update navboxes toggle appearance
        const navboxesToggle = document.getElementById('navboxes-toggle');
        if (navboxesToggle) {
            navboxesToggle.className = 'toggle-switch';
            navboxesToggle.setAttribute('aria-checked', 'false');
            navboxesToggle.disabled = true;
            navboxesToggle.style.opacity = '0.5';
            navboxesToggle.style.cursor = 'not-allowed';
        }
        
        // Update navboxes state
        updateNavboxesState();
    }
}

/**
 * Sets up an interval to periodically check position staleness
 */
function setupPositionCheckInterval() {
    // Clear any existing interval first
    clearPositionCheckInterval();
    
    // Check position staleness every second
    positionCheckIntervalId = setInterval(() => {
        if (getGeolocationEnabled()) {
            const errorState = checkPositionStaleness();
            updateNavboxesByErrorState(errorState);
        }
    }, 1000);
}

/**
 * Clears the position check interval
 */
function clearPositionCheckInterval() {
    if (positionCheckIntervalId !== null) {
        clearInterval(positionCheckIntervalId);
        positionCheckIntervalId = null;
    }
}

/**
 * Stop geolocation tracking and clean up
 */
export function stopGeolocation() {
    // Clear the position check interval
    clearPositionCheckInterval();
    
    // Reset states
    setGeolocationErrorState(GEOLOCATION_STATE.OK);
    setLastSuccessfulPositionTime(null);
    setLastPositionError(null);
    
    // There's no direct way to stop watchPosition, but we can
    // prevent its effects by setting geolocationEnabled to false
    setGeolocationEnabled(false);
    
    // Hide the location marker
    if (getLayerManager() && getLayerManager().hasLayer('location-marker-triangle')) {
        getLayerManager().setVisibility('location-marker-triangle', false);
    }
    
    console.log('Geolocation tracking stopped');
} 