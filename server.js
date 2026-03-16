const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;

const BASEROW_TOKEN = process.env.BASEROW_API_TOKEN || '';
const BASEROW_TABLE_ID = process.env.BASEROW_TABLE_ID || '889001';
const BASEROW_PAGE_SIZE = Number(process.env.BASEROW_PAGE_SIZE || 200);

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

async function fetchAllBaserowRows() {
  if (!BASEROW_TOKEN) {
    throw new Error('BASEROW_API_TOKEN is not configured on the server.');
  }

  const results = [];
  let nextUrl = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=${BASEROW_PAGE_SIZE}`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        Accept: 'application/json'
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
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });

    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/baserow/rows' && req.method === 'GET') {
      const payload = await fetchAllBaserowRows();
      json(res, 200, payload);
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
