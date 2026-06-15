const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const urlRoutes = require('./routes/url');
const analyticsRoutes = require('./routes/analytics');
const reportRoutes = require('./routes/report');
const notificationRoutes = require('./routes/notification');

const redirectController = require('./controllers/redirect');
const { runHealthCheck } = require('./utils/healthChecker');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // For development flexibility
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Socket.io Connection Management
io.on('connection', (socket) => {
  console.log('Client connected to Socket.io:', socket.id);

  // Client requests to join their specific room for updates
  socket.on('join_user_room', (data) => {
    if (data && data.userId) {
      socket.join(`user_${data.userId}`);
      console.log(`Socket ${socket.id} joined room user_${data.userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Public API for password validation
app.post('/api/urls/verify-password/:shortCode', redirectController.verifyPasswordAndRedirect(io));

// Public Redirection Route (Redirects shortly.com/:shortCode -> Destination)
app.get('/:shortCode', redirectController.handleRedirect(io));

// Default health API
app.get('/', (req, res) => {
  res.json({ message: 'URL Shortener API is running.' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Trigger initial health check after 10 seconds, then run every 2 minutes
  setTimeout(() => {
    runHealthCheck(io);
  }, 10000);

  setInterval(() => {
    runHealthCheck(io);
  }, 120000);
});
