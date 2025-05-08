import MapController from './components/MapController.js';
import VesselManager from './components/VesselManager.js';
import MessageManager from './components/MessageManager.js';
import SocketController from './components/SocketController.js';
import UIController from './components/UIController.js';
import ResizablePanels from './components/ResizablePanels.js';
import FullscreenPanels from './components/FullscreenPanels.js';
import * as Utils from './components/Utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const messageList = document.getElementById('message-list');
    const vesselList = document.getElementById('vessel-list');
    const vesselDetails = document.getElementById('vessel-details');
    const selectedVesselText = document.getElementById('selected-vessel');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const msgCount = document.getElementById('msg-count');
    const vesselCount = document.getElementById('vessel-count');
    const msgRate = document.getElementById('msg-rate');
    const uptime = document.getElementById('uptime');
    const lastMessage = document.getElementById('last-message');
    const serverTime = document.getElementById('server-time');
    
    // Filter elements
    const vesselSearch = document.getElementById('vessel-search');
    const vesselSort = document.getElementById('vessel-sort');
    const showStaleVesselsToggle = document.getElementById('show-stale-vessels');
    const vesselClassFilter = document.getElementById('vessel-class-filter');
    const vesselStatusFilter = document.getElementById('vessel-status-filter');
    const minSpeedFilter = document.getElementById('min-speed-filter');
    const maxSpeedFilter = document.getElementById('max-speed-filter');
    const applySpeedFilterBtn = document.getElementById('apply-speed-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const toggleAdvancedFiltersBtn = document.getElementById('toggle-advanced-filters');
    const filteredCountEl = document.getElementById('filtered-count');

    // Initialize resizable panels and fullscreen functionality
    const resizablePanels = new ResizablePanels().init();
    const fullscreenPanels = new FullscreenPanels().init();

    // Initialize map controller
    const mapController = new MapController('map').init();

    // Initialize UI controller
    const uiController = new UIController({
        msgRateElement: msgRate,
        uptimeElement: uptime,
        serverTimeElement: serverTime,
        startTime: Date.now()
    }).init();

    // Initialize vessel manager
    const vesselManager = new VesselManager({
        vesselListElement: vesselList,
        vesselDetailsElement: vesselDetails,
        selectedVesselTextElement: selectedVesselText,
        vesselCountElement: vesselCount,
        filteredCountElement: filteredCountEl,
        mapController: mapController,
        vesselSearch: vesselSearch,
        vesselSort: vesselSort,
        showStaleVesselsToggle: showStaleVesselsToggle,
        vesselClassFilter: vesselClassFilter,
        vesselStatusFilter: vesselStatusFilter,
        minSpeedFilter: minSpeedFilter,
        maxSpeedFilter: maxSpeedFilter,
        applySpeedFilterBtn: applySpeedFilterBtn,
        clearFiltersBtn: clearFiltersBtn,
        toggleAdvancedFiltersBtn: toggleAdvancedFiltersBtn
    }).init();

    // Initialize message manager
    const messageManager = new MessageManager({
        messageListElement: messageList,
        msgCountElement: msgCount,
        lastMessageElement: lastMessage,
        vessels: vesselManager.vessels
    }).init();

    // Set up MapController callbacks
    mapController.onToggleHideNoPosition = () => vesselManager.toggleHideNoPosition();

    // Initialize socket controller with callbacks
    const socketController = new SocketController({
        statusIndicator: statusIndicator,
        statusText: statusText,
        onConnect: () => {
            uiController.setStartTime(Date.now());
        },
        onInitialData: (data) => {
            // Process vessels
            if (data.vessels && data.vessels.length > 0) {
                data.vessels.forEach(vessel => {
                    vesselManager.vessels[vessel.mmsi] = vessel;
                });
                vesselManager.updateVesselList();
                vesselManager.updateVesselCount();
                mapController.setVessels(vesselManager.vessels);
                mapController.updateAllMarkers();
            }

            // Process recent messages
            if (data.recent_messages && data.recent_messages.length > 0) {
                if (messageList) messageList.innerHTML = ''; // Clear "no messages" placeholder
                data.recent_messages.forEach(msg => {
                    messageManager.addMessageToList(msg);
                });
                if (messageManager.autoScroll && messageList) {
                    Utils.scrollToBottom(messageList);
                }
            }

            // Update stats
            if (data.stats) {
                if (msgCount) msgCount.textContent = data.stats.message_count.toLocaleString();
                if (vesselCount) vesselCount.textContent = data.stats.vessel_count.toLocaleString();
                uiController.setStartTime(Date.now() - (data.stats.uptime * 1000));
            }
        },
        onMessage: (data) => {
            messageManager.addMessageToList(data);
            uiController.incrementMessageCount();
            
            // Update UI elements
            if (msgCount) {
                const currentCount = parseInt(msgCount.textContent.replace(/,/g, ''));
                msgCount.textContent = (currentCount + 1).toLocaleString();
                
                // Add highlight effect
                uiController.applyStatHighlight(msgCount);
            }
            
            if (lastMessage) {
                lastMessage.textContent = `${data.timestamp} - ${data.message}`;
            }
            
            // Auto scroll if enabled
            if (messageManager.autoScroll && messageList) {
                Utils.scrollToBottom(messageList);
            }
        },
        onAisUpdate: (data) => {
            // Update vessel data
            if (data.mmsi) {
                // If vessel doesn't exist yet, create it
                if (!vesselManager.vessels[data.mmsi]) {
                    vesselManager.vessels[data.mmsi] = { mmsi: data.mmsi };
                }
                
                // Merge new data with existing data
                vesselManager.vessels[data.mmsi] = { ...vesselManager.vessels[data.mmsi], ...data };
                
                // Update marker on map
                mapController.setVessels(vesselManager.vessels);
                mapController.updateVesselMarker(data.mmsi, vesselManager.vessels[data.mmsi]);
                
                // Update details panel if this is the selected vessel
                if (vesselManager.selectedVessel === data.mmsi) {
                    vesselManager.displayVesselDetails(data.mmsi);
                }
                
                // Update message manager's vessel reference
                messageManager.setVessels(vesselManager.vessels);
            }
        },
        onVesselUpdate: (data) => {
            // Completely replace vessel list
            vesselManager.vessels = {};
            
            data.forEach(vessel => {
                vesselManager.vessels[vessel.mmsi] = vessel;
            });
            
            // Update UI
            vesselManager.updateVesselList();
            vesselManager.updateVesselCount();
            
            // Update map
            mapController.setVessels(vesselManager.vessels);
            mapController.updateAllMarkers();
            
            // Update message manager's vessel reference
            messageManager.setVessels(vesselManager.vessels);
        }
    }).init();

    // Make selectVessel available globally for popup links
    window.selectVessel = function(mmsi) {
        vesselManager.selectVessel(mmsi);
    };
    
    // Make centerMapOnVessel available globally for popup links
    window.centerMapOnVessel = function(mmsi) {
        mapController.centerOnVessel(mmsi);
    };
    
    // Display initial empty states
    if (messageList && messageList.children.length === 0) {
        messageList.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-broadcast-tower" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <div>No messages received yet</div>
                <div style="font-size: 0.8rem; margin-top: 0.5rem;">Messages will appear here when received</div>
            </div>
        `;
    }
    
    if (vesselList && vesselList.children.length === 0) {
        vesselList.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-ship" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <div>No vessels detected yet</div>
            </div>
        `;
    }
    
    // Handle panel resizing and fullscreen events
    window.addEventListener('resize', () => {
        // Update resizer positions when window size changes
        if (resizablePanels) {
            resizablePanels.updateResizerPositions();
        }
    });
    
    // Handle panel fullscreen events
    document.addEventListener('panel:fullscreen', (e) => {
        const { panel, state } = e.detail;
        
        // For map panel, trigger a map resize when fullscreen changes
        if (panel.classList.contains('map-panel')) {
            if (mapController && mapController.map) {
                // Give time for the DOM to update
                setTimeout(() => {
                    mapController.map.invalidateSize();
                }, 100);
            }
        }
    });
    
    // Custom event for panel resize end
    document.addEventListener('panel:resize:end', () => {
        // Invalidate map size to ensure proper rendering after resize
        if (mapController && mapController.map) {
            mapController.map.invalidateSize();
        }
    });
    
    // Emit a resize:end event when resizing stops
    document.addEventListener('mouseup', () => {
        if (resizablePanels && resizablePanels.isDragging) {
            // Delay to ensure resize has completed
            setTimeout(() => {
                const event = new CustomEvent('panel:resize:end');
                document.dispatchEvent(event);
            }, 100);
        }
    });
    
    console.log('AIS Decoder Dashboard initialized with resizable panels');
});