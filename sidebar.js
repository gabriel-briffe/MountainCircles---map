/**
 * Sidebar module for MountainCircles Map
 * Contains functions for sidebar creation, management, and interaction
 */

// Import from config
import {
    AIRSPACE_TYPE_ORDER,
    POLICIES,
    CACHE_NAME,
    BASE_PATH
} from "./config.js";

// Import from state management
import {
    getMap,
    getLayerManager,
    getBaseTextSize,
    getPeaksVisible,
    getPassesVisible,
    getCurrentConfig,
    setPeaksVisible,
    setPassesVisible,
    setBaseTextSize,
    setCurrentConfig,
    setCurrentPolicy,
    clearPopup,
    getCurrentPolicy,
    getPolygonOpacity,
    getEnabledAirspaceTypes,
    setEnabledAirspaceTypes,
    saveStateToLocalStorage,
    getAirspaceVisible,
    setAirspaceVisible,
    getLayersToggleState,
    getGeolocationEnabled,
    setGeolocationEnabled,
    getNavboxesEnabled,
    setNavboxesEnabled
} from "./state.js";

// Import from utils
import { isMobileDevice } from "./utils.js";

// Import from airspace module
import {
    clearHighlight,
    triggerPopupRefresh
} from "./airspace.js";

// Import from map module
import {
    clearMarker
} from "./map.js";

// Import layer styles
import { 
    polygonLayerStyle,
    lineStringLayerStyle,
    lineStringLabelsLayerStyle,
    pointLayerStyle,
    pointLayerClickableStyle,
    pointLabelsLayerStyle
} from "./layerStyles.js";

// Import from location module
import {
    setupGeolocation,
    stopGeolocation
} from "./location.js";

// Import from navboxManager module
import {
    updateNavboxesState
} from "./navboxManager.js";

import { toggleGeolocation, toggleNavboxes, initToggleManager, updateToggleStates, toggleGeolocationVisibility } from "./toggleManager.js";


/**
 * Creates a checkbox option with label for the sidebar
 * @param {string} id - The ID for the checkbox element
 * @param {string} label - The text label for the checkbox
 * @param {boolean} checked - Whether the checkbox should be initially checked
 * @param {Function} onChange - The change event handler function
 * @returns {HTMLElement} The created checkbox label element
 */
function createOptionCheckbox(id, label, checked, onChange) {
    const container = document.createElement('label');
    container.className = 'checkbox-label airspace-option';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.addEventListener('change', onChange);
    
    const text = document.createTextNode(label);
    
    container.appendChild(checkbox);
    container.appendChild(text);
    
    return container;
}

/**
 * Creates checkboxes for airspace types in the sidebar
 * @param {Array} features - Array of airspace features
 */
export function createTypeCheckboxes(features) {
    const map = getMap();
    
    // Create sidebar if it doesn't exist
    let sidebar = document.getElementById('airspace-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'airspace-sidebar';
        sidebar.className = 'sidebar';
        document.body.appendChild(sidebar);
    }
    
    // Clear existing content
    sidebar.innerHTML = '';
    
    // Create a nice header with toggle and title
    createSidebarHeader(sidebar);
    
    // Add a divider
    addSidebarDivider(sidebar);
    
    // Add airspace type checkboxes
    addAirspaceTypeCheckboxes(sidebar, features);
    
    // Add a divider
    addSidebarDivider(sidebar);
    
    // Add peaks and passes toggles
    addPeaksPassesToggle(sidebar);
    
    // Add geolocation toggle and navboxes toggle only on mobile devices
    if (isMobileDevice()) {
        // Add a divider
        addSidebarDivider(sidebar);
        
        // Add geolocation toggle
        addLocationToggle(sidebar);
    }
    
    // Add a divider
    addSidebarDivider(sidebar);
    
    // Add policy/config buttons
    addPolicyConfigButtons(sidebar);
    
    // Add a divider
    addSidebarDivider(sidebar);
    
    // Add text size controls at the bottom
    addTextSizeControls(sidebar);
    
    // Apply initial state for geolocation if on mobile
    if (isMobileDevice()) {
        toggleGeolocationVisibility(getGeolocationEnabled());
    }
}

/**
 * Creates the sidebar header with title and toggle
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function createSidebarHeader(sidebar) {
    const map = getMap();
    
    // Create header container
    const header = document.createElement('div');
    header.className = 'sidebar-header';
    
    // Create title
    const title = document.createElement('h2');
    title.textContent = 'Airspace';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.margin = '0 0 5px 0';
    header.appendChild(title);
    
    // Create toggle switch for all airspace
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    
    // Create Mac-style toggle switch
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = `toggle-switch ${getAirspaceVisible() ? 'active' : ''}`;
    toggleSwitch.id = 'airspace-master-toggle';
    
    // Add the slider inside the toggle
    const slider = document.createElement('div');
    slider.className = 'toggle-slider';
    toggleSwitch.appendChild(slider);
    
    // Add click event listener to toggle visibility
    toggleSwitch.addEventListener('click', () => {
        const newState = !toggleSwitch.classList.contains('active');
        toggleAirspaceVisibility(newState);
    });
    
    toggleContainer.appendChild(toggleSwitch);
    
    header.appendChild(toggleContainer);
    sidebar.appendChild(header);
}

/**
 * Toggles visibility of all airspace layers
 * @param {boolean} isVisible - Whether the airspace should be visible
 */
export function toggleAirspaceVisibility(isVisible) {
    const map = getMap();
    
    getLayerManager().setVisibility('airspace-fill', isVisible);
    getLayerManager().setVisibility('airspace-outline', isVisible);
    
    // Update checkbox states - only for airspace type checkboxes (not peaks/passes)
    const airspaceCheckboxes = document.querySelectorAll('#airspace-sidebar input[type="checkbox"][id^="toggle-"]');
    airspaceCheckboxes.forEach(cb => {
        cb.disabled = !isVisible;
    });
    
    // If hiding airspace, clear any popup and marker
    if (!isVisible) {
        clearPopup();
        clearHighlight();
        clearMarker();
    }
    
    // Update UI toggle
    const toggleSwitch = document.getElementById('airspace-master-toggle');
    if (toggleSwitch) {
        if (isVisible) {
            toggleSwitch.classList.add('active');
        } else {
            toggleSwitch.classList.remove('active');
        }
    }
    
    // Save state
    setAirspaceVisible(isVisible);
}

/**
 * Adds airspace type checkboxes to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 * @param {Array} features - The airspace features
 */
export function addAirspaceTypeCheckboxes(sidebar, features) {
    // Get unique airspace types from features
    const types = {};
    features.forEach(feature => {
        const type = feature.properties.type;
        if (type) {
            types[type] = (types[type] || 0) + 1;
        }
    });
    
    // Convert to array and sort
    const sortedTypes = Object.keys(types).sort((a, b) => {
        const indexA = AIRSPACE_TYPE_ORDER.indexOf(a);
        const indexB = AIRSPACE_TYPE_ORDER.indexOf(b);
        return indexA - indexB;
    });
    
    // Get saved enabled types if available
    const savedEnabledTypes = getEnabledAirspaceTypes();
    
    // Create container for checkboxes
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    // Add checkbox for each type using the factory function
    sortedTypes.forEach(type => {
        const id = `toggle-${type.replace(/\s+/g, '-')}`;
        // Use saved state if available, otherwise default to true
        const isChecked = savedEnabledTypes ? savedEnabledTypes.has(type) : true;
        const checkbox = createOptionCheckbox(id, type, isChecked, updateAirspaceFilter);
        checkboxContainer.appendChild(checkbox);
    });
    
    sidebar.appendChild(checkboxContainer);
    
    // Initialize the airspace filter based on current checkbox states
    updateAirspaceFilter();
    
    // Set initial airspace visibility based on state
    toggleAirspaceVisibility(getAirspaceVisible());
}

/**
 * Adds a divider to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function addSidebarDivider(sidebar) {
    const divider = document.createElement('hr');
    divider.className = 'sidebar-divider';
    sidebar.appendChild(divider);
}

/**
 * Adds peaks and passes toggle to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function addPeaksPassesToggle(sidebar) {
    const map = getMap();
    
    // Create container using same class as airspace types
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    // Add peaks checkbox using the factory function
    const peaksCheckbox = createOptionCheckbox(
        'peaks-toggle',
        'Peaks',
        getPeaksVisible(),
        (e) => {
            setPeaksVisible(e.target.checked);
            getLayerManager().setVisibility('peaks-symbols', e.target.checked);
            saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
        }
    );
    checkboxContainer.appendChild(peaksCheckbox);
    
    // Add passes checkbox using the factory function
    const passesCheckbox = createOptionCheckbox(
        'passes-toggle',
        'Passes',
        getPassesVisible(),
        (e) => {
            setPassesVisible(e.target.checked);
            getLayerManager().setVisibility('passes-symbols', e.target.checked);
            saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
        }
    );
    checkboxContainer.appendChild(passesCheckbox);
    
    sidebar.appendChild(checkboxContainer);
}

/**
 * Adds policy configuration buttons to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function addPolicyConfigButtons(sidebar) {
    // Group buttons by policy with titles
    Object.entries(POLICIES).forEach(([policy, configs]) => {
        // Add policy title
        const policyTitle = document.createElement('div');
        policyTitle.textContent = policy.replace('_', ' '); // Replace underscores with spaces
        policyTitle.className = 'sidebar-policy-title';
        sidebar.appendChild(policyTitle);
        
        // Add buttons for this policy
        const policyButtonsContainer = document.createElement('div');
        policyButtonsContainer.className = 'policy-buttons-container';
        
        // Group configs in pairs (2 per row)
        for (let i = 0; i < configs.length; i += 2) {
            const rowContainer = document.createElement('div');
            rowContainer.className = 'policy-row-container';
            
            // Add first button
            addConfigButton(rowContainer, policy, configs[i]);
            
            // Add second button if it exists
            if (i + 1 < configs.length) {
                addConfigButton(rowContainer, policy, configs[i + 1]);
            }
            
            policyButtonsContainer.appendChild(rowContainer);
        }
        
        sidebar.appendChild(policyButtonsContainer);
    });
}

/**
 * Adds a configuration button to the sidebar
 * @param {HTMLElement} container - The container element
 * @param {string} policy - The policy name
 * @param {string} config - The configuration name
 */
export function addConfigButton(container, policy, config) {
    const btn = document.createElement('button');
    btn.textContent = config.split('-')[0];  // Use first part as button label
    btn.className = 'sidebar-config-btn policy-button';
    const fullConfig = policy + '/' + config;
    btn.setAttribute('data-config', fullConfig);
    
    // Check if this is the current configuration and apply styles if needed
    if (fullConfig === getCurrentConfig()) {
        btn.style.backgroundColor = '#4a90e2';
        btn.style.color = 'white';
    }
    
    btn.onclick = async () => {
        // Reset all config buttons first
        document.querySelectorAll('.sidebar-config-btn').forEach(button => {
            button.style.backgroundColor = '';
            button.style.color = '';
        });
        
        // Apply active style to clicked button immediately
        btn.style.backgroundColor = '#4a90e2';
        btn.style.color = 'white';
        
        // Switch configuration
        switchConfig(fullConfig);
    };
    
    container.appendChild(btn);
}

/**
 * Adds text size controls to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function addTextSizeControls(sidebar) {
    // Add text size section title
    const textSizeTitle = document.createElement('div');
    textSizeTitle.textContent = 'Circles Text Size';
    textSizeTitle.className = 'sidebar-section-title';
    sidebar.appendChild(textSizeTitle);
    
    // Add text size buttons container
    const textSizeContainer = document.createElement('div');
    textSizeContainer.className = 'text-size-container';
    
    // Add decrease text size button
    const decreaseTextBtn = document.createElement('button');
    decreaseTextBtn.className = 'sidebar-config-btn text-size-button';
    decreaseTextBtn.innerHTML = '<span class="material-icons-round">exposure_minus_1</span>';
    decreaseTextBtn.addEventListener('click', () => {
        setBaseTextSize(Math.max(1, getBaseTextSize() - 1));
        updateAllLabelSizes();
    });
    
    // Add increase text size button
    const increaseTextBtn = document.createElement('button');
    increaseTextBtn.className = 'sidebar-config-btn text-size-button';
    increaseTextBtn.innerHTML = '<span class="material-icons-round">exposure_plus_1</span>';
    increaseTextBtn.addEventListener('click', () => {
        setBaseTextSize(getBaseTextSize() + 1);
        updateAllLabelSizes();
    });
    
    textSizeContainer.appendChild(decreaseTextBtn);
    textSizeContainer.appendChild(increaseTextBtn);
    sidebar.appendChild(textSizeContainer);
}

/**
 * Updates the airspace filter based on checkbox state
 */
export function updateAirspaceFilter() {
    const checkboxes = document.querySelectorAll('#airspace-sidebar input[type="checkbox"][id^="toggle-"]');
    const enabledTypes = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.id.replace('toggle-', '').replace(/-/g, ' '));
    
    // Save enabled types to state and to Cache API
    setEnabledAirspaceTypes(enabledTypes);
    
    const filter = ['in', ['get', 'type'], ['literal', enabledTypes]];
    getLayerManager().setFilter('airspace-fill', filter);
    getLayerManager().setFilter('airspace-outline', filter);
    
    // Wait for the map to finish rendering before refreshing the popup
    if (document.querySelector('.popup-menu')) {
        // Use the 'idle' event to ensure the map has finished rendering
        const onceIdle = () => {
            triggerPopupRefresh();
            getMap().off('idle', onceIdle); // Remove the listener after it fires once
        };
        
        getMap().on('idle', onceIdle);
    }
}

/**
 * Updates the sidebar config button styles based on cache status
 * @returns {Promise<void>}
 */
export async function updateSidebarConfigButtonStyles() {
    const buttons = document.querySelectorAll('.sidebar-config-btn');
    const currentConfig = getCurrentConfig();
    
    try {
        const cacheCheckPromises = [];
        
        // Create an array of promises for each button's cache check
        for (const button of buttons) {
            const buttonConfig = button.getAttribute('data-config');
            if (buttonConfig) {
                const promise = isConfigCached(buttonConfig).then(isCached => {
                    return { button, isCached, isActive: buttonConfig === currentConfig };
                });
                cacheCheckPromises.push(promise);
            }
        }
        
        // Wait for all cache checks to complete
        const results = await Promise.all(cacheCheckPromises);
        
        // Update button styles based on results
        results.forEach(({ button, isCached, isActive }) => {
            // Always maintain the green border for cached configs
            button.style.border = isCached ? '2px solid #4CAF50' : 'none';
            
            // Set blue background for active config
            if (isActive) {
                button.style.backgroundColor = '#4a90e2'; // Blue color to match other UI elements
                button.style.color = 'white';             // White text for better contrast
            } else {
                button.style.backgroundColor = '';        // Reset to default
                button.style.color = '';                  // Reset to default
            }
        });
    } catch (error) {
        console.error('Error updating sidebar config button styles:', error);
        // Continue without updating styles if there's an error
    }
}

/**
 * Checks if a configuration is cached
 * @param {string} config - The configuration to check
 * @returns {Promise<boolean>} Promise resolving to true if cached, false otherwise
 */
export async function isConfigCached(config) {
    if (!config) {
        console.warn('isConfigCached called with empty config');
        return false;
    }
    
    try {
        const configParts = config.split('/');
        if (configParts.length < 2) {
            console.warn(`Invalid config format: ${config}`);
            return false;
        }
        
        const policy = configParts[0];
        const configPrefix = configParts[1].split('-').slice(0, 3).join('-');
        const mainGeojsonUrl = `${BASE_PATH}/${config}/aa_${policy}_${configPrefix}.geojson`;
        
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(mainGeojsonUrl);
        return !!response;
    } catch (error) {
        console.error(`Error checking if config ${config} is cached:`, error);
        return false;
    }
}

/**
 * Updates all label sizes based on the current base text size
 */
export function updateAllLabelSizes() {
    getLayerManager().updateAllLabelSizes(getBaseTextSize());
}

/**
 * Switches to a different configuration
 * @param {string} cfg - The configuration to switch to
 */
export function switchConfig(cfg) {
    // Clear any existing dynamic layers first
    removeDynamicLayers();
    removeGeoJSONLayers();
    
    // Update the parameters box with new config
    updateParametersBox(cfg.split('/')[1]);
    
    // Update the state with new config values
    setCurrentConfig(cfg);
    setCurrentPolicy(cfg.split('/')[0]);
    
    // Save state to persist the configuration change
    saveStateToLocalStorage().catch(err => console.error('Error saving config state:', err));
    
    // Add the new GeoJSON layers
    addGeoJSONLayers();
    
    // Get current toggle states for applying visibility
    const linestringsToggleState = getLayersToggleState();
    // Apply linestring layer visibility based on toggle state
    getLayerManager().setVisibility('linestrings-layer', linestringsToggleState);
    getLayerManager().setVisibility('linestrings-labels', linestringsToggleState);
    
    // Apply other layer visibilities from state
    getLayerManager().setVisibility('peaks-symbols', getPeaksVisible());
    getLayerManager().setVisibility('passes-symbols', getPassesVisible());
    
    // Apply polygon opacity from state
    getLayerManager().setPaintProperty('polygons-layer', 'fill-opacity', getPolygonOpacity());
    
    // Ensure proper drawing order
    getLayerManager().redrawLayersInOrder();
    
    // Update cache indicators for sidebar config buttons
    updateSidebarConfigButtonStyles();
}

/**
 * Removes all dynamic layers from the map
 */
export function removeDynamicLayers() {
    getLayerManager().removeLayersByPrefix('dynamic-lines-');
    getLayerManager().removeSourcesByPrefix('dynamic-lines-');
}

/**
 * Removes all GeoJSON layers from the map
 */
export function removeGeoJSONLayers() {
    const layersToRemove = [
        'linestrings-layer',
        'linestrings-labels',
        'points-layer',
        'points-labels',
        'points-layer-clickable',
        'polygons-layer'
    ];
    layersToRemove.forEach(id => {
        getLayerManager().removeLayerIfExists(id);
    });
    
    const sourcesToRemove = ['geojson-data', 'polygons'];
    sourcesToRemove.forEach(id => {
        getLayerManager().removeSourceIfExists(id);
    });
}

/**
 * Updates the parameters box with configuration information
 * @param {string} cfg - The configuration string
 */
export function updateParametersBox(cfg) {
    const configOnly = cfg.split('/')[1] || cfg;
    const parts = configOnly.split('-');
    if (parts.length >= 3) {
        const labelText = "L/D " + parts[0] + "-ground " + parts[1] + "m-circuit " + parts[2] + "m";
        const parametersBox = document.getElementById('parametersBox');
        
        // Check if text content has changed
        const contentChanged = parametersBox.textContent !== labelText;
        parametersBox.textContent = labelText;
        
        // If content changed, we need to clear the cache and recalculate
        if (contentChanged) {
            clearFontSizeCache();
        }
        
        // After updating text, adjust font size to fit
        adjustParametersFontSize();
    }
}

// Cache for font sizes by dimensions
const fontSizeCache = loadFontSizeCache();

/**
 * Gets cached font size for specific window dimensions
 * @param {string} dimensionKey - String key in format "widthxheight"
 * @returns {number|null} - Cached font size or null if not found
 */
function getFontSizeForDimensions(dimensionKey) {
    return fontSizeCache[dimensionKey] || null;
}

/**
 * Saves font size for specific window dimensions
 * @param {string} dimensionKey - String key in format "widthxheight"
 * @param {number} fontSize - Font size to cache
 */
function saveFontSizeForDimensions(dimensionKey, fontSize) {
    fontSizeCache[dimensionKey] = fontSize;
    
    // Persist the updated cache to localStorage
    persistFontSizeCache();
}

/**
 * Loads the font size cache from localStorage
 * @returns {Object} The loaded cache or an empty object
 */
function loadFontSizeCache() {
    try {
        const cachedData = localStorage.getItem('parametersFontSizeCache');
        return cachedData ? JSON.parse(cachedData) : {};
    } catch (error) {
        console.warn('Error loading font size cache:', error);
        return {};
    }
}

/**
 * Persists the font size cache to localStorage
 */
function persistFontSizeCache() {
    try {
        localStorage.setItem('parametersFontSizeCache', JSON.stringify(fontSizeCache));
    } catch (error) {
        console.warn('Error persisting font size cache:', error);
    }
}

/**
 * Clears the font size cache
 */
function clearFontSizeCache() {
    for (const key in fontSizeCache) {
        delete fontSizeCache[key];
    }
    // Also clear from localStorage
    try {
        localStorage.removeItem('parametersFontSizeCache');
    } catch (error) {
        console.warn('Error removing font size cache from localStorage:', error);
    }
    console.log('Font size cache cleared due to content change');
}

/**
 * Adjusts the font size of the parameters box to ensure text fits
 * without overflowing or being truncated
 */
export function adjustParametersFontSize() {
    const parametersBox = document.getElementById('parametersBox');
    if (!parametersBox) return;
    
    // Get current dimensions
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const dimensionKey = `${currentWidth}x${currentHeight}`;
    
    // Check if we already have a cached font size for these dimensions
    const cachedFontSize = getFontSizeForDimensions(dimensionKey);
    if (cachedFontSize) {
        // Use cached value if available
        document.documentElement.style.setProperty('--parameters-font-size', cachedFontSize + 'px');
        console.log(`Using cached font size ${cachedFontSize}px for dimensions ${dimensionKey}`);
        return;
    }
    
    // Store the original text content
    const text = parametersBox.textContent;
    
    // Create a temporary span to measure text width
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.fontFamily = getComputedStyle(parametersBox).fontFamily;
    tempSpan.style.fontWeight = getComputedStyle(parametersBox).fontWeight;
    tempSpan.textContent = text;
    document.body.appendChild(tempSpan);
    
    // Use the full window width directly - allow the box to take 100% width on small screens
    const availableWidth = window.innerWidth-10;
    
    // Get current font size from CSS variable or use 24px as default
    let fontSize = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--parameters-font-size')) || 24;
    
    tempSpan.style.fontSize = fontSize + 'px';
    
    // If content is too wide, reduce font size until it fits
    while (tempSpan.offsetWidth > availableWidth && fontSize > 0) {
        fontSize -= 0.5; // Decrease by 0.5px each iteration for smooth scaling
        tempSpan.style.fontSize = fontSize + 'px';
    }
    
    // If content is much narrower than the available width, try increasing font size
    // but don't exceed the default maximum of 24px
    while (tempSpan.offsetWidth < availableWidth && fontSize < 24) {
        fontSize += 0.5;
        tempSpan.style.fontSize = fontSize + 'px';
        
        // Stop increasing if we would exceed the available width
        if (tempSpan.offsetWidth > availableWidth) {
            fontSize -= 0.5; // Go back to the last size that fit
            break;
        }
    }
    
    // Remove the temporary element
    document.body.removeChild(tempSpan);
    
    // Apply the calculated font size
    document.documentElement.style.setProperty('--parameters-font-size', fontSize + 'px');
    
    // Cache the calculated font size for these dimensions
    saveFontSizeForDimensions(dimensionKey, fontSize);
    
    console.log(`Parameters box font size calculated and cached: ${fontSize}px for dimensions ${dimensionKey}`);
}

// Add orientation change listener to adjust font size
window.addEventListener('orientationchange', () => {
    // Use setTimeout to ensure the new dimensions are available after orientation change
    setTimeout(() => {
        // Check if we have a cached value for the new dimensions
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        const dimensionKey = `${currentWidth}x${currentHeight}`;
        
        // Apply cached value if available, otherwise recalculate
        if (fontSizeCache[dimensionKey]) {
            console.log(`Orientation changed to dimensions ${dimensionKey}, using cached value: ${fontSizeCache[dimensionKey]}px`);
            document.documentElement.style.setProperty('--parameters-font-size', fontSizeCache[dimensionKey] + 'px');
        } else {
            console.log(`Orientation changed to dimensions ${dimensionKey}, calculating new font size`);
            adjustParametersFontSize();
        }
    }, 150);
});

// Add window resize listener to adjust font size when screen size changes
// This is mostly for desktop browsers - on mobile, orientation change is the main trigger
window.addEventListener('resize', debounce(() => {
    // Check if dimensions have changed since last calculation
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const dimensionKey = `${currentWidth}x${currentHeight}`;
    
    // Only recalculate if we don't have a cached value for these dimensions
    if (!fontSizeCache[dimensionKey]) {
        console.log(`Resize detected, dimensions ${dimensionKey} not in cache. Recalculating.`);
        adjustParametersFontSize();
    } else {
        console.log(`Resize detected, but dimensions ${dimensionKey} already in cache. Skipping recalculation.`);
    }
}, 150));

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce wait time in milliseconds
 * @return {Function} - The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Adds GeoJSON layers to the map
 */
export function addGeoJSONLayers() {
    const configParts = getCurrentConfig().split('/');
    const configPrefix = configParts[1].split('-').slice(0, 3).join('-');
    const policyName = configParts[0];

    // Add or update sources
    addGeoJSONSources(configPrefix, policyName);
    
    // Add layers
    addPolygonLayer();
    addLineStringLayers();
    addPointLayers();
}

/**
 * Adds GeoJSON sources to the map
 * @param {string} configPrefix - The configuration prefix
 * @param {string} policyName - The policy name
 */
export function addGeoJSONSources(configPrefix, policyName) {
    // Add or update geojson-data source
    getLayerManager().addOrUpdateSource('geojson-data', {
        type: 'geojson',
        data: getCurrentConfig() + '/aa_' + policyName + '_' + configPrefix + '.geojson'
    });
    
    // Add or update polygons source
    getLayerManager().addOrUpdateSource('polygons', {
        type: 'geojson',
        data: getCurrentConfig() + '/aa_' + policyName + '_' + configPrefix + '_sectors1.geojson'
    });
}

/**
 * Adds polygon layer to the map
 */
export function addPolygonLayer() {
    // Add polygons layer if it doesn't exist
    getLayerManager().addLayerIfNotExists('polygons-layer', polygonLayerStyle);
}

/**
 * Adds line string layers to the map
 */
export function addLineStringLayers() {
    // Add linestrings layer if it doesn't exist
    getLayerManager().addLayerIfNotExists('linestrings-layer', lineStringLayerStyle);
    
    // Create a copy of the style to update the text-size with the current base text size
    const labelsStyle = { ...lineStringLabelsLayerStyle };
    labelsStyle.layout = { ...lineStringLabelsLayerStyle.layout };
    labelsStyle.layout['text-size'] = getBaseTextSize();
    
    // Add linestrings labels layer if it doesn't exist
    getLayerManager().addLayerIfNotExists('linestrings-labels', labelsStyle);
    
    // Set initial visibility based on toggle state
    // NOTE: This is handled in switchConfig, but we include it here for cases
    // where addLineStringLayers is called directly without going through switchConfig
    const linestringsToggleState = getLayersToggleState();
    getLayerManager().setVisibility('linestrings-layer', linestringsToggleState);
    getLayerManager().setVisibility('linestrings-labels', linestringsToggleState);
}

/**
 * Adds point layers to the map
 */
export function addPointLayers() {
    // Add points layer if it doesn't exist
    getLayerManager().addLayerIfNotExists('points-layer', pointLayerStyle);
    
    // Add clickable points layer if it doesn't exist
    getLayerManager().addLayerIfNotExists('points-layer-clickable', pointLayerClickableStyle);
    
    // Create a copy of the style to update the text-size with the current base text size
    const labelsStyle = { ...pointLabelsLayerStyle };
    labelsStyle.layout = { ...pointLabelsLayerStyle.layout };
    labelsStyle.layout['text-size'] = getBaseTextSize() + 5;
    
    // Add points labels layer if it doesn't exist
    getLayerManager().addLayerIfNotExists('points-labels', labelsStyle);
}

/**
 * Toggles the sidebar visibility
 */
export function toggleSidebar() {
    const sidebar = document.getElementById('airspace-sidebar');
    const currentDisplay = sidebar.style.display || 'none';
    sidebar.style.display = currentDisplay === 'none' ? 'block' : 'none';
    document.getElementById('sidebarVisibilityIcon').textContent = 'layers';
}

/**
 * Adds location tracking toggle to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function addLocationToggle(sidebar) {
    // Only add location tracking on mobile devices
    if (!isMobileDevice()) {
        return;
    }
    
    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    toggleContainer.style.display = 'flex';
    toggleContainer.style.justifyContent = 'space-between';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.padding = '5px 0';
    
    // Create label
    const label = document.createElement('span');
    label.textContent = 'Location Tracking';
    label.style.marginRight = '10px';
    
    // Get current state from settings (might have been updated during load)
    const isEnabled = getGeolocationEnabled();
    
    // Create toggle switch (default to the current state)
    const toggleSwitch = document.createElement('button');
    toggleSwitch.className = `toggle-switch ${isEnabled ? 'active' : ''}`;
    toggleSwitch.setAttribute('aria-checked', isEnabled.toString());
    toggleSwitch.setAttribute('role', 'switch');
    toggleSwitch.id = 'location-toggle';
    
    // Create toggle slider
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    toggleSwitch.appendChild(toggleSlider);
    
    // Append elements to container
    toggleContainer.appendChild(label);
    toggleContainer.appendChild(toggleSwitch);
    
    // Add to sidebar
    sidebar.appendChild(toggleContainer);
    
    // Add click handler
    toggleSwitch.addEventListener('click', async () => {
        const currentState = getGeolocationEnabled();
        const newState = !currentState;
        
        // Use toggleManager to handle the toggle
        await toggleGeolocation(newState);
    });
    
    // Now add the Navboxes toggle
    addNavboxesToggle(sidebar);
    
    // Initialize the toggle manager after both toggles are created
    initToggleManager();
}

/**
 * Adds navboxes toggle to the sidebar
 * @param {HTMLElement} sidebar - The sidebar element
 */
export function addNavboxesToggle(sidebar) {
    // Only add this toggle on mobile devices
    if (!isMobileDevice()) {
        console.log('Navboxes toggle not added - not a mobile device');
        return;
    }
    
    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    toggleContainer.style.display = 'flex';
    toggleContainer.style.justifyContent = 'space-between';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.padding = '5px 0';
    toggleContainer.id = 'navboxes-toggle-container';
    
    // Create label
    const label = document.createElement('span');
    label.textContent = 'Navboxes';
    label.style.marginRight = '10px';
    
    // Get current state from settings
    const isEnabled = getNavboxesEnabled();
    const geolocationEnabled = getGeolocationEnabled();
    
    // Create toggle switch
    const toggleSwitch = document.createElement('button');
    toggleSwitch.className = `toggle-switch ${isEnabled ? 'active' : ''}`;
    toggleSwitch.setAttribute('aria-checked', isEnabled.toString());
    toggleSwitch.setAttribute('role', 'switch');
    toggleSwitch.id = 'navboxes-toggle';
    
    // Disable the toggle if geolocation is disabled
    if (!geolocationEnabled) {
        toggleSwitch.disabled = true;
        toggleSwitch.style.opacity = '0.5';
        toggleSwitch.style.cursor = 'not-allowed';
    }
    
    // Create toggle slider
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    toggleSwitch.appendChild(toggleSlider);
    
    // Append elements to container
    toggleContainer.appendChild(label);
    toggleContainer.appendChild(toggleSwitch);
    
    // Add to sidebar
    sidebar.appendChild(toggleContainer);
    
    // Add click handler
    toggleSwitch.addEventListener('click', () => {
        const currentState = getNavboxesEnabled();
        const newState = !currentState;
        
        // Use toggleManager to handle the toggle
        toggleNavboxes(newState);
    });
}

// Note: These functions are referenced but defined elsewhere
// They will need to be imported from the appropriate modules
// or moved here if they are sidebar-specific 