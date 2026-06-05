// Application initialization for MountainCircles Map
import { initializeMap } from "./mapInitializer.js";
import { addGeoJSONLayers, updateParametersBox, switchConfig, updateSidebarConfigButtonStyles } from "./sidebar.js";
import { setupLayerEventHandlers } from "./layers.js";
import { initializeAirspaceData, setupAirspacePopupHandler } from "./map.js";
import { initializeAirportsData } from "./airportLayers.js";
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
import { registerTileProtocols } from "./tileProtocol.js";
import { unifiedTileStorage } from "./unifiedTileStorage.js";
import { initializeAirspaceImport } from "./airspaceImport.js";

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
    
    // Register custom tile protocols before map initialization
    console.log('[Init] Registering custom tile protocols...');
    const protocolsRegistered = registerTileProtocols();
    if (!protocolsRegistered) {
        console.error('[Init] Failed to register tile protocols - falling back to standard tiles');
        alert('Warning: Custom tile protocols failed to register. Some offline features may not work properly.');
    }
    
    // Initialize unified tile storage
    console.log('[Init] Initializing unified tile storage...');
    try {
        await unifiedTileStorage.initRegionsDB();
        await unifiedTileStorage.initEDLDB();
        console.log('[Init] Unified tile storage initialized successfully');
        
        // Optional: Run migration from legacy storage if needed
        // Uncomment the next line if you want to migrate existing regional tiles automatically
        // This will consolidate tiles from separate regional databases into the unified storage
        // await unifiedTileStorage.migrateFromLegacyStorage();
        
    } catch (error) {
        console.error('[Init] Failed to initialize unified tile storage:', error);
        alert('Warning: Tile storage initialization failed. Offline tiles may not work properly.');
    }
    
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

            // Initialize airport data
            await initializeAirportsData();
            
            // Set up airspace popup handler
            setupAirspacePopupHandler(mapInstance);
            
            // Set up dock event listeners
            setupDockEventListeners();
            
            // Set up IGC event listeners
            setupIGCEventListeners();

            // Initialize the tracklog recording functionality
            initializeTracking();
            
            // Initialize airspace import system
            initializeAirspaceImport();
            
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