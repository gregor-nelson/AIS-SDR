#!/usr/bin/env python3
"""
AIS NMEA Message Decoder with Flask Web UI
"""

import argparse
import socket
import threading
import time
import os
import json
import atexit
from flask import Flask, render_template, jsonify, request, send_file, send_from_directory
from flask_socketio import SocketIO
from io import BytesIO
from PIL import Image, ImageDraw

# Import your existing AIS decoder
from ais_decoder import AISDecoder

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ais-decoder-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
udp_listener = None
ais_decoder = None
ais_vessels = {}
recent_messages = []
message_count = 0
start_time = time.time()  # Initialize start time globally

class UDPListener(threading.Thread):
    """Thread to listen for UDP messages and broadcast to connected clients"""
    
    def __init__(self, host='127.0.0.1', port=10111):
        super().__init__(daemon=True)
        self.host = host
        self.port = port
        self.running = False
        
    def run(self):
        """Run the UDP listener"""
        self.running = True
        
        # Create UDP socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        
        try:
            # Set socket options
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Bind to the port
            sock.bind(('', self.port))
            
            print(f"UDP listener started. Receiving messages on port {self.port}")
        except Exception as e:
            print(f"Error setting up UDP listener: {e}")
            print("Starting in demo mode...")
            self._run_demo_mode()
            return
        
        sock.settimeout(0.5)  # Set timeout to check self.running periodically
        
        while self.running:
            try:
                data, addr = sock.recvfrom(1024)
                message = data.decode('utf-8', errors='replace').strip()
                print(f"Received from {addr}: {message}")
                process_message(message, addr[0])
            except socket.timeout:
                continue
            except Exception as e:
                print(f"Error receiving UDP message: {e}")
        
        sock.close()
        print("UDP listener stopped")
    
    def _run_demo_mode(self):
        """Generate demo AIS messages for testing"""
        print("Running in demo mode - generating test messages")
        
        # Real AIS message samples covering different message types
        sample_messages = [
            # Message Type 1 - Position Report Class A
            "!AIVDM,1,1,,A,13HOI:0P0000VOHLCnHQKwvL05Ip,0*23",
            "!AIVDM,1,1,,A,133sVfPP00PD;88MD5E`0?vN2D9>,0*25",
            "!AIVDM,1,1,,A,13aEOK?P00PD2wVMdLDRhgvL289?,0*26",
            
            # Message Type 5 - Static and Voyage Data
            "!AIVDM,2,1,3,A,53nFBv01SJ<thHp6220H4heHTf2222222222221?50:454o<`9QSlUDp,0*09",
            "!AIVDM,2,2,3,A,8888888888880,2*2E",
            
            # Message Type 18 - Standard Class B Position Report
            "!AIVDM,1,1,,A,B43JRq00LhVQW?WA9BpK?w`UOQUP,0*4A",
            
            # Message Type 19 - Extended Class B Position Report
            "!AIVDM,1,1,,B,C69DqmP0=uwR9IwTRwwN?w`UPQ8F,0*60",
            
            # Message Type 21 - Aid to Navigation Report
            "!AIVDM,1,1,,A,E>jHC:k9Wkcc5k`Y`4lh0`0B4ljE84i<D?p<74i<Dk,2*7F",
            
            # Message Type 24 - Static Data Report (Part A - Name)
            "!AIVDM,1,1,,A,H3P?fMT0000000000000000000000,2*6B",
            
            # Message Type 24 - Static Data Report (Part B - Static Data)
            "!AIVDM,1,1,,B,H3P?fMl5F5CD;tJA4A:>00000000,0*1C",
            
            # Message Type 4 - Base Station Report
            "!AIVDM,1,1,,A,403OweAuRn;IeWGI0000000000,0*78",
            
            # Message Type 8 - Binary Broadcast Message
            "!AIVDM,1,1,,B,85Mwp`1Kf3aCnsNvBWLi=wQuNhA5t43N3t;kn3Dp,0*47",
            
            # Simulate vessel movement with varying locations
            "!AIVDM,1,1,,A,13aEOK?P00PD2wVMdLDRhgvL289?,0*26",
            "!AIVDM,1,1,,A,13aEOK?P00PD3wWMdLFRhgvN289?,0*58",
            "!AIVDM,1,1,,A,13aEOK?P00PD4wXMdLHRhgvP289?,0*32",
        ]
        
        import random
        
        # Generate a few random vessel movements
        message_index = 0
        while self.running:
            # Send current message
            process_message(sample_messages[message_index], "demo")
            
            # Move to next message, wrap around at the end
            message_index = (message_index + 1) % len(sample_messages)
            
            # Occasionally send a multipart message
            if message_index == 0 and random.random() < 0.3:
                process_message("!AIVDM,2,1,3,A,53nFBv01SJ<thHp6220H4heHTf2222222222221?50:454o<`9QSlUDp,0*09", "demo")
                time.sleep(0.5)  # Brief pause between parts
                process_message("!AIVDM,2,2,3,A,8888888888880,2*2E", "demo")
            
            # Random sleep between 1-4 seconds
            time.sleep(random.uniform(1, 4))
    
    def stop(self):
        """Stop the UDP listener thread"""
        print("Stopping UDP listener...")
        self.running = False

def process_message(message, source_ip):
    """Process and decode AIS messages with enhanced error handling and logging"""
    global recent_messages, message_count, ais_decoder
    
    # Add to recent messages with timestamp
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    recent_messages.append({
        'timestamp': timestamp,
        'message': message,
        'source': source_ip
    })
    
    # Keep only the most recent messages (increased from 100 to 200)
    if len(recent_messages) > 200:
        recent_messages = recent_messages[-200:]
    
    message_count += 1
    
    # Broadcast the raw message to all connected clients
    socketio.emit('nmea_message', {
        'timestamp': timestamp,
        'message': message,
        'source': source_ip
    })
    
    # Clean up old multipart messages periodically based on time
    current_time = time.time()
    if not hasattr(process_message, 'last_cleanup') or current_time - getattr(process_message, 'last_cleanup', 0) > 60:
        ais_decoder.cleanup_old_multipart()
        process_message.last_cleanup = current_time
    
    # Decode AIS message if applicable
    if message.startswith('!AIVDM') or message.startswith('!AIVDO'):
        try:
            # Use the AIS decoder
            decoded = ais_decoder.parse_nmea_message(message)
            
            # Skip partial messages or failed decodes
            if not decoded:
                print(f"No data decoded from message: {message}")
                return
                
            if decoded.get('partial'):
                print(f"Partial message received, waiting for more fragments: {message}")
                return
                
            # Add timestamp and source to decoded message
            decoded['timestamp'] = timestamp
            decoded['source'] = source_ip
            
            # Enhanced message type handling
            if 'msg_type' in decoded:
                message_type = decoded['msg_type']
                if message_type in ais_decoder.MESSAGE_TYPES:
                    decoded['message_type'] = ais_decoder.MESSAGE_TYPES[message_type]
                else:
                    decoded['message_type'] = f"Unknown message type {message_type}"
                
                # Log specific message types for debugging
                if message_type in [5, 19, 24]:  # Static data messages
                    if 'vessel_name' in decoded:
                        print(f"Vessel static data received: MMSI={decoded.get('mmsi')}, Name={decoded.get('vessel_name')}")
            
            # Get MMSI
            if 'mmsi' in decoded:
                # Update vessel information
                update_vessel_info(decoded)
                
                # Broadcast the decoded message
                socketio.emit('ais_update', decoded)
                    
        except Exception as e:
            import traceback
            print(f"Error decoding AIS message: {e}")
            print(traceback.format_exc())

def update_vessel_info(decoded_message):
    """Update the vessel information with enhanced type-specific processing"""
    global ais_vessels
    
    # Extract MMSI from decoded message
    mmsi = decoded_message.get('mmsi')
    if not mmsi:
        return
        
    msg_type = decoded_message.get('msg_type')
    
    # Update or add vessel info
    if mmsi not in ais_vessels:
        ais_vessels[mmsi] = {
            'mmsi': mmsi,
            'first_seen': time.time(),
            'message_count': 0
        }
    
    # Increment message count for this vessel
    if 'message_count' in ais_vessels[mmsi]:
        ais_vessels[mmsi]['message_count'] += 1
    else:
        ais_vessels[mmsi]['message_count'] = 1
    
    # Create a vessel record with the most important fields
    vessel_info = {
        'mmsi': mmsi,
        'last_update': time.time(),
        'last_message': decoded_message.get('message_type')
    }
    
    # Process based on message type for most accurate data
    
    # Position Reports (Types 1, 2, 3, 18, 19, 27)
    if msg_type in [1, 2, 3, 18, 19, 27]:
        if 'latitude' in decoded_message and 'longitude' in decoded_message:
            if decoded_message['latitude'] is not None and decoded_message['longitude'] is not None:
                vessel_info['lat'] = decoded_message['latitude']
                vessel_info['lon'] = decoded_message['longitude']
                vessel_info['position_timestamp'] = decoded_message['timestamp']
                vessel_info['position_accuracy'] = decoded_message.get('position_accuracy')
                
        # Navigation data
        for field in ['sog', 'cog', 'true_heading', 'nav_status', 'rot', 'rot_direction']:
            if field in decoded_message and decoded_message[field] is not None:
                vessel_info[field] = decoded_message[field]
                
        # Add text versions of fields if available
        for field in ['nav_status_text', 'rot_status', 'sog_status', 'cog_status']:
            if field in decoded_message:
                vessel_info[field] = decoded_message[field]
                
    # Static Voyage Data (Type 5)
    elif msg_type == 5:
        # Ship details
        for field in ['vessel_name', 'callsign', 'imo_number', 'ship_type', 'eta', 'destination', 'draught']:
            if field in decoded_message and decoded_message[field] is not None:
                vessel_info[field] = decoded_message[field]
                
        # Make vessel name and callsign more user-friendly
        if 'vessel_name' in decoded_message and decoded_message['vessel_name']:
            vessel_info['shipname'] = decoded_message['vessel_name'].strip()
        
        if 'callsign' in decoded_message and decoded_message['callsign']:
            vessel_info['callsign'] = decoded_message['callsign'].strip()
            
        # Add ship type text explanation
        if 'ship_type' in decoded_message and 'ship_type_text' in decoded_message:
            vessel_info['shiptype'] = decoded_message['ship_type']
            vessel_info['shiptype_text'] = decoded_message['ship_type_text']
            
        # Dimensions
        for dim in ['to_bow', 'to_stern', 'to_port', 'to_starboard']:
            if dim in decoded_message:
                vessel_info[dim] = decoded_message[dim]
                
        # Calculate length and width if possible
        if all(dim in vessel_info for dim in ['to_bow', 'to_stern']):
            vessel_info['length'] = vessel_info['to_bow'] + vessel_info['to_stern']
            
        if all(dim in vessel_info for dim in ['to_port', 'to_starboard']):
            vessel_info['width'] = vessel_info['to_port'] + vessel_info['to_starboard']
    
    # Static Data Report (Type 24)
    elif msg_type == 24:
        # Get what data we can from this type
        for field in ['vessel_name', 'callsign', 'ship_type', 'to_bow', 'to_stern', 'to_port', 'to_starboard']:
            if field in decoded_message and decoded_message[field] is not None:
                vessel_info[field] = decoded_message[field]
        
        # Text fields
        for field in ['ship_type_text', 'epfd_type_text']:
            if field in decoded_message:
                vessel_info[field] = decoded_message[field]
                
        # Process vessel name for display
        if 'vessel_name' in decoded_message and decoded_message['vessel_name']:
            vessel_info['shipname'] = decoded_message['vessel_name'].strip()
        
        # Process ship type for display
        if 'ship_type' in decoded_message and 'ship_type_text' in decoded_message:
            vessel_info['shiptype'] = decoded_message['ship_type']
            vessel_info['shiptype_text'] = decoded_message['ship_type_text']
    
    # Aid to Navigation Report (Type 21)
    elif msg_type == 21:
        # Mark as AtoN
        vessel_info['is_aton'] = True
        
        if 'name' in decoded_message:
            vessel_info['aton_name'] = decoded_message['name']
            vessel_info['shipname'] = decoded_message['name']  # For compatibility
            
        # Store AtoN type
        if 'aid_type' in decoded_message:
            vessel_info['aton_type'] = decoded_message['aid_type']
            
        if 'aid_type_text' in decoded_message:
            vessel_info['aton_type_text'] = decoded_message['aid_type_text']
            vessel_info['shiptype_text'] = f"AtoN: {decoded_message['aid_type_text']}"  # For compatibility
        
        # Position
        if 'latitude' in decoded_message and 'longitude' in decoded_message:
            if decoded_message['latitude'] is not None and decoded_message['longitude'] is not None:
                vessel_info['lat'] = decoded_message['latitude']
                vessel_info['lon'] = decoded_message['longitude']
                vessel_info['position_timestamp'] = decoded_message['timestamp']
                
        # Virtual flag
        if 'virtual_aton' in decoded_message:
            vessel_info['virtual_aton'] = decoded_message['virtual_aton']
    
    # Base Station Report (Type 4)
    elif msg_type == 4:
        vessel_info['is_base_station'] = True
        
        # Update shiptype_text for display
        vessel_info['shiptype_text'] = 'Base Station'
        
        # Position
        if 'latitude' in decoded_message and 'longitude' in decoded_message:
            if decoded_message['latitude'] is not None and decoded_message['longitude'] is not None:
                vessel_info['lat'] = decoded_message['latitude']
                vessel_info['lon'] = decoded_message['longitude']
                vessel_info['position_timestamp'] = decoded_message['timestamp']
                
    # Store the raw message type for filtering
    vessel_info['msg_type'] = msg_type
    
    # Preserve additional fields we want to display
    for field in ['epfd_type_text', 'class_b_unit_text', 'raim_flag_text', 'virtual_aton']:
        if field in decoded_message:
            vessel_info[field] = decoded_message[field]
    
    # Check for age out - if a vessel hasn't been updated in 15 minutes, mark it as potentially stale
    vessel_age = time.time() - vessel_info['last_update']
    if vessel_age > 900:  # 15 minutes
        vessel_info['stale'] = True
    else:
        vessel_info['stale'] = False
            
    # Update the vessel record
    ais_vessels[mmsi].update(vessel_info)
    
    # Broadcast updated vessel list to avoid overloading clients
    # Only send on significant updates or periodically
    new_vessel = 'first_seen' in vessel_info and ais_vessels[mmsi]['message_count'] <= 1
    static_data_update = msg_type in [5, 24]
    
    if new_vessel or static_data_update or message_count % 20 == 0:
        socketio.emit('vessel_update', get_vessels_list())

def get_vessels_list():
    """Get a list of all tracked vessels"""
    return [vessel for vessel in ais_vessels.values()]

def start_background_tasks():
    """Start background tasks for maintenance"""
    thread = threading.Thread(target=periodic_cleanup)
    thread.daemon = True
    thread.start()
    
def periodic_cleanup():
    """Periodically clean up stale vessels and other maintenance tasks"""
    global ais_vessels
    
    while True:
        try:
            # Clean up any stale vessels (no updates in 60 minutes)
            current_time = time.time()
            stale_threshold = current_time - 3600  # 1 hour
            
            vessels_to_remove = []
            for mmsi, vessel in ais_vessels.items():
                last_update = vessel.get('last_update', 0)
                if last_update < stale_threshold:
                    vessels_to_remove.append(mmsi)
            
            # Remove stale vessels
            if vessels_to_remove:
                print(f"Removing {len(vessels_to_remove)} stale vessels")
                for mmsi in vessels_to_remove:
                    del ais_vessels[mmsi]
                
                # Notify clients of the updated vessel list
                socketio.emit('vessel_update', get_vessels_list())
            
            # Clean up multipart messages
            ais_decoder.cleanup_old_multipart()
            
        except Exception as e:
            print(f"Error in periodic cleanup: {e}")
            
        # Sleep for 5 minutes
        time.sleep(300)

@app.route('/')
def index():
    """Render the main dashboard page"""
    return render_template('index.html')


@app.route('/static/js/<path:filename>')
def serve_js(filename):
    try:
        # Be explicit about the directory path
        directory_path = os.path.join(app.root_path, 'static', 'js')
        response = send_from_directory(directory_path, filename)
        # Force the correct MIME type
        response.headers['Content-Type'] = 'application/javascript'
        return response
    except Exception as e:
        print(f"Error serving JS file: {e}")
        return f"File not found: {filename}", 404

@app.route('/vessel-icon/<vessel_type>')
def vessel_icon(vessel_type):
    """Generate a simple PNG icon for vessel based on vessel type"""
    # Map vessel type to color
    color_map = {
        'passenger': (255, 0, 0),      # Red
        'cargo': (0, 128, 0),          # Green
        'tanker': (165, 42, 42),       # Brown
        'fishing': (0, 0, 255),        # Blue
        'pleasure': (255, 165, 0),     # Orange
        'sailing': (128, 0, 128),      # Purple
        'military': (128, 128, 128),   # Gray
        'hsc': (255, 255, 0),          # Yellow
        'tug': (0, 255, 255),          # Cyan
        'sar': (255, 0, 255),          # Magenta
        'aton': (255, 105, 180),       # Hot pink
        'aton-virtual': (255, 182, 193), # Light pink
        'basestation': (0, 255, 255),  # Cyan
        'default': (0, 0, 0)           # Black
    }
    
    # Check for stale suffix
    stale = False
    if vessel_type.endswith('-stale'):
        stale = True
        vessel_type = vessel_type[:-6]  # Remove -stale suffix
    
    # Check for class B suffix
    class_b = False
    if vessel_type.endswith('-classb'):
        class_b = True
        vessel_type = vessel_type[:-7]  # Remove -classb suffix
    
    # Determine color based on vessel type
    vessel_type = vessel_type.lower()
    color = color_map.get(vessel_type, color_map['default'])
    
    # Create a different shape based on vessel type
    img = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    if vessel_type == 'aton' or vessel_type == 'aton-virtual':
        # Diamond shape for AtoN
        if vessel_type == 'aton-virtual':
            # Hollow diamond for virtual AtoN
            draw.polygon([(12, 2), (22, 12), (12, 22), (2, 12)], outline=color, fill=(0, 0, 0, 0), width=2)
        else:
            # Solid diamond for physical AtoN
            draw.polygon([(12, 2), (22, 12), (12, 22), (2, 12)], fill=color)
    elif vessel_type == 'basestation':
        # Square for base station
        draw.rectangle([(4, 4), (20, 20)], fill=color)
    elif class_b:
        # Circle for Class B vessels
        draw.ellipse([(2, 2), (22, 22)], fill=color)
    else:
        # Triangle for normal vessels (pointing up)
        draw.polygon([(12, 2), (22, 22), (2, 22)], fill=color)
    
    # If vessel is stale, add a gray outline
    if stale:
        if vessel_type == 'aton' and vessel_type != 'aton-virtual':
            # For AtoN, add X through it
            draw.line([(4, 4), (20, 20)], fill=(128, 128, 128), width=2)
            draw.line([(4, 20), (20, 4)], fill=(128, 128, 128), width=2)
        elif vessel_type == 'basestation':
            # For base station, add outline
            draw.rectangle([(4, 4), (20, 20)], outline=(128, 128, 128), width=2)
        elif class_b:
            # For Class B, add outline
            draw.ellipse([(2, 2), (22, 22)], outline=(128, 128, 128), width=2)
        else:
            # For normal vessels, add outline
            draw.polygon([(12, 2), (22, 22), (2, 22)], outline=(128, 128, 128), width=2)
    
    # Save to BytesIO
    img_io = BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    
    return send_file(img_io, mimetype='image/png')

@app.route('/api/stats')
def get_stats():
    """Get current statistics"""
    return jsonify({
        'message_count': message_count,
        'vessel_count': len(ais_vessels),
        'uptime': int(time.time() - start_time)
    })

@app.route('/api/stats/extended')
def get_extended_stats():
    """Get extended statistics about the AIS data"""
    # Count message types
    message_types = {}
    vessel_classes = {
        'class_a': 0,
        'class_b': 0,
        'aton': 0,
        'base_station': 0,
        'other': 0
    }
    
    for vessel in ais_vessels.values():
        # Count vessel classes
        if vessel.get('is_aton'):
            vessel_classes['aton'] += 1
        elif vessel.get('is_base_station'):
            vessel_classes['base_station'] += 1
        elif vessel.get('class_b_unit_text'):
            vessel_classes['class_b'] += 1
        else:
            # Assume Class A if not explicitly marked
            vessel_classes['class_a'] += 1
        
        # Count last message types
        msg_type = vessel.get('msg_type')
        if msg_type:
            msg_type_str = str(msg_type)
            if msg_type_str in message_types:
                message_types[msg_type_str] += 1
            else:
                message_types[msg_type_str] = 1
    
    return jsonify({
        'message_count': message_count,
        'vessel_count': len(ais_vessels),
        'uptime': int(time.time() - start_time),
        'message_types': message_types,
        'vessel_classes': vessel_classes
    })

@app.route('/api/messages/recent')
def get_recent_messages():
    """Get most recent NMEA messages"""
    return jsonify(recent_messages)

@app.route('/api/vessels')
def get_vessels():
    """Get all tracked vessels"""
    return jsonify(get_vessels_list())

@app.route('/api/vessels/by-type')
def get_vessels_by_type():
    """Get vessels grouped by type"""
    vessel_types = {}
    
    for vessel in ais_vessels.values():
        if vessel.get('is_aton'):
            vessel_type = "Aid to Navigation"
        elif vessel.get('is_base_station'):
            vessel_type = "Base Station"
        else:
            vessel_type = vessel.get('shiptype_text', 'Unknown')
        
        if vessel_type not in vessel_types:
            vessel_types[vessel_type] = []
            
        vessel_types[vessel_type].append({
            'mmsi': vessel.get('mmsi'),
            'name': vessel.get('shipname', 'Unknown'),
            'lat': vessel.get('lat'),
            'lon': vessel.get('lon')
        })
    
    return jsonify(vessel_types)

@app.route('/api/vessels/<mmsi>')
def get_vessel_detail(mmsi):
    """Get detailed information about a specific vessel"""
    if mmsi in ais_vessels:
        return jsonify(ais_vessels[mmsi])
    else:
        return jsonify({'error': 'Vessel not found'}), 404

@app.route('/api/vessels/search')
def search_vessels():
    """Search vessels by name, mmsi, or other criteria"""
    query = request.args.get('q', '').lower()
    results = []
    
    if not query:
        return jsonify([])
    
    for vessel in ais_vessels.values():
        # Search in name, mmsi, and callsign
        name = vessel.get('shipname', '').lower()
        mmsi = str(vessel.get('mmsi', '')).lower()
        callsign = vessel.get('callsign', '').lower()
        
        if query in name or query in mmsi or query in callsign:
            results.append(vessel)
    
    return jsonify(results)

@app.route('/api/vessel_types')
def get_vessel_types():
    """Get a summary of vessel types being tracked"""
    type_count = {}
    
    for vessel in ais_vessels.values():
        # Get appropriate type
        if vessel.get('is_aton'):
            vessel_type = "Aid to Navigation"
        elif vessel.get('is_base_station'):
            vessel_type = "Base Station"
        else:
            vessel_type = vessel.get('shiptype_text', 'Unknown')
            
        if vessel_type in type_count:
            type_count[vessel_type] += 1
        else:
            type_count[vessel_type] = 1
    
    return jsonify([{"type": k, "count": v} for k, v in type_count.items()])

@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connection"""
    print(f"Client connected")
    
    # Send initial data to the new client
    socketio.emit('initial_data', {
        'recent_messages': recent_messages,
        'vessels': get_vessels_list(),
        'stats': {
            'message_count': message_count,
            'vessel_count': len(ais_vessels),
            'uptime': int(time.time() - start_time)
        }
    }, room=request.sid)

def cleanup():
    """Cleanup resources when application exits"""
    global udp_listener
    if udp_listener and udp_listener.is_alive():
        udp_listener.stop()
        print("UDP listener shutdown complete")

if __name__ == '__main__':
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='AIS NMEA Message Decoder Web Interface')
    parser.add_argument('--port', type=int, default=10111, help='UDP port to listen on (default: 10111)')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host address to bind to (default: 127.0.0.1)')
    parser.add_argument('--web-port', type=int, default=5000, help='Web server port (default: 5000)')
    parser.add_argument('--web-host', type=str, default='0.0.0.0', help='Web server host (default: 0.0.0.0)')
    parser.add_argument('--debug', action='store_true', help='Enable Flask debug mode')
    parser.add_argument('--cleanup-interval', type=int, default=300, help='Seconds between cleanup operations (default: 300)')
    args = parser.parse_args()
    
    # Record start time
    start_time = time.time()
    
    # Register cleanup handler
    atexit.register(cleanup)
    
    # Initialize AIS decoder
    ais_decoder = AISDecoder()
    print("AIS Decoder initialized")
    
    # Start background tasks
    start_background_tasks()
    print("Background maintenance tasks started")
    
    # Start UDP listener
    udp_listener = UDPListener(host=args.host, port=args.port)
    udp_listener.start()
    print(f"UDP listener started on {args.host}:{args.port}")
    
    # Start Flask web server
    print(f"Starting web server on http://{args.web_host}:{args.web_port}")
    socketio.run(app, host=args.web_host, port=args.web_port, debug=args.debug)