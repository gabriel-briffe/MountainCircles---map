/**
 * Airspace Import Module
 * Handles the airspace import popup UI and user interactions
 */

import { 
    importSelectedCountries, 
    clearAirspaceCache, 
    hasAirspaceCache,
    getAvailableCountries 
} from "./airspaceProcessor.js";

import {
    importSelectedAirports,
    hasAirportsCache
} from "./airportProcessor.js";

import { getMap, setAirspaceData, setAirportsData } from "./state.js";

// UI elements
let modal = null;
let progressContainer = null;
let progressBar = null;
let countCounter = null;
let totalCounter = null;
let statusElement = null;

/**
 * Initializes the airspace import system
 */
export function initializeAirspaceImport() {
    // Get UI elements
    modal = document.getElementById('airspaceImportModal');
    progressContainer = document.getElementById('airspaceImportProgress');
    progressBar = document.getElementById('airspaceImportProgressBar');
    countCounter = document.getElementById('airspaceImportCount');
    totalCounter = document.getElementById('airspaceImportTotal');
    statusElement = document.getElementById('airspaceImportStatus');
    
    if (!modal) {
        console.error('[AirspaceImport] Modal element not found');
        return;
    }
    
    setupEventListeners();
    console.log('[AirspaceImport] Airspace import system initialized');
}

/**
 * Sets up all event listeners for the import popup
 */
function setupEventListeners() {
    // Close button
    const closeBtn = document.getElementById('closeAirspaceImportBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideImportPopup);
    }
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideImportPopup();
        }
    });
    
    // Select all button
    const selectAllBtn = document.getElementById('selectAllCountriesBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllCountries);
    }
    
    // Deselect all button
    const deselectAllBtn = document.getElementById('deselectAllCountriesBtn');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllCountries);
    }
    
    // Import button
    const importBtn = document.getElementById('importAirspaceBtn');
    if (importBtn) {
        importBtn.addEventListener('click', handleImportAirspace);
    }
    
    // Clear button
    const clearBtn = document.getElementById('clearAirspaceBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClearAirspace);
    }
}

/**
 * Shows the airspace import popup
 */
export function showImportPopup() {
    if (!modal) {
        console.error('[AirspaceImport] Modal not initialized');
        return;
    }
    
    // Close the sidebar if it's open
    closeSidebarIfOpen();
    
    // Reset form state
    resetForm();
    
    // Show modal
    modal.style.display = 'flex';
    
    console.log('[AirspaceImport] Import popup opened');
}

/**
 * Closes the sidebar if it's open
 */
function closeSidebarIfOpen() {
    const sidebar = document.getElementById('airspace-sidebar');
    if (sidebar && sidebar.style.display === 'block') {
        sidebar.style.display = 'none';
        return true;
    }
    return false;
}

/**
 * Hides the airspace import popup
 */
export function hideImportPopup() {
    if (!modal) return;
    
    modal.style.display = 'none';
    resetForm();
    
    console.log('[AirspaceImport] Import popup closed');
}

/**
 * Resets the form to initial state
 */
function resetForm() {
    // Hide progress and status
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    if (statusElement) {
        statusElement.className = 'import-status';
        statusElement.textContent = '';
    }
    
    // Reset progress bar
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    if (countCounter) {
        countCounter.textContent = '0';
    }
    if (totalCounter) {
        totalCounter.textContent = '0';
    }
    
    // Enable buttons
    enableButtons(true);
}

/**
 * Selects all country checkboxes
 */
function selectAllCountries() {
    const countries = getAvailableCountries();
    countries.forEach(country => {
        const checkbox = document.getElementById(`airspace-${country.code}`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    console.log('[AirspaceImport] All countries selected');
}

/**
 * Deselects all country checkboxes
 */
function deselectAllCountries() {
    const countries = getAvailableCountries();
    countries.forEach(country => {
        const checkbox = document.getElementById(`airspace-${country.code}`);
        if (checkbox) {
            checkbox.checked = false;
        }
    });
    
    console.log('[AirspaceImport] All countries deselected');
}

/**
 * Gets the list of selected countries from checkboxes
 * @returns {Array<string>} Array of selected country codes
 */
function getSelectedCountries() {
    const countries = getAvailableCountries();
    const selected = [];
    
    countries.forEach(country => {
        const checkbox = document.getElementById(`airspace-${country.code}`);
        if (checkbox && checkbox.checked) {
            selected.push(country.code);
        }
    });
    
    return selected;
}

/**
 * Handles the import airspace button click
 */
async function handleImportAirspace() {
    console.log('[AirspaceImport] Import airspace requested');
    
    const selectedCountries = getSelectedCountries();
    
    if (selectedCountries.length === 0) {
        showStatus('Please select at least one country to import.', 'error');
        return;
    }
    
    // Confirm action
    const countryCount = selectedCountries.length;
    const confirmMessage = `Import airspace and airport data for ${countryCount} selected countr${countryCount === 1 ? 'y' : 'ies'}?\n\nThis will overwrite any existing airspace and airport data.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Disable buttons during import
    enableButtons(false);
    
    // Show progress
    showProgress();
    
    try {
        const totalSteps = selectedCountries.length * 2;

        const combinedData = await importSelectedCountries(selectedCountries, {
            onProgress: (current, total, status) => {
                updateProgress(current, totalSteps, status);
            },
            onStatus: updateStatus
        });

        const airportData = await importSelectedAirports(selectedCountries, {
            onProgress: (current, total, status) => {
                updateProgress(selectedCountries.length + current, totalSteps, status);
            },
            onStatus: updateStatus
        });
        
        // Update the map with new data
        await updateMapWithNewData(combinedData, airportData);
        
        showStatus(`Successfully imported ${combinedData.features.length} airspace features and ${airportData.features.length} airports! The map will reload to display the new data.`, 'success');
        
        // Reload the page to ensure all systems pick up the new data
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('[AirspaceImport] Import failed:', error);
        showStatus(`Import failed: ${error.message}`, 'error');
        enableButtons(true);
        hideProgress();
    }
}

/**
 * Handles the clear airspace button click
 */
async function handleClearAirspace() {
    console.log('[AirspaceImport] Clear airspace requested');
    
    // Check if there's cached data first
    const hasAirspace = await hasAirspaceCache();
    const hasAirports = await hasAirportsCache();
    if (!hasAirspace && !hasAirports) {
        showStatus('No airspace or airport data found to clear.', 'error');
        return;
    }
    
    // Confirm action
    if (!confirm('Clear all airspace and airport data?\n\nThis will remove all imported airspace and airports from the cache. Both layers will be empty until you import new data.')) {
        return;
    }
    
    // Redirect to bootstrap.html for consistent cache clearing
    console.log('[AirspaceImport] Redirecting to bootstrap for airspace cache clearing');
    const { BASE_PATH } = await import('./config.js');
    window.location.href = `${BASE_PATH}/bootstrap.html?cleanAirspace=true`;
}

/**
 * Updates the map with newly imported airspace data
 * @param {Object} geoJSON - The new airspace GeoJSON data
 * @param {Object} airportGeoJSON - The new airport GeoJSON data
 */
async function updateMapWithNewData(geoJSON, airportGeoJSON) {
    const map = getMap();
    
    if (map && map.getSource('airspace')) {
        // Update the map source with new data
        map.getSource('airspace').setData(geoJSON);
        
        // Update state
        setAirspaceData(geoJSON);
        
        // Recreate sidebar checkboxes with new data
        try {
            const { createTypeCheckboxes } = await import('./sidebar.js');
            createTypeCheckboxes(geoJSON.features);
        } catch (error) {
            console.warn('[AirspaceImport] Could not update sidebar checkboxes:', error);
        }
        
        console.log('[AirspaceImport] Map updated with new airspace data');
    }

    if (map && airportGeoJSON && map.getSource('airports')) {
        map.getSource('airports').setData(airportGeoJSON);
        setAirportsData(airportGeoJSON);

        try {
            const { createAirportTypeCheckboxes } = await import('./sidebar.js');
            createAirportTypeCheckboxes(airportGeoJSON.features);
        } catch (error) {
            console.warn('[AirspaceImport] Could not update airport type checkboxes:', error);
        }

        console.log('[AirspaceImport] Map updated with new airport data');
    }
}

/**
 * Shows the progress container
 */
function showProgress() {
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
}

/**
 * Hides the progress container
 */
function hideProgress() {
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

/**
 * Updates the progress bar and counters
 * @param {number} current - Current progress count
 * @param {number} total - Total items to process
 * @param {string} status - Current status message
 */
function updateProgress(current, total, status) {
    if (progressBar) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
    }
    
    if (countCounter) {
        countCounter.textContent = current.toString();
    }
    
    if (totalCounter) {
        totalCounter.textContent = total.toString();
    }
    
    console.log(`[AirspaceImport] Progress: ${current}/${total} - ${status}`);
}

/**
 * Updates the status message in the progress area
 * @param {string} message - Status message to display
 */
function updateStatus(message) {
    // This is used for progress updates - we don't display these in the UI
    // as they're too transient and would be distracting
    console.log(`[AirspaceImport] Status: ${message}`);
}

/**
 * Shows a status message to the user
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success', 'error', or default)
 */
function showStatus(message, type = '') {
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `import-status show ${type}`;
    
    console.log(`[AirspaceImport] User status (${type}): ${message}`);
}

/**
 * Enables or disables the form buttons
 * @param {boolean} enabled - Whether buttons should be enabled
 */
function enableButtons(enabled) {
    const buttons = [
        'selectAllCountriesBtn',
        'deselectAllCountriesBtn', 
        'importAirspaceBtn',
        'clearAirspaceBtn'
    ];
    
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = !enabled;
        }
    });
}

/**
 * Gets the import popup element for external access
 * @returns {HTMLElement|null} The modal element
 */
export function getImportModal() {
    return modal;
} 