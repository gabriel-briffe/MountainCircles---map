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

    // Show progress indicator
    const igcProgress = document.getElementById('igcProgress');
    const progressBar = document.getElementById('igcProgressBar');
    igcProgress.style.display = "flex";
    progressBar.style.width = "10%";
    
    try {
        // Read the file as text
        progressBar.style.width = "30%";
        const igcContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                progressBar.style.width = "50%";
                resolve(e.target.result);
            };
            reader.onerror = e => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
        
        progressBar.style.width = "60%";
        const geojsonData = igcToGeoJSON(igcContent);
        
        if (!geojsonData.features || geojsonData.features.length === 0) {
            throw new Error('No valid data found in IGC file');
        }
        
        progressBar.style.width = "70%";
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
        progressBar.style.width = "80%";
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
        
        progressBar.style.width = "90%";
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

        // Ensure proper layer order
        getLayerManager().redrawLayersInOrder();
        
        progressBar.style.width = "100%";
        
        // Hide the progress indicator after a brief delay to show completion
        setTimeout(() => {
            igcProgress.style.display = "none";
            progressBar.style.width = "0%";
            
            // Hide the menu after successful processing
            const modalMenu = document.getElementById('modalMenu');
            if (modalMenu) {
                modalMenu.style.display = "none";
            }
        }, 500);
        
        return { success: true, trackId: layerId };
    } catch (error) {
        console.error('Error processing IGC file:', error);
        
        // Show error in progress indicator
        progressBar.classList.add('progress-bar-error');
        const statusText = igcProgress.querySelector('.progress-status');
        statusText.textContent = `Error: ${error.message}`;
        
        // Hide the progress indicator after a delay
        setTimeout(() => {
            igcProgress.style.display = "none";
            progressBar.style.width = "0%";
            progressBar.classList.remove('progress-bar-error');
            statusText.textContent = "Processing IGC file...";
        }, 3000);
        
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
