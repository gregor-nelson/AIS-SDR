# AIS-SDR

Real-time AIS (Automatic Identification System) message decoder with web-based vessel tracking dashboard.

<img width="1364" height="640" alt="image" src="https://github.com/user-attachments/assets/983a352f-8637-4d49-8394-db8fa464ddf5" />


## Overview

Decodes NMEA 0183 AIS messages and displays vessel positions and data through a web interface. Supports all standard AIS message types with real-time updates via WebSocket.

**Features:**
- AIS message decoding (ITU-R M.1371-5 standard)
- Interactive map with vessel positions and tracks
- Real-time message stream display
- Vessel filtering and search
- UDP message ingestion
- Demo mode with sample data

## Implementation

### Backend
- **AIS Decoder** (`ais_decoder.py`): ITU-R M.1371-5 compliant message parsing with support for all message types 1-27
- **Flask Application** (`app.py`): Web server with Socket.IO for real-time updates, UDP listener, and REST API
- **Message Processing**: Handles multipart messages, vessel state tracking, and data cleanup

### Frontend
- **JavaScript Modules**: MapController (Leaflet), VesselManager, MessageManager, SocketController
- **Interface**: Resizable panels, real-time statistics, vessel filtering, message stream viewer
- **Mapping**: Interactive vessel positions with custom markers and heading indicators

## Usage

### Setup
```bash
pip install flask flask-socketio pillow bitstring
python app.py
```

### Configuration
```bash
# Custom UDP port and web interface
python app.py --port 10111 --web-port 8080 --web-host 0.0.0.0

# Bind to specific network interface  
python app.py --host 192.168.1.100
```

### Data Sources
Accepts NMEA 0183 AIS messages via UDP. Compatible with SDR applications (rtl_ais, AIS-catcher), commercial receivers, and AIS data feeds. Includes demo mode with sample traffic when no external source is available.

PyInstaller spec included for standalone executable builds.

## Technical Details

**Protocol Support:** ITU-R M.1371-5 AIS standard, message types 1-27  
**Backend:** Python Flask with Socket.IO, UDP networking  
**Frontend:** Vanilla JavaScript ES6 modules, Leaflet mapping  
**Performance:** Real-time message processing, tested with 500+ concurrent vessels  

**Architecture:**
- Modular component design
- WebSocket real-time updates  
- Multipart message handling
- Automatic data cleanup and vessel state management
