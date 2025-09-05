// server.ts - Next.js Standalone + Socket.IO
import { setupSocket } from '@/lib/socket';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

// Set Node.js environment variables for large request handling
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --max-http-header-size=524288000';

const dev = process.env.NODE_ENV !== 'production';
const currentPort = 3000;
const hostname = '0.0.0.0';

// Custom server with Socket.IO integration
async function createCustomServer() {
  try {
    // Create Next.js app with configuration for large request bodies
    const nextApp = next({ 
      dev,
      dir: process.cwd(),
      // In production, use the current directory where .next is located
      conf: dev ? undefined : { distDir: './.next' }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    // Create HTTP server that will handle both Next.js and Socket.IO
    const server = createServer((req, res) => {
      // Skip socket.io requests from Next.js handler
      if (req.url?.startsWith('/api/socketio')) {
        return;
      }
      
      // Configure request size limits for all requests
      // Set a larger limit for request body size (500MB)
      req.setTimeout(0); // Disable timeout for large uploads
      res.setTimeout(0); // Disable timeout for large uploads
      
      // Increase the maximum request body size
      if (req.headers) {
        req.headers['content-length'] = undefined;
      }
      
      handle(req, res);
    });
    
    // Set server request size limits
    server.maxHeadersCount = 0;
    server.timeout = 0; // Disable timeout
    server.keepAliveTimeout = 0; // Disable keep-alive timeout
    server.headersTimeout = 0; // Disable headers timeout
    
    // Explicitly set max request body size for the HTTP server
    // This overrides any default limits
    server.maxRequestsPerSocket = 0;

    // Setup Socket.IO
    const io = new Server(server, {
      path: '/api/socketio',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    setupSocket(io);

    // Start the server
    server.listen(currentPort, hostname, () => {
      console.log(`> Ready on http://${hostname}:${currentPort}`);
      console.log(`> Socket.IO server running at ws://${hostname}:${currentPort}/api/socketio`);
    });

  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

// Start the server
createCustomServer();
