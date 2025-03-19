/**
 * Navigation boxes module for MountainCircles Map
 * Displays flight/position information in boxes at bottom of screen
 */

import { getMap } from "./state.js";

// Container for all navboxes
let navboxContainer = null;

// Individual navbox elements
let altitudeBox = null;

// Current values
let currentAltitude = null;

// Visibility state
let navboxesVisible = true;

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
        
        // Apply styles to container
        Object.assign(navboxContainer.style, {
            position: 'fixed',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '10px',
            zIndex: '1000',
            padding: '5px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '5px',
            fontFamily: 'sans-serif'
        });
        
        console.log('Created navbox container');
    }
    
    // Create altitude box
    createAltitudeBox();
}

/**
 * Creates the altitude navbox
 */
function createAltitudeBox() {
    altitudeBox = document.createElement('div');
    altitudeBox.className = 'navbox altitude-box';
    
    // Apply styles to the box
    Object.assign(altitudeBox.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 10px',
        backgroundColor: '#4a90e2',
        borderRadius: '4px',
        color: 'white',
        minWidth: '60px',
        textAlign: 'center'
    });
    
    // Create value element
    const valueElement = document.createElement('div');
    valueElement.className = 'navbox-value';
    valueElement.textContent = '---m';
    
    // Style the value
    Object.assign(valueElement.style, {
        fontSize: '18px',
        fontWeight: 'bold'
    });
    
    // Create label element
    const labelElement = document.createElement('div');
    labelElement.className = 'navbox-label';
    labelElement.textContent = 'alt';
    
    // Style the label
    Object.assign(labelElement.style, {
        fontSize: '12px',
        opacity: '0.8'
    });
    
    // Add elements to the box
    altitudeBox.appendChild(valueElement);
    altitudeBox.appendChild(labelElement);
    
    // Add box to container
    navboxContainer.appendChild(altitudeBox);
    
    console.log('Created altitude navbox');
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
            // Round to nearest meter and display
            const roundedAltitude = Math.round(altitude);
            valueElement.textContent = `${roundedAltitude}m`;
        } else {
            valueElement.textContent = '---m';
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
}

/**
 * Clears all navboxes and resets their values
 */
export function clearNavboxes() {
    currentAltitude = null;
    
    // Reset altitude display
    if (altitudeBox) {
        const valueElement = altitudeBox.querySelector('.navbox-value');
        if (valueElement) {
            valueElement.textContent = '---m';
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