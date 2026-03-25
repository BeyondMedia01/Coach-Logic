// Simple static file server (no dependencies)
// Serves files from current directory
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serve(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // Simple SPA friendly: serve index.html for root, otherwise static file
  let safePath = req.url === '/' ? 'index.html' : req.url.substring(1);
  // prevent directory traversal
  safePath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safePath);
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serve(filePath, res);
    }
    // Fallback: serve index.html for SPA-like routing
    return serve(path.join(ROOT, 'index.html'), res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
