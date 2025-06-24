// --- STATE & INITIALIZATION ---
let flightData = { routeName: '', waypoints: [] };
let newPointCounter = 1;

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

// --- EVENT LISTENERS ---
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('generate-fpl-button').addEventListener('click', handleGenerateFPL);
document.getElementById('generate-kml-button').addEventListener('click', handleGenerateKML);
document.getElementById('generate-crd-button').addEventListener('click', handleGenerateCRD);
document.getElementById('log-body').addEventListener('click', handleLogTableClick);
document.getElementById('log-body').addEventListener('input', handleTableInput);
document.getElementById('print-button').addEventListener('click', handlePrint);

// --- UI & DATA MANIPULATION FUNCTIONS ---
function populateLogTable() {
    const logBody = document.getElementById('log-body');
    logBody.innerHTML = '';
    flightData.waypoints.forEach((wp, index) => {
        const row = logBody.insertRow();
        const ddmCoords = decimalToDDM(wp.lat, wp.lon);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="editable-cell">
                <span class="display-value">${wp.identifier}</span>
                <input type="text" class="input-value" value="${wp.identifier}" style="display:none;">
                <button class="edit-btn edit-waypoint-btn" data-index="${index}">Modifier</button>
            </td>
            <td class="editable-cell">
                <span class="display-value">${ddmCoords}</span>
                <input type="text" class="input-value" value="${ddmCoords}" style="display:none;">
                <button class="edit-btn edit-coord-btn" data-index="${index}">Modifier</button>
            </td>
            <td><input type="number" class="altitude-input" data-index="${index}" value="${wp.altFeet}" step="100"></td>
            <td><textarea class="comment-textarea" data-index="${index}" rows="1">${wp.comment || ''}</textarea></td>
        `;

        if (index < flightData.waypoints.length - 1) {
            const nextWp = flightData.waypoints[index + 1];
            const distance = calculateDistanceNM(wp.lat, wp.lon, nextWp.lat, nextWp.lon);
            const insertRow = logBody.insertRow();
            insertRow.className = 'insert-row';
            const cell = insertRow.insertCell();
            cell.colSpan = 5;
            cell.innerHTML = `
                <div class="insert-cell-content">
                    <span>Lg: <strong>${distance.toFixed(2)} NM</strong></span>
                    <div class="add-wp-controls">
                        <span>Ajouter à</span>
                        <input type="number" class="distance-input" min="0.1" step="0.1" placeholder="NM">
                        <span>NM du point suivant</span>
                        <button class="add-wp-btn" data-index="${index}">Créer</button>
                    </div>
                </div>
            `;
        }
    });
    document.querySelectorAll('.comment-textarea').forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    });
}

function checkAndDisplayDuplicateWarnings() {
    const warningBanners = document.querySelectorAll('.warning-banner');
    const identifiers = flightData.waypoints.map(wp => wp.identifier);
    const seen = new Set();
    const duplicates = new Set(identifiers.filter(id => seen.size === seen.add(id).size));
    const hasDuplicates = duplicates.size > 0;
    const message = hasDuplicates ? `<strong>Attention :</strong> Identifiants dupliqués : ${Array.from(duplicates).join(', ')}.` : '';
    const displayStyle = hasDuplicates ? 'block' : 'none';
    warningBanners.forEach(banner => { banner.innerHTML = message; banner.style.display = displayStyle; });
}

function displayStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#666');
}

function createDownloadLink(content, fileName, mimeType) {
    const container = document.getElementById('download-container');
    container.innerHTML = '';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.className = 'download-link';
    a.style.backgroundColor = fileName.includes('.kml') ? '#28a745' : (fileName.includes('.crd') ? '#17a2b8' : '#6c757d');
    a.textContent = `Télécharger ${fileName}`;
    container.appendChild(a);
    container.style.display = 'block';
}

// --- EVENT HANDLERS ---
function handleLogTableClick(event) {
    const editButton = event.target.closest('.edit-btn');
    const addButton = event.target.closest('.add-wp-btn');
    if (editButton) handleEditClick(editButton);
    else if (addButton) handleAddPointAtDistance(addButton);
}

function handleTableInput(event) {
    const target = event.target;
    const index = parseInt(target.dataset.index, 10);
    if (target.classList.contains('comment-textarea')) {
        if (flightData.waypoints[index]) flightData.waypoints[index].comment = target.value;
        target.style.height = 'auto';
        target.style.height = (target.scrollHeight) + 'px';
    } else if (target.classList.contains('altitude-input')) {
        if (flightData.waypoints[index]) flightData.waypoints[index].altFeet = parseFloat(target.value) || 0;
    }
}

function handleAddPointAtDistance(button) {
    const index = parseInt(button.dataset.index, 10);
    const input = button.parentElement.querySelector('.distance-input');
    const distanceFromNext = parseFloat(input.value);

    if (isNaN(distanceFromNext) || distanceFromNext <= 0) {
        alert("Veuillez entrer une distance valide et positive.");
        input.classList.add('input-error');
        return;
    }
    input.classList.remove('input-error');

    const wp1 = flightData.waypoints[index];
    const wp2 = flightData.waypoints[index + 1];
    const totalDistance = calculateDistanceNM(wp1.lat, wp1.lon, wp2.lat, wp2.lon);

    if (distanceFromNext >= totalDistance) {
        alert(`La distance (${distanceFromNext.toFixed(2)} NM) doit être inférieure à la distance totale du segment (${totalDistance.toFixed(2)} NM).`);
        input.classList.add('input-error');
        return;
    }

    const distanceFromStart = totalDistance - distanceFromNext;
    const bearing = calculateBearing(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
    const newPointCoords = calculateDestinationPoint(wp1.lat, wp1.lon, bearing, distanceFromStart);
    const interpolatedAltitude = wp1.altFeet + (wp2.altFeet - wp1.altFeet) * (distanceFromStart / totalDistance);

    const newWaypoint = {
        identifier: `NEW_POINT_${newPointCounter++}`,
        type: 'USER WAYPOINT',
        lat: newPointCoords.lat,
        lon: newPointCoords.lon,
        altFeet: Math.round(interpolatedAltitude),
        comment: ''
    };
    
    flightData.waypoints.splice(index + 1, 0, newWaypoint);
    populateLogTable();
    checkAndDisplayDuplicateWarnings();
    displayStatus(`Nouveau point ajouté à ${distanceFromStart.toFixed(2)} NM de "${wp1.identifier}".`, 'success');
}

function handleEditClick(button) {
    const cell = button.closest('.editable-cell');
    const displaySpan = cell.querySelector('.display-value');
    const inputField = cell.querySelector('.input-value');
    const index = button.dataset.index;

    if (button.classList.contains('save')) {
        let success = false;
        if (button.classList.contains('edit-coord-btn')) {
            const newCoords = parseDDM(inputField.value);
            if (newCoords) {
                flightData.waypoints[index].lat = newCoords.lat;
                flightData.waypoints[index].lon = newCoords.lon;
                populateLogTable(); 
                success = true;
            } else { alert("Format de coordonnées invalide. Utilisez NXX°XX.XX EYYY°YY.YY"); }
        } else if (button.classList.contains('edit-waypoint-btn')) {
            const newIdentifier = inputField.value.trim();
            if(newIdentifier) {
                flightData.waypoints[index].identifier = newIdentifier;
                displaySpan.textContent = newIdentifier;
                checkAndDisplayDuplicateWarnings();
                success = true;
            } else { alert("Le nom du waypoint ne peut pas être vide."); }
        }

        if (success && !button.classList.contains('edit-coord-btn')) {
            inputField.style.display = 'none';
            displaySpan.style.display = 'inline';
            button.textContent = 'Modifier';
            button.classList.remove('save');
            inputField.classList.remove('input-error');
        } else if (!success) {
            inputField.classList.add('input-error');
        }
    } else {
        displaySpan.style.display = 'none';
        inputField.style.display = 'inline-block';
        button.textContent = 'OK';
        button.classList.add('save');
        inputField.focus();
    }
}

function handleGenerateCRD() {
    const firstWp = flightData.waypoints[0];
    const lastWp = flightData.waypoints[flightData.waypoints.length - 1];
    const isICAO = (ident) => /^[A-Z]{4}$/i.test(ident);
    if (!isICAO(firstWp.identifier) || !isICAO(lastWp.identifier)) {
        alert(`Erreur CRD : Le premier et le dernier waypoint doivent être des codes OACI de 4 lettres.`);
        return;
    }
    const crdContent = generateCRD(flightData.routeName, flightData.waypoints);
    const fileName = `${flightData.routeName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.crd`;
    createDownloadLink(crdContent, fileName, 'application/xml');
    displayStatus("Fichier CRD généré !", 'success');
}

function handleGenerateKML() {
    const kmlContent = generateKML(flightData.routeName, flightData.waypoints);
    const fileName = `${flightData.routeName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.kml`;
    createDownloadLink(kmlContent, fileName, 'application/vnd.google-earth.kml+xml');
    displayStatus("Fichier KML généré !", 'success');
}

function handleGenerateFPL() {
    const fplContent = generateFPL(flightData.routeName, flightData.waypoints);
    const fileName = `${flightData.routeName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.fpl`;
    createDownloadLink(fplContent, fileName, 'application/xml');
    displayStatus("Fichier FPL généré !", 'success');
}

function handlePrint() {
    document.getElementById('print-title').textContent = `Log de Navigation : ${flightData.routeName}`;
    document.getElementById('print-date').textContent = `Imprimé le : ${new Date().toLocaleString('fr-FR')}`;
    document.querySelectorAll('.comment-textarea').forEach(textarea => {
        textarea.textContent = textarea.value;
    });
    window.print();
}