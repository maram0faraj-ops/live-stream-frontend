import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Signaling Server is Running Securely Online!');
});

io.on('connection', (socket) => {
    console.log(`⚡ جهاز متصل أون لاين: ${socket.id}`);
    
    socket.on('join-studio', (data) => socket.broadcast.emit('join-studio', data));
    socket.on('webrtc-offer', (data) => socket.broadcast.emit('webrtc-offer', data));
    socket.on('webrtc-answer', (data) => socket.broadcast.emit('webrtc-answer', data));
    socket.on('webrtc-candidate', (data) => socket.broadcast.emit('webrtc-candidate', data));
    
    socket.on('disconnect', () => {
        io.emit('device-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});