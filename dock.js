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
 * Creates and adds zoom buttons only for non-mobile devices
 */
function createZoomButtonsIfNeeded() {
    // Import the isMobileDevice function dynamically to avoid circular dependencies
    import('./utils.js').then(module => {
        const isMobileDevice = module.isMobileDevice;
        
        // Only create zoom buttons if NOT on a mobile device
        if (!isMobileDevice()) {
            const mapDock = document.getElementById('mapDock');
            const moreOptionsBtn = document.getElementById('moreOptionsBtn');
            
            // Create zoom in button
            const zoomInBtn = document.createElement('button');
            zoomInBtn.id = 'zoomInBtn';
            zoomInBtn.title = 'Zoom In';
            zoomInBtn.innerHTML = '<span class="material-icons-round">zoom_in</span>';
            
            // Create zoom out button
            const zoomOutBtn = document.createElement('button');
            zoomOutBtn.id = 'zoomOutBtn';
            zoomOutBtn.title = 'Zoom Out';
            zoomOutBtn.innerHTML = '<span class="material-icons-round">zoom_out</span>';
            
            // Insert before the more options button
            mapDock.insertBefore(zoomInBtn, moreOptionsBtn);
            mapDock.insertBefore(zoomOutBtn, moreOptionsBtn);
            
            // Add event listeners
            zoomInBtn.addEventListener('click', () => {
                getMap().zoomIn();
            });
            
            zoomOutBtn.addEventListener('click', () => {
                getMap().zoomOut();
            });
            
            // Recalculate sizes after adding new buttons
            updateDockElementSizes();
        } 
    }).catch(err => {
        console.error('Error importing utils module:', err);
    });
} 