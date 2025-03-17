/**
 * Install module for MountainCircles Map
 * Contains functions for handling PWA installation
 */

// Import from utils
import { isMobileDevice } from "./utils.js";

// State for install prompt
let deferredPrompt = null;

/**
 * Handles the install prompt for PWA
 * @param {Event} e - The beforeinstallprompt event
 */
export function handleInstallPrompt(e) {
    // Store the event for later use
    deferredPrompt = e;
    
    if (isMobileDevice()) {
        document.getElementById('installPrompt').style.display = 'block';
    } else {
        document.getElementById('installPrompt').style.display = 'none';
    }
}

/**
 * Initiates the PWA installation process
 */
export async function installApp() {
    if (deferredPrompt) {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        document.getElementById('installPrompt').style.display = 'none';
    }
}

/**
 * Cancels the PWA installation
 */
export function cancelInstall() {
    document.getElementById('installPrompt').style.display = 'none';
}

/**
 * Sets up event listeners for install functionality
 */
export function setupInstallEventListeners() {
    // Install prompt event
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    
    // Install button
    document.getElementById('installButton').addEventListener('click', installApp);
    
    // Cancel install button
    document.getElementById('cancelInstall').addEventListener('click', cancelInstall);
}
