/**
 * Navigation boxes manager for MountainCircles Map
 * Mobile-only component that displays flight/position information
 * Only created and activated on mobile devices
 */

import { getMap, getNavboxesEnabled, getGeolocationEnabled, GEOLOCATION_STATE } from "./state.js";
import { isMobileDevice } from "./utils.js";

// Module state
let initialized = false;

// Container for all navboxes
let navboxContainer = null;

// Individual navbox elements
let altitudeBox = null;
let speedBox = null;

// Current values
let currentAltitude = null;
let currentSpeed = null;

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
    if (!isMobileDevice()) {
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
    valueElement.textContent = '---m';
    
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
    if (!initialized || !isMobileDevice() || !altitudeBox) return;
    
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
            
            valueElement.textContent = `${displayValue}${unit}`;
        } else {
            // No valid altitude data
            valueElement.textContent = altitudeInMeters ? '---m' : '---ft';
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
    valueElement.textContent = '---km/h';
    
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
    if (!initialized || !isMobileDevice() || !speedBox) return;
    
    currentSpeed = speed;
    
    // Find value element
    const valueElement = speedBox.querySelector('.navbox-value');
    if (valueElement) {
        if (speed !== null && !isNaN(speed)) {
            // Display in km/h
            const displayValue = Math.round(speed * MS_TO_KMH);
            valueElement.textContent = `${displayValue}km/h`;
        } else {
            // No valid speed data
            valueElement.textContent = '---km/h';
        }
    }
}

/**
 * Updates navboxes with position data
 * Only processes updates on mobile devices with navboxes enabled
 * @param {Object} position - The geolocation position object
 */
export function updateNavboxesWithPosition(position) {
    // Skip if not initialized or not on mobile or if navboxes are disabled
    if (!initialized || !isMobileDevice() || !position || !position.coords || !getNavboxesEnabled()) return;
    
    // Update altitude if available
    if (position.coords.altitude !== null) {
        updateAltitude(position.coords.altitude);
    }
    
    // Update speed if available
    if (position.coords.speed !== null) {
        updateSpeed(position.coords.speed);
    }
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
    currentAltitude = null;
    currentSpeed = null;
    initialized = false;
    
}

/**
 * Shows or hides the navboxes
 * @param {boolean} visible - Whether the navboxes should be visible
 */
export function setNavboxesVisible(visible) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobileDevice()) return;
    
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
    if (!initialized || !isMobileDevice()) return false;
    
    const newState = !navboxesVisible;
    setNavboxesVisible(newState);
    return newState;
}

/**
 * Clears all navboxes and resets their values
 */
export function clearNavboxes() {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobileDevice()) return;
    
    currentAltitude = null;
    currentSpeed = null;
    
    // Reset altitude display
    if (altitudeBox) {
        const valueElement = altitudeBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.textContent = altitudeInMeters ? '---m' : '---ft';
        }
    }
    
    // Reset speed display
    if (speedBox) {
        const valueElement = speedBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.textContent = '---km/h';
        }
    }
}

/**
 * Updates the navboxes appearance based on geolocation error state
 * @param {string} errorState - One of the GEOLOCATION_STATE values
 */
export function updateNavboxesByErrorState(errorState) {
    // Skip if not initialized or not on mobile
    if (!initialized || !isMobileDevice() || !navboxContainer) return;
    
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
    
    // Add appropriate state class based on error state
    switch (errorState) {
        case GEOLOCATION_STATE.WARNING:
            navboxContainer.classList.add('navboxes-warning');
            if (altitudeBox) altitudeBox.classList.add('navbox-warning');
            if (speedBox) speedBox.classList.add('navbox-warning');
            break;
            
        case GEOLOCATION_STATE.ERROR:
            navboxContainer.classList.add('navboxes-error');
            if (altitudeBox) altitudeBox.classList.add('navbox-error');
            if (speedBox) speedBox.classList.add('navbox-error');
            
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
            valueElement.textContent = altitudeInMeters ? '---m' : '---ft';
        }
    }
    
    // Reset speed display
    if (speedBox) {
        const valueElement = speedBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.textContent = '---km/h';
        }
    }
    
    // Also reset current values
    currentAltitude = null;
    currentSpeed = null;
}

// Make toggleNavboxes available globally for console access
window.toggleNavboxes = toggleNavboxes; 