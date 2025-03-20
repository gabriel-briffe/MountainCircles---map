/**
 * LayerManager class for MountainCircles Map
 * Handles layer operations and abstracts map layer management
 */

export class LayerManager {
    constructor(map) {
        this.map = map;
    }

    // Check if a layer exists
    hasLayer(layerId) {
        return !!this.map.getLayer(layerId);
    }

    // Check if a source exists
    hasSource(sourceId) {
        return !!this.map.getSource(sourceId);
    }

    // Check if any layer with the given prefix is visible
    hasVisibleLayerStartingWith(prefix) {
        const style = this.map.getStyle();
        if (!style || !style.layers) return false;
        
        for (const layer of style.layers) {
            if (layer.id.startsWith(prefix) && 
                this.getVisibility(layer.id) === 'visible') {
                return true;
            }
        }
        return false;
    }

    // Set layer visibility
    setVisibility(layerId, visible) {
        if (this.hasLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            
            // If making a layer visible, ensure proper z-order
            // But skip redrawing for airspace layers since they're always on top
            if (visible && !layerId.includes('airspace')) {
                this.redrawLayersInOrder();
            }
            
            return true;
        }
        return false;
    }

    // Get layer visibility
    getVisibility(layerId) {
        if (this.hasLayer(layerId)) {
            return this.map.getLayoutProperty(layerId, 'visibility') || 'visible';
        }
        return null;
    }

    // Add a source if it doesn't exist, or update it if it does
    addOrUpdateSource(sourceId, options) {
        if (!this.hasSource(sourceId)) {
            this.map.addSource(sourceId, options);
        } else {
            this.map.getSource(sourceId).setData(options.data);
        }
    }

    // Add a layer if it doesn't exist
    addLayerIfNotExists(layerId, layerOptions) {
        if (!this.hasLayer(layerId)) {
            this.map.addLayer(layerOptions);
            
            // After adding a layer, ensure proper z-order
            this.redrawLayersInOrder();
            
            return true;
        }
        return false;
    }

    // Remove a layer if it exists
    removeLayerIfExists(layerId) {
        if (this.hasLayer(layerId)) {
            this.map.removeLayer(layerId);
            return true;
        }
        return false;
    }

    // Remove a source if it exists
    removeSourceIfExists(sourceId) {
        if (this.hasSource(sourceId)) {
            this.map.removeSource(sourceId);
            return true;
        }
        return false;
    }

    // Move a layer to the top of the rendering order
    moveLayerToTop(layerId) {
        if (this.hasLayer(layerId)) {
            this.map.moveLayer(layerId);
            return true;
        }
        return false;
    }

    // Remove layers by prefix
    removeLayersByPrefix(prefix) {
        const currentLayers = this.map.getStyle().layers.slice();
        currentLayers.forEach(layer => {
            if (layer.id.startsWith(prefix)) {
                this.removeLayerIfExists(layer.id);
            }
        });
    }

    // Remove sources by prefix
    removeSourcesByPrefix(prefix) {
        const sourceIds = Object.keys(this.map.style.sourceCaches);
        sourceIds.forEach(sourceId => {
            if (sourceId.startsWith(prefix)) {
                this.removeSourceIfExists(sourceId);
            }
        });
    }

    // Update text size for all symbol layers
    updateAllLabelSizes(baseTextSize) {
        this.map.getStyle().layers.forEach(layer => {
            if (layer.type === 'symbol' && layer.layout && layer.layout["text-size"] !== undefined) {
                if (layer.id === 'points-labels') {
                    this.map.setLayoutProperty(layer.id, 'text-size', baseTextSize + 5);
                } else {
                    this.map.setLayoutProperty(layer.id, 'text-size', baseTextSize);
                }
            }
        });
    }
    
    // Set a paint property for a layer
    setPaintProperty(layerId, property, value) {
        if (this.hasLayer(layerId)) {
            this.map.setPaintProperty(layerId, property, value);
            return true;
        }
        return false;
    }
    
    // Set a filter for a layer
    setFilter(layerId, filter) {
        if (this.hasLayer(layerId)) {
            this.map.setFilter(layerId, filter);
            return true;
        }
        return false;
    }
    
    /**
     * Redraws all layers in the proper z-order to ensure consistent stacking
     * This should be called whenever a new layer is added or when layer visibility changes
     */
    redrawLayersInOrder() {
        // Define the layer order from bottom to top
        // The last items in this array will be drawn on top
        const layerOrder = [
            // Base map layers - always at the bottom
            'custom-tiles',
            
            // Polygon layers
            'polygons-layer',
            
            // Line layers
            'linestrings-layer',
            'linestrings-labels',
            
            // Dynamic layers - these could be further refined if needed
            // We need to identify them by prefix
            // ... any layer that starts with 'dynamic-'
            
            // Points layers
            'points-layer',
            'points-layer-clickable',
            
            // Dynamic layers will be inserted here programmatically
            
            // IGC track layers will be inserted here programmatically
            
            // Peaks and passes - above most layers but below airspace
            'passes-symbols',
            'peaks-symbols',
            
            // Airspace layers - always at the top
            'airspace-fill',
            'airspace-outline',
            'highlight-airspace',
            'points-labels',
            
            // Location marker - always at the very top
            'location-marker-triangle'
        ];
        
        // Get all current layers in the map
        const currentLayers = this.map.getStyle().layers.slice().map(layer => layer.id);
        
        // Process dynamic layers (they're not in our predefined order)
        const dynamicLayers = currentLayers.filter(id => id.startsWith('dynamic-'));
        
        // Process IGC track layers (they're also not in our predefined order)
        const igcLayers = currentLayers.filter(id => id.startsWith('igc-layer-'));
        
        // Add dynamic layers before the peaks and passes in our order
        const peaksIndex = layerOrder.indexOf('passes-symbols');
        if (peaksIndex > -1) {
            // Add IGC layers after dynamic layers but before peaks/passes
            layerOrder.splice(peaksIndex, 0, ...igcLayers);
            // Add dynamic layers before IGC layers
            layerOrder.splice(peaksIndex, 0, ...dynamicLayers);
        }
        
        // Start from the top of the order and move each layer to the top
        // This effectively reverses the drawing process, ensuring the last layers
        // in our array end up on top
        for (let i = 0; i < layerOrder.length; i++) {
            const layerId = layerOrder[i];
            
            // Handle exact layer IDs
            if (currentLayers.includes(layerId)) {
                this.moveLayerToTop(layerId);
            }
        }
    }
} 