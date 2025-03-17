/**
 * IGC module for MountainCircles Map
 * Contains functions for handling IGC files, parsing, and visualization
 */

// Import from utils
import { igcToGeoJSON } from "./utils.js";

// Import from state management
import {
    getMap,
    getLayerManager,
    getBaseTextSize
} from "./state.js";

// Import layer styles
import { IGC_STYLES } from "./layerStyles.js";

/**
 * Handles the selection of an IGC file
 * @param {Event} event - The file input change event
 * @returns {Promise<Object>} - Result of the file processing
 */
export async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return { success: false };

    // Hide the menu after file selection
    const popupMenu = document.getElementById('popupMenu');
    if (popupMenu) {
        popupMenu.style.display = "none";
    }
    
    try {
        // Read the file as text
        const igcContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
        
        const geojsonData = igcToGeoJSON(igcContent);
        console.log('Converted IGC to GeoJSON:', geojsonData);
        
        if (!geojsonData.features || geojsonData.features.length === 0) {
            throw new Error('No valid data found in IGC file');
        }
        
        const baseLayerId = 'igc-layer-' + file.name.replace(/\W/g, '');
        let layerId = baseLayerId;
        if (getLayerManager().hasLayer(layerId)) {
            layerId = baseLayerId + '-' + Date.now();
        }
        const sourceId = layerId + '-source';
        
        // Add the track line
        getLayerManager().addOrUpdateSource(sourceId, {
            type: 'geojson',
            data: geojsonData
        });
        
        // Create and add the track layer using the style creator
        const trackStyle = IGC_STYLES.createTrackStyle(sourceId, layerId);
        getLayerManager().addLayerIfNotExists(layerId, trackStyle);
        
        // Calculate bounds for the track
        const coords = geojsonData.features[0].geometry.coordinates;
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        coords.forEach(coord => {
            const [lng, lat] = coord;
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        });
        const bounds = [[minLng, minLat], [maxLng, maxLat]];
        
        // Fit the map to the track bounds
        getMap().fitBounds(bounds, {
            padding: 50,
            maxZoom: 14,
            duration: 1000
        });
        
        // Add altitude points
        const altPoints = {
            type: 'FeatureCollection',
            features: coords.map(coord => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [coord[0], coord[1]]
                },
                properties: {
                    altitude: coord[2]
                }
            }))
        };

        const altSourceId = layerId + '-altitudes-source';
        getLayerManager().addOrUpdateSource(altSourceId, {
            type: 'geojson',
            data: altPoints
        });

        // Create and add the labels layer using the style creator
        const labelsStyle = IGC_STYLES.createLabelsStyle(altSourceId, layerId + '-labels', getBaseTextSize());
        getLayerManager().addLayerIfNotExists(layerId + '-labels', labelsStyle);

        // Add altitude points layer using the style creator
        const altPointsStyle = IGC_STYLES.createAltitudePointsStyle(altSourceId, layerId + '-altitude-points');
        getLayerManager().addLayerIfNotExists(layerId + '-altitude-points', altPointsStyle);

        getLayerManager().moveLayerToTop('location-marker-circle');
        
        return { success: true, trackId: layerId };
    } catch (error) {
        console.error('Error processing IGC file:', error);
        alert(`Failed to process IGC file: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Sets up event listeners for IGC file handling
 */
export function setupIGCEventListeners() {
    document.getElementById('igcFileButton').addEventListener('click', function() {
        document.getElementById('igcFileInput').click();
        this.blur();
    });
    
    document.getElementById('igcFileInput').addEventListener('change', async (event) => {
        try {
            const result = await handleFileSelect(event);
            if (!result.success) {
                console.warn('File processing completed with errors');
            }
        } catch (error) {
            console.error('Error handling file selection:', error);
            alert('Failed to process file. See console for details.');
        }
    });
}
