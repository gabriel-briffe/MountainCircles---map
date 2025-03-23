/**
 * Tracklog functionality for MountainCircles Map
 * Records user path with 1-second interval and displays it color-coded by vertical speed
 */

import { 
  getMap, 
  getLayerManager, 
  getTracklog,
  setTracklog, 
  getLastTracklogDate, 
  setLastTracklogDate,
  getLastRecordedTime,
  setLastRecordedTime,
  getTracklogEnabled
} from './state.js';

// Track start time
let trackingStartTime = null;

// Simulation variables
let simulationActive = false;
let simulationInterval = null;
let simulationStartCoords = [5.9167, 45.5667]; // Chambery, France
let simulationAltitude = 300; // Starting altitude in meters
let simulationSpeed = 100; // km/h
let simulationHeading = 90; // degrees (east)
let simulationLastTime = null;

// Initialize tracking module
export function initializeTracking() {
  console.log('Initializing tracklog system...');
  
  // Setup state on first load
  setupTracklogState();
  
  // Create tracklog layer - but don't start logging yet
  createTracklogLayer();
  
  // Log simulation instructions to console (developer mode)
  logSimulationInstructions();
  
  // Only start tracking if enabled in settings
  if (getTracklogEnabled() && !simulationActive) {
    console.log('Tracklog enabled, starting recording...');
    startTracking();
  } else {
    console.log('Tracklog disabled, recording will not start automatically');
  }
  
  // Set tracking start time
  trackingStartTime = Date.now();
}

// Log instructions for using simulation commands from console
function logSimulationInstructions() {
  console.log('%c===== TRACKLOG SIMULATION COMMANDS =====', 'font-weight: bold; color: #6200ee; font-size: 14px');
  console.log('%cRun these commands in console to control the tracklog simulation:', 'color: #0277bd');
  console.log('%c• startSimulation() %c- Start simulation from Chambery, heading east at 100km/h', 'color: #2e7d32; font-weight: bold', 'color: #333');
  console.log('%c• stopSimulation() %c- Stop the active simulation', 'color: #c62828; font-weight: bold', 'color: #333');
  console.log('%c========================================', 'font-weight: bold; color: #6200ee; font-size: 14px');
  
  // Make simulation functions available globally for console access
  window.startSimulation = startSimulation;
  window.stopSimulation = stopSimulation;
}

// Create the tracklog layer on the map
export function createTracklogLayer() {
  console.log('Creating tracklog layer...');
  const layerManager = getLayerManager();
  const map = getMap();
  
  try {
    // Remove any existing layer/source with the same name
    if (map.getLayer('tracklog-full-line')) {
      console.log('Removing existing tracklog layer');
      map.removeLayer('tracklog-full-line');
    }
    
    if (map.getSource('tracklog-full-source')) {
      console.log('Removing existing tracklog source');
      map.removeSource('tracklog-full-source');
    }
    
    console.log('Creating consolidated tracklog layer');
    
    // Create the consolidated line feature that connects all points with color segments
    createSingleLineFeature();
    
    // Set initial visibility based on tracklog enabled state
    const isTracklogEnabled = getTracklogEnabled();
    if (map.getLayer('tracklog-full-line')) {
      map.setLayoutProperty('tracklog-full-line', 'visibility', isTracklogEnabled ? 'visible' : 'none');
      console.log(`Setting initial tracklog visibility to ${isTracklogEnabled ? 'visible' : 'hidden'}`);
    }
  } catch (error) {
    console.error('Error creating tracklog layer:', error);
  }
}

// Create a single line feature that connects all points in one stroke
function createSingleLineFeature() {
  const map = getMap();
  const tracklog = getTracklog();
  
  if (!map) return;
  
  console.log('Creating tracklog layer with', tracklog.length, 'points');
  
  try {
    // Remove existing layer/source if they exist
    if (map.getLayer('tracklog-full-line')) {
      map.removeLayer('tracklog-full-line');
    }
    
    if (map.getSource('tracklog-full-source')) {
      map.removeSource('tracklog-full-source');
    }
    
    // Calculate vertical speeds for each point
    const features = [];
    
    // Only process segments if we have at least 2 points
    if (tracklog.length >= 2) {
      for (let i = 1; i < tracklog.length; i++) {
        const startPoint = tracklog[i-1];
        const endPoint = tracklog[i];
        
        // Skip invalid coordinates
        if (!startPoint.coordinates || !endPoint.coordinates) {
          continue;
        }
        
        // Calculate vertical speed in m/s
        const timeDiff = (endPoint.timestamp - startPoint.timestamp) / 1000; // seconds
        if (timeDiff < 0.1) continue; // Skip invalid time differences
        
        const altDiff = (endPoint.altitude || 0) - (startPoint.altitude || 0); // meters
        const verticalSpeed = altDiff / timeDiff; // m/s
        
        // Create a feature for this segment with vertical speed property
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [startPoint.coordinates, endPoint.coordinates]
          },
          properties: {
            verticalSpeed: verticalSpeed
          }
        });
      }
    }
    
    // Create a source with the features (even if empty)
    map.addSource('tracklog-full-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features
      }
    });
    
    // Initial visibility based on tracklog enabled state
    const isTracklogEnabled = getTracklogEnabled();
    
    // Add a layer with vertical speed gradient
    // Place it as the topmost layer
    map.addLayer({
      id: 'tracklog-full-line',
      type: 'line',
      source: 'tracklog-full-source',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        'visibility': isTracklogEnabled ? 'visible' : 'none'
      },
      paint: {
        'line-width': 8,
        'line-opacity': 1.0,
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'verticalSpeed'],
          ...generateVerticalSpeedGradient()
        ]
      }
    });
    
    // Ensure our layer is at the top of the layer stack
    moveTracklogToTop();
    
    console.log('Tracklog layer created with', features.length, 'segments');
  } catch (error) {
    console.error('Error creating tracklog layer:', error);
  }
}

// Position the tracklog layer just below the location marker layer
function moveTracklogToTop() {
  const map = getMap();
  if (!map || !map.getLayer('tracklog-full-line')) return;
  
  try {
    // Check if the location marker layer exists
    if (map.getLayer('location-marker-triangle')) {
      console.log('Moving tracklog layer below location marker');
      
      // Move tracklog layer below the location marker
      map.moveLayer('tracklog-full-line', 'location-marker-triangle');
    } else {
      // If location marker doesn't exist, move tracklog to top
      console.log('Location marker not found, moving tracklog to top');
      map.moveLayer('tracklog-full-line');
    }
  } catch (error) {
    console.error('Error positioning tracklog layer:', error);
  }
}

// Start the tracking process
export function startTracking() {
  console.log('Starting tracklog recording...');
  
  // Start tracking with high accuracy
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      handlePositionUpdate, 
      (error) => console.error('Geolocation error:', error),
      { 
        enableHighAccuracy: true, 
        maximumAge: 0,
        timeout: 30000 
      }
    );
    
    console.log('Geolocation watch initiated');
  } else {
    console.error('Geolocation is not supported by this browser.');
  }
}

// Handle new position data
function handlePositionUpdate(position) {
  // Only process if tracklog is enabled
  if (!getTracklogEnabled() && !simulationActive) {
    return;
  }
  
  // Check if we need to reset tracklog (new day)
  checkAndResetDaily();
  
  // Record track point (throttled to 1s)
  // Only update display if a new point was actually recorded
  recordTrackPoint(position);
  
  // We no longer call updateTracklogDisplay() here - it's called directly in recordTrackPoint() when needed
}

// Setup state on first load
function setupTracklogState() {
  // Check if we need to reset for a new day
  checkAndResetDaily();
  
  // Initialize empty tracklog if none exists
  if (!getTracklog()) {
    setTracklog([]);
  }
}

// Check and reset tracklog for a new day
function checkAndResetDaily() {
  const today = new Date().toDateString();
  const lastDate = getLastTracklogDate();
  
  if (lastDate && today !== lastDate) {
    console.log('New day detected, resetting tracklog');
    setTracklog([]);
  }
  
  setLastTracklogDate(today);
}

// Process and record each track point
function recordTrackPoint(position) {
  // Check if tracklog is enabled - if not, don't record points
  if (!getTracklogEnabled() && !simulationActive) {
    return false;
  }

  const now = Date.now();
  // Enforce 1 second interval between records
  if (!getLastRecordedTime() || now - getLastRecordedTime() >= 1000) {
    // Make sure we have valid coordinates
    if (!position.coords || typeof position.coords.longitude !== 'number' || typeof position.coords.latitude !== 'number') {
      console.warn('Invalid position received:', position);
      return false;
    }
    
    // Create the point with coordinates
    const lng = position.coords.longitude;
    const lat = position.coords.latitude;
    
    // Safety check for out-of-bounds coordinates
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      console.warn('Invalid coordinates received:', lng, lat);
      return false;
    }
    
    const tracklog = getTracklog();
    const previousPoint = tracklog.length > 0 ? tracklog[tracklog.length - 1] : null;
    
    // Create the new point
    const point = {
      coordinates: [lng, lat],
      altitude: position.coords.altitude || 0,
      timestamp: now
    };
    
    // Pre-calculate vertical speed if we have a previous point
    if (previousPoint) {
      const timeDiff = (now - previousPoint.timestamp) / 1000; // seconds
      if (timeDiff >= 0.1) {
        const altDiff = (point.altitude || 0) - (previousPoint.altitude || 0); // meters
        const verticalSpeed = altDiff / timeDiff; // m/s
        point.verticalSpeed = verticalSpeed;
      }
    }
    
    // Log the point for debugging
    console.log(`Recording point: [${point.coordinates[0].toFixed(5)}, ${point.coordinates[1].toFixed(5)}], alt: ${point.altitude}`);
    
    // Add to tracklog
    const newTracklog = [...tracklog, point];
    setTracklog(newTracklog);
    setLastRecordedTime(now);
    
    // Update the display incrementally with just the new segment
    updateTracklogDisplayIncremental(previousPoint, point);
    
    return true; // Return true if we recorded a point
  }
  return false; // Return false if we did not record a point (throttled)
}

// Incrementally update the tracklog display with just the new segment
function updateTracklogDisplayIncremental(previousPoint, newPoint) {
  if (!previousPoint || !newPoint) {
    // If no previous point, do a full update
    updateTracklogDisplay();
    return;
  }
  
  const map = getMap();
  if (!map) {
    console.error('Map not available');
    return;
  }
  
  // Create a single new segment feature
  const segmentFeature = createSegmentFeature(previousPoint, newPoint);
  if (!segmentFeature) {
    console.warn('Could not create valid segment feature');
    return;
  }
  
  try {
    // Update the consolidated tracklog layer
    const fullSource = map.getSource('tracklog-full-source');
    if (fullSource) {
      // Get current features and append the new segment
      const currentData = fullSource.serialize().data;
      let features = [];
      
      if (currentData && currentData.features) {
        features = [...currentData.features];
      }
      
      features.push(segmentFeature);
      
      // Update source with the appended data
      fullSource.setData({
        type: 'FeatureCollection',
        features: features
      });
      
      console.log('Tracklog updated with new segment');
      
      // Ensure tracklog remains on top
      moveTracklogToTop();
    } else {
      // If full source doesn't exist yet, create it
      createSingleLineFeature();
    }
  } catch (error) {
    console.error('Error incrementally updating tracklog:', error);
    // Fall back to full update on error
    updateTracklogDisplay();
  }
}

// Create a segment feature from two points
function createSegmentFeature(startPoint, endPoint) {
  // Skip invalid coordinates
  if (!startPoint.coordinates || !endPoint.coordinates) {
    console.warn('Invalid coordinates in segment');
    return null;
  }
  
  // Skip zero-length segments
  const isSamePoint = 
    startPoint.coordinates[0] === endPoint.coordinates[0] && 
    startPoint.coordinates[1] === endPoint.coordinates[1];
  
  if (isSamePoint) {
    console.warn('Same start and end point in segment');
    return null;
  }
  
  // Use pre-calculated vertical speed if available, otherwise calculate it
  let verticalSpeed;
  if (typeof endPoint.verticalSpeed !== 'undefined') {
    verticalSpeed = endPoint.verticalSpeed;
  } else {
    // Calculate vertical speed in m/s
    const timeDiff = (endPoint.timestamp - startPoint.timestamp) / 1000; // seconds
    if (timeDiff < 0.1) {
      console.warn('Time difference too small for segment');
      return null;
    }
    
    const altDiff = (endPoint.altitude || 0) - (startPoint.altitude || 0); // meters
    verticalSpeed = altDiff / timeDiff; // m/s
  }
  
  // Create a line segment with vertical speed property
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [startPoint.coordinates, endPoint.coordinates]
    },
    properties: {
      verticalSpeed: verticalSpeed
    }
  };
}

// Update the map with current tracklog data
function updateTracklogDisplay() {
  const tracklog = getTracklog();
  if (tracklog.length < 2) {
    return;
  }
  
  console.log(`Full update: Updating tracklog display with ${tracklog.length} points`);
  
  // Create individual line segments
  const features = [];
  
  for (let i = 1; i < tracklog.length; i++) {
    const startPoint = tracklog[i-1];
    const endPoint = tracklog[i];
    
    const segmentFeature = createSegmentFeature(startPoint, endPoint);
    if (segmentFeature) {
      features.push(segmentFeature);
    }
  }
  
  if (features.length === 0) {
    console.warn('No valid features to display');
    return;
  }
  
  // Get the map directly
  const map = getMap();
  
  if (!map) {
    console.error('Map not available');
    return;
  }
  
  console.log(`Updating tracklog with ${features.length} line segments`);
  
  try {
    // Update the consolidated tracklog layer
    const fullSource = map.getSource('tracklog-full-source');
    if (fullSource) {
      fullSource.setData({
        type: 'FeatureCollection',
        features: features
      });
      console.log('Tracklog updated with', features.length, 'segments');
      
      // Ensure tracklog remains on top
      moveTracklogToTop();
    } else {
      // Create the full line if it doesn't exist yet
      createSingleLineFeature();
    }
  } catch (error) {
    console.error('Error updating tracklog data:', error);
  }
}

// Start simulation
function startSimulation() {
  if (simulationActive) return;
  
  console.log('Starting tracklog simulation from Chambery');
  simulationActive = true;
  simulationLastTime = Date.now();
  
  // Reset tracklog for clean testing
  setTracklog([]);
  trackingStartTime = Date.now();
  
  // Make sure the tracklog layer exists and is on top
  createTracklogLayer();
  moveTracklogToTop();
  
  // Fly the map to the starting location
  const map = getMap();
  map.flyTo({
    center: simulationStartCoords,
    zoom: 12,
    speed: 2
  });
  
  // Track the last simulation time to ensure exactly 1-second intervals
  let nextUpdateTime = Date.now() + 1000;
  
  // Simulate position updates every second
  simulationInterval = setInterval(() => {
    // Calculate time since last update (should be ~1000ms but can vary)
    const now = Date.now();
    
    // Skip this update if it's too soon
    if (now < nextUpdateTime) {
      return;
    }
    
    const timeDeltaMs = now - (simulationLastTime || now);
    simulationLastTime = now;
    nextUpdateTime = now + 1000; // Schedule next update exactly 1 second from now
    
    // Get current position from state or use start coords if none
    const tracklog = getTracklog();
    let currentPosition;
    
    if (tracklog.length > 0) {
      const lastPoint = tracklog[tracklog.length - 1];
      currentPosition = lastPoint.coordinates;
    } else {
      currentPosition = simulationStartCoords;
    }
    
    // Calculate new position based on speed and heading
    // 100 km/h = 27.78 m/s, so we move that distance in the heading direction
    const metersPerSecond = simulationSpeed * 1000 / 3600;
    const distanceMoved = metersPerSecond * (timeDeltaMs / 1000);
    
    // Convert distance to degrees (approximate, works for small distances)
    // 1 degree of longitude at equator is ~111km, adjust for latitude
    const latFactor = Math.cos(currentPosition[1] * Math.PI / 180);
    const lngChange = (distanceMoved / (111320 * latFactor)) * Math.sin(simulationHeading * Math.PI / 180);
    const latChange = (distanceMoved / 111320) * Math.cos(simulationHeading * Math.PI / 180);
    
    // Calculate new position
    const newLng = currentPosition[0] + lngChange;
    const newLat = currentPosition[1] + latChange;
    
    // Generate random altitude change between -10 and +10 meters
    const altitudeChange = (Math.random() * 20) - 10;
    simulationAltitude += altitudeChange;
    
    // Create simulated position object
    const simulatedPosition = {
      coords: {
        longitude: newLng,
        latitude: newLat,
        altitude: simulationAltitude,
        accuracy: 10,
        altitudeAccuracy: 5,
        heading: simulationHeading,
        speed: metersPerSecond
      },
      timestamp: now
    };
    
    // Process the simulated position
    handlePositionUpdate(simulatedPosition);
    
    // Move the map to follow the simulation
    map.panTo([newLng, newLat], { animate: true, duration: 1000 });
    
  }, 100); // Run more frequently but only update at 1-second intervals
}

// Stop simulation
export function stopSimulation() {
  if (!simulationActive) return;
  
  console.log('Stopping tracklog simulation');
  clearInterval(simulationInterval);
  simulationInterval = null;
  simulationActive = false;
}

// Generate a smooth color gradient for vertical speed
function generateVerticalSpeedGradient() {
  const result = [];
  
  // Helper to convert HSL to RGB hex
  function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  
  // Create a pre-sorted array of [speed, color] pairs
  const colorPairs = [];
  
  // Negative vertical speed (descent): 100 steps from -10 to 0 m/s
  for (let i = 0; i <= 100; i++) {
    const speed = -10 + i * 0.1; // -10 to 0 m/s
    
    // Map speed to hue (240 = blue to 180 = cyan)
    let hue, saturation, lightness;
    
    if (speed < -0.1) {
      // Descent (blue range)
      const normalizedSpeed = (speed + 10) / 10; // 0 to 1
      hue = 240 - normalizedSpeed * 60;
      saturation = 100;
      lightness = 50;
    } else if (speed >= -0.1 && speed <= 0.1) {
      // Close to level (white)
      hue = 0;
      saturation = 0;
      lightness = 100;
    } else {
      // Ascent (yellow to red)
      const normalizedSpeed = speed / 10; // 0 to 1
      hue = 60 - normalizedSpeed * 60;
      saturation = 100;
      lightness = 50;
    }
    
    const color = hslToHex(hue, saturation, lightness);
    colorPairs.push([speed, color]);
  }
  
  // Positive vertical speed (ascent): 100 steps from 0 to 10 m/s
  // Skip the first step (0 m/s) as it's already added in the negative range
  for (let i = 1; i <= 100; i++) {
    const speed = i * 0.1; // 0.1 to 10 m/s
    
    // Map speed to hue (60 = yellow to 0 = red)
    const normalizedSpeed = speed / 10; // 0 to 1
    const hue = 60 - normalizedSpeed * 60;
    const saturation = 100;
    const lightness = 50;
    
    const color = hslToHex(hue, saturation, lightness);
    colorPairs.push([speed, color]);
  }
  
  // Sort the pairs by speed (ascending order)
  colorPairs.sort((a, b) => a[0] - b[0]);
  
  // Remove any duplicate speed values that might cause issues
  const uniquePairs = [];
  let lastSpeed = -Infinity;
  
  for (const pair of colorPairs) {
    if (pair[0] > lastSpeed) {
      uniquePairs.push(pair);
      lastSpeed = pair[0];
    }
  }
  
  // Flatten the array for the interpolate expression
  for (const pair of uniquePairs) {
    result.push(pair[0]);  // speed
    result.push(pair[1]);  // color
  }
  
  return result;
}

// Get the tracklog line style with color gradient
function getTracklogLineStyle() {
  return {
    id: 'tracklog-line',
    type: 'line',
    source: 'tracklog-source',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
      'visibility': 'visible'
    },
    paint: {
      'line-width': 6,         // Increase width
      'line-opacity': 1.0,     // Full opacity
      'line-color': [
        'interpolate',
        ['linear'],
        ['get', 'verticalSpeed'],
        ...generateVerticalSpeedGradient()
      ]
    }
  };
} 