const { Server } = require('socket.io');

let io;

const normalizedAllowedSocketOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:8081',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8081',
  process.env.WEBSITE_URL,
  process.env.MOBILEAPP_URL,
].filter(Boolean).map((origin) => {
  try {
    return new URL(origin).origin
  } catch {
    return origin.replace(/\/api$/, '').replace(/\/$/, '')
  }
}))

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const incomingOrigin = origin ? origin.replace(/\/api$/, '').replace(/\/$/, '') : ''
          const allowed = !origin || normalizedAllowedSocketOrigins.has(incomingOrigin) ||
            /^http:\/\/192\.168\./.test(incomingOrigin) ||
            /^http:\/\/10\./.test(incomingOrigin) ||
            /^http:\/\/172\.(1[6-9]|2\d|3[01])\./.test(incomingOrigin)

          callback(null, allowed)
        },
        credentials: true
      }
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Clients can join rooms based on their roles
      socket.on('join', (roleRoom) => {
        socket.join(roleRoom);
        console.log(`Socket ${socket.id} joined room ${roleRoom}`);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};
