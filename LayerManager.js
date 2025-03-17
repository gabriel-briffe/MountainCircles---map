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

    // Set layer visibility
    setVisibility(layerId, visible) {
        if (this.hasLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
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
} 