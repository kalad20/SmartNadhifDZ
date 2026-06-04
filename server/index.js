const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json()); // السماح باستقبال بيانات JSON من ESP32

// Serve static dashboard files 
app.use(express.static(path.join(__dirname, '../dashboard'))); 

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let binsData = {}; // Store the latest data for all bins

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  // Send initial data to the new client (e.g. dashboard)
  socket.emit('initial_data', binsData);

  // Listen for data from the simulator (ESP32)
  socket.on('bin_update', (data) => {
    binsData[data.binId] = data;
    // Broadcast the update to all connected clients (dashboards)
    io.emit('dashboard_update', data);
  });

  // Listen for adding a new bin from dashboard
  socket.on('add_bin', (newBin) => {
    console.log('New bin added:', newBin);
    // Broadcast to simulator so it starts simulating it, and to other clients
    io.emit('new_bin_added', newBin);
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected:', socket.id);
  });
});

// ----------------------------------------------------
// Hardware API Endpoint (ESP32)
// ----------------------------------------------------
app.post('/api/hardware', (req, res) => {
  const { binId, fillLevel, rfid, wasteType } = req.body;
  
  if (!binId) {
    return res.status(400).json({ error: 'binId is required' });
  }

  // 1. تحديث مستوى الامتلاء (Fill Level)
  if (fillLevel !== undefined) {
    const updateData = {
      binId: binId,
      fillLevel: fillLevel,
      status: fillLevel >= 80 ? 'Full' : 'Normal',
      lat: binsData[binId]?.lat || 36.7525,
      lng: binsData[binId]?.lng || 3.04197,
      street: binsData[binId]?.street || 'شارع ديدوش مراد'
    };
    binsData[binId] = updateData;
    io.emit('dashboard_update', updateData);
  }

  // 2. معالجة الفرز وتقنية RFID
  if (rfid && wasteType) {
    const eventData = {
      binId: binId,
      rfid: rfid,
      wasteType: wasteType, // "plastic" or "general"
      timestamp: new Date().toISOString()
    };
    // إرسال الحدث للوحة التحكم لإظهار المكافأة
    io.emit('hardware_event', eventData);
    console.log(`Hardware Event: RFID ${rfid} dumped ${wasteType} in bin ${binId}`);
  }

  res.json({ success: true, message: 'Data processed successfully' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Smart Bin Server running on http://localhost:${PORT}`);
});
