const BASEROW_TABLE_URL = window.BASEROW_TABLE_URL || '';
const BASEROW_TOKEN = window.BASEROW_API_TOKEN || '';

const sitePicker = document.getElementById('site-picker');
const siteForm = document.getElementById('site-form');
const rowIdInput = document.getElementById('row-id');
const statusMessage = document.getElementById('status-message');
const refreshButton = document.getElementById('refresh-sites');
const newSiteButton = document.getElementById('new-site');

let rows = [];

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = isError ? 'status error' : 'status';
}

function normalizeTypeValue(typeValue) {
  if (typeof typeValue === 'object' && typeValue !== null) {
    return typeValue.value || '';
  }

  return typeValue || '';
}

function formDataToPayload(formData) {
  const payload = {};

  formData.forEach((value, key) => {
    if (key === 'original_Type') {
      payload[key] = value;
      return;
    }

    payload[key] = typeof value === 'string' ? value.trim() : value;
  });

  return payload;
}

function populatePicker(items) {
  sitePicker.innerHTML = '<option value="">Select a site to edit...</option>';

  items.forEach((row) => {
    const option = document.createElement('option');
    option.value = String(row.id);
    option.textContent = `${row.original_Name || 'Untitled'} (#${row.id})`;
    sitePicker.appendChild(option);
  });
}

function fillForm(row) {
  rowIdInput.value = row.id || '';
  siteForm.elements.original_Name.value = row.original_Name || '';
  siteForm.elements.original_Type.value = normalizeTypeValue(row.original_Type);
  siteForm.elements.original_Address.value = row.original_Address || '';
  siteForm.elements.original_Year1.value = row.original_Year1 || '';
  siteForm.elements.original_Year2.value = row.original_Year2 || '';
  siteForm.elements.lat.value = row.lat || '';
  siteForm.elements.lon.value = row.lon || '';
  siteForm.elements.building_images1.value = row.building_images1 || '';
  siteForm.elements.field_7688476.value = row.field_7688476 || '';
  siteForm.elements.building_images2.value = row.building_images2 || '';
  siteForm.elements.field_7688477.value = row.field_7688477 || '';
  siteForm.elements.link.value = row.link || '';
  siteForm.elements.Description.value = row.Description || '';
}

function clearForm() {
  rowIdInput.value = '';
  siteForm.reset();
  sitePicker.value = '';
}

async function fetchRows() {
  const url = `${BASEROW_TABLE_URL}?user_field_names=true&size=200`;
  const headers = { Accept: 'application/json' };
  if (BASEROW_TOKEN) headers.Authorization = `Token ${BASEROW_TOKEN}`;

  const allResults = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) throw new Error('Unable to load rows from Baserow.');
    const payload = await response.json();
    if (Array.isArray(payload.results)) allResults.push(...payload.results);
    nextUrl = payload.next || null;
  }

  return allResults;
}

async function refreshRows() {
  showStatus('Loading sites...');

  try {
    rows = await fetchRows();
    populatePicker(rows);
    showStatus(`Loaded ${rows.length} sites.`);
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function saveSite(payload, rowId) {
  const method = rowId ? 'PATCH' : 'POST';
  const endpoint = rowId
    ? `${BASEROW_TABLE_URL}${rowId}/?user_field_names=true`
    : `${BASEROW_TABLE_URL}?user_field_names=true`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (BASEROW_TOKEN) headers.Authorization = `Token ${BASEROW_TOKEN}`;

  const response = await fetch(endpoint, {
    method,
    headers,
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || result.message || 'Save failed.');
  }

  return result;
}

sitePicker.addEventListener('change', () => {
  const selectedId = Number(sitePicker.value);

  if (!selectedId) {
    clearForm();
    return;
  }

  const selectedRow = rows.find((row) => row.id === selectedId);
  if (!selectedRow) {
    showStatus('Selected row not found.', true);
    return;
  }

  fillForm(selectedRow);
  showStatus(`Editing row #${selectedRow.id}`);
});

newSiteButton.addEventListener('click', () => {
  clearForm();
  showStatus('Creating a new site record.');
});

refreshButton.addEventListener('click', () => {
  refreshRows();
});

siteForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(siteForm);
  const payload = formDataToPayload(formData);
  const rowId = rowIdInput.value ? Number(rowIdInput.value) : null;

  try {
    showStatus('Saving...');
    const saved = await saveSite(payload, rowId);
    showStatus(`Saved site #${saved.id}.`);
    await refreshRows();
    fillForm(saved);
    sitePicker.value = String(saved.id);
  } catch (error) {
    showStatus(error.message, true);
  }
});

refreshRows();
