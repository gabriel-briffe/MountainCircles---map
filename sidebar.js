/**
 * Sidebar module for MountainCircles Map
 * Contains functions for sidebar creation, management, and interaction
 */

// Import from config
import {
    COLOR_MAPPING,
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
    getPopupMarker,
    getCurrentConfig,
    getPopup,
    setPeaksVisible,
    setPassesVisible,
    setBaseTextSize,
    setCurrentConfig,
    setCurrentPolicy,
    clearPopup
} from "./state.js";

// Import from airspace module
import {
    clearHighlight,
    triggerPopupRefresh
} from "./airspace.js";

// Import layer styles
import { 
    polygonLayerStyle,
    lineStringLayerStyle,
    lineStringLabelsLayerStyle,
    pointLayerStyle,
    pointLayerClickableStyle,
    pointLabelsLayerStyle
} from "./layerStyles.js";

// Import necessary functions from mapInitializer
import {
    createDynamicLayer,
    createDynamicLineWithLabels,
    ensureAirspaceLayersOnTop
} from "./mapInitializer.js";

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
    
    // Create header
    createSidebarHeader(sidebar);
    
    // Add airspace type checkboxes (removed divider)
    addAirspaceTypeCheckboxes(sidebar, features);
    
    // Add divider
    addSidebarDivider(sidebar);
    
    // Add peaks/passes toggle
    addPeaksPassesToggle(sidebar);
    
    // Add divider
    addSidebarDivider(sidebar);
    
    // Add policy/config buttons
    addPolicyConfigButtons(sidebar);
    
    // Add divider
    addSidebarDivider(sidebar);
    
    // Add text size controls
    addTextSizeControls(sidebar);
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
    toggleSwitch.className = 'toggle-switch active';
    toggleSwitch.id = 'airspace-master-toggle';
    
    // Add the slider inside the toggle
    const slider = document.createElement('div');
    slider.className = 'toggle-slider';
    toggleSwitch.appendChild(slider);
    
    // Add click event listener to toggle visibility
    toggleSwitch.addEventListener('click', () => {
        toggleSwitch.classList.toggle('active');
        toggleAirspaceVisibility(toggleSwitch.classList.contains('active'));
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
    
    // If hiding airspace, clear any popup
    if (!isVisible) {
        clearPopup();
        clearHighlight();
    }
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
    
    // Create container for checkboxes
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    // Add checkbox for each type using the factory function
    sortedTypes.forEach(type => {
        const id = `toggle-${type.replace(/\s+/g, '-')}`;
        const checkbox = createOptionCheckbox(id, type, true, updateAirspaceFilter);
        checkboxContainer.appendChild(checkbox);
    });
    
    sidebar.appendChild(checkboxContainer);
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
    
    btn.onclick = async () => {
        switchConfig(fullConfig);
        console.log("Switched to configuration: " + fullConfig);
        
        // Update cache indicator for sidebar buttons
        await updateSidebarConfigButtonStyles();
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
    const checkboxes = document.querySelectorAll('#airspace-sidebar input[type="checkbox"]');
    const enabledTypes = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.id.replace('toggle-', '').replace(/-/g, ' '));
    
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
    
    try {
        const cacheCheckPromises = [];
        
        // Create an array of promises for each button's cache check
        for (const button of buttons) {
            const buttonConfig = button.getAttribute('data-config');
            if (buttonConfig) {
                const promise = isConfigCached(buttonConfig).then(isCached => {
                    return { button, isCached };
                });
                cacheCheckPromises.push(promise);
            }
        }
        
        // Wait for all cache checks to complete
        const results = await Promise.all(cacheCheckPromises);
        
        // Update button styles based on results
        results.forEach(({ button, isCached }) => {
            button.style.border = isCached ? '2px solid #4CAF50' : 'none';
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
    removeDynamicLayers();
    removeGeoJSONLayers();
    updateParametersBox(cfg.split('/')[1]);
    setCurrentConfig(cfg);
    setCurrentPolicy(cfg.split('/')[0]);
    addGeoJSONLayers();
    
    getLayerManager().setVisibility('peaks-symbols', getPeaksVisible());
    getLayerManager().setVisibility('passes-symbols', getPassesVisible());
    
    getLayerManager().moveLayerToTop('passes-symbols');
    getLayerManager().moveLayerToTop('peaks-symbols');
    getLayerManager().moveLayerToTop('location-marker-circle');
    
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
    console.log("updateParametersBox called with:", cfg);
    const configOnly = cfg.split('/')[1] || cfg;
    const parts = configOnly.split('-');
    console.log("parts after split:", parts);
    if (parts.length >= 3) {
        const labelText = "L/D " + parts[0] + "-ground " + parts[1] + "m-circuit " + parts[2] + "m";
        console.log("setting label to:", labelText);
        document.getElementById('parametersBox').textContent = labelText;
    }
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
    
    // Ensure airspace layers are on top of all other layers
    ensureAirspaceLayersOnTop();
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

// Note: These functions are referenced but defined elsewhere
// They will need to be imported from the appropriate modules
// or moved here if they are sidebar-specific 