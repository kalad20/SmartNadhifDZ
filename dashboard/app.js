// Connect to the server dynamically (works locally and on Render)
const socket = io();

const binsContainer = document.getElementById('bins-container');
const loadingMsg = document.getElementById('loading-msg');
const globalPointsEl = document.getElementById('global-points');

// Add Bin Form Elements
const showAddBtn = document.getElementById('show-add-modal-btn');
const addBinFormContainer = document.getElementById('add-bin-form');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const newBinForm = document.getElementById('new-bin-form');
const binIdInput = document.getElementById('bin-id-input');
const binLocInput = document.getElementById('bin-loc-input');

// Toggle Add Form
showAddBtn.addEventListener('click', () => {
    addBinFormContainer.style.display = 'block';
    binIdInput.focus();
});

cancelAddBtn.addEventListener('click', () => {
    addBinFormContainer.style.display = 'none';
    newBinForm.reset();
});

// Handle Add Bin Submit
newBinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newBinId = binIdInput.value.trim();
    const newBinLoc = binLocInput.value.trim();
    
    if(newBinId && newBinLoc) {
        // Send to server
        socket.emit('add_bin', {
            binId: newBinId,
            location: newBinLoc
        });
        
        showToast(`جاري إضافة الحاوية ${newBinId}...`);
        
        // Hide and reset form
        addBinFormContainer.style.display = 'none';
        newBinForm.reset();
    }
});

// Test Truck Button
const testTruckBtn = document.getElementById('test-truck-btn');
if (testTruckBtn) {
    testTruckBtn.addEventListener('click', () => {
        triggerTruckAnimation('BIN_TEST', 'تفريغ تجريبي (عنابة)');
    });
}

// State to store rendered bins
const renderedBins = new Set();

// Listen for initial data payload
socket.on('initial_data', (binsData) => {
    console.log('Received initial data:', binsData);
    if(Object.keys(binsData).length > 0 && loadingMsg) {
        loadingMsg.style.display = 'none';
    }
    Object.values(binsData).forEach(bin => {
        updateOrCreateBinCard(bin);
    });
});

// Listen for a new bin being added to instantly create an empty card
socket.on('new_bin_added', (newBin) => {
    if(loadingMsg) loadingMsg.style.display = 'none';
    showToast(`تمت إضافة حاوية جديدة في ${newBin.location}!`);
    // Create an empty card until simulator sends data
    updateOrCreateBinCard({
        binId: newBin.binId,
        location: newBin.location,
        fillLevel: 0,
        totalPoints: 0,
        lastItem: 'جديدة',
        timestamp: new Date().toISOString()
    });
});

const previousFills = {};

// Listen for real-time updates from any bin
socket.on('dashboard_update', (binData) => {
    console.log('Update received:', binData);
    if(loadingMsg) loadingMsg.style.display = 'none';

    const prevFill = previousFills[binData.binId] || 0;
    // If the bin level drops by more than 40%, it means it was emptied!
    if (prevFill > (binData.fillLevel + 40)) {
        try {
            triggerTruckAnimation(binData.binId, binData.location);
        } catch (e) {
            console.error('Truck animation error:', e);
        }
    }
    previousFills[binData.binId] = binData.fillLevel;

    updateOrCreateBinCard(binData);
    
    // Show a notification if someone threw plastic and got points
    if (binData.pointsAwarded > 0) {
        showToast(`+${binData.pointsAwarded} دج كمكافأة لفرز البلاستيك في ${binData.location}!`);
    }

    // Update global points sum
    updateGlobalPoints();
});

// Listen for Hardware Events (RFID and Sorting)
socket.on('hardware_event', (event) => {
    if (event.wasteType === 'plastic') {
        showToast(`🎉 تم فرز بلاستيك! البطاقة: ${event.rfid} ربحت 15 د.ج`);
        
        // Add points to the specific bin
        let card = document.getElementById(event.binId);
        if (card) {
            let currentPoints = parseInt(card.dataset.points) || 0;
            card.dataset.points = currentPoints + 15;
            let pointsEl = card.querySelector('.total-points-val');
            if (pointsEl) pointsEl.textContent = `${card.dataset.points} دج`;
            updateGlobalPoints();
        }

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#10b981', '#f59e0b', '#ffffff']
            });
        }
    } else {
        showToast(`🗑️ تم رمي نفايات عامة. البطاقة: ${event.rfid}`);
    }
});

function updateOrCreateBinCard(data) {
    let card = document.getElementById(data.binId);
    
    if (!card) {
        // Create new card
        card = document.createElement('div');
        card.className = 'bin-card';
        card.id = data.binId;
        
        card.innerHTML = `
            <div class="bin-header">
                <div class="bin-id">
                    <i class="fa-solid fa-trash-can"></i> ${data.binId}
                </div>
                <div class="status-dot"></div>
            </div>
            <div class="bin-location"><i class="fa-solid fa-location-dot"></i> ${data.location}</div>
            
            <div class="progress-container">
                <svg viewBox="0 0 36 36" class="circular-chart state-good">
                    <path class="circle-bg"
                    d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path class="circle"
                    stroke-dasharray="0, 100"
                    d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <text x="18" y="20.35" class="percentage">0%</text>
                </svg>
            </div>

            <div class="bin-footer">
                <div class="footer-row">
                    <span class="footer-label">آخر ما تم رميه:</span>
                    <span class="footer-value last-item-val">${data.lastItem || 'غير متوفر'}</span>
                </div>
                <div class="footer-row">
                    <span class="footer-label">مكافآت المواطنين:</span>
                    <span class="footer-value total-points-val points-badge">${data.totalPoints || 0} دج</span>
                </div>
                <div class="footer-row">
                    <span class="footer-label">آخر تحديث:</span>
                    <span class="footer-value time-val">${new Date(data.timestamp).toLocaleTimeString('ar-DZ')}</span>
                </div>
            </div>
        `;
        binsContainer.appendChild(card);
        renderedBins.add(data.binId);
    }

    // Update existing card data
    const circle = card.querySelector('.circle');
    const percentageText = card.querySelector('.percentage');
    const svg = card.querySelector('.circular-chart');
    const lastItemEl = card.querySelector('.last-item-val');
    const pointsEl = card.querySelector('.total-points-val');
    const timeEl = card.querySelector('.time-val');
    const statusDot = card.querySelector('.status-dot');

    // Update fill level
    const fillLevel = data.fillLevel;
    circle.setAttribute('stroke-dasharray', `${fillLevel}, 100`);
    percentageText.textContent = `${fillLevel}%`;

    // Update color based on fill level
    svg.classList.remove('state-good', 'state-warning', 'state-full');
    if (fillLevel >= 90) {
        svg.classList.add('state-full');
        statusDot.style.backgroundColor = 'var(--danger)';
    } else if (fillLevel >= 60) {
        svg.classList.add('state-warning');
        statusDot.style.backgroundColor = 'var(--warning)';
    } else {
        svg.classList.add('state-good');
        statusDot.style.backgroundColor = 'var(--primary)';
    }

    // Update footer info
    lastItemEl.textContent = data.lastItem;
    pointsEl.textContent = `${data.totalPoints} دج`;
    timeEl.textContent = new Date(data.timestamp).toLocaleTimeString('ar-DZ');
    
    // Store data attribute for global points calculation
    card.dataset.points = data.totalPoints;

    // Flash the status dot to show activity
    statusDot.classList.add('animating');
    setTimeout(() => {
        statusDot.classList.remove('animating');
    }, 1000);
}

function updateGlobalPoints() {
    let total = 0;
    const cards = document.querySelectorAll('.bin-card');
    cards.forEach(card => {
        if(card.dataset.points) {
            total += parseInt(card.dataset.points);
        }
    });
    globalPointsEl.textContent = `${total} دج`;
}

// Toast notification system
function showToast(message) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-bell"></i> <span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    // Remove toast element after animation completes (4.3s)
    setTimeout(() => {
        toast.remove();
    }, 4300);
}

// ----------------------------------------------------
// Interactive Bin Logic
// ----------------------------------------------------
const binContainer = document.getElementById('bin-image-container');
if (binContainer) {
    const intImg = document.getElementById('bin-int');
    const xrayHint = document.getElementById('xray-hint');

    // 3D Tilt and X-Ray Effect on Mouse Move
    binContainer.addEventListener('mousemove', (e) => {
        const rect = binContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 1. X-Ray logic (Magnifying Glass)
        if (intImg) {
            // Remove transition for smooth tracking
            intImg.style.transition = 'none';
            // Show a circle of 150px radius at the mouse position
            intImg.style.clipPath = `circle(150px at ${x}px ${y}px)`;
        }
        
        // Hide hint when interacting
        if (xrayHint) xrayHint.style.opacity = '0';

        // 2. 3D Tilt Logic
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -15;
        const rotateY = ((x - centerX) / centerX) * 15;
        
        binContainer.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
        binContainer.style.zIndex = '10';
        
        const shadowX = -rotateY;
        const shadowY = rotateX;
        binContainer.style.boxShadow = `${shadowX}px ${shadowY}px 30px rgba(16, 185, 129, 0.4)`;
    });

    // Reset transform and X-Ray when mouse leaves
    binContainer.addEventListener('mouseleave', () => {
        if (intImg) {
            intImg.style.transition = 'clip-path 0.5s ease-out';
            intImg.style.clipPath = 'circle(0% at 50% 50%)'; // Hide inside view
        }
        
        if (xrayHint) xrayHint.style.opacity = '1';

        binContainer.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
        binContainer.style.boxShadow = 'none';
        binContainer.style.zIndex = '1';
    });
}

// ----------------------------------------------------
// Interactive Logo Logic
// ----------------------------------------------------
const logo = document.getElementById('main-logo');
if (logo) {
    logo.addEventListener('click', () => {
        // Trigger Confetti Animation
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 250,
                spread: 100,
                origin: { y: 0.3 }, // Shoot from top near the logo
                colors: ['#10b981', '#ffffff', '#065f46']
            });
        }
        
        // Trigger 3D Spin Animation
        logo.classList.remove('clicked-spin');
        void logo.offsetWidth; // trigger reflow
        logo.classList.add('clicked-spin');
    });
}

// ----------------------------------------------------
// Hardware Simulation (For testing without ESP32)
// ----------------------------------------------------
const simulateBtn = document.getElementById('simulate-rfid-btn');
if (simulateBtn) {
    simulateBtn.addEventListener('click', async () => {
        try {
            const randomRFID = Math.random().toString(16).substr(2, 8).toUpperCase();
            const response = await fetch('/api/hardware', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    binId: 'BIN_ANN_001',
                    rfid: randomRFID,
                    wasteType: 'plastic'
                })
            });
            const data = await response.json();
            console.log('Simulated Hardware Event:', data);
        } catch (error) {
            console.error('Simulation error:', error);
            showToast('خطأ: تأكد من تشغيل الخادم Node.js');
        }
    });
}

// ----------------------------------------------------
// Smart City Advanced Analytics (Map, Chart, AI)
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Interactive Map (Leaflet)
    const mapElement = document.getElementById('algiers-map');
    let map;
    let markers = {};
    
    if (mapElement && typeof L !== 'undefined') {
        // Annaba coordinates
        map = L.map('algiers-map').setView([36.9000, 7.7667], 12);
        
        // Add dark-themed tiles (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add dummy markers for bins
        const binLocations = [
            { id: 'BIN_ANN_001', lat: 36.9000, lng: 7.7667, name: 'عنابة - وسط المدينة' },
            { id: 'BIN_ANN_002', lat: 36.8333, lng: 7.7333, name: 'سيدي عمار' },
            { id: 'BIN_ANN_003', lat: 36.8667, lng: 7.7500, name: 'البوني' }
        ];

        // Custom icon for smart bin
        const binIcon = L.divIcon({
            className: 'custom-map-marker',
            html: '<div style="background-color: var(--primary); width: 15px; height: 15px; border-radius: 50%; box-shadow: 0 0 10px var(--primary); border: 2px solid white; transition: background-color 0.3s;"></div>',
            iconSize: [15, 15]
        });

        binLocations.forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng], {icon: binIcon}).addTo(map);
            marker.bindPopup(`<b>${loc.name}</b><br>حاوية ذكية رقم: ${loc.id}`);
            markers[loc.id] = marker;
        });

        // Expose markers globally to update them when bin fills up
        window.updateMapMarker = (binId, percent) => {
            if (markers[binId]) {
                const color = percent > 85 ? 'var(--danger)' : (percent > 60 ? 'var(--warning)' : 'var(--primary)');
                const iconHtml = `<div style="background-color: ${color}; width: 15px; height: 15px; border-radius: 50%; box-shadow: 0 0 15px ${color}; border: 2px solid white; transition: all 0.5s;"></div>`;
                markers[binId].setIcon(L.divIcon({ className: 'custom-map-marker', html: iconHtml, iconSize: [15, 15] }));
            }
        };
    }

    // 2. Initialize Analytics Chart (Chart.js)
    const chartElement = document.getElementById('plasticChart');
    if (chartElement && typeof Chart !== 'undefined') {
        const ctx = chartElement.getContext('2d');
        
        // Gradient for chart
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.6)'); // Green
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
                datasets: [{
                    label: 'كمية البلاستيك المجمعة (قارورة)',
                    data: [120, 190, 150, 220, 180, 250, 310],
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4, // Smooth curve
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8', font: { family: 'Cairo' } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Cairo' } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Cairo' } },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // 3. Fake AI Prediction Logic
    const aiText = document.getElementById('ai-prediction-text');
    if (aiText) {
        aiText.style.transition = 'opacity 0.5s ease';
        const predictions = [
            "تنبؤ استباقي: الحاوية في (سيدي عمار) ستمتلئ خلال 3 ساعات بناءً على الكثافة الطلابية الحالية. 🚀",
            "تحليل البيانات: ارتفاع بنسبة 25% في جمع البلاستيك اليوم مقارنة بيوم الخميس الماضي. 📈",
            "توجيه خوارزمي: ينصح بتوجيه شاحنة الجمع إلى مسار (البوني -> عنابة وسط) الليلة لتوفير الوقود. 🗺️",
            "نظام الطقس: الطقس سيكون ممطراً غداً، نتوقع انخفاضاً بنسبة 10% في عمليات الرمي. 🌧️"
        ];
        
        let predIndex = 0;
        setInterval(() => {
            aiText.style.opacity = 0;
            setTimeout(() => {
                aiText.innerHTML = `<strong style="color: #ecfdf5;">${predictions[predIndex]}</strong> <span style="color: #10b981; font-size: 0.8rem; margin-right: 10px;"><i class="fa-solid fa-check-circle"></i> تم التحليل (AI)</span>`;
                aiText.style.opacity = 1;
                predIndex = (predIndex + 1) % predictions.length;
            }, 500); // match transition duration
        }, 8000); // Change every 8 seconds
    }
});

// ----------------------------------------------------
// Truck Simulation Logic (Self-contained)
// ----------------------------------------------------
function triggerTruckAnimation(binId, binLocation) {
    // Inject CSS if it doesn't exist
    if (!document.getElementById('dynamic-truck-css')) {
        const style = document.createElement('style');
        style.id = 'dynamic-truck-css';
        style.innerHTML = `
        #truck-simulation-container {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 200px;
            background: linear-gradient(to top, #1e293b, rgba(30,41,59,0.9));
            border-top: 4px solid #10b981; z-index: 99999;
            transform: translateY(100%); transition: transform 0.5s ease-out;
            display: flex; align-items: flex-end; overflow: hidden;
            box-shadow: 0 -10px 40px rgba(0,0,0,0.8);
        }
        #truck-simulation-container.truck-simulation-active { transform: translateY(0); }
        .truck-road { position: absolute; bottom: 0; width: 100%; height: 50px; background: #334155; border-top: 2px solid #475569; }
        .road-lines {
            position: absolute; top: 50%; width: 200%; height: 4px;
            background: repeating-linear-gradient(90deg, transparent, transparent 20px, #cbd5e1 20px, #cbd5e1 60px);
            transform: translateY(-50%); animation: moveRoad 1s linear infinite;
        }
        @keyframes moveRoad { from { transform: translateY(-50%) translateX(0); } to { transform: translateY(-50%) translateX(80px); } }
        .truck-vehicle {
            position: absolute; bottom: 40px; right: -300px; z-index: 2002;
            transition: right 3s ease-out, transform 0.5s;
        }
        .truck-flasher {
            position: absolute; top: 10px; left: 20px; width: 15px; height: 15px;
            background-color: #f59e0b; border-radius: 50%; box-shadow: 0 0 20px #f59e0b;
            animation: flashLight 0.3s infinite alternate;
        }
        @keyframes flashLight { from { opacity: 0.2; } to { opacity: 1; box-shadow: 0 0 30px 15px #f59e0b; } }
        .truck-target-bin {
            position: absolute; bottom: 50px; left: -150px; z-index: 2001; text-align: center;
            transition: left 3s ease-out, opacity 0.5s;
        }
        .truck-overlay-text { position: absolute; top: 20px; left: 20px; color: white; z-index: 2003; text-shadow: 1px 1px 3px black; }
        .truck-overlay-text h3 { color: #10b981; margin-bottom: 5px; font-size: 1.5rem; }
        `;
        document.head.appendChild(style);
    }

    // Inject HTML if it doesn't exist
    let container = document.getElementById('truck-simulation-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'truck-simulation-container';
        container.innerHTML = `
            <div class="truck-road"><div class="road-lines" id="road-lines"></div></div>
            <div id="truck-vehicle" class="truck-vehicle">
                <img src="https://cdn-icons-png.flaticon.com/512/3063/3063822.png" alt="شاحنة النظافة" style="width: 200px; transform: scaleX(-1); filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5));">
                <div class="truck-flasher"></div>
            </div>
            <div id="truck-target-bin" class="truck-target-bin">
                <i class="fa-solid fa-trash-can" style="font-size: 4rem; color: #10b981;"></i>
                <div id="truck-bin-name" style="color: white; font-size: 1rem; background: #10b981; padding: 4px 10px; border-radius: 8px; margin-top: 5px; font-weight: bold;">حاوية</div>
            </div>
            <div class="truck-overlay-text">
                <h3><i class="fa-solid fa-truck-fast"></i> شاحنة النظافة - بلدية عنابة</h3>
                <p id="truck-status-text">جاري التوجه لتفريغ الحاوية...</p>
            </div>
        `;
        document.body.appendChild(container);
    }

    const truck = document.getElementById('truck-vehicle');
    const bin = document.getElementById('truck-target-bin');
    const road = document.getElementById('road-lines');
    const binName = document.getElementById('truck-bin-name');
    const statusText = document.getElementById('truck-status-text');

    // Reset positions
    truck.style.right = '-300px';
    truck.style.transform = 'none';
    bin.style.left = '-150px';
    bin.style.opacity = '1';
    road.style.animationPlayState = 'running';
    
    binName.textContent = binLocation;
    statusText.textContent = 'جاري التوجه لتفريغ الحاوية...';

    // Show container (Pop up from bottom)
    setTimeout(() => {
        container.classList.add('truck-simulation-active');
    }, 100);

    // 1. Truck & Bin slide in
    setTimeout(() => {
        truck.style.right = '50%';
        truck.style.transform = 'translateX(50%)';
        bin.style.left = 'calc(50% + 150px)';
    }, 500);

    // 2. Stop and empty
    setTimeout(() => {
        road.style.animationPlayState = 'paused'; // Stop road
        statusText.textContent = 'يتم الآن تفريغ الحاوية...';
        // Shake truck slightly
        let shakes = 0;
        const shakeInterval = setInterval(() => {
            truck.style.transform = shakes % 2 === 0 ? 'translateX(50%) translateY(-5px) rotate(-2deg)' : 'translateX(50%) translateY(0) rotate(0deg)';
            shakes++;
            if(shakes > 5) {
                clearInterval(shakeInterval);
                truck.style.transform = 'translateX(50%)';
            }
        }, 300);
    }, 3500);

    // 3. Drive away
    setTimeout(() => {
        road.style.animationPlayState = 'running';
        statusText.textContent = 'تم التفريغ بنجاح! مغادرة الموقع...';
        truck.style.right = '120%'; // Drive off left
        bin.style.opacity = '0'; // Hide bin
    }, 5500);

    // 4. Hide container
    setTimeout(() => {
        container.classList.remove('truck-simulation-active');
    }, 8500);
}


