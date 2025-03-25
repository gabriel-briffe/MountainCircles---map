/**
 * EDL UI Module for MountainCircles Map
 * Handles the EDL layer time navigation interface
 */

import { getEDLMetadata, hasEDLTiles, isobareList, hourList } from './cacheEdl.js';
import { updateEDLLayer } from './edl.js';
import { getLayerManager } from './state.js';

// Current layer information
let currentLayerInfo = {
    date: null,
    hour: null,
    pressure: null
};

// Flag to track EDL layer visibility
let edlLayerVisible = true;

/**
 * Initialize the EDL UI module
 * @param {Object} initialLayer - Initial layer information
 */
export function initEDLUI(initialLayer) {
    console.log('[EDL UI] Initializing EDL UI with:', initialLayer);
    if (initialLayer && initialLayer.info) {
        currentLayerInfo = { ...initialLayer.info };
    }
    
    // Set layer visibility to false initially
    edlLayerVisible = false;
    
    // Initial UI update
    updateNavigationButtonsState();
}

/**
 * Navigates to the previous hour in the EDL layer
 * @returns {boolean} Success status
 */
export function navigateToPreviousHour() {
    console.log('[EDL UI] Navigating to previous hour');
    if (!hasEDLTiles()) {
        console.warn('[EDL UI] No EDL tiles available');
        return false;
    }
    
    const metadata = getEDLMetadata();
    if (!metadata || !currentLayerInfo.date) {
        console.warn('[EDL UI] No current layer info or metadata available');
        return false;
    }
    
    // Get available hours for current date
    const availableHours = Object.keys(metadata.availableLayers[currentLayerInfo.date] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        console.warn('[EDL UI] No hours available for current date');
        return false;
    }
    
    // Find the previous hour
    const currentIndex = availableHours.indexOf(currentLayerInfo.hour);
    if (currentIndex <= 0) {
        console.log('[EDL UI] Already at earliest hour for this date');
        return false;
    }
    
    const previousHour = availableHours[currentIndex - 1];
    
    // Get available pressures for the new hour
    const availablePressures = metadata.availableLayers[currentLayerInfo.date][previousHour] || [];
    
    // Use current pressure if available, otherwise use the first available
    const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
        ? currentLayerInfo.pressure 
        : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
    
    // Update the layer
    const result = updateEDLLayer(currentLayerInfo.date, previousHour, newPressure);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            ...currentLayerInfo,
            hour: previousHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to hour ${previousHour} (${previousHour}:00)`);
        updateNavigationButtonsState();
        return true;
    }
    
    return false;
}

/**
 * Navigates to the next hour in the EDL layer
 * @returns {boolean} Success status
 */
export function navigateToNextHour() {
    console.log('[EDL UI] Navigating to next hour');
    if (!hasEDLTiles()) {
        console.warn('[EDL UI] No EDL tiles available');
        return false;
    }
    
    const metadata = getEDLMetadata();
    if (!metadata || !currentLayerInfo.date) {
        console.warn('[EDL UI] No current layer info or metadata available');
        return false;
    }
    
    // Get available hours for current date
    const availableHours = Object.keys(metadata.availableLayers[currentLayerInfo.date] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        console.warn('[EDL UI] No hours available for current date');
        return false;
    }
    
    // Find the next hour
    const currentIndex = availableHours.indexOf(currentLayerInfo.hour);
    if (currentIndex >= availableHours.length - 1) {
        console.log('[EDL UI] Already at latest hour for this date');
        return false;
    }
    
    const nextHour = availableHours[currentIndex + 1];
    
    // Get available pressures for the new hour
    const availablePressures = metadata.availableLayers[currentLayerInfo.date][nextHour] || [];
    
    // Use current pressure if available, otherwise use the first available
    const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
        ? currentLayerInfo.pressure 
        : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
    
    // Update the layer
    const result = updateEDLLayer(currentLayerInfo.date, nextHour, newPressure);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            ...currentLayerInfo,
            hour: nextHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to hour ${nextHour} (${nextHour}:00)`);
        updateNavigationButtonsState();
        return true;
    }
    
    return false;
}

/**
 * Navigates to the current time (closest available hour)
 * @returns {boolean} Success status
 */
export function navigateToCurrentTime() {
    console.log('[EDL UI] Navigating to current time');
    if (!hasEDLTiles()) {
        console.warn('[EDL UI] No EDL tiles available');
        return false;
    }
    
    const metadata = getEDLMetadata();
    if (!metadata) {
        console.warn('[EDL UI] No metadata available');
        return false;
    }
    
    // Get today's date
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10);
    
    // Find closest available date
    const availableDates = Object.keys(metadata.availableLayers).sort();
    if (availableDates.length === 0) {
        console.warn('[EDL UI] No dates available');
        return false;
    }
    
    // Use today if available, otherwise use the most recent date
    const closestDate = availableDates.includes(dateString) 
        ? dateString 
        : availableDates[availableDates.length - 1];
    
    // Get available hours for this date
    const availableHours = Object.keys(metadata.availableLayers[closestDate] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        console.warn(`[EDL UI] No hours available for date ${closestDate}`);
        return false;
    }
    
    // Find the nearest available hour to current time
    const currentHour = today.getHours();
    const nearestHour = findNearestValue(currentHour, availableHours);
    
    // Get available pressures for this hour
    const availablePressures = metadata.availableLayers[closestDate][nearestHour] || [];
    
    // Use current pressure if available, otherwise use the first available
    const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
        ? currentLayerInfo.pressure 
        : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
    
    // Update the layer
    const result = updateEDLLayer(closestDate, nearestHour, newPressure);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            date: closestDate,
            hour: nearestHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to current time: ${closestDate} ${nearestHour}:00`);
        updateNavigationButtonsState();
        return true;
    }
    
    return false;
}

/**
 * Navigates to a higher altitude (lower pressure level)
 * @returns {boolean} Success status
 */
export function navigateToHigherAltitude() {
    console.log('[EDL UI] Navigating to higher altitude (lower pressure)');
    if (!hasEDLTiles() || !currentLayerInfo.date || !currentLayerInfo.hour) {
        console.warn('[EDL UI] No EDL layer available');
        return false;
    }
    
    const metadata = getEDLMetadata();
    if (!metadata) {
        console.warn('[EDL UI] No metadata available');
        return false;
    }
    
    // Use the isobareList from cacheEdl.js (already sorted from lowest to highest)
    const pressureLevels = [...isobareList].sort((a, b) => a - b);
    
    // Get available pressures for current date and hour
    const availablePressures = metadata.availableLayers[currentLayerInfo.date]?.[currentLayerInfo.hour] || [];
    if (availablePressures.length === 0) {
        console.warn('[EDL UI] No pressure levels available');
        return false;
    }
    
    // Find current pressure index in standard levels
    const currentIndex = pressureLevels.indexOf(currentLayerInfo.pressure);
    if (currentIndex <= 0) {
        console.log('[EDL UI] Already at the highest altitude (lowest pressure)');
        return false;
    }
    
    // Get the next lower pressure level (higher altitude)
    let newPressure = null;
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (availablePressures.includes(pressureLevels[i])) {
            newPressure = pressureLevels[i];
            break;
        }
    }
    
    if (!newPressure) {
        console.log('[EDL UI] No higher altitude (lower pressure) available');
        return false;
    }
    
    // Update the layer
    const result = updateEDLLayer(currentLayerInfo.date, currentLayerInfo.hour, newPressure);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            ...currentLayerInfo,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to pressure ${newPressure} Pa (${newPressure/100} hPa)`);
        updateNavigationButtonsState();
        return true;
    }
    
    return false;
}

/**
 * Navigates to a lower altitude (higher pressure level)
 * @returns {boolean} Success status
 */
export function navigateToLowerAltitude() {
    console.log('[EDL UI] Navigating to lower altitude (higher pressure)');
    if (!hasEDLTiles() || !currentLayerInfo.date || !currentLayerInfo.hour) {
        console.warn('[EDL UI] No EDL layer available');
        return false;
    }
    
    const metadata = getEDLMetadata();
    if (!metadata) {
        console.warn('[EDL UI] No metadata available');
        return false;
    }
    
    // Use the isobareList from cacheEdl.js (already sorted from lowest to highest)
    const pressureLevels = [...isobareList].sort((a, b) => a - b);
    
    // Get available pressures for current date and hour
    const availablePressures = metadata.availableLayers[currentLayerInfo.date]?.[currentLayerInfo.hour] || [];
    if (availablePressures.length === 0) {
        console.warn('[EDL UI] No pressure levels available');
        return false;
    }
    
    // Find current pressure index in standard levels
    const currentIndex = pressureLevels.indexOf(currentLayerInfo.pressure);
    if (currentIndex >= pressureLevels.length - 1 || currentIndex === -1) {
        console.log('[EDL UI] Already at the lowest altitude (highest pressure)');
        return false;
    }
    
    // Get the next higher pressure level (lower altitude)
    let newPressure = null;
    for (let i = currentIndex + 1; i < pressureLevels.length; i++) {
        if (availablePressures.includes(pressureLevels[i])) {
            newPressure = pressureLevels[i];
            break;
        }
    }
    
    if (!newPressure) {
        console.log('[EDL UI] No lower altitude (higher pressure) available');
        return false;
    }
    
    // Update the layer
    const result = updateEDLLayer(currentLayerInfo.date, currentLayerInfo.hour, newPressure);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            ...currentLayerInfo,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to pressure ${newPressure} Pa (${newPressure/100} hPa)`);
        updateNavigationButtonsState();
        return true;
    }
    
    return false;
}

/**
 * Toggles the EDL layer visibility
 */
export function toggleEDLLayerVisibility() {
    console.log('[EDL UI] Toggling EDL layer visibility');
    
    // Toggle the visibility state
    edlLayerVisible = !edlLayerVisible;
    
    // Update the layer visibility
    const layerManager = getLayerManager();
    if (layerManager.hasLayer('edl-layer')) {
        layerManager.setVisibility('edl-layer', edlLayerVisible);
        console.log(`[EDL UI] EDL layer visibility set to: ${edlLayerVisible ? 'visible' : 'hidden'}`);
    }
    
    // Update the UI
    updateNavigationButtonsState();
    
    return edlLayerVisible;
}

/**
 * Updates the state of navigation buttons based on available data
 */
export function updateNavigationButtonsState() {
    console.log('[EDL UI] Updating navigation buttons state');
    
    // Get buttons
    const prevButton = document.getElementById('edlPrevHourBtn');
    const nextButton = document.getElementById('edlNextHourBtn');
    const pressureUpButton = document.getElementById('edlPressureUpBtn');
    const pressureDownButton = document.getElementById('edlPressureDownBtn');
    const visibilityButton = document.getElementById('edlVisibilityBtn');
    const nowButton = document.getElementById('edlNowBtn');
    const pressureButton = document.getElementById('edlPressureBtn');
    const pressureIndicator = document.getElementById('edlPressureIndicator');
    
    if (!prevButton || !nextButton) {
        console.warn('[EDL UI] Navigation buttons not found');
        return;
    }

    // Update visibility button icon - never disable it
    if (visibilityButton) {
        visibilityButton.disabled = false;
        visibilityButton.innerHTML = `<span class="material-icons">${edlLayerVisible ? 'visibility' : 'visibility_off'}</span>`;
    }
    
    // If the layer is not visible, disable all other navigation buttons
    if (!edlLayerVisible) {
        console.log('[EDL UI] EDL layer not visible, disabling all navigation buttons');
        prevButton.disabled = true;
        nextButton.disabled = true;
        if (pressureUpButton) pressureUpButton.disabled = true;
        if (pressureDownButton) pressureDownButton.disabled = true;
        if (nowButton) nowButton.disabled = true;
        if (pressureButton) pressureButton.disabled = true;
        return;
    }
    
    // If layer is visible but no EDL data, disable all buttons except visibility
    if (!hasEDLTiles() || !currentLayerInfo.date) {
        // Disable all buttons if no EDL data
        prevButton.disabled = true;
        nextButton.disabled = true;
        if (pressureUpButton) pressureUpButton.disabled = true;
        if (pressureDownButton) pressureDownButton.disabled = true;
        if (nowButton) nowButton.disabled = true;
        if (pressureButton) pressureButton.disabled = true;
        return;
    }
    
    // Enable the now button and pressure button by default
    // (they display information but aren't necessarily navigation buttons)
    if (nowButton) nowButton.disabled = false;
    if (pressureButton) pressureButton.disabled = false;
    
    const metadata = getEDLMetadata();
    
    // Get available hours for current date
    const availableHours = Object.keys(metadata.availableLayers[currentLayerInfo.date] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        // Disable all buttons if no hours available
        prevButton.disabled = true;
        nextButton.disabled = true;
        if (pressureUpButton) pressureUpButton.disabled = true;
        if (pressureDownButton) pressureDownButton.disabled = true;
        return;
    }
    
    // Find current hour index
    const currentHourIndex = availableHours.indexOf(currentLayerInfo.hour);
    
    // Update hour navigation button states
    prevButton.disabled = currentHourIndex <= 0;
    nextButton.disabled = currentHourIndex >= availableHours.length - 1;
    
    // Use the isobareList from cacheEdl.js (already sorted from lowest to highest)
    const pressureLevels = [...isobareList].sort((a, b) => a - b);
    
    // Get available pressures for current date and hour
    const availablePressures = metadata.availableLayers[currentLayerInfo.date]?.[currentLayerInfo.hour] || [];
    
    // Find current pressure index
    const currentPressureIndex = pressureLevels.indexOf(currentLayerInfo.pressure);
    
    // Update pressure navigation button states
    if (pressureUpButton && pressureDownButton) {
        // Check if there are higher altitude (lower pressure) levels available
        let hasHigherAltitude = false;
        for (let i = 0; i < currentPressureIndex; i++) {
            if (availablePressures.includes(pressureLevels[i])) {
                hasHigherAltitude = true;
                break;
            }
        }
        
        // Check if there are lower altitude (higher pressure) levels available
        let hasLowerAltitude = false;
        for (let i = currentPressureIndex + 1; i < pressureLevels.length; i++) {
            if (availablePressures.includes(pressureLevels[i])) {
                hasLowerAltitude = true;
                break;
            }
        }
        
        pressureUpButton.disabled = !hasHigherAltitude;
        pressureDownButton.disabled = !hasLowerAltitude;
    }
    
    // Update pressure indicator
    if (pressureIndicator && currentLayerInfo.pressure) {
        const pressureHpa = currentLayerInfo.pressure / 100;
        pressureIndicator.textContent = `${pressureHpa}hPa`;
    }
    
    // Log button states
    console.log(`[EDL UI] Button states - Prev: ${prevButton.disabled ? 'disabled' : 'enabled'}, Next: ${nextButton.disabled ? 'disabled' : 'enabled'}`);
    if (pressureUpButton && pressureDownButton) {
        console.log(`[EDL UI] Pressure button states - Up: ${pressureUpButton.disabled ? 'disabled' : 'enabled'}, Down: ${pressureDownButton.disabled ? 'disabled' : 'enabled'}`);
    }
    
    // Update the time indicator if it exists
    const timeIndicator = document.getElementById('edlTimeIndicator');
    if (timeIndicator) {
        // Format hour with leading zero if needed and add :00
        const formattedHour = currentLayerInfo.hour !== null ? 
            `${currentLayerInfo.hour.toString().padStart(2, '0')}:00` : 
            'Now';
        
        timeIndicator.textContent = formattedHour;
        
        // Also update the button title with date and pressure information
        if (nowButton && currentLayerInfo.date) {
            const dateObj = new Date(currentLayerInfo.date);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedDate = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
            
            // Format pressure in hPa
            const pressureHpa = currentLayerInfo.pressure ? currentLayerInfo.pressure / 100 : null;
            const pressureText = pressureHpa ? ` at ${pressureHpa} hPa` : '';
            
            nowButton.title = `${formattedDate} at ${formattedHour}${pressureText}`;
        }
    }
}

/**
 * Finds the nearest value in an array to a target value
 * @param {number} value - Target value
 * @param {Array<number>} array - Array of values to search
 * @returns {number} Nearest value
 */
function findNearestValue(value, array) {
    if (!array || array.length === 0) return null;
    return array.reduce((prev, curr) => 
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
}

/**
 * Toggles visibility of the EDL navigation row
 * @param {boolean} visible - Whether to show or hide
 */
export function toggleEDLNavigationRow(visible) {
    console.log(`[EDL UI] Toggling EDL navigation row: ${visible ? 'visible' : 'hidden'}`);
    const navRow = document.getElementById('edlNavRow');
    if (navRow) {
        navRow.style.display = visible ? 'flex' : 'none';
    }
    
    // Also manage container visibility
    const navContainer = document.getElementById('edlNavContainer');
    if (navContainer) {
        navContainer.style.display = visible ? 'block' : 'none';
    }
} 