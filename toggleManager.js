/**
 * Toggle Manager for MountainCircles Map
 * Centralizes management of toggle states and their dependencies
 */

import { 
    getGeolocationEnabled, 
    setGeolocationEnabled, 
    getNavboxesEnabled, 
    setNavboxesEnabled,
    getLayerManager
} from "./state.js";
import { updateNavboxesState } from "./navboxManager.js";
import { setupGeolocation, stopGeolocation } from "./location.js";
import { isMobileDevice } from "./utils.js";

// Cache DOM references
let locationToggle = null;
let navboxesToggle = null;
let navboxesToggleContainer = null;

// For debugging
const DEBUG = true;

/**
 * Log debug information about toggle state changes
 * @param {string} action - The action being performed
 * @param {Object} info - Additional information to log
 */
function logToggleDebug(action, info = {}) {
    if (!DEBUG) return;
    
    console.group(`🔄 Toggle Debug: ${action}`);
    console.log(`📱 Mobile Device: ${isMobileDevice()}`);
    console.log(`📍 Geolocation State: ${getGeolocationEnabled() ? 'ON' : 'OFF'}`);
    console.log(`📊 Navboxes State: ${getNavboxesEnabled() ? 'ON' : 'OFF'}`);
    
    // Log UI state if elements exist
    if (locationToggle) {
        console.log(`🎚️ Location Toggle UI: ${locationToggle.classList.contains('active') ? 'ACTIVE' : 'INACTIVE'} (${locationToggle.getAttribute('aria-checked')})`);
    } else {
        console.log(`🎚️ Location Toggle UI: Not found in DOM`);
    }
    
    if (navboxesToggle) {
        console.log(`🎚️ Navboxes Toggle UI: ${navboxesToggle.classList.contains('active') ? 'ACTIVE' : 'INACTIVE'} (${navboxesToggle.getAttribute('aria-checked')}), Disabled: ${navboxesToggle.disabled}`);
    } else {
        console.log(`🎚️ Navboxes Toggle UI: Not found in DOM`);
    }
    
    // Log any additional info
    if (Object.keys(info).length > 0) {
        console.log('ℹ️ Additional Info:', info);
    }
    
    console.groupEnd();
}

/**
 * Initialize the toggle manager
 * Should be called after DOM is ready and toggles are created
 */
export function initToggleManager() {
    // Get toggle references
    locationToggle = document.getElementById('location-toggle');
    navboxesToggle = document.getElementById('navboxes-toggle');
    navboxesToggleContainer = document.getElementById('navboxes-toggle-container');
    
    // Set initial states
    updateToggleStates();
    
    // logToggleDebug('Initialize Toggle Manager');
}

/**
 * Updates both toggle states based on current app state
 */
export function updateToggleStates() {
    updateLocationToggleState();
    updateNavboxesToggleState();
}

/**
 * Updates the location toggle state based on geolocation enabled status
 */
export function updateLocationToggleState() {
    if (!locationToggle) return;
    
    const geolocationEnabled = getGeolocationEnabled();
    
    // Update toggle appearance
    locationToggle.className = `toggle-switch ${geolocationEnabled ? 'active' : ''}`;
    locationToggle.setAttribute('aria-checked', geolocationEnabled.toString());
}

/**
 * Updates the navboxes toggle state based on both geolocation and navboxes enabled status
 */
export function updateNavboxesToggleState() {
    if (!navboxesToggle || !navboxesToggleContainer) return;
    
    const geolocationEnabled = getGeolocationEnabled();
    const navboxesEnabled = getNavboxesEnabled();
    
    // Update toggle state
    if (geolocationEnabled) {
        // Enable the toggle
        navboxesToggle.disabled = false;
        navboxesToggle.style.opacity = '1';
        navboxesToggle.style.cursor = 'pointer';
        
        // Set correct state
        navboxesToggle.className = `toggle-switch ${navboxesEnabled ? 'active' : ''}`;
        navboxesToggle.setAttribute('aria-checked', navboxesEnabled.toString());
    } else {
        // Disable the toggle and ensure it's off
        navboxesToggle.disabled = true;
        navboxesToggle.style.opacity = '0.5';
        navboxesToggle.style.cursor = 'not-allowed';
        
        // Force the visual state to be off
        navboxesToggle.className = 'toggle-switch';
        navboxesToggle.setAttribute('aria-checked', 'false');
    }
}

/**
 * Set geolocation state AND update slider position
 * @param {boolean} enabled - The new geolocation state
 */
export function setGeolocationStateAndSlider(enabled) {
    const previousState = getGeolocationEnabled();
    
    // Update state in the data model
    setGeolocationEnabled(enabled);
    
    // Update slider UI to match
    if (locationToggle) {
        locationToggle.className = `toggle-switch ${enabled ? 'active' : ''}`;
        locationToggle.setAttribute('aria-checked', enabled.toString());
    }
    
    // If turning off geolocation, also turn off navboxes
    if (!enabled && getNavboxesEnabled()) {
        setNavboxesStateAndSlider(false);
    }
    
    // Update navboxes toggle availability 
    updateNavboxesToggleState();
    
    // Log debug info about the state change
    // logToggleDebug('Geolocation State Change', { 
    //     action: 'setGeolocationStateAndSlider',
    //     previousState,
    //     newState: enabled,
    //     isToggleInDOM: !!locationToggle
    // });
}

/**
 * Set navboxes state AND update slider position
 * @param {boolean} enabled - The new navboxes state
 */
export function setNavboxesStateAndSlider(enabled) {
    const previousState = getNavboxesEnabled();
    
    // Don't enable navboxes if geolocation is disabled
    if (enabled && !getGeolocationEnabled()) {
        // logToggleDebug('Navboxes Enable Blocked', { 
        //     reason: 'Geolocation is disabled'
        // });
        return;
    }
    
    // Update state in the data model
    setNavboxesEnabled(enabled);
    
    // Update slider UI to match
    if (navboxesToggle) {
        navboxesToggle.className = `toggle-switch ${enabled ? 'active' : ''}`;
        navboxesToggle.setAttribute('aria-checked', enabled.toString());
    }
    
    // Log debug info about the state change
    // logToggleDebug('Navboxes State Change', { 
    //     action: 'setNavboxesStateAndSlider',
    //     previousState,
    //     newState: enabled,
    //     isToggleInDOM: !!navboxesToggle,
    //     geolocationState: getGeolocationEnabled()
    // });
}

/**
 * Toggles geolocation tracking
 * @param {boolean} newState - The new geolocation state
 * @returns {Promise<boolean>} Whether the toggle was successful
 */
export async function toggleGeolocation(newState) {
    // logToggleDebug('Toggling Geolocation', { 
    //     requestedState: newState,
    //     source: 'toggleGeolocation function'
    // });
    
    // If trying to enable, check permissions first
    if (newState === true) {
        try {
            if ('permissions' in navigator) {
                const permissionStatus = await navigator.permissions.query({name: 'geolocation'});
                
                if (permissionStatus.state === 'denied') {
                    // Show alert if permission is denied
                    alert('Geolocation permission is denied. Please enable location access in your browser/device settings.');
                    // logToggleDebug('Geolocation Permission Denied', { 
                    //     permissionState: permissionStatus.state 
                    // });
                    return false;
                }
                
                // Set up permission change listener
                setupPermissionChangeListener(permissionStatus);
                
                // logToggleDebug('Geolocation Permission Check', { 
                //     permissionState: permissionStatus.state 
                // });
            }
        } catch (error) {
            console.error('Error checking geolocation permission:', error);
            // logToggleDebug('Geolocation Permission Error', { error: error.message });
        }
    } else {
        // Use the stopGeolocation function to clean up
        stopGeolocation();
    }
    
    // Update the state AND slider using our helper function
    setGeolocationStateAndSlider(newState);
    
    // Handle visibility changes
    toggleGeolocationVisibility(newState);
    
    // Update navboxes state
    updateNavboxesState();
    
    return true;
}

/**
 * Toggles navboxes display
 * @param {boolean} newState - The new navboxes state
 * @returns {boolean} Whether the toggle was successful
 */
export function toggleNavboxes(newState) {
    // logToggleDebug('Toggling Navboxes', { 
    //     requestedState: newState,
    //     source: 'toggleNavboxes function'
    // });
    
    // Only allow toggle if geolocation is enabled
    if (!getGeolocationEnabled()) {
        // logToggleDebug('Navboxes Toggle Blocked', { 
        //     reason: 'Geolocation is disabled'
        // });
        return false;
    }
    
    // Update state AND slider using our helper function
    setNavboxesStateAndSlider(newState);
    
    // Update navboxes visibility
    updateNavboxesState();
    
    // If turning off navboxes, we need a special handling approach
    if (!newState) {
        // First capture the current geolocation state before stopping
        const isGeolocationEnabled = getGeolocationEnabled();
        
        // Now call stopGeolocation which will set geolocationEnabled to false internally
        stopGeolocation();
        
        // If geolocation was enabled before, we need to:
        // 1. Update the state back to enabled (stopGeolocation sets it to false)
        // 2. Update the UI to match the state
        // 3. Restart geolocation
        if (isGeolocationEnabled) {
            // Update state back to enabled and ensure slider is correct
            setGeolocationStateAndSlider(true);
            
            // Restart geolocation
            setupGeolocation();
            
            // logToggleDebug('Fixed Geolocation State', {
            //     action: 'toggleNavboxes recovery',
            //     geolocationRestored: true
            // });
        }
    }
    
    return true;
}

/**
 * Sets up a listener for permission status changes
 * @param {PermissionStatus} permissionStatus - The permission status object
 */
export function setupPermissionChangeListener(permissionStatus) {
    // Remove any existing listener first to avoid duplicates
    permissionStatus.onchange = null;
    
    // Add new listener
    permissionStatus.onchange = function() {
        // logToggleDebug('Geolocation Permission Change', { 
        //     newPermissionState: this.state 
        // });
        
        if (this.state === 'denied') {            
            // Turn off location AND update slider using our helper function
            setGeolocationStateAndSlider(false);
            
            // Update navboxes visibility
            updateNavboxesState();
            
            // Hide location marker
            if (getLayerManager() && getLayerManager().hasLayer('location-marker-triangle')) {
                getLayerManager().setVisibility('location-marker-triangle', false);
            }
        }
    };
}

/**
 * Toggles the visibility of the geolocation marker
 * @param {boolean} isVisible - Whether the geolocation marker should be visible
 */
export function toggleGeolocationVisibility(isVisible) {
    // Only perform geolocation operations on mobile devices
    if (!isMobileDevice()) return;
    
    if (!getLayerManager()) return;
    
    // Toggle visibility of location marker
    if (getLayerManager().hasLayer('location-marker-triangle')) {
        getLayerManager().setVisibility('location-marker-triangle', isVisible);
        
        // logToggleDebug('Location Marker Visibility', { 
        //     visible: isVisible 
        // });
    }
    
    // If enabling, set up geolocation
    if (isVisible && getGeolocationEnabled()) {
        setupGeolocation();
    }
} 