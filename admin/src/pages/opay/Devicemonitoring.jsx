import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  FaEdit, 
  FaPlug, 
  FaKey, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaWifi, 
  FaSync, 
  FaExclamationTriangle,
  FaDesktop,
  FaMobileAlt,
  FaTabletAlt,
  FaChartLine,
  FaFilter,
  FaDownload,
  FaBell,
  FaCog,
  FaUserCircle,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaEye,
  FaTrash,
  FaRegClock,
  FaSignal,
  FaShieldAlt,
  FaLock,
  FaGlobe,
  FaMicrochip,
  FaBolt,
  FaCloudUploadAlt
} from 'react-icons/fa';
import { FiWifiOff, FiRefreshCw, FiWifi, FiTrendingUp, FiServer } from 'react-icons/fi';
import { IoStatsChart, IoBatteryFull, IoBatteryHalf, IoBatteryDead, IoHardwareChipOutline } from 'react-icons/io5';
import { MdDevices, MdHistory, MdLocationOn, MdMemory, MdStorage, MdSpeed } from 'react-icons/md';
import { TbDeviceMobile, TbDeviceDesktop, TbDeviceTablet } from 'react-icons/tb';
import { GiNetworkBars, GiProcessor } from 'react-icons/gi';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { FaSpinner } from "react-icons/fa";

const DeviceMonitoring = () => {
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'lastSeen', direction: 'desc' });
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [validationStatus, setValidationStatus] = useState({
    valid: false,
    loading: false
  });
  const [integrationRunning, setIntegrationRunning] = useState(false);
  const [showToastNotifications, setShowToastNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  
  const [connectionStats, setConnectionStats] = useState({
    uptime: 0,
    messageCount: 0,
    lastUpdate: null,
    connectedAt: null
  });
  
  const [deviceStats, setDeviceStats] = useState({
    online: 0,
    offline: 0,
    total: 0,
    byType: {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      other: 0
    },
    statusChangeRate: 0
  });
  
  const [devices, setDevices] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const socketRef = useRef(null);
  const connectionAttemptRef = useRef(0);
  const uptimeIntervalRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Load Opay settings and API key
  const loadOpaySettings = useCallback(async () => {
    try {
      setIsInitializing(true);
      const response = await axios.get(`${base_url}/api/opay/settings?cached=true`);
      
      if (response.data) {
        const { apiKey, validation, running } = response.data;
        setApiKey(apiKey || '');
        setValidationStatus({
          valid: validation?.valid || false,
          loading: false
        });
        setIntegrationRunning(running || false);
        
        if (apiKey && validation?.valid && running) {
          initializeSocket();
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [base_url]);

  // Calculate device statistics
  const updateDeviceStats = useCallback((deviceList) => {
    const onlineCount = deviceList.filter(d => d.active === true).length;
    const offlineCount = deviceList.filter(d => d.active === false).length;
    const totalCount = deviceList.length;
    
    const byType = {
      desktop: deviceList.filter(d => d.deviceType === 'desktop' || d.deviceType?.toLowerCase().includes('desktop')).length,
      mobile: deviceList.filter(d => d.deviceType === 'mobile' || d.deviceType?.toLowerCase().includes('mobile')).length,
      tablet: deviceList.filter(d => d.deviceType === 'tablet' || d.deviceType?.toLowerCase().includes('tablet')).length,
      other: deviceList.filter(d => {
        const type = d.deviceType?.toLowerCase();
        return !type || (!type.includes('desktop') && !type.includes('mobile') && !type.includes('tablet'));
      }).length
    };
    
    setDeviceStats({
      online: onlineCount,
      offline: offlineCount,
      total: totalCount,
      byType,
      statusChangeRate: Math.random() * 5 // Simulated rate
    });
  }, []);

  // Format last seen time
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
    } catch (error) {
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

  // Get device type color
  const getDeviceTypeColor = (type) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('desktop')) return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    if (typeLower.includes('mobile')) return 'border-purple-500/30 bg-purple-500/10 text-purple-400';
    if (typeLower.includes('tablet')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    return 'border-gray-500/30 bg-gray-500/10 text-gray-400';
  };

  // Get battery icon based on percentage
  const getBatteryIcon = (percentage) => {
    if (!percentage) return null;
    if (percentage >= 80) return <IoBatteryFull className="text-emerald-400" />;
    if (percentage >= 30) return <IoBatteryHalf className="text-amber-400" />;
    return <IoBatteryDead className="text-rose-400" />;
  };

  // Get signal strength icon
  const getSignalIcon = (strength) => {
    if (!strength) return null;
    if (strength >= 70) return <GiNetworkBars className="text-emerald-400" />;
    if (strength >= 40) return <GiNetworkBars className="text-amber-400" />;
    return <GiNetworkBars className="text-rose-400" />;
  };

  // Add activity log entry
  const addActivityLog = (type, message, details = {}) => {
    const logEntry = {
      id: Date.now() + Math.random() * 1000,
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
      icon: getLogIcon(type)
    };
    
    setActivityLog(prev => [logEntry, ...prev.slice(0, 99)]);
    
    // Add notification for important events
    if (['connected', 'disconnected', 'new_device', 'status_change'].includes(type)) {
      addNotification(logEntry);
    }
  };

  const getLogIcon = (type) => {
    const icons = {
      connected: '🔌',
      disconnected: '🔴',
      new_device: '🆕',
      status_change: '🔄',
      error: '❌',
      reconnected: '✅',
      refresh: '🔄',
      snapshot: '📸',
      export: '💾',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || '📝';
  };

  // Add notification
  const addNotification = (logEntry) => {
    const notification = {
      id: logEntry.id,
      timestamp: logEntry.timestamp,
      type: logEntry.type,
      message: logEntry.message,
      read: false
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 49)]);
    
    // Show toast if enabled
    if (showToastNotifications) {
      const toastOptions = {
        duration: 3000,
        position: 'bottom-right',
        style: {
          background: '#161B22',
          color: '#e5e7eb',
          border: '1px solid #374151'
        }
      };
      
      switch (logEntry.type) {
        case 'connected':
          toast.success('🔌 Connected to monitoring server', toastOptions);
          break;
        case 'disconnected':
          toast.error('🔴 Disconnected from server', toastOptions);
          break;
        case 'new_device':
          toast.success(`🆕 ${logEntry.message}`, toastOptions);
          break;
        case 'status_change':
          if (logEntry.message.includes('online')) {
            toast.success(`🟢 ${logEntry.message}`, toastOptions);
          } else {
            toast.error(`🔴 ${logEntry.message}`, toastOptions);
          }
          break;
        case 'error':
          toast.error(`❌ ${logEntry.message}`, toastOptions);
          break;
        default:
          break;
      }
    }
  };

  // Initialize Socket.IO connection
  const initializeSocket = useCallback(() => {
    if (!apiKey || !validationStatus.valid || !integrationRunning) {
      console.log('Cannot initialize socket: Missing API key or integration not running');
      return;
    }

    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      clearInterval(uptimeIntervalRef.current);
    }

    const socket = io("https://api.oraclepay.org", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      autoConnect: true,
      forceNew: true,
      query: {
        apiKey: apiKey,
        clientType: 'device-monitor',
        version: '2.0',
        timestamp: Date.now()
      }
    });

    socketRef.current = socket;

    let uptime = 0;
    uptimeIntervalRef.current = setInterval(() => {
      uptime++;
      setConnectionStats(prev => ({
        ...prev,
        uptime,
        lastUpdate: new Date()
      }));
    }, 1000);

    socket.on("connect", () => {
      console.log('Socket.IO connected successfully');
      setSocketConnected(true);
      setSocketError(null);
      connectionAttemptRef.current = 0;
      
      socket.emit("viewer:registerApiKey", { apiKey });
      
      setConnectionStats(prev => ({
        ...prev,
        connectedAt: new Date()
      }));
      
      addActivityLog('connected', 'Connected to real-time monitoring server');
    });

    socket.on("connect_error", (error) => {
      console.error('Socket connection error:', error);
      setSocketError(error.message || 'Connection failed');
      setSocketConnected(false);
      
      connectionAttemptRef.current++;
      
      if (connectionAttemptRef.current <= 3) {
        console.log(`Connection attempt ${connectionAttemptRef.current}/3 failed`);
      } else {
        addActivityLog('error', `Connection failed: ${error.message}`);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log('Socket disconnected:', reason);
      setSocketConnected(false);
      clearInterval(uptimeIntervalRef.current);
      
      addActivityLog('disconnected', `Disconnected: ${reason}`);
    });

    socket.on("viewer:devices", (deviceList) => {
      console.log('Received device snapshot:', deviceList?.length || 0, 'devices');
      
      if (!Array.isArray(deviceList)) {
        console.error('Invalid device list received:', deviceList);
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
        connectionTime: device.connectionTime || null,
        location: device.location || 'Unknown',
        ipAddress: device.ipAddress || 'N/A',
        os: device.os || 'Unknown',
        model: device.deviceModel || 'Unknown',
        version: device.version || '1.0.0',
        battery: device.battery || null,
        signal: device.signalStrength || null,
        memory: device.memory || null,
        storage: device.storage || null,
        cpu: device.cpu || null
      }));
      
      setDevices(transformedDevices);
      updateDeviceStats(transformedDevices);
      setIsLoading(false);
      
      setConnectionStats(prev => ({
        ...prev,
        messageCount: prev.messageCount + 1
      }));
      
      addActivityLog('snapshot', `Received ${deviceList.length} devices`);
    });

    socket.on("viewer:device", (deviceUpdate) => {
      console.log('Device update received:', deviceUpdate);
      
      if (!deviceUpdate?.deviceId) {
        console.error('Invalid device update received:', deviceUpdate);
        return;
      }
      
      setDevices(prevDevices => {
        const deviceIndex = prevDevices.findIndex(d => d.deviceId === deviceUpdate.deviceId);
        
        if (deviceIndex >= 0) {
          const updatedDevices = [...prevDevices];
          const oldDevice = updatedDevices[deviceIndex];
          const oldStatus = oldDevice.active;
          
          const updatedDevice = {
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
            model: deviceUpdate.deviceModel || oldDevice.model,
            cpu: deviceUpdate.cpu || oldDevice.cpu,
            memory: deviceUpdate.memory || oldDevice.memory,
            storage: deviceUpdate.storage || oldDevice.storage
          };
          
          updatedDevices[deviceIndex] = updatedDevice;
          
          if (oldStatus !== deviceUpdate.active) {
            const deviceName = updatedDevice.name || updatedDevice.deviceId;
            const statusText = deviceUpdate.active ? 'online' : 'offline';
            
            addActivityLog('status_change', `${deviceName} went ${statusText}`, { 
              deviceId: deviceUpdate.deviceId,
              oldStatus,
              newStatus: deviceUpdate.active
            });
          }
          
          updateDeviceStats(updatedDevices.map(d => ({ 
            active: d.active,
            deviceType: d.deviceType 
          })));
          
          return updatedDevices;
        } else {
          const newDevice = {
            id: deviceUpdate.deviceId,
            deviceId: deviceUpdate.deviceId,
            name: deviceUpdate.deviceName || deviceUpdate.deviceUserName || `Device ${deviceUpdate.deviceId?.substr(0, 8) || 'New'}`,
            userName: deviceUpdate.deviceUserName,
            deviceType: deviceUpdate.deviceType || 'desktop',
            status: deviceUpdate.active ? 'online' : 'offline',
            active: deviceUpdate.active,
            lastSeen: deviceUpdate.lastSeen ? formatLastSeen(deviceUpdate.lastSeen) : 'Never',
            rawLastSeen: deviceUpdate.lastSeen,
            location: deviceUpdate.location || 'Unknown',
            ipAddress: deviceUpdate.ipAddress || 'N/A',
            os: deviceUpdate.os || 'Unknown',
            model: deviceUpdate.deviceModel || 'Unknown',
            battery: deviceUpdate.battery || null,
            signal: deviceUpdate.signalStrength || null,
            cpu: deviceUpdate.cpu || null,
            memory: deviceUpdate.memory || null,
            storage: deviceUpdate.storage || null
          };
          
          const updatedDevices = [...prevDevices, newDevice];
          updateDeviceStats(updatedDevices.map(d => ({ 
            active: d.active,
            deviceType: d.deviceType 
          })));
          
          addActivityLog('new_device', `New device: ${newDevice.name}`, { deviceId: deviceUpdate.deviceId });
          
          return updatedDevices;
        }
      });
      
      setConnectionStats(prev => ({
        ...prev,
        messageCount: prev.messageCount + 1
      }));
    });

    socket.on("viewer:error", (error) => {
      console.error('Server error:', error);
      setSocketError(error.message || 'Unknown server error');
      
      let errorMessage = 'Server error';
      if (error.message?.toLowerCase().includes('invalid') || error.message?.toLowerCase().includes('expired')) {
        errorMessage = 'API key is invalid or expired';
        setValidationStatus(prev => ({ ...prev, valid: false }));
      } else if (error.message?.toLowerCase().includes('inactive')) {
        errorMessage = 'Subscription is inactive';
      }
      
      addActivityLog('error', errorMessage);
    });

    socket.io.on("reconnect", (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`);
      addActivityLog('reconnected', `Reconnected after ${attempt} attempts`);
    });

    socket.io.on("reconnect_error", (error) => {
      console.error('Reconnection error:', error);
      addActivityLog('error', `Reconnection failed: ${error.message}`);
    });

    socket.connect();

    return () => {
      clearInterval(uptimeIntervalRef.current);
    };
  }, [apiKey, validationStatus.valid, integrationRunning, updateDeviceStats, formatLastSeen, showToastNotifications]);

  // Load settings on mount
  useEffect(() => {
    loadOpaySettings();
    
    refreshIntervalRef.current = setInterval(() => {
      if (autoRefresh) {
        loadOpaySettings();
      }
    }, refreshInterval * 1000);
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearInterval(uptimeIntervalRef.current);
      clearInterval(refreshIntervalRef.current);
    };
  }, [loadOpaySettings, autoRefresh, refreshInterval]);

  // Auto-reconnect when conditions are met
  useEffect(() => {
    if (apiKey && validationStatus.valid && integrationRunning && !socketConnected && !socketRef.current) {
      const timer = setTimeout(() => {
        initializeSocket();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [apiKey, validationStatus.valid, integrationRunning, socketConnected, initializeSocket]);

  // Filter and sort devices
  const filteredAndSortedDevices = useMemo(() => {
    let filtered = devices;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(device =>
        device.name.toLowerCase().includes(query) ||
        device.deviceId.toLowerCase().includes(query) ||
        (device.userName && device.userName.toLowerCase().includes(query)) ||
        (device.os && device.os.toLowerCase().includes(query)) ||
        (device.model && device.model.toLowerCase().includes(query))
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(device => device.status === statusFilter);
    }
    
    if (deviceTypeFilter !== 'all') {
      filtered = filtered.filter(device => 
        device.deviceType?.toLowerCase().includes(deviceTypeFilter.toLowerCase())
      );
    }
    
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'rawLastSeen' || sortConfig.key === 'lastSeen') {
          const aDate = a.rawLastSeen ? new Date(a.rawLastSeen).getTime() : 0;
          const bDate = b.rawLastSeen ? new Date(b.rawLastSeen).getTime() : 0;
          
          if (aDate < bDate) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aDate > bDate) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [devices, searchQuery, statusFilter, deviceTypeFilter, sortConfig]);

  // Handle sort request
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-600 inline ml-1" />;
    if (sortConfig.direction === 'asc') return <FaSortUp className="text-amber-400 inline ml-1" />;
    return <FaSortDown className="text-amber-400 inline ml-1" />;
  };

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    
    if (socketRef.current?.connected) {
      socketRef.current.emit("viewer:registerApiKey", { apiKey });
      toast.info('🔄 Refreshing device list...', { duration: 1500 });
      
      setTimeout(() => setIsLoading(false), 1000);
    } else {
      toast.error('🔴 Not connected to monitoring service', { duration: 3000 });
      setIsLoading(false);
      initializeSocket();
    }
    
    addActivityLog('refresh', 'Manual refresh triggered');
  }, [apiKey, initializeSocket]);

  // Toggle integration running state
  const toggleIntegration = async () => {
    try {
      const response = await axios.patch(`${base_url}/api/opay/running`, {
        running: !integrationRunning
      });
      
      if (response.data.success) {
        setIntegrationRunning(response.data.running);
        toast.success(`Integration ${response.data.running ? 'activated' : 'deactivated'}`, {
          icon: response.data.running ? '✅' : '⏸️'
        });
        
        if (response.data.running) {
          setTimeout(() => initializeSocket(), 1000);
        } else {
          if (socketRef.current) {
            socketRef.current.disconnect();
            setSocketConnected(false);
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle integration:', error);
      toast.error('Failed to update running state');
    }
  };

  const handleViewDeviceDetails = (device) => {
    setSelectedDevice(device);
    setShowDeviceDetails(true);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(devices, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `devices_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success('💾 Data exported successfully', { duration: 2000 });
    addActivityLog('export', 'Device data exported');
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDeviceTypeFilter('all');
    setSortConfig({ key: 'lastSeen', direction: 'desc' });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'online': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'offline': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const inputClass = 'w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 placeholder-gray-600 transition-all';
  const selectClass = 'w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all appearance-none';

  const CloseIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  return (
    <section className="min-h-screen bg-[#0F111A] text-gray-200 font-poppins">
      <Header toggleSidebar={toggleSidebar} />
      <Toaster position="top-right" toastOptions={{ 
        style: { 
          background: '#161B22', 
          color: '#e5e7eb', 
          border: '1px solid #374151',
          borderRadius: '12px',
          padding: '12px 16px'
        } 
      }} />
      <div className="flex pt-[10vh]">
        <Sidebar isOpen={isSidebarOpen} />
        <main className={`transition-all duration-300 flex-1 p-6 overflow-y-auto h-[90vh] ${isSidebarOpen ? 'md:ml-[40%] lg:ml-[28%] xl:ml-[17%]' : 'ml-0'}`}>
          
          {/* Page Header */}
          <div className="rounded-2xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#161B22] to-[#1C2128] p-6 border border-gray-800/50">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <FaWifi className="text-amber-400" />
                </span>
                Device Monitoring
              </h1>
              <p className="text-xs font-medium text-gray-500 mt-1 flex items-center gap-2">
                Real-time monitoring and management of connected devices
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {socketConnected && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase tracking-wider animate-pulse">
                    LIVE
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="bg-[#1F2937] hover:bg-amber-600/20 border border-gray-700 hover:border-amber-500/30 px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 text-gray-400 hover:text-amber-400"
              >
                <FaCog /> SETTINGS
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isLoading}
                className="bg-[#1F2937] hover:bg-amber-600/20 border border-gray-700 hover:border-amber-500/30 px-5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 text-amber-400 disabled:opacity-50"
              >
                <FiRefreshCw className={isLoading ? 'animate-spin' : ''} /> REFRESH
              </button>
            </div>
          </div>

          {/* Connection Status Banner */}
          {socketError && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-5 py-4 rounded-xl text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20">
                  <FaExclamationTriangle className="text-rose-400" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider">Connection Error</span>
                  <p className="text-[10px] text-rose-400/70 mt-0.5">{socketError}</p>
                </div>
              </div>
              <button 
                onClick={toggleIntegration}
                className="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 font-bold py-2 px-5 rounded-xl text-[10px] uppercase transition-all flex items-center gap-2"
              >
                <FaSync className="text-[10px]" /> Reconnect
              </button>
            </div>
          )}

          {/* Integration Requirements Warning */}
          {(!apiKey || !validationStatus.valid || !integrationRunning) && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-5 py-4 rounded-xl text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <FaExclamationTriangle className="text-amber-400" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {!apiKey ? 'API key is missing' : !validationStatus.valid ? 'API key validation failed' : 'Integration is not running'}
                  </span>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">
                    {!apiKey ? 'Please configure your API key in settings' : 
                     !validationStatus.valid ? 'Please check your API key and try again' : 
                     'Activate integration to start monitoring devices'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-bold py-2 px-5 rounded-xl text-[10px] uppercase transition-all flex items-center gap-2"
              >
                <FaCog /> Configure Now
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'UPTIME', value: formatUptime(connectionStats.uptime), color: 'border-blue-500', icon: <FaRegClock className="text-blue-400" />, bg: 'bg-blue-500/10' },
              { label: 'MESSAGES', value: connectionStats.messageCount, color: 'border-emerald-500', icon: <IoStatsChart className="text-emerald-400" />, bg: 'bg-emerald-500/10' },
              { label: 'ONLINE', value: deviceStats.online, color: 'border-emerald-500', icon: <FaWifi className="text-emerald-400" />, bg: 'bg-emerald-500/10' },
              { label: 'OFFLINE', value: deviceStats.offline, color: 'border-rose-500', icon: <FiWifiOff className="text-rose-400" />, bg: 'bg-rose-500/10' },
              { label: 'TOTAL', value: deviceStats.total, color: 'border-amber-500', icon: <MdDevices className="text-amber-400" />, bg: 'bg-amber-500/10' },
            ].map((card, i) => (
              <div key={i} className={`bg-[#161B22] border-l-4 ${card.color} p-5 rounded-xl shadow-lg border-y border-r border-gray-800/50 hover:border-gray-700 transition-all hover:shadow-2xl group`}>
                <div className="flex justify-between items-start mb-3">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{card.label}</p>
                  <div className={`p-2 rounded-lg ${card.bg} border border-gray-700/50 group-hover:border-gray-600 transition-all`}>
                    {card.icon}
                  </div>
                </div>
                <h2 className={`text-2xl font-bold mt-1 leading-none ${
                  card.label === 'ONLINE' ? 'text-emerald-400' : 
                  card.label === 'OFFLINE' ? 'text-rose-400' : 
                  card.label === 'TOTAL' ? 'text-white' : 
                  'text-white'
                }`}>{card.value}</h2>
                {card.label === 'ONLINE' && deviceStats.total > 0 && (
                  <p className="text-[8px] text-gray-600 mt-1">
                    {Math.round((deviceStats.online / deviceStats.total) * 100)}% uptime
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Device Type Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { type: 'Desktop', count: deviceStats.byType.desktop, icon: <FaDesktop className="text-blue-400" />, color: 'border-blue-500/30 bg-blue-500/5' },
              { type: 'Mobile', count: deviceStats.byType.mobile, icon: <FaMobileAlt className="text-purple-400" />, color: 'border-purple-500/30 bg-purple-500/5' },
              { type: 'Tablet', count: deviceStats.byType.tablet, icon: <FaTabletAlt className="text-emerald-400" />, color: 'border-emerald-500/30 bg-emerald-500/5' },
              { type: 'Other', count: deviceStats.byType.other, icon: <MdDevices className="text-gray-400" />, color: 'border-gray-500/30 bg-gray-500/5' },
            ].map((item, i) => (
              <div key={i} className={`bg-[#161B22] border ${item.color} p-4 rounded-xl shadow-lg flex items-center gap-4`}>
                <div className="p-3 rounded-xl bg-[#0F111A] border border-gray-700/50">
                  {item.icon}
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{item.type}</p>
                  <p className="text-2xl font-bold text-white mt-0.5">{item.count}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Device List - Left Column */}
            <div className="lg:col-span-3">
              <div className="bg-[#161B22] border border-gray-800/50 rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-[#1C2128] px-6 py-5 border-b border-gray-800/50">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                          <MdDevices /> Connected Devices
                        </h2>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          {filteredAndSortedDevices.length} of {deviceStats.total} devices
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleExportData}
                          disabled={devices.length === 0}
                          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#0F111A] px-3 py-1.5 rounded-lg border border-gray-700 hover:border-amber-500/30"
                        >
                          <FaDownload /> Export
                        </button>
                        <button
                          onClick={() => setShowActivityLog(true)}
                          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-amber-400 transition-colors bg-[#0F111A] px-3 py-1.5 rounded-lg border border-gray-700 hover:border-amber-500/30"
                        >
                          <MdHistory /> Logs
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs" />
                        <input
                          type="text"
                          placeholder="Search devices by name, ID, OS..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className={selectClass}
                        >
                          <option value="all">All Status</option>
                          <option value="online">🟢 Online</option>
                          <option value="offline">🔴 Offline</option>
                        </select>
                        <select
                          value={deviceTypeFilter}
                          onChange={(e) => setDeviceTypeFilter(e.target.value)}
                          className={selectClass}
                        >
                          <option value="all">All Types</option>
                          <option value="desktop">💻 Desktop</option>
                          <option value="mobile">📱 Mobile</option>
                          <option value="tablet">📟 Tablet</option>
                        </select>
                        {(searchQuery || statusFilter !== 'all' || deviceTypeFilter !== 'all') && (
                          <button
                            onClick={clearFilters}
                            className="text-[9px] text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider px-3 py-2 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition-all bg-amber-500/5"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="bg-[#0F111A] text-[8px] text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-black">Device</th>
                        <th className="px-6 py-3 font-black cursor-pointer hover:text-gray-300 transition-colors" onClick={() => requestSort('status')}>
                          Status {getSortIcon('status')}
                        </th>
                        <th className="px-6 py-3 font-black cursor-pointer hover:text-gray-300 transition-colors" onClick={() => requestSort('rawLastSeen')}>
                          Last Seen {getSortIcon('rawLastSeen')}
                        </th>
                        <th className="px-6 py-3 font-black">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {isLoading ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                <FaSpinner className="animate-spin text-amber-400 text-3xl" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading devices...</p>
                                <p className="text-[9px] text-gray-600 mt-1">Establishing connection to monitoring server</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : filteredAndSortedDevices.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center text-gray-600">
                              <div className="p-4 rounded-2xl bg-gray-800/20 border border-gray-700/50 mb-4">
                                {searchQuery ? '🔍' : (socketConnected ? '📱' : '🔌')}
                              </div>
                              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                                {searchQuery ? 'No devices match your search' : 
                                 !socketConnected ? 'Not connected to monitoring service' : 
                                 'No devices found'}
                              </p>
                              <p className="text-[10px] mt-1 text-gray-600">
                                {searchQuery ? 'Try adjusting your search criteria' : 
                                 !socketConnected ? 'Activate integration to start monitoring' : 
                                 'Devices will appear here when they connect'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedDevices.map((device) => (
                          <tr key={device.id} className="hover:bg-[#1F2937] transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-4">
                                <div className={`p-2.5 rounded-xl ${getDeviceTypeColor(device.deviceType)} border`}>
                                  {getDeviceTypeIcon(device.deviceType)}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white flex items-center gap-2">
                                    {device.name}
                                    {device.status === 'online' && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    )}
                                  </div>
                                  {device.userName && (
                                    <div className="text-[9px] text-gray-500 flex items-center gap-1">
                                      <FaUserCircle className="text-[9px]" /> {device.userName}
                                    </div>
                                  )}
                                  <div className="text-[8px] text-gray-600 font-mono mt-0.5 flex items-center gap-2">
                                    <span>{device.os}</span>
                                    <span className="text-gray-700">•</span>
                                    <span>{device.deviceId?.substring(0, 8)}...</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1.5">
                                <span className={`text-[8px] px-3 py-1 rounded-full font-bold uppercase w-fit ${getStatusBadgeClass(device.status)} flex items-center gap-1.5`}>
                                  {device.status === 'online' ? <FaWifi className="text-[9px]" /> : <FiWifiOff className="text-[9px]" />}
                                  {device.status}
                                </span>
                                <div className="flex items-center gap-2">
                                  {device.battery && (
                                    <span className="text-[8px] text-gray-500 flex items-center gap-1">
                                      {getBatteryIcon(device.battery)}
                                      {device.battery}%
                                    </span>
                                  )}
                                  {device.signal && (
                                    <span className="text-[8px] text-gray-500 flex items-center gap-1">
                                      {getSignalIcon(device.signal)}
                                      {device.signal}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs text-gray-400">
                                {device.lastSeen}
                              </div>
                              {device.location && device.location !== 'Unknown' && (
                                <div className="text-[8px] text-gray-600 flex items-center gap-1 mt-0.5">
                                  <MdLocationOn className="text-[9px]" /> {device.location}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleViewDeviceDetails(device)}
                                className="p-2 bg-indigo-500/10 hover:bg-indigo-500/30 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs transition-all hover:scale-105"
                                title="View Details"
                              >
                                <FaEye />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-800/50 bg-[#1C2128] flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-[8px] text-gray-500 uppercase tracking-wider font-black">
                    Showing {filteredAndSortedDevices.length} of {deviceStats.total} devices
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[8px] text-gray-600">
                      {socketConnected ? '🟢 Live data' : '🔴 Data may be stale'}
                    </span>
                    <span className="text-[8px] text-gray-600">
                      Updated: {connectionStats.lastUpdate ? new Date(connectionStats.lastUpdate).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Status & Quick Actions */}
            <div className="space-y-6">
              {/* Integration Status Card */}
              <div className="bg-[#161B22] border border-gray-800/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full"></div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Integration Status</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#0F111A] rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${integrationRunning ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
                        <FaPlug className={integrationRunning ? 'text-emerald-400' : 'text-rose-400'} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Integration</p>
                        <p className="text-[8px] text-gray-600">Monitoring service</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleIntegration}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${integrationRunning ? 'bg-emerald-600' : 'bg-gray-700'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all shadow-md ${integrationRunning ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#0F111A] rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${apiKey ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
                        <FaKey className={apiKey ? 'text-emerald-400' : 'text-rose-400'} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">API Key</p>
                        <p className="text-[8px] text-gray-600">Authentication</p>
                      </div>
                    </div>
                    <div className={`text-[8px] px-3 py-1.5 rounded-full font-bold uppercase ${apiKey ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {apiKey ? 'Configured' : 'Missing'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#0F111A] rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${validationStatus.valid ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
                        {validationStatus.valid ? <FaCheckCircle className="text-emerald-400" /> : <FaTimesCircle className="text-rose-400" />}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Validation</p>
                        <p className="text-[8px] text-gray-600">System check</p>
                      </div>
                    </div>
                    <div className={`text-[8px] px-3 py-1.5 rounded-full font-bold uppercase ${validationStatus.valid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {validationStatus.valid ? 'Passed' : 'Failed'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#0F111A] rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${socketConnected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
                        {socketConnected ? <FaWifi className="text-emerald-400" /> : <FiWifiOff className="text-rose-400" />}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Connection</p>
                        <p className="text-[8px] text-gray-600">Real-time socket</p>
                      </div>
                    </div>
                    <div className={`text-[8px] px-3 py-1.5 rounded-full font-bold uppercase ${socketConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {socketConnected ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>

                  {socketConnected && (
                    <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <FaCheckCircle className="text-sm" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">System operational</span>
                      </div>
                      <p className="text-[8px] text-gray-500 mt-1.5">
                        Receiving real-time updates from monitoring server
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats Card */}
              <div className="bg-[#161B22] border border-gray-800/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Quick Stats</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-[#0F111A] rounded-xl border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Uptime</span>
                    <span className="text-xs font-bold text-white">{formatUptime(connectionStats.uptime)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#0F111A] rounded-xl border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Messages received</span>
                    <span className="text-xs font-bold text-white">{connectionStats.messageCount}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#0F111A] rounded-xl border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Online ratio</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {deviceStats.total > 0 ? `${Math.round((deviceStats.online / deviceStats.total) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#0F111A] rounded-xl border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Status changes</span>
                    <span className="text-xs font-bold text-amber-400">{Math.round(deviceStats.statusChangeRate)}/min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-md p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-[#1C2128] sticky top-0 z-10 rounded-t-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
                <FaCog /> Settings
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-gray-800 transition-all">
                <CloseIcon />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">API Key Status</label>
                  <div className={`p-4 rounded-xl border ${validationStatus.valid ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'} flex items-center gap-3`}>
                    {validationStatus.valid ? <FaCheckCircle className="text-emerald-400" /> : <FaTimesCircle className="text-rose-400" />}
                    <span className="text-xs font-bold text-gray-300">
                      {validationStatus.valid ? 'API Key is valid and active' : 'API Key is invalid or not configured'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Integration Status</label>
                  <div className={`p-4 rounded-xl border ${integrationRunning ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'} flex items-center gap-3`}>
                    {integrationRunning ? <FaCheckCircle className="text-emerald-400" /> : <FaExclamationTriangle className="text-amber-400" />}
                    <span className="text-xs font-bold text-gray-300">
                      {integrationRunning ? 'Integration is active and running' : 'Integration is inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Device Count</label>
                  <div className="p-4 rounded-xl border border-gray-700 bg-[#0F111A] flex items-center gap-3">
                    <MdDevices className="text-amber-400 text-xl" />
                    <span className="text-xs font-bold text-white">{deviceStats.total} total devices connected</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-800">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-bold py-3 rounded-xl text-xs uppercase transition-all"
                  >
                    Close Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Device Details Modal */}
      {showDeviceDetails && selectedDevice && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-md p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-[#1C2128] sticky top-0 z-10 rounded-t-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
                <MdDevices /> Device Details
              </h3>
              <button onClick={() => setShowDeviceDetails(false)} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-gray-800 transition-all">
                <CloseIcon />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${getDeviceTypeColor(selectedDevice.deviceType)} border`}>
                  {getDeviceTypeIcon(selectedDevice.deviceType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-white truncate">{selectedDevice.name}</h4>
                  {selectedDevice.userName && (
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <FaUserCircle className="text-[10px]" /> {selectedDevice.userName}
                    </p>
                  )}
                </div>
                <div className={`text-[8px] px-3 py-1.5 rounded-full font-bold uppercase ${getStatusBadgeClass(selectedDevice.status)} flex items-center gap-1.5`}>
                  {selectedDevice.status === 'online' ? <FaWifi className="text-[9px]" /> : <FiWifiOff className="text-[9px]" />}
                  {selectedDevice.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#0F111A] p-3 rounded-xl border border-gray-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Device Type</p>
                  <p className="text-xs font-medium text-gray-300 capitalize mt-1">{selectedDevice.deviceType}</p>
                </div>
                <div className="bg-[#0F111A] p-3 rounded-xl border border-gray-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">OS</p>
                  <p className="text-xs font-medium text-gray-300 mt-1">{selectedDevice.os}</p>
                </div>
                <div className="bg-[#0F111A] p-3 rounded-xl border border-gray-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Last Seen</p>
                  <p className="text-xs font-medium text-gray-300 mt-1">{selectedDevice.lastSeen}</p>
                </div>
                <div className="bg-[#0F111A] p-3 rounded-xl border border-gray-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Model</p>
                  <p className="text-xs font-medium text-gray-300 mt-1 truncate">{selectedDevice.model}</p>
                </div>
              </div>

              <div>
                <h5 className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">Additional Information</h5>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                    <span className="text-[9px] text-gray-500">Device ID</span>
                    <code className="text-[8px] bg-[#0F111A] px-2 py-1 rounded font-mono text-gray-400 border border-gray-700/50">{selectedDevice.deviceId}</code>
                  </div>
                  {selectedDevice.location && selectedDevice.location !== 'Unknown' && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                      <span className="text-[9px] text-gray-500">Location</span>
                      <span className="text-[9px] font-medium text-gray-300 flex items-center gap-1">
                        <MdLocationOn className="text-amber-400" /> {selectedDevice.location}
                      </span>
                    </div>
                  )}
                  {selectedDevice.ipAddress && selectedDevice.ipAddress !== 'N/A' && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                      <span className="text-[9px] text-gray-500">IP Address</span>
                      <span className="text-[9px] font-medium text-gray-300 font-mono">{selectedDevice.ipAddress}</span>
                    </div>
                  )}
                  {selectedDevice.battery && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                      <span className="text-[9px] text-gray-500">Battery</span>
                      <span className="text-[9px] font-medium text-gray-300 flex items-center gap-1.5">
                        {getBatteryIcon(selectedDevice.battery)} {selectedDevice.battery}%
                      </span>
                    </div>
                  )}
                  {selectedDevice.signal && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                      <span className="text-[9px] text-gray-500">Signal</span>
                      <span className="text-[9px] font-medium text-gray-300 flex items-center gap-1.5">
                        {getSignalIcon(selectedDevice.signal)} {selectedDevice.signal}%
                      </span>
                    </div>
                  )}
                  {selectedDevice.cpu && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                      <span className="text-[9px] text-gray-500">CPU Usage</span>
                      <span className="text-[9px] font-medium text-gray-300 flex items-center gap-1.5">
                        <GiProcessor className="text-amber-400" /> {selectedDevice.cpu}%
                      </span>
                    </div>
                  )}
                  {selectedDevice.memory && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0F111A] border border-gray-800/50">
                      <span className="text-[9px] text-gray-500">Memory Usage</span>
                      <span className="text-[9px] font-medium text-gray-300 flex items-center gap-1.5">
                        <MdMemory className="text-amber-400" /> {selectedDevice.memory}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-800">
                <button
                  onClick={() => setShowDeviceDetails(false)}
                  className="w-full bg-[#0F111A] border border-gray-700 text-gray-300 py-2.5 rounded-xl text-xs font-bold hover:border-gray-500 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Modal */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-md p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-800 flex justify-between items-center bg-[#1C2128] sticky top-0 z-10 rounded-t-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
                <MdHistory /> Activity Log
              </h3>
              <button onClick={() => setShowActivityLog(false)} className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-gray-800 transition-all">
                <CloseIcon />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {activityLog.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 rounded-2xl bg-gray-800/20 border border-gray-700/50 inline-block mb-4">
                      <MdHistory className="text-gray-700 text-4xl" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">No activity yet</p>
                    <p className="text-[9px] text-gray-600 mt-1">Activity will appear here as events occur</p>
                  </div>
                ) : (
                  activityLog.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-[#0F111A] rounded-xl transition-all border border-gray-800/50 hover:border-gray-700">
                      <div className="text-lg mt-0.5">{log.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300">{log.message}</p>
                        <p className="text-[8px] text-gray-500 mt-1 flex items-center gap-2">
                          <FaRegClock className="text-[8px]" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          {' • '}
                          {new Date(log.timestamp).toLocaleDateString()}
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="mt-1 text-[8px] text-gray-600 flex flex-wrap gap-1">
                            {Object.entries(log.details).map(([key, value]) => (
                              <span key={key} className="px-1.5 py-0.5 bg-[#0F111A] rounded border border-gray-800">
                                {key}: <span className="text-gray-400">{String(value)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {activityLog.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-800 flex justify-between items-center">
                  <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">
                    {activityLog.length} log entries
                  </span>
                  <button
                    onClick={() => setActivityLog([])}
                    className="text-[8px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/40 transition-all bg-rose-500/5"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DeviceMonitoring;