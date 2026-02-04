// Wait for page to load
window.addEventListener('DOMContentLoaded', () => {
  const map = new maplibregl.Map({
    container: "map",
    style: "styles/AICD.json",
    center: [-122.41572, 37.765],
    zoom: 14
  });
  
  map.on('load', () => {
    // Map loaded
  });
  
  map.on('error', (e) => {
    console.error('Map error:', e);
  });
});
