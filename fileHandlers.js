// Dépend de app.js pour les fonctions d'UI et de geoUtils.js pour les calculs
// Note : Les variables globales `flightData` et `newPointCounter` sont dans app.js

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            newPointCounter = 1;
            processFlightPlan(e.target.result);
        } catch (error) {
            displayStatus(`Erreur de traitement : ${error.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

function processFlightPlan(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    if (xmlDoc.getElementsByTagName("parsererror").length) {
        throw new Error("Fichier XML invalide.");
    }

    const waypointData = new Map();
    for (const wp of xmlDoc.getElementsByTagName('waypoint')) {
        const identifier = wp.getElementsByTagName('identifier')[0].textContent;
        waypointData.set(identifier, {
            identifier,
            type: wp.getElementsByTagName('type')[0].textContent || 'Waypoint',
            lat: parseFloat(wp.getElementsByTagName('lat')[0].textContent),
            lon: parseFloat(wp.getElementsByTagName('lon')[0].textContent),
            altFeet: parseFloat(wp.getElementsByTagName('altitude-ft')[0]?.textContent || 0),
            comment: ''
        });
    }

    const orderedWaypoints = [];
    for (const rp of xmlDoc.getElementsByTagName('route-point')) {
        const id = rp.getElementsByTagName('waypoint-identifier')[0].textContent;
        if (waypointData.has(id)) {
            orderedWaypoints.push(waypointData.get(id));
        }
    }

    if (orderedWaypoints.length < 2) {
        throw new Error("Une route doit contenir au moins 2 points.");
    }

    flightData.routeName = xmlDoc.getElementsByTagName('route-name')[0]?.textContent || "Trace de vol";
    flightData.waypoints = orderedWaypoints;

    populateLogTable();
    checkAndDisplayDuplicateWarnings();
    displayStatus(`Plan de vol "${flightData.routeName}" chargé.`, 'success');
    document.getElementById('log-container').style.display = 'block';
    document.getElementById('download-container').style.display = 'none';
}