import * as Utils from './Utils.js';

export default class VesselManager {
    constructor(options = {}) {
        this.vessels = {};
        this.selectedVessel = null;
        this.vesselListElement = options.vesselListElement;
        this.vesselDetailsElement = options.vesselDetailsElement;
        this.selectedVesselTextElement = options.selectedVesselTextElement;
        this.vesselCountElement = options.vesselCountElement;
        this.filteredCountElement = options.filteredCountElement;
        this.hideNoPosition = false;
        this.mapController = options.mapController;
        this.filterElements = {
            search: options.vesselSearch,
            sort: options.vesselSort,
            showStale: options.vesselShowStaleVesselsToggle,
            classFilter: options.vesselClassFilter,
            statusFilter: options.vesselStatusFilter,
            minSpeed: options.minSpeedFilter,
            maxSpeed: options.maxSpeedFilter,
            applySpeedFilterBtn: options.applySpeedFilterBtn,
            clearFiltersBtn: options.clearFiltersBtn,
            toggleAdvancedFiltersBtn: options.toggleAdvancedFiltersBtn
        };
    }

    init() {
        // Initialize event listeners for filters
        this.initFilterListeners();
        
        // Make selectVessel available globally for popup links
        window.selectVessel = (mmsi) => {
            this.selectVessel(mmsi);
        };
        
        // Make centerMapOnVessel available globally for the vessel details panel
        window.centerMapOnVessel = (mmsi) => {
            if (this.mapController) {
                this.mapController.centerOnVessel(mmsi);
            }
        };
        
        return this;
    }

    initFilterListeners() {
        const { 
            search, 
            sort, 
            showStale, 
            classFilter, 
            statusFilter,
            minSpeed, 
            maxSpeed,
            applySpeedFilterBtn,
            clearFiltersBtn,
            toggleAdvancedFiltersBtn
        } = this.filterElements;
        
        if (search) {
            search.addEventListener('input', () => this.updateVesselList());
        }
        
        if (sort) {
            sort.addEventListener('change', () => this.updateVesselList());
        }
        
        if (showStale) {
            showStale.addEventListener('change', () => this.updateVesselList());
        }
        
        if (classFilter) {
            classFilter.addEventListener('change', () => this.updateVesselList());
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.updateVesselList());
        }
        
        // Speed filter button
        if (applySpeedFilterBtn) {
            applySpeedFilterBtn.addEventListener('click', () => this.updateVesselList());
        }
        
        // Clear filters button
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
        
        // Toggle advanced filters button
        if (toggleAdvancedFiltersBtn) {
            toggleAdvancedFiltersBtn.addEventListener('click', function() {
                const advancedFilters = document.querySelector('.advanced-filters');
                const speedFilter = document.querySelector('.speed-filter');
                
                if (advancedFilters) advancedFilters.classList.toggle('show');
                if (speedFilter) speedFilter.classList.toggle('show');
                
                this.textContent = (advancedFilters && advancedFilters.classList.contains('show')) ? 
                    'Hide Advanced Filters' : 'Show Advanced Filters';
            });
        }
    }

    toggleHideNoPosition() {
        this.hideNoPosition = !this.hideNoPosition;
        this.updateVesselList();
        return this.hideNoPosition;
    }

    clearFilters() {
        const { search, sort, showStale, classFilter, statusFilter, minSpeed, maxSpeed } = this.filterElements;
        
        if (search) search.value = '';
        if (sort) sort.value = 'recent';
        if (showStale) showStale.checked = true;
        if (classFilter) classFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (minSpeed) minSpeed.value = '';
        if (maxSpeed) maxSpeed.value = '';
        
        this.updateVesselList();
    }

    updateVesselList() {
        if (!this.vesselListElement) return;
        
        // Get search term and filters
        const { search, sort, showStale, classFilter, statusFilter, minSpeed, maxSpeed } = this.filterElements;
        
        const searchTerm = search ? search.value.toLowerCase() : '';
        const sortMethod = sort ? sort.value : 'recent';
        const showStaleVessels = showStale ? showStale.checked : true;
        const vesselClassFilter = classFilter ? classFilter.value : 'all';
        const vesselStatusFilter = statusFilter ? statusFilter.value : 'all';
        const minSpeedValue = minSpeed && minSpeed.value ? parseFloat(minSpeed.value) : 0;
        const maxSpeedValue = maxSpeed && maxSpeed.value ? parseFloat(maxSpeed.value) : 100;
        
        // Filter vessels by all criteria
        let filteredVessels = Object.values(this.vessels).filter(vessel => {
            // Skip vessels with no position if requested
            if (this.hideNoPosition && (!vessel.lat || !vessel.lon)) {
                return false;
            }
            
            // Apply search filter
            if (searchTerm) {
                const mmsi = vessel.mmsi?.toString().toLowerCase() || '';
                const name = vessel.shipname?.toLowerCase() || '';
                const callsign = vessel.callsign?.toLowerCase() || '';
                const type = vessel.shiptype_text?.toLowerCase() || Utils.getVesselTypeText(vessel.shiptype)?.toLowerCase() || '';
                
                if (!mmsi.includes(searchTerm) && 
                    !name.includes(searchTerm) && 
                    !callsign.includes(searchTerm) &&
                    !type.includes(searchTerm)) {
                    return false;
                }
            }
            
            // Apply stale filter
            if (!showStaleVessels && vessel.stale) {
                return false;
            }
            
            // Apply vessel class filter
            if (vesselClassFilter !== 'all') {
                if (vesselClassFilter === 'class-a' && 
                    (vessel.is_aton || vessel.is_base_station || 
                     (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')))) {
                    return false;
                }
                
                if (vesselClassFilter === 'class-b' && 
                    (!vessel.class_b_unit_text || !vessel.class_b_unit_text.includes('Class B'))) {
                    return false;
                }
                
                if (vesselClassFilter === 'aton' && !vessel.is_aton) {
                    return false;
                }
                
                if (vesselClassFilter === 'base' && !vessel.is_base_station) {
                    return false;
                }
            }
            
            // Apply status filter
            if (vesselStatusFilter !== 'all' && vessel.nav_status !== parseInt(vesselStatusFilter)) {
                return false;
            }
            
            // Apply speed filter
            const speed = vessel.sog !== undefined ? vessel.sog : 0;
            if (speed < minSpeedValue || speed > maxSpeedValue) {
                return false;
            }
            
            return true;
        });
        
        // Sort vessels
        switch (sortMethod) {
            case 'name':
                filteredVessels.sort((a, b) => {
                    const nameA = a.shipname || a.aton_name || '';
                    const nameB = b.shipname || b.aton_name || '';
                    return nameA.localeCompare(nameB);
                });
                break;
            case 'mmsi':
                filteredVessels.sort((a, b) => a.mmsi - b.mmsi);
                break;
            case 'type':
                filteredVessels.sort((a, b) => {
                    const typeA = Utils.getVesselTypeForSorting(a);
                    const typeB = Utils.getVesselTypeForSorting(b);
                    return typeA.localeCompare(typeB);
                });
                break;
            case 'speed':
                filteredVessels.sort((a, b) => {
                    const speedA = a.sog !== undefined ? a.sog : -1;
                    const speedB = b.sog !== undefined ? b.sog : -1;
                    return speedB - speedA; // Sort fastest first
                });
                break;
            case 'distance':
                // Sort by distance from map center
                if (this.mapController && this.mapController.map) {
                    const mapCenter = this.mapController.map.getCenter();
                    filteredVessels.sort((a, b) => {
                        if (!a.lat || !a.lon) return 1;  // No position goes to end
                        if (!b.lat || !b.lon) return -1; // No position goes to end
                        
                        const distA = Utils.getDistance([a.lat, a.lon], [mapCenter.lat, mapCenter.lng]);
                        const distB = Utils.getDistance([b.lat, b.lon], [mapCenter.lat, mapCenter.lng]);
                        return distA - distB;
                    });
                }
                break;
            case 'recent':
            default:
                filteredVessels.sort((a, b) => (b.last_update || 0) - (a.last_update || 0));
                break;
        }
        
        // Update vessel list
        if (filteredVessels.length > 0) {
            this.vesselListElement.innerHTML = '';
            
            // Create vessel cards
            filteredVessels.forEach(vessel => {
                this.createVesselCard(vessel);
            });
        } else {
            this.vesselListElement.innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-ship" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <div>No vessels match your criteria</div>
                </div>`;
        }
        
        // Update count indicator
        if (this.filteredCountElement) {
            const totalCount = Object.keys(this.vessels).length;
            this.filteredCountElement.textContent = `Showing ${filteredVessels.length} of ${totalCount} vessels`;
        }
    }

    createVesselCard(vessel) {
        if (!this.vesselListElement) return;
        
        const vesselCard = document.createElement('div');
        vesselCard.className = 'vessel-card';
        
        // Add selected class if this is the selected vessel
        if (this.selectedVessel === vessel.mmsi) {
            vesselCard.classList.add('selected');
        }
        
        // Add stale class if vessel is stale
        if (vessel.stale) {
            vesselCard.classList.add('stale');
        }
        
        // Add position status class
        if (vessel.lat && vessel.lon) {
            vesselCard.classList.add('has-position');
        } else {
            vesselCard.classList.add('no-position');
        }
        
        // Add specific class based on vessel type
        if (vessel.is_aton) {
            vesselCard.classList.add('aton');
        } else if (vessel.is_base_station) {
            vesselCard.classList.add('base-station');
        } else if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) {
            vesselCard.classList.add('class-b');
        } else {
            vesselCard.classList.add('class-a');
        }
        
        // Get vessel name and type
        const vesselName = vessel.shipname || vessel.aton_name || 'Unknown';
        
        let vesselType;
        if (vessel.is_aton) {
            vesselType = vessel.aton_type_text || 'Aid to Navigation';
        } else if (vessel.is_base_station) {
            vesselType = 'Base Station';
        } else {
            vesselType = vessel.shiptype_text || Utils.getVesselTypeText(vessel.shiptype) || 'Unknown';
        }
        
        // Navigation status indicator with tooltip
        let navStatusIndicator = '';
        if (vessel.nav_status !== undefined) {
            const statusText = vessel.nav_status_text || Utils.getNavigationStatusText(vessel.nav_status) || '';
            navStatusIndicator = `<span class="nav-status-indicator nav-status-${vessel.nav_status}" 
                title="${statusText}" data-nav-status="${vessel.nav_status}"></span>`;
        }
        
        // Build card content
        vesselCard.innerHTML = `
            <div class="vessel-name">${navStatusIndicator}${vesselName}</div>
            <div class="vessel-info">
                <div class="vessel-label">MMSI:</div>
                <div class="vessel-value">${vessel.mmsi}</div>
                
                <div class="vessel-label">Type:</div>
                <div class="vessel-value">${vesselType}</div>
                
                ${vessel.callsign ? `
                <div class="vessel-label">Call:</div>
                <div class="vessel-value">${vessel.callsign}</div>
                ` : ''}
                
                ${vessel.lat && vessel.lon ? `
                <div class="vessel-label">Position:</div>
                <div class="vessel-value">${vessel.lat.toFixed(4)}°, ${vessel.lon.toFixed(4)}°</div>
                ` : ''}
                
                ${vessel.sog !== undefined ? `
                <div class="vessel-label">Speed:</div>
                <div class="vessel-value">${vessel.sog.toFixed(1)} knots</div>
                ` : ''}
                
                ${vessel.nav_status_text ? `
                <div class="vessel-label">Status:</div>
                <div class="vessel-value">${vessel.nav_status_text}</div>
                ` : ''}
                
                ${vessel.last_update ? `
                <div class="vessel-label">Updated:</div>
                <div class="vessel-value time-ago" data-time="${vessel.last_update}">${Utils.formatTimeSince(vessel.last_update)}</div>
                ` : ''}
            </div>
            ${vessel.stale ? '<div class="stale-indicator">STALE</div>' : ''}
        `;
        
        // Add event listeners
        vesselCard.addEventListener('click', () => {
            this.selectVessel(vessel.mmsi);
        });
        
        // Add card shadow effects
        vesselCard.addEventListener('mouseenter', () => {
            vesselCard.style.boxShadow = 'var(--card-hover-shadow)';
        });

        vesselCard.addEventListener('mouseleave', () => {
            // Don't reset box-shadow for selected vessels
            if (this.selectedVessel !== vessel.mmsi) {
                vesselCard.style.boxShadow = '';
            }
        });
        
        this.vesselListElement.appendChild(vesselCard);
    }

    selectVessel(mmsi) {
        this.selectedVessel = mmsi;
        window.selectedVessel = mmsi; // For global use in map markers
        
        // Update selected styles in vessel list
        if (this.vesselListElement) {
            const vesselCards = this.vesselListElement.querySelectorAll('.vessel-card');
            vesselCards.forEach(card => {
                card.classList.remove('selected');
            });
            
            // Find the card for this vessel and select it
            const selectedCard = Array.from(vesselCards).find(card => {
                const mmsiElement = card.querySelector('.vessel-value');
                return mmsiElement && mmsiElement.textContent === mmsi.toString();
            });
            
            if (selectedCard) {
                selectedCard.classList.add('selected');
                // Scroll the card into view if not visible
                selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        
        // Display vessel details
        this.displayVesselDetails(mmsi);
        
        // Center map on vessel
        if (this.mapController) {
            this.mapController.centerOnVessel(mmsi);
        }
    }

    displayVesselDetails(mmsi) {
        if (!this.vesselDetailsElement) return;
        
        const vessel = this.vessels[mmsi];
        if (!vessel) {
            this.vesselDetailsElement.innerHTML = `
                <div class="empty-message">
                    <i class="fas fa-ship"></i>
                    <div>Vessel information not available</div>
                    <div>Select a vessel from the list or map</div>
                </div>`;
            if (this.selectedVesselTextElement) {
                this.selectedVesselTextElement.textContent = 'No vessel selected';
            }
            return;
        }
        
        // Set vessel name in header
        const vesselName = vessel.shipname || vessel.aton_name || 'Unknown';
        if (this.selectedVesselTextElement) {
            this.selectedVesselTextElement.textContent = `${vesselName} (MMSI: ${mmsi})`;
        }
        
        // Format time since last update
        const lastUpdateTime = vessel.last_update ? Utils.formatTimeSince(vessel.last_update) : 'Unknown';
        
        // Determine vessel type and class
        let vesselType = '';
        let typeClass = '';
        let badgeClass = '';
        let typeIcon = '';
        
        if (vessel.is_aton) {
            vesselType = vessel.aton_type_text || 'Aid to Navigation';
            typeClass = 'aton';
            badgeClass = 'badge-aton';
            typeIcon = 'fa-map-pin';
        } else if (vessel.is_base_station) {
            vesselType = 'Base Station';
            typeClass = 'base-station';
            badgeClass = 'badge-base-station';
            typeIcon = 'fa-broadcast-tower';
        } else {
            vesselType = vessel.shiptype_text || Utils.getVesselTypeText(vessel.shiptype) || 'Unknown';
            if (vessel.class_b_unit_text && vessel.class_b_unit_text.includes('Class B')) {
                typeClass = 'class-b';
                badgeClass = 'badge-class-b';
                typeIcon = 'fa-ship';
            } else {
                typeClass = 'class-a';
                badgeClass = 'badge-class-a';
                typeIcon = 'fa-ship';
            }
        }
        
        // Get navigation status text
        const navStatus = vessel.nav_status_text || Utils.getNavigationStatusText(vessel.nav_status) || 'Unknown';
        
        // Mark if vessel is stale
        const staleClass = vessel.stale ? 'vessel-stale' : '';
        const staleWarning = vessel.stale ? `
            <div class="stale-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <div><strong>Stale Data Warning</strong></div>
                    <div>This vessel data is stale (no updates in >15 minutes)</div>
                </div>
            </div>` : '';
        
        // Build the main structure of the details page
        let detailsHtml = `
            <div class="vessel-tabs">
                <div class="tab-buttons">
                    <button class="tab-button active" data-tab="details">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="tab-button" data-tab="technical">
                        <i class="fas fa-code"></i> Technical Data
                    </button>
                    <button class="tab-button" data-tab="history">
                        <i class="fas fa-history"></i> Message History
                    </button>
                </div>
            </div>
            
            ${staleWarning}
            
            <div class="vessel-details-content" id="vessel-tab-content">
                <!-- Main info card -->
                <div class="vessel-info-card">
                    <div class="vessel-info-header">
                        <h3 class="vessel-title">
                            <i class="fas ${typeIcon}"></i>
                            ${vesselName}
                            <span class="vessel-mmsi">MMSI: ${vessel.mmsi}</span>
                        </h3>
                        <div class="vessel-badges">
                            <div class="vessel-badge ${badgeClass}">
                                <i class="fas ${typeIcon}"></i> ${typeClass.toUpperCase()}
                            </div>
                            ${vessel.stale ? `<div class="vessel-badge badge-stale"><i class="fas fa-exclamation-triangle"></i> STALE</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Vessel info sections based on type -->
                    ${this.buildVesselDetailsSections(vessel, typeClass, navStatus)}
                    
                    <!-- Action buttons -->
                    <div class="vessel-actions">
                        <button class="action-button primary-action" onclick="centerMapOnVessel('${vessel.mmsi}')">
                            <i class="fas fa-map-marker-alt"></i> Show on Map
                        </button>
                        <button class="action-button secondary-action" onclick="document.querySelector('[data-tab=\\'technical\\']').click()">
                            <i class="fas fa-code"></i> View Technical Data
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Set content
        this.vesselDetailsElement.innerHTML = detailsHtml;
        
        // Add tab event listeners
        const tabButtons = this.vesselDetailsElement.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Show the corresponding tab
                const tabName = button.getAttribute('data-tab');
                this.showVesselTab(vessel, tabName);
            });
        });
    }

    // New method to build detailed sections based on vessel type
    buildVesselDetailsSections(vessel, typeClass, navStatus) {
        if (vessel.is_aton) {
            return this.buildAtoNSections(vessel);
        } else if (vessel.is_base_station) {
            return this.buildBaseStationSections(vessel);
        } else {
            return this.buildVesselSections(vessel, typeClass, navStatus);
        }
    }

    // AtoN specific sections
    buildAtoNSections(vessel) {
        return `
            <!-- Position Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-map-marker-alt"></i> Position Data</h4>
                
                ${vessel.lat ? `
                <div class="position-container">
                    <div class="position-marker">
                        <i class="fas fa-map-pin"></i>
                    </div>
                    <div class="position-data">
                        <div class="position-coordinates">
                            <span class="coordinate">Lat: ${vessel.lat.toFixed(6)}°</span>
                            <span class="coordinate">Lon: ${vessel.lon.toFixed(6)}°</span>
                        </div>
                        <div class="position-accuracy">
                            Position Accuracy: ${vessel.position_accuracy_text || 'Unknown'}
                        </div>
                    </div>
                </div>
                ` : `
                <div class="info-item">
                    <div class="info-label">Position</div>
                    <div class="info-value warning">Not Available</div>
                </div>
                `}
            </div>
            
            <!-- AtoN Information Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-info-circle"></i> Aid to Navigation Details</h4>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Name</div>
                        <div class="info-value highlight">${vessel.aton_name || vessel.shipname || 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">AtoN Type</div>
                        <div class="info-value">${vessel.aton_type_text || 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Virtual AtoN</div>
                        <div class="info-value">${vessel.virtual_aton ? 'Yes' : 'No'}</div>
                    </div>
                    
                    ${vessel.length ? `
                    <div class="info-item">
                        <div class="info-label">Dimensions</div>
                        <div class="info-value">Length: ${vessel.length}m, Width: ${vessel.width || 'N/A'}m</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- AIS Tracking Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-satellite-dish"></i> AIS Tracking</h4>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">First Seen</div>
                        <div class="info-value">${vessel.first_seen ? Utils.formatDateTime(vessel.first_seen) : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Last Update</div>
                        <div class="info-value ${vessel.stale ? 'danger' : ''}">${vessel.last_update ? Utils.formatTimeSince(vessel.last_update) : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Message Count</div>
                        <div class="info-value">${vessel.message_count || '1'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Last Message Type</div>
                        <div class="info-value">${vessel.msg_type ? `Type ${vessel.msg_type}` : 'Unknown'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Base Station specific sections
    buildBaseStationSections(vessel) {
        return `
            <!-- Position Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-map-marker-alt"></i> Position Data</h4>
                
                ${vessel.lat ? `
                <div class="position-container">
                    <div class="position-marker">
                        <i class="fas fa-broadcast-tower"></i>
                    </div>
                    <div class="position-data">
                        <div class="position-coordinates">
                            <span class="coordinate">Lat: ${vessel.lat.toFixed(6)}°</span>
                            <span class="coordinate">Lon: ${vessel.lon.toFixed(6)}°</span>
                        </div>
                        <div class="position-accuracy">
                            Position Accuracy: ${vessel.position_accuracy_text || 'Unknown'}
                        </div>
                    </div>
                </div>
                ` : `
                <div class="info-item">
                    <div class="info-label">Position</div>
                    <div class="info-value warning">Not Available</div>
                </div>
                `}
                
                <div class="info-grid">
                    ${vessel.epfd_type_text ? `
                    <div class="info-item">
                        <div class="info-label">EPFD Type</div>
                        <div class="info-value">${vessel.epfd_type_text}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- UTC Information -->
            ${vessel.utc_year ? `
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-clock"></i> UTC Information</h4>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">UTC Date</div>
                        <div class="info-value">${vessel.utc_year}-${vessel.utc_month}-${vessel.utc_day}</div>
                    </div>
                    
                    ${vessel.utc_hour !== undefined ? `
                    <div class="info-item">
                        <div class="info-label">UTC Time</div>
                        <div class="info-value">${vessel.utc_hour}:${vessel.utc_minute}:${vessel.utc_second}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- AIS Tracking Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-satellite-dish"></i> AIS Tracking</h4>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">First Seen</div>
                        <div class="info-value">${vessel.first_seen ? Utils.formatDateTime(vessel.first_seen) : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Last Update</div>
                        <div class="info-value ${vessel.stale ? 'danger' : ''}">${vessel.last_update ? Utils.formatTimeSince(vessel.last_update) : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Message Count</div>
                        <div class="info-value">${vessel.message_count || '1'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Last Message Type</div>
                        <div class="info-value">${vessel.msg_type ? `Type ${vessel.msg_type}` : 'Unknown'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Regular vessel sections (Class A or B)
    buildVesselSections(vessel, typeClass, navStatus) {
        return `
            <!-- Basic Information Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-info-circle"></i> Vessel Information</h4>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Name</div>
                        <div class="info-value highlight">${vessel.shipname || 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Type</div>
                        <div class="info-value ${typeClass}">${vessel.shiptype_text || Utils.getVesselTypeText(vessel.shiptype) || 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Call Sign</div>
                        <div class="info-value">${vessel.callsign || 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">IMO Number</div>
                        <div class="info-value">${vessel.imo_number || 'Unknown'}</div>
                    </div>
                    
                    ${vessel.class_b_unit_text ? `
                    <div class="info-item">
                        <div class="info-label">Class B Type</div>
                        <div class="info-value">${vessel.class_b_unit_text}</div>
                    </div>
                    ` : ''}
                    
                    <div class="info-item">
                        <div class="info-label">Dimensions</div>
                        <div class="info-value">
                            ${vessel.length ? `Length: ${vessel.length}m` : (
                                vessel.to_bow && vessel.to_stern ? `Length: ${vessel.to_bow + vessel.to_stern}m` : 'Length: Unknown'
                            )}
                            ${vessel.width ? `, Width: ${vessel.width}m` : (
                                vessel.to_port && vessel.to_starboard ? `, Width: ${vessel.to_port + vessel.to_starboard}m` : ', Width: Unknown'
                            )}
                        </div>
                    </div>
                    
                    ${vessel.draught !== undefined ? `
                    <div class="info-item">
                        <div class="info-label">Draught</div>
                        <div class="info-value">${vessel.draught.toFixed(1)}m</div>
                    </div>
                    ` : ''}
                    
                    ${vessel.destination ? `
                    <div class="info-item">
                        <div class="info-label">Destination</div>
                        <div class="info-value">${vessel.destination}</div>
                    </div>
                    ` : ''}
                    
                    ${vessel.eta ? `
                    <div class="info-item">
                        <div class="info-label">ETA</div>
                        <div class="info-value">${vessel.eta}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Navigation Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-compass"></i> Navigation Data</h4>
                
                ${vessel.lat ? `
                <div class="position-container">
                    <div class="position-marker">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="position-data">
                        <div class="position-coordinates">
                            <span class="coordinate">Lat: ${vessel.lat.toFixed(6)}°</span>
                            <span class="coordinate">Lon: ${vessel.lon.toFixed(6)}°</span>
                        </div>
                        <div class="position-accuracy">
                            Position Accuracy: ${vessel.position_accuracy_text || 'Unknown'}
                        </div>
                    </div>
                </div>
                ` : `
                <div class="info-item">
                    <div class="info-label">Position</div>
                    <div class="info-value warning">Not Available</div>
                </div>
                `}
                
                ${vessel.nav_status !== undefined ? `
                <div class="nav-status-indicator nav-status-${vessel.nav_status}">
                    <i class="fas fa-info-circle"></i>
                    ${navStatus}
                </div>
                ` : ''}
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Speed</div>
                        <div class="info-value ${vessel.sog && vessel.sog > 0 ? 'highlight' : ''}">${vessel.sog !== undefined ? `${vessel.sog.toFixed(1)} knots` : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Course</div>
                        <div class="info-value">${vessel.cog !== undefined ? `${vessel.cog.toFixed(1)}°` : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Heading</div>
                        <div class="info-value">${vessel.true_heading !== undefined ? `${vessel.true_heading}°` : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Position Device</div>
                        <div class="info-value">${vessel.epfd_type_text || 'Unknown'}</div>
                    </div>
                    
                    ${vessel.rot !== undefined ? `
                    <div class="info-item">
                        <div class="info-label">Rate of Turn</div>
                        <div class="info-value">${vessel.rot_status || `${vessel.rot.toFixed(1)}°/min ${vessel.rot_direction || ''}`}</div>
                    </div>
                    ` : ''}
                    
                    ${vessel.maneuver_text ? `
                    <div class="info-item">
                        <div class="info-label">Special Maneuver</div>
                        <div class="info-value warning">${vessel.maneuver_text}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- AIS Tracking Section -->
            <div class="info-section">
                <h4 class="section-title"><i class="fas fa-satellite-dish"></i> AIS Tracking</h4>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">First Seen</div>
                        <div class="info-value">${vessel.first_seen ? Utils.formatDateTime(vessel.first_seen) : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Last Update</div>
                        <div class="info-value ${vessel.stale ? 'danger' : ''}">${vessel.last_update ? Utils.formatTimeSince(vessel.last_update) : 'Unknown'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Message Count</div>
                        <div class="info-value">${vessel.message_count || '1'}</div>
                    </div>
                    
                    <div class="info-item">
                        <div class="info-label">Last Message Type</div>
                        <div class="info-value">${vessel.msg_type ? `Type ${vessel.msg_type}` : 'Unknown'}</div>
                    </div>
                    
                    ${vessel.raim_flag_text ? `
                    <div class="info-item">
                        <div class="info-label">RAIM</div>
                        <div class="info-value">${vessel.raim_flag_text}</div>
                    </div>
                    ` : ''}
                    
                    ${vessel.position_accuracy_text ? `
                    <div class="info-item">
                        <div class="info-label">Position Accuracy</div>
                        <div class="info-value">${vessel.position_accuracy_text}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Updated method to display the Technical Data tab
    showVesselTab(vessel, tabName) {
        if (!this.vesselDetailsElement) return;
        
        // Get tab container
        const tabContainer = document.getElementById('vessel-tab-content');
        if (!tabContainer) return;
        
        // Clear existing content
        if (tabName === 'details') {
            // Already showing details tab (default view)
            return;
        }
        
        // Show appropriate content based on tab
        if (tabName === 'technical') {
            tabContainer.innerHTML = this.createTechnicalDataTab(vessel);
        } else if (tabName === 'history') {
            tabContainer.innerHTML = this.createMessageHistoryTab(vessel);
        }
    }

    // Updated technical data tab
    createTechnicalDataTab(vessel) {
        let html = `
            <div class="technical-data-content">
                <div class="technical-data-header">
                    <h3 class="technical-data-title">
                        <i class="fas fa-code"></i> Technical AIS Data
                    </h3>
                    <div class="technical-data-subtitle">
                        Showing all decoded fields from AIS message type ${vessel.msg_type || 'Unknown'}
                        ${vessel.message_description ? ` - ${vessel.message_description}` : ''}
                    </div>
                </div>
                
                <table class="technical-data-table">
                    <thead>
                        <tr>
                            <th>Field</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Group fields by category for better organization
        const categories = {
            'Basic Information': ['mmsi', 'shipname', 'callsign', 'imo_number', 'shiptype', 'shiptype_text'],
            'Position': ['lat', 'lon', 'position_accuracy', 'position_accuracy_text', 'raim_flag', 'raim_flag_text'],
            'Navigation': ['sog', 'cog', 'true_heading', 'nav_status', 'nav_status_text', 'rot', 'rot_direction', 'rot_status'],
            'Vessel Details': ['length', 'width', 'draught', 'to_bow', 'to_stern', 'to_port', 'to_starboard', 'eta', 'destination'],
            'AIS Messaging': ['msg_type', 'message_description', 'timestamp_field', 'repeat_indicator'],
            'Other': []
        };
        
        // Sort fields into categories
        const categorizedFields = {};
        
        // Initialize with empty arrays
        Object.keys(categories).forEach(category => {
            categorizedFields[category] = [];
        });
        
        // Add all vessel fields to appropriate categories
        Object.entries(vessel).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                // Handle objects separately
                return;
            }
            
            let assigned = false;
            
            // Check if field belongs to a predefined category
            for (const [category, fields] of Object.entries(categories)) {
                if (fields.includes(key)) {
                    categorizedFields[category].push({ key, value });
                    assigned = true;
                    break;
                }
            }
            
            // If not assigned to any category, put in Other
            if (!assigned) {
                categorizedFields['Other'].push({ key, value });
            }
        });
        
        // Add fields to table by category
        Object.entries(categorizedFields).forEach(([category, fields]) => {
            if (fields.length === 0) return;
            
            html += `
                <tr>
                    <td colspan="2" class="field-category">${category}</td>
                </tr>
            `;
            
            fields.forEach(({ key, value }) => {
                // Determine if value is numeric for special styling
                const isNumeric = typeof value === 'number';
                
                html += `
                    <tr>
                        <td class="field-name">${Utils.formatFieldName(key)}</td>
                        <td class="field-value ${isNumeric ? 'numeric' : 'text'}">${Utils.formatValue(value)}</td>
                    </tr>
                `;
            });
        });
        
        // Add nested objects (like communication_state)
        Object.entries(vessel).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                html += `
                    <tr>
                        <td colspan="2" class="field-category">${Utils.formatFieldName(key)}</td>
                    </tr>
                `;
                
                Object.entries(value).forEach(([subKey, subValue]) => {
                    const isNumeric = typeof subValue === 'number';
                    
                    html += `
                        <tr>
                            <td class="field-name">${Utils.formatFieldName(subKey)}</td>
                            <td class="field-value ${isNumeric ? 'numeric' : 'text'}">${Utils.formatValue(subValue)}</td>
                        </tr>
                    `;
                });
            }
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }

    // Updated message history tab
    createMessageHistoryTab(vessel) {
        let html = `
            <div class="vessel-info-card">
                <div class="vessel-info-header">
                    <h3 class="vessel-title">
                        <i class="fas fa-history"></i> Message History
                    </h3>
                </div>
                
                <div class="info-section">
                    <h4 class="section-title"><i class="fas fa-broadcast-tower"></i> Recent AIS Messages</h4>
        `;
        
        // Find messages from this vessel in the message list
        const vesselMessages = [];
        
        // Get message list
        const messageList = document.querySelector('.message-list');
        if (messageList) {
            const messageItems = messageList.querySelectorAll('.message-item');
            
            messageItems.forEach(item => {
                const contentEl = item.querySelector('.message-content');
                const decodedEl = item.querySelector('.message-decoded');
                
                if (contentEl && decodedEl) {
                    const content = contentEl.textContent;
                    const mmsiElement = decodedEl.querySelector('.message-mmsi');
                    
                    if (mmsiElement && mmsiElement.textContent === vessel.mmsi.toString()) {
                        const timestampEl = item.querySelector('.message-timestamp');
                        vesselMessages.push({
                            timestamp: timestampEl ? timestampEl.textContent : '',
                            content: content,
                            decodedInfo: decodedEl.innerHTML
                        });
                    }
                }
            });
        }
        
        if (vesselMessages.length > 0) {
            html += `
                <table class="vessel-messages-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            vesselMessages.forEach(msg => {
                html += `
                    <tr>
                        <td>${msg.timestamp}</td>
                        <td>
                            <div class="vessel-message-content">${msg.content}</div>
                            <div class="vessel-message-decoded">${msg.decodedInfo}</div>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                    </tbody>
                </table>
            `;
        } else {
            html += `
                <div class="empty-message" style="height: 200px;">
                    <i class="fas fa-broadcast-tower"></i>
                    <div>No recent messages found for this vessel</div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }

    updateVesselCount() {
        if (this.vesselCountElement) {
            this.vesselCountElement.textContent = Object.keys(this.vessels).length.toLocaleString();
        }
    }
}