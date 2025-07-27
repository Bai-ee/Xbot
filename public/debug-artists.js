// Simple artist loading debug script
console.log('🚀 DEBUG: Script loaded');

function debugLog(message) {
    console.log(`🔍 ${new Date().toLocaleTimeString()} - ${message}`);
}

function testArtistLoading() {
    debugLog('Starting artist test');
    
    // Test 1: Check if dropdown exists
    const dropdown = document.getElementById('video-artist');
    debugLog(`Dropdown found: ${dropdown ? 'YES' : 'NO'}`);
    
    if (!dropdown) {
        debugLog('CRITICAL: Dropdown element missing');
        return;
    }
    
    // Test 2: Try API call
    debugLog('Making API call...');
    fetch('/api/video/artists')
        .then(response => {
            debugLog(`API response status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            debugLog(`API data success: ${data.success}`);
            debugLog(`Artist count: ${data.artists ? data.artists.length : 0}`);
            
            if (data.success && data.artists) {
                debugLog('Populating dropdown...');
                
                // Clear dropdown
                dropdown.innerHTML = '<option value="random">🎲 Random Artist</option>';
                
                // Add each artist
                data.artists.forEach((artist, index) => {
                    const option = document.createElement('option');
                    option.value = artist.name;
                    option.textContent = `${artist.name} (${artist.genre})`;
                    dropdown.appendChild(option);
                    debugLog(`Added artist ${index + 1}: ${artist.name}`);
                });
                
                debugLog(`SUCCESS: Dropdown now has ${dropdown.options.length} options`);
            } else {
                debugLog('ERROR: API returned no artists');
            }
        })
        .catch(error => {
            debugLog(`ERROR: ${error.message}`);
        });
}

// Auto-run when page loads
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM loaded - starting test');
    testArtistLoading();
});

// Manual test function
window.testArtists = testArtistLoading; 