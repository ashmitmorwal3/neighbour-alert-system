// Import required modules
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // Added to resolve paths

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json()); // Middleware to parse JSON request bodies

// Serve static files from 'index' folder
app.use(express.static(path.join(__dirname, '../index'))); // Ensure correct path to the index folder

// Serve the index.html when a user visits the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html')); // Adjust the path accordingly
});

// Connect to MongoDB using environment variable
const mongoUri = "mongodb://localhost:27017/deviceTracker";
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define a Mongoose schema
const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// Create a Mongoose model
const Device = mongoose.model('Device', deviceSchema);

// Route to update device location
app.post('/devices', async (req, res) => {
  try {
    const { deviceId, latitude, longitude } = req.body;

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { latitude, longitude, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    // Emit location update to all connected clients
    io.emit('locationUpdate', device);

    res.status(200).json({ message: 'Device location updated', device });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating device location', error });
  }
});

// Route to send messages to nearby devices and show sender's location
app.post('/message', async (req, res) => {
  try {
    const { deviceId, latitude, longitude, message } = req.body;

    // Find nearby devices within a 1km radius (approximate)
    const radius = 0.01; // Roughly corresponds to 1km
    const nearbyDevices = await Device.find({
      latitude: { $gte: latitude - radius, $lte: latitude + radius },
      longitude: { $gte: longitude - radius, $lte: longitude + radius },
    });

    // Emit message and sender's location to nearby devices
    nearbyDevices.forEach((device) => {
      io.emit('message', {
        from: deviceId,
        message,
        latitude,
        longitude,
      });
    });

    res.status(200).json({ message: 'Message and location sent to nearby devices' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending message', error });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server using environment variable
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
