export default class SocketController {
    constructor(options = {}) {
        this.url = options.url || '';
        this.socket = null;
        this.connected = false;
        this.statusIndicator = options.statusIndicator;
        this.statusText = options.statusText;
        this.onConnect = options.onConnect;
        this.onDisconnect = options.onDisconnect;
        this.onInitialData = options.onInitialData;
        this.onMessage = options.onMessage;
        this.onAisUpdate = options.onAisUpdate;
        this.onVesselUpdate = options.onVesselUpdate;
    }

    init() {
        this.socket = io({
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            this.connected = true;
            this.updateConnectionStatus();
            console.log('Connected to server');
            if (typeof this.onConnect === 'function') {
                this.onConnect();
            }
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.updateConnectionStatus();
            console.log('Disconnected from server');
            this.handleSocketDisconnect();
            if (typeof this.onDisconnect === 'function') {
                this.onDisconnect();
            }
        });

        this.socket.on('initial_data', (data) => {
            console.log('Received initial data', data);
            if (typeof this.onInitialData === 'function') {
                this.onInitialData(data);
            }
        });

        this.socket.on('nmea_message', (data) => {
            if (typeof this.onMessage === 'function') {
                this.onMessage(data);
            }
        });

        this.socket.on('ais_update', (data) => {
            if (typeof this.onAisUpdate === 'function') {
                this.onAisUpdate(data);
            }
        });

        this.socket.on('vessel_update', (data) => {
            if (typeof this.onVesselUpdate === 'function') {
                this.onVesselUpdate(data);
            }
        });
        
        return this;
    }

    updateConnectionStatus() {
        if (this.statusIndicator) {
            this.statusIndicator.className = this.connected ? 'status-connected' : 'status-disconnected';
        }
        if (this.statusText) {
            this.statusText.textContent = this.connected ? 'Connected' : 'Disconnected';
        }
    }

    handleSocketDisconnect() {
        // Try to reconnect automatically
        let reconnectAttempt = 0;
        const maxReconnectAttempts = 5;
        const reconnectInterval = 5000; // 5 seconds
        
        const attemptReconnect = () => {
            if (this.connected) return; // Already reconnected
            
            reconnectAttempt++;
            console.log(`Attempting to reconnect (${reconnectAttempt}/${maxReconnectAttempts})...`);
            if (this.statusText) {
                this.statusText.textContent = `Reconnecting (${reconnectAttempt}/${maxReconnectAttempts})...`;
            }
            
            // Try to reconnect
            this.socket.connect();
            
            // If still not connected after timeout and not reached max attempts, try again
            setTimeout(() => {
                if (!this.connected && reconnectAttempt < maxReconnectAttempts) {
                    attemptReconnect();
                } else if (!this.connected && this.statusText) {
                    this.statusText.textContent = 'Disconnected (refresh page to retry)';
                }
            }, reconnectInterval);
        };
        
        // Start reconnection process
        attemptReconnect();
    }
}