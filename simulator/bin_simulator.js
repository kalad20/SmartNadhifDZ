const { io } = require('socket.io-client');

// Connect to the local server
const socket = io('http://localhost:3000');

// Create 3 simulated bins in Algiers
const bins = [
  { binId: 'BIN_ALG_001', location: 'البريد المركزي - الجزائر الوسطى', fillLevel: 0, totalPoints: 0 },
  { binId: 'BIN_ALG_002', location: 'ساحة الشهداء - القصبة', fillLevel: 20, totalPoints: 0 },
  { binId: 'BIN_ALG_003', location: 'جامعة الجزائر 3 - بن عكنون', fillLevel: 80, totalPoints: 0 }
];

socket.on('connect', () => {
  console.log('Connected to server! Starting Algiers simulation...');

  // Simulate throwing trash every 3 seconds
  setInterval(() => {
    if (bins.length === 0) return;
    
    // Pick a random bin
    const randomBinIndex = Math.floor(Math.random() * bins.length);
    const bin = bins[randomBinIndex];

    // Is the bin full? (Let's empty it if it reaches 100)
    if (bin.fillLevel >= 100) {
      bin.fillLevel = 0;
      console.log(`[!] ${bin.binId} تم تفريغ الحاوية من طرف البلدية!`);
    }

    // Throw random garbage. 
    // Let's say 40% chance it's plastic
    const isPlastic = Math.random() < 0.4;
    let addedVolume = Math.floor(Math.random() * 15) + 5; // 5 to 20 percent per throw
    
    bin.fillLevel += addedVolume;
    if (bin.fillLevel > 100) bin.fillLevel = 100;

    let pointsAwarded = 0;
    if (isPlastic) {
        pointsAwarded = addedVolume * 2; // 2 points/DZD per % of plastic volume
        bin.totalPoints += pointsAwarded;
    }

    const payload = {
        binId: bin.binId,
        location: bin.location,
        fillLevel: bin.fillLevel,
        lastItem: isPlastic ? 'بلاستيك (قابل للتدوير)' : 'نفايات عامة',
        pointsAwarded: pointsAwarded,
        totalPoints: bin.totalPoints,
        timestamp: new Date().toISOString()
    };

    console.log(`Sending update for ${bin.binId}: ${bin.fillLevel}% full. Item: ${payload.lastItem}`);
    
    // Send to server
    socket.emit('bin_update', payload);

  }, 3000);
});

// Listen for new bins added from dashboard
socket.on('new_bin_added', (newBin) => {
    bins.push({
        binId: newBin.binId,
        location: newBin.location,
        fillLevel: 0,
        totalPoints: 0
    });
    console.log(`Started simulating new bin: ${newBin.binId} at ${newBin.location}`);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
