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
    clearPopup,
    clearAirportPopup
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
    const buttonCount = 6;
        
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
    const edlNavContainer = document.getElementById('edlNavContainer');
    if (edlNavContainer) {
        edlNavContainer.style.display = edlNavigationVisible ? 'flex' : 'none';
    }
    toggleEDLNavigationRow(edlNavigationVisible);
    
    // Update button visual
    const toggleButton = document.getElementById('toggleEDLNavigationBtn');
    if (toggleButton) {
        // Set class explicitly based on state instead of removing first
        if (edlNavigationVisible) {
            toggleButton.classList.add('active');
        } else {
            toggleButton.classList.remove('active');
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
 * Toggles the Circles navigation row
 */
export function toggleCirclesNavigation() {
    console.log('[Dock] Toggling Circles navigation row');
    
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
    const circlesNavContainer = document.getElementById('circlesNavContainer');
    if (circlesNavContainer) {
        circlesNavContainer.style.display = circlesNavigationVisible ? 'flex' : 'none';
    }
    toggleCirclesNavigationRow(circlesNavigationVisible);
    
    // Update button visual
    const toggleButton = document.getElementById('toggleCirclesNavigationBtn');
    if (toggleButton) {
        // Set class explicitly based on state instead of removing first
        if (circlesNavigationVisible) {
            toggleButton.classList.add('active');
        } else {
            toggleButton.classList.remove('active');
        }
    }
    
    // Initialize Circles UI if we're making the navigation visible
    if (circlesNavigationVisible) {
        initCirclesUI();
    }
}

/**
 * Creates a button to toggle EDL navigation
 */
function createEDLNavigationToggleButton() {
    console.log('[Dock] Creating EDL navigation toggle button');

    // Check if EDL metadata exists before showing the button
    import('./cacheEdl.js').then(module => {
        if (!module.hasEDLTiles()) {
            console.log('[Dock] No EDL tiles available, not showing EDL navigation button');
            return;
        }

        // Find the button and make it visible
        const button = document.getElementById('toggleEDLNavigationBtn');
        if (button) {
            button.style.display = '';
            console.log('[Dock] EDL navigation toggle button shown');
        }
    });
}

/**
 * Creates and adds zoom buttons only for non-mobile devices
 */
function createZoomButtonsIfNeeded() {
    // Don't show zoom buttons on mobile devices (touch-enabled)
    if ('ontouchstart' in window) {
        return;
    }
    
    // Find and show the existing zoom buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    
    if (zoomInBtn) {
        zoomInBtn.style.display = '';
        zoomInBtn.addEventListener('click', () => {
            getMap().zoomIn();
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.style.display = '';
        zoomOutBtn.addEventListener('click', () => {
            getMap().zoomOut();
        });
    }
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
        clearAirportPopup();
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
    
    // Set up EDL navigation button event listener
    const edlToggleBtn = document.getElementById('toggleEDLNavigationBtn');
    if (edlToggleBtn) {
        edlToggleBtn.addEventListener('click', toggleEDLNavigation);
    }
    
    // Create EDL navigation toggle button (make it visible if EDL tiles are available)
    createEDLNavigationToggleButton();
    
    // Set up EDL navigation row buttons
    setupEDLNavigationRowEvents();
    
    // Set up Circles navigation button event listener
    const circlesToggleBtn = document.getElementById('toggleCirclesNavigationBtn');
    if (circlesToggleBtn) {
        circlesToggleBtn.addEventListener('click', toggleCirclesNavigation);
    }
    
    // Set up Circles navigation row buttons
    setupCirclesNavigationRowEvents();
    
    // No need to update visibility icons here - they're updated by state management
    
    // Initial size calculation
    updateDockElementSizes();
    
    // Add resize listener
    const debouncedResize = debounce(updateDockElementSizes, 150);
    window.addEventListener('resize', debouncedResize);
}

/**
 * Sets up event listeners for all EDL navigation row buttons
 */
function setupEDLNavigationRowEvents() {
    // Previous hour button
    const prevButton = document.getElementById('edlPrevHourBtn');
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            console.log('[Dock] Previous hour button clicked');
            navigateToPreviousHour();
        });
    }
    
    // Current time (Now) button
    const nowButton = document.getElementById('edlNowBtn');
    if (nowButton) {
        nowButton.addEventListener('click', () => {
            console.log('[Dock] Now button clicked');
            navigateToCurrentTime();
        });
    }
    
    // Next hour button
    const nextButton = document.getElementById('edlNextHourBtn');
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            console.log('[Dock] Next hour button clicked');
            navigateToNextHour();
        });
    }
    
    // Pressure Up button
    const pressureUpButton = document.getElementById('edlPressureUpBtn');
    if (pressureUpButton) {
        pressureUpButton.addEventListener('click', () => {
            console.log('[Dock] Pressure up button clicked');
            import('./edlUI.js').then(module => {
                module.navigateToHigherAltitude();
            });
        });
    }
    
    // Pressure Down button
    const pressureDownButton = document.getElementById('edlPressureDownBtn');
    if (pressureDownButton) {
        pressureDownButton.addEventListener('click', () => {
            console.log('[Dock] Pressure down button clicked');
            import('./edlUI.js').then(module => {
                module.navigateToLowerAltitude();
            });
        });
    }
    
    // EDL Visibility Toggle button
    const visibilityButton = document.getElementById('edlVisibilityBtn');
    if (visibilityButton) {
        visibilityButton.addEventListener('click', () => {
            console.log('[Dock] EDL visibility button clicked');
            import('./edlUI.js').then(module => {
                module.toggleEDLLayerVisibility();
            });
        });
    }
}

/**
 * Sets up event listeners for all Circles navigation row buttons
 */
function setupCirclesNavigationRowEvents() {
    // Visibility Toggle button
    const visibilityButton = document.getElementById('circlesVisibilityBtn');
    if (visibilityButton) {
        visibilityButton.addEventListener('click', toggleLayerVisibility);
    }
    
    // Opacity slider
    const opacitySlider = document.getElementById('circlesOpacitySlider');
    if (opacitySlider) {
        // Set initial value from state
        opacitySlider.value = getPolygonOpacity();
        
        // Add input event for live updating
        opacitySlider.addEventListener('input', () => {
            const opacity = parseFloat(opacitySlider.value);
            setPolygonOpacity(opacity);
            saveStateToLocalStorage();
        });
    }
} 