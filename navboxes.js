/**
 * Navigation boxes module for MountainCircles Map
 * Displays flight/position information in boxes at bottom of screen
 */

import { getMap } from "./state.js";

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
 */
export function initNavboxes() {
    // Create container for navboxes if it doesn't exist
    if (!navboxContainer) {
        navboxContainer = document.createElement('div');
        navboxContainer.id = 'navbox-container';
        navboxContainer.className = 'navbox-container';
        document.body.appendChild(navboxContainer);
        
        console.log('Created navbox container');
    }
    
    // Create altitude box
    createAltitudeBox();
    
    // Create speed box
    createSpeedBox();
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
    
    console.log('Created altitude navbox');
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
    
    console.log(`Altitude units switched to ${altitudeInMeters ? 'meters' : 'feet'}`);
}

/**
 * Updates the altitude navbox with GPS altitude
 * @param {number} altitude - The altitude in meters
 */
export function updateAltitude(altitude) {
    if (!altitudeBox) return;
    
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
    
    console.log('Created speed navbox');
}

/**
 * Updates the speed navbox with GPS speed
 * @param {number} speed - The speed in meters per second
 */
export function updateSpeed(speed) {
    if (!speedBox) return;
    
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
 * @param {Object} position - The geolocation position object
 */
export function updateNavboxesWithPosition(position) {
    if (!position || !position.coords) return;
    
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
 * Clears all navboxes and resets their values
 */
export function clearNavboxes() {
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
 * Shows or hides the navboxes
 * @param {boolean} visible - Whether the navboxes should be visible
 */
export function setNavboxesVisible(visible) {
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
    const newState = !navboxesVisible;
    setNavboxesVisible(newState);
    return newState;
}

// Make toggleNavboxes available globally for console access
window.toggleNavboxes = toggleNavboxes; 