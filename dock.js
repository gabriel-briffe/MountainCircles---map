/**
 * Dock module for MountainCircles Map
 * Contains functions for dock UI elements, controls, and interactions
 */

// Import from state management
import {
    getMap,
    getLayerManager,
    getLayersToggleState,
    setLayersToggleState,
    getPolygonOpacity,
    setPolygonOpacity,
    saveStateToLocalStorage
} from "./state.js";

// Import EDL UI functions
import {
    initEDLUI,
    navigateToPreviousHour,
    navigateToNextHour,
    navigateToCurrentTime,
    toggleEDLNavigationRow,
    updateNavigationButtonsState
} from "./edlUI.js";

// Import EDL functions
import { createEDLLayer } from "./edl.js";

// Flag to track EDL navigation row visibility
let edlNavigationVisible = false;

/**
 * Creates a debounced version of a function
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce time in milliseconds
 * @returns {Function} - The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Calculates and sets optimal button and slider sizes based on available space
 */
function updateDockElementSizes() {
    // Get the map dock element
    const mapDock = document.getElementById('mapDock');
    if (!mapDock) return;

    // Count number of buttons in the dock
    const buttons = mapDock.querySelectorAll('button:not(.dock-slider)');
    const buttonCount = buttons.length;
    
    // Check if we have a slider
    const slider = mapDock.querySelector('.dock-slider');
    const hasSlider = slider !== null;
    
    // Determine effective count (slider counts as 3 buttons)
    const effectiveCount = buttonCount + (hasSlider ? 3 : 0);
    
    // Determine available space based on orientation
    const isLandscape = window.innerWidth > window.innerHeight;
    const availableSpace = isLandscape ? 
        window.innerHeight - 40 : // 20px padding on each side in landscape
        window.innerWidth - 40;   // 20px padding on each side in portrait
    
    // Allow unlimited shrinking by setting minButtonSize to 0
    const minButtonSize = 0;
    const maxButtonSize = 48;
    
    // We need to calculate the button size taking into account that gaps are proportional to button size
    // This requires solving for buttonSize in the equation:
    // availableSpace = buttonSize * effectiveCount + (effectiveCount - 1) * (buttonSize * 0.2)
    // Simplifying:
    // availableSpace = buttonSize * effectiveCount + buttonSize * 0.2 * (effectiveCount - 1)
    // availableSpace = buttonSize * (effectiveCount + 0.2 * (effectiveCount - 1))
    // Therefore: buttonSize = availableSpace / (effectiveCount + 0.2 * (effectiveCount - 1))
    
    const gapMultiplier = 0.2; // Gap is 20% of button size
    const buttonSizeFactor = effectiveCount + gapMultiplier * (effectiveCount - 1);
    let calculatedButtonSize = availableSpace / buttonSizeFactor;
    
    // Constrain to min/max
    const buttonSize = Math.min(Math.max(calculatedButtonSize, minButtonSize), maxButtonSize);
    
    // Slider is 3x a button
    const sliderLength = buttonSize * 3;
    
    // Update CSS variables
    document.documentElement.style.setProperty('--dock-button-size', `${buttonSize}px`);
    document.documentElement.style.setProperty('--dock-slider-length', `${sliderLength}px`);
    
    // Log all sizes for debugging
    // logDockSizes(buttonCount, hasSlider, effectiveCount, availableSpace, buttonSize, sliderLength, !isLandscape); // Inverted for UI orientation
}

/**
 * Logs all dock element sizes for debugging purposes
 */
function logDockSizes(buttonCount, hasSlider, effectiveCount, totalSpace, buttonSize, sliderLength, isPortrait) {
    console.log('=== DOCK SIZES ===');
    console.log(`Orientation: ${isPortrait ? 'Portrait' : 'Landscape'}`);
    console.log(`Window dimensions: ${window.innerWidth}px × ${window.innerHeight}px`);
    console.log(`Button count: ${buttonCount}`);
    console.log(`Has slider: ${hasSlider}`);
    console.log(`Effective element count: ${effectiveCount}`);
    console.log(`Total space: ${totalSpace}px`);
    
    // Calculate margin
    const margin = buttonSize * 0.2;
    console.log(`Screen margin: ${margin}px (${(margin*2).toFixed(1)}px total)`);
    console.log(`Available space: ${totalSpace - (margin*2)}px`);
    
    console.log(`Button size: ${buttonSize}px`);
    console.log(`Slider length: ${sliderLength}px`);
    console.log(`Gap size: ${(buttonSize * 0.2).toFixed(1)}px`);
    
    // Get computed styles for more detailed information
    const slider = document.querySelector('.dock-slider');
    const button = document.querySelector('#mapDock button');
    
    if (slider) {
        const sliderStyle = window.getComputedStyle(slider);
        console.log('Slider container:');
        console.log(`  Width: ${sliderStyle.width}`);
        console.log(`  Height: ${sliderStyle.height}`);
        console.log(`  Padding: ${sliderStyle.padding}`);
        console.log(`  Max-width: ${sliderStyle.maxWidth}`);
        console.log(`  Max-height: ${sliderStyle.maxHeight}`);
        
        // Get the actual range input
        const rangeInput = document.querySelector('#polygonOpacitySlider');
        if (rangeInput) {
            const rangeStyle = window.getComputedStyle(rangeInput);
            console.log('Range input:');
            console.log(`  Width: ${rangeStyle.width}`);
            console.log(`  Transform: ${rangeStyle.transform}`);
            console.log(`  Position: ${rangeStyle.position}`);
            
            // Get thumb size
            const thumbSize = buttonSize * 0.4;
            console.log(`  Thumb size: ${thumbSize}px`);
        }
    }
    
    if (button) {
        const buttonStyle = window.getComputedStyle(button);
        console.log('Button:');
        console.log(`  Width: ${buttonStyle.width}`);
        console.log(`  Height: ${buttonStyle.height}`);
        console.log(`  Padding: ${buttonStyle.padding}`);
        console.log(`  Max-width: ${buttonStyle.maxWidth}`);
    }
    
    console.log('=================');
}

/**
 * Updates the visibility icon based on layer toggle state
 */
export function updateVisibilityIcon() {
    const toggleState = getLayersToggleState();
    document.getElementById('visibilityIcon').textContent = toggleState ? 'visibility' : 'visibility_off';
}

/**
 * Toggles the visibility of line string layers
 */
export function toggleLayerVisibility() {
    // Toggle the state first
    const currentState = getLayersToggleState();
    const newState = !currentState;
    setLayersToggleState(newState);
    
    // Update the icon
    updateVisibilityIcon();
    
    // Now set layer visibility based on the new state
    const layerIds = ['linestrings-layer', 'linestrings-labels'];
    const newVisibility = newState ? 'visible' : 'none';
    
    // Set visibility of main layers
    layerIds.forEach(id => {
        if (getLayerManager().hasLayer(id)) {
            getLayerManager().setVisibility(id, newState);
        }
    });
    
    // If turning visibility off, also hide all dynamic layers
    if (!newState) {
        const map = getMap();
        const style = map.getStyle();
        if (style && style.layers) {
            style.layers.forEach(layer => {
                if (layer.id.startsWith('dynamic-lines-')) {
                    getLayerManager().setVisibility(layer.id, false);
                }
            });
        }
    }
    
    // Save state to Cache API
    saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
}

/**
 * Toggles the EDL navigation row
 */
export function toggleEDLNavigation() {
    console.log('[Dock] Toggling EDL navigation row');
    
    // Create EDL navigation row if it doesn't exist
    if (!document.getElementById('edlNavRow')) {
        createEDLNavigationRow();
    }
    
    // Toggle the visibility state
    edlNavigationVisible = !edlNavigationVisible;
    
    // Update UI
    toggleEDLNavigationRow(edlNavigationVisible);
    
    // Update button visual
    const toggleButton = document.getElementById('toggleEDLNavigationBtn');
    if (toggleButton) {
        // Make sure to remove old class first to ensure proper toggling
        toggleButton.classList.remove('active');
        if (edlNavigationVisible) {
            toggleButton.classList.add('active');
        }
        console.log(`[Dock] EDL button active state: ${toggleButton.classList.contains('active')}`);
    }
    
    // Initialize EDL layer if it doesn't exist and we're making the navigation visible
    if (edlNavigationVisible && !getLayerManager().hasLayer('edl-layer')) {
        console.log('[Dock] Creating initial EDL layer');
        const initialLayer = createEDLLayer(getMap());
        if (initialLayer) {
            // Initialize the EDL UI
            import('./edlUI.js').then(module => {
                module.initEDLUI(initialLayer);
                
                // Ensure layer is initially invisible
                getLayerManager().setVisibility('edl-layer', false);
                
                // Make sure the visibility icon shows the correct state
                const visibilityButton = document.getElementById('edlVisibilityBtn');
                if (visibilityButton) {
                    visibilityButton.innerHTML = '<span class="material-icons">visibility_off</span>';
                }
            });
        }
    }
}

/**
 * Creates the EDL navigation row in the dock
 */
function createEDLNavigationRow() {
    console.log('[Dock] Creating EDL navigation row');
    
    // Create row container
    const navRow = document.createElement('div');
    navRow.id = 'edlNavRow';
    navRow.className = 'edl-nav-row';
    navRow.style.display = 'none'; // Initially hidden
    
    // Previous hour button
    const prevButton = document.createElement('button');
    prevButton.id = 'edlPrevHourBtn';
    prevButton.className = 'edl-nav-btn';
    prevButton.title = 'Previous Hour';
    prevButton.innerHTML = '<span class="material-icons">keyboard_double_arrow_left</span>';
    prevButton.addEventListener('click', () => {
        console.log('[Dock] Previous hour button clicked');
        navigateToPreviousHour();
    });
    
    // Current time button
    const nowButton = document.createElement('button');
    nowButton.id = 'edlNowBtn';
    nowButton.className = 'edl-nav-btn';
    nowButton.title = 'Current Time';
    
    // Time indicator span
    const timeIndicator = document.createElement('span');
    timeIndicator.id = 'edlTimeIndicator';
    timeIndicator.textContent = 'Now';
    
    nowButton.appendChild(timeIndicator);
    nowButton.addEventListener('click', () => {
        console.log('[Dock] Now button clicked');
        navigateToCurrentTime();
    });
    
    // Next hour button
    const nextButton = document.createElement('button');
    nextButton.id = 'edlNextHourBtn';
    nextButton.className = 'edl-nav-btn';
    nextButton.title = 'Next Hour';
    nextButton.innerHTML = '<span class="material-icons">keyboard_double_arrow_right</span>';
    nextButton.addEventListener('click', () => {
        console.log('[Dock] Next hour button clicked');
        navigateToNextHour();
    });
    
    // Pressure Up button
    const pressureUpButton = document.createElement('button');
    pressureUpButton.id = 'edlPressureUpBtn';
    pressureUpButton.className = 'edl-nav-btn';
    pressureUpButton.title = 'Higher Altitude (Lower Pressure)';
    pressureUpButton.innerHTML = '<span class="material-icons">keyboard_double_arrow_up</span>';
    pressureUpButton.addEventListener('click', () => {
        console.log('[Dock] Pressure up button clicked');
        import('./edlUI.js').then(module => {
            module.navigateToHigherAltitude();
        });
    });
    
    // Pressure display button
    const pressureButton = document.createElement('button');
    pressureButton.id = 'edlPressureBtn';
    pressureButton.className = 'edl-nav-btn';
    pressureButton.title = 'Current Pressure Level';
    
    // Pressure indicator span
    const pressureIndicator = document.createElement('span');
    pressureIndicator.id = 'edlPressureIndicator';
    pressureIndicator.textContent = '500hPa';
    
    pressureButton.appendChild(pressureIndicator);
    
    // Pressure Down button
    const pressureDownButton = document.createElement('button');
    pressureDownButton.id = 'edlPressureDownBtn';
    pressureDownButton.className = 'edl-nav-btn';
    pressureDownButton.title = 'Lower Altitude (Higher Pressure)';
    pressureDownButton.innerHTML = '<span class="material-icons">keyboard_double_arrow_down</span>';
    pressureDownButton.addEventListener('click', () => {
        console.log('[Dock] Pressure down button clicked');
        import('./edlUI.js').then(module => {
            module.navigateToLowerAltitude();
        });
    });
    
    // EDL Visibility Toggle button
    const visibilityButton = document.createElement('button');
    visibilityButton.id = 'edlVisibilityBtn';
    visibilityButton.className = 'edl-nav-btn';
    visibilityButton.title = 'Toggle EDL Layer Visibility';
    visibilityButton.innerHTML = '<span class="material-icons">visibility</span>';
    visibilityButton.addEventListener('click', () => {
        console.log('[Dock] EDL visibility button clicked');
        import('./edlUI.js').then(module => {
            module.toggleEDLLayerVisibility();
        });
    });
    
    // Add all buttons to row in a single line
    navRow.appendChild(prevButton);
    navRow.appendChild(nowButton);
    navRow.appendChild(nextButton);
    navRow.appendChild(pressureUpButton);
    navRow.appendChild(pressureButton);
    navRow.appendChild(pressureDownButton);
    navRow.appendChild(visibilityButton);
    
    // Create a container for the EDL navigation that's separate from the main dock
    const container = document.createElement('div');
    container.id = 'edlNavContainer';
    container.appendChild(navRow);
    
    // Add to the body, not the mapDock
    document.body.appendChild(container);
    
    // Add styles if needed
    addEDLNavigationStyles();
    
    console.log('[Dock] EDL navigation row created');
}

/**
 * Adds CSS styles for EDL navigation
 */
function addEDLNavigationStyles() {
    // Check if styles already exist
    if (document.getElementById('edl-nav-styles')) return;
    
    // Create style element
    const style = document.createElement('style');
    style.id = 'edl-nav-styles';
    
    // Add CSS
    style.textContent = `
        /* EDL Navigation Container - positioned near the dock */
        #edlNavContainer {
            position: fixed;
            z-index: 1100;
            pointer-events: none; /* Let clicks pass through to map unless on buttons */
        }
        
        /* EDL Navigation Row */
        .edl-nav-row {
            display: flex;
            pointer-events: auto; /* Make buttons clickable */
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(4px);
            border-radius: var(--border-radius-large);
            padding: calc(var(--dock-button-size) * 0.1);
            gap: calc(var(--dock-button-size) * 0.2);
        }
        
        /* EDL Navigation Buttons */
        .edl-nav-btn {
            background: var(--bg-light);
            border: none;
            outline: none;
            border-radius: var(--border-radius-large);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: var(--dock-button-size);
            height: var(--dock-button-size);
            aspect-ratio: 1 / 1;
        }
        
        .edl-nav-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        #edlTimeIndicator,
        #edlPressureIndicator {
            font-size: 0.8em;
            font-weight: bold;
        }
        
        /* Active state for the toggle button */
        #toggleEDLNavigationBtn.active {
            background-color: var(--accent-blue);
            color: white;
        }
        
        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
            .edl-nav-btn {
                background: var(--bg-dark);
                color: var(--text-dark);
            }
            
            .edl-nav-row {
                background: rgba(0, 0, 0, 0.2);
            }
        }
        
        /* Landscape mode */
        @media (orientation: landscape) {
            #edlNavContainer {
                left: calc(var(--dock-button-size) * 1.4);
                top: 50%;
                transform: translateY(-50%);
            }
            
            .edl-nav-row {
                flex-direction: column;
            }
        }
        
        /* Portrait mode */
        @media (orientation: portrait) {
            #edlNavContainer {
                top: calc(var(--dock-button-size) * 1.4);
                left: 50%;
                transform: translateX(-50%);
            }
            
            .edl-nav-row {
                flex-direction: row;
            }
        }
    `;
    
    // Add to document
    document.head.appendChild(style);
    console.log('[Dock] EDL navigation styles added');
}

/**
 * Sets up all dock event listeners
 */
export function setupDockEventListeners() {
    // Polygon opacity slider
    const polygonOpacitySlider = document.getElementById('polygonOpacitySlider');
    
    // Set initial value from state
    polygonOpacitySlider.value = getPolygonOpacity();
    
    // Create a debounced save function that waits 300ms after slider movement stops
    const debouncedSaveState = debounce(() => {
        saveStateToLocalStorage().catch(err => console.error('Error saving state:', err));
    }, 300);
    
    polygonOpacitySlider.addEventListener('input', function() {
        const opacity = parseFloat(this.value);
        // Update the layer immediately
        getLayerManager().setPaintProperty('polygons-layer', 'fill-opacity', opacity);
        // Store in state immediately
        setPolygonOpacity(opacity);
        // Debounce the save operation
        debouncedSaveState();
    });

    // Layer visibility toggle
    document.getElementById('toggleLayerButton').addEventListener('click', toggleLayerVisibility);

    // Sidebar toggle
    document.getElementById('toggleSidebarButton').addEventListener('click', () => {
        // Import toggleSidebar dynamically to avoid circular dependencies
        import('./sidebar.js').then(module => {
            module.toggleSidebar();
        });
    });

    // Create and add zoom buttons only for non-mobile devices
    createZoomButtonsIfNeeded();
    
    // Create EDL navigation toggle button
    createEDLNavigationToggleButton();
    
    // Ensure visibility icon matches the current state
    updateVisibilityIcon();
    
    // Initial size calculation
    updateDockElementSizes();
    
    // Add resize listener
    const debouncedResize = debounce(updateDockElementSizes, 150);
    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', updateDockElementSizes);
}

/**
 * Creates a button to toggle EDL navigation
 */
function createEDLNavigationToggleButton() {
    console.log('[Dock] Creating EDL navigation toggle button');

    // Check if EDL metadata exists before creating the button
    import('./cacheEdl.js').then(module => {
        if (!module.hasEDLTiles()) {
            console.log('[Dock] No EDL tiles available, not creating EDL navigation button');
            return;
        }

        // Create button
        const button = document.createElement('button');
        button.id = 'toggleEDLNavigationBtn';
        button.title = 'Toggle EDL Weather Navigation';
        
        // Use airwave icon with Material Icons
        button.innerHTML = '<span class="material-icons">waves</span>';
        
        // Add click event
        button.addEventListener('click', toggleEDLNavigation);
        
        // Add to dock, right before the "more options" button
        const mapDock = document.getElementById('mapDock');
        const moreOptionsBtn = document.getElementById('moreOptionsBtn');
        
        if (moreOptionsBtn) {
            mapDock.insertBefore(button, moreOptionsBtn);
        } else {
            mapDock.appendChild(button);
        }
        
        console.log('[Dock] EDL navigation toggle button created');
    });
}

/**
 * Creates and adds zoom buttons only for non-mobile devices
 */
function createZoomButtonsIfNeeded() {
    // Don't add zoom buttons on mobile devices (touch-enabled)
    if ('ontouchstart' in window) {
        return;
    }
    
    // Create zoom in button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.innerHTML = '<span class="material-icons">add</span>';
    zoomInBtn.addEventListener('click', () => {
        getMap().zoomIn();
    });
    
    // Create zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.innerHTML = '<span class="material-icons">remove</span>';
    zoomOutBtn.addEventListener('click', () => {
        getMap().zoomOut();
    });
    
    // Add buttons to mapDock, right before the more options button
    const mapDock = document.getElementById('mapDock');
    const moreOptionsBtn = document.getElementById('moreOptionsBtn');
    
    if (moreOptionsBtn) {
        mapDock.insertBefore(zoomInBtn, moreOptionsBtn);
        mapDock.insertBefore(zoomOutBtn, moreOptionsBtn);
    } else {
        mapDock.appendChild(zoomInBtn);
        mapDock.appendChild(zoomOutBtn);
    }
} 