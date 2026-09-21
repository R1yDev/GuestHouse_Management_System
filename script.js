
//  GUESTHOUSE MANAGEMENT SYSTEM

//    1. DATA            the houses, prices, and sample bookings
//    2. STATE           variables that change while the app runs
//    3. HELPERS         small utility functions (dates, money, ...)
//    4. STORAGE         save / load bookings in the browser
//    5. EXPORT/IMPORT   backup and restore bookings as a .json file
//    6. AVAILABILITY    find a free house for a date range
//    7. UI PARTS        toast messages and modal popups
//    8. RENDERING       drawing the stats, calendar, schedule and table
//    9. ACTIONS         form submit, edit, delete, filters, ...
//   10. STARTUP         the code that runs when the page loads


/* 
   1. DATA — the guesthouse itself (this never changes)
   */

// The 6 houses, grouped by type. "id" is used in code, "label" is shown to users.
const HOUSES = [
    { id: 's1-a', type: 'S+1', label: 'S+1 — House A' },
    { id: 's1-b', type: 'S+1', label: 'S+1 — House B' },
    { id: 's2-a', type: 'S+2', label: 'S+2 — House A' },
    { id: 's2-b', type: 'S+2', label: 'S+2 — House B' },
    { id: 's2-c', type: 'S+2', label: 'S+2 — House C' },
    { id: 's3-a', type: 'S+3', label: 'S+3 — House' },
];

// Nightly price for each house type (in MAD)
const HOUSE_PRICES = { 'S+1': 100, 'S+2': 140, 'S+3': 150 };

// Price of one night for a house type (0 if the type is unknown)
function getNightlyPrice(type) {
    return HOUSE_PRICES[type] || 0;
}

// Total price of a booking = number of nights x nightly price.
// Boat-only trips and open-ended stays have no total.
function getStayTotal(booking) {
    if (isBoatOnly(booking) || !booking.checkOut) return 0;
    const house = getHouse(booking.houseId);
    const type = house ? house.type : 'S+1';
    return daysBetween(booking.checkIn, booking.checkOut) * getNightlyPrice(type);
}

// Sample bookings used ONLY the very first time the app runs.
// After that, bookings are loaded from the browser's local storage.
const DEFAULT_BOOKINGS = [
    { id:1, name:'Hassan Bellal', phone:'+216 20 123 456', houseId:'s1-a', checkIn:'2025-08-03', checkOut:'2025-08-06', service:'stay', advance:1500, notes:'Famille de 4 personnes' },
    { id:2, name:'Claire Martin', phone:'+216 21 456 789', houseId:'s1-b', checkIn:'2025-08-03', checkOut:'2025-08-06', service:'stay', advance:0, notes:'Couple en vacances' },
    { id:3, name:'Youssef Arabi', phone:'+216 52 987 654', houseId:'s1-a', checkIn:'2025-08-06', checkOut:'2025-08-09', service:'stay+boat', advance:2000, notes:'Rendez-vous après le départ de Hassan' },
    { id:4, name:'Amélie Dubois', phone:'+216 50 214 365', houseId:'s2-a', checkIn:'2025-08-01', checkOut:'2025-08-05', service:'stay', advance:800, notes:'' },
    { id:5, name:'Nicolas Leroy', phone:'+216 22 345 678', houseId:'s2-b', checkIn:'2025-08-05', checkOut:'2025-08-10', service:'stay+boat', advance:3000, notes:'Sortie en bateau le 7 août' },
    { id:6, name:'Sofia Morel', phone:'+216 29 554 332', houseId:'s3-a', checkIn:'2025-08-02', checkOut:'2025-08-08', service:'stay', advance:0, notes:'Groupe de 8 personnes' },
    { id:7, name:'Leila Bernard', phone:'+216 98 776 655', houseId:'s2-a', checkIn:'2025-08-08', checkOut:'2025-08-12', service:'stay', advance:1000, notes:'Client régulier' },
    { id:8, name:'Karim Nefzi', phone:'+216 24 681 234', houseId:'s2-a', checkIn:'2025-08-04', checkOut:null, service:'boat', advance:500, notes:'Sortie bateau seulement — départ 15h' },
    { id:9, name:'Célia Dumas', phone:'+216 55 478 912', houseId:'s1-b', checkIn:'2025-08-10', checkOut:null, service:'boat', advance:500, notes:'Sortie bateau seulement — matin' },
];


/*
   2. STATE — variables that change while the app runs
  */

let bookings = [];                    // all bookings (kept in memory + local storage)
let nextId = 20;                      // the id the next new booking will get
let viewStart = '2026-08-01';         // first date currently shown on the calendar
const VIEW_DAYS = 35;                 // how many day-columns the calendar shows
let filterType = 'all';               // calendar filter: 'all', 'S+1', 'S+2' or 'S+3'
let editingId = null;                 // id of the booking being edited (null = adding a new one)
let bookingsServiceFilter = 'all';    // table filter: 'all', 'stay', 'boat' or 'stay+boat'


/*
   3. HELPERS — small utility functions used everywhere
   */

// ---------- date helpers ----------

// Today's date as 'YYYY-MM-DD'
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

// The date that is 'n' days after 'dateStr'
// ('YYYY-MM-DD' in -> 'YYYY-MM-DD' out)
function addDays(dateStr, n) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + n);
    return date.toISOString().split('T')[0];
}

// How many days between date A and date B
function daysBetween(dateStrA, dateStrB) {
    const msPerDay = 86400000;
    const diffMs = new Date(dateStrB + 'T00:00:00') - new Date(dateStrA + 'T00:00:00');
    return Math.round(diffMs / msPerDay);
}

// Short date like "5 Aug", or '—' when there is no date
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Long date like "Sat, 5 Aug 2026", or '—' when there is no date
function formatDateFull(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Is this date a weekend? (Friday = 5 or Sunday = 0)
function isWeekend(dateStr) {
    const day = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    return day === 0 || day === 5;
}

// ---------- house helpers ----------

// Find a house by its id (e.g. 's2-a'), or undefined if not found
function getHouse(id) {
    return HOUSES.find(house => house.id === id);
}

// CSS class that colors a house type on the calendar
function typeColorClass(type) {
    if (type === 'S+1') return 'type-s1';
    if (type === 'S+2') return 'type-s2';
    return 'type-s3';
}

// Text color variable for a house type
function typeColor(type) {
    if (type === 'S+1') return 'var(--s1)';
    if (type === 'S+2') return 'var(--s2)';
    return 'var(--s3)';
}

// Background color variable for a house type
function typeBg(type) {
    if (type === 'S+1') return 'var(--s1-bg)';
    if (type === 'S+2') return 'var(--s2-bg)';
    return 'var(--s3-bg)';
}

// ---------- other helpers ----------

// Current time as "HH:MM"
function nowTimeStr() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Current date + time as "5 Aug 2026, 14:30" (used for save timestamps)
function nowDateTimeStr() {
    return new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// A number formatted with thousands separators: 1500 -> "1,500"
function formatMoney(value) {
    const number = parseFloat(value) || 0;
    return number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---------- booking helpers ----------

// Is this booking a boat trip only? (boat trips never occupy a house)
function isBoatOnly(booking) {
    return booking.service === 'boat';
}

// The booking occupying this house on this date (null if the house is free).
// A stay runs from checkIn (included) to checkOut (NOT included),
// so back-to-back guests don't overlap.
function getStayBookingForCell(houseId, date) {
    return bookings.find(booking =>
        !isBoatOnly(booking) &&
        booking.houseId === houseId &&
        date >= booking.checkIn &&
        date < booking.checkOut
    );
}

// All boat-only trips booked under this house on this date (can be several)
function getBoatOnlyForCell(houseId, date) {
    return bookings.filter(booking =>
        isBoatOnly(booking) &&
        booking.houseId === houseId &&
        booking.checkIn === date
    );
}


/* 
   SERVICE FIELD — show / hide form parts depending on the chosen service
   (called from the HTML whenever the service dropdown changes)
  */

function onServiceChange() {
    const service = document.getElementById('f-service').value;
    const isBoat = service === 'boat';

    const boatHint = document.getElementById('boat-hint');
    const checkoutRow = document.getElementById('checkout-row');
    const houseField = document.getElementById('field-house');
    const restOfForm = document.getElementById('form-rest');
    const checkoutInput = document.getElementById('f-checkout');

    // Reveal the rest of the form once a service type is chosen,
    // hide it again if the user goes back to "no selection"
    if (service) {
        restOfForm.classList.remove('field-hidden');
    } else {
        restOfForm.classList.add('field-hidden');
    }

    if (isBoat) {
        // Boat-only trip: no check-out date, no house needed
        boatHint.classList.add('visible');
        checkoutRow.classList.add('field-hidden');
        houseField.classList.add('field-hidden');
        checkoutInput.removeAttribute('required');
    } else {
        // Stay or stay+boat: check-out and house are needed
        boatHint.classList.remove('visible');
        checkoutRow.classList.remove('field-hidden');
        houseField.classList.remove('field-hidden');
        checkoutInput.setAttribute('required', '');
    }
}


/* 
   4. STORAGE — keep bookings in the browser's local storage
   (so they survive closing and reopening the page)
   */

// Save the current bookings + next id + timestamp, then refresh the save indicator
function saveToLocal() {
    localStorage.setItem('dhz_bookings', JSON.stringify(bookings));
    localStorage.setItem('dhz_nextId', String(nextId));
    localStorage.setItem('dhz_saved_at', nowDateTimeStr());
    updateSaveIndicator();
}

// Load bookings from local storage.
// Returns true if saved data was found, false otherwise.
function loadFromLocal() {
    const saved = localStorage.getItem('dhz_bookings');
    if (!saved) return false;
    bookings = JSON.parse(saved);
    nextId = parseInt(localStorage.getItem('dhz_nextId')) || 20;
    return true;
}

// Update the little "Saved ..." text and the total bookings counter
function updateSaveIndicator() {
    const savedAt = localStorage.getItem('dhz_saved_at') || '—';
    document.getElementById('save-time').textContent = 'Saved ' + savedAt;
    document.getElementById('last-saved-time').textContent = savedAt;
    document.getElementById('total-bookings-count').textContent = bookings.length;
}


/* 
   5. EXPORT / IMPORT — backup and restore bookings as a .json file
    */

// Download all bookings as a .json file onto the user's computer
function exportToFile() {
    const data = {
        guesthouse: 'Dar Haja Zekia',
        exportedAt: new Date().toISOString(),
        version: 2,
        bookings: bookings,
        nextId: nextId,
    };

    // Build a file in memory and trigger a download of it
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DarHajaZekia_Bookings_${todayStr().replace(/-/g, '')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Remember when we exported, and show it in the page
    localStorage.setItem('dhz_last_export', nowDateTimeStr());
    document.getElementById('last-export-time').textContent = nowDateTimeStr();
    showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Saved to your computer successfully`, 'success');
}

// Open the hidden file picker (the button in the page calls this)
function triggerImport() {
    document.getElementById('import-file-input').click();
}

// Called when the user picks a file in the import picker
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Only .json files are accepted
    if (!file.name.endsWith('.json')) {
        showToast('Please select a .json file', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Basic validation: must have a bookings array, each with a name + checkIn
            if (!data.bookings || !Array.isArray(data.bookings)) throw new Error('Invalid format');
            for (const booking of data.bookings) {
                if (!booking.name || !booking.checkIn) throw new Error('Missing fields in: ' + (booking.name || '?'));
            }

            // Remember the file data and ask the user: replace or merge?
            window._pendingImport = data;
            showModal(`<div class="text-center py-2">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style="background:var(--accent-bg)"><i class="fa-solid fa-file-import text-2xl" style="color:var(--accent)"></i></div>
                <h3 class="font-display text-xl font-semibold mb-2" style="color:var(--fg)">Import Bookings?</h3>
                <p class="text-sm mb-1" style="color:var(--muted)">File: <strong style="color:var(--fg)">${file.name}</strong></p>
                <p class="text-sm mb-6" style="color:var(--muted)">Contains <strong style="color:var(--accent)">${data.bookings.length} booking${data.bookings.length !== 1 ? 's' : ''}</strong></p>
                <div class="p-4 rounded-xl mb-6 text-left" style="background:var(--warning-bg);border:1px solid rgba(243,156,18,0.2)">
                    <p class="text-xs font-bold uppercase tracking-wider mb-1" style="color:var(--warning)"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Important</p>
                    <p class="text-sm" style="color:var(--fg-sec)">Choose how to handle your current bookings:</p>
                </div>
                <div class="flex flex-col gap-2">
                    <button class="btn btn-danger w-full justify-center" onclick="doImport('replace')"><i class="fa-solid fa-exchange-alt"></i> Replace All</button>
                    <button class="btn btn-success w-full justify-center" onclick="doImport('merge')"><i class="fa-solid fa-code-merge"></i> Merge</button>
                    <button class="btn btn-ghost w-full justify-center" onclick="hideModal()">Cancel</button>
                </div>
            </div>`);
        } catch (err) {
            showToast(`Invalid file: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Actually apply the import after the user chose Replace or Merge
function doImport(mode) {
    const data = window._pendingImport;
    if (!data) return;

    if (mode === 'replace') {
        // Throw away current bookings and use the file's instead
        bookings = data.bookings;
        nextId = data.nextId || (Math.max(...bookings.map(b => b.id), 0) + 1);
    } else {
        // Merge: add only bookings that are not exact duplicates,
        // giving them fresh ids so nothing collides
        const maxId = bookings.length ? Math.max(...bookings.map(b => b.id)) : 0;
        let newId = maxId + 1;
        for (const booking of data.bookings) {
            const isDuplicate = bookings.some(existing =>
                existing.name === booking.name &&
                existing.houseId === booking.houseId &&
                existing.checkIn === booking.checkIn &&
                existing.service === booking.service
            );
            if (!isDuplicate) {
                bookings.push({ ...booking, id: newId });
                newId++;
            }
        }
        nextId = newId;
    }

    saveToLocal();
    hideModal();
    render();
    showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Bookings ${mode === 'replace' ? 'replaced' : 'merged'}`, 'success');
    window._pendingImport = null;
}


/* 
   6. AVAILABILITY — find a free house for a date range
   (only stay-type bookings block a house; boat-only trips never do)
*/

// Find the first free house of a type for checkIn -> checkOut.
// Returns the house object, or null if every house of that type is taken.
// 'excludeId' is used when editing: ignore the booking being edited.
function findAvailableHouse(type, checkIn, checkOut, excludeId) {
    const housesOfType = HOUSES.filter(house => house.type === type);
    for (const house of housesOfType) {
        const conflict = bookings.find(booking =>
            !isBoatOnly(booking) &&
            booking.id !== excludeId &&
            booking.houseId === house.id &&
            booking.checkIn < checkOut &&   // existing booking starts before our stay ends...
            booking.checkOut > checkIn      // ...and ends after our stay starts = overlap
        );
        if (!conflict) return house; // no overlap -> this house is free
    }
    return null;
}

// If the requested dates are full, find the next date (within 60 days)
// where a house of this type is free for 'nights' nights.
// Returns { house, checkIn, checkOut } or null if nothing is found.
function findNextAvailable(type, fromDate, nights) {
    let candidateStart = fromDate;
    for (let i = 0; i < 60; i++) {
        const candidateEnd = addDays(candidateStart, nights);
        const house = findAvailableHouse(type, candidateStart, candidateEnd, null);
        if (house) return { house: house, checkIn: candidateStart, checkOut: candidateEnd };
        candidateStart = addDays(candidateStart, 1); // try one day later
    }
    return null;
}

// Status of EVERY house of a type for a date range (used in the
// "no availability" popup). Returns one entry per house:
//   { house, available, conflictingBooking }
function getAvailabilitySummary(type, checkIn, checkOut, excludeId) {
    const housesOfType = HOUSES.filter(house => house.type === type);
    return housesOfType.map(house => {
        const conflictingBooking = bookings.find(booking =>
            !isBoatOnly(booking) &&
            booking.id !== excludeId &&
            booking.houseId === house.id &&
            booking.checkIn < checkOut &&
            booking.checkOut > checkIn
        );
        return {
            house: house,
            available: !conflictingBooking,
            conflictingBooking: conflictingBooking,
        };
    });
}


 
 //7. UI PARTS — toast messages and modal popups
    

// Show a small auto-dismissing message at the edge of the screen.
// type can be: 'info', 'success', 'warning' or 'error'
function showToast(message, type = 'info') {
    const container = document.getElementById('toasts');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);

    // Fade out after 3.5 seconds, then remove from the page
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Open the modal popup with the given HTML inside it
function showModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal').classList.add('show');
}

// Close the modal popup
function hideModal() {
    document.getElementById('modal').classList.remove('show');
}


/*
   8. RENDERING — draw each part of the page from the bookings data
  */

// ---------- the 5 stat cards at the top ----------

function renderStats() {
    const today = todayStr();

    const stayingTonight = bookings.filter(b => !isBoatOnly(b) && b.checkIn <= today && b.checkOut > today);
    const checkInsToday  = bookings.filter(b => !isBoatOnly(b) && b.checkIn === today);
    const checkOutsToday = bookings.filter(b => !isBoatOnly(b) && b.checkOut === today);
    const boatTripsSoon  = bookings.filter(b => b.service.includes('boat') && b.checkIn >= today && b.checkIn <= addDays(today, 7));
    const totalAdvance   = bookings.reduce((sum, b) => sum + (parseFloat(b.advance) || 0), 0);

    const stats = [
        { label: 'Occupied Tonight', value: stayingTonight.length, color: 'var(--accent)',  icon: 'fa-solid fa-bed' },
        { label: 'Check-ins Today',  value: checkInsToday.length,  color: 'var(--avail)',   icon: 'fa-solid fa-arrow-right-to-bracket' },
        { label: 'Check-outs Today', value: checkOutsToday.length, color: 'var(--warning)', icon: 'fa-solid fa-arrow-right-from-bracket' },
        { label: 'Boat Trips (7d)',  value: boatTripsSoon.length,  color: 'var(--boat)',    icon: 'fa-solid fa-ship' },
        { label: 'Total Advance',    value: `${formatMoney(totalAdvance)}`, color: 'var(--avail)', icon: 'fa-solid fa-wallet' },
    ];

    document.getElementById('stats-row').innerHTML = stats.map(s =>
        `<div class="stat-card"><div class="flex items-center justify-between mb-2"><p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style="color:var(--muted)">${s.label}</p><i class="${s.icon} text-sm" style="color:${s.color};opacity:0.5"></i></div><p class="text-xl sm:text-2xl font-bold" style="color:${s.color}">${s.value}</p></div>`
    ).join('');
}

// ---------- the big calendar grid ----------

function renderCalendar() {
    const today = todayStr();

    // Show all houses, or only houses of the filtered type
    const housesToShow = filterType === 'all'
        ? HOUSES
        : HOUSES.filter(house => house.type === filterType);

    const grid = document.getElementById('calendar-grid');
    grid.style.gridTemplateColumns = `140px repeat(${VIEW_DAYS}, 44px)`;

    // Empty sticky corner cell above the house names
    let html = `<div class="sticky-left-header" style="min-width:140px;height:52px;border-bottom:2px solid var(--border);border-right:2px solid var(--border)"></div>`;

    // One header cell per visible day
    for (let i = 0; i < VIEW_DAYS; i++) {
        const date = addDays(viewStart, i);
        const dateObj = new Date(date + 'T00:00:00');
        const dayNumber = dateObj.getDate();
        const weekdayName = dateObj.toLocaleDateString('en', { weekday: 'short' });
        const weekendClass = isWeekend(date) ? 'weekend' : '';
        const todayClass = date === today ? 'today-col' : '';
        // Show a small month tag on the 1st of each month
        const monthName = dayNumber === 1 ? dateObj.toLocaleDateString('en', { month: 'short' }) : '';

        html += `<div class="cal-header ${weekendClass} ${todayClass}">${monthName ? `<span class="month-tag">${monthName}</span>` : ''}<span class="day-name">${weekdayName}</span><span class="day-num">${dayNumber}</span></div>`;
    }

    // One row per house: name cell + one cell per visible day
    for (const house of housesToShow) {
        const typeClass = typeColorClass(house.type);
        const houseName = house.label.split('—')[1]?.trim() || '';
        html += `<div class="house-label sticky-left ${typeClass}" style="border-bottom:1px solid var(--border-light)"><span class="type-badge">${house.type}</span><span class="house-sub">${houseName}</span></div>`;

        for (let i = 0; i < VIEW_DAYS; i++) {
            const date = addDays(viewStart, i);
            const stayBooking = getStayBookingForCell(house.id, date);
            const boatBookings = getBoatOnlyForCell(house.id, date);
            const todayClass = date === today ? 'today-col' : '';
            const weekendClass = isWeekend(date) ? 'weekend' : '';

            if (stayBooking) {
                // --- occupied cell: paint first/middle/last night of the stay ---
                const isFirstNight = date === stayBooking.checkIn;
                const isLastNight = date === addDays(stayBooking.checkOut, -1);
                const isSingleNight = stayBooking.checkIn === addDays(stayBooking.checkOut, -1);

                let cellClass;
                if (isSingleNight || (isFirstNight && isLastNight)) cellClass = 'cell-single';
                else if (isFirstNight) cellClass = 'cell-first';
                else if (isLastNight) cellClass = 'cell-last';
                else cellClass = 'cell-mid';

                const showName = isFirstNight || isSingleNight;
                const hasBoat = stayBooking.service.includes('boat');
                const firstName = stayBooking.name.split(' ')[0];

                html += `<div class="cal-cell booked ${typeClass} ${cellClass} ${todayClass}" title="${stayBooking.name}\n${formatDate(stayBooking.checkIn)} → ${formatDate(stayBooking.checkOut)} (${daysBetween(stayBooking.checkIn, stayBooking.checkOut)} nights)\n${stayBooking.service}${hasBoat ? ' — Boat' : ''}\nAdvance: ${formatMoney(stayBooking.advance)} MAD\n${stayBooking.notes || ''}" onclick="showBookingDetail(${stayBooking.id})">${showName ? `<span class="cell-label">${firstName}${hasBoat ? ' <i class="fa-solid fa-ship" style="font-size:7px"></i>' : ''}</span>` : ''}</div>`;
            } else if (boatBookings.length > 0) {
                // --- boat-only trip cell ---
                const booking = boatBookings[0];
                html += `<div class="cal-cell boat-only cell-single ${todayClass}" title="${booking.name} — Boat Trip Only\nDate: ${formatDate(booking.checkIn)}\nAdvance: ${formatMoney(booking.advance)} MAD\n${booking.notes || ''}" onclick="showBookingDetail(${booking.id})"><i class="fa-solid fa-ship" style="font-size:10px"></i></div>`;
            } else {
                // --- free cell: click to start a new booking here ---
                html += `<div class="cal-cell available ${weekendClass} ${todayClass}" title="Available — Click to book" onclick="quickBook('${house.id}','${date}')"></div>`;
            }
        }
    }

    grid.innerHTML = html;

    // Label above the calendar showing the visible month(s)
    const viewStartDate = new Date(viewStart + 'T00:00:00');
    const viewEndDate = new Date(addDays(viewStart, VIEW_DAYS - 1) + 'T00:00:00');
    document.getElementById('view-label').textContent =
        viewStartDate.getMonth() === viewEndDate.getMonth()
            ? viewStartDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })
            : `${viewStartDate.toLocaleDateString('en', { month: 'short' })} — ${viewEndDate.toLocaleDateString('en', { month: 'short', year: 'numeric' })}`;

    // If today is visible, scroll the calendar so today is in view
    if (today >= viewStart && today < addDays(viewStart, VIEW_DAYS)) {
        const todayIndex = daysBetween(viewStart, today);
        const scroller = document.getElementById('calendar-scroll');
        setTimeout(() => scroller.scrollTo({
            left: Math.max(0, 140 + todayIndex * 46 - scroller.clientWidth / 3),
            behavior: 'smooth',
        }), 100);
    }
}

// ---------- the "Today" panel: arrivals, departures, staying, boats ----------

function renderTodaySchedule() {
    const today = todayStr();

    const arrivals       = bookings.filter(b => !isBoatOnly(b) && b.checkIn === today);
    const departures     = bookings.filter(b => !isBoatOnly(b) && b.checkOut === today);
    const stayingGuests  = bookings.filter(b => !isBoatOnly(b) && b.checkIn < today && b.checkOut > today);
    const boatTripsToday = bookings.filter(b => b.service.includes('boat') && b.checkIn === today);

    let html = '';

    // Nothing at all today
    if (!arrivals.length && !departures.length && !stayingGuests.length && !boatTripsToday.length) {
        html = `<div class="text-center py-6"><i class="fa-regular fa-calendar-check text-2xl mb-2" style="color:var(--border)"></i><p class="text-sm" style="color:var(--muted)">No activity today.</p></div>`;
    } else {
        if (arrivals.length) {
            html += `<p class="text-xs font-bold uppercase tracking-wider mb-2" style="color:var(--avail)"><i class="fa-solid fa-arrow-right-to-bracket mr-1"></i> Arrivals</p>`;
            arrivals.forEach(b => {
                const house = getHouse(b.houseId);
                html += `<div class="schedule-item" style="border-left-color:var(--avail)"><div><p class="text-sm font-semibold" style="color:var(--fg)">${b.name}</p><p class="text-xs" style="color:var(--muted)">${house.label} · ${daysBetween(b.checkIn, b.checkOut)} nights${b.advance ? ` · <span style="color:var(--avail);font-weight:600">${formatMoney(b.advance)} MAD</span>` : ''}</p></div></div>`;
            });
        }
        if (departures.length) {
            html += `<p class="text-xs font-bold uppercase tracking-wider mb-2 mt-4" style="color:var(--warning)"><i class="fa-solid fa-arrow-right-from-bracket mr-1"></i> Departures</p>`;
            departures.forEach(b => {
                const house = getHouse(b.houseId);
                html += `<div class="schedule-item" style="border-left-color:var(--warning)"><div><p class="text-sm font-semibold" style="color:var(--fg)">${b.name}</p><p class="text-xs" style="color:var(--muted)">${house.label}${b.advance ? ` · Paid: <span style="color:var(--avail);font-weight:600">${formatMoney(b.advance)} MAD</span>` : ''}</p></div></div>`;
            });
        }
        if (stayingGuests.length) {
            html += `<p class="text-xs font-bold uppercase tracking-wider mb-2 mt-4" style="color:var(--accent)"><i class="fa-solid fa-bed mr-1"></i> Staying</p>`;
            stayingGuests.forEach(b => {
                const house = getHouse(b.houseId);
                const nightsLeft = daysBetween(today, b.checkOut);
                html += `<div class="schedule-item" style="border-left-color:var(--accent)"><div><p class="text-sm font-semibold" style="color:var(--fg)">${b.name}</p><p class="text-xs" style="color:var(--muted)">${house.label} · ${nightsLeft}n left${b.advance ? ` · <span style="color:var(--avail);font-weight:600">${formatMoney(b.advance)} MAD</span>` : ''}</p></div></div>`;
            });
        }
        if (boatTripsToday.length) {
            html += `<p class="text-xs font-bold uppercase tracking-wider mb-2 mt-4" style="color:var(--boat)"><i class="fa-solid fa-ship mr-1"></i> Boat Trips Today</p>`;
            boatTripsToday.forEach(b => {
                html += `<div class="schedule-item" style="border-left-color:var(--boat)"><i class="fa-solid fa-ship text-xs" style="color:var(--boat)"></i><div><p class="text-sm font-semibold" style="color:var(--fg)">${b.name}</p><p class="text-xs" style="color:var(--muted)">Boat trip${b.advance ? ` · <span style="color:var(--avail);font-weight:600">${formatMoney(b.advance)} MAD</span>` : ''}</p></div></div>`;
            });
        }
    }
    document.getElementById('today-schedule').innerHTML = html;

    // Upcoming boat trips: any time in the next 14 days, sorted by date
    const futureBoats = bookings
        .filter(b => b.service.includes('boat') && b.checkIn > today && b.checkIn <= addDays(today, 14))
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    let boatsHtml = '';
    if (!futureBoats.length) {
        boatsHtml = `<p class="text-sm" style="color:var(--muted)">No upcoming boat trips.</p>`;
    } else {
        futureBoats.forEach(b => {
            const house = getHouse(b.houseId);
            boatsHtml += `<div class="schedule-item" style="border-left-color:var(--boat)"><i class="fa-solid fa-ship text-xs" style="color:var(--boat)"></i><div class="flex-1 min-w-0"><p class="text-sm font-semibold" style="color:var(--fg)">${b.name}</p><p class="text-xs" style="color:var(--muted)">${formatDate(b.checkIn)}${isBoatOnly(b) ? ' (boat only)' : ` · ${house.type}`}${b.advance ? ` · <span style="color:var(--avail);font-weight:600">${formatMoney(b.advance)} MAD</span>` : ''}</p></div><div class="flex items-center gap-1 flex-shrink-0"><button class="btn btn-ghost btn-sm" style="padding:4px 8px;border-color:transparent;color:var(--accent)" onclick="editBooking(${b.id})" title="Edit boat trip"><i class="fa-solid fa-pen text-xs"></i></button><button class="btn btn-ghost btn-sm" style="padding:4px 8px;border-color:transparent;color:var(--danger)" onclick="confirmDelete(${b.id})" title="Clear boat trip"><i class="fa-solid fa-trash text-xs"></i></button></div></div>`;
        });
    }
    document.getElementById('boat-trips').innerHTML = boatsHtml;
}

// ---------- the bookings table (with its service filter buttons) ----------

// Called from the filter buttons above the table
function setBookingsFilter(type) {
    bookingsServiceFilter = type;
    document.querySelectorAll('[data-bfilter]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.bfilter === type)
    );
    renderBookingsTable();
}

function renderBookingsTable() {
    // Apply the service filter, then sort oldest check-in first
    const filtered = bookingsServiceFilter === 'all'
        ? bookings
        : bookings.filter(b => b.service === bookingsServiceFilter);
    const sorted = [...filtered].sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));

    document.getElementById('booking-count').textContent = `${sorted.length} booking${sorted.length !== 1 ? 's' : ''}`;

    let html = '';
    if (!sorted.length) {
        html = `<tr><td colspan="7" class="empty-row">No bookings yet.</td></tr>`;
    } else {
        sorted.forEach(booking => {
            const house = getHouse(booking.houseId);
            const hasBoat = booking.service.includes('boat');
            const isBoat = isBoatOnly(booking);
            const serviceLabel = booking.service === 'stay' ? 'Stay' : booking.service === 'boat' ? 'Boat Trip' : 'Stay + Boat';
            const advance = parseFloat(booking.advance) || 0;
            const isPast = !isBoat && booking.checkOut <= todayStr();

            let dateText, nightsText;
            if (isBoat) {
                dateText = formatDate(booking.checkIn);
                nightsText = '—';
            } else {
                dateText = `${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}`;
                nightsText = daysBetween(booking.checkIn, booking.checkOut);
            }

            let advanceBadge;
            if (advance > 0) {
                advanceBadge = `<span class="advance-badge"><i class="fa-solid fa-coins" style="font-size:9px"></i> ${formatMoney(advance)}</span>`;
            } else {
                advanceBadge = `<span class="advance-badge zero">0</span>`;
            }

            const houseCell = isBoat
                ? '<span class="muted-text">—</span>'
                : `<div class="house-pill" style="background:${typeBg(house.type)}; color:${typeColor(house.type)}"><span class="house-dot" style="background:${typeColor(house.type)}"></span>${house.type}</div><div class="house-subtext">${house.label.split('—')[1]?.trim() || ''}</div>`;

            html += `<tr class="booking-row" style="${isPast ? 'opacity:0.4' : ''}">
                <td class="customer-cell">
                    <div class="customer-name">${booking.name}</div>
                    <div class="customer-phone">${booking.phone}</div>
                </td>
                <td class="table-cell">${houseCell}</td>
                <td class="table-cell service-cell">${serviceLabel}${hasBoat ? ' <i class="fa-solid fa-ship boat-icon"></i>' : ''}</td>
                <td class="table-cell date-cell">${dateText}</td>
                <td class="table-cell nights-cell">${nightsText}</td>
                <td class="table-cell">${advanceBadge}</td>
                <td class="table-cell action-cell">
                    <button class="btn btn-ghost btn-sm" onclick="showBookingDetail(${booking.id})" title="View"><i class="fa-solid fa-eye text-xs"></i></button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:transparent" onclick="editBooking(${booking.id})" title="Edit"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:transparent" onclick="confirmDelete(${booking.id})" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button>
                </td>
            </tr>`;
        });
    }
    document.getElementById('bookings-tbody').innerHTML = html;
}

// ---------- redraw EVERYTHING ----------

function render() {
    renderStats();
    renderCalendar();
    renderTodaySchedule();
    renderBookingsTable();
    document.getElementById('today-display').textContent = formatDateFull(todayStr());
    updateSaveIndicator();
    const lastExport = localStorage.getItem('dhz_last_export');
    document.getElementById('last-export-time').textContent = lastExport || 'Never';
}


/* 
   9. ACTIONS — everything the user can click or submit
 */

// ---------- calendar filter & navigation ----------

// Filter the calendar by house type (called from the filter buttons)
function setFilter(type) {
    filterType = type;
    document.querySelectorAll('.filter-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.filter === type)
    );
    renderCalendar();
}

// Move the calendar view forward/backward by 'days' days
function shiftView(days) {
    viewStart = addDays(viewStart, days);
    renderCalendar();
}

// Jump the calendar so today sits about a third of the way in
function goToToday() {
    viewStart = addDays(todayStr(), -Math.floor(VIEW_DAYS / 3));
    renderCalendar();
}

// Called when clicking an empty calendar cell: pre-fills the booking form
// with that house and date, then scrolls to the form
function quickBook(houseId, date) {
    const house = getHouse(houseId);
    document.getElementById('f-service').value = 'stay';
    onServiceChange();
    document.getElementById('f-type').value = house.type;
    document.getElementById('f-checkin').value = date;
    document.getElementById('f-checkout').value = addDays(date, 1);
    document.getElementById('f-name').focus();
    document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`Selected ${house.label} — ${formatDate(date)}`, 'info');
}

// ---------- editing ----------

// Load a booking into the form so the user can change it
function editBooking(id) {
    hideModal();
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    editingId = id;

    const house = getHouse(booking.houseId);
    document.getElementById('f-name').value = booking.name;
    document.getElementById('f-phone').value = booking.phone;
    document.getElementById('f-service').value = booking.service;
    document.getElementById('f-type').value = house ? house.type : 'S+1';
    document.getElementById('f-checkin').value = booking.checkIn || '';
    document.getElementById('f-checkout').value = booking.checkOut || '';
    document.getElementById('f-advance').value = booking.advance;
    document.getElementById('f-notes').value = booking.notes || '';
    onServiceChange();

    // Switch the form into "edit mode": new title and a green Save button
    document.getElementById('form-section-title').textContent = 'Edit Booking';
    document.getElementById('form-section-title').style.color = 'var(--accent)';
    document.getElementById('form-section-icon').className = 'fa-solid fa-pen';
    const submitBtn = document.querySelector('#booking-form button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-success');

    document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('f-name').focus();
    showToast('Editing booking — make your changes then press Save', 'info');
}

// ---------- adding / saving a booking (the form submit) ----------

function handleBookingSubmit(event) {
    event.preventDefault();

    // Read every field from the form
    const name = document.getElementById('f-name').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const service = document.getElementById('f-service').value;
    const checkIn = document.getElementById('f-checkin').value;
    const notes = document.getElementById('f-notes').value.trim();
    const advance = parseFloat(document.getElementById('f-advance').value) || 0;

    // Required fields
    if (!name || !phone || !checkIn) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    // ===== BOAT TRIP ONLY: no check-out, no house blocking =====
    if (service === 'boat') {
        // Just attach it to the first house of the selected type (cosmetic only)
        const type = document.getElementById('f-type').value;
        const housesOfType = HOUSES.filter(h => h.type === type);
        const houseId = housesOfType.length > 0 ? housesOfType[0].id : 's1-a';

        if (editingId !== null) {
            // Update the existing booking
            const booking = bookings.find(b => b.id === editingId);
            if (booking) Object.assign(booking, { name, phone, houseId, checkIn: checkIn, checkOut: null, service, advance, notes });
            saveToLocal(); render(); resetForm();
            showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Boat trip updated for ${name}`, 'success');
        } else {
            // Add a new booking
            bookings.push({ id: nextId++, name, phone, houseId, checkIn: checkIn, checkOut: null, service, advance, notes });
            saveToLocal(); render(); resetForm();
            showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Boat trip booked for ${name} on ${formatDate(checkIn)}`, 'success');
        }
        return;
    }

    // ===== STAY or STAY+BOAT: check-out required, house must be free =====
    const checkOut = document.getElementById('f-checkout').value;
    if (!checkOut) {
        showToast('Please select check-out date.', 'error');
        return;
    }
    if (checkOut <= checkIn) {
        showToast('Check-out must be after check-in.', 'error');
        return;
    }

    const type = document.getElementById('f-type').value;
    const nights = daysBetween(checkIn, checkOut);

    // Find a free house of the chosen type.
    // When editing, first try to keep the same house if it still works.
    let availableHouse = null;
    if (editingId !== null) {
        const current = bookings.find(b => b.id === editingId);
        const currentHouse = current ? getHouse(current.houseId) : null;
        if (currentHouse && currentHouse.type === type) {
            const conflict = bookings.find(b =>
                !isBoatOnly(b) && b.id !== editingId &&
                b.houseId === currentHouse.id &&
                b.checkIn < checkOut && b.checkOut > checkIn
            );
            if (!conflict) availableHouse = currentHouse;
        }
        if (!availableHouse) {
            availableHouse = findAvailableHouse(type, checkIn, checkOut, editingId);
        }
    } else {
        availableHouse = findAvailableHouse(type, checkIn, checkOut, null);
    }

    if (availableHouse) {
        // We found a house -> save the booking
        if (editingId !== null) {
            const booking = bookings.find(b => b.id === editingId);
            if (booking) Object.assign(booking, { name, phone, houseId: availableHouse.id, checkIn: checkIn, checkOut: checkOut, service, advance, notes });
            saveToLocal(); render(); resetForm();
            showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Booking updated for ${name} → ${availableHouse.label} (${nights} nights)`, 'success');
        } else {
            bookings.push({ id: nextId++, name, phone, houseId: availableHouse.id, checkIn: checkIn, checkOut: checkOut, service, advance, notes });
            saveToLocal(); render(); resetForm();
            showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Booked ${name} → ${availableHouse.label} (${nights} nights)${advance ? ` · ${formatMoney(advance)} MAD advance` : ''}`, 'success');
        }
    } else {
        // Fully booked -> show which houses are taken and suggest the next free dates
        showNoAvailabilityModal(type, checkIn, checkOut, nights, { name, phone, service, advance, notes });
    }
}

// Popup shown when no house of the type is free for the chosen dates
function showNoAvailabilityModal(type, checkIn, checkOut, nights, formData) {
    const summary = getAvailabilitySummary(type, checkIn, checkOut, editingId);
    const suggestion = findNextAvailable(type, checkIn, nights);

    // Status list: one row per house, showing Available or the guest blocking it
    let statusHtml = '<div class="mb-4"><p class="text-xs font-semibold uppercase tracking-wider mb-3" style="color:var(--muted)">House Status</p>';
    summary.forEach(entry => {
        const status = entry.available
            ? `<span style="color:var(--avail)"><i class="fa-solid fa-check-circle"></i> Available</span>`
            : `<span style="color:var(--danger)"><i class="fa-solid fa-times-circle"></i> ${entry.conflictingBooking.name}</span>`;
        statusHtml += `<div class="flex items-center justify-between py-2 px-3 rounded-lg mb-1.5" style="background:var(--bg)"><span class="text-sm font-medium" style="color:var(--fg-sec)">${entry.house.label}</span><span class="text-sm">${status}</span></div>`;
    });
    statusHtml += '</div>';

    // Suggestion box with an "Accept" button, or a "nothing for 60 days" box
    let suggestionHtml;
    if (suggestion) {
        const suggestionNights = daysBetween(suggestion.checkIn, suggestion.checkOut);
        suggestionHtml = `<div class="p-4 rounded-xl mb-5" style="background:var(--avail-bg);border:1px solid rgba(39,174,96,0.25)"><p class="text-xs font-bold uppercase tracking-wider mb-2" style="color:var(--avail)"><i class="fa-solid fa-lightbulb mr-1"></i> Suggested</p><p class="text-base font-semibold mb-1" style="color:var(--fg)">${suggestion.house.label}</p><p class="text-sm" style="color:var(--fg-sec)">${formatDate(suggestion.checkIn)} → ${formatDate(suggestion.checkOut)} (${suggestionNights} nights)</p></div>
            <button class="btn btn-success w-full justify-center" onclick="acceptSuggestion('${formData.name}','${formData.phone}','${type}','${suggestion.house.id}','${suggestion.checkIn}','${suggestion.checkOut}','${formData.service}',${formData.advance},'${formData.notes.replace(/'/g, "\\'")}')"><i class="fa-solid fa-check"></i> Accept Suggestion</button>`;
    } else {
        suggestionHtml = `<div class="p-4 rounded-xl" style="background:var(--danger-bg);border:1px solid rgba(231,76,60,0.2)"><p class="text-sm" style="color:var(--danger)">No availability in next 60 days.</p></div>`;
    }

    showModal(`<div class="flex items-center gap-4 mb-5"><div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:var(--danger-bg)"><i class="fa-solid fa-calendar-xmark text-lg" style="color:var(--danger)"></i></div><div><h3 class="font-display text-lg font-semibold" style="color:var(--fg)">No Availability</h3><p class="text-sm" style="color:var(--muted)">${type} fully booked ${formatDate(checkIn)} → ${formatDate(checkOut)}</p></div></div>${statusHtml}${suggestionHtml}<button class="btn btn-ghost w-full justify-center mt-4" onclick="hideModal()">Cancel</button>`);
}

// Called from the "Accept Suggestion" button in the no-availability popup
function acceptSuggestion(name, phone, type, houseId, checkIn, checkOut, service, advance, notes) {
    if (editingId !== null) {
        const booking = bookings.find(b => b.id === editingId);
        if (booking) Object.assign(booking, { name, phone, houseId, checkIn, checkOut, service, advance, notes });
        saveToLocal(); hideModal(); render(); resetForm();
        const house = getHouse(houseId);
        showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Booking updated → ${house.label}`, 'success');
        return;
    }
    bookings.push({ id: nextId++, name, phone, houseId, checkIn, checkOut, service, advance, notes });
    saveToLocal(); hideModal(); render(); resetForm();
    const house = getHouse(houseId);
    showToast(`<i class="fa-solid fa-check-circle mr-1"></i> Booked ${name} → ${house.label}`, 'success');
}

// ---------- viewing, deleting ----------

// Popup showing the full details of one booking
function showBookingDetail(id) {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return; 

    const house = getHouse(booking.houseId);
    const hasBoat = booking.service.includes('boat');
    const isBoat = isBoatOnly(booking);
    const serviceLabel = booking.service === 'stay' ? 'Stay Only' : booking.service === 'boat' ? 'Boat Trip Only' : 'Stay + Boat Trip';
    const advance = parseFloat(booking.advance) || 0;
    const nights = isBoat ? null : daysBetween(booking.checkIn, booking.checkOut);

    const noteText = booking.notes ? booking.notes : 'No notes added';
    //let boatIcon = " " if(hasBoat == true) { boatIcon = call the boat trip icon } else { boatIcon = empty}
    const detailRows = `
        <table class="detail-table">
            <tbody>
                <tr>
                    <th>House Type</th>
                    <td>${isBoat ? '—' : house.label}</td> 
                </tr>
                <tr>
                    <th>Service</th>
                    <td>${serviceLabel}${hasBoat ? ' <i class="fa-solid fa-ship text-xs" style="color:var(--boat)"></i>' : ''}</td>
                </tr>
                <tr>
                    <th>${isBoat ? 'Trip Date' : 'Check-in'}</th>
                    <td>${formatDateFull(booking.checkIn)}</td>
                </tr>
                ${isBoat ? '' : `
                <tr>
                    <th>Check-out</th>
                    <td>${formatDateFull(booking.checkOut)}</td>
                </tr>
                `}
                ${nights !== null ? `
                <tr>
                    <th>Duration</th>
                    <td>${nights} Night${nights !== 1 ? 's' : ''}</td>
                </tr>
                ` : ''}
                <tr>
                    <th>Advance Paid</th>
                    <td>${advance > 0 ? `${formatMoney(advance)} MAD` : 'Not yet'}</td>
                </tr>
                <tr>
                    <th>Notes</th>
                    <td class="note-cell">${noteText}</td>
                </tr>
            </tbody>
        </table>
    `;

    showModal(`<div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
            <img src="https://z-cdn-media.chatglm.cn/files/4b1a1f58-2971-4127-bab8-1ccf39a2d42c.jpg?auth_key=1885885310-3086784c711840eda3f4adca9bf596dd-0-b1f7d999b6c137017d2094a7dbdcf723" alt="Logo" class="logo-img-sm opacity-50">
            <div><h3 class="font-display text-xl font-semibold" style="color:var(--fg)">${booking.name}</h3><p class="text-sm" style="color:var(--muted)">${booking.phone}</p></div>
        </div>
        <button onclick="hideModal()" class="w-8 h-8 rounded-lg flex items-center justify-center" style="color:var(--muted);cursor:pointer;background:var(--bg);border:none;font-size:14px"><i class="fa-solid fa-xmark"></i></button>
    </div>
    ${detailRows}
    <div class="flex flex-col gap-2">
        <button class="btn btn-success w-full justify-center" onclick="editBooking(${booking.id})"><i class="fa-solid fa-pen"></i> Edit Booking</button>
        <button class="btn btn-danger w-full justify-center" onclick="confirmDelete(${booking.id})"><i class="fa-solid fa-trash"></i> Cancel This Booking</button>
    </div>`);
}

// Popup asking "are you sure?" before deleting a booking
function confirmDelete(id) {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    const dateInfo = isBoatOnly(booking)
        ? formatDate(booking.checkIn)
        : `${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}`;
    showModal(`<div class="text-center py-4">
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style="background:var(--danger-bg)"><i class="fa-solid fa-triangle-exclamation text-2xl" style="color:var(--danger)"></i></div>
        <h3 class="font-display text-xl font-semibold mb-2" style="color:var(--fg)">Cancel Booking?</h3>
        <p class="text-sm mb-7" style="color:var(--muted)">Remove <strong style="color:var(--fg)">${booking.name}</strong><br>${dateInfo}</p>
        <div class="flex gap-3 justify-center"><button class="btn btn-ghost" onclick="hideModal()">Keep</button><button class="btn btn-danger" onclick="deleteBooking(${id})"><i class="fa-solid fa-trash"></i> Delete</button></div>
    </div>`);
}

// Actually remove the booking (called from the delete popup)
function deleteBooking(id) {
    bookings = bookings.filter(b => b.id !== id);
    saveToLocal(); hideModal(); render();
    showToast('<i class="fa-solid fa-trash mr-1"></i> Booking cancelled.', 'warning');
}

// ---------- resetting the form ----------

// Clear the form and put it back into "New Booking" mode
function resetForm() {
    document.getElementById('booking-form').reset();
    document.getElementById('boat-hint').classList.remove('visible');
    document.getElementById('checkout-row').classList.remove('field-hidden');

    // No service selected -> hide the rest of the fields again
    document.getElementById('f-service').value = '';
    document.getElementById('f-type').value = 'S+1';
    document.getElementById('f-checkin').value = '';
    document.getElementById('f-checkout').value = '';
    document.getElementById('f-advance').value = '';
    document.getElementById('f-notes').value = '';
    onServiceChange();

    // Back to "New Booking" mode (in case we were editing)
    editingId = null;
    document.getElementById('form-section-title').textContent = 'New Booking';
    document.getElementById('form-section-title').style.color = 'var(--fg)';
    document.getElementById('form-section-icon').className = 'fa-solid fa-plus-circle';
    const submitBtn = document.querySelector('#booking-form button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Add Booking';
    submitBtn.classList.remove('btn-success');
    submitBtn.classList.add('btn-primary');
}


/*
   10. STARTUP — this runs once when the page loads
*/

// Load saved bookings; if none exist yet, use the sample data and save it.
// If the old demo data is still in local storage (with +33 numbers), replace it
// so the browser immediately shows the updated Tunisian sample data.
const legacyDemoNames = new Set(['Hassan Bellal', 'Claire Martin', 'Youssef Arabi', 'Amélie Dubois', 'Nicolas Leroy', 'Sofia Morel', 'Leila Bernard', 'Karim Nefzi', 'Célia Dumas']);

if (loadFromLocal()) {
    const savedBookings = JSON.parse(localStorage.getItem('dhz_bookings') || '[]');
    const hasLegacyDemoData = Array.isArray(savedBookings) && savedBookings.some(booking =>
        legacyDemoNames.has(booking.name) && String(booking.phone || '').includes('+33')
    );

    if (hasLegacyDemoData) {
        bookings = JSON.parse(JSON.stringify(DEFAULT_BOOKINGS));
        nextId = 20;
        saveToLocal();
    }
} else {
    bookings = JSON.parse(JSON.stringify(DEFAULT_BOOKINGS));
    nextId = 20;
    saveToLocal();
}

// Draw the whole page
render();

// Start with a clean form (no service selected -> rest of the form stays hidden)
resetForm();

// Pre-fill the dates with today -> tomorrow
document.getElementById('f-checkin').value = todayStr();
document.getElementById('f-checkout').value = addDays(todayStr(), 1);
