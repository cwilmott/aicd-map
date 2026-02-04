// Wait for page to load
window.addEventListener('DOMContentLoaded', () => {
  const map = new maplibregl.Map({
    container: "map",
    style: "styles/AICD.json",
    center: [-122.41572, 37.765],
    zoom: 14
  });
  
  map.on('load', () => {
    // Add AICD boundary source
    map.addSource('aicd-data', {
      type: 'geojson',
      data: 'data/AICD.geojson'
    });
    
    // Add AICD polygon outline layer
    map.addLayer({
      id: 'aicd-outline',
      type: 'line',
      source: 'aicd-data',
      paint: {
        'line-color': '#F2BB16',
        'line-width': 3
      }
    });
    
    // Add aicd-sites source
    map.addSource('aicd-sites', {
      type: 'geojson',
      data: 'data/aicd-sites.geojson'
    });
    
    // Add sites as circle layer
    map.addLayer({
      id: 'aicd-sites-circles',
      type: 'circle',
      source: 'aicd-sites',
      paint: {
        'circle-radius': 6,
        'circle-color': '#f2c200',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    
    // Add click event for sites
    map.on('click', 'aicd-sites-circles', (e) => {
      const feature = e.features[0];
      const properties = feature.properties;
      const sidebarContent = document.getElementById('sidebar-content');
      
      let html = `<h1 class="site-name">${properties.original_Name || 'Unknown'}</h1>`;
      
      if (properties.original_Address) {
        html += `<p class="site-desc">${properties.original_Address}</p>`;
      }
      
      if (properties.original_Year1) {
        html += `<p class="site-col">Year: ${properties.original_Year1}${properties.original_Year2 ? '-' + properties.original_Year2 : ''}</p>`;
      }
      
      if (properties.original_Type) {
        html += `<p class="site-col">Type: ${properties.original_Type}</p>`;
      }
      
      sidebarContent.innerHTML = html;
      
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.add('active');
    });
    
    // Change cursor on hover
    map.on('mouseenter', 'aicd-sites-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'aicd-sites-circles', () => {
      map.getCanvas().style.cursor = '';
    });
  });
  
  // Close sidebar button
  document.getElementById('close-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
  });
  
  map.on('error', (e) => {
    console.error('Map error:', e);
  });
});
