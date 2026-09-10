// start server

require('dotenv').config()

const app = require('./src/app');
const connectDB = require('./src/db/db');

const http = require('http');
const server = http.createServer(app);
const socket = require('./src/socket');

socket.init(server);

connectDB()

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} ..... `);
})