// Import application initializer
import { initializeApp } from "./init.js";
import { setDebugAltitude } from "./state.js";
import { highlightAirspaceAtCurrentAltitude } from "./airspace.js";

// Initialize the application
initializeApp('map');

// Expose debug functions globally
window.setDebugAltitude = setDebugAltitude;
window.highlightAirspaceAtCurrentAltitude = highlightAirspaceAtCurrentAltitude;

// Log debug helper info
console.log('Debug functions available:');
console.log('  setDebugAltitude(altitude) - Set debug altitude in meters (null to clear)');
console.log('  highlightAirspaceAtCurrentAltitude() - Manually trigger highlighting for current altitude');
