// Application initialization for MountainCircles Map
import { initializeMap } from "./mapInitializer.js";
import { addGeoJSONLayers, updateParametersBox, switchConfig, updateSidebarConfigButtonStyles } from "./sidebar.js";
import { setupLayerEventHandlers } from "./layers.js";
import { initializeAirspaceData, setupAirspacePopupHandler } from "./map.js";
import { setupDockEventListeners, toggleAirspaceVisibility } from "./dock.js";
import { updatePopupStyle } from "./airspace.js";
import { 
    getCurrentConfig,
    loadStateFromLocalStorage,
    saveStateToLocalStorage,
    getAirspaceVisible,
    getLayersToggleState
} from "./state.js";
import { setupIGCEventListeners } from "./igc.js";
import { setupInstallEventListeners } from "./install.js";
import { setupMenuEventListeners } from "./menu.js";
import { getLayerManager } from "./state.js";
import { isMobileDevice, requestWakeLock } from "./utils.js";
import { initializeTracking } from "./tracking.js";
import { getEDLMetadata } from "./cacheEdl.js";

/**
 * Checks if EDL metadata exists and is from today
 * If it exists but is not from today, deletes the cache and metadata
 */
async function checkAndCleanEDLCache() {
    console.log('[Init] Checking EDL metadata');
    const metadata = getEDLMetadata();
    
    // If no metadata exists, nothing to clean up
    if (!metadata) {
        console.log('[Init] No EDL metadata found');
        return;
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);
    
    // Check if metadata has data for today
    const hasToday = metadata.availableLayers && 
                     Object.keys(metadata.availableLayers).includes(today);
    
    if (!hasToday) {
        console.log('[Init] EDL metadata is outdated, cleaning cache');
        try {
            // Delete the EDL cache tiles
            if ('caches' in window) {
                const cache = await caches.open('mountaincircles-tiles-v1');
                const requests = await cache.keys();
                
                // Filter for EDL tiles
                const edlRequests = requests.filter(req => 
                    req.url.includes('/edl_tiles/')
                );
                
                // Delete each EDL tile from cache
                for (const request of edlRequests) {
                    await cache.delete(request);
                }
                console.log(`[Init] Deleted ${edlRequests.length} EDL tiles from cache`);
            }
            
            // Delete metadata from localStorage
            localStorage.removeItem('edl_metadata');
            console.log('[Init] Deleted EDL metadata from localStorage');
        } catch (error) {
            console.error('[Init] Error cleaning EDL cache:', error);
        }
    } else {
        console.log('[Init] EDL metadata is current (today)');
    }
}

/**
 * Initializes the application
 * @param {string} mapContainerId - The ID of the map container element
 * @returns {Promise<void>}
 */
export async function initializeApp(mapContainerId = 'map') {
    // Determine if running on mobile device ONCE at startup
    window.APP_CONFIG = {
        isMobile: isMobileDevice()
    };
    
    // Check and clean EDL cache if needed
    await checkAndCleanEDLCache();
    
    // Try to load saved state from Cache API
    const stateLoaded = await loadStateFromLocalStorage();
    
    // Store the loaded config value to apply later after map initialization
    const savedConfig = getCurrentConfig();
    
    // Safety check: Make sure savedConfig is valid
    if (!savedConfig || !savedConfig.includes('/')) {
        console.error(`Invalid config detected: "${savedConfig}". This could be dangerous for aviation safety.`);
        alert('WARNING: Invalid configuration detected. The application may not display correct aviation data. Please reload or reset your settings.');
    }
    
    // Initialize the parameters box with the current configuration
    try {
        updateParametersBox(savedConfig.split('/')[1]);
    } catch (error) {
        console.error('Error updating parameters box:', error);
    }
    
    // Set up window event listeners for popup style
    window.addEventListener('resize', updatePopupStyle);
    window.addEventListener('orientationchange', updatePopupStyle);
    
    // Set up install event listeners
    setupInstallEventListeners();
    
    // Set up menu event listeners
    setupMenuEventListeners();
    
    // Request wake lock to prevent screen from sleeping
    try {
        const wakeLock = await requestWakeLock();
        window.APP_CONFIG.wakeLock = wakeLock;
    } catch (error) {
        console.error('Error requesting wake lock:', error);
    }
    
    // Update sidebar config button styles to show which configs are cached
    // This needs to be done after the sidebar is created, so we'll do it after map initialization
    
    // Save state when user leaves the page or closes the tab
    window.addEventListener('beforeunload', () => {
        // Need to use a synchronous approach here since beforeunload doesn't wait for promises
        // We'll use a special sync function for this case
        saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
    });
    
    // Initialize the map and set up event handlers
    await initializeMap(mapContainerId, async (mapInstance) => {
        try {
            // If we have a saved config, apply it
            if (stateLoaded && savedConfig) {
                switchConfig(savedConfig);
            } else {
                // Otherwise do the normal initialization
                addGeoJSONLayers();
            }
            
            // Set up layer event handlers
            setupLayerEventHandlers();
            
            // Initialize airspace data
            await initializeAirspaceData();
            
            // Set up airspace popup handler
            setupAirspacePopupHandler(mapInstance);
            
            // Set up dock event listeners
            setupDockEventListeners();
            
            // Set up IGC event listeners
            setupIGCEventListeners();

            // Initialize the tracklog recording functionality
            initializeTracking();
            
            // After all initialization is done, ensure visibility states match saved state
            mapInstance.once('idle', async () => {
                // Apply the saved linestring layer toggle state
                if (stateLoaded) {
                    // Apply linestring layers visibility based on toggle state
                    const linestringsToggleState = getLayersToggleState();
                    
                    // Set visibility of main linestring layers according to toggle state
                    getLayerManager().setVisibility('linestrings-layer', linestringsToggleState);
                    getLayerManager().setVisibility('linestrings-labels', linestringsToggleState);
                    
                    // Hide any dynamic layers if toggle is off
                    if (!linestringsToggleState) {
                        const style = mapInstance.getStyle();
                        if (style && style.layers) {
                            style.layers.forEach(layer => {
                                if (layer.id.startsWith('dynamic-lines-')) {
                                    getLayerManager().setVisibility(layer.id, false);
                                }
                            });
                        }
                    }
                    
                    // Apply the saved airspace visibility state
                    const airspaceVisible = getAirspaceVisible();
                    
                    // Use the toggleAirspaceVisibility function to set visibility
                    toggleAirspaceVisibility(airspaceVisible);
                    
                    // Update any checkbox states once the sidebar is ready
                    // This is now handled by the toggleAirspaceVisibility function
                }
                
                // Update the config button styles to show which configs are cached
                await updateSidebarConfigButtonStyles();
            });
        } catch (error) {
            console.error('Error during map initialization:', error);
            alert('There was an error initializing the map: ' + error.message);
        }
    });
} 