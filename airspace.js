/**
 * Airspace module for MountainCircles Map
 * Contains functions for airspace data management, visualization, and interaction
 */

// Import from config
import {
    COLOR_MAPPING,
} from "./config.js";

// Import from state management
import {
    getMap,
    getLayerManager,
    getLastPopupLngLat,
    getHighlightedFeatureKey,
    getPopupMarker,
    getAirspaceData,
    getPopup,
    getCrossSectionContainer,
    getFeatures,
    getSectionRefs,
    getBarRefs,
    getMaxUpperLimit,
    getBarWidth,
    getBarSpacing,
    getColumns,
    getAltitudeSet,
    setLastPopupLngLat,
    setHighlightedFeatureKey,
    setPopupMarker,
    setAirspaceData,
    setPopup,
    setCrossSectionContainer,
    setFeatures,
    setSectionRef,
    setBarRef,
    setColumns,
    setAltitudeSet,
    clearPopup,
    clearRefs
} from "./state.js";

/**
 * Utility function to filter map features based on checkbox state
 * This function is intentionally kept as a pure function that takes features as a parameter
 * rather than using state, as it's used to process features before they're stored in state.
 * @param {Array} features - Array of features to filter
 * @returns {Array} Filtered features
 */
export function filterMapFeatures(features) {
    return features.filter(function(feature) {
        const type = feature.properties.type;
        const checkbox = document.getElementById(`toggle-${type.replace(/\s+/g, '-')}`);
        return checkbox ? checkbox.checked : true;
    });
}

/**
 * Fetches and stores the complete airspace data
 * @returns {Promise<Object>} Promise resolving to the airspace GeoJSON data
 */
export async function fetchAirspaceData() {
    // Check if we already have the data in state
    if (getAirspaceData()) {
        return getAirspaceData();
    }
    
    try {
        const response = await fetch('airspace.geojson');
        if (!response.ok) {
            throw new Error(`Failed to fetch airspace data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        // Store the data in state
        setAirspaceData(data);
        return data;
    } catch (error) {
        console.error('Error fetching airspace data:', error);
        throw error; // Re-throw to allow caller to handle
    }
}

/**
 * Updates popup style based on screen orientation
 */
export function updatePopupStyle() {
    const popup = getPopup();
    if (!popup) return;
    const mapEl = document.getElementById('map');
    if (window.innerWidth > window.innerHeight) {
        // Landscape mode
        popup.style.maxWidth = '50%';
        popup.style.width = 'fit-content';
        popup.style.maxHeight = mapEl.clientHeight + 'px';
        popup.style.right = '0px';
        popup.style.top = '50%';
        popup.style.bottom = '';
        popup.style.transform = 'translateY(-50%)';
    } else {
        // Portrait mode
        popup.style.maxWidth = '100%';
        popup.style.width = 'fit-content';
        popup.style.maxHeight = (mapEl.clientHeight * 0.5) + 'px';
        popup.style.right = '0px';
        popup.style.top = '';
        popup.style.bottom = '0px';
        popup.style.transform = '';
    }
}

/**
 * Refreshes the airspace popup when filters change
 */
export async function refreshAirspacePopup() {
    const lngLat = getLastPopupLngLat();
    if (!lngLat) return;
    
    try {
        const map = getMap();
        
        // Get current point from last popup location
        const currentPoint = map.project(lngLat);
        
        // Query features at the current point with current filters
        let features = map.queryRenderedFeatures(currentPoint, {
            layers: ['airspace-fill']
        });
        
        // Apply filtering
        features = filterMapFeatures(features);
        
        // Remove existing popup
        clearPopup();
        
        // Create new popup with filtered features
        if (features && features.length > 0) {
            createAirspacePopup();
        } else {
            // If no features found after filtering, remove marker too
            const popupMarker = getPopupMarker();
            if (popupMarker) {
                popupMarker.remove();
                setPopupMarker(null);
            }
            setLastPopupLngLat(null);
            setHighlightedFeatureKey(null);
        }
    } catch (error) {
        console.error('Error refreshing airspace popup:', error);
    }
}

/**
 * Toggles highlighting for a feature
 * @param {Object} feature - The feature to highlight
 * @param {number} index - The index of the feature in the features array
 */
export function toggleFeatureHighlight(feature, index) {
    const map = getMap();
    const sectionRefs = getSectionRefs();
    const barRefs = getBarRefs();
    
    // Clear any existing highlights
    clearHighlight();
    
    // Set the highlighted feature key in state
    setHighlightedFeatureKey(feature.properties.AN);
    
    // Highlight the section and bar
    const section = sectionRefs.get(index);
    const bar = barRefs.get(index);
    
    if (section) {
        section.classList.add('highlighted');
        let cb = section.querySelector('.colorBand');
        if (cb) cb.classList.add('colorBand-highlighted');
    }
    if (bar) {
        bar.classList.add('highlighted-bar');
    }
    
    // Get the complete feature from our stored data
    const airspaceData = getAirspaceData();
    if (airspaceData && airspaceData.features) {
        const completeFeature = airspaceData.features.find(f => 
            f.properties.AN === feature.properties.AN
        );
        
        if (completeFeature) {
            getLayerManager().addOrUpdateSource('highlight-airspace-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [completeFeature]
                }
            });
        }
    }
}

/**
 * Clears any highlighted features
 */
export function clearHighlight() {
    const map = getMap();
    
    // Clear highlighted feature key in state
    setHighlightedFeatureKey(null);
    
    // Remove highlighted classes from DOM elements
    document.querySelectorAll('.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });
    document.querySelectorAll('.colorBand-highlighted').forEach(el => {
        el.classList.remove('colorBand-highlighted');
    });
    document.querySelectorAll('.highlighted-bar').forEach(el => {
        el.classList.remove('highlighted-bar');
    });
    
    // Clear the highlight source
    getLayerManager().addOrUpdateSource('highlight-airspace-source', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });
}

/**
 * Creates a popup section for an airspace feature
 * @param {number} index - The index of the feature in the features array
 * @returns {HTMLElement} The created section element
 */
export function buildPopupSection(index) {
    const features = getFeatures();
    if (!features || !features[index]) return null;
    
    const feature = features[index];
    const props = feature.properties;
    const featureKey = props.AN || props.type;

    // Create the section
    const section = document.createElement('div');
    section.className = 'popup-section';
    section.style.position = 'relative';
    section.dataset.featureKey = featureKey;

    // Create header with AN (name) and type
    const headerDiv = document.createElement('div');
    headerDiv.innerHTML = `<strong>${props.AN || props.type}</strong>`;
    section.appendChild(headerDiv);

    // Create flex container for limits
    const limitsTypeContainer = document.createElement('div');
    limitsTypeContainer.className = 'limits-type-container';

    // Limits stack with underline
    const limitsDiv = document.createElement('div');
    limitsDiv.className = 'limits-div';

    // Upper limit (AH)
    const upperLimitDiv = document.createElement('div');
    upperLimitDiv.textContent = props.AH || '';
    upperLimitDiv.className = 'upper-limit';
    limitsDiv.appendChild(upperLimitDiv);

    // Lower limit (AL)
    const lowerLimitDiv = document.createElement('div');
    lowerLimitDiv.textContent = props.AL || '';
    lowerLimitDiv.className = 'lower-limit';
    limitsDiv.appendChild(lowerLimitDiv);

    limitsTypeContainer.appendChild(limitsDiv);

    // Add type if different from name
    if (props.type && props.AN && props.type !== props.AN) {
        const typeDiv = document.createElement('div');
        typeDiv.textContent = props.type;
        typeDiv.style.marginLeft = '10px';
        limitsTypeContainer.appendChild(typeDiv);
    }

    section.appendChild(limitsTypeContainer);

    // Add frequency information if available
    if (props.AG || props.AF) {
        const freqContainer = document.createElement("div");
        freqContainer.style.color = "darkgreen";
        freqContainer.style.fontSize = "0.9em";
        freqContainer.textContent = `${props.AG || ''} ${props.AF || ''}`.trim();
        section.appendChild(freqContainer);
    }

    // Add the colored band using the type
    const colorBand = document.createElement('div');
    colorBand.className = 'colorBand';
    colorBand.style.backgroundColor = COLOR_MAPPING[props.type] || COLOR_MAPPING["other"];
    section.appendChild(colorBand);

    return section;
}

/**
 * Creates an airspace popup at the current marker location
 * Uses state variables instead of parameters
 */
export function createAirspacePopup() {
    // Get state variables
    const map = getMap();
    const lngLat = getLastPopupLngLat();
    const highlightedFeatureKey = getHighlightedFeatureKey();
    
    if (!lngLat) {
        console.warn('Cannot create popup: No lngLat in state');
        return;
    }
    
    // Query features at current point
    const currentPoint = map.project(lngLat);
    let features = map.queryRenderedFeatures(currentPoint, {
        layers: ['airspace-fill']
    });
    features = filterMapFeatures(features);
    
    // Store features in state
    setFeatures(features);
    
    // Remove any existing popup
    clearPopup();
    
    // Clear existing refs
    clearRefs();

    // Create the popup container
    const popup = document.createElement('div');
    popup.className = 'popup-menu';
    popup.style.display = 'inline-flex';

    // Store popup in state
    setPopup(popup);

    // Append the popup to the map container
    document.getElementById('map').appendChild(popup);

    // Call updatePopupStyle to set appropriate styling based on orientation
    updatePopupStyle();

    // Create containers
    const crossSectionContainer = document.createElement('div');
    crossSectionContainer.className = 'cross-section';
    
    // Store cross-section container in state
    setCrossSectionContainer(crossSectionContainer);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'popup-content';

    // Build content sections
    buildPopupContent(contentContainer);

    // Assemble popup with content
    popup.appendChild(crossSectionContainer);
    popup.appendChild(contentContainer);

    // Build cross-section visualization
    if (features.length) {
        buildCrossSectionVisualization();
    }
    
    // Restore highlighting if a feature was highlighted
    if (highlightedFeatureKey) {
        // Find the feature with the matching key
        const highlightedFeature = features.find(f => f.properties.AN === highlightedFeatureKey);
        if (highlightedFeature) {
            toggleFeatureHighlight(highlightedFeature, highlightedFeature.originalIndex);
        }
    }
}

/**
 * Builds the content section of the airspace popup
 * @param {HTMLElement} contentContainer - Container element for the content
 */
export function buildPopupContent(contentContainer) {
    const features = getFeatures();
    if (features && features.length) {
        // Sort features by altitude (highest first)
        features.sort((a, b) => (b.properties.lowerLimitMeters || 0) - (a.properties.lowerLimitMeters || 0));
        
        // Update features in state after sorting
        setFeatures(features);
        
        features.forEach((feature, index) => {
            const section = buildPopupSection(index);
            if (section) {
                section.dataset.featureIndex = index;
                setSectionRef(index, section);

                section.addEventListener('click', () => {
                    toggleFeatureHighlight(feature, index);
                });

                contentContainer.appendChild(section);
            }
        });
    } else {
        contentContainer.innerHTML = "<p>No Airspace found at this location, MAX FL115 / FL195 in France.</p>";
    }
}

/**
 * Builds a cross-section visualization for the airspace popup
 */
export function buildCrossSectionVisualization() {
    const crossSectionContainer = getCrossSectionContainer();
    if (!crossSectionContainer) return;
    
    const features = getFeatures();
    if (!features || !features.length) return;
    
    // Calculate column layout and collect altitude data
    calculateColumnLayout();
    
    // Draw bars
    const width = drawBars();
    
    // Add altitude labels
    addAltitudeLabels(width);
}

/**
 * Calculates the column layout for the cross-section visualization
 */
export function calculateColumnLayout() {
    const features = getFeatures();
    if (!features) return;
    
    // Reset visualization data
    setColumns([]);
    setAltitudeSet(new Set());
    
    // Group features into columns
    const columns = [];
    const altitudeSet = new Set();
    const maxColumns = 5; // Limit to prevent cluttered visualization
    const numColumns = Math.min(features.length, maxColumns);
    
    features.forEach((feature, index) => {
        const lowerLimitMeters = feature.properties.lowerLimitMeters || 0;
        const upperLimitMeters = Math.min(feature.properties.upperLimitMeters || 0, getMaxUpperLimit());
        const lowerDisplay = feature.properties.AL || '';
        const upperDisplay = feature.properties.AH || '';

        // Add tuples to the Set
        altitudeSet.add(JSON.stringify([lowerLimitMeters, lowerDisplay]));
        altitudeSet.add(JSON.stringify([upperLimitMeters, upperDisplay]));

        // Find a column where this bar can be placed without overlapping
        let placed = false;
        for (let col of columns) {
            let canPlace = true;
            for (let existingBar of col) {
                const existingLower = existingBar.lowerLimit;
                const existingUpper = existingBar.upperLimit;
                if (!(upperLimitMeters <= existingLower || lowerLimitMeters >= existingUpper)) {
                    canPlace = false;
                    break;
                }
            }
            if (canPlace) {
                col.push({ lowerLimit: lowerLimitMeters, upperLimit: upperLimitMeters, feature, index });
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([{ lowerLimit: lowerLimitMeters, upperLimit: upperLimitMeters, feature, index }]);
        }
    });
    
    // Store in state
    setColumns(columns);
    setAltitudeSet(altitudeSet);
}

/**
 * Draws the bars for the cross-section visualization
 * @returns {number} The total width of the cross-section
 */
export function drawBars() {
    const crossSectionContainer = getCrossSectionContainer();
    if (!crossSectionContainer) return 0;
    
    const features = getFeatures();
    const columns = getColumns();
    const barWidth = getBarWidth();
    const barSpacing = getBarSpacing();
    const maxUpperLimit = getMaxUpperLimit();
    
    if (!features || !features.length || !columns.length) return 0;
    
    let totalWidth = 0;
     
    columns.forEach((column, colIndex) => {
        const xPos = barSpacing + colIndex * (barWidth + barSpacing);
        
        column.forEach(({ lowerLimit, upperLimit, feature, index }) => {
            const yUpper = (upperLimit / maxUpperLimit) * 100;
            const yLower = (lowerLimit / maxUpperLimit) * 100;
            const barHeight = yUpper - yLower;

            if (barHeight <= 0) {
                console.warn(`Invalid bar height for ${feature.properties.icaoClass || feature.properties.type}: ${barHeight}%`);
                return;
            }

            const bar = document.createElement('div');
            bar.className = 'airspace-bar';
            bar.style.left = `${xPos}px`;
            bar.style.bottom = `${yLower}%`;
            bar.style.width = `${barWidth}px`;
            bar.style.height = `${barHeight}%`;
            bar.style.backgroundColor = COLOR_MAPPING[feature.properties.type] || COLOR_MAPPING["other"];
            setBarRef(index, bar);

            // Use state-based toggleFeatureHighlight
            bar.addEventListener('click', () => {
                toggleFeatureHighlight(feature, index);
            });

            crossSectionContainer.appendChild(bar);
        });
        
        totalWidth = xPos + barWidth;
    });

    // Set container width
    totalWidth += barSpacing;
    const width = Math.max(totalWidth, 60);
    crossSectionContainer.style.width = `${width}px`;
    
    return width;
}

/**
 * Adds altitude labels to the cross-section visualization
 * @param {number} width - The width of the cross-section
 */
export function addAltitudeLabels(width) {
    const crossSectionContainer = getCrossSectionContainer();
    if (!crossSectionContainer) return;
    
    const altitudeSet = getAltitudeSet();
    const maxUpperLimit = getMaxUpperLimit();
    
    const altitudes = Array.from(altitudeSet)
        .map(item => JSON.parse(item)) // Convert back from string to [meters, parsed] array
        .sort((a, b) => b[0] - a[0]) // Sort by meters (first element)
        .filter(([_, displayValue]) => {
            // Skip if it's a FL above 195
            if (displayValue && displayValue.startsWith('FL')) {
                const flNumber = parseInt(displayValue.substring(2));
                if (!isNaN(flNumber) && flNumber > 195) {
                    return false;
                }
            }
            return true;
        });

    altitudes.forEach(([altitudeMeters, displayValue]) => {
        const yPos = (altitudeMeters / maxUpperLimit) * 100;
        
        // Add label
        const label = document.createElement('div');
        label.className = 'altitude-label';
        label.textContent = displayValue;
        label.style.bottom = `calc(${yPos}% - 12px)`;
        crossSectionContainer.appendChild(label);

        // Add horizontal line
        const line = document.createElement('div');
        line.className = 'altitude-line';
        line.style.bottom = `${yPos}%`;
        line.style.width = `${width}px`;
        crossSectionContainer.appendChild(line);
    });
}

/**
 * Triggers a refresh of the airspace popup
 */
export function triggerPopupRefresh() {
    if (document.querySelector('.popup-menu')) {
        refreshAirspacePopup();
    }
}

// Export functions will be added here as we move them from other files 