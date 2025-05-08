import * as Utils from './Utils.js';

export default class MapController {
    constructor(mapElementId, options = {}) {
        this.mapElementId = mapElementId;
        this.options = options;
        this.map = null;
        this.markers = {};
        this.headingLines = {};
        this.vesselTrails = {};
        this.showVesselTrails = false;
        this.maxTrailPoints = 20;
        this.onToggleHideNoPosition = null; // Callback to be set from outside
        this.vessels = {}; // Reference to vessels data
    }

    init() {
        // Initialize the map
        this.map = L.map(this.mapElementId, {
            center: [0, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 18,
            attributionControl: false,
            zoomControl: true
        });
        
        // Add tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        // Add attribution control
        L.control.attribution({
            position: 'bottomright'
        }).addTo(this.map);

        // Add scale control
        L.control.scale({
            imperial: false,
            position: 'bottomright'
        }).addTo(this.map);

        // Add custom map controls
        this.addCustomMapControls();
        
        return this;
    }

    addCustomMapControls() {
        // Add fit bounds control
        const fitBoundsControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'fit-bounds-button', container);
                button.innerHTML = '<i class="fas fa-compress-alt"></i>';
                button.title = 'Fit map to all vessels';
                
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.fitMapToVessels();
                });
                
                return container;
            }
        });
        
        // Add trails toggle control
        const trailsControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'trails-button', container);
                button.innerHTML = '<i class="fas fa-route"></i>';
                button.title = 'Toggle vessel trails';
                
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.toggleVesselTrails();
                    button.classList.toggle('active', this.showVesselTrails);
                });
                
                return container;
            }
        });
        
        // Add position filter control
        const hideNoPositionControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                const button = L.DomUtil.create('a', 'position-filter-button', container);
                button.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
                button.title = 'Toggle showing vessels without position';
                
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (typeof this.onToggleHideNoPosition === 'function') {
                        const newValue = this.onToggleHideNoPosition();
                        button.classList.toggle('active', newValue);
                    }
                });
                
                return container;
            }
        });
        
        this.map.addControl(new fitBoundsControl());
        this.map.addControl(new trailsControl());
        this.map.addControl(new hideNoPositionControl());
    }
    
    setVessels(vessels) {
        this.vessels = vessels;
    }

    updateAllMarkers(vessels) {
        // Update local reference
        this.vessels = vessels || this.vessels;
        
        // Clear all markers first
        Object.keys(this.markers).forEach(mmsi => {
            if (this.markers[mmsi]) {
                try {
                    this.map.removeLayer(this.markers[mmsi]);
                } catch (e) {
                    console.warn('Error removing marker', e);
                }
            }
            delete this.markers[mmsi];
        });
        
        // Clear all heading lines
        if (this.headingLines) {
            Object.keys(this.headingLines).forEach(mmsi => {
                if (this.headingLines[mmsi]) {
                    try {
                        this.map.removeLayer(this.headingLines[mmsi]);
                    } catch (e) {
                        console.warn('Error removing heading line', e);
                    }
                }
                delete this.headingLines[mmsi];
            });
        }
        
        // Clear all trails if they exist
        if (this.vesselTrails) {
            Object.keys(this.vesselTrails).forEach(mmsi => {
                if (this.vesselTrails[mmsi]) {
                    try {
                        this.map.removeLayer(this.vesselTrails[mmsi]);
                    } catch (e) {
                        console.warn('Error removing vessel trail', e);
                    }
                }
                delete this.vesselTrails[mmsi];
            });
        }
        
        // Add all vessels with positions
        Object.keys(this.vessels).forEach(mmsi => {
            this.updateVesselMarker(mmsi, this.vessels[mmsi]);
        });
    }

    updateVesselMarker(mmsi, vessel) {
        if (!vessel || !vessel.lat || !vessel.lon) {
            // Remove marker if exists but no position
            if (this.markers[mmsi]) {
                try {
                    this.map.removeLayer(this.markers[mmsi]);
                } catch (e) {
                    console.warn('Error removing marker', e);
                }
                delete this.markers[mmsi];
            }
            
            // Remove heading line if exists
            if (this.headingLines && this.headingLines[mmsi]) {
                try {
                    this.map.removeLayer(this.headingLines[mmsi]);
                } catch (e) {
                    console.warn('Error removing heading line', e);
                }
                delete this.headingLines[mmsi];
            }
            
            // Remove trail if exists
            if (this.vesselTrails && this.vesselTrails[mmsi]) {
                try {
                    this.map.removeLayer(this.vesselTrails[mmsi]);
                } catch (e) {
                    console.warn('Error removing vessel trail', e);
                }
                delete this.vesselTrails[mmsi];
            }
            return;
        }
        
        const position = [vessel.lat, vessel.lon];
        
        // Get appropriate icon based on vessel type and status
        const iconUrl = this.getVesselIconUrl(vessel);
        
        // Create or update marker
        if (!this.markers[mmsi]) {
            // Create new marker with appropriate rotation
            const vesselIcon = L.icon({
                iconUrl: iconUrl,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            });
            
            // Create marker with course rotation if available
            try {
                this.markers[mmsi] = L.marker(position, { 
                    icon: vesselIcon,
                    rotationAngle: vessel.cog || 0,
                    rotationOrigin: 'center center',
                    zIndexOffset: this.getVesselZIndexOffset(vessel)
                })
                    .addTo(this.map)
                    .bindPopup(this.createVesselPopup(vessel), {
                        maxWidth: 300,
                        className: this.getVesselPopupClass(vessel)
                    })
                    .on('click', () => {
                        window.selectVessel(mmsi);
                    });
                    
                // Add heading line if available
                if (vessel.true_heading !== undefined && vessel.true_heading !== null) {
                    this.addHeadingLine(mmsi, position, vessel.true_heading);
                } else if (vessel.cog !== undefined && vessel.cog !== null) {
                    this.addHeadingLine(mmsi, position, vessel.cog);
                }
                
                // Add vessel trail if enabled
                if (this.showVesselTrails) {
                    this.addOrUpdateVesselTrail(mmsi, position);
                }
            } catch (e) {
                console.error('Error creating marker for vessel', vessel, e);
            }
        } else {
            // Update existing marker
            try {
                this.markers[mmsi].setLatLng(position);
                
                // Update rotation for course or heading
                if (vessel.cog !== undefined) {
                    this.markers[mmsi].setRotationAngle(vessel.cog);
                }
                
                // Update icon if vessel type/status changed
                const icon = L.icon({
                    iconUrl: iconUrl,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    popupAnchor: [0, -12]
                });
                this.markers[mmsi].setIcon(icon);
                
                // Update Z-index offset based on vessel properties
                this.markers[mmsi].setZIndexOffset(this.getVesselZIndexOffset(vessel));
                
                // Update popup content
                this.markers[mmsi].getPopup().setContent(this.createVesselPopup(vessel));
                this.markers[mmsi].getPopup().options.className = this.getVesselPopupClass(vessel);
                
                // Update heading line
                if (vessel.true_heading !== undefined && vessel.true_heading !== null) {
                    this.updateHeadingLine(mmsi, position, vessel.true_heading);
                } else if (vessel.cog !== undefined && vessel.cog !== null) {
                    this.updateHeadingLine(mmsi, position, vessel.cog);
                }
                
                // Update vessel trail if enabled
                if (this.showVesselTrails) {
                    this.addOrUpdateVesselTrail(mmsi, position);
                }
            } catch (e) {
                console.error('Error updating marker for vessel', vessel, e);
            }
        }
        
        // If vessel is stale, make it semi-transparent
        if (this.markers[mmsi] && this.markers[mmsi]._icon) {
            try {
                if (vessel.stale) {
                    this.markers[mmsi]._icon.style.opacity = 0.5;
                } else {
                    this.markers[mmsi]._icon.style.opacity = 1.0;
                }
            } catch (e) {
                console.warn('Error updating marker opacity', e);
            }
        }
        
        // Apply special styling for vessels with specific nav_status
        if (vessel.nav_status !== undefined && this.markers[mmsi] && this.markers[mmsi]._icon) {
            try {
                // Clear existing classes
                const statusClasses = ['nav-status-anchored', 'nav-status-moored', 'nav-status-nuc', 
                                      'nav-status-restricted', 'nav-status-aground', 'nav-status-fishing', 
                                      'nav-status-sailing'];
                
                statusClasses.forEach(cls => {
                    this.markers[mmsi]._icon.classList.remove(cls);
                });
                
                // Add appropriate class
                if (vessel.nav_status === 1) { // At anchor
                    this.markers[mmsi]._icon.classList.add('nav-status-anchored');
                } else if (vessel.nav_status === 5) { // Moored
                    this.markers[mmsi]._icon.classList.add('nav-status-moored');
                } else if (vessel.nav_status === 2) { // Not under command
                    this.markers[mmsi]._icon.classList.add('nav-status-nuc');
                } else if (vessel.nav_status === 3) { // Restricted maneuverability
                    this.markers[mmsi]._icon.classList.add('nav-status-restricted');
                } else if (vessel.nav_status === 6) { // Aground
                    this.markers[mmsi]._icon.classList.add('nav-status-aground');
                } else if (vessel.nav_status === 7) { // Engaged in fishing
                    this.markers[mmsi]._icon.classList.add('nav-status-fishing');
                } else if (vessel.nav_status === 8) { // Under way sailing
                    this.markers[mmsi]._icon.classList.add('nav-status-sailing');
                }
            } catch (e) {
                console.warn('Error updating marker nav status classes', e);
            }
        }
    }
    
    getVesselPopupClass(vessel) {
        let classes = 'vessel-popup-container';
        
        if (vessel.is_aton) {
            classes += ' aton-popup';
        } else if (vessel.is_base_station) {
            classes += ' basestation-popup';
        } else if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) {
            classes += ' classb-popup';
        } else {
            classes += ' classa-popup';
        }
        
        if (vessel.stale) {
            classes += ' stale-popup';
        }
        
        if (vessel.nav_status !== undefined) {
            classes += ` nav-status-${vessel.nav_status}`;
        }
        
        return classes;
    }
    
    getVesselZIndexOffset(vessel) {
        // Set z-index priority for different vessel types
        if (vessel.mmsi === window.selectedVessel) return 1000; // Selected vessel gets top priority
        if (vessel.is_base_station) return 950;
        if (vessel.is_aton) return 900;
        
        // Vessels based on navigation status
        if (vessel.nav_status !== undefined) {
            switch(vessel.nav_status) {
                case 1: // At anchor
                case 5: // Moored
                    return 600;
                case 2: // Not under command
                case 3: // Restricted maneuverability
                case 4: // Constrained by draught
                    return 800;
                case 6: // Aground
                    return 700;
                case 0: // Under way using engine
                    return 650;
            }
        }
        
        // Default based on vessel class and speed
        if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) {
            return 500;
        }
        
        // Higher speed vessels get higher priority
        if (vessel.sog !== undefined) {
            if (vessel.sog > 15) return 750;
            if (vessel.sog > 5) return 700;
        }
        
        return 500; // Default value
    }
    
    getVesselIconUrl(vessel) {
        // Base type classification
        let typeStr = 'default';
        
        // First check if it's a special type
        if (vessel.is_aton) {
            return `/vessel-icon/aton${vessel.virtual_aton ? '-virtual' : ''}`;
        }
        
        if (vessel.is_base_station) {
            return `/vessel-icon/basestation`;
        }
        
        // Check if vessel is stale
        let staleSuffix = vessel.stale ? '-stale' : '';
        
        // Check for class B suffix
        let classBSuffix = '';
        if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) {
            classBSuffix = '-classb';
        }
        
        // Get vessel type
        const vesselType = (vessel.shiptype_text || '').toLowerCase();
        
        if (vesselType.includes('passenger')) {
            typeStr = 'passenger';
        } else if (vesselType.includes('cargo')) {
            typeStr = 'cargo';
        } else if (vesselType.includes('tanker')) {
            typeStr = 'tanker';
        } else if (vesselType.includes('fishing')) {
            typeStr = 'fishing';
        } else if (vesselType.includes('pleasure') || vesselType.includes('yacht')) {
            typeStr = 'pleasure';
        } else if (vesselType.includes('sailing')) {
            typeStr = 'sailing';
        } else if (vesselType.includes('military')) {
            typeStr = 'military';
        } else if (vesselType.includes('hsc') || vesselType.includes('high speed')) {
            typeStr = 'hsc';
        } else if (vesselType.includes('tug')) {
            typeStr = 'tug';
        } else if (vesselType.includes('sar') || vesselType.includes('search')) {
            typeStr = 'sar';
        }
        
        return `/vessel-icon/${typeStr}${classBSuffix}${staleSuffix}`;
    }
    
    createVesselPopup(vessel) {
        const vesselName = vessel.shipname || vessel.aton_name || 'Unknown';
        const vesselType = vessel.shiptype_text || Utils.getVesselTypeText(vessel.shiptype) || 'Unknown Type';
        const navStatus = vessel.nav_status_text || Utils.getNavigationStatusText(vessel.nav_status) || '';
        
        // Format position timestamp if available
        let positionTime = '';
        if (vessel.position_timestamp) {
            const timeSince = Utils.formatTimeSince(vessel.last_update);
            positionTime = `<br>Position: ${timeSince}`;
        }
        
        // Add dimensions if available
        let dimensions = '';
        if (vessel.length && vessel.width) {
            dimensions = `<br>Size: ${vessel.length}m × ${vessel.width}m`;
        }
        
        // Add destination if available
        let destination = '';
        if (vessel.destination && vessel.destination !== '') {
            destination = `<br>Destination: ${vessel.destination}`;
        }
        
        // Add advanced indicators
        let advancedInfo = '';
        if (vessel.raim_flag_text) {
            advancedInfo += `<br>RAIM: ${vessel.raim_flag_text}`;
        }
        
        if (vessel.position_accuracy_text) {
            advancedInfo += `<br>Accuracy: ${vessel.position_accuracy_text}`;
        }
        
        // Format for different entity types
        if (vessel.is_aton) {
            return `
                <div class="vessel-popup aton-popup">
                    <div style="background: var(--gradient-primary); margin: -4px -4px 8px -4px; padding: 8px; border-radius: 4px 4px 0 0;">
                        <strong style="margin-bottom: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${vesselName}</strong>
                    </div>
                    <div>
                        Type: Aid to Navigation<br>
                        MMSI: ${vessel.mmsi}<br>
                        ${vessel.virtual_aton ? 'Virtual AtoN<br>' : ''}
                        ${vessel.aton_type_text ? `AtoN Type: ${vessel.aton_type_text}<br>` : ''}
                        ${positionTime}
                        ${advancedInfo}
                    </div>
                    <div class="popup-actions">
                        <a href="#" onclick="selectVessel('${vessel.mmsi}'); return false;">View Details</a>
                        <a href="#" onclick="centerMapOnVessel('${vessel.mmsi}'); return false;">Center Map</a>
                    </div>
                </div>
            `;
        } else if (vessel.is_base_station) {
            return `
                <div class="vessel-popup basestation-popup">
                    <div style="background: var(--gradient-primary); margin: -4px -4px 8px -4px; padding: 8px; border-radius: 4px 4px 0 0;">
                        <strong style="margin-bottom: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">Base Station</strong>
                    </div>
                    <div>
                        MMSI: ${vessel.mmsi}<br>
                        ${positionTime}
                        ${advancedInfo}
                    </div>
                    <div class="popup-actions">
                        <a href="#" onclick="selectVessel('${vessel.mmsi}'); return false;">View Details</a>
                        <a href="#" onclick="centerMapOnVessel('${vessel.mmsi}'); return false;">Center Map</a>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="vessel-popup ${vessel.stale ? 'stale-popup' : ''}">
                    <div style="background: var(--gradient-primary); margin: -4px -4px 8px -4px; padding: 8px; border-radius: 4px 4px 0 0;">
                        <strong style="margin-bottom: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${vesselName}</strong>
                    </div>
                    <div>
                        MMSI: ${vessel.mmsi}<br>
                        Type: ${vesselType}<br>
                        ${vessel.callsign ? `Callsign: ${vessel.callsign}<br>` : ''}
                        ${vessel.sog !== undefined ? `Speed: ${vessel.sog.toFixed(1)} knots<br>` : ''}
                        ${vessel.cog !== undefined ? `Course: ${vessel.cog.toFixed(1)}°<br>` : ''}
                        ${navStatus ? `Status: ${navStatus}<br>` : ''}
                        ${dimensions}
                        ${destination}
                        ${positionTime}
                        ${vessel.class_b_unit_text ? `${vessel.class_b_unit_text}<br>` : ''}
                        ${advancedInfo}
                    </div>
                    <div class="popup-actions">
                        <a href="#" onclick="selectVessel('${vessel.mmsi}'); return false;">View Details</a>
                        <a href="#" onclick="centerMapOnVessel('${vessel.mmsi}'); return false;">Center Map</a>
                    </div>
                </div>
            `;
        }
    }
    
    addHeadingLine(mmsi, position, heading) {
        try {
            // Calculate endpoint using heading and a fixed length
            const lengthMeters = this.calculateVesselLineLength(this.vessels[mmsi]);
            const endpoint = Utils.calculateEndpoint(position, heading, lengthMeters);
            
            // Create polyline
            const headingLine = L.polyline([position, endpoint], {
                color: this.getVesselLineColor(this.vessels[mmsi]),
                weight: 2,
                opacity: 0.8
            }).addTo(this.map);
            
            // Store reference to line
            if (!this.headingLines) this.headingLines = {};
            this.headingLines[mmsi] = headingLine;
        } catch (e) {
            console.warn('Error adding heading line', e);
        }
    }
    
    updateHeadingLine(mmsi, position, heading) {
        try {
            // If line doesn't exist, create it
            if (!this.headingLines || !this.headingLines[mmsi]) {
                this.addHeadingLine(mmsi, position, heading);
                return;
            }
            
            // Calculate new endpoint
            const lengthMeters = this.calculateVesselLineLength(this.vessels[mmsi]);
            const endpoint = Utils.calculateEndpoint(position, heading, lengthMeters);
            
            // Update line
            this.headingLines[mmsi].setLatLngs([position, endpoint]);
            this.headingLines[mmsi].setStyle({
                color: this.getVesselLineColor(this.vessels[mmsi])
            });
        } catch (e) {
            console.warn('Error updating heading line', e);
        }
    }
    
    calculateVesselLineLength(vessel) {
        // Base length on vessel size if available, otherwise use speed
        if (vessel.length && vessel.length > 0) {
            return Math.max(vessel.length * 3, 100); // At least 3x vessel length, minimum 100m
        }
        
        // Use speed to determine line length
        if (vessel.sog !== undefined && vessel.sog !== null) {
            return Math.max(vessel.sog * 50, 100); // 50m per knot, minimum 100m
        }
        
        // Default length
        return 200; // meters
    }
    
    getVesselLineColor(vessel) {
        // Color based on vessel type
        if (vessel.is_aton) return '#FF00FF'; // Magenta for AtoN
        if (vessel.is_base_station) return '#00FFFF'; // Cyan for base station
        
        // Get speed color
        if (vessel.sog !== undefined && vessel.sog !== null) {
            if (vessel.sog < 1) return '#FF0000'; // Red for stationary/slow
            if (vessel.sog < 5) return '#FFAA00'; // Orange for slow
            if (vessel.sog < 10) return '#FFFF00'; // Yellow for medium
            if (vessel.sog < 15) return '#00FF00'; // Green for fast
            return '#0000FF'; // Blue for very fast
        }
        
        return '#FFFFFF'; // White default
    }
    
    addOrUpdateVesselTrail(mmsi, position) {
        try {
            if (!this.vesselTrails[mmsi]) {
                // Create new trail
                const trail = L.polyline([position], {
                    color: this.getVesselTrailColor(this.vessels[mmsi]),
                    className: 'vessel-trail', // Use CSS class for styling
                    weight: 2
                }).addTo(this.map);
                this.vesselTrails[mmsi] = trail;
            } else {
                // Update existing trail
                const currentLatLngs = this.vesselTrails[mmsi].getLatLngs();
                
                // Add new position if it's different enough from the last one
                if (currentLatLngs.length > 0) {
                    const lastPoint = currentLatLngs[currentLatLngs.length - 1];
                    if (Utils.getDistanceFromLatLonInM(lastPoint.lat, lastPoint.lng, position[0], position[1]) > 5) {
                        currentLatLngs.push(position);
                        
                        // Limit trail length
                        if (currentLatLngs.length > this.maxTrailPoints) {
                            currentLatLngs.shift();
                        }
                        
                        this.vesselTrails[mmsi].setLatLngs(currentLatLngs);
                    }
                } else {
                    // Empty trail, just add the point
                    this.vesselTrails[mmsi].setLatLngs([position]);
                }
            }
        } catch (e) {
            console.warn('Error updating vessel trail', e);
        }
    }
    
    getVesselTrailColor(vessel) {
        // Determine trail color based on vessel type/class
        if (vessel.is_aton) return '#FF00FF'; // Magenta for AtoN
        if (vessel.is_base_station) return '#00FFFF'; // Cyan for base station
        if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) return '#2196F3'; // Blue for Class B
        
        // Based on vessel type
        const shipType = vessel.shiptype || 0;
        if (shipType >= 60 && shipType <= 69) return '#FF0000'; // Red for passenger ships
        if (shipType >= 70 && shipType <= 79) return '#00FF00'; // Green for cargo
        if (shipType >= 80 && shipType <= 89) return '#A52A2A'; // Brown for tankers
        
        return '#FF9800'; // Default orange
    }
    
    toggleVesselTrails() {
        this.showVesselTrails = !this.showVesselTrails;
        
        try {
            if (this.showVesselTrails) {
                // Enable trails - create for all current vessels
                Object.keys(this.markers).forEach(mmsi => {
                    if (this.vessels[mmsi] && this.vessels[mmsi].lat && this.vessels[mmsi].lon) {
                        this.addOrUpdateVesselTrail(mmsi, [this.vessels[mmsi].lat, this.vessels[mmsi].lon]);
                    }
                });
            } else {
                // Disable trails - remove all
                Object.keys(this.vesselTrails).forEach(mmsi => {
                    if (this.vesselTrails[mmsi]) {
                        this.map.removeLayer(this.vesselTrails[mmsi]);
                    }
                });
                this.vesselTrails = {};
            }
            
            // Update UI
            document.querySelector('.trails-button')?.classList.toggle('active', this.showVesselTrails);
        } catch (e) {
            console.error('Error toggling vessel trails', e);
        }
        
        return this.showVesselTrails;
    }
    
    fitMapToVessels() {
        try {
            const markerPositions = Object.values(this.markers).map(marker => marker.getLatLng());
            
            if (markerPositions.length > 0) {
                const bounds = L.latLngBounds(markerPositions);
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }
        } catch (e) {
            console.error('Error fitting map to vessels', e);
        }
    }
    
    // Expose methods for external callbacks
    centerOnVessel(mmsi) {
        if (this.markers[mmsi]) {
            try {
                this.map.setView(this.markers[mmsi].getLatLng(), 12);
            } catch (e) {
                console.error('Error centering map on vessel', e);
            }
        }
    }
}