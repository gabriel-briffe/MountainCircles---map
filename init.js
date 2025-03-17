// Application initialization for MountainCircles Map
import { initializeMap } from "./mapInitializer.js";
import { addGeoJSONLayers, updateParametersBox } from "./sidebar.js";
import { setupLayerEventHandlers } from "./layers.js";
import { initializeAirspaceData, setupAirspacePopupHandler } from "./map.js";
import { setupDockEventListeners } from "./dock.js";
import { updatePopupStyle } from "./airspace.js";
import { getCurrentConfig } from "./state.js";
import { setupIGCEventListeners } from "./igc.js";
import { setupInstallEventListeners } from "./install.js";
import { setupMenuEventListeners } from "./menu.js";

/**
 * Initializes the application
 * @param {string} mapContainerId - The ID of the map container element
 * @returns {Promise<void>}
 */
export async function initializeApp(mapContainerId = 'map') {
    // Initialize the parameters box with the current configuration
    updateParametersBox(getCurrentConfig());
    
    // Set up window event listeners for popup style
    window.addEventListener('resize', updatePopupStyle);
    window.addEventListener('orientationchange', updatePopupStyle);
    
    // Set up install event listeners
    setupInstallEventListeners();
    
    // Set up menu event listeners
    setupMenuEventListeners();
    
    // Initialize the map and set up event handlers
    await initializeMap(mapContainerId, async (mapInstance) => {
        // Add GeoJSON layers
        addGeoJSONLayers();
        
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
    });
} 