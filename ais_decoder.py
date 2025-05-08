"""
AIS NMEA Message Decoder - Enhanced implementation following ITU-R M.1371-5
"""
import re
import datetime
import bitstring
from enum import Enum, IntEnum
from typing import Dict, List, Optional, Tuple, Union, Any
import logging


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("AISDecoder")


class AISMessageType(IntEnum):
    """AIS Message Types according to ITU-R M.1371-5"""
    POSITION_REPORT_CLASS_A_SCHEDULED = 1
    POSITION_REPORT_CLASS_A_ASSIGNED = 2
    POSITION_REPORT_CLASS_A_RESPONSE = 3
    BASE_STATION_REPORT = 4
    STATIC_AND_VOYAGE_DATA = 5
    BINARY_ADDRESSED_MESSAGE = 6
    BINARY_ACKNOWLEDGE = 7
    BINARY_BROADCAST_MESSAGE = 8
    STANDARD_SAR_AIRCRAFT_POSITION = 9
    UTC_DATE_INQUIRY = 10
    UTC_DATE_RESPONSE = 11
    ADDRESSED_SAFETY_MESSAGE = 12
    SAFETY_ACKNOWLEDGE = 13
    SAFETY_BROADCAST_MESSAGE = 14
    INTERROGATION = 15
    ASSIGNMENT_MODE_COMMAND = 16
    DGNSS_BROADCAST_MESSAGE = 17
    STANDARD_CLASS_B_POSITION_REPORT = 18
    EXTENDED_CLASS_B_POSITION_REPORT = 19
    DATA_LINK_MANAGEMENT = 20
    AID_TO_NAVIGATION_REPORT = 21
    CHANNEL_MANAGEMENT = 22
    GROUP_ASSIGNMENT_COMMAND = 23
    STATIC_DATA_REPORT = 24
    SINGLE_SLOT_BINARY_MESSAGE = 25
    MULTIPLE_SLOT_BINARY_MESSAGE = 26
    POSITION_REPORT_LONG_RANGE = 27


class AISNavigationStatus(IntEnum):
    """Navigation Status according to ITU-R M.1371-5"""
    UNDER_WAY_ENGINE = 0
    AT_ANCHOR = 1
    NOT_UNDER_COMMAND = 2
    RESTRICTED_MANEUVERABILITY = 3
    CONSTRAINED_BY_DRAUGHT = 4
    MOORED = 5
    AGROUND = 6
    ENGAGED_IN_FISHING = 7
    UNDER_WAY_SAILING = 8
    RESERVED_HSC = 9
    RESERVED_WIG = 10
    RESERVED_1 = 11
    RESERVED_2 = 12
    RESERVED_3 = 13
    AIS_SART_ACTIVE = 14
    UNDEFINED = 15


class AISManeuverIndicator(IntEnum):
    """Special Maneuver Indicator"""
    NOT_AVAILABLE = 0
    NOT_ENGAGED = 1
    ENGAGED = 2


class AISEPFDType(IntEnum):
    """Type of Electronic Position Fixing Device"""
    UNDEFINED = 0
    GPS = 1
    GLONASS = 2
    GPS_GLONASS = 3
    LORAN_C = 4
    CHAYKA = 5
    INTEGRATED = 6
    SURVEYED = 7
    GALILEO = 8
    # 9-14 reserved
    INTERNAL_GNSS = 15


class AISStationType(IntEnum):
    """Station Type for Group Assignment"""
    ALL_MOBILES = 0
    CLASS_A_ONLY = 1
    ALL_CLASS_B = 2
    SAR_AIRBORNE = 3
    CLASS_B_SO = 4
    CLASS_B_CS = 5
    INLAND_WATERWAYS = 6
    # 7-9 regional use
    BASE_STATION_COVERAGE = 10
    # 11-15 future use


class AISSyncState(IntEnum):
    """Synchronization State"""
    UTC_DIRECT = 0
    UTC_INDIRECT = 1
    BASE_STATION_SYNC = 2
    OTHER_STATION_SYNC = 3


class AISNavAid(IntEnum):
    """Aid to Navigation Type"""
    DEFAULT = 0
    REFERENCE_POINT = 1
    RACON = 2
    FIXED_OFFSHORE = 3
    EMERGENCY_WRECK = 4
    LIGHT_NO_SECTORS = 5
    LIGHT_WITH_SECTORS = 6
    LEADING_LIGHT_FRONT = 7
    LEADING_LIGHT_REAR = 8
    BEACON_CARDINAL_N = 9
    BEACON_CARDINAL_E = 10
    BEACON_CARDINAL_S = 11
    BEACON_CARDINAL_W = 12
    BEACON_PORT = 13
    BEACON_STARBOARD = 14
    BEACON_PREFERRED_PORT = 15
    BEACON_PREFERRED_STARBOARD = 16
    BEACON_ISOLATED_DANGER = 17
    BEACON_SAFE_WATER = 18
    BEACON_SPECIAL_MARK = 19
    CARDINAL_MARK_N = 20
    CARDINAL_MARK_E = 21
    CARDINAL_MARK_S = 22
    CARDINAL_MARK_W = 23
    PORT_HAND_MARK = 24
    STARBOARD_HAND_MARK = 25
    PREFERRED_CHANNEL_PORT = 26
    PREFERRED_CHANNEL_STARBOARD = 27
    ISOLATED_DANGER = 28
    SAFE_WATER = 29
    SPECIAL_MARK = 30
    LIGHT_VESSEL = 31


class AISDecoder:
    """Enhanced AIS NMEA decoder following ITU-R M.1371-5 specification"""
    
    # Navigation status lookup table
    NAV_STATUS = {
        0: "Under way using engine",
        1: "At anchor",
        2: "Not under command",
        3: "Restricted maneuverability",
        4: "Constrained by her draught",
        5: "Moored",
        6: "Aground",
        7: "Engaged in Fishing",
        8: "Under way sailing",
        9: "Reserved for future amendment (HSC)",
        10: "Reserved for future amendment (WIG)",
        11: "Reserved for future use",
        12: "Reserved for future use",
        13: "Reserved for future use",
        14: "AIS-SART (active), MOB-AIS, EPIRB-AIS",
        15: "Not defined (default)"
    }

    # Ship type lookup table
    SHIP_TYPE = {
        0: "Not available",
        1: "Reserved for future use",
        2: "WIG (Wing in Ground)",
        3: "Vessel",
        4: "HSC (High Speed Craft)",
        5: "See above",
        6: "Passenger ship",
        7: "Cargo ship",
        8: "Tanker",
        9: "Other",
        10: "Reserved for future use",
        11: "Reserved for future use",
        12: "Reserved for future use",
        13: "Reserved for future use",
        14: "Reserved for future use",
        15: "Reserved for future use",
        16: "Reserved for future use",
        17: "Reserved for future use",
        18: "Reserved for future use",
        19: "Reserved for future use",
        20: "WIG - Hazardous category A",
        21: "WIG - Hazardous category B",
        22: "WIG - Hazardous category C",
        23: "WIG - Hazardous category D",
        24: "WIG - Reserved for future use",
        25: "WIG - Reserved for future use",
        26: "WIG - Reserved for future use",
        27: "WIG - Reserved for future use",
        28: "WIG - Reserved for future use",
        29: "WIG - Reserved for future use",
        30: "Fishing",
        31: "Towing",
        32: "Towing: length exceeds 200m or breadth exceeds 25m",
        33: "Dredging or underwater operations",
        34: "Diving operations",
        35: "Military operations",
        36: "Sailing",
        37: "Pleasure Craft",
        38: "Reserved",
        39: "Reserved",
        40: "HSC - No hazardous goods",
        41: "HSC - Hazardous category A",
        42: "HSC - Hazardous category B",
        43: "HSC - Hazardous category C",
        44: "HSC - Hazardous category D",
        45: "HSC - Reserved for future use",
        46: "HSC - Reserved for future use",
        47: "HSC - Reserved for future use",
        48: "HSC - Reserved for future use",
        49: "HSC - Reserved for future use",
        50: "Pilot Vessel",
        51: "Search and Rescue vessel",
        52: "Tug",
        53: "Port Tender",
        54: "Anti-pollution equipment",
        55: "Law Enforcement",
        56: "Spare - Local Vessel",
        57: "Spare - Local Vessel",
        58: "Medical Transport",
        59: "Non-combatant ship according to RR Resolution No. 18",
        60: "Passenger, all ships of this type",
        61: "Passenger, Hazardous category A",
        62: "Passenger, Hazardous category B",
        63: "Passenger, Hazardous category C",
        64: "Passenger, Hazardous category D",
        65: "Passenger, Reserved for future use",
        66: "Passenger, Reserved for future use",
        67: "Passenger, Reserved for future use",
        68: "Passenger, Reserved for future use",
        69: "Passenger, Reserved for future use",
        70: "Cargo, all ships of this type",
        71: "Cargo, Hazardous category A",
        72: "Cargo, Hazardous category B",
        73: "Cargo, Hazardous category C",
        74: "Cargo, Hazardous category D",
        75: "Cargo, Reserved for future use",
        76: "Cargo, Reserved for future use",
        77: "Cargo, Reserved for future use",
        78: "Cargo, Reserved for future use",
        79: "Cargo, Reserved for future use",
        80: "Tanker, all ships of this type",
        81: "Tanker, Hazardous category A",
        82: "Tanker, Hazardous category B",
        83: "Tanker, Hazardous category C",
        84: "Tanker, Hazardous category D",
        85: "Tanker, Reserved for future use",
        86: "Tanker, Reserved for future use",
        87: "Tanker, Reserved for future use",
        88: "Tanker, Reserved for future use",
        89: "Tanker, Reserved for future use",
        90: "Other Type, all ships of this type",
        91: "Other Type, Hazardous category A",
        92: "Other Type, Hazardous category B",
        93: "Other Type, Hazardous category C",
        94: "Other Type, Hazardous category D",
        95: "Other Type, Reserved for future use",
        96: "Other Type, Reserved for future use",
        97: "Other Type, Reserved for future use",
        98: "Other Type, Reserved for future use",
        99: "Other Type, no additional information"
    }

    # Message type description lookup table
    MESSAGE_TYPES = {
        1: "Position Report Class A",
        2: "Position Report Class A (Assigned schedule)",
        3: "Position Report Class A (Response to interrogation)",
        4: "Base Station Report",
        5: "Static and Voyage Related Data",
        6: "Binary Addressed Message",
        7: "Binary Acknowledge",
        8: "Binary Broadcast Message",
        9: "Standard SAR Aircraft Position Report",
        10: "UTC and Date Inquiry",
        11: "UTC and Date Response",
        12: "Addressed Safety Related Message",
        13: "Safety Related Acknowledgement",
        14: "Safety Related Broadcast Message",
        15: "Interrogation",
        16: "Assignment Mode Command",
        17: "DGNSS Binary Broadcast Message",
        18: "Standard Class B CS Position Report",
        19: "Extended Class B Equipment Position Report",
        20: "Data Link Management",
        21: "Aid-to-Navigation Report",
        22: "Channel Management",
        23: "Group Assignment Command",
        24: "Static Data Report",
        25: "Single Slot Binary Message",
        26: "Multiple Slot Binary Message With Communications State",
        27: "Position Report For Long-Range Applications"
    }

    # EPFD types
    EPFD_TYPES = {
        0: "Undefined",
        1: "GPS",
        2: "GLONASS",
        3: "Combined GPS/GLONASS",
        4: "Loran-C",
        5: "Chayka",
        6: "Integrated navigation system",
        7: "Surveyed",
        8: "Galileo",
        9: "Not used",
        10: "Not used",
        11: "Not used",
        12: "Not used",
        13: "Not used",
        14: "Not used",
        15: "Internal GNSS"
    }

    # AtoN Types
    ATON_TYPES = {
        0: "Default, Type of AtoN not specified",
        1: "Reference point",
        2: "RACON",
        3: "Fixed structure off shore",
        4: "Emergency Wreck Marking Buoy",
        5: "Light, without sectors",
        6: "Light, with sectors",
        7: "Leading Light Front",
        8: "Leading Light Rear",
        9: "Beacon, Cardinal N",
        10: "Beacon, Cardinal E",
        11: "Beacon, Cardinal S",
        12: "Beacon, Cardinal W",
        13: "Beacon, Port hand",
        14: "Beacon, Starboard hand",
        15: "Beacon, Preferred Channel port hand",
        16: "Beacon, Preferred Channel starboard hand",
        17: "Beacon, Isolated danger",
        18: "Beacon, Safe water",
        19: "Beacon, Special mark",
        20: "Cardinal Mark N",
        21: "Cardinal Mark E",
        22: "Cardinal Mark S",
        23: "Cardinal Mark W",
        24: "Port hand Mark",
        25: "Starboard hand Mark",
        26: "Preferred Channel Port hand",
        27: "Preferred Channel Starboard hand",
        28: "Isolated danger",
        29: "Safe Water",
        30: "Special Mark",
        31: "Light Vessel/LANBY/Rigs"
    }
    
    # Store multi-part messages for reassembly
    multipart_messages = {}

    @staticmethod
    def validate_and_convert_coordinates(lon_raw, lat_raw):
        """
        Validates and converts raw longitude and latitude values from AIS messages
        Standard format (1/10000 min) as used in messages 1, 2, 3, 4, 5, 9, 18, 19, 21
        """
        decoded = {}
        
        # Check longitude (181° = not available)
        if lon_raw == 0x6791AC0 or lon_raw == 108600000:  # 181 * 60 * 10000 = 108600000
            decoded['longitude'] = None
            decoded['longitude_status'] = "Not available"
        else:
            # Convert from 1/10,000 min to decimal degrees
            lon_deg = lon_raw / (60.0 * 10000.0)
            
            # Check if in valid range
            if -180 <= lon_deg <= 180:
                decoded['longitude'] = lon_deg
                decoded['longitude_status'] = "Valid"
            else:
                decoded['longitude'] = None
                decoded['longitude_status'] = "Invalid value"
        
        # Check latitude (91° = not available)
        if lat_raw == 0x3412140 or lat_raw == 54600000:  # 91 * 60 * 10000 = 54600000
            decoded['latitude'] = None
            decoded['latitude_status'] = "Not available"
        else:
            # Convert from 1/10,000 min to decimal degrees
            lat_deg = lat_raw / (60.0 * 10000.0)
            
            # Check if in valid range
            if -90 <= lat_deg <= 90:
                decoded['latitude'] = lat_deg
                decoded['latitude_status'] = "Valid"
            else:
                decoded['latitude'] = None
                decoded['latitude_status'] = "Invalid value"
                
        return decoded

    @staticmethod
    def validate_and_convert_coordinates_tenth_minute(lon_raw, lat_raw):
        """
        Validates and converts raw longitude and latitude values
        Format: 1/10 min as used in messages 22, 23
        """
        decoded = {}
        
        # Check longitude (181° = not available)
        if lon_raw == 181 * 10:  # 181 * 10 = 1810
            decoded['longitude'] = None
            decoded['longitude_status'] = "Not available"
        else:
            # Convert from 1/10 minute to decimal degrees
            lon_deg = lon_raw / (60.0 * 10.0)
            
            # Check if in valid range
            if -180 <= lon_deg <= 180:
                decoded['longitude'] = lon_deg
                decoded['longitude_status'] = "Valid"
            else:
                decoded['longitude'] = None
                decoded['longitude_status'] = "Invalid value"
        
        # Check latitude (91° = not available)
        if lat_raw == 91 * 10:  # 91 * 10 = 910
            decoded['latitude'] = None
            decoded['latitude_status'] = "Not available"
        else:
            # Convert from 1/10 minute to decimal degrees
            lat_deg = lat_raw / (60.0 * 10.0)
            
            # Check if in valid range
            if -90 <= lat_deg <= 90:
                decoded['latitude'] = lat_deg
                decoded['latitude_status'] = "Valid"
            else:
                decoded['latitude'] = None
                decoded['latitude_status'] = "Invalid value"
                
        return decoded

    @staticmethod
    def validate_and_convert_coordinates_long_range(lon_raw, lat_raw):
        """
        Validates and converts raw longitude and latitude values
        Format: 1/10 min as used in message 27 (long range position report)
        """
        decoded = {}
        
        # Check longitude (181° = not available)
        if lon_raw == 0x1A838 or lon_raw == 108600:  # 181 * 600 = 108600
            decoded['longitude'] = None
            decoded['longitude_status'] = "Position older than 6 hours or not available"
        else:
            # Convert from 1/10 minute to decimal degrees
            lon_deg = lon_raw / 600.0  # 60 * 10 = 600
            
            # Check if in valid range
            if -180 <= lon_deg <= 180:
                decoded['longitude'] = lon_deg
                decoded['longitude_status'] = "Valid"
            else:
                decoded['longitude'] = None
                decoded['longitude_status'] = "Invalid value"
        
        # Check latitude (91° = not available)
        if lat_raw == 0xD548 or lat_raw == 54600:  # 91 * 600 = 54600
            decoded['latitude'] = None
            decoded['latitude_status'] = "Position older than 6 hours or not available"
        else:
            # Convert from 1/10 minute to decimal degrees
            lat_deg = lat_raw / 600.0  # 60 * 10 = 600
            
            # Check if in valid range
            if -90 <= lat_deg <= 90:
                decoded['latitude'] = lat_deg
                decoded['latitude_status'] = "Valid"
            else:
                decoded['latitude'] = None
                decoded['latitude_status'] = "Invalid value"
                
        return decoded

    @staticmethod
    def validate_and_convert_coordinates_dgnss(lon_raw, lat_raw):
        """
        Validates and converts raw longitude and latitude values
        Format: 1/10 min as used in message 17 (DGNSS broadcast)
        """
        decoded = {}
        
        # Check longitude (181° = not available)
        if lon_raw == 18100:  # Special value for DGNSS
            decoded['longitude'] = None
            decoded['longitude_status'] = "Not available"
        else:
            # Convert from 1/10 minute to decimal degrees
            lon_deg = lon_raw / 600.0  # 60 * 10 = 600
            
            # Check if in valid range
            if -180 <= lon_deg <= 180:
                decoded['longitude'] = lon_deg
                decoded['longitude_status'] = "Valid"
            else:
                decoded['longitude'] = None
                decoded['longitude_status'] = "Invalid value"
        
        # Check latitude (91° = not available)
        if lat_raw == 9100:  # Special value for DGNSS
            decoded['latitude'] = None
            decoded['latitude_status'] = "Not available"
        else:
            # Convert from 1/10 minute to decimal degrees
            lat_deg = lat_raw / 600.0  # 60 * 10 = 600
            
            # Check if in valid range
            if -90 <= lat_deg <= 90:
                decoded['latitude'] = lat_deg
                decoded['latitude_status'] = "Valid"
            else:
                decoded['latitude'] = None
                decoded['latitude_status'] = "Invalid value"
                
        return decoded

    @staticmethod
    def validate_and_convert_coordinates_area(ne_lon, ne_lat, sw_lon, sw_lat, format_type="tenth_minute"):
        """
        Validates and converts two sets of coordinates (NE and SW corners) for area messages
        format_type: "tenth_minute" for Messages 22, 23
                    "standard" for standard format (1/10000 min)
        """
        decoded = {}
        
        # Choose the appropriate conversion factor
        if format_type == "tenth_minute":
            divider = 600.0  # 60 * 10 = 600 (1/10 min to degrees)
            na_lon = 181 * 10  # 1810
            na_lat = 91 * 10   # 910
        else:  # standard
            divider = 600000.0  # 60 * 10000 = 600000 (1/10000 min to degrees)
            na_lon = 181 * 60 * 10000  # 108600000
            na_lat = 91 * 60 * 10000   # 54600000
        
        # Northeast corner
        # Check longitude
        if ne_lon == na_lon:
            decoded['ne_longitude'] = None
            decoded['ne_longitude_status'] = "Not available"
        else:
            # Convert to decimal degrees
            ne_lon_deg = ne_lon / divider
            
            # Check if in valid range
            if -180 <= ne_lon_deg <= 180:
                decoded['ne_longitude'] = ne_lon_deg
                decoded['ne_longitude_status'] = "Valid"
            else:
                decoded['ne_longitude'] = None
                decoded['ne_longitude_status'] = "Invalid value"
        
        # Check latitude
        if ne_lat == na_lat:
            decoded['ne_latitude'] = None
            decoded['ne_latitude_status'] = "Not available"
        else:
            # Convert to decimal degrees
            ne_lat_deg = ne_lat / divider
            
            # Check if in valid range
            if -90 <= ne_lat_deg <= 90:
                decoded['ne_latitude'] = ne_lat_deg
                decoded['ne_latitude_status'] = "Valid"
            else:
                decoded['ne_latitude'] = None
                decoded['ne_latitude_status'] = "Invalid value"
        
        # Southwest corner
        # Check longitude
        if sw_lon == na_lon:
            decoded['sw_longitude'] = None
            decoded['sw_longitude_status'] = "Not available"
        else:
            # Convert to decimal degrees
            sw_lon_deg = sw_lon / divider
            
            # Check if in valid range
            if -180 <= sw_lon_deg <= 180:
                decoded['sw_longitude'] = sw_lon_deg
                decoded['sw_longitude_status'] = "Valid"
            else:
                decoded['sw_longitude'] = None
                decoded['sw_longitude_status'] = "Invalid value"
        
        # Check latitude
        if sw_lat == na_lat:
            decoded['sw_latitude'] = None
            decoded['sw_latitude_status'] = "Not available"
        else:
            # Convert to decimal degrees
            sw_lat_deg = sw_lat / divider
            
            # Check if in valid range
            if -90 <= sw_lat_deg <= 90:
                decoded['sw_latitude'] = sw_lat_deg
                decoded['sw_latitude_status'] = "Valid"
            else:
                decoded['sw_latitude'] = None
                decoded['sw_latitude_status'] = "Invalid value"
        
        return decoded

    @staticmethod
    def decode_sixbit_ascii(bits, start_pos, length):
        """
        Decode a 6-bit ASCII string from the AIS bitstring
        per Table 47 of ITU-R M.1371-5
        """
        result = ""
        for i in range(length):
            if start_pos + (i+1)*6 <= len(bits):
                char_code = bits[start_pos + i*6:start_pos + (i+1)*6].uint
                if char_code == 0:  # @ symbol
                    char = "@"
                elif char_code <= 31:  # 1-31 maps to A-Z,[]\_^
                    char = chr(char_code + 64)
                elif char_code <= 63:  # 32-63 maps to space,!"-9:;<=>?
                    char = chr(char_code)
                else:
                    logger.warning(f"Invalid 6-bit ASCII character code: {char_code}")
                    char = "?"
                result += char
        return result.strip("@").strip()  # Remove trailing @ padding and spaces

    @staticmethod
    def get_positions_dimensions(bits, start_bit):
        """Extract dimension and reference position fields"""
        dim_a = bits[start_bit:start_bit+9].uint  # To bow
        dim_b = bits[start_bit+9:start_bit+18].uint  # To stern
        dim_c = bits[start_bit+18:start_bit+24].uint  # To port
        dim_d = bits[start_bit+24:start_bit+30].uint  # To starboard
        
        dimensions = {}
        
        # Check for special cases
        if dim_a == 0 and dim_b == 0 and dim_c == 0 and dim_d == 0:
            dimensions["dimensions_status"] = "Not available or virtual AtoN"
        elif dim_a == 0 and dim_c == 0 and dim_b > 0 and dim_d > 0:
            dimensions["dimensions_status"] = "Reference point not available, ship dimensions provided"
        else:
            dimensions["dimensions_status"] = "Normal reference point and dimensions"
            
        # Calculate dimensions
        if dim_a > 0 or dim_b > 0:
            dimensions["length"] = dim_a + dim_b
            dimensions["ref_point_distance_from_bow"] = dim_a
            dimensions["ref_point_distance_from_stern"] = dim_b
        
        if dim_c > 0 or dim_d > 0:
            dimensions["width"] = dim_c + dim_d
            dimensions["ref_point_distance_from_port"] = dim_c
            dimensions["ref_point_distance_from_starboard"] = dim_d
            
        return dimensions

    @staticmethod
    def decode_communication_state(bits, comm_state_flag, start_bit):
        """
        Decode SOTDMA or ITDMA communication state
        according to sections 3.3.7.2.1 and 3.3.7.3.2 of ITU-R M.1371-5
        """
        comm_state = {}
        
        # Decode the sync state for both types
        comm_state["sync_state"] = bits[start_bit:start_bit+2].uint
        comm_state["sync_state_text"] = {
            0: "UTC Direct",
            1: "UTC Indirect",
            2: "Base station synchronized",
            3: "Other station synchronized"
        }.get(comm_state["sync_state"], "Unknown")
        
        if comm_state_flag == 0:  # SOTDMA
            # Get the slot time-out
            slot_timeout = bits[start_bit+2:start_bit+5].uint
            comm_state["slot_timeout"] = slot_timeout
            
            # The submessage depends on the slot_timeout value
            if slot_timeout in [3, 5, 7]:
                # Number of received stations
                rcv_stations = bits[start_bit+5:start_bit+19].uint
                comm_state["received_stations"] = rcv_stations
            elif slot_timeout in [2, 4, 6]:
                # Slot number
                slot_number = bits[start_bit+5:start_bit+19].uint
                comm_state["slot_number"] = slot_number
            elif slot_timeout == 1:
                # UTC hour and minute
                hour = bits[start_bit+5:start_bit+10].uint
                minute = bits[start_bit+10:start_bit+17].uint
                # Last 2 bits are not used
                comm_state["utc_hour"] = hour if hour <= 23 else None
                comm_state["utc_minute"] = minute if minute <= 59 else None
            elif slot_timeout == 0:
                # Slot offset
                slot_offset = bits[start_bit+5:start_bit+19].uint
                comm_state["slot_offset"] = slot_offset
        else:  # ITDMA
            # Get slot increment, number of slots, and keep flag
            slot_increment = bits[start_bit+2:start_bit+15].uint
            num_slots = bits[start_bit+15:start_bit+18].uint
            keep_flag = bits[start_bit+18:start_bit+19].uint
            
            comm_state["slot_increment"] = slot_increment
            
            # Decode number of slots according to Table 20 in section 3.3.7.3.2
            if num_slots <= 4:
                comm_state["number_of_slots"] = num_slots + 1
            elif num_slots <= 7:
                comm_state["number_of_slots"] = (num_slots - 4) + 1
                comm_state["slot_offset"] = slot_increment + 8192
            
            comm_state["keep_flag"] = keep_flag == 1
            
        return comm_state

    @staticmethod
    def decode_time_stamp(ts_value):
        """Decode time stamp field according to ITU-R M.1371-5"""
        if ts_value == 60:
            return "Not available"
        elif ts_value == 61:
            return "Manual input mode"
        elif ts_value == 62:
            return "Dead reckoning mode"
        elif ts_value == 63:
            return "Positioning system inoperative"
        elif 0 <= ts_value <= 59:
            return ts_value
        else:
            return "Invalid time stamp value"

    @staticmethod
    def decode_payload(payload):
        """
        Decode the AIS payload with enhanced vessel name extraction and
        support for all message types
        """
        # Convert ASCII to 6-bit binary
        binary_data = ""
        for char in payload:
            # Convert each character to its 6-bit value
            if ord(char) >= 48 and ord(char) <= 119:
                # Valid AIS character range is ASCII 48-119
                # Shift by 48 as per AIS encoding rules
                six_bit_value = (ord(char) - 48) & 0x3F
                binary_data += format(six_bit_value, '06b')
            else:
                logger.warning(f"Character '{char}' not in AIS valid range")
                # Use a placeholder bit sequence
                binary_data += "000000"
        
        # Create a bitstring for easier bit manipulation
        bits = bitstring.BitArray(bin=binary_data)
        
        # Get message type (first 6 bits)
        if len(bits) < 6:
            logger.error("Payload too short for valid message")
            return {"error": "Payload too short for valid message"}
            
        message_type = bits[0:6].uint
        
        # Basic info for all message types
        decoded = {
            'msg_type': message_type,
            'repeat_indicator': bits[6:8].uint if len(bits) >= 8 else 0,
            'mmsi': bits[8:38].uint if len(bits) >= 38 else 0,
        }
        
        # Add current timestamp if not provided in metadata
        now = datetime.datetime.now()
        decoded['timestamp'] = now.strftime("%Y%m%d%H%M%S")
        
        # Add message type description
        if message_type in AISDecoder.MESSAGE_TYPES:
            decoded['message_description'] = AISDecoder.MESSAGE_TYPES[message_type]
        else:
            decoded['message_description'] = "Unknown message type"
        
        # Further decoding based on message type
        try:
            # Position Report Class A (Messages 1, 2, 3)
            if message_type in [1, 2, 3] and len(bits) >= 168:
                decoded.update(AISDecoder._decode_position_report_class_a(bits))
                
            # Base Station Report / UTC Response (Messages 4, 11)
            elif message_type in [4, 11] and len(bits) >= 168:
                decoded.update(AISDecoder._decode_base_station_report(bits))
                
            # Static and Voyage Related Data (Message 5)
            elif message_type == 5 and len(bits) >= 424:
                decoded.update(AISDecoder._decode_static_voyage_data(bits))
                
            # Binary Messages (Messages 6, 8, 25, 26)
            elif message_type in [6, 8, 25, 26]:
                decoded.update(AISDecoder._decode_binary_message(bits, message_type))
                
            # Binary Acknowledge (Message 7) or Safety Acknowledge (Message 13)
            elif message_type in [7, 13]:
                decoded.update(AISDecoder._decode_acknowledge(bits, message_type))
                
            # Standard SAR Aircraft Position Report (Message 9)
            elif message_type == 9 and len(bits) >= 168:
                decoded.update(AISDecoder._decode_sar_position(bits))
                
            # UTC Date Inquiry (Message 10)
            elif message_type == 10 and len(bits) >= 72:
                decoded.update(AISDecoder._decode_utc_inquiry(bits))
                
            # Safety Related Messages (Messages 12, 14)
            elif message_type in [12, 14]:
                decoded.update(AISDecoder._decode_safety_message(bits, message_type))
                
            # Interrogation (Message 15)
            elif message_type == 15:
                decoded.update(AISDecoder._decode_interrogation(bits))
                
            # Assignment Mode Command (Message 16)
            elif message_type == 16 and len(bits) >= 96:
                decoded.update(AISDecoder._decode_assignment_command(bits))
                
            # DGNSS Broadcast Binary Message (Message 17)
            elif message_type == 17:
                decoded.update(AISDecoder._decode_dgnss_broadcast(bits))
                
            # Standard Class B Position Report (Message 18)
            elif message_type == 18 and len(bits) >= 168:
                decoded.update(AISDecoder._decode_position_report_class_b(bits))
                
            # Extended Class B Position Report (Message 19)
            elif message_type == 19 and len(bits) >= 312:
                decoded.update(AISDecoder._decode_extended_position_class_b(bits))
                
            # Data Link Management (Message 20)
            elif message_type == 20:
                decoded.update(AISDecoder._decode_data_link_management(bits))
                
            # Aid-to-Navigation Report (Message 21)
            elif message_type == 21:
                decoded.update(AISDecoder._decode_aid_navigation_report(bits))
                
            # Channel Management (Message 22)
            elif message_type == 22 and len(bits) >= 168:
                decoded.update(AISDecoder._decode_channel_management(bits))
                
            # Group Assignment Command (Message 23)
            elif message_type == 23 and len(bits) >= 160:
                decoded.update(AISDecoder._decode_group_assignment(bits))
                
            # Static Data Report (Message 24)
            elif message_type == 24:
                decoded.update(AISDecoder._decode_static_data_report(bits))
                
            # Position Report For Long-Range Applications (Message 27)
            elif message_type == 27 and len(bits) >= 96:
                decoded.update(AISDecoder._decode_long_range_position(bits))
                
            else:
                logger.warning(f"Message type {message_type} with length {len(bits)} bits not properly decoded")
                decoded['not_decoded'] = True
                
        except Exception as e:
            logger.error(f"Error decoding message type {message_type}: {str(e)}")
            decoded['error'] = str(e)
            
        return decoded

    @staticmethod
    def _decode_position_report_class_a(bits):
        """
        Decode Position Report Class A (Messages 1, 2, 3)
        according to Table 48 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Navigation Status
        nav_status = bits[38:42].uint
        decoded['nav_status'] = nav_status
        decoded['nav_status_text'] = AISDecoder.NAV_STATUS.get(nav_status, "Unknown")
        
        # Rate of Turn
        rot_raw = bits[42:50].int
        decoded['rot_raw'] = rot_raw
        
        # Convert ROT to degrees per minute
        if rot_raw == -128:  # -128 indicates not available
            decoded['rot'] = None
            decoded['rot_status'] = "Not available"
        elif rot_raw == 0:
            decoded['rot'] = 0
            decoded['rot_status'] = "No turn"
        else:
            # Apply the formula from ITU-R M.1371-5
            if rot_raw > 0:
                decoded['rot'] = (rot_raw / 4.733) ** 2
                decoded['rot_direction'] = "Right"
            else:
                decoded['rot'] = -((-rot_raw / 4.733) ** 2)
                decoded['rot_direction'] = "Left"
            
            # Special values
            if rot_raw == 127:
                decoded['rot_status'] = "Turning right at more than 5°/30s"
            elif rot_raw == -127:
                decoded['rot_status'] = "Turning left at more than 5°/30s"
            else:
                decoded['rot_status'] = "Normal"
        
        # Speed over ground
        sog_raw = bits[50:60].uint
        if sog_raw == 1023:
            decoded['sog'] = None
            decoded['sog_status'] = "Not available"
        elif sog_raw == 1022:
            decoded['sog'] = 102.2
            decoded['sog_status'] = "102.2 knots or higher"
        else:
            decoded['sog'] = sog_raw / 10.0
            decoded['sog_status'] = "Valid"
        
        # Position accuracy
        pos_accuracy = bits[60:61].uint
        decoded['position_accuracy'] = pos_accuracy
        decoded['position_accuracy_text'] = "High (≤10m)" if pos_accuracy == 1 else "Low (>10m)"
        
        # Longitude and latitude
        lon_raw = bits[61:89].int
        lat_raw = bits[89:116].int
        decoded.update(AISDecoder.validate_and_convert_coordinates(lon_raw, lat_raw))
        
        # Course over ground
        cog_raw = bits[116:128].uint
        if cog_raw == 3600:
            decoded['cog'] = None
            decoded['cog_status'] = "Not available"
        elif 3601 <= cog_raw <= 4095:
            decoded['cog'] = None
            decoded['cog_status'] = "Invalid value"
        else:
            decoded['cog'] = cog_raw / 10.0
            decoded['cog_status'] = "Valid"
        
        # True heading
        hdg_raw = bits[128:137].uint
        if hdg_raw == 511:
            decoded['true_heading'] = None
            decoded['true_heading_status'] = "Not available"
        elif hdg_raw > 359:
            decoded['true_heading'] = None
            decoded['true_heading_status'] = "Invalid value"
        else:
            decoded['true_heading'] = hdg_raw
            decoded['true_heading_status'] = "Valid"
        
        # Time stamp
        ts_value = bits[137:143].uint
        decoded['timestamp_field'] = ts_value
        decoded['timestamp_field_text'] = AISDecoder.decode_time_stamp(ts_value)
        
        # Special maneuver indicator
        if len(bits) >= 145:
            maneuver = bits[143:145].uint
            decoded['maneuver_indicator'] = maneuver
            if maneuver == 0:
                decoded['maneuver_text'] = "Not available"
            elif maneuver == 1:
                decoded['maneuver_text'] = "No special maneuver"
            elif maneuver == 2:
                decoded['maneuver_text'] = "Special maneuver"
            else:
                decoded['maneuver_text'] = "Reserved"
        
        # RAIM flag
        if len(bits) >= 148:
            raim = bits[148:149].uint
            decoded['raim_flag'] = raim
            decoded['raim_flag_text'] = "In use" if raim == 1 else "Not in use"
        
        # Communication state
        if len(bits) >= 168:
            # For Message 1 and 2, use SOTDMA
            # For Message 3, use ITDMA
            comm_state_flag = 0 if bits[0:6].uint in [1, 2] else 1
            decoded['communication_state'] = AISDecoder.decode_communication_state(bits, comm_state_flag, 149)
        
        return decoded

    @staticmethod
    def _decode_base_station_report(bits):
        """
        Decode Base Station Report (Message 4) or UTC Response (Message 11)
        according to Table 51 of ITU-R M.1371-5
        """
        decoded = {}
        
        # UTC year, month, day, hour, minute, second
        year_raw = bits[38:52].uint
        decoded['utc_year'] = year_raw if year_raw != 0 else None
        
        month_raw = bits[52:56].uint
        if 1 <= month_raw <= 12:
            decoded['utc_month'] = month_raw
        else:
            decoded['utc_month'] = None
        
        day_raw = bits[56:61].uint
        if 1 <= day_raw <= 31:
            decoded['utc_day'] = day_raw
        else:
            decoded['utc_day'] = None
        
        hour_raw = bits[61:66].uint
        if 0 <= hour_raw <= 23:
            decoded['utc_hour'] = hour_raw
        else:
            decoded['utc_hour'] = None
        
        minute_raw = bits[66:72].uint
        if 0 <= minute_raw <= 59:
            decoded['utc_minute'] = minute_raw
        else:
            decoded['utc_minute'] = None
        
        second_raw = bits[72:78].uint
        if 0 <= second_raw <= 59:
            decoded['utc_second'] = second_raw
        else:
            decoded['utc_second'] = None
        
        # Format UTC date-time if all components are valid
        if all(decoded.get(k) is not None for k in ['utc_year', 'utc_month', 'utc_day', 'utc_hour', 'utc_minute', 'utc_second']):
            decoded['utc_datetime'] = f"{decoded['utc_year']}-{decoded['utc_month']:02d}-{decoded['utc_day']:02d} {decoded['utc_hour']:02d}:{decoded['utc_minute']:02d}:{decoded['utc_second']:02d}"
        
        # Position accuracy
        pos_accuracy = bits[78:79].uint
        decoded['position_accuracy'] = pos_accuracy
        decoded['position_accuracy_text'] = "High (≤10m)" if pos_accuracy == 1 else "Low (>10m)"
        
        # Longitude and latitude
        lon_raw = bits[79:107].int
        lat_raw = bits[107:134].int
        decoded.update(AISDecoder.validate_and_convert_coordinates(lon_raw, lat_raw))
        
        # Type of electronic position fixing device
        epfd_raw = bits[134:138].uint
        decoded['epfd_type'] = epfd_raw
        decoded['epfd_type_text'] = AISDecoder.EPFD_TYPES.get(epfd_raw, "Unknown")
        
        # Transmission control for long-range broadcast message
        if len(bits) >= 139:
            tx_control = bits[138:139].uint
            decoded['tx_control_for_long_range'] = tx_control
            decoded['tx_control_for_long_range_text'] = "Requested" if tx_control == 1 else "Not requested"
        
        # RAIM flag
        if len(bits) >= 149:
            raim = bits[148:149].uint
            decoded['raim_flag'] = raim
            decoded['raim_flag_text'] = "In use" if raim == 1 else "Not in use"
        
        # Communication state (always SOTDMA for base stations)
        if len(bits) >= 168:
            decoded['communication_state'] = AISDecoder.decode_communication_state(bits, 0, 149)
        
        return decoded

    @staticmethod
    def _decode_static_voyage_data(bits):
        """
        Decode Static and Voyage Related Data (Message 5)
        according to Table 52 of ITU-R M.1371-5
        """
        decoded = {}
        
        # AIS version indicator
        ais_version = bits[38:40].uint
        decoded['ais_version'] = ais_version
        if ais_version == 0:
            decoded['ais_version_text'] = "ITU-R M.1371-1"
        elif ais_version == 1:
            decoded['ais_version_text'] = "ITU-R M.1371-3"
        elif ais_version == 2:
            decoded['ais_version_text'] = "ITU-R M.1371-5"
        elif ais_version == 3:
            decoded['ais_version_text'] = "Future edition"
        
        # IMO number
        imo_raw = bits[40:70].uint
        if imo_raw == 0:
            decoded['imo_number'] = None
            decoded['imo_number_status'] = "Not available or not applicable"
        elif 1000000 <= imo_raw <= 9999999:
            decoded['imo_number'] = imo_raw
            decoded['imo_number_status'] = "Valid IMO number"
        elif 10000000 <= imo_raw <= 1073741823:
            decoded['imo_number'] = imo_raw
            decoded['imo_number_status'] = "Official flag state number"
        else:
            decoded['imo_number'] = imo_raw
            decoded['imo_number_status'] = "Invalid range"
        
        # Call sign
        callsign = AISDecoder.decode_sixbit_ascii(bits, 70, 7)
        decoded['callsign'] = callsign if callsign else None
        
        # Vessel name
        name = AISDecoder.decode_sixbit_ascii(bits, 112, 20)
        decoded['vessel_name'] = name if name else None
        
        # Ship type
        ship_type = bits[232:240].uint
        decoded['ship_type'] = ship_type
        decoded['ship_type_text'] = AISDecoder.SHIP_TYPE.get(ship_type, "Unknown")
        
        # Dimensions and reference point
        dimensions = AISDecoder.get_positions_dimensions(bits, 240)
        decoded.update(dimensions)
        
        # Type of electronic position fixing device
        epfd_raw = bits[270:274].uint
        decoded['epfd_type'] = epfd_raw
        decoded['epfd_type_text'] = AISDecoder.EPFD_TYPES.get(epfd_raw, "Unknown")
        
        # ETA
        eta_month = bits[274:278].uint
        eta_day = bits[278:283].uint
        eta_hour = bits[283:288].uint
        eta_minute = bits[288:294].uint
        
        if all(x > 0 for x in [eta_month, eta_day]) and eta_month <= 12 and eta_day <= 31:
            hour_str = f"{eta_hour:02d}" if eta_hour <= 23 else "24"
            min_str = f"{eta_minute:02d}" if eta_minute <= 59 else "60"
            decoded['eta'] = f"{eta_month:02d}-{eta_day:02d} {hour_str}:{min_str}"
        else:
            decoded['eta'] = None
        
        # Maximum present static draught
        draught_raw = bits[294:302].uint
        if draught_raw == 0:
            decoded['draught'] = None
            decoded['draught_status'] = "Not available"
        elif draught_raw == 255:
            decoded['draught'] = 25.5
            decoded['draught_status'] = "25.5m or greater"
        else:
            decoded['draught'] = draught_raw / 10.0
            decoded['draught_status'] = "Valid"
        
        # Destination
        destination = AISDecoder.decode_sixbit_ascii(bits, 302, 20)
        decoded['destination'] = destination if destination else None
        
        # DTE (Data terminal equipment) flag
        dte_raw = bits[422:423].uint
        decoded['dte'] = dte_raw
        decoded['dte_text'] = "Not ready" if dte_raw == 1 else "Ready"
        
        return decoded

    @staticmethod
    def _decode_binary_message(bits, message_type):
        """
        Decode Binary Messages (6, 8, 25, 26)
        according to Tables 54, 57, 80, and 82 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Different structure based on message type
        if message_type == 6:  # Binary addressed message
            if len(bits) < 88:
                return {'error': 'Message too short for Binary Addressed Message'}
                
            # Sequence number for addressed messages
            seq_num = bits[38:40].uint
            decoded['sequence_number'] = seq_num
            
            # Destination ID
            dest_id = bits[40:70].uint
            decoded['destination_mmsi'] = dest_id
            
            # Retransmit flag
            retransmit = bits[70:71].uint
            decoded['retransmit_flag'] = retransmit == 1
            
            # Binary data starts at bit 72
            application_id_start = 72
            binary_data_start = 88
            max_binary_length = len(bits) - 72
            
        elif message_type == 8:  # Binary broadcast message
            if len(bits) < 40:
                return {'error': 'Message too short for Binary Broadcast Message'}
                
            # Binary data starts at bit 40
            application_id_start = 40
            binary_data_start = 56
            max_binary_length = len(bits) - 40
            
        elif message_type == 25:  # Single slot binary message
            if len(bits) < 40:
                return {'error': 'Message too short for Single Slot Binary Message'}
                
            # Destination indicator
            dest_indicator = bits[38:39].uint
            decoded['destination_indicator'] = dest_indicator
            
            # Binary data flag
            binary_flag = bits[39:40].uint
            decoded['binary_data_flag'] = binary_flag
            
            # Handle addressed vs broadcast formats
            if dest_indicator == 1:  # Addressed
                if len(bits) < 72:
                    return {'error': 'Message too short for addressed Single Slot Binary Message'}
                
                dest_id = bits[40:70].uint
                decoded['destination_mmsi'] = dest_id
                
                # Binary data follows
                if binary_flag == 1:  # Application ID present
                    application_id_start = 72
                    binary_data_start = 88
                    max_binary_length = len(bits) - 72
                else:
                    application_id_start = None
                    binary_data_start = 72
                    max_binary_length = len(bits) - 72
            else:  # Broadcast
                # Binary data follows
                if binary_flag == 1:  # Application ID present
                    application_id_start = 40
                    binary_data_start = 56
                    max_binary_length = len(bits) - 40
                else:
                    application_id_start = None
                    binary_data_start = 40
                    max_binary_length = len(bits) - 40
                    
        elif message_type == 26:  # Multiple slot binary message
            if len(bits) < 40:
                return {'error': 'Message too short for Multiple Slot Binary Message'}
                
            # Destination indicator
            dest_indicator = bits[38:39].uint
            decoded['destination_indicator'] = dest_indicator
            
            # Binary data flag
            binary_flag = bits[39:40].uint
            decoded['binary_data_flag'] = binary_flag
            
            # Handle addressed vs broadcast formats
            if dest_indicator == 1:  # Addressed
                if len(bits) < 72:
                    return {'error': 'Message too short for addressed Multiple Slot Binary Message'}
                
                dest_id = bits[40:70].uint
                decoded['destination_mmsi'] = dest_id
                
                # Binary data follows
                if binary_flag == 1:  # Application ID present
                    application_id_start = 72
                    binary_data_start = 88
                    max_binary_length = len(bits) - 72 - 20  # Account for communication state
                else:
                    application_id_start = None
                    binary_data_start = 72
                    max_binary_length = len(bits) - 72 - 20  # Account for communication state
            else:  # Broadcast
                # Binary data follows
                if binary_flag == 1:  # Application ID present
                    application_id_start = 40
                    binary_data_start = 56
                    max_binary_length = len(bits) - 40 - 20  # Account for communication state
                else:
                    application_id_start = None
                    binary_data_start = 40
                    max_binary_length = len(bits) - 40 - 20  # Account for communication state
            
            # Communication state for Message 26
            if len(bits) >= binary_data_start + max_binary_length + 20:
                comm_selector = bits[binary_data_start + max_binary_length:binary_data_start + max_binary_length + 1].uint
                comm_state_start = binary_data_start + max_binary_length + 1
                decoded['communication_state'] = AISDecoder.decode_communication_state(bits, comm_selector, comm_state_start)
        
        # Extract application identifier if present
        if application_id_start is not None and binary_data_start > application_id_start:
            if len(bits) >= application_id_start + 16:
                dac = bits[application_id_start:application_id_start + 10].uint
                fi = bits[application_id_start + 10:application_id_start + 16].uint
                decoded['designated_area_code'] = dac
                decoded['function_identifier'] = fi
                
                # Special handling for international function messages
                if dac == 1:  # International
                    decoded['application_id_type'] = "International"
                    if fi == 0:  # Text using 6-bit ASCII
                        decoded['application_id_description'] = "Text telegram 6-bit ASCII"
                        
                        # Text message decoding
                        if len(bits) >= binary_data_start + 11:
                            ack_required = bits[binary_data_start:binary_data_start + 1].uint
                            decoded['acknowledge_required'] = ack_required == 1
                            
                            seq_num = bits[binary_data_start + 1:binary_data_start + 12].uint
                            decoded['text_sequence_number'] = seq_num
                            
                            # Extract text
                            text_start = binary_data_start + 12
                            max_text_chars = (max_binary_length - 12) // 6
                            if max_text_chars > 0:
                                text = AISDecoder.decode_sixbit_ascii(bits, text_start, max_text_chars)
                                decoded['text_message'] = text
                    
                    elif fi == 2:  # Interrogation for specific FM
                        decoded['application_id_description'] = "Interrogation for specific functional message"
                        
                        if len(bits) >= binary_data_start + 16:
                            req_dac = bits[binary_data_start:binary_data_start + 10].uint
                            req_fi = bits[binary_data_start + 10:binary_data_start + 16].uint
                            decoded['requested_dac'] = req_dac
                            decoded['requested_fi'] = req_fi
                    
                    elif fi == 3:  # Capability interrogation
                        decoded['application_id_description'] = "Capability interrogation"
                        
                        if len(bits) >= binary_data_start + 10:
                            req_dac = bits[binary_data_start:binary_data_start + 10].uint
                            decoded['requested_dac'] = req_dac
                    
                    elif fi == 4:  # Capability response
                        decoded['application_id_description'] = "Capability response"
                        
                        if len(bits) >= binary_data_start + 138:
                            resp_dac = bits[binary_data_start:binary_data_start + 10].uint
                            decoded['response_dac'] = resp_dac
                            
                            # Parse FI capability table
                            fi_cap = []
                            for i in range(64):
                                start_bit = binary_data_start + 10 + i * 2
                                if len(bits) >= start_bit + 2:
                                    avail = bits[start_bit:start_bit + 1].uint
                                    # reserved = bits[start_bit + 1:start_bit + 2].uint
                                    if avail == 1:
                                        fi_cap.append(i)
                            
                            decoded['available_function_ids'] = fi_cap
                    
                    elif fi == 5:  # Application acknowledgement
                        decoded['application_id_description'] = "Application acknowledgement"
                        
                        if len(bits) >= binary_data_start + 31:
                            ack_dac = bits[binary_data_start:binary_data_start + 10].uint
                            ack_fi = bits[binary_data_start + 10:binary_data_start + 16].uint
                            seq_num = bits[binary_data_start + 16:binary_data_start + 27].uint
                            ai_available = bits[binary_data_start + 27:binary_data_start + 28].uint
                            ai_response = bits[binary_data_start + 28:binary_data_start + 31].uint
                            
                            decoded['acknowledged_dac'] = ack_dac
                            decoded['acknowledged_fi'] = ack_fi
                            decoded['text_sequence_number'] = seq_num
                            decoded['ai_available'] = ai_available == 1
                            
                            response_text = {
                                0: "Unable to respond",
                                1: "Reception acknowledged",
                                2: "Response to follow",
                                3: "Able to respond but currently inhibited"
                            }.get(ai_response, "Reserved for future use")
                            
                            decoded['ai_response'] = ai_response
                            decoded['ai_response_text'] = response_text
                    
                    else:
                        decoded['application_id_description'] = f"International function ID {fi}"
                
                elif dac == 0:
                    decoded['application_id_type'] = "Test"
                    decoded['application_id_description'] = f"Test function ID {fi}"
                
                else:
                    decoded['application_id_type'] = "Regional"
                    decoded['application_id_description'] = f"Regional DAC {dac}, function ID {fi}"
            
            # Capture the raw binary data for application-specific decoding
            if len(bits) >= binary_data_start:
                binary_data = bits[binary_data_start:binary_data_start + max_binary_length].bin
                decoded['binary_data'] = binary_data
                decoded['binary_data_length_bits'] = len(binary_data)
        else:
            # No application ID, just raw binary data
            if len(bits) >= binary_data_start:
                binary_data = bits[binary_data_start:binary_data_start + max_binary_length].bin
                decoded['binary_data'] = binary_data
                decoded['binary_data_length_bits'] = len(binary_data)
        
        return decoded

    @staticmethod
    def _decode_acknowledge(bits, message_type):
        """
        Decode Binary Acknowledge (Message 7) or
        Safety Related Acknowledgement (Message 13)
        """
        decoded = {}
        
        decoded['ack_type'] = "Binary" if message_type == 7 else "Safety"
        
        # Message can contain 1-4 destination IDs with sequence numbers
        offset = 40
        ack_count = 0
        
        while offset + 32 <= len(bits) and ack_count < 4:
            dest_id = bits[offset:offset + 30].uint
            seq_num = bits[offset + 30:offset + 32].uint
            
            ack_count += 1
            decoded[f'destination_mmsi_{ack_count}'] = dest_id
            decoded[f'sequence_number_{ack_count}'] = seq_num
            
            offset += 32
        
        decoded['ack_count'] = ack_count
        
        return decoded

    @staticmethod
    def _decode_sar_position(bits):
        """
        Decode Standard SAR Aircraft Position Report (Message 9)
        according to Table 59 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Altitude
        alt_raw = bits[38:50].uint
        if alt_raw == 4095:
            decoded['altitude'] = None
            decoded['altitude_status'] = "Not available"
        elif alt_raw == 4094:
            decoded['altitude'] = 4094
            decoded['altitude_status'] = "4094 meters or higher"
        else:
            decoded['altitude'] = alt_raw
            decoded['altitude_status'] = "Valid"
        
        # Speed over ground
        sog_raw = bits[50:60].uint
        if sog_raw == 1023:
            decoded['sog'] = None
            decoded['sog_status'] = "Not available"
        elif sog_raw == 1022:
            decoded['sog'] = 1022
            decoded['sog_status'] = "1022 knots or higher"
        else:
            decoded['sog'] = sog_raw
            decoded['sog_status'] = "Valid"
        
        # Position accuracy
        pos_accuracy = bits[60:61].uint
        decoded['position_accuracy'] = pos_accuracy
        decoded['position_accuracy_text'] = "High (≤10m)" if pos_accuracy == 1 else "Low (>10m)"
        
        # Longitude and latitude
        lon_raw = bits[61:89].int
        lat_raw = bits[89:116].int
        decoded.update(AISDecoder.validate_and_convert_coordinates(lon_raw, lat_raw))
        
        # Course over ground
        cog_raw = bits[116:128].uint
        if cog_raw == 3600:
            decoded['cog'] = None
            decoded['cog_status'] = "Not available"
        elif 3601 <= cog_raw <= 4095:
            decoded['cog'] = None
            decoded['cog_status'] = "Invalid value"
        else:
            decoded['cog'] = cog_raw / 10.0
            decoded['cog_status'] = "Valid"
        
        # Time stamp
        ts_value = bits[128:134].uint
        decoded['timestamp_field'] = ts_value
        decoded['timestamp_field_text'] = AISDecoder.decode_time_stamp(ts_value)
        
        # Altitude sensor
        alt_sensor = bits[134:135].uint
        decoded['altitude_sensor'] = alt_sensor
        decoded['altitude_sensor_text'] = "Barometric" if alt_sensor == 1 else "GNSS"
        
        # DTE flag
        dte_raw = bits[142:143].uint
        decoded['dte'] = dte_raw
        decoded['dte_text'] = "Not ready" if dte_raw == 1 else "Ready"
        
        # Assigned mode flag
        assigned = bits[146:147].uint
        decoded['assigned_mode'] = assigned
        decoded['assigned_mode_text'] = "Assigned mode" if assigned == 1 else "Autonomous mode"
        
        # RAIM flag
        raim = bits[147:148].uint
        decoded['raim_flag'] = raim
        decoded['raim_flag_text'] = "In use" if raim == 1 else "Not in use"
        
        # Communication state
        comm_selector = bits[148:149].uint
        decoded['communication_state'] = AISDecoder.decode_communication_state(bits, comm_selector, 149)
        
        return decoded

    @staticmethod
    def _decode_utc_inquiry(bits):
        """
        Decode UTC Date Inquiry (Message 10)
        according to Table 60 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Destination ID
        if len(bits) >= 70:
            dest_id = bits[40:70].uint
            decoded['destination_mmsi'] = dest_id
        
        return decoded

    @staticmethod
    def _decode_safety_message(bits, message_type):
        """
        Decode Safety Related Messages (Messages 12, 14)
        according to Tables 61 and 63 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Message 12 is addressed, Message 14 is broadcast
        if message_type == 12:  # Addressed
            if len(bits) < 72:
                return {'error': 'Message too short for Addressed Safety Message'}
                
            # Sequence number
            seq_num = bits[38:40].uint
            decoded['sequence_number'] = seq_num
            
            # Destination ID
            dest_id = bits[40:70].uint
            decoded['destination_mmsi'] = dest_id
            
            # Retransmit flag
            retransmit = bits[70:71].uint
            decoded['retransmit_flag'] = retransmit == 1
            
            # Safety text starts at bit 72
            text_start = 72
            max_text_chars = (len(bits) - 72) // 6
            
        else:  # Broadcast (Message 14)
            if len(bits) < 40:
                return {'error': 'Message too short for Safety Broadcast Message'}
                
            # Safety text starts at bit 40
            text_start = 40
            max_text_chars = (len(bits) - 40) // 6
        
        # Extract safety text
        if max_text_chars > 0:
            text = AISDecoder.decode_sixbit_ascii(bits, text_start, max_text_chars)
            decoded['safety_text'] = text
            
            # Special handling for AIS-SART, MOB-AIS, EPIRB-AIS
            if text == "SART ACTIVE":
                decoded['special_message_type'] = "AIS-SART Active"
            elif text == "SART TEST":
                decoded['special_message_type'] = "AIS-SART Test"
            elif text == "MOB ACTIVE":
                decoded['special_message_type'] = "MOB-AIS Active"
            elif text == "MOB TEST":
                decoded['special_message_type'] = "MOB-AIS Test"
            elif text == "EPIRB ACTIVE":
                decoded['special_message_type'] = "EPIRB-AIS Active"
            elif text == "EPIRB TEST":
                decoded['special_message_type'] = "EPIRB-AIS Test"
        
        return decoded

    @staticmethod
    def _decode_interrogation(bits):
        """
        Decode Interrogation (Message 15)
        according to Table 65 and 66 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 88:
            return {'error': 'Message too short for Interrogation'}
            
        # Destination ID 1
        dest_id1 = bits[40:70].uint
        decoded['destination_mmsi_1'] = dest_id1
        
        # First requested message from station 1
        msg_id1_1 = bits[70:76].uint
        decoded['message_id_1_1'] = msg_id1_1
        
        # Slot offset for first message
        slot_offset1_1 = bits[76:88].uint
        decoded['slot_offset_1_1'] = slot_offset1_1
        
        # Check if there's a second request for first station
        if len(bits) >= 110:
            msg_id1_2 = bits[90:96].uint
            decoded['message_id_1_2'] = msg_id1_2
            
            slot_offset1_2 = bits[96:108].uint
            decoded['slot_offset_1_2'] = slot_offset1_2
            
            # Check if there's a second station interrogation
            if len(bits) >= 160:
                dest_id2 = bits[110:140].uint
                decoded['destination_mmsi_2'] = dest_id2
                
                msg_id2_1 = bits[140:146].uint
                decoded['message_id_2_1'] = msg_id2_1
                
                slot_offset2_1 = bits[146:158].uint
                decoded['slot_offset_2_1'] = slot_offset2_1
        
        return decoded

    @staticmethod
    def _decode_assignment_command(bits):
        """
        Decode Assignment Mode Command (Message 16)
        according to Table 67 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 82:
            return {'error': 'Message too short for Assignment Command'}
            
        # Destination ID A
        dest_id_a = bits[40:70].uint
        decoded['destination_mmsi_a'] = dest_id_a
        
        # Offset A
        offset_a = bits[70:82].uint
        decoded['offset_a'] = offset_a
        
        # Increment A
        if len(bits) >= 92:
            increment_a = bits[82:92].uint
            decoded['increment_a'] = increment_a
            
            # Determine if this is a reporting rate or slot assignment
            if increment_a == 0:
                # This is a reporting rate assignment
                if 0 < offset_a <= 600:
                    reports_per_10min = offset_a
                    if reports_per_10min % 20 != 0 and reports_per_10min < 600:
                        # Round up to next multiple of 20
                        adjusted_rate = ((reports_per_10min + 19) // 20) * 20
                        decoded['reports_per_10min_a'] = adjusted_rate
                        decoded['reporting_interval_a'] = 600 / adjusted_rate
                    else:
                        decoded['reports_per_10min_a'] = reports_per_10min
                        decoded['reporting_interval_a'] = 600 / reports_per_10min
            else:
                # This is a slot increment assignment
                increment_map = {
                    1: 1125,
                    2: 375,
                    3: 225,
                    4: 125,
                    5: 75,
                    6: 45
                }
                if increment_a in increment_map:
                    decoded['slot_increment_value_a'] = increment_map[increment_a]
        
        # Check if there's a second station assignment
        if len(bits) >= 144:
            dest_id_b = bits[92:122].uint
            decoded['destination_mmsi_b'] = dest_id_b
            
            offset_b = bits[122:134].uint
            decoded['offset_b'] = offset_b
            
            increment_b = bits[134:144].uint
            decoded['increment_b'] = increment_b
            
            # Determine if this is a reporting rate or slot assignment
            if increment_b == 0:
                # This is a reporting rate assignment
                if 0 < offset_b <= 600:
                    reports_per_10min = offset_b
                    if reports_per_10min % 20 != 0 and reports_per_10min < 600:
                        # Round up to next multiple of 20
                        adjusted_rate = ((reports_per_10min + 19) // 20) * 20
                        decoded['reports_per_10min_b'] = adjusted_rate
                        decoded['reporting_interval_b'] = 600 / adjusted_rate
                    else:
                        decoded['reports_per_10min_b'] = reports_per_10min
                        decoded['reporting_interval_b'] = 600 / reports_per_10min
            else:
                # This is a slot increment assignment
                increment_map = {
                    1: 1125,
                    2: 375,
                    3: 225,
                    4: 125,
                    5: 75,
                    6: 45
                }
                if increment_b in increment_map:
                    decoded['slot_increment_value_b'] = increment_map[increment_b]
        
        return decoded

    @staticmethod
    def _decode_dgnss_broadcast(bits):
        """
        Decode DGNSS Binary Broadcast Message (Message 17)
        according to Table 68 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 80:
            return {'error': 'Message too short for DGNSS Broadcast'}
            
        # Longitude and latitude in 1/10 min format
        lon_raw = bits[40:58].int
        lat_raw = bits[58:75].int
        decoded.update(AISDecoder.validate_and_convert_coordinates_dgnss(lon_raw, lat_raw))
        
        # DGNSS data
        if len(bits) >= 80:
            # Parse N data words from position 80
            if len(bits) > 80:
                # Get message type and station ID
                if len(bits) >= 96:
                    dgnss_msg_type = bits[80:86].uint
                    dgnss_station_id = bits[86:96].uint
                    decoded['dgnss_message_type'] = dgnss_msg_type
                    decoded['dgnss_station_id'] = dgnss_station_id
                
                # Get Z count, sequence number, N, and health
                if len(bits) >= 117:
                    z_count = bits[96:109].uint
                    seq_num = bits[109:112].uint
                    n_words = bits[112:117].uint
                    decoded['z_count'] = z_count
                    decoded['sequence_number'] = seq_num
                    decoded['n_words'] = n_words
                
                # Get health
                if len(bits) >= 120:
                    health = bits[117:120].uint
                    decoded['dgnss_health'] = health
                
                # Get DGNSS data words
                if len(bits) >= 120 + n_words * 24:
                    dgnss_words = []
                    for i in range(n_words):
                        word_bits = bits[120 + i*24:120 + (i+1)*24].uint
                        dgnss_words.append(word_bits)
                    
                    decoded['dgnss_data_words'] = dgnss_words
            else:
                decoded['dgnss_data'] = None
        
        return decoded

    @staticmethod
    def _decode_position_report_class_b(bits):
        """
        Decode Standard Class B CS Position Report (Message 18)
        according to Table 70 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Speed over ground
        sog_raw = bits[46:56].uint
        if sog_raw == 1023:
            decoded['sog'] = None
            decoded['sog_status'] = "Not available"
        elif sog_raw == 1022:
            decoded['sog'] = 102.2
            decoded['sog_status'] = "102.2 knots or higher"
        else:
            decoded['sog'] = sog_raw / 10.0
            decoded['sog_status'] = "Valid"
        
        # Position accuracy
        pos_accuracy = bits[56:57].uint
        decoded['position_accuracy'] = pos_accuracy
        decoded['position_accuracy_text'] = "High (≤10m)" if pos_accuracy == 1 else "Low (>10m)"
        
        # Longitude and latitude
        lon_raw = bits[57:85].int
        lat_raw = bits[85:112].int
        decoded.update(AISDecoder.validate_and_convert_coordinates(lon_raw, lat_raw))
        
        # Course over ground
        cog_raw = bits[112:124].uint
        if cog_raw == 3600:
            decoded['cog'] = None
            decoded['cog_status'] = "Not available"
        elif 3601 <= cog_raw <= 4095:
            decoded['cog'] = None
            decoded['cog_status'] = "Invalid value"
        else:
            decoded['cog'] = cog_raw / 10.0
            decoded['cog_status'] = "Valid"
        
        # True heading
        hdg_raw = bits[124:133].uint
        if hdg_raw == 511:
            decoded['true_heading'] = None
            decoded['true_heading_status'] = "Not available"
        elif hdg_raw > 359:
            decoded['true_heading'] = None
            decoded['true_heading_status'] = "Invalid value"
        else:
            decoded['true_heading'] = hdg_raw
            decoded['true_heading_status'] = "Valid"
        
        # Time stamp
        ts_value = bits[133:139].uint
        decoded['timestamp_field'] = ts_value
        decoded['timestamp_field_text'] = AISDecoder.decode_time_stamp(ts_value)
        
        # Class B unit flag
        class_b_unit = bits[141:142].uint
        decoded['class_b_unit'] = class_b_unit
        decoded['class_b_unit_text'] = "CS" if class_b_unit == 1 else "SO"
        
        # Class B display flag
        class_b_display = bits[142:143].uint
        decoded['class_b_display'] = class_b_display
        decoded['class_b_display_text'] = "Has display" if class_b_display == 1 else "No display"
        
        # Class B DSC flag
        class_b_dsc = bits[143:144].uint
        decoded['class_b_dsc'] = class_b_dsc
        decoded['class_b_dsc_text'] = "Has DSC" if class_b_dsc == 1 else "No DSC"
        
        # Class B band flag
        class_b_band = bits[144:145].uint
        decoded['class_b_band'] = class_b_band
        decoded['class_b_band_text'] = "Whole marine band" if class_b_band == 1 else "Upper 525kHz band"
        
        # Class B message 22 flag
        class_b_msg22 = bits[145:146].uint
        decoded['class_b_msg22'] = class_b_msg22
        decoded['class_b_msg22_text'] = "Frequency management via Msg 22" if class_b_msg22 == 1 else "AIS 1 and AIS 2 only"
        
        # Mode flag
        mode = bits[146:147].uint
        decoded['mode_flag'] = mode
        decoded['mode_flag_text'] = "Assigned mode" if mode == 1 else "Autonomous mode"
        
        # RAIM flag
        raim = bits[147:148].uint
        decoded['raim_flag'] = raim
        decoded['raim_flag_text'] = "In use" if raim == 1 else "Not in use"
        
        # Communication state
        comm_selector = bits[148:149].uint
        if comm_selector == 1:  # ITDMA
            decoded['communication_state'] = AISDecoder.decode_communication_state(bits, 1, 149)
        else:  # SOTDMA
            decoded['communication_state'] = AISDecoder.decode_communication_state(bits, 0, 149)
        
        return decoded

    @staticmethod
    def _decode_extended_position_class_b(bits):
        """
        Decode Extended Class B CS Position Report (Message 19)
        according to Table 71 of ITU-R M.1371-5
        """
        decoded = {}
        
        # This message contains all the fields from Message 18
        decoded.update(AISDecoder._decode_position_report_class_b(bits))
        
        # Ship name
        name = AISDecoder.decode_sixbit_ascii(bits, 143, 20)
        decoded['vessel_name'] = name if name else None
        
        # Ship type
        ship_type = bits[263:271].uint
        decoded['ship_type'] = ship_type
        decoded['ship_type_text'] = AISDecoder.SHIP_TYPE.get(ship_type, "Unknown")
        
        # Dimensions and reference point
        dimensions = AISDecoder.get_positions_dimensions(bits, 271)
        decoded.update(dimensions)
        
        # Type of electronic position fixing device
        epfd_raw = bits[301:305].uint
        decoded['epfd_type'] = epfd_raw
        decoded['epfd_type_text'] = AISDecoder.EPFD_TYPES.get(epfd_raw, "Unknown")
        
        # RAIM flag (from position report already included)
        
        # DTE flag
        dte_raw = bits[306:307].uint
        decoded['dte'] = dte_raw
        decoded['dte_text'] = "Not ready" if dte_raw == 1 else "Ready"
        
        # Assigned mode flag (from position report already included)
        
        return decoded

    @staticmethod
    def _decode_data_link_management(bits):
        """
        Decode Data Link Management (Message 20)
        according to Table 72 of ITU-R M.1371-5
        """
        decoded = {}
        
        offset = 40
        reservation_count = 0
        
        # Process up to 4 reservation blocks
        while offset + 30 <= len(bits) and reservation_count < 4:
            res_num = reservation_count + 1
            
            # Offset number
            offset_num = bits[offset:offset + 12].uint
            
            # Number of slots
            num_slots = bits[offset + 12:offset + 16].uint
            
            # Timeout
            timeout = bits[offset + 16:offset + 19].uint
            
            # Increment
            increment = bits[offset + 19:offset + 30].uint
            
            # Skip if everything is zero
            if offset_num == 0 and num_slots == 0 and timeout == 0 and increment == 0:
                # Only offset number 1 may contain all zeros, which is used when no reservation info is available
                if res_num == 1:
                    decoded['no_reservation_information'] = True
                break
            
            # Store the reservation info
            decoded[f'offset_number_{res_num}'] = offset_num
            decoded[f'number_of_slots_{res_num}'] = num_slots
            decoded[f'timeout_{res_num}'] = timeout
            decoded[f'timeout_minutes_{res_num}'] = timeout
            decoded[f'increment_{res_num}'] = increment
            
            offset += 30
            reservation_count += 1
        
        decoded['reservation_count'] = reservation_count
        
        return decoded

    @staticmethod
    def _decode_aid_navigation_report(bits):
        """
        Decode Aid-to-Navigation Report (Message 21)
        according to Table 73 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 272:
            return {'error': 'Message too short for AtoN Report'}
            
        # Aid type
        aid_type = bits[38:43].uint
        decoded['aid_type'] = aid_type
        decoded['aid_type_text'] = AISDecoder.ATON_TYPES.get(aid_type, "Unknown")
        
        # Name
        name = AISDecoder.decode_sixbit_ascii(bits, 43, 20)
        decoded['name'] = name if name else None
        
        # Position accuracy
        pos_accuracy = bits[163:164].uint
        decoded['position_accuracy'] = pos_accuracy
        decoded['position_accuracy_text'] = "High (≤10m)" if pos_accuracy == 1 else "Low (>10m)"
        
        # Longitude and latitude
        lon_raw = bits[164:192].int
        lat_raw = bits[192:219].int
        decoded.update(AISDecoder.validate_and_convert_coordinates(lon_raw, lat_raw))
        
        # Dimensions and reference point
        dimensions = AISDecoder.get_positions_dimensions(bits, 219)
        decoded.update(dimensions)
        
        # Type of electronic position fixing device
        epfd_raw = bits[249:253].uint
        decoded['epfd_type'] = epfd_raw
        decoded['epfd_type_text'] = AISDecoder.EPFD_TYPES.get(epfd_raw, "Unknown")
        
        # Time stamp
        ts_value = bits[253:259].uint
        decoded['timestamp_field'] = ts_value
        decoded['timestamp_field_text'] = AISDecoder.decode_time_stamp(ts_value)
        
        # Off-position indicator (valid only for floating AtoN)
        off_pos = bits[259:260].uint
        decoded['off_position'] = off_pos == 1
        
        # AtoN status
        aton_status = bits[260:268].uint
        decoded['aton_status'] = aton_status
        
        # RAIM flag
        raim = bits[268:269].uint
        decoded['raim_flag'] = raim
        decoded['raim_flag_text'] = "In use" if raim == 1 else "Not in use"
        
        # Virtual AtoN flag
        virtual = bits[269:270].uint
        decoded['virtual_aton'] = virtual == 1
        
        # Assigned mode flag
        assigned = bits[270:271].uint
        decoded['assigned_mode'] = assigned
        decoded['assigned_mode_text'] = "Assigned mode" if assigned == 1 else "Autonomous mode"
        
        # Name extension
        # The rest of the message (if present) contains the name extension
        if len(bits) > 272:
            # Number of 6-bit characters in the extension
            ext_len = (len(bits) - 272) // 6
            if ext_len > 0:
                name_ext = AISDecoder.decode_sixbit_ascii(bits, 272, ext_len)
                decoded['name_extension'] = name_ext
                
                # If we have both name and extension, combine them
                if name and name_ext:
                    decoded['full_name'] = name + name_ext
        
        return decoded

    @staticmethod
    def _decode_channel_management(bits):
        """
        Decode Channel Management (Message 22)
        according to Table 75 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 168:
            return {'error': 'Message too short for Channel Management'}
            
        # Channel A
        ch_a = bits[40:52].uint
        decoded['channel_a'] = ch_a
        
        # Channel B
        ch_b = bits[52:64].uint
        decoded['channel_b'] = ch_b
        
        # Tx/Rx mode
        tx_rx_mode = bits[64:68].uint
        decoded['tx_rx_mode'] = tx_rx_mode
        
        mode_text = {
            0: "Tx A, Rx A, Tx B, Rx B",
            1: "Tx A, Rx A, Rx B",
            2: "Tx B, Rx A, Rx B",
            3: "Reserved"
        }.get(tx_rx_mode, "Reserved")
        
        decoded['tx_rx_mode_text'] = mode_text
        
        # Power
        power = bits[68:69].uint
        decoded['power'] = power
        decoded['power_text'] = "Low" if power == 1 else "High"
        
        # Message 22 can be addressed or broadcast
        addressed = bits[139:140].uint
        decoded['addressed_message'] = addressed == 1
        
        if addressed == 1:  # Addressed
            # The area fields contain mmsi numbers
            dest_mmsi_1_msb = bits[69:87].uint
            dest_mmsi_1_lsb = bits[87:104].uint << 5  # Padding with 5 zeros
            
            dest_mmsi_2_msb = bits[104:122].uint
            dest_mmsi_2_lsb = bits[122:139].uint << 5  # Padding with 5 zeros
            
            dest_mmsi_1 = (dest_mmsi_1_msb << 12) | dest_mmsi_1_lsb
            dest_mmsi_2 = (dest_mmsi_2_msb << 12) | dest_mmsi_2_lsb
            
            decoded['destination_mmsi_1'] = dest_mmsi_1
            decoded['destination_mmsi_2'] = dest_mmsi_2
        
        else:  # Broadcast
            # The area fields define a rectangular area (in 1/10 min format)
            ne_lon = bits[69:87].int
            ne_lat = bits[87:104].int
            sw_lon = bits[104:122].int
            sw_lat = bits[122:139].int
            
            # Process coordinates using the proper conversion function
            area_coords = AISDecoder.validate_and_convert_coordinates_area(ne_lon, ne_lat, sw_lon, sw_lat, "tenth_minute")
            decoded.update(area_coords)
        
        # Channel A bandwidth (not used in ITU-R M.1371-5)
        ch_a_bw = bits[140:141].uint
        decoded['channel_a_bandwidth'] = ch_a_bw
        
        # Channel B bandwidth (not used in ITU-R M.1371-5)
        ch_b_bw = bits[141:142].uint
        decoded['channel_b_bandwidth'] = ch_b_bw
        
        # Transitional zone size
        trans_zone = bits[142:145].uint + 1  # Add 1 to get actual size
        decoded['transitional_zone_size'] = trans_zone
        
        return decoded

    @staticmethod
    def _decode_group_assignment(bits):
        """
        Decode Group Assignment Command (Message 23)
        according to Table 76 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 160:
            return {'error': 'Message too short for Group Assignment'}
            
        # Area coordinates (in 1/10 min format)
        ne_lon = bits[40:58].int
        ne_lat = bits[58:75].int
        sw_lon = bits[75:93].int
        sw_lat = bits[93:110].int
        
        # Process coordinates using the proper conversion function
        area_coords = AISDecoder.validate_and_convert_coordinates_area(ne_lon, ne_lat, sw_lon, sw_lat, "tenth_minute")
        decoded.update(area_coords)
        
        # Station type
        station_type = bits[110:114].uint
        decoded['station_type'] = station_type
        
        station_type_text = {
            0: "All types of mobiles",
            1: "Class A mobile stations only",
            2: "All types of Class B mobile stations",
            3: "SAR airborne mobile station",
            4: "Class B 'SO' mobile stations only",
            5: "Class B 'CS' shipborne mobile stations only",
            6: "Inland waterways",
            10: "Base station coverage area"
        }
        
        if 7 <= station_type <= 9:
            station_type_text[station_type] = "Regional use"
        elif 11 <= station_type <= 15:
            station_type_text[station_type] = "Future use"
        
        decoded['station_type_text'] = station_type_text.get(station_type, "Unknown")
        
        # Ship and cargo type
        ship_type = bits[114:122].uint
        decoded['ship_type'] = ship_type
        
        if ship_type == 0:
            decoded['ship_type_text'] = "All types"
        elif 1 <= ship_type <= 99:
            decoded['ship_type_text'] = AISDecoder.SHIP_TYPE.get(ship_type, "Unknown")
        elif 100 <= ship_type <= 199:
            decoded['ship_type_text'] = "Reserved for regional use"
        elif 200 <= ship_type <= 255:
            decoded['ship_type_text'] = "Reserved for future use"
        
        # Tx/Rx mode
        tx_rx_mode = bits[144:146].uint
        decoded['tx_rx_mode'] = tx_rx_mode
        
        mode_text = {
            0: "Tx A, Rx A, Tx B, Rx B",
            1: "Tx A, Rx A, Rx B",
            2: "Tx B, Rx A, Rx B",
            3: "Reserved"
        }.get(tx_rx_mode, "Reserved")
        
        decoded['tx_rx_mode_text'] = mode_text
        
        # Reporting interval
        reporting_interval = bits[146:150].uint
        decoded['reporting_interval'] = reporting_interval
        
        interval_text = {
            0: "As given by the autonomous mode",
            1: "10 minutes",
            2: "6 minutes",
            3: "3 minutes",
            4: "1 minute",
            5: "30 seconds",
            6: "15 seconds",
            7: "10 seconds",
            8: "5 seconds",
            9: "Next shorter reporting interval",
            10: "Next longer reporting interval",
            11: "2 seconds (not applicable to Class B 'CS')"
        }
        
        if 12 <= reporting_interval <= 15:
            interval_text[reporting_interval] = "Reserved for future use"
        
        decoded['reporting_interval_text'] = interval_text.get(reporting_interval, "Unknown")
        
        # Quiet time
        quiet_time = bits[150:154].uint
        decoded['quiet_time'] = quiet_time
        
        if quiet_time == 0:
            decoded['quiet_time_text'] = "No quiet time commanded"
        else:
            decoded['quiet_time_text'] = f"{quiet_time} minutes"
        
        return decoded

    @staticmethod
    def _decode_static_data_report(bits):
        """
        Decode Static Data Report (Message 24)
        according to Tables 78 and 79 of ITU-R M.1371-5
        """
        decoded = {}
        
        # Part number determines message structure
        if len(bits) >= 40:
            part_num = bits[38:40].uint
            decoded['part_number'] = part_num
            
            if part_num == 0:  # Part A
                if len(bits) >= 160:
                    # Name
                    name = AISDecoder.decode_sixbit_ascii(bits, 40, 20)
                    decoded['vessel_name'] = name if name else None
                    
            elif part_num == 1:  # Part B
                if len(bits) >= 168:
                    # Ship type
                    ship_type = bits[40:48].uint
                    decoded['ship_type'] = ship_type
                    decoded['ship_type_text'] = AISDecoder.SHIP_TYPE.get(ship_type, "Unknown")
                    
                    # Vendor ID
                    vendor_id = AISDecoder.decode_sixbit_ascii(bits, 48, 7)
                    decoded['vendor_id'] = vendor_id if vendor_id else None
                    
                    # Call sign
                    callsign = AISDecoder.decode_sixbit_ascii(bits, 90, 7)
                    decoded['callsign'] = callsign if callsign else None
                    
                    # Dimensions and reference point
                    dimensions = AISDecoder.get_positions_dimensions(bits, 132)
                    decoded.update(dimensions)
                    
                    # Type of electronic position fixing device
                    epfd_raw = bits[162:166].uint
                    decoded['epfd_type'] = epfd_raw
                    decoded['epfd_type_text'] = AISDecoder.EPFD_TYPES.get(epfd_raw, "Unknown")
            
            else:
                decoded['error'] = f"Invalid part number: {part_num}"
        
        return decoded

    @staticmethod
    def _decode_long_range_position(bits):
        """
        Decode Position Report For Long-Range Applications (Message 27)
        according to Table 84 of ITU-R M.1371-5
        """
        decoded = {}
        
        if len(bits) < 96:
            return {'error': 'Message too short for Long-Range Position Report'}
        
        # Position accuracy
        pos_accuracy = bits[38:39].uint
        decoded['position_accuracy'] = pos_accuracy
        decoded['position_accuracy_text'] = "High (≤10m)" if pos_accuracy == 1 else "Low (>10m)"
        
        # RAIM flag
        raim = bits[39:40].uint
        decoded['raim_flag'] = raim
        decoded['raim_flag_text'] = "In use" if raim == 1 else "Not in use"
        
        # Navigation status
        nav_status = bits[40:44].uint
        decoded['nav_status'] = nav_status
        decoded['nav_status_text'] = AISDecoder.NAV_STATUS.get(nav_status, "Unknown")
        
        # Longitude and latitude (in 1/10 min format)
        lon_raw = bits[44:62].int
        lat_raw = bits[62:79].int
        decoded.update(AISDecoder.validate_and_convert_coordinates_long_range(lon_raw, lat_raw))
        
        # Speed over ground
        sog_raw = bits[79:85].uint
        if sog_raw == 63:
            decoded['sog'] = None
            decoded['sog_status'] = "Not available"
        else:
            decoded['sog'] = sog_raw
            decoded['sog_status'] = "Valid"
        
        # Course over ground
        cog_raw = bits[85:94].uint
        if cog_raw == 511:
            decoded['cog'] = None
            decoded['cog_status'] = "Not available"
        else:
            decoded['cog'] = cog_raw
            decoded['cog_status'] = "Valid"
        
        # Position latency
        latency = bits[94:95].uint
        decoded['position_latency'] = latency
        decoded['position_latency_text'] = "Greater than 5 seconds" if latency == 1 else "Less than 5 seconds"
        
        return decoded

    @staticmethod
    def parse_nmea_message(nmea_message):
        """
        Parse a NMEA format AIS message and decode its payload
        Returns the decoded message or None if it can't be parsed
        Handles multipart messages automatically
        """
        try:
            # Check if it's a valid AIS message
            if not nmea_message.startswith('!AIVDM') and not nmea_message.startswith('!AIVDO'):
                return None
                
            # Parse NMEA message structure
            parts = nmea_message.split(',')
            if len(parts) < 7:
                logger.warning(f"Invalid NMEA message format: {nmea_message}")
                return None
                
            # Extract data
            total_fragments = int(parts[1])
            fragment_number = int(parts[2])
            message_id = parts[3] if parts[3] else '0'  # Sequential ID for multipart messages
            channel = parts[4]
            payload = parts[5]
            fill_bits = int(parts[6].split('*')[0])
            
            # Special case for single fragment messages (most common)
            if total_fragments == 1:
                decoded = AISDecoder.decode_payload(payload)
                if decoded:
                    # Add metadata
                    decoded['channel'] = channel
                    decoded['raw_message'] = nmea_message
                    return decoded
                    
            # Handle multipart messages (requires reassembly)
            if total_fragments > 1:
                # Add to multipart message buffer with timestamp
                import time
                current_time = time.time()
                
                message_key = f"{message_id}_{channel}"
                
                # Initialize container for this message if it doesn't exist
                if message_key not in AISDecoder.multipart_messages:
                    AISDecoder.multipart_messages[message_key] = {
                        'fragments': {},
                        'total': total_fragments,
                        'timestamp': current_time
                    }
                    
                # Add this fragment
                AISDecoder.multipart_messages[message_key]['fragments'][fragment_number] = payload
                AISDecoder.multipart_messages[message_key]['timestamp'] = current_time
                
                # Check if we have all fragments
                if len(AISDecoder.multipart_messages[message_key]['fragments']) == total_fragments:
                    # We have all fragments, reassemble and decode
                    assembled_payload = ''
                    for i in range(1, total_fragments + 1):
                        assembled_payload += AISDecoder.multipart_messages[message_key]['fragments'][i]
                        
                    decoded = AISDecoder.decode_payload(assembled_payload)
                    if decoded:
                        # Add metadata
                        decoded['channel'] = channel
                        decoded['raw_message'] = f"MULTIPART: {message_id} ({total_fragments} fragments)"
                        
                        # Clean up this message from the buffer
                        del AISDecoder.multipart_messages[message_key]
                        
                        return decoded
                else:
                    # Still waiting for more fragments
                    return {'partial': True, 'message_id': message_id}
                    
            return None
        
        except Exception as e:
            logger.error(f"Error parsing NMEA message: {str(e)}")
            return None

    @staticmethod
    def cleanup_old_multipart():
        """
        Clean up old multipart messages that were never completed
        This should be called periodically to prevent memory leaks
        """
        import time
        current_time = time.time()
        timeout = 60  # 60 seconds timeout for multipart messages
        
        keys_to_remove = []
        
        for key, message in AISDecoder.multipart_messages.items():
            if current_time - message['timestamp'] > timeout:
                keys_to_remove.append(key)
                
        for key in keys_to_remove:
            logger.info(f"Cleaning up incomplete multipart message: {key}")
            del AISDecoder.multipart_messages[key]
        
        if keys_to_remove:
            logger.info(f"Cleaned up {len(keys_to_remove)} incomplete multipart messages")