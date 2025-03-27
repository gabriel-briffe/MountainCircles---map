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
    saveStateToLocalStorage,
    getAirspaceVisible,
    setAirspaceVisible,
    clearPopup
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

// Import Circles UI functions
import {
    initCirclesUI,
    toggleLayerVisibility,
    toggleCirclesNavigationRow,
} from "./circlesUI.js";

// Import from airspace and map modules
import { clearHighlight } from "./airspace.js";
import { clearMarker } from "./map.js";

// Flags to track navigation row visibility
let edlNavigationVisible = false;
let circlesNavigationVisible = false;

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
export function updateDockElementSizes() {
    // Get the map dock element
    const mapDock = document.getElementById('mapDock');
    if (!mapDock) return;

    // Count number of buttons in the dock
    const buttons = mapDock.querySelectorAll('button');
    // const buttonCount = buttons.length;
    const buttonCount = 6.5;
        
    // Determine effective count (slider counts as 3 buttons)
    const effectiveCount = buttonCount;
    
    // Determine available space based on orientation
    const isLandscape = window.innerWidth > window.innerHeight;
    const availableSpace = isLandscape ? 
        window.innerHeight - 40 : // 20px padding on each side in landscape
        window.innerWidth - 40;   // 20px padding on each side in portrait
    
    // Allow unlimited shrinking by setting minButtonSize to 0
    const minButtonSize = 0;
    const maxButtonSize = 48;
    const gapMultiplier = 0.2; // Gap is 20% of button size
    const buttonSizeFactor = effectiveCount + gapMultiplier * (effectiveCount - 1);
    let calculatedButtonSize = availableSpace / buttonSizeFactor;
    
    // Constrain to min/max
    const buttonSize = Math.min(Math.max(calculatedButtonSize, minButtonSize), maxButtonSize);
    
    // Slider is 3x a button
    const sliderLength = buttonSize * 3;
    
    // Update CSS variables
    document.documentElement.style.setProperty('--dock-button-size', `${buttonSize}px`);
    document.documentElement.style.setProperty('--sectors-slider-length', `${sliderLength}px`);
    
    // Log all sizes for debugging
    // logDockSizes(buttonCount, hasSlider, effectiveCount, availableSpace, buttonSize, sliderLength, !isLandscape); // Inverted for UI orientation
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
    
    // If circles navigation is currently visible, hide it
    if (circlesNavigationVisible) {
        circlesNavigationVisible = false;
        toggleCirclesNavigationRow(false);
        
        // Remove active class from circles button
        const circlesButton = document.getElementById('toggleCirclesNavigationBtn');
        if (circlesButton) {
            circlesButton.classList.remove('active');
        }
    }

    // Toggle the visibility state
    edlNavigationVisible = !edlNavigationVisible;
    
    // Update UI
    toggleEDLNavigationRow(edlNavigationVisible);
    
    // Update button visual
    const toggleButton = document.getElementById('toggleEDLNavigationBtn');
    if (toggleButton) {
        toggleButton.classList.remove('active');
        if (edlNavigationVisible) {
            toggleButton.classList.add('active');
        }
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
    navRow.className = 'secondary-dock-row'; // Removed redundant edl-nav-row class
    navRow.style.display = 'none'; // Initially hidden
    
    // Previous hour button
    const prevButton = document.createElement('button');
    prevButton.id = 'edlPrevHourBtn';
    prevButton.className = 'secondary-btn';
    prevButton.title = 'Previous Hour';
    prevButton.innerHTML = '<span class="material-icons">keyboard_double_arrow_left</span>';
    prevButton.addEventListener('click', () => {
        console.log('[Dock] Previous hour button clicked');
        navigateToPreviousHour();
    });
    
    // Current time button
    const nowButton = document.createElement('button');
    nowButton.id = 'edlNowBtn';
    nowButton.className = 'secondary-btn';
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
    nextButton.className = 'secondary-btn';
    nextButton.title = 'Next Hour';
    nextButton.innerHTML = '<span class="material-icons">keyboard_double_arrow_right</span>';
    nextButton.addEventListener('click', () => {
        console.log('[Dock] Next hour button clicked');
        navigateToNextHour();
    });
    
    // Pressure Up button
    const pressureUpButton = document.createElement('button');
    pressureUpButton.id = 'edlPressureUpBtn';
    pressureUpButton.className = 'secondary-btn';
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
    pressureButton.className = 'secondary-btn';
    pressureButton.title = 'Current Pressure Level';
    
    // Pressure indicator span
    const pressureIndicator = document.createElement('span');
    pressureIndicator.id = 'edlPressureIndicator';
    pressureIndicator.textContent = '500hPa';
    
    pressureButton.appendChild(pressureIndicator);
    
    // Pressure Down button
    const pressureDownButton = document.createElement('button');
    pressureDownButton.id = 'edlPressureDownBtn';
    pressureDownButton.className = 'secondary-btn';
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
    visibilityButton.className = 'secondary-btn';
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
    container.className = 'secondary-dock-container';
    container.appendChild(navRow);
    
    // Add to the body, not the mapDock
    document.body.appendChild(container);
    
    console.log('[Dock] EDL navigation row created');
}

/**
 * Toggles the Circles navigation row
 */
export function toggleCirclesNavigation() {
    console.log('[Dock] Toggling Circles navigation row');
    
    // Create Circles navigation row if it doesn't exist
    if (!document.getElementById('circlesNavRow')) {
        createCirclesNavigationRow();
    }
    
    // If EDL navigation is currently visible, hide it
    if (edlNavigationVisible) {
        edlNavigationVisible = false;
        toggleEDLNavigationRow(false);
        
        // Remove active class from EDL button
        const edlButton = document.getElementById('toggleEDLNavigationBtn');
        if (edlButton) {
            edlButton.classList.remove('active');
        }
    }
    
    // Toggle the visibility state
    circlesNavigationVisible = !circlesNavigationVisible;
    
    // Update UI
    toggleCirclesNavigationRow(circlesNavigationVisible);
    
    // Update button visual
    const toggleButton = document.getElementById('toggleCirclesNavigationBtn');
    if (toggleButton) {
        toggleButton.classList.remove('active');
        if (circlesNavigationVisible) {
            toggleButton.classList.add('active');
        }
    }
    
    // Initialize Circles UI if we're making the navigation visible
    if (circlesNavigationVisible) {
        initCirclesUI();
    }
}

/**
 * Creates the Circles navigation row in the dock
 */
function createCirclesNavigationRow() {
    console.log('[Dock] Creating Circles navigation row');
    
    // Create row container
    const navRow = document.createElement('div');
    navRow.id = 'circlesNavRow';
    navRow.className = 'secondary-dock-row'; // Removed redundant circles-nav-row class
    navRow.style.display = 'none'; // Initially hidden
    
    // Visibility Toggle button
    const visibilityButton = document.createElement('button');
    visibilityButton.id = 'circlesVisibilityBtn';
    visibilityButton.className = 'secondary-btn';
    visibilityButton.title = 'Toggle Circles Layer Visibility';
    
    // Visibility icon
    const visibilityIcon = document.createElement('span');
    visibilityIcon.id = 'circlesVisibilityIcon';
    visibilityIcon.className = 'material-icons';
    visibilityIcon.textContent = getLayersToggleState() ? 'visibility' : 'visibility_off';
    
    visibilityButton.appendChild(visibilityIcon);
    
    // Opacity slider wrapper
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'sectors-slider';
    sliderWrapper.id = 'circlesSliderWrapper';
    
    // Opacity slider
    const opacitySlider = document.createElement('input');
    opacitySlider.id = 'circlesOpacitySlider';
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '0.5';
    opacitySlider.step = '0.01';
    opacitySlider.value = getPolygonOpacity();
    
    sliderWrapper.appendChild(opacitySlider);
    
    // Add all elements to row
    navRow.appendChild(visibilityButton);
    navRow.appendChild(sliderWrapper);
    
    // Create a container for the Circles navigation that's separate from the main dock
    const container = document.createElement('div');
    container.id = 'circlesNavContainer';
    container.className = 'secondary-dock-container';
    container.appendChild(navRow);
    
    // Add to the body, not the mapDock
    document.body.appendChild(container);
    
    console.log('[Dock] Circles navigation row created');
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
        button.className = 'dock-toggle-btn';
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
        
        // Recalculate the dock element sizes to account for the new button
        updateDockElementSizes();
    });
}

/**
 * Creates a button to toggle Circles navigation
 */
function createCirclesNavigationToggleButton() {
    console.log('[Dock] Creating Circles navigation toggle button');

    // Create button
    const button = document.createElement('button');
    button.id = 'toggleCirclesNavigationBtn';
    button.className = 'dock-toggle-btn';
    button.title = 'Toggle Circles Controls';
    
    // Use target icon with Material Icons
    button.innerHTML = '<span class="material-icons">track_changes</span>';
    
    // Add click event
    button.addEventListener('click', toggleCirclesNavigation);
    
    // Add to dock, right after the EDL button
    const mapDock = document.getElementById('mapDock');
    const edlToggleButton = document.getElementById('toggleEDLNavigationBtn');
    
    if (edlToggleButton) {
        mapDock.insertBefore(button, edlToggleButton.nextSibling);
    } else {
        const moreOptionsBtn = document.getElementById('moreOptionsBtn');
        if (moreOptionsBtn) {
            mapDock.insertBefore(button, moreOptionsBtn);
        } else {
            mapDock.appendChild(button);
        }
    }
    
    console.log('[Dock] Circles navigation toggle button created');
    
    // Recalculate the dock element sizes to account for the new button
    updateDockElementSizes();
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
    zoomInBtn.innerHTML = '<span class="material-icons">zoom_in</span>';
    zoomInBtn.addEventListener('click', () => {
        getMap().zoomIn();
    });
    
    // Create zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.innerHTML = '<span class="material-icons">zoom_out</span>';
    zoomOutBtn.addEventListener('click', () => {
        getMap().zoomOut();
    });
    
    // Add buttons to mapDock, right before the more options button
    const mapDock = document.getElementById('mapDock');
    const moreOptionsBtn = document.getElementById('moreOptionsBtn');
    
    mapDock.appendChild(zoomInBtn);
    mapDock.appendChild(zoomOutBtn);
}

/**
 * Toggles visibility of all airspace layers
 * @param {boolean} isVisible - Whether the airspace should be visible
 */
export function toggleAirspaceVisibility(isVisible) {
    const map = getMap();
    
    // First update the state (this will now also update the icon)
    setAirspaceVisible(isVisible);
    
    // Then update the layer visibility
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
}

/**
 * Toggles the airspace layer visibility
 */
export function toggleAirspaceLayer() {
    // First get the current visibility state
    const currentState = getAirspaceVisible();
    
    // Calculate the new state (opposite of current)
    const newState = !currentState;
    
    // Use the toggleAirspaceVisibility function to handle the rest
    toggleAirspaceVisibility(newState);
}

/**
 * Sets up the North Up button click event with toggle functionality
 */
function setupNorthUpButton() {
    const button = document.getElementById('northUpButton');
    if (!button) return;
    
    // Variable to track if north is locked
    let northLocked = false;
    
    // Function to update button appearance based on state
    function updateButtonState() {
        if (northLocked) {
            button.classList.add('locked');
            button.title = 'Unlock Map Rotation';
        } else {
            button.classList.remove('locked');
            button.title = 'Lock North Up';
        }
    }
    
    // Set click event
    button.addEventListener('click', () => {
        const map = getMap();
        if (!map) return;
        
        if (!northLocked) {
            // Lock north up - rotate to north and disable rotation
            map.easeTo({ bearing: 0 });
            
            // Disable map rotation
            if (map.dragRotate.isEnabled()) {
                map.dragRotate.disable();
            }
            if (map.touchZoomRotate) {
                map.touchZoomRotate.disableRotation();
            }
            
            northLocked = true;
        } else {
            // Unlock - allow free rotation
            if (!map.dragRotate.isEnabled()) {
                map.dragRotate.enable();
            }
            if (map.touchZoomRotate) {
                map.touchZoomRotate.enableRotation();
            }
            
            northLocked = false;
        }
        
        updateButtonState();
        console.log(`[Dock] North lock ${northLocked ? 'enabled' : 'disabled'}`);
    });
    
    // Initial state
    updateButtonState();
    console.log('[Dock] North Up button event listener added');
}

/**
 * Sets up all dock event listeners
 */
export function setupDockEventListeners() {

    // Initialize parameters visibility based on current toggle state
    if (!getLayersToggleState()) {
        document.body.classList.add('parameters-hidden');
    }

    // Sidebar toggle
    document.getElementById('toggleSidebarButton').addEventListener('click', () => {
        // Import toggleSidebar dynamically to avoid circular dependencies
        import('./sidebar.js').then(module => {
            module.toggleSidebar();
        });
    });
    
    // Airspace visibility toggle
    const airspaceToggleBtn = document.getElementById('toggleAirspaceButton');
    if (airspaceToggleBtn) {
        airspaceToggleBtn.addEventListener('click', toggleAirspaceLayer);
        // The icon is now updated by setAirspaceVisible, no need to call update function
    }
    
    // Setup North Up button
    setupNorthUpButton();

    // Create and add zoom buttons only for non-mobile devices
    createZoomButtonsIfNeeded();
    
    // Create EDL navigation toggle button
    createEDLNavigationToggleButton();
    
    // Create Circles navigation toggle button
    createCirclesNavigationToggleButton();
    
    // No need to update visibility icons here - they're updated by state management
    
    // Initial size calculation
    updateDockElementSizes();
    
    // Add resize listener
    const debouncedResize = debounce(updateDockElementSizes, 150);
    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', updateDockElementSizes);
} 