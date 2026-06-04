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

// Listen for real-time updates from any bin
socket.on('dashboard_update', (binData) => {
    console.log('Update received:', binData);
    if(loadingMsg) loadingMsg.style.display = 'none';

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
    let showingInternal = false;
    binContainer.addEventListener('click', () => {
        showingInternal = !showingInternal;
        const extImg = document.getElementById('bin-ext');
        const intImg = document.getElementById('bin-int');
        if(extImg && intImg) {
            extImg.style.opacity = showingInternal ? '0' : '1';
            intImg.style.opacity = showingInternal ? '1' : '0';
        }
        
        const hint = binContainer.querySelector('.click-hint');
        if(hint) {
            if(showingInternal) {
                hint.innerHTML = '<i class="fa-solid fa-cube"></i> اضغط للعودة للشكل الخارجي';
                hint.style.background = 'rgba(239, 68, 68, 0.9)'; // Redish when open
            } else {
                hint.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> اضغط لرؤية المكونات الداخلية';
                hint.style.background = 'rgba(16, 185, 129, 0.9)'; // Greenish when closed
            }
        }
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
                    binId: 'BIN_ALG_001',
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

