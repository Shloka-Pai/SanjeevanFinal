const { Server } = require('socket.io');

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const allowed = !origin ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            /^http:\/\/192\.168\./.test(origin) ||
            /^http:\/\/10\./.test(origin) ||
            /^http:\/\/172\.(1[6-9]|2\d|3[01])\./.test(origin);

          callback(null, allowed);
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
