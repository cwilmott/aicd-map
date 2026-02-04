// Wait for page to load
window.addEventListener('DOMContentLoaded', () => {
  const map = new maplibregl.Map({
    container: "map",
    style: "styles/AICD.json",
    center: [-122.41572, 37.765],
    zoom: 14
  });
  
  // Make map available globally for filter function
  window.mapInstance = map;
  
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
        'circle-color': [
          'match',
          ['get', 'original_Type'],
          'Org', '#f2c200',  // Brightest yellow (13 sites)
          'Ven', '#d4a800',  // Medium-bright yellow (5 sites)
          'Ind', '#b08d00',  // Medium yellow (2 sites)
          'Hsg', '#8c7200',  // Darker yellow (2 sites)
          'Biz', '#6b5700',  // Darkest yellow (2 sites)
          '#f2c200'          // Default fallback
        ],
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
      
      if (properties.original_Year1) {
        const yearText = properties.original_Year2 
          ? `${properties.original_Year1}-${properties.original_Year2}` 
          : properties.original_Year1;
        html += `<p class="site-col">${yearText}</p>`;
      }
      
      if (properties.original_Address) {
        html += `<p class="site-desc">${properties.original_Address}</p>`;
      }
      
      if (properties.original_TL_link1) {
        html += `<img src="${properties.original_TL_link1}" class="site-image" alt="${properties.original_Name}" onclick="openLightbox('${properties.original_TL_link1}')" />`;
      }
      
      if (properties.original_TL_link2) {
        html += `<img src="${properties.original_TL_link2}" class="site-image" alt="${properties.original_Name}" onclick="openLightbox('${properties.original_TL_link2}')" />`;
      }
      
      if (properties.original_TL_link3) {
        html += `<img src="${properties.original_TL_link3}" class="site-image" alt="${properties.original_Name}" onclick="openLightbox('${properties.original_TL_link3}')" />`;
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

// Lightbox functions
function openLightbox(imageSrc) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  lightboxImg.src = imageSrc;
  lightbox.classList.add('active');
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('active');
}

// Filter functionality
function updateFilter(map) {
  const checkboxes = document.querySelectorAll('.legend-checkbox');
  const activeTypes = [];
  
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      activeTypes.push(checkbox.dataset.type);
    }
  });
  
  // Create filter expression
  if (activeTypes.length === 0) {
    // Hide all if nothing selected
    map.setFilter('aicd-sites-circles', ['==', 'original_Type', '']);
  } else if (activeTypes.length === 5) {
    // Show all if everything selected
    map.setFilter('aicd-sites-circles', null);
  } else {
    // Show only selected types
    map.setFilter('aicd-sites-circles', ['in', 'original_Type', ...activeTypes]);
  }
}

// Close lightbox when clicking on the background or close button
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.querySelector('.lightbox-close');
  
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
  
  lightboxClose.addEventListener('click', closeLightbox);
  
  // Add filter checkbox listeners
  const checkboxes = document.querySelectorAll('.legend-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      // Access the map instance - need to make it available globally
      if (window.mapInstance) {
        updateFilter(window.mapInstance);
      }
    });
  });
});
