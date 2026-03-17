const http = require('http');
const fs = require('fs');
const path = require('path');

function firstDefined(...values) {
  return values.find(v => v !== undefined && v !== null);
}

function normalizeTypeValue(value) {
  if (typeof value === 'object' && value !== null) {
    return firstDefined(value.value, value.id, '');
  }
  if (typeof value === 'string') return value.trim();
  return value || '';
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

http.get('http://127.0.0.1:3000/api/baserow/rows', res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const data = JSON.parse(body);
    const rows = data.results || [];
    const features = rows.map((row, i) => {
      const lngNum = toNumber(firstDefined(row.lon, row.lng, row.longitude));
      const latNum = toNumber(firstDefined(row.lat, row.latitude));
      if (lngNum === null || latNum === null) return null;

      const normalizedType = normalizeTypeValue(row.original_Type);
      return {
        type: 'Feature',
        id: row.id || i,
        properties: {
          Name: row.original_Name || '',
          Type: normalizedType,
          original_Type: normalizedType,
          Year1: row.original_Year1 || '',
          Year2: row.original_Year2 || '',
          Address: row.original_Address || '',
          LOCID: row.original_LOCID || '',
          Description: row.Description || '',
          building_images1: row.building_images1 || '',
          building_images2: row.building_images2 || '',
          link: row.link || '',
          formatted: row.formatted || ''
        },
        geometry: { type: 'Point', coordinates: [lngNum, latNum] }
      };
    }).filter(Boolean);

    const geojson = { type: 'FeatureCollection', features };
    const outPath = path.join(__dirname, 'data', 'aicd-sites-2.geojson');
    fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2));
    console.log('Wrote ' + features.length + ' features to ' + outPath);
  });
}).on('error', e => console.error('Error:', e.message));
