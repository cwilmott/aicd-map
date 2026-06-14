// Wait for page to load
function shouldDisplayImage(url) {
  return Boolean(url);
}

const SITE_TYPE_PALETTE = {
  'Org-Pres': '#FCC93A',
  'Org-Past': '#A7945E',
  'Biz-Pres': '#E5CC45',
  'Biz-Past': '#7D745B',
  'Cultural-Sites': '#D2B053',
  Individuals: '#332F26',
  Events: '#52504A',
  Hsg: '#756435',
  'Art Activations': '#9E4A2F',
  Exhibition: '#8B6914',
  'Settler Organisation': '#5B7065',
  'Genocide Sites': '#2B3A5C'
};

const SITE_TYPE_LABELS = {
  'Org-Pres': 'Organizations (Present)',
  'Org-Past': 'Organizations (Past)',
  'Biz-Pres': 'Business (Present)',
  'Biz-Past': 'Business (Past)',
  'Cultural-Sites': 'Cultural Sites',
  Individuals: 'Individuals',
  Events: 'Events',
  Hsg: 'Housing',
  'Art Activations': 'Art Activations',
  Exhibition: 'Exhibition',
  'Settler Organisation': 'Settler Organisation',
  'Genocide Sites': 'Genocide Sites'
};

const SITE_TYPE_ORDER = [
  'Org-Pres',
  'Org-Past',
  'Biz-Pres',
  'Biz-Past',
  'Cultural-Sites',
  'Individuals',
  'Events',
  'Hsg',
  'Art Activations',
  'Exhibition',
  'Settler Organisation',
  'Genocide Sites'
];

function getCategoryColor(type) {
  return SITE_TYPE_PALETTE[type] || '#D2B053';
}

function getCategoryLabel(type) {
  return SITE_TYPE_LABELS[type] || type;
}

function normalizeTypeValue(value) {
  if (typeof value === 'object' && value !== null) {
    return firstDefined(value.value, value.id, '');
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value || '';
}

function getFeatureType(properties) {
  const typeValue = firstDefined(properties.Type, properties.original_Type);
  return normalizeTypeValue(typeValue);
}

function buildCategoryList(features) {
  const presentTypes = new Set();

  features.forEach((feature) => {
    const featureType = getFeatureType(feature.properties || {});

    if (featureType) {
      presentTypes.add(featureType);
    }
  });

  const inOrder = SITE_TYPE_ORDER.filter((type) => presentTypes.has(type));
  const unknown = [...presentTypes]
    .filter((type) => !SITE_TYPE_ORDER.includes(type))
    .sort((a, b) => a.localeCompare(b));

  return [...inOrder, ...unknown];
}

function getTypeExpression() {
  return ['coalesce', ['get', 'Type'], ['get', 'original_Type']];
}

function buildCircleColorExpression(categories) {
  const expression = ['match', getTypeExpression()];

  categories.forEach((type) => {
    expression.push(type, getCategoryColor(type));
  });

  expression.push('#D2B053');
  return expression;
}

function renderLegend(categories) {
  const legendItems = document.querySelector('.legend-items');

  if (!legendItems) {
    return;
  }

  legendItems.innerHTML = categories
    .map((type) => {
      const label = getCategoryLabel(type);
      const color = getCategoryColor(type);

      return `
      <label class="legend-item">
        <input type="checkbox" class="legend-checkbox" data-type="${type}" checked>
        <span class="legend-color" style="background-color: ${color};"></span>
        <span class="legend-label">${label}</span>
      </label>`;
    })
    .join('');
}

function getSitesConfig() {
  return {
    localDataPath: 'data/aicd-sites-2.geojson',
    baserowGeojsonUrl: window.BASEROW_GEOJSON_URL || '',
    baserowRowsApiUrl: window.BASEROW_ROWS_API_URL || '',
    baserowToken: window.BASEROW_API_TOKEN || ''
  };
}

async function fetchJson(url, token = '') {
  const headers = { Accept: 'application/json' };

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function fetchAllBaserowRows(initialUrl, token = '') {
  const collectedResults = [];
  let nextUrl = initialUrl;

  while (nextUrl) {
    const pagePayload = await fetchJson(nextUrl, token);

    if (Array.isArray(pagePayload?.results)) {
      collectedResults.push(...pagePayload.results);
      nextUrl = pagePayload.next || null;
      continue;
    }

    if (Array.isArray(pagePayload)) {
      collectedResults.push(...pagePayload);
      nextUrl = null;
      continue;
    }

    nextUrl = null;
  }

  return collectedResults;
}

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function getPointGeometry(row) {
  if (row.geometry && row.geometry.type === 'Point' && Array.isArray(row.geometry.coordinates)) {
    return row.geometry;
  }

  const lng = firstDefined(row.longitude, row.lng, row.lon, row.Longitude, row.Lng, row.Lon);
  const lat = firstDefined(row.latitude, row.lat, row.Latitude, row.Lat);
  const lngNum = toNumber(lng);
  const latNum = toNumber(lat);

  if (lngNum !== null && latNum !== null) {
    return {
      type: 'Point',
      coordinates: [lngNum, latNum]
    };
  }

  return null;
}

function convertBaserowRowsToGeoJson(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : [];

  const features = rows
    .map((row, index) => {
      const geometry = getPointGeometry(row);

      if (!geometry) {
        return null;
      }

      const originalType = row.original_Type;
      const normalizedType = normalizeTypeValue(originalType);
      const properties = {
        ...row,
        original_Type: normalizedType,
        Type: firstDefined(row.Type, normalizedType)
      };

      return {
        type: 'Feature',
        id: row.id || index,
        properties,
        geometry
      };
    })
    .filter(Boolean);

  return {
    type: 'FeatureCollection',
    features
  };
}

function isFeatureCollection(data) {
  return data && data.type === 'FeatureCollection' && Array.isArray(data.features);
}

async function loadSitesData() {
  const config = getSitesConfig();

  if (config.baserowGeojsonUrl) {
    try {
      const externalGeoJson = await fetchJson(config.baserowGeojsonUrl, config.baserowToken);

      if (isFeatureCollection(externalGeoJson)) {
        console.info('Loaded sites from BASEROW_GEOJSON_URL');
        return externalGeoJson;
      }

      console.warn('BASEROW_GEOJSON_URL did not return FeatureCollection. Falling back to local file.');
    } catch (error) {
      console.warn('Failed to load BASEROW_GEOJSON_URL. Falling back to local file.', error);
    }
  }

  if (config.baserowRowsApiUrl) {
    try {
      const rows = await fetchAllBaserowRows(config.baserowRowsApiUrl, config.baserowToken);
      const rowsPayload = { results: rows };
      const geoJson = convertBaserowRowsToGeoJson(rowsPayload);

      if (geoJson.features.length > 0) {
        console.info('Loaded sites from BASEROW_ROWS_API_URL');
        return geoJson;
      }

      console.warn('BASEROW_ROWS_API_URL returned no mappable rows. Falling back to local file.');
    } catch (error) {
      console.warn('Failed to load BASEROW_ROWS_API_URL. Falling back to local file.', error);
    }
  }

  return fetchJson(config.localDataPath);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function getImageUrls(properties) {
  const buildingImage = firstDefined(properties.building_images1, properties.original_building_images1);

  if (Array.isArray(buildingImage)) {
    return buildingImage.filter(Boolean);
  }

  if (typeof buildingImage === 'string' && buildingImage.trim()) {
    return [buildingImage.trim()];
  }

  return [
    properties.TL_link1,
    properties.TL_link2,
    properties.TL_link3,
    properties.TL_link4,
    properties.TL_link5,
    properties.TL_link6,
    properties.TL_link7,
    properties.original_TL_link1,
    properties.original_TL_link2,
    properties.original_TL_link3
  ].filter(Boolean);
}

function getImageEntries(properties) {
  const entries = [];

  const img1 = firstDefined(properties.building_images1, properties.original_building_images1);
  const caption1 = firstDefined(properties['bi1-image-caption'], properties.field_7688476, properties.original_field_7688476) || '';
  if (Array.isArray(img1)) {
    img1.filter(Boolean).forEach((url) => entries.push({ url, caption: caption1 }));
  } else if (typeof img1 === 'string' && img1.trim()) {
    entries.push({ url: img1.trim(), caption: caption1 });
  }

  const img2 = firstDefined(properties.building_images2, properties.original_building_images2);
  const caption2 = firstDefined(properties['bi2-image-caption'], properties.field_7688477, properties.original_field_7688477) || '';
  if (Array.isArray(img2)) {
    img2.filter(Boolean).forEach((url) => entries.push({ url, caption: caption2 }));
  } else if (typeof img2 === 'string' && img2.trim()) {
    entries.push({ url: img2.trim(), caption: caption2 });
  }

  if (entries.length === 0) {
    [
      properties.TL_link1,
      properties.TL_link2,
      properties.TL_link3,
      properties.TL_link4,
      properties.TL_link5,
      properties.TL_link6,
      properties.TL_link7,
      properties.original_TL_link1,
      properties.original_TL_link2,
      properties.original_TL_link3
    ].filter(Boolean).forEach((url) => entries.push({ url, caption: '' }));
  }

  return entries;
}

function isLikelyUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function getSfHeritageLink(properties, imageUrls) {
  const imageSet = new Set((imageUrls || []).map((url) => String(url).trim()));
  const candidates = [
    properties.link,
    properties.Link,
    properties.field_7688480,
    properties.TL_link1,
    properties.TL_link2,
    properties.TL_link3,
    properties.TL_link4,
    properties.TL_link5,
    properties.TL_link6,
    properties.TL_link7,
    properties.original_TL_link1,
    properties.original_TL_link2,
    properties.original_TL_link3
  ];

  for (const value of candidates) {
    if (!isLikelyUrl(value)) {
      continue;
    }

    const normalized = value.trim();
    const isSfHeritage = normalized.toLowerCase().includes('sfheritage.org');
    if (isSfHeritage && !imageSet.has(normalized)) {
      return normalized;
    }
  }

  return '';
}

window.addEventListener('DOMContentLoaded', () => {
  const map = new maplibregl.Map({
    container: "map",
    style: "styles/AICD.json",
    center: [-122.41572, 37.765],
    zoom: 14
  });
  
  // Make map available globally for filter function
  window.mapInstance = map;
  
  map.on('load', async () => {
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
    const sitesData = await loadSitesData();
    const categories = buildCategoryList(sitesData.features || []);
    renderLegend(categories);

    map.addSource('aicd-sites', {
      type: 'geojson',
      data: sitesData
    });
    
    // Add sites as circle layer
    map.addLayer({
      id: 'aicd-sites-circles',
      type: 'circle',
      source: 'aicd-sites',
      paint: {
        'circle-radius': 6,
        'circle-color': buildCircleColorExpression(categories),
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
    
    // Add click event for sites
    map.on('click', 'aicd-sites-circles', (e) => {
      const feature = e.features[0];
      const properties = feature.properties;
      const sidebarContent = document.getElementById('sidebar-content');
      const siteName = firstDefined(properties.Name, properties.original_Name) || 'Unknown';
      const siteYear1 = firstDefined(properties.Year1, properties.original_Year1);
      const siteYear2 = firstDefined(properties.Year2, properties.original_Year2);
      const siteAddress = firstDefined(properties.Address, properties.original_Address);
      const siteDescription = firstDefined(properties.Description, properties.description, properties.original_Description);
      const imageEntries = getImageEntries(properties).filter((entry) => shouldDisplayImage(entry.url));
      const imageUrls = imageEntries.map((entry) => entry.url);
      const sfHeritageLink = getSfHeritageLink(properties, imageUrls);
      
      let html = `<h1 class="site-name">${siteName}</h1>`;
      
      if (siteYear1) {
        const yearText = siteYear2 
          ? `${siteYear1}-${siteYear2}` 
          : siteYear1;
        html += `<p class="site-col">${yearText}</p>`;
      }
      
      if (siteAddress) {
        html += `<p class="site-desc">${siteAddress}</p>`;
      }

      imageEntries.forEach((entry) => {
        html += `<figure class="site-figure"><img src="${entry.url}" class="site-image" alt="${siteName}" onclick="openLightbox('${entry.url}')" />`;
        if (entry.caption && String(entry.caption).trim()) {
          html += `<figcaption class="site-caption">${entry.caption}</figcaption>`;
        }
        html += `</figure>`;
      });

      if (siteDescription && String(siteDescription).trim()) {
        html += `<p class="site-image-desc">${siteDescription}</p>`;
      }

      if (sfHeritageLink) {
        html += `<div class="site-links"><a class="site-link" href="${sfHeritageLink}" target="_blank" rel="noopener noreferrer">See more on the SF Heritage Website</a></div>`;
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
  if (!shouldDisplayImage(imageSrc)) {
    return;
  }

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  lightboxImg.src = imageSrc;
  lightbox.classList.add('active');
  lightboxImg.classList.remove('zoomed');
  lightbox.classList.remove('has-zoom');
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  lightbox.classList.remove('active');
  lightboxImg.classList.remove('zoomed');
  lightbox.classList.remove('has-zoom');
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
    map.setFilter('aicd-sites-circles', ['==', getTypeExpression(), '']);
  } else if (activeTypes.length === checkboxes.length) {
    // Show all if everything selected
    map.setFilter('aicd-sites-circles', null);
  } else {
    // Show only selected types
    map.setFilter('aicd-sites-circles', ['in', getTypeExpression(), ['literal', activeTypes]]);
  }
}

// Close lightbox when clicking on the background or close button
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  const lightboxClose = document.querySelector('.lightbox-close');
  const lightboxImg = document.getElementById('lightbox-img');
  
  // Click on background closes lightbox
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
  
  // Click on image toggles zoom
  lightboxImg.addEventListener('click', (e) => {
    e.stopPropagation();
    lightboxImg.classList.toggle('zoomed');
    lightbox.classList.toggle('has-zoom');
    // Scroll to top when zooming in
    if (lightboxImg.classList.contains('zoomed')) {
      lightbox.scrollTop = 0;
    }
  });
  
  lightboxClose.addEventListener('click', closeLightbox);
  
  // Add filter checkbox listener (event delegation supports dynamic legend items)
  const legendItems = document.querySelector('.legend-items');
  if (legendItems) {
    legendItems.addEventListener('change', (event) => {
      if (!event.target.classList.contains('legend-checkbox')) {
        return;
      }

      if (window.mapInstance) {
        updateFilter(window.mapInstance);
      }
    });
  }
});
