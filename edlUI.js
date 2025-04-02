/**
 * EDL UI Module for MountainCircles Map
 * Handles the EDL layer time navigation interface
 */

import { getEDLMetadata, hasEDLTiles, isobareList, hourList } from './cacheEdl.js';
import { updateEDLLayer, getAvailableForecastDates } from './edl.js';
import { getLayerManager } from './state.js';

// Current layer information
let currentLayerInfo = {
    forecastDate: null,
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
        console.log('[EDL UI] Current layer info set:', currentLayerInfo);
    }
    
    // Set layer visibility to false initially
    edlLayerVisible = false;
    
    // Initialize the forecast date selection
    initForecastDateSelection();
    
    // Update date indicator if it exists
    updateDateIndicator();
    
    // Update time indicator if it exists
    updateTimeIndicator();
    
    // Update altitude indicator if pressure info exists
    if (currentLayerInfo.pressure) {
        updateAltitudeIndicator();
        console.log('[EDL UI] Altitude indicator initialized');
    }
    
    // Initial UI update
    updateNavigationButtonsState();
}

/**
 * Initialize the forecast date selection
 */
function initForecastDateSelection() {
    const forecastBtn = document.getElementById('edlForecastBtn');
    const forecastDisplay = document.getElementById('edlForecastDisplay');
    
    if (!forecastBtn || !forecastDisplay) {
        console.warn('[EDL UI] Forecast button elements not found');
        return;
    }
    
    // Create a modal for forecast date selection if it doesn't exist
    let forecastModal = document.getElementById('edlForecastModal');
    if (!forecastModal) {
        forecastModal = document.createElement('div');
        forecastModal.id = 'edlForecastModal';
        forecastModal.className = 'edl-forecast-modal';
        forecastModal.style.display = 'none';
        document.body.appendChild(forecastModal);
        
        // Add click event to close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (forecastModal.style.display === 'block' && 
                !forecastModal.contains(e.target) && 
                e.target !== forecastBtn) {
                forecastModal.style.display = 'none';
            }
        });
        
        // Prevent clicks within modal from closing it
        forecastModal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Toggle modal on button click
    forecastBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (forecastModal.style.display === 'block') {
            forecastModal.style.display = 'none';
            return;
        }
        
        // Update modal options before displaying
        updateForecastDateButtons();
        
        // Show modal
        forecastModal.style.display = 'block';
    });
    
    // Initialize button display
    updateForecastDateDisplay();
    
    console.log('[EDL UI] Forecast date selection initialized');
}

/**
 * Updates the forecast display text
 */
export function updateForecastDateDisplay() {
    const forecastDisplay = document.getElementById('edlForecastDisplay');
    
    if (!forecastDisplay || !currentLayerInfo.forecastDate) return;
    
    // Format the date for display as DD/MM
    const dateParts = currentLayerInfo.forecastDate.split('-');
    if (dateParts.length === 3) {
        const day = dateParts[2];
        const month = dateParts[1];
        forecastDisplay.textContent = `${day}/${month}`;
    } else {
        forecastDisplay.textContent = currentLayerInfo.forecastDate;
    }
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
    if (!metadata || !currentLayerInfo.forecastDate || !currentLayerInfo.date) {
        console.warn('[EDL UI] No current layer info or metadata available');
        return false;
    }
    
    const forecastDate = currentLayerInfo.forecastDate;
    
    // Get available hours for current date with the current forecast date
    const availableHours = Object.keys(metadata.availableLayers[forecastDate]?.[currentLayerInfo.date] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        console.warn('[EDL UI] No hours available for current date');
        return false;
    }
    
    // Find the previous hour
    const currentIndex = availableHours.indexOf(currentLayerInfo.hour);
    
    // If we're at the first hour of the day, try to go to the previous day
    if (currentIndex <= 0) {
        console.log('[EDL UI] At earliest hour for current date, checking for previous date');
        
        // FIXED: Get available target dates for the current forecast date
        const availableDates = Object.keys(metadata.availableLayers[forecastDate] || {}).sort();
        const currentDateIndex = availableDates.indexOf(currentLayerInfo.date);
        
        // If we're at the earliest date, can't go back further
        if (currentDateIndex <= 0) {
            console.log('[EDL UI] Already at earliest hour of earliest date');
            return false;
        }
        
        // Get the previous date
        const previousDate = availableDates[currentDateIndex - 1];
        console.log(`[EDL UI] Moving to previous date: ${previousDate}`);
        
        // Get available hours for the previous date
        const previousDateHours = Object.keys(metadata.availableLayers[forecastDate][previousDate] || {})
            .map(h => parseInt(h))
            .sort((a, b) => a - b);
        
        if (previousDateHours.length === 0) {
            console.warn(`[EDL UI] No hours available for previous date ${previousDate}`);
            return false;
        }
        
        // Use the last hour of the previous date
        const previousHour = previousDateHours[previousDateHours.length - 1];
        
        // Get available pressures for the new date/hour
        const availablePressures = metadata.availableLayers[forecastDate][previousDate][previousHour] || [];
        
        // Use current pressure if available, otherwise use the first available
        const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
            ? currentLayerInfo.pressure 
            : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
            
        // Update the layer with the new date/hour
        const result = updateEDLLayer(previousDate, previousHour, newPressure, forecastDate);
        
        if (result) {
            // Update current layer info
            currentLayerInfo = {
                forecastDate: forecastDate,
                date: previousDate,
                hour: previousHour,
                pressure: newPressure
            };
            
            console.log(`[EDL UI] Updated to date ${previousDate}, hour ${previousHour} (${previousHour}:00)`);
            
            // Update indicators
            updateDateIndicator();
            updateTimeIndicator();
            
            updateNavigationButtonsState();
            return true;
        }
        
        return false;
    }
    
    const previousHour = availableHours[currentIndex - 1];
    
    // Get available pressures for the new hour
    const availablePressures = metadata.availableLayers[forecastDate][currentLayerInfo.date][previousHour] || [];
    
    // Use current pressure if available, otherwise use the first available
    const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
        ? currentLayerInfo.pressure 
        : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
    
    // Update the layer
    const result = updateEDLLayer(currentLayerInfo.date, previousHour, newPressure, forecastDate);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            forecastDate: forecastDate,
            date: currentLayerInfo.date,
            hour: previousHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to hour ${previousHour} (${previousHour}:00)`);
        
        // Update indicators
        updateDateIndicator();
        updateTimeIndicator(); // Ensure time indicator is updated with local time
        
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
    if (!metadata || !currentLayerInfo.forecastDate || !currentLayerInfo.date) {
        console.warn('[EDL UI] No current layer info or metadata available');
        return false;
    }
    
    const forecastDate = currentLayerInfo.forecastDate;
    
    // Get available hours for current date with the current forecast date
    const availableHours = Object.keys(metadata.availableLayers[forecastDate]?.[currentLayerInfo.date] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        console.warn('[EDL UI] No hours available for current date');
        return false;
    }
    
    // Find the next hour
    const currentIndex = availableHours.indexOf(currentLayerInfo.hour);
    
    // If we're at the last hour of the day, try to go to the next day
    if (currentIndex >= availableHours.length - 1) {
        console.log('[EDL UI] At latest hour for current date, checking for next date');
        
        // FIXED: Get available target dates for the current forecast date
        const availableDates = Object.keys(metadata.availableLayers[forecastDate] || {}).sort();
        const currentDateIndex = availableDates.indexOf(currentLayerInfo.date);
        
        // If we're at the latest date, can't go forward further
        if (currentDateIndex >= availableDates.length - 1) {
            console.log('[EDL UI] Already at latest hour of latest date');
            return false;
        }
        
        // Get the next date
        const nextDate = availableDates[currentDateIndex + 1];
        console.log(`[EDL UI] Moving to next date: ${nextDate}`);
        
        // Get available hours for the next date
        const nextDateHours = Object.keys(metadata.availableLayers[forecastDate][nextDate] || {})
            .map(h => parseInt(h))
            .sort((a, b) => a - b);
        
        if (nextDateHours.length === 0) {
            console.warn(`[EDL UI] No hours available for next date ${nextDate}`);
            return false;
        }
        
        // Use the first hour of the next date
        const nextHour = nextDateHours[0];
        
        // Get available pressures for the new date/hour
        const availablePressures = metadata.availableLayers[forecastDate][nextDate][nextHour] || [];
        
        // Use current pressure if available, otherwise use the first available
        const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
            ? currentLayerInfo.pressure 
            : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
            
        // Update the layer with the new date/hour
        const result = updateEDLLayer(nextDate, nextHour, newPressure, forecastDate);
        
        if (result) {
            // Update current layer info
            currentLayerInfo = {
                forecastDate: forecastDate,
                date: nextDate,
                hour: nextHour,
                pressure: newPressure
            };
            
            console.log(`[EDL UI] Updated to date ${nextDate}, hour ${nextHour} (${nextHour}:00)`);
            
            // Update indicators
            updateDateIndicator();
            updateTimeIndicator();
            
            updateNavigationButtonsState();
            return true;
        }
        
        return false;
    }
    
    const nextHour = availableHours[currentIndex + 1];
    
    // Get available pressures for the new hour
    const availablePressures = metadata.availableLayers[forecastDate][currentLayerInfo.date][nextHour] || [];
    
    // Use current pressure if available, otherwise use the first available
    const newPressure = availablePressures.includes(currentLayerInfo.pressure) 
        ? currentLayerInfo.pressure 
        : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
    
    // Update the layer
    const result = updateEDLLayer(currentLayerInfo.date, nextHour, newPressure, forecastDate);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            forecastDate: forecastDate,
            date: currentLayerInfo.date,
            hour: nextHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to hour ${nextHour} (${nextHour}:00)`);
        
        // Update indicators
        updateDateIndicator();
        updateTimeIndicator(); // Ensure time indicator is updated with local time
        
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
    
    // Use the current forecast date or the last used one from metadata
    const forecastDate = currentLayerInfo?.forecastDate || 
                        metadata.lastUsedForecastDate || 
                        Object.keys(metadata.availableLayers)[0];
                        
    if (!forecastDate || !metadata.availableLayers[forecastDate]) {
        console.warn('[EDL UI] No valid forecast date available');
        return false;
    }
    
    // Get today's date in UTC
    const today = new Date();
    
    // Create a proper UTC date with same year, month, day as UTC
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const dateString = utcToday.toISOString().slice(0, 10);
    
    console.log(`[MODIFIED] edlUI.js - Using correct UTC date: ${dateString} (local date: ${new Date().toLocaleDateString()})`);
    
    // Find closest available date in the current forecast
    const availableDates = Object.keys(metadata.availableLayers[forecastDate] || {}).sort();
    if (availableDates.length === 0) {
        console.warn('[EDL UI] No dates available for forecast date:', forecastDate);
        return false;
    }
    
    // Use today if available, otherwise use the most recent date
    const closestDate = availableDates.includes(dateString) 
        ? dateString 
        : availableDates[availableDates.length - 1];
    
    // Get available hours for this date
    const availableHours = Object.keys(metadata.availableLayers[forecastDate][closestDate] || {})
        .map(h => parseInt(h))
        .sort((a, b) => a - b);
    
    if (availableHours.length === 0) {
        console.warn(`[EDL UI] No hours available for date ${closestDate}`);
        return false;
    }
    
    // Get current hour and minutes to properly round to nearest hour
    const currentHour = today.getUTCHours();
    const currentMinutes = today.getUTCMinutes();
    console.log(`[MODIFIED] edlUI.js - Using UTC time: ${currentHour}:${currentMinutes} (local time: ${today.getHours()}:${today.getMinutes()})`);
    
    // Round to the nearest hour based on minutes
    // If minutes < 30, use current hour; if minutes >= 30, use next hour
    const targetHour = currentMinutes < 30 ? currentHour : (currentHour + 1) % 24;
    console.log(`[EDL UI] Current UTC time is ${currentHour}:${currentMinutes}, rounding to ${targetHour}:00`);
    
    // Find the nearest available hour to the target hour
    const nearestHour = findNearestValue(targetHour, availableHours);
    
    // Get available pressures for this hour
    const availablePressures = metadata.availableLayers[forecastDate][closestDate][nearestHour] || [];
    
    // Use current pressure if available, otherwise use the first available
    const newPressure = (currentLayerInfo && availablePressures.includes(currentLayerInfo.pressure)) 
        ? currentLayerInfo.pressure 
        : (availablePressures[0] || isobareList[0]); // Default to first pressure in isobareList
    
    // Update the layer
    const result = updateEDLLayer(closestDate, nearestHour, newPressure, forecastDate);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            forecastDate: forecastDate,
            date: closestDate,
            hour: nearestHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to current UTC time: ${closestDate} ${nearestHour}:00 with forecast date ${forecastDate}`);
        
        // Update indicators
        updateDateIndicator();
        updateTimeIndicator(); // Ensure time indicator is updated with local time
        updateForecastDateDisplay(); // Update the forecast button display
        
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
    if (!hasEDLTiles() || !currentLayerInfo.forecastDate || !currentLayerInfo.date || !currentLayerInfo.hour) {
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
    const availablePressures = metadata.availableLayers[currentLayerInfo.forecastDate][currentLayerInfo.date]?.[currentLayerInfo.hour] || [];
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
    const result = updateEDLLayer(currentLayerInfo.date, currentLayerInfo.hour, newPressure, currentLayerInfo.forecastDate);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            forecastDate: currentLayerInfo.forecastDate,
            date: currentLayerInfo.date,
            hour: currentLayerInfo.hour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to pressure ${newPressure} hPa`);
        console.log('[MODIFIED] edlUI.js - Now showing pressure directly in hPa without conversion');
        
        // Update altitude indicator
        updateAltitudeIndicator();
        updateTimeIndicator(); // Ensure time indicator stays in local time
        
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
    if (!hasEDLTiles() || !currentLayerInfo.forecastDate || !currentLayerInfo.date || !currentLayerInfo.hour) {
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
    const availablePressures = metadata.availableLayers[currentLayerInfo.forecastDate][currentLayerInfo.date]?.[currentLayerInfo.hour] || [];
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
    const result = updateEDLLayer(currentLayerInfo.date, currentLayerInfo.hour, newPressure, currentLayerInfo.forecastDate);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            forecastDate: currentLayerInfo.forecastDate,
            date: currentLayerInfo.date,
            hour: currentLayerInfo.hour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to pressure ${newPressure} hPa`);
        console.log('[MODIFIED] edlUI.js - Now showing pressure directly in hPa without conversion');
        
        // Update altitude indicator
        updateAltitudeIndicator();
        updateTimeIndicator(); // Ensure time indicator stays in local time
        
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
    
    // Ensure time indicator shows local time
    updateTimeIndicator();
    
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
    if (!hasEDLTiles() || !currentLayerInfo.forecastDate || !currentLayerInfo.date) {
        console.log('[EDL UI] No EDL data available, disabling navigation buttons');
        prevButton.disabled = true;
        nextButton.disabled = true;
        if (pressureUpButton) pressureUpButton.disabled = true;
        if (pressureDownButton) pressureDownButton.disabled = true;
        if (nowButton) nowButton.disabled = true;
        if (pressureButton) pressureButton.disabled = true;
        return;
    }
    
    const metadata = getEDLMetadata();
    if (!metadata || !metadata.availableLayers) {
        console.warn('[EDL UI] No metadata available');
        return;
    }
    
    // FIXED: Get available target dates for the current forecast date
    const availableDates = Object.keys(metadata.availableLayers[currentLayerInfo.forecastDate] || {}).sort();
    const currentDateIndex = availableDates.indexOf(currentLayerInfo.date);
    
    // Get available hours for current date
    const availableHours = Object.keys(metadata.availableLayers[currentLayerInfo.forecastDate][currentLayerInfo.date] || {})
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
    
    // Get current hour index
    const currentHourIndex = availableHours.indexOf(currentLayerInfo.hour);
    
    // Check if we can go to previous hour or previous date
    let canGoPrevious = false;
    if (currentHourIndex > 0) {
        // Can go to previous hour on same date
        canGoPrevious = true;
        console.log('[EDL UI] Previous hour available on current date');
    } else if (currentDateIndex > 0) {
        // Can go to previous date - check if it has any hours
        const prevDate = availableDates[currentDateIndex - 1];
        // FIXED: Check hours properly for the target date within current forecast date
        const prevDateHours = Object.keys(metadata.availableLayers[currentLayerInfo.forecastDate][prevDate] || {}).length;
        if (prevDateHours > 0) {
            canGoPrevious = true;
            console.log(`[EDL UI] Previous date available: ${prevDate} with ${prevDateHours} hours`);
        }
    }
    
    // Check if we can go to next hour or next date
    let canGoNext = false;
    if (currentHourIndex < availableHours.length - 1) {
        // Can go to next hour on same date
        canGoNext = true;
        console.log('[EDL UI] Next hour available on current date');
    } else if (currentDateIndex < availableDates.length - 1) {
        // Can go to next date - check if it has any hours
        const nextDate = availableDates[currentDateIndex + 1];
        // FIXED: Check hours properly for the target date within current forecast date
        const nextDateHours = Object.keys(metadata.availableLayers[currentLayerInfo.forecastDate][nextDate] || {}).length;
        if (nextDateHours > 0) {
            canGoNext = true;
            console.log(`[EDL UI] Next date available: ${nextDate} with ${nextDateHours} hours`);
        }
    }
    
    // Update button states based on availability
    prevButton.disabled = !canGoPrevious;
    nextButton.disabled = !canGoNext;
    
    // Get available pressures for current date/hour
    const availablePressures = metadata.availableLayers[currentLayerInfo.forecastDate][currentLayerInfo.date]?.[currentLayerInfo.hour] || [];
    
    // Use the isobareList (already sorted from lowest to highest)
    const pressureLevels = [...isobareList].sort((a, b) => a - b);
    
    // Find current pressure index in standard levels
    const currentPressureIndex = pressureLevels.indexOf(currentLayerInfo.pressure);
    
    // Disable pressure up button if already at highest altitude (lowest pressure)
    if (pressureUpButton) {
        let hasHigherAltitude = false;
        for (let i = 0; i < currentPressureIndex; i++) {
            if (availablePressures.includes(pressureLevels[i])) {
                hasHigherAltitude = true;
                break;
            }
        }
        pressureUpButton.disabled = !hasHigherAltitude;
    }
    
    // Disable pressure down button if already at lowest altitude (highest pressure)
    if (pressureDownButton) {
        let hasLowerAltitude = false;
        for (let i = currentPressureIndex + 1; i < pressureLevels.length; i++) {
            if (availablePressures.includes(pressureLevels[i])) {
                hasLowerAltitude = true;
                break;
            }
        }
        pressureDownButton.disabled = !hasLowerAltitude;
    }
    
    // Now button is always enabled if there's data
    if (nowButton) {
        nowButton.disabled = false;
    }
    
    // Pressure button follows same logic as pressure indicators
    if (pressureButton) {
        pressureButton.disabled = (availablePressures.length <= 1);
    }
    
    // Update pressure indicator
    if (pressureIndicator && currentLayerInfo.pressure) {
        const pressureHpa = currentLayerInfo.pressure;
        pressureIndicator.textContent = `${pressureHpa}hPa`;
        
        // Update altitude indicator
        updateAltitudeIndicator();
    }
    
    // Log button states
    console.log(`[EDL UI] Button states - Prev: ${!prevButton.disabled}, Next: ${!nextButton.disabled}`);
    
    // Update date indicator only (time indicator is now handled by updateTimeIndicator)
    updateDateIndicator();
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
        navContainer.style.display = visible ? 'flex' : 'none';
    }
}

/**
 * Helper function to update the date indicator
 */
function updateDateIndicator() {
    const dateIndicator = document.getElementById('edlDateIndicator');
    if (dateIndicator && currentLayerInfo.forecastDate && currentLayerInfo.date) {
        // Parse the date from YYYY-MM-DD to DD/MM format
        const dateParts = currentLayerInfo.date.split('-');
        if (dateParts.length === 3) {
            const day = dateParts[2];
            const month = dateParts[1];
            dateIndicator.textContent = `${day}/${month}`;
            console.log(`[EDL UI] Date indicator updated: ${day}/${month}`);
        }
    }
}

/**
 * Helper function to get altitude in meters from pressure in hPa
 * @param {number} pressureHpa - Pressure in hPa
 * @returns {number} Approximate altitude in meters
 */
function getAltitudeFromPressure(pressureHpa) {
    // Using the pressure-altitude conversion table provided
    switch(true) {
        case pressureHpa <= 500:
            return 5600;
        case pressureHpa <= 600:
            return 4200;
        case pressureHpa <= 700:
            return 3000;
        case pressureHpa <= 800:
            return 1950;
        case pressureHpa <= 900:
            return 1000;
        default:
            return "---"; // Default altitude for pressure > 900hPa
    }
}

/**
 * Helper function to update the altitude indicator
 */
function updateAltitudeIndicator() {
    const altitudeIndicator = document.getElementById('edlAltitudeIndicator');
    if (altitudeIndicator && currentLayerInfo.pressure) {
        // No need to divide by 100 since pressure is already in hPa
        const pressureHpa = currentLayerInfo.pressure;
        const altitude = getAltitudeFromPressure(pressureHpa);
        altitudeIndicator.textContent = `${altitude}m`;
        console.log(`[EDL UI] Altitude indicator updated: ${altitude}m for ${pressureHpa}hPa`);
        console.log('[MODIFIED] edlUI.js - Using pressure directly in hPa for altitude calculation');
    }
}

/**
 * Helper function to update the time indicator
 */
function updateTimeIndicator() {
    const timeIndicator = document.getElementById('edlTimeIndicator');
    if (timeIndicator && currentLayerInfo.forecastDate && currentLayerInfo.date && currentLayerInfo.hour !== null) {
        // Create a date object from the UTC time data
        const utcDate = new Date(Date.UTC(
            parseInt(currentLayerInfo.forecastDate.split('-')[0]), // year
            parseInt(currentLayerInfo.forecastDate.split('-')[1]) - 1, // month (0-based)
            parseInt(currentLayerInfo.forecastDate.split('-')[2]), // day
            currentLayerInfo.hour // hour
        ));
        
        // Get local hour from UTC date
        const localHour = utcDate.getHours();
        const localMinutes = utcDate.getMinutes();
        
        // Format with leading zero if needed
        const formattedLocalTime = `${localHour.toString().padStart(2, '0')}:${localMinutes.toString().padStart(2, '0')}`;
        
        // Show both UTC and local time if they're different
        if (localHour !== currentLayerInfo.hour) {
            const utcTime = `${currentLayerInfo.hour.toString().padStart(2, '0')}:00`;
            timeIndicator.innerHTML = `<span title="UTC time: ${utcTime}">${formattedLocalTime}</span>`;
            console.log(`[EDL UI] Time indicator updated: ${formattedLocalTime} (UTC: ${utcTime})`);
        } else {
            // If they're the same, just show the time
            timeIndicator.textContent = formattedLocalTime;
            console.log(`[EDL UI] Time indicator updated: ${formattedLocalTime}`);
        }
        
        console.log('[MODIFIED] edlUI.js - Now showing local time in the time indicator');
    }
}

/**
 * Updates the forecast date buttons in the modal
 */
function updateForecastDateButtons() {
    const forecastModal = document.getElementById('edlForecastModal');
    if (!forecastModal) return;
    
    // Clear existing options
    forecastModal.innerHTML = '';
    
    // Add a title to the modal
    const title = document.createElement('div');
    title.className = 'forecast-modal-title';
    title.textContent = 'Select Forecast Date';
    forecastModal.appendChild(title);
    
    // Get available forecast dates
    const forecastDates = getAvailableForecastDates();
    
    // Add a button for each forecast date
    forecastDates.forEach(date => {
        const button = document.createElement('button');
        button.className = 'forecast-date-btn';
        button.dataset.value = date;
        
        // Format the date for display as DD/MM
        const dateParts = date.split('-');
        if (dateParts.length === 3) {
            const day = dateParts[2];
            const month = dateParts[1];
            button.textContent = `${day}/${month}`;
        } else {
            button.textContent = date;
        }
        
        // Highlight the current selection
        if (currentLayerInfo && currentLayerInfo.forecastDate === date) {
            button.classList.add('selected');
        }
        
        // Add click handler
        button.addEventListener('click', () => {
            handleForecastDateChange(date);
            forecastModal.style.display = 'none';
        });
        
        forecastModal.appendChild(button);
    });
}

/**
 * Handles when a forecast date is selected
 * @param {string} newForecastDate - The selected forecast date
 */
function handleForecastDateChange(newForecastDate) {
    console.log(`[EDL UI] Forecast date changed to: ${newForecastDate}`);
    
    if (!newForecastDate || newForecastDate === currentLayerInfo.forecastDate) {
        return; // No change or invalid value
    }
    
    // Store the current visibility state to preserve it
    const currentVisibility = edlLayerVisible;
    
    // Get the metadata to check available dates/hours for this forecast
    const metadata = getEDLMetadata();
    if (!metadata || !metadata.availableLayers || !metadata.availableLayers[newForecastDate]) {
        console.warn(`[EDL UI] No metadata available for forecast date: ${newForecastDate}`);
        return;
    }
    
    // Get available target dates for this forecast
    const availableTargetDates = Object.keys(metadata.availableLayers[newForecastDate]).sort();
    if (availableTargetDates.length === 0) {
        console.warn(`[EDL UI] No target dates available for forecast date: ${newForecastDate}`);
        return;
    }
    
    // Use the latest target date available
    const newTargetDate = availableTargetDates[availableTargetDates.length - 1];
    
    // Get available hours for this target date
    const availableHours = Object.keys(metadata.availableLayers[newForecastDate][newTargetDate]).map(h => parseInt(h)).sort((a, b) => a - b);
    if (availableHours.length === 0) {
        console.warn(`[EDL UI] No hours available for target date: ${newTargetDate}`);
        return;
    }
    
    // For hour, try to keep the same hour if available, otherwise use the closest available hour
    let newHour = currentLayerInfo.hour;
    if (!availableHours.includes(newHour)) {
        newHour = findNearestValue(newHour, availableHours);
    }
    
    // For pressure, try to keep the same pressure if available
    const availablePressures = metadata.availableLayers[newForecastDate][newTargetDate][newHour];
    let newPressure = currentLayerInfo.pressure;
    if (!availablePressures.includes(newPressure)) {
        newPressure = availablePressures[0]; // Use first available pressure
    }
    
    // Update the EDL layer with new parameters
    const result = updateEDLLayer(newTargetDate, newHour, newPressure, newForecastDate);
    
    if (result) {
        // Update current layer info
        currentLayerInfo = {
            forecastDate: newForecastDate,
            date: newTargetDate,
            hour: newHour,
            pressure: newPressure
        };
        
        console.log(`[EDL UI] Updated to forecast ${newForecastDate}, target date ${newTargetDate}, hour ${newHour}`);
        
        // Update the display text in the forecast button
        updateForecastDateDisplay();
        
        // Restore the visibility state to what it was before changing forecast date
        const layerManager = getLayerManager();
        if (layerManager.hasLayer('edl-layer')) {
            // The updateEDLLayer function might have changed the visibility, so we need to restore it
            layerManager.setVisibility('edl-layer', currentVisibility);
            edlLayerVisible = currentVisibility;
            console.log(`[EDL UI] Maintained EDL layer visibility as: ${edlLayerVisible ? 'visible' : 'hidden'}`);
        }
        
        // Update UI
        updateDateIndicator();
        updateTimeIndicator();
        updateAltitudeIndicator();
        updateNavigationButtonsState();
    } else {
        console.warn('[EDL UI] Failed to update layer with new forecast date');
    }
}

/**
 * Updates the forecast date modal options (for backward compatibility)
 */
export function updateForecastDateOptions() {
    updateForecastDateDisplay();
    
    // If the modal is visible, update its buttons
    const forecastModal = document.getElementById('edlForecastModal');
    if (forecastModal && forecastModal.style.display === 'block') {
        updateForecastDateButtons();
    }
}