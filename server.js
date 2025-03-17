// server.js
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem')),
};

app.prepare().then(() => {
  const server = createServer(httpsOptions, (req, res) => {
    // Increase the request size limit for uploads
    req.setTimeout(300000); // 5 minutes timeout
    res.setTimeout(300000); // 5 minutes timeout
    
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  // Increase the server's request size limit
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 500;
  server.headersTimeout = 300000; // 5 minutes
  server.requestTimeout = 300000; // 5 minutes
  
  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});