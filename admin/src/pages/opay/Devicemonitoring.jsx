import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  FaWifi, 
  FaSync, 
  FaExclamationTriangle,
  FaDesktop,
  FaMobileAlt,
  FaTabletAlt,
  FaUserCircle,
  FaSearch,
  FaEye,
  FaRegClock,
  FaSignal,
  FaCheckCircle,
  FaTimesCircle,
  FaKey,
  FaPlug
} from 'react-icons/fa';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { IoBatteryFull, IoBatteryHalf, IoBatteryDead } from 'react-icons/io5';
import { MdDevices, MdLocationOn } from 'react-icons/md';
import { GiNetworkBars } from 'react-icons/gi';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';

const DeviceMonitoring = () => {
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [validationStatus, setValidationStatus] = useState({ valid: false });
  const [integrationRunning, setIntegrationRunning] = useState(false);
  const [hasReceivedDevices, setHasReceivedDevices] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  const [devices, setDevices] = useState([]);
  const [deviceStats, setDeviceStats] = useState({
    online: 0,
    offline: 0,
    total: 0
  });
  const [connectionStats, setConnectionStats] = useState({
    uptime: 0,
    messageCount: 0
  });
  
  const socketRef = useRef(null);
  const uptimeIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${base_url}/api/opay/settings?cached=true`);
      if (response.data) {
        const { apiKey, validation, running } = response.data;
        setApiKey(apiKey || '');
        setValidationStatus({ valid: validation?.valid || false });
        setIntegrationRunning(running || false);
        
        if (apiKey && validation?.valid && running) {
          // Small delay to ensure everything is ready
          setTimeout(() => initializeSocket(), 500);
        } else {
          // If no API key or not running, stop loading
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setIsLoading(false);
    }
  }, [base_url]);

  // Update device stats
  const updateDeviceStats = useCallback((deviceList) => {
    const onlineCount = deviceList.filter(d => d.active === true).length;
    const offlineCount = deviceList.filter(d => d.active === false).length;
    
    setDeviceStats({
      online: onlineCount,
      offline: offlineCount,
      total: deviceList.length
    });
  }, []);

  // Format last seen
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      const lastSeen = new Date(timestamp);
      const now = new Date();
      const diffMs = now - lastSeen;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMs < 60000) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return lastSeen.toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  // Get device type icon
  const getDeviceTypeIcon = (type) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('desktop')) return <FaDesktop className="text-blue-400" />;
    if (typeLower.includes('mobile')) return <FaMobileAlt className="text-purple-400" />;
    if (typeLower.includes('tablet')) return <FaTabletAlt className="text-emerald-400" />;
    return <MdDevices className="text-gray-500" />;
  };

  // Get battery icon
  const getBatteryIcon = (percentage) => {
    if (!percentage) return null;
    if (percentage >= 80) return <IoBatteryFull className="text-emerald-400" />;
    if (percentage >= 30) return <IoBatteryHalf className="text-amber-400" />;
    return <IoBatteryDead className="text-rose-400" />;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    return status === 'online' 
      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
  };

  // Initialize Socket.IO
  const initializeSocket = useCallback(() => {
    if (!apiKey || !validationStatus.valid || !integrationRunning) {
      setIsLoading(false);
      return;
    }
    
    if (socketRef.current?.connected) {
      setIsLoading(false);
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      clearInterval(uptimeIntervalRef.current);
    }

    console.log('Initializing socket connection...');
    setConnectionAttempts(prev => prev + 1);

    const socket = io("https://api.oraclepay.org", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      query: { 
        apiKey: apiKey,
        timestamp: Date.now()
      }
    });

    socketRef.current = socket;

    let uptime = 0;
    uptimeIntervalRef.current = setInterval(() => {
      uptime++;
      setConnectionStats(prev => ({ ...prev, uptime }));
    }, 1000);

    // Connection events
    socket.on("connect", () => {
      console.log('Socket connected successfully');
      setSocketConnected(true);
      setSocketError(null);
      setHasReceivedDevices(false);
      
      // Register API key immediately
      socket.emit("viewer:registerApiKey", { apiKey });
      console.log('Registered API key with server');
      
      setConnectionStats(prev => ({ ...prev, connectedAt: new Date() }));
      
      // Set a timeout to stop loading if no devices received
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (!hasReceivedDevices) {
          console.log('No devices received after 3 seconds, stopping loading');
          setIsLoading(false);
        }
      }, 3000);
    });

    socket.on("connect_error", (error) => {
      console.error('Connection error:', error);
      setSocketError(error.message || 'Failed to connect');
      setSocketConnected(false);
      setIsLoading(false);
    });

    socket.on("disconnect", (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketConnected(false);
      clearInterval(uptimeIntervalRef.current);
    });

    // Device events
    socket.on("viewer:devices", (deviceList) => {
      console.log('Received devices:', deviceList?.length || 0);
      
      if (!Array.isArray(deviceList)) {
        console.warn('Invalid device list received');
        return;
      }
      
      const transformedDevices = deviceList.map(device => ({
        id: device.deviceId || `device-${Math.random().toString(36).substr(2, 9)}`,
        deviceId: device.deviceId,
        name: device.deviceName || device.deviceUserName || `Device ${device.deviceId?.substr(0, 8) || 'Unknown'}`,
        userName: device.deviceUserName,
        deviceType: device.deviceType || 'desktop',
        status: device.active ? 'online' : 'offline',
        active: device.active,
        lastSeen: device.lastSeen ? formatLastSeen(device.lastSeen) : 'Never',
        rawLastSeen: device.lastSeen,
        location: device.location || 'Unknown',
        ipAddress: device.ipAddress || 'N/A',
        os: device.os || 'Unknown',
        model: device.deviceModel || 'Unknown',
        battery: device.battery || null,
        signal: device.signalStrength || null
      }));
      
      setDevices(transformedDevices);
      updateDeviceStats(transformedDevices);
      setHasReceivedDevices(true);
      setIsLoading(false);
      setConnectionStats(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (deviceList.length > 0) {
        toast.success(`Loaded ${deviceList.length} devices`, { duration: 1500 });
      }
    });

    socket.on("viewer:device", (deviceUpdate) => {
      if (!deviceUpdate?.deviceId) return;
      
      setDevices(prevDevices => {
        const deviceIndex = prevDevices.findIndex(d => d.deviceId === deviceUpdate.deviceId);
        
        if (deviceIndex >= 0) {
          const updatedDevices = [...prevDevices];
          const oldDevice = updatedDevices[deviceIndex];
          
          updatedDevices[deviceIndex] = {
            ...oldDevice,
            status: deviceUpdate.active ? 'online' : 'offline',
            active: deviceUpdate.active,
            lastSeen: deviceUpdate.lastSeen ? formatLastSeen(deviceUpdate.lastSeen) : oldDevice.lastSeen,
            rawLastSeen: deviceUpdate.lastSeen || oldDevice.rawLastSeen,
            name: deviceUpdate.deviceName || deviceUpdate.deviceUserName || oldDevice.name,
            userName: deviceUpdate.deviceUserName || oldDevice.userName,
            deviceType: deviceUpdate.deviceType || oldDevice.deviceType,
            location: deviceUpdate.location || oldDevice.location,
            battery: deviceUpdate.battery || oldDevice.battery,
            signal: deviceUpdate.signalStrength || oldDevice.signal,
            os: deviceUpdate.os || oldDevice.os,
            model: deviceUpdate.deviceModel || oldDevice.model
          };
          
          updateDeviceStats(updatedDevices);
          return updatedDevices;
        } else {
          const newDevice = {
            id: deviceUpdate.deviceId,
            deviceId: deviceUpdate.deviceId,
            name: deviceUpdate.deviceName || deviceUpdate.deviceUserName || `Device ${deviceUpdate.deviceId?.substr(0, 8)}`,
            userName: deviceUpdate.deviceUserName,
            deviceType: deviceUpdate.deviceType || 'desktop',
            status: deviceUpdate.active ? 'online' : 'offline',
            active: deviceUpdate.active,
            lastSeen: deviceUpdate.lastSeen ? formatLastSeen(deviceUpdate.lastSeen) : 'Just now',
            rawLastSeen: deviceUpdate.lastSeen,
            location: deviceUpdate.location || 'Unknown',
            ipAddress: deviceUpdate.ipAddress || 'N/A',
            os: deviceUpdate.os || 'Unknown',
            model: deviceUpdate.deviceModel || 'Unknown',
            battery: deviceUpdate.battery || null,
            signal: deviceUpdate.signalStrength || null
          };
          
          const updatedDevices = [...prevDevices, newDevice];
          updateDeviceStats(updatedDevices);
          return updatedDevices;
        }
      });
      
      setConnectionStats(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
      setHasReceivedDevices(true);
      setIsLoading(false);
    });

    socket.on("viewer:error", (error) => {
      console.error('Server error:', error);
      setSocketError(error.message || 'Server error');
      setIsLoading(false);
    });

    // Reconnection events
    socket.io.on("reconnect", (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`);
      // Re-register API key
      socket.emit("viewer:registerApiKey", { apiKey });
      toast.success('Reconnected to monitoring', { duration: 1500 });
    });

    socket.io.on("reconnect_error", (error) => {
      console.error('Reconnection error:', error);
    });

    socket.io.on("reconnect_failed", () => {
      console.error('Reconnection failed');
      setSocketError('Failed to reconnect to server');
      setIsLoading(false);
    });

    socket.connect();
  }, [apiKey, validationStatus.valid, integrationRunning, formatLastSeen, updateDeviceStats]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearInterval(uptimeIntervalRef.current);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loadSettings]);

  // Auto-reconnect
  useEffect(() => {
    if (apiKey && validationStatus.valid && integrationRunning && !socketConnected && !socketRef.current) {
      const timer = setTimeout(() => {
        initializeSocket();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [apiKey, validationStatus.valid, integrationRunning, socketConnected, initializeSocket]);

  // Filter devices
  const filteredDevices = useMemo(() => {
    let filtered = devices;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(device =>
        device.name.toLowerCase().includes(query) ||
        device.deviceId.toLowerCase().includes(query) ||
        (device.userName && device.userName.toLowerCase().includes(query))
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(device => device.status === statusFilter);
    }
    
    return filtered;
  }, [devices, searchQuery, statusFilter]);

  // Handle refresh
  const handleRefresh = () => {
    setIsLoading(true);
    setHasReceivedDevices(false);
    
    if (socketRef.current?.connected) {
      socketRef.current.emit("viewer:registerApiKey", { apiKey });
      toast.info('Refreshing device list...', { duration: 1500 });
      
      // Set a timeout to stop loading
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    } else {
      setIsLoading(false);
      initializeSocket();
    }
  };

  // Handle device click
  const handleViewDevice = (device) => {
    setSelectedDevice(device);
    setShowDeviceDetails(true);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  // Format uptime
  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Force show devices even if loading (for debugging)
  const hasDevices = devices.length > 0;

  return (
    <section className="min-h-screen bg-[#0F111A] text-gray-200 font-poppins">
      <Header toggleSidebar={toggleSidebar} />
      <Toaster position="top-right" toastOptions={{ 
        style: { 
          background: '#161B22', 
          color: '#e5e7eb', 
          border: '1px solid #374151',
          borderRadius: '12px'
        } 
      }} />
      <div className="flex pt-[10vh]">
        <Sidebar isOpen={isSidebarOpen} />
        <main className={`transition-all duration-300 flex-1 p-4 overflow-y-auto h-[90vh] ${isSidebarOpen ? 'md:ml-[40%] lg:ml-[28%] xl:ml-[17%]' : 'ml-0'}`}>
          
          {/* Header */}
          <div className="rounded-xl mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#161B22] p-4 border border-gray-800/50">
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <FaWifi className="text-amber-400 text-sm" />
                </span>
                Device Monitoring
              </h1>
              <p className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                {socketConnected ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-emerald-400 text-[9px] font-bold uppercase tracking-wider">Live</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span className="text-rose-400 text-[9px] font-bold uppercase tracking-wider">Offline</span>
                  </>
                )}
                <span className="text-gray-600">•</span>
                <span>{deviceStats.total} devices</span>
                {connectionAttempts > 0 && (
                  <span className="text-gray-600">• Attempt {connectionAttempts}</span>
                )}
              </p>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-[#1F2937] hover:bg-amber-600/20 border border-gray-700 hover:border-amber-500/30 px-4 py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center gap-2 text-amber-400 disabled:opacity-50"
            >
              <FiRefreshCw className={isLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Online', value: deviceStats.online, color: 'text-emerald-400', icon: <FaWifi className="text-emerald-400" /> },
              { label: 'Offline', value: deviceStats.offline, color: 'text-rose-400', icon: <FiWifiOff className="text-rose-400" /> },
              { label: 'Total', value: deviceStats.total, color: 'text-white', icon: <MdDevices className="text-amber-400" /> },
            ].map((card, i) => (
              <div key={i} className="bg-[#161B22] border border-gray-800/50 p-4 rounded-xl">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">{card.label}</p>
                </div>
                <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Error Banner */}
          {socketError && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <FaExclamationTriangle /> {socketError}
            </div>
          )}

          {/* Integration Warning */}
          {(!apiKey || !validationStatus.valid || !integrationRunning) && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-amber-400 text-xs flex items-center gap-2">
              <FaExclamationTriangle />
              {!apiKey ? 'API key missing' : !validationStatus.valid ? 'Invalid API key' : 'Integration inactive'}
            </div>
          )}

          {/* Filters */}
          <div className="bg-[#161B22] border border-gray-800/50 p-3 rounded-xl mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-[10px]" />
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2 pl-8 focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-32 bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="text-[9px] text-amber-400 hover:text-amber-300 font-bold uppercase px-3 py-1.5 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Device List */}
          <div className="bg-[#161B22] border border-gray-800/50 rounded-xl overflow-hidden">
            {isLoading && !hasDevices ? (
              <div className="p-8 text-center">
                <div className="inline-block p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3">
                  <FaSync className="animate-spin text-amber-400 text-xl" />
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Connecting to server...</p>
                <p className="text-[9px] text-gray-600 mt-1">Waiting for device data</p>
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-3xl mb-2">{devices.length === 0 ? '📱' : '🔍'}</div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {devices.length === 0 ? 'No devices connected' : 'No devices match your search'}
                </p>
                <p className="text-[9px] text-gray-600 mt-1">
                  {devices.length === 0 
                    ? (socketConnected ? 'Devices will appear here when they connect' : 'Connect to monitoring to see devices')
                    : 'Try adjusting your search'}
                </p>
                {devices.length === 0 && socketConnected && (
                  <button
                    onClick={handleRefresh}
                    className="mt-3 text-[9px] text-amber-400 hover:text-amber-300 font-bold uppercase border border-amber-500/20 hover:border-amber-500/40 px-4 py-1.5 rounded-lg transition-all"
                  >
                    <FaSync className="inline mr-1" /> Refresh
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {filteredDevices.map((device) => (
                  <div 
                    key={device.id} 
                    className="p-3 hover:bg-[#1F2937] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => handleViewDevice(device)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-[#0F111A] border border-gray-700 flex-shrink-0">
                        {getDeviceTypeIcon(device.deviceType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{device.name}</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${getStatusBadge(device.status)}`}>
                            {device.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] text-gray-500 mt-0.5">
                          {device.userName && <span className="truncate">{device.userName}</span>}
                          {device.os && <span>{device.os}</span>}
                          <span className="flex items-center gap-1">
                            <FaRegClock className="text-[8px]" /> {device.lastSeen}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {device.battery && (
                        <span className="text-[9px] text-gray-500 flex items-center gap-1">
                          {getBatteryIcon(device.battery)}
                          {device.battery}%
                        </span>
                      )}
                      <button 
                        className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/30 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] transition-all"
                        onClick={(e) => { e.stopPropagation(); handleViewDevice(device); }}
                      >
                        <FaEye />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 text-center text-[8px] text-gray-600 uppercase tracking-wider border-t border-gray-800/50 pt-4 flex items-center justify-center gap-4">
            <span>{socketConnected ? '🟢 Live data' : '🔴 Disconnected'}</span>
            <span>•</span>
            <span>{deviceStats.total} devices</span>
            <span>•</span>
            <span>{connectionStats.messageCount} updates</span>
            {socketConnected && hasReceivedDevices && (
              <span className="text-emerald-400">✓ Ready</span>
            )}
          </div>

        </main>
      </div>

      {/* Device Details Modal */}
      {showDeviceDetails && selectedDevice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-sm p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <MdDevices /> Device Details
              </h3>
              <button onClick={() => setShowDeviceDetails(false)} className="text-gray-500 hover:text-gray-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-[#0F111A] border border-gray-700">
                  {getDeviceTypeIcon(selectedDevice.deviceType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white truncate">{selectedDevice.name}</h4>
                  {selectedDevice.userName && (
                    <p className="text-[10px] text-gray-500 truncate">{selectedDevice.userName}</p>
                  )}
                </div>
                <span className={`text-[8px] px-2 py-1 rounded-full font-bold uppercase ${getStatusBadge(selectedDevice.status)}`}>
                  {selectedDevice.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-[#0F111A] p-2 rounded-lg border border-gray-800">
                  <p className="text-[7px] font-bold uppercase text-gray-500">Type</p>
                  <p className="text-xs font-medium text-gray-300 capitalize">{selectedDevice.deviceType}</p>
                </div>
                <div className="bg-[#0F111A] p-2 rounded-lg border border-gray-800">
                  <p className="text-[7px] font-bold uppercase text-gray-500">OS</p>
                  <p className="text-xs font-medium text-gray-300">{selectedDevice.os}</p>
                </div>
                <div className="bg-[#0F111A] p-2 rounded-lg border border-gray-800">
                  <p className="text-[7px] font-bold uppercase text-gray-500">Last Seen</p>
                  <p className="text-xs font-medium text-gray-300">{selectedDevice.lastSeen}</p>
                </div>
                <div className="bg-[#0F111A] p-2 rounded-lg border border-gray-800">
                  <p className="text-[7px] font-bold uppercase text-gray-500">Model</p>
                  <p className="text-xs font-medium text-gray-300 truncate">{selectedDevice.model}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center p-2 rounded-lg bg-[#0F111A] border border-gray-800/50">
                  <span className="text-[9px] text-gray-500">Device ID</span>
                  <code className="text-[8px] font-mono text-gray-400">{selectedDevice.deviceId}</code>
                </div>
                {selectedDevice.location && selectedDevice.location !== 'Unknown' && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#0F111A] border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Location</span>
                    <span className="text-[9px] text-gray-300 flex items-center gap-1">
                      <MdLocationOn className="text-amber-400" /> {selectedDevice.location}
                    </span>
                  </div>
                )}
                {selectedDevice.battery && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#0F111A] border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Battery</span>
                    <span className="text-[9px] text-gray-300 flex items-center gap-1">
                      {getBatteryIcon(selectedDevice.battery)} {selectedDevice.battery}%
                    </span>
                  </div>
                )}
                {selectedDevice.signal && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-[#0F111A] border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Signal</span>
                    <span className="text-[9px] text-gray-300 flex items-center gap-1">
                      <GiNetworkBars className="text-amber-400" /> {selectedDevice.signal}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DeviceMonitoring;