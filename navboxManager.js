/**
 * Navigation boxes manager for MountainCircles Map
 * Mobile-only component that displays flight/position information
 * Only created and activated on mobile devices
 */

import { getMap, getNavboxesEnabled, getGeolocationEnabled, GEOLOCATION_STATE } from "./state.js";
import { isMobileDevice } from "./utils.js";

// Check mobile status once at module level
const isMobile = window.APP_CONFIG?.isMobile ?? isMobileDevice();

// Module state
let initialized = false;

// Container for all navboxes
let navboxContainer = null;

// Individual navbox elements
let altitudeBox = null;
let speedBox = null;
let trackBox = null;

// Current values
let currentAltitude = null;
let currentSpeed = null;
let currentTrack = null;

// Visibility state
let navboxesVisible = true;

// Display units state
let altitudeInMeters = true; // True for meters, false for feet

// Conversion constants
const METERS_TO_FEET = 3.28084;
const MS_TO_KMH = 3.6;

/**
 * Initializes the navigation boxes on the map
 * Only creates the navboxes if on a mobile device and navboxes are enabled
 */
export function initNavboxes() {
    // Only initialize on mobile devices
    if (!isMobile) {
        return;
    }
    
    // Check if both geolocation and navboxes are enabled
    if (!getGeolocationEnabled() || !getNavboxesEnabled()) {
        return;
    }
    
    // Prevent multiple initializations
    if (initialized) {
        return;
    }
    
    // Add class to body to enable navbox styles
    document.body.classList.add('navboxes-enabled');
    
    // Create container for navboxes
    navboxContainer = document.createElement('div');
    navboxContainer.id = 'navbox-container';
    navboxContainer.className = 'navbox-container';
    document.body.appendChild(navboxContainer);
        
    // Create individual navboxes
    createAltitudeBox();
    createSpeedBox();
    createTrackBox();
    
    // Mark as initialized
    initialized = true;
}

/**
 * Creates the altitude navbox
 */
function createAltitudeBox() {
    altitudeBox = document.createElement('div');
    altitudeBox.className = 'navbox altitude-box';
    
    // Create value element
    const valueElement = document.createElement('div');
    valueElement.className = 'navbox-value';
    valueElement.innerHTML = '---<span class="unit">m</span>';
    
    // Create label element
    const labelElement = document.createElement('div');
    labelElement.className = 'navbox-label';
    labelElement.textContent = 'alt';
    
    // Add elements to the box
    altitudeBox.appendChild(valueElement);
    altitudeBox.appendChild(labelElement);
    
    // Add click handler to toggle between meters and feet
    altitudeBox.addEventListener('click', toggleAltitudeUnits);
    
    // Add box to container
    navboxContainer.appendChild(altitudeBox);
}

/**
 * Toggles between meters and feet for altitude display
 */
function toggleAltitudeUnits() {
    altitudeInMeters = !altitudeInMeters;
    
    // Re-update the display with current value but new units
    updateAltitude(currentAltitude);
    
    // Optional: Add a visual feedback for unit change
    altitudeBox.classList.add('unit-change');
    setTimeout(() => {
        altitudeBox.classList.remove('unit-change');
    }, 300);
}

/**
 * Updates the altitude navbox with GPS altitude
 * @param {number} altitude - The altitude in meters
 */
export function updateAltitude(altitude) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile || !altitudeBox) return;
    
    currentAltitude = altitude;
    
    // Find value element
    const valueElement = altitudeBox.querySelector('.navbox-value');
    if (valueElement) {
        if (altitude !== null && !isNaN(altitude)) {
            let displayValue;
            let unit;
            
            if (altitudeInMeters) {
                // Display in meters
                displayValue = Math.round(altitude);
                unit = 'm';
            } else {
                // Convert to feet
                displayValue = Math.round(altitude * METERS_TO_FEET);
                unit = 'ft';
            }
            
            valueElement.innerHTML = `${displayValue}<span class="unit">${unit}</span>`;
        } else {
            // No valid altitude data
            valueElement.innerHTML = altitudeInMeters ? '---<span class="unit">m</span>' : '---<span class="unit">ft</span>';
        }
    }
}

/**
 * Creates the speed navbox
 */
function createSpeedBox() {
    speedBox = document.createElement('div');
    speedBox.className = 'navbox speed-box';
    
    // Create value element
    const valueElement = document.createElement('div');
    valueElement.className = 'navbox-value';
    valueElement.innerHTML = '---<span class="unit">km/h</span>';
    
    // Create label element
    const labelElement = document.createElement('div');
    labelElement.className = 'navbox-label';
    labelElement.textContent = 'Vgps';
    
    // Add elements to the box
    speedBox.appendChild(valueElement);
    speedBox.appendChild(labelElement);
    
    // Add box to container
    navboxContainer.appendChild(speedBox);
}

/**
 * Updates the speed navbox with GPS speed
 * @param {number} speed - The speed in meters per second
 */
export function updateSpeed(speed) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile || !speedBox) return;
    
    currentSpeed = speed;
    
    // Find value element
    const valueElement = speedBox.querySelector('.navbox-value');
    if (valueElement) {
        if (speed !== null && !isNaN(speed)) {
            // Display in km/h
            const displayValue = Math.round(speed * MS_TO_KMH);
            valueElement.innerHTML = `${displayValue}<span class="unit">km/h</span>`;
        } else {
            // No valid speed data
            valueElement.innerHTML = '---<span class="unit">km/h</span>';
        }
    }
}

/**
 * Creates the track navbox
 */
function createTrackBox() {
    trackBox = document.createElement('div');
    trackBox.className = 'navbox track-box';
    
    // Create value element
    const valueElement = document.createElement('div');
    valueElement.className = 'navbox-value';
    valueElement.innerHTML = '---<span class="unit degree">°</span>';
    
    // Create label element
    const labelElement = document.createElement('div');
    labelElement.className = 'navbox-label';
    labelElement.textContent = 'Track';
    
    // Add elements to the box
    trackBox.appendChild(valueElement);
    trackBox.appendChild(labelElement);
    
    // Add box to container
    navboxContainer.appendChild(trackBox);
}

/**
 * Updates the track navbox with GPS track
 * @param {number} track - The track in degrees
 */
export function updateTrack(track) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile || !trackBox) return;
    
    currentTrack = track;
    
    // Find value element
    const valueElement = trackBox.querySelector('.navbox-value');
    if (valueElement) {
        if (track !== null && !isNaN(track)) {
            valueElement.innerHTML = `${Math.round(track)}<span class="unit degree">°</span>`;
        } else {
            // No valid track data
            valueElement.innerHTML = '---<span class="unit degree">°</span>';
        }
    }
}

/**
 * Updates navboxes with position data
 * Called whenever a new geolocation position is available
 * @param {Object} position - The geolocation position object
 */
export function updateNavboxesWithPosition(position) {
    if (!initialized || !isMobile || !position || !position.coords || !getNavboxesEnabled()) return;
    
    // Update altitude if available
    if (position.coords.altitude !== null) {
        updateAltitude(position.coords.altitude);
    }
    
    // Update speed if available
    if (position.coords.speed !== null) {
        updateSpeed(position.coords.speed);
    }
    
    // Note: Track is intentionally NOT updated here
    // Track updates are handled separately in location.js to ensure
    // the navbox shows the same value as the marker direction
}

/**
 * Check if navboxes should be shown and initialize or destroy them
 * This is called when navboxes or geolocation state changes
 */
export function updateNavboxesState() {
    const navboxesEnabled = getNavboxesEnabled();
    const geolocationEnabled = getGeolocationEnabled();
    
    // Both must be enabled for navboxes to be shown
    if (navboxesEnabled && geolocationEnabled) {
        // Initialize if not already done
        if (!initialized) {
            initNavboxes();
        } else {
            // Show if already initialized
            setNavboxesVisible(true);
        }
    } else {
        // If either is disabled, destroy/hide navboxes
        if (initialized) {
            setNavboxesVisible(false);
            
            // If completely removing navboxes when disabled:
            // destroyNavboxes();
        }
    }
}

/**
 * Destroys the navboxes completely (optional)
 */
export function destroyNavboxes() {
    if (!initialized) return;
    
    // Remove from DOM
    if (navboxContainer && navboxContainer.parentNode) {
        navboxContainer.parentNode.removeChild(navboxContainer);
    }
    
    // Remove class from body
    document.body.classList.remove('navboxes-enabled');
    
    // Reset variables
    navboxContainer = null;
    altitudeBox = null;
    speedBox = null;
    trackBox = null;
    currentAltitude = null;
    currentSpeed = null;
    currentTrack = null;
    initialized = false;
    
}

/**
 * Shows or hides the navboxes
 * @param {boolean} visible - Whether the navboxes should be visible
 */
export function setNavboxesVisible(visible) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile) return;
    
    navboxesVisible = visible;
    
    if (navboxContainer) {
        navboxContainer.style.display = visible ? 'flex' : 'none';
    }
}

/**
 * Toggles navboxes visibility
 * @returns {boolean} The new visibility state
 */
export function toggleNavboxes() {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile) return false;
    
    const newState = !navboxesVisible;
    setNavboxesVisible(newState);
    return newState;
}

/**
 * Clears all navboxes and resets their values
 */
export function clearNavboxes() {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile) return;
    
    currentAltitude = null;
    currentSpeed = null;
    currentTrack = null;
    
    // Reset altitude display
    if (altitudeBox) {
        const valueElement = altitudeBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.innerHTML = altitudeInMeters ? '---<span class="unit">m</span>' : '---<span class="unit">ft</span>';
        }
    }
    
    // Reset speed display
    if (speedBox) {
        const valueElement = speedBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.innerHTML = '---<span class="unit">km/h</span>';
        }
    }
    
    // Reset track display
    if (trackBox) {
        const valueElement = trackBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.innerHTML = '---<span class="unit degree">°</span>';
        }
    }
}

/**
 * Updates the navboxes appearance based on geolocation error state
 * @param {string} errorState - One of the GEOLOCATION_STATE values
 */
export function updateNavboxesByErrorState(errorState) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobile || !navboxContainer) return;
    
    // Make sure navboxes are visible if they should be
    if (getNavboxesEnabled() && getGeolocationEnabled()) {
        setNavboxesVisible(true);
    } else {
        setNavboxesVisible(false);
        return;
    }
    
    // Remove any existing state classes
    navboxContainer.classList.remove('navboxes-warning', 'navboxes-error');
    
    if (altitudeBox) {
        altitudeBox.classList.remove('navbox-warning', 'navbox-error');
    }
    
    if (speedBox) {
        speedBox.classList.remove('navbox-warning', 'navbox-error');
    }
    
    if (trackBox) {
        trackBox.classList.remove('navbox-warning', 'navbox-error');
    }
    
    // Add appropriate state class based on error state
    switch (errorState) {
        case GEOLOCATION_STATE.WARNING:
            navboxContainer.classList.add('navboxes-warning');
            if (altitudeBox) altitudeBox.classList.add('navbox-warning');
            if (speedBox) speedBox.classList.add('navbox-warning');
            if (trackBox) trackBox.classList.add('navbox-warning');
            break;
            
        case GEOLOCATION_STATE.ERROR:
            navboxContainer.classList.add('navboxes-error');
            if (altitudeBox) altitudeBox.classList.add('navbox-error');
            if (speedBox) speedBox.classList.add('navbox-error');
            if (trackBox) trackBox.classList.add('navbox-error');
            
            // In error state, we should also reset the displayed values
            resetNavboxValues();
            break;
            
        case GEOLOCATION_STATE.OK:
        default:
            // Normal state, no additional classes needed
            break;
    }
}

/**
 * Resets navbox values to placeholders
 */
function resetNavboxValues() {
    // Reset altitude display
    if (altitudeBox) {
        const valueElement = altitudeBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.innerHTML = altitudeInMeters ? '---<span class="unit">m</span>' : '---<span class="unit">ft</span>';
        }
    }
    
    // Reset speed display
    if (speedBox) {
        const valueElement = speedBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.innerHTML = '---<span class="unit">km/h</span>';
        }
    }
    
    // Reset track display
    if (trackBox) {
        const valueElement = trackBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.innerHTML = '---<span class="unit degree">°</span>';
        }
    }
    
    // Also reset current values
    currentAltitude = null;
    currentSpeed = null;
    currentTrack = null;
}

// Make toggleNavboxes available globally for console access
window.toggleNavboxes = toggleNavboxes; 