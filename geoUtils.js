const FEET_TO_METERS = 0.3048;
const EARTH_RADIUS_NM = 3440.065;

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

function calculateDistanceNM(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_NM * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const lat1Rad = toRad(lat1);
    const lon1Rad = toRad(lon1);
    const lat2Rad = toRad(lat2);
    const lon2Rad = toRad(lon2);
    const dLon = lon2Rad - lon1Rad;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    return Math.atan2(y, x);
}

function calculateDestinationPoint(lat1, lon1, bearing, distanceNm) {
    const lat1Rad = toRad(lat1);
    const lon1Rad = toRad(lon1);
    const angularDistance = distanceNm / EARTH_RADIUS_NM;
    const lat2Rad = Math.asin(Math.sin(lat1Rad) * Math.cos(angularDistance) +
                              Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearing));
    const lon2Rad = lon1Rad + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1Rad),
                                          Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad));
    return { lat: toDeg(lat2Rad), lon: toDeg(lon2Rad) };
}

function decimalToDDM(lat, lon) { 
    const formatPart = (deg, isLat) => { 
        const hemisphere = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W'); 
        deg = Math.abs(deg); 
        const d = Math.floor(deg); 
        const m = ((deg - d) * 60).toFixed(2); 
        const padding = isLat ? 2 : 3; 
        return `${hemisphere}${d.toString().padStart(padding, '0')}°${m.padStart(5, '0')}`; 
    }; 
    return `${formatPart(lat, true)} ${formatPart(lon, false)}`; 
}

function decimalToDDMMSS_CRD(lat, lon) {
    const formatPart = (deg, isLat) => {
        const hemisphere = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
        deg = Math.abs(deg);
        const d = Math.floor(deg);
        const m = Math.floor((deg - d) * 60);
        const s = ((deg - d) * 60 - m) * 60;
        const d_pad = isLat ? 2 : 3;
        return `${hemisphere}${d.toString().padStart(d_pad, '0')} ${m.toString().padStart(2, '0')}${s.toFixed(3).padStart(6, '0')}`;
    };
    return { lat: formatPart(lat, true), lon: formatPart(lon, false) };
}

function parseDDM(str) { 
    const regex = /([NS])\s*(\d{1,3})[°\s]+([\d.]+)\s*([EW])\s*(\d{1,3})[°\s]+([\d.]+)/i; 
    const match = str.match(regex); 
    if (!match) return null; 
    let lat = parseFloat(match[2]) + parseFloat(match[3]) / 60; 
    if (match[1].toUpperCase() === 'S') lat = -lat; 
    let lon = parseFloat(match[5]) + parseFloat(match[6]) / 60; 
    if (match[4].toUpperCase() === 'W') lon = -lon; 
    return { lat, lon }; 
}