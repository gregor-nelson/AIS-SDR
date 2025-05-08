// Utility functions used across components
export function formatTimeSince(timestamp) {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp * 1000) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

export function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

export function getVesselTypeText(typeCode) {
    if (typeCode === undefined) return 'Unknown';
    
    // Common vessel types based on AIS specification
    const vesselTypes = {
        0: 'Not available',
        1: 'Reserved',
        2: 'WIG',
        3: 'Special Category 3',
        4: 'High-Speed Craft',
        5: 'Special Category 5',
        6: 'Passenger',
        7: 'Cargo',
        8: 'Tanker',
        9: 'Other',
        10: 'Reserved (10)',
        11: 'Reserved (11)',
        12: 'Reserved (12)',
        13: 'Reserved (13)',
        14: 'Reserved (14)',
        15: 'Reserved (15)',
        16: 'Reserved (16)',
        17: 'Reserved (17)',
        18: 'Reserved (18)',
        19: 'Reserved (19)',
        20: 'WIG',
        21: 'WIG, Hazardous Category A',
        22: 'WIG, Hazardous Category B',
        23: 'WIG, Hazardous Category C',
        24: 'WIG, Hazardous Category D',
        25: 'WIG, Reserved',
        26: 'WIG, Reserved',
        27: 'WIG, Reserved',
        28: 'WIG, Reserved',
        29: 'WIG, Reserved',
        30: 'Fishing',
        31: 'Towing',
        32: 'Towing (size exceeds 200m or width exceeds 25m)',
        33: 'Dredging or underwater operations',
        34: 'Diving operations',
        35: 'Military operations',
        36: 'Sailing',
        37: 'Pleasure Craft',
        38: 'Reserved',
        39: 'Reserved',
        40: 'High-Speed Craft',
        41: 'HSC, Hazardous Category A',
        42: 'HSC, Hazardous Category B',
        43: 'HSC, Hazardous Category C',
        44: 'HSC, Hazardous Category D',
        45: 'HSC, Reserved',
        46: 'HSC, Reserved',
        47: 'HSC, Reserved',
        48: 'HSC, Reserved',
        49: 'HSC, No Additional Information',
        50: 'Pilot Vessel',
        51: 'Search and Rescue vessel',
        52: 'Tug',
        53: 'Port Tender',
        54: 'Anti-pollution equipment',
        55: 'Law Enforcement',
        56: 'Spare - Local Vessel',
        57: 'Spare - Local Vessel',
        58: 'Medical Transport',
        59: 'Ship according to RR Resolution',
        60: 'Passenger',
        61: 'Passenger, Hazardous Category A',
        62: 'Passenger, Hazardous Category B',
        63: 'Passenger, Hazardous Category C',
        64: 'Passenger, Hazardous Category D',
        65: 'Passenger, Reserved',
        66: 'Passenger, Reserved',
        67: 'Passenger, Reserved',
        68: 'Passenger, Reserved',
        69: 'Passenger, No Additional Information',
        70: 'Cargo',
        71: 'Cargo, Hazardous Category A',
        72: 'Cargo, Hazardous Category B',
        73: 'Cargo, Hazardous Category C',
        74: 'Cargo, Hazardous Category D',
        75: 'Cargo, Reserved',
        76: 'Cargo, Reserved',
        77: 'Cargo, Reserved',
        78: 'Cargo, Reserved',
        79: 'Cargo, No Additional Information',
        80: 'Tanker',
        81: 'Tanker, Hazardous Category A',
        82: 'Tanker, Hazardous Category B',
        83: 'Tanker, Hazardous Category C',
        84: 'Tanker, Hazardous Category D',
        85: 'Tanker, Reserved',
        86: 'Tanker, Reserved',
        87: 'Tanker, Reserved',
        88: 'Tanker, Reserved',
        89: 'Tanker, No Additional Information',
        90: 'Other Type',
        91: 'Other Type, Hazardous Category A',
        92: 'Other Type, Hazardous Category B',
        93: 'Other Type, Hazardous Category C',
        94: 'Other Type, Hazardous Category D',
        95: 'Other Type, Reserved',
        96: 'Other Type, Reserved',
        97: 'Other Type, Reserved',
        98: 'Other Type, Reserved',
        99: 'Other Type, No Additional Information'
    };
    
    return vesselTypes[typeCode] || `Unknown (${typeCode})`;
}

export function getNavigationStatusText(status) {
    if (status === undefined) return 'Unknown';
    
    const navStatus = {
        0: 'Under Way Using Engine',
        1: 'At Anchor',
        2: 'Not Under Command',
        3: 'Restricted Maneuverability',
        4: 'Constrained by Draught',
        5: 'Moored',
        6: 'Aground',
        7: 'Engaged in Fishing',
        8: 'Under Way Sailing',
        9: 'Reserved (9)',
        10: 'Reserved (10)',
        11: 'Reserved (11)',
        12: 'Reserved (12)',
        13: 'Reserved (13)',
        14: 'AIS-SART active',
        15: 'Not Defined'
    };
    
    return navStatus[status] || `Unknown (${status})`;
}

export function formatFieldName(key) {
    // Convert snake_case to Title Case with spaces
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function formatValue(value) {
    if (value === null || value === undefined) return 'Not available';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    return value;
}

export function scrollToBottom(element) {
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

export function getDistance(point1, point2) {
    // Calculate distance between two lat/lng points in kilometers using Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (point2[0] - point1[0]) * Math.PI / 180;
    const dLon = (point2[1] - point1[1]) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c * 1000; // Distance in meters
    return d;
}

export function calculateEndpoint(startPoint, heading, lengthMeters) {
    // Convert heading to radians
    const headingRad = (heading * Math.PI) / 180;
    
    // Earth radius in meters
    const R = 6378137;
    
    // Current lat/lon in radians
    const lat1 = startPoint[0] * Math.PI / 180;
    const lon1 = startPoint[1] * Math.PI / 180;
    
    // Calculate new point
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(lengthMeters / R) +
        Math.cos(lat1) * Math.sin(lengthMeters / R) * Math.cos(headingRad)
    );
    
    const lon2 = lon1 + Math.atan2(
        Math.sin(headingRad) * Math.sin(lengthMeters / R) * Math.cos(lat1),
        Math.cos(lengthMeters / R) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    // Convert back to degrees
    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
}

export function deg2rad(deg) {
    return deg * (Math.PI/180);
}

export function getVesselTypeForSorting(vessel) {
    if (vessel.is_aton) {
        return 'A_AtoN_' + (vessel.aton_type_text || '');
    } else if (vessel.is_base_station) {
        return 'B_BaseStation';
    } else if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) {
        return 'C_ClassB_' + (vessel.shiptype_text || getVesselTypeText(vessel.shiptype) || '');
    } else {
        return 'D_ClassA_' + (vessel.shiptype_text || getVesselTypeText(vessel.shiptype) || '');
    }
}