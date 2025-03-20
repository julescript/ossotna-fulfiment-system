// server.js
const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Check if HTTPS certificates exist
let useHttps = false;
let httpsOptions = {};

try {
  httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem')),
  };
  useHttps = true;
} catch (error) {
  console.log('> HTTPS certificates not found, using HTTP only');
  useHttps = false;
}

app.prepare().then(() => {
  // Create request handler function
  const requestHandler = (req, res) => {
    // Increase the request size limit for uploads
    req.setTimeout(300000); // 5 minutes timeout
    res.setTimeout(300000); // 5 minutes timeout
    
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  };
  
  // Create HTTP server
  const httpServer = createHttpServer(requestHandler);
  
  // Increase the server's request size limit
  httpServer.maxHeadersCount = 100;
  httpServer.maxRequestsPerSocket = 500;
  httpServer.headersTimeout = 300000; // 5 minutes
  httpServer.requestTimeout = 300000; // 5 minutes
  
  // Start HTTP server
  httpServer.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
  
  // Create HTTPS server if certificates exist
  if (useHttps) {
    const httpsServer = createHttpsServer(httpsOptions, requestHandler);
    
    // Increase the server's request size limit
    httpsServer.maxHeadersCount = 100;
    httpsServer.maxRequestsPerSocket = 500;
    httpsServer.headersTimeout = 300000; // 5 minutes
    httpsServer.requestTimeout = 300000; // 5 minutes
    
    // Start HTTPS server on a different port
    httpsServer.listen(3001, (err) => {
      if (err) throw err;
      console.log('> Ready on https://localhost:3001');
    });
  }
});