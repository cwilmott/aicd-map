const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;

const BASEROW_TOKEN = process.env.BASEROW_API_TOKEN || '';
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || '889001';
const BASEROW_PAGE_SIZE = Number(process.env.BASEROW_PAGE_SIZE || 200);
const BASEROW_API_ROOT = 'https://api.baserow.io';

const EDITABLE_FIELDS = [
  'original_LOCID',
  'original_Name',
  'original_Year1',
  'original_Year2',
  'original_Type',
  'original_Number',
  'original_Streetname',
  'original_Streetlabel',
  'original_ZIP',
  'original_Address',
  'original_TL_reference',
  'formatted',
  'building_images1',
  'field_7688476',
  'building_images2',
  'field_7688477',
  'lon',
  'lat',
  'link',
  'Description'
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8'
};

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function getRequestPath(req) {
  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url || '/', `http://${host}`);
  return parsedUrl.pathname;
}

function getBaserowHeaders(withJsonContentType = false) {
  if (!BASEROW_TOKEN) {
    throw new Error('BASEROW_API_TOKEN is not configured on the server.');
  }

  const headers = {
    Authorization: `Token ${BASEROW_TOKEN}`,
    Accept: 'application/json'
  };

  if (withJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function filterEditableFields(input) {
  const payload = {};

  EDITABLE_FIELDS.forEach((fieldName) => {
    if (Object.prototype.hasOwnProperty.call(input, fieldName)) {
      payload[fieldName] = input[fieldName];
    }
  });

  return payload;
}

async function baserowWriteRow(method, rowId, rowData) {
  const suffix = rowId
    ? `/api/database/rows/table/${BASEROW_TABLE_ID}/${rowId}/?user_field_names=true`
    : `/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true`;
  const url = `${BASEROW_API_ROOT}${suffix}`;

  const response = await fetch(url, {
    method,
    headers: getBaserowHeaders(true),
    body: JSON.stringify(rowData)
  });

  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { detail: raw };
    }
  }

  if (!response.ok) {
    throw new Error(`Baserow write failed (${response.status}): ${JSON.stringify(payload || {})}`);
  }

  return payload || {};
}

async function fetchAllBaserowRows() {
  if (!BASEROW_TOKEN) {
    throw new Error('BASEROW_API_TOKEN is not configured on the server.');
  }

  const results = [];
  let nextUrl = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=${BASEROW_PAGE_SIZE}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        ...getBaserowHeaders(false)
      }
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Baserow request failed (${response.status}): ${details}`);
    }

    const payload = await response.json();
    const pageResults = Array.isArray(payload.results) ? payload.results : [];
    results.push(...pageResults);
    nextUrl = payload.next || null;
  }

  return {
    count: results.length,
    next: null,
    previous: null,
    results
  };
}

function resolveFilePath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split('?')[0]);
  const targetPath = safePath === '/' ? '/index.html' : safePath;
  const fullPath = path.resolve(ROOT_DIR, `.${targetPath}`);

  if (!fullPath.startsWith(ROOT_DIR)) {
    return null;
  }

  return fullPath;
}

function serveStatic(req, res) {
  const fullPath = resolveFilePath(req.url || '/');

  if (!fullPath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const requestPath = getRequestPath(req);

    if (requestPath === '/api/baserow/rows' && req.method === 'GET') {
      const payload = await fetchAllBaserowRows();
      json(res, 200, payload);
      return;
    }

    if (requestPath === '/api/baserow/rows' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const writableFields = filterEditableFields(body);

      if (Object.keys(writableFields).length === 0) {
        json(res, 400, {
          error: 'bad_request',
          message: 'No editable fields were provided.'
        });
        return;
      }

      const createdRow = await baserowWriteRow('POST', null, writableFields);
      json(res, 201, createdRow);
      return;
    }

    const rowPatchMatch = requestPath.match(/^\/api\/baserow\/rows\/(\d+)$/);
    if (rowPatchMatch && req.method === 'PATCH') {
      const rowId = Number(rowPatchMatch[1]);
      const body = await readJsonBody(req);
      const writableFields = filterEditableFields(body);

      if (Object.keys(writableFields).length === 0) {
        json(res, 400, {
          error: 'bad_request',
          message: 'No editable fields were provided.'
        });
        return;
      }

      const updatedRow = await baserowWriteRow('PATCH', rowId, writableFields);
      json(res, 200, updatedRow);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    json(res, 500, {
      error: 'proxy_error',
      message: error.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AICD map server running at http://localhost:${PORT}`);
});
