// Wait for page to load
window.addEventListener('DOMContentLoaded', () => {
  const map = new maplibregl.Map({
    container: "map",
    style: "styles/AICD.json",
    center: [-122.41572, 37.765],
    zoom: 14
  });
  
  map.on('load', () => {
    // Add GeoJSON source
    map.addSource('aicd-data', {
      type: 'geojson',
      data: '/aicd-map/data/AICD.geojson'
    });
    
    // Add polygon outline layer
    map.addLayer({
      id: 'aicd-outline',
      type: 'line',
      source: 'aicd-data',
      paint: {
        'line-color': '#F2BB16',
        'line-width': 3
      }
    });
    
    // Add sites source
    map.addSource('sites-data', {
      type: 'geojson',
      data: '/aicd-map/data/sites.geojson'
    });
    
    // Add sites as circle layer
    map.addLayer({
      id: 'sites-circles',
      type: 'circle',
      source: 'sites-data',
      paint: {
        'circle-radius': 3,
        'circle-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#f2c200'
      }
    });
    
    // Add selected site source (initially empty)
    map.addSource('selected-site', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // Add selected site highlight layer
    map.addLayer({
      id: 'selected-site-highlight',
      type: 'circle',
      source: 'selected-site',
      paint: {
        'circle-radius': 10,
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    
    // Add click event for sites
    map.on('click', 'sites-circles', (e) => {
      const feature = e.features[0];
      const properties = feature.properties;
      const sidebarContent = document.getElementById('sidebar-content');
      
      // Update selected site highlight
      map.getSource('selected-site').setData({
        type: 'FeatureCollection',
        features: [feature]
      });
      
      let html = `<h1 class="site-name">${properties.name}</h1>`;
      html += `<p class="site-desc">${properties.desc}</p>`;
      
      if (properties.col) {
        html += `<p class="site-col">${properties.col}</p>`;
      }
      
      sidebarContent.innerHTML = html;
      
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.add('active');
    });
    
    // Change cursor on hover
    map.on('mouseenter', 'sites-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'sites-circles', () => {
      map.getCanvas().style.cursor = '';
    });
  });
  
  // Close sidebar button
  document.getElementById('close-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
    
    // Clear selected site highlight
    map.getSource('selected-site').setData({
      type: 'FeatureCollection',
      features: []
    });
  });
  
  map.on('error', (e) => {
    console.error('Map error:', e);
  });
});
