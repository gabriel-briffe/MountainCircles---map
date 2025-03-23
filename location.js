/**
 * Location tracking module for MountainCircles Map
 * Handles user location tracking, track calculation, and position history
 */

import { getLayerManager, getMap, getGeolocationEnabled, setGeolocationEnabled, getNavboxesEnabled, setNavboxesEnabled, 
    setLastSuccessfulPositionTime, setGeolocationErrorState, GEOLOCATION_STATE, setLastPositionError, checkPositionStaleness, 
    getLastSuccessfulPositionTime, getLastPosition, setLastPosition, getCurrentTrack, setCurrentTrack } from "./state.js";
import { initNavboxes, updateNavboxesWithPosition, updateNavboxesState, updateNavboxesByErrorState, updateTrack } from "./navboxManager.js";
import { updateToggleStates, setGeolocationStateAndSlider, setNavboxesStateAndSlider } from "./toggleManager.js";

// Throttle for rotation updates
let lastRotationUpdateTime = 0;
const ROTATION_UPDATE_THROTTLE_MS = 250; // Limit updates to 4 per second

// Position check interval ID
let positionCheckIntervalId = null;

/**
 * Debug function to manually set the track
 * Can be called from the console like: track(45)
 * @param {number} degrees - The track in degrees (0-360)
 */
export function track(degrees) {
    // Ensure degrees is a number
    const newTrack = Number(degrees);
    
    // Check if valid number
    if (isNaN(newTrack)) {
        console.error('Track must be a number (0-360)');
        return;
    }
    
    // Normalize to 0-360
    const normalizedTrack = (newTrack + 360) % 360;
    console.log(`Track manually set to: ${normalizedTrack.toFixed(2)}°`);
    
    // Update track in state
    setCurrentTrack(normalizedTrack);
    
    // Update the marker rotation
    // This also updates the track navbox
    updateMarkerRotation(normalizedTrack);
    
    return normalizedTrack;
}

// Make the function available globally for console access
window.track = track;

/**
 * Calculates the distance between two points in meters
 * Currently not used, but kept for future use when minimum distance checks are re-enabled
 * @param {Array} start - Start coordinates [longitude, latitude]
 * @param {Array} end - End coordinates [longitude, latitude]
 * @returns {number} Distance in meters
 */
export function calculateDistance(start, end) {
    if (!start || !end || start.length < 2 || end.length < 2) {
        return 0;
    }
    
    // Convert to radians
    const startLat = start[1] * Math.PI / 180;
    const startLng = start[0] * Math.PI / 180;
    const endLat = end[1] * Math.PI / 180;
    const endLng = end[0] * Math.PI / 180;
    
    // Haversine formula
    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(startLat) * Math.cos(endLat) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    // Earth radius in meters
    const R = 6371000;
    
    // Distance in meters
    return R * c;
}

/**
 * Calculates the track between two points in degrees
 * @param {Array} start - Start coordinates [longitude, latitude]
 * @param {Array} end - End coordinates [longitude, latitude]
 * @returns {number} Track in degrees (0-360, 0 = north, clockwise)
 */
export function calculateTrack(start, end) {
    if (!start || !end || start.length < 2 || end.length < 2) {
        return 0;
    }
    
    // Convert to radians
    const startLat = start[1] * Math.PI / 180;
    const startLng = start[0] * Math.PI / 180;
    const endLat = end[1] * Math.PI / 180;
    const endLng = end[0] * Math.PI / 180;
    
    // Calculate track
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    
    let track = Math.atan2(y, x) * 180 / Math.PI;
    
    // Normalize to 0-360
    track = (track + 360) % 360;
    
    return track;
}

/**
 * Updates the marker position on the map
 * @param {Array} coords - The coordinates [longitude, latitude]
 */
function updateMarkerPosition(coords) {
    const layerManager = getLayerManager();
    if (!layerManager.hasSource('location-marker')) {
        console.warn('Location marker source not found');
        return;
    }
    
    // Get current track once from state
    const currentTrack = getCurrentTrack();
    
    // Update the marker with current position and rotation
    layerManager.addOrUpdateSource('location-marker', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: coords
            },
            properties: {
                track: currentTrack // Use track from state
            }
        }
    });
}

/**
 * Updates the marker rotation based on track
 * @param {number} track - The track in degrees
 */
function updateMarkerRotation(track) {
    const map = getMap();
    if (!map) return;
    
    // Create rotated icon
    const imageData = createRotatedLocationIcon(track);
    
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
        if (!map) return; // Safety check in case map becomes unavailable
        
        // Remove old image
        if (map.hasImage('location-icon-rotated')) {
            map.removeImage('location-icon-rotated');
        }
        // Add new rotated image
        map.addImage('location-icon-rotated', imageData, { pixelRatio: 1 });
    });
    
    // Always update the track navbox to ensure synchronized values
    updateTrack(track);
}

/**
 * Throttled function to update marker rotation
 * Prevents too frequent updates that could cause performance issues
 * @param {number} track - The track in degrees
 */
function throttledUpdateMarkerRotation(track) {
    const now = Date.now();
    if (now - lastRotationUpdateTime > ROTATION_UPDATE_THROTTLE_MS) {
        updateMarkerRotation(track);
        lastRotationUpdateTime = now;
    }
}

/**
 * Updates the user's location on the map and calculates track
 * @param {Object} position - Geolocation position object
 */
export function updateLocation(position) {
    // Get frequently accessed functions and objects once
    const layerManager = getLayerManager();
    
    if (!layerManager.hasSource('location-marker')) {
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
    
    // Get the new position coordinates
    const newCoords = [position.coords.longitude, position.coords.latitude];
    
    // Get the last position from state
    const lastCoords = getLastPosition();
    
    // Calculate track if we have a previous position
    if (lastCoords) {
        // Calculate new track without checking distance
        const newTrack = calculateTrack(lastCoords, newCoords);
        setCurrentTrack(newTrack);
        console.log(`Track: ${newTrack.toFixed(2)}°`);
        
        // Update the marker rotation with throttling
        // This will also update the track navbox
        throttledUpdateMarkerRotation(newTrack);
    }
    
    // Always update the position
    updateMarkerPosition(newCoords);
    
    // Save the new position as the last position
    setLastPosition(newCoords);
    
    // Update navboxes with position data
    updateNavboxesWithPosition(position);
}

/**
 * Creates a rotated location icon based on the current track
 * @param {number} track - The track in degrees
 * @returns {ImageData} The rotated icon image data
 */
export function createRotatedLocationIcon(track) {
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
    
    // Rotate based on track
    ctx.rotate(track * Math.PI / 180);
    
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
            
            // Create a fresh icon with the track from state
            const imageData = createRotatedLocationIcon(getCurrentTrack());
            
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
                            track: getCurrentTrack()
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
    // Don't log regular position unavailability errors
    if (error.code === error.PERMISSION_DENIED) {
        console.error('Geolocation Permission Denied Error:', error);
    }
    
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
                console.group('🚫 Geolocation Permission Denied');
                console.log(`📍 Before State Change: Geolocation=${getGeolocationEnabled()}, Navboxes=${getNavboxesEnabled()}`);
                console.groupEnd();
            }
            
            // Reset both state and slider to off with a single call
            setGeolocationStateAndSlider(false);
            
            // Update navboxes appearance - they should show error state
            updateNavboxesByErrorState(GEOLOCATION_STATE.ERROR);
            
            // Clear the position check interval since location is disabled
            clearPositionCheckInterval();
            break;
        
        // Don't add debug for these common errors
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
    // App only calls this function on mobile devices, so we don't need to check again
    
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
        
        // Reset location toggle state and slider
        setGeolocationStateAndSlider(false);
        
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
    
    // Reset position and track
    setLastPosition(null);
    setCurrentTrack(0);
    
    // Reset the throttle time
    lastRotationUpdateTime = 0;
    
    // There's no direct way to stop watchPosition, but we can
    // prevent its effects by setting geolocationEnabled to false
    // Use our helper function to ensure state and UI are synchronized
    // Don't call setGeolocationStateAndSlider here to avoid recursive loops
    // since toggleGeolocation calls stopGeolocation
    const oldState = getGeolocationEnabled();
    setGeolocationEnabled(false);
    
    // Log direct state change when debugging is enabled
    if (oldState) {
        console.group('⚠️ Direct State Change in stopGeolocation');
        console.log('Changed geolocationEnabled from TRUE to FALSE');
        console.log('Note: This is expected behavior to avoid recursive calls');
        console.log('The caller is responsible for handling UI updates if needed');
        console.groupEnd();
    }
    
    // Hide the location marker
    if (getLayerManager() && getLayerManager().hasLayer('location-marker-triangle')) {
        getLayerManager().setVisibility('location-marker-triangle', false);
    }
    
    console.log('Geolocation tracking stopped');
} 