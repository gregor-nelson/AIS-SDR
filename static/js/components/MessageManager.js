import * as Utils from './Utils.js';

export default class MessageManager {
    constructor(options = {}) {
        this.messageListElement = options.messageListElement;
        this.msgCountElement = options.msgCountElement;
        this.lastMessageElement = options.lastMessageElement;
        this.autoScroll = true;
        this.vessels = options.vessels || {};
    }

    init() {
        // Initialize auto-scroll toggle
        const autoScrollToggle = document.getElementById('auto-scroll-toggle');
        if (autoScrollToggle) {
            autoScrollToggle.addEventListener('click', () => {
                this.autoScroll = !this.autoScroll;
                autoScrollToggle.classList.toggle('active', this.autoScroll);
                if (this.autoScroll && this.messageListElement) {
                    Utils.scrollToBottom(this.messageListElement);
                }
            });
            
            // Set initial state
            autoScrollToggle.classList.toggle('active', this.autoScroll);
        }
        
        // Initialize clear messages button
        const clearMessages = document.getElementById('clear-messages');
        if (clearMessages) {
            clearMessages.addEventListener('click', () => {
                if (this.messageListElement) {
                    this.messageListElement.innerHTML = `
                        <div class="empty-message">
                            <i class="fas fa-broadcast-tower" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <div>No messages received yet</div>
                            <div style="font-size: 0.8rem; margin-top: 0.5rem;">Messages will appear here when received</div>
                        </div>
                    `;
                }
            });
        }
        
        return this;
    }

    addMessageToList(data) {
        if (!this.messageListElement) return;
        
        // Remove empty message placeholder if present
        const emptyMsg = this.messageListElement.querySelector('.empty-message');
        if (emptyMsg) {
            this.messageListElement.removeChild(emptyMsg);
        }
    
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        
        // Check if this is an AIS message
        const isAisMessage = data.message && (data.message.startsWith('!AIVDM') || data.message.startsWith('!AIVDO'));
        if (isAisMessage) {
            messageItem.classList.add('ais-message');
        }
        
        // Add message type specific class
        if (data.msg_type) {
            messageItem.classList.add(`msg-type-${data.msg_type}`);
            
            // Group message types
            if ([1, 2, 3].includes(data.msg_type)) {
                messageItem.classList.add('position-report-class-a');
            } else if ([4, 11].includes(data.msg_type)) {
                messageItem.classList.add('base-station-report');
            } else if (data.msg_type === 5) {
                messageItem.classList.add('static-voyage-data');
            } else if ([6, 8, 25, 26].includes(data.msg_type)) {
                messageItem.classList.add('binary-message');
            } else if ([18, 19].includes(data.msg_type)) {
                messageItem.classList.add('position-report-class-b');
            } else if (data.msg_type === 21) {
                messageItem.classList.add('aton-report');
            } else if (data.msg_type === 24) {
                messageItem.classList.add('static-data-report');
            }
        }
        
        // Build message content
        let messageContent = `
            <span class="message-timestamp">${data.timestamp}</span>
            <span class="message-source">${data.source}</span>
            <span class="message-content">${data.message}</span>
        `;
        
        // Add decoded info if available
        if (data.msg_type) {
            let decodedInfo = `<div class="message-decoded">
                <span class="message-type">Type ${data.msg_type}</span>`;
                
            if (data.mmsi) {
                decodedInfo += `<span class="message-mmsi">${data.mmsi}</span>`;
                
                // Add vessel details if available
                const vessel = this.vessels[data.mmsi];
                if (vessel && vessel.shipname) {
                    decodedInfo += `<span class="message-vessel-name">${vessel.shipname}</span>`;
                }
            }
            
            // Add message-specific decoded info
            if ([1, 2, 3, 18, 19].includes(data.msg_type) && data.latitude && data.longitude) {
                decodedInfo += `<span class="message-position">
                    <i class="fas fa-map-marker-alt"></i> ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}
                    ${data.sog !== undefined ? ` - ${data.sog.toFixed(1)} kts` : ''}
                    ${data.cog !== undefined ? ` - ${data.cog.toFixed(0)}°` : ''}
                </span>`;
            } else if (data.msg_type === 5 && data.vessel_name) {
                decodedInfo += `<span class="message-static">
                    <i class="fas fa-ship"></i> ${data.vessel_name} 
                    ${data.ship_type_text ? `(${data.ship_type_text})` : ''}
                </span>`;
            } else if (data.msg_type === 21 && data.name) {
                decodedInfo += `<span class="message-aton">
                    <i class="fas fa-map-pin"></i> ${data.name} 
                    ${data.aid_type_text ? `(${data.aid_type_text})` : ''}
                </span>`;
            } else if ([6, 8, 25, 26].includes(data.msg_type)) {
                decodedInfo += `<span class="message-binary">
                    <i class="fas fa-code"></i> Binary data 
                    ${data.binary_data_length_bits ? `(${data.binary_data_length_bits} bits)` : ''}
                </span>`;
            } else if (data.msg_type === 24) {
                decodedInfo += `<span class="message-static">
                    <i class="fas fa-info-circle"></i> 
                    ${data.part_number === 0 ? 'Name' : 'Ship data'}
                    ${data.vessel_name ? `: ${data.vessel_name}` : ''}
                </span>`;
            }
            
            decodedInfo += `</div>`;
            messageContent += decodedInfo;
        }
        
        messageItem.innerHTML = messageContent;
        
        // Add click handler to show details
        if (data.msg_type) {
            messageItem.addEventListener('click', () => {
                // Find expanded message and collapse it first
                const expandedMsg = this.messageListElement.querySelector('.message-expanded');
                if (expandedMsg && expandedMsg !== messageItem) {
                    expandedMsg.classList.remove('message-expanded');
                    const detailsDiv = expandedMsg.querySelector('.message-full-details');
                    if (detailsDiv) {
                        expandedMsg.removeChild(detailsDiv);
                    }
                }
                
                // Toggle expanded state
                if (messageItem.classList.contains('message-expanded')) {
                    // Currently expanded, collapse it
                    messageItem.classList.remove('message-expanded');
                    const detailsDiv = messageItem.querySelector('.message-full-details');
                    if (detailsDiv) {
                        messageItem.removeChild(detailsDiv);
                    }
                } else {
                    // Expand it
                    messageItem.classList.add('message-expanded');
                    
                    // Create full details div
                    const detailsDiv = document.createElement('div');
                    detailsDiv.className = 'message-full-details';
                    
                    // Add decoded message details
                    let detailsContent = `<h4>Message Type ${data.msg_type}: ${data.message_description || 'Unknown'}</h4>`;
                    
                    detailsContent += '<table class="message-details-table">';
                    
                    // Add fields in a logical order
                    const commonFields = ['mmsi', 'message_description', 'timestamp', 'source'];
                    const skipFields = ['message', 'msg_type']; // Already shown above
                    
                    // First show common fields
                    commonFields.forEach(field => {
                        if (data[field]) {
                            detailsContent += `<tr>
                                <td>${Utils.formatFieldName(field)}</td>
                                <td>${data[field]}</td>
                            </tr>`;
                        }
                    });
                    
                    // Then handle position data
                    if ([1, 2, 3, 4, 9, 18, 19, 21, 27].includes(data.msg_type)) {
                        if (data.latitude !== undefined && data.longitude !== undefined) {
                            detailsContent += `<tr class="position-field">
                                <td>Position</td>
                                <td>${data.latitude !== null ? data.latitude.toFixed(6) : 'N/A'}, 
                                    ${data.longitude !== null ? data.longitude.toFixed(6) : 'N/A'}</td>
                            </tr>`;
                        }
                        
                        // Navigation data
                        ['sog', 'cog', 'true_heading', 'rot'].forEach(field => {
                            if (data[field] !== undefined) {
                                detailsContent += `<tr>
                                    <td>${Utils.formatFieldName(field)}</td>
                                    <td>${data[field] !== null ? data[field] : 'N/A'}</td>
                                </tr>`;
                            }
                        });
                        
                        // Nav status
                        if (data.nav_status !== undefined) {
                            detailsContent += `<tr>
                                <td>Navigation Status</td>
                                <td>${data.nav_status_text || data.nav_status}</td>
                            </tr>`;
                        }
                    }
                    
                    // Static data
                    if ([5, 19, 24].includes(data.msg_type)) {
                        ['vessel_name', 'callsign', 'imo_number', 'ship_type', 'ship_type_text'].forEach(field => {
                            if (data[field]) {
                                detailsContent += `<tr>
                                    <td>${Utils.formatFieldName(field)}</td>
                                    <td>${data[field]}</td>
                                </tr>`;
                            }
                        });
                    }
                    
                    // AtoN specific
                    if (data.msg_type === 21) {
                        ['name', 'aid_type', 'aid_type_text', 'virtual_aton'].forEach(field => {
                            if (data[field] !== undefined) {
                                detailsContent += `<tr>
                                    <td>${Utils.formatFieldName(field)}</td>
                                    <td>${data[field]}</td>
                                </tr>`;
                            }
                        });
                    }
                    
                   // Add all other fields
                   Object.entries(data).forEach(([key, value]) => {
                    if (!commonFields.includes(key) && !skipFields.includes(key) && 
                        value !== undefined && typeof value !== 'object') {
                        detailsContent += `<tr>
                            <td>${Utils.formatFieldName(key)}</td>
                            <td>${value !== null ? value : 'N/A'}</td>
                        </tr>`;
                    }
                });
                
                // Handle nested objects like communication_state
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                        detailsContent += `<tr class="object-header">
                            <td colspan="2">${Utils.formatFieldName(key)}</td>
                        </tr>`;
                        
                        Object.entries(value).forEach(([subKey, subValue]) => {
                            detailsContent += `<tr class="object-field">
                                <td>${Utils.formatFieldName(subKey)}</td>
                                <td>${subValue !== null ? subValue : 'N/A'}</td>
                            </tr>`;
                        });
                    }
                });
                
                detailsContent += '</table>';
                
                // Add actions
                if (data.mmsi) {
                    detailsContent += `
                        <div class="message-actions">
                            <button class="message-action-button" onclick="selectVessel('${data.mmsi}')">View Vessel</button>
                            <button class="message-action-button" onclick="centerMapOnVessel('${data.mmsi}')">Show on Map</button>
                        </div>
                    `;
                }
                
                detailsDiv.innerHTML = detailsContent;
                messageItem.appendChild(detailsDiv);
            }
        });
    }
    
    this.messageListElement.appendChild(messageItem);
    
    // Limit to 500 messages to prevent memory issues
    if (this.messageListElement.children.length > 500) {
        this.messageListElement.removeChild(this.messageListElement.firstChild);
    }
    
    // Add animation for new messages
    setTimeout(() => {
        messageItem.classList.add('new-message');
        setTimeout(() => messageItem.classList.remove('new-message'), 2000);
    }, 10);
    
    // Auto scroll if enabled
    if (this.autoScroll && this.messageListElement) {
        Utils.scrollToBottom(this.messageListElement);
    }
    
    // Update last message
    if (this.lastMessageElement) {
        this.lastMessageElement.textContent = `${data.timestamp} - ${data.message}`;
    }
}

setVessels(vessels) {
    this.vessels = vessels;
}
}