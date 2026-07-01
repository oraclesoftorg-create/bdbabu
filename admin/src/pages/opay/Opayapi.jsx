import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaKey, FaCopy, FaCheck, FaSync, FaDownload, 
  FaToggleOn, FaToggleOff, FaCheckCircle, 
  FaTimesCircle, FaCalendarAlt, FaGlobe, 
  FaUsers, FaMobileAlt, FaHistory, FaPlug,
  FaSave, FaEdit, FaTrash, FaUndo, FaExclamationTriangle,
  FaShieldAlt, FaLock, FaUnlock, FaServer, FaClock
} from 'react-icons/fa';
import { FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import { MdTimer, MdDomain } from 'react-icons/md';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const Opayapi = () => {
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [validationHistory, setValidationHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [runningUpdating, setRunningUpdating] = useState(false);
  
  // API Key states
  const [currentApiKey, setCurrentApiKey] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  
  // Domain states
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [domainMismatch, setDomainMismatch] = useState(false);
  
  // Device states
  const [deviceStatus, setDeviceStatus] = useState({
    online: false,
    count: 0,
    lastCheck: null
  });
  
  const [subscriptionData, setSubscriptionData] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isValid: false,
    plan: "No Plan",
    primaryDomain: "",
    domains: [],
    activeCount: 0,
    deviceCount: 0,
    endDate: "N/A",
    latestEndDate: "N/A",
    expireDate: "No subscription",
    subscriptionId: "",
    packageName: "",
    maxDevices: 0,
    maxNumbers: 0
  });

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSettings = useCallback(async (useCached = false) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${base_url}/api/opay/settings?cached=${useCached}`);
      if (response.data) {
        const { apiKey, validation, running, updatedAt } = response.data;
        
        if (apiKey) {
          setCurrentApiKey(apiKey);
          setOriginalApiKey(apiKey);
          setNewApiKey('');
          setIsUpdating(false);
          setHasChanges(false);
        }
        
        if (validation) {
          updateSubscriptionData(validation);
          
          // Check domain mismatch
          if (validation.reason === 'DOMAIN_MISMATCH') {
            setDomainMismatch(true);
            setValidationError('Domain mismatch: Your domain is not whitelisted');
          } else {
            setDomainMismatch(false);
            if (validation.valid) {
              setValidationError(null);
            }
          }
          
          // Update allowed domains
          if (validation.domains) {
            setAllowedDomains(validation.domains);
          }
          if (validation.primaryDomain) {
            setPrimaryDomain(validation.primaryDomain);
          }
          
          // Update device status
          if (validation.deviceCount !== undefined) {
            setDeviceStatus(prev => ({
              ...prev,
              count: validation.deviceCount,
              lastCheck: new Date()
            }));
          }
        } else {
          resetSubscriptionData();
        }
        
        if (running !== undefined) setRunning(running);
        if (updatedAt) setLastUpdated(new Date(updatedAt).toLocaleString());
        
        if (validation && updatedAt) {
          setValidationHistory(prev => [
            {
              timestamp: new Date(updatedAt).toLocaleString(),
              valid: validation.valid || false,
              reason: validation.reason || (validation.valid ? 'Valid' : 'Invalid'),
              deviceCount: validation.deviceCount || 0,
              activeNumberCount: validation.activeNumberCount || 0,
              domainMatch: !domainMismatch
            },
            ...prev.slice(0, 4)
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [base_url, domainMismatch]);

  const resetSubscriptionData = () => {
    setSubscriptionData({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isValid: false,
      plan: "No Plan",
      primaryDomain: "",
      domains: [],
      activeCount: 0,
      deviceCount: 0,
      endDate: "N/A",
      latestEndDate: "N/A",
      expireDate: "No subscription",
      subscriptionId: "",
      packageName: "",
      maxDevices: 0,
      maxNumbers: 0
    });
  };

  const calculateTimeUntilExpiration = useCallback((endDate) => {
    if (!endDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end - now;
    
    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds };
  }, []);

  const updateSubscriptionData = useCallback((validation) => {
    if (!validation) {
      resetSubscriptionData();
      return;
    }
    
    const timeUntilExpiry = calculateTimeUntilExpiration(validation.endDate);
    
    setSubscriptionData({
      days: timeUntilExpiry.days,
      hours: timeUntilExpiry.hours,
      minutes: timeUntilExpiry.minutes,
      seconds: timeUntilExpiry.seconds,
      isValid: validation.valid || false,
      plan: validation.plan?.name || validation.packageName || 'Standard Plan',
      primaryDomain: validation.primaryDomain || validation.primary_domain || 'No domain',
      domains: validation.domains || [],
      activeCount: validation.activeNumberCount || validation.active_numbers || 0,
      deviceCount: validation.deviceCount || validation.device_count || 0,
      endDate: formatDate(validation.endDate || validation.end_date),
      latestEndDate: formatDate(validation.latestEndDate || validation.latest_end_date),
      expireDate: formatTimeDifference(validation.endDate || validation.end_date),
      subscriptionId: validation.subscriptionId || validation.subscription_id || '',
      packageName: validation.packageName || validation.package_name || '',
      maxDevices: validation.maxDevices || validation.max_devices || 0,
      maxNumbers: validation.maxNumbers || validation.max_numbers || 0
    });
  }, [calculateTimeUntilExpiration]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatTimeDifference = (dateString) => {
    if (!dateString) return 'No expiration date';
    try {
      const end = new Date(dateString);
      const now = new Date();
      const diffMs = end - now;
      
      if (diffMs <= 0) return 'Expired';
      
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      return `${diffDays} days`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  const validateApiKey = useCallback(async (keyToValidate, showToast = true) => {
    if (!keyToValidate) {
      toast.error('API Key is required');
      return false;
    }

    setIsValidating(true);
    setValidationError(null);
    setDomainMismatch(false);

    try {
      const response = await axios.post(`${base_url}/api/opay/validate`, { apiKey: keyToValidate });
      
      if (response.data) {
        const isValid = response.data.valid === true;
        
        updateSubscriptionData(response.data);
        
        // Check for domain mismatch
        if (response.data.reason === 'DOMAIN_MISMATCH') {
          setDomainMismatch(true);
          setValidationError('Domain mismatch: Your domain is not whitelisted for this API key');
        } else if (isValid) {
          setValidationError(null);
        } else {
          setValidationError(response.data.message || 'Validation failed');
        }
        
        // Update domains
        if (response.data.domains) {
          setAllowedDomains(response.data.domains);
        }
        if (response.data.primaryDomain) {
          setPrimaryDomain(response.data.primaryDomain);
        }
        
        // Update device status
        if (response.data.deviceCount !== undefined) {
          setDeviceStatus(prev => ({
            ...prev,
            count: response.data.deviceCount,
            lastCheck: new Date(),
            online: response.data.deviceOnline || false
          }));
        }
        
        setValidationHistory(prev => [
          {
            timestamp: new Date().toLocaleString(),
            valid: isValid,
            reason: response.data.reason || (isValid ? 'Valid' : 'Invalid'),
            deviceCount: response.data.deviceCount || 0,
            activeNumberCount: response.data.activeNumberCount || 0,
            domainMatch: response.data.reason !== 'DOMAIN_MISMATCH'
          },
          ...prev.slice(0, 4)
        ]);

        if (isValid && response.data.reason !== 'DOMAIN_MISMATCH') {
          if (showToast) {
            toast.success('API Key validated successfully');
          }
          return true;
        } else {
          const errorMsg = response.data.message || 'Validation failed';
          if (showToast) {
            toast.error(errorMsg);
          }
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Validation error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Validation failed';
      setValidationError(errorMessage);
      
      setValidationHistory(prev => [
        {
          timestamp: new Date().toLocaleString(),
          valid: false,
          reason: 'Failed',
          deviceCount: 0,
          activeNumberCount: 0,
          error: errorMessage
        },
        ...prev.slice(0, 4)
      ]);
      
      if (showToast) {
        toast.error(errorMessage);
      }
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [base_url, updateSubscriptionData]);

  const toggleRunning = async () => {
    setRunningUpdating(true);
    try {
      const newState = !running;
      const response = await axios.patch(`${base_url}/api/opay/running`, { running: newState });
      
      if (response.data.success) {
        setRunning(newState);
        toast.success(`Integration ${newState ? 'activated' : 'deactivated'}`);
      } else {
        throw new Error(response.data.message || 'Failed to update running state');
      }
    } catch (error) {
      console.error('Failed to toggle running state:', error);
      toast.error('Failed to update running state');
    } finally {
      setRunningUpdating(false);
    }
  };

  const handleUpdateClick = () => {
    setIsUpdating(true);
    setNewApiKey('');
    setValidationError(null);
    setDomainMismatch(false);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setNewApiKey('');
    setValidationError(null);
    setHasChanges(false);
    setDomainMismatch(false);
  };

  const handleNewKeyChange = (e) => {
    setNewApiKey(e.target.value);
    setHasChanges(true);
    if (validationError) setValidationError(null);
    if (domainMismatch) setDomainMismatch(false);
  };

  const handleSaveNewKey = async () => {
    if (!newApiKey) {
      toast.error('Please enter a new API key');
      return;
    }

    const isValid = await validateApiKey(newApiKey, true);
    
    if (isValid) {
      setCurrentApiKey(newApiKey);
      setOriginalApiKey(newApiKey);
      setIsUpdating(false);
      setNewApiKey('');
      setHasChanges(false);
      toast.success('API Key updated successfully');
      await loadSettings(false);
    }
  };

  const handleValidateCurrentClick = () => {
    validateApiKey(currentApiKey, true);
  };

  const handleRefreshSettings = async () => {
    try {
      setIsLoading(true);
      await loadSettings(false);
    } catch (error) {
      console.error('Failed to refresh settings:', error);
      toast.error('Failed to refresh settings');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKeyVisibility = () => {
    setIsKeyVisible(!isKeyVisible);
  };

  useEffect(() => {
    loadSettings(true);
    
    const interval = setInterval(() => {
      if (currentApiKey && subscriptionData.isValid) {
        loadSettings(false);
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [loadSettings, currentApiKey, subscriptionData.isValid]);

  useEffect(() => {
    if (!subscriptionData.isValid) return;
    
    const timer = setInterval(() => {
      setSubscriptionData(prev => {
        let { seconds, minutes, hours, days } = prev;
        
        if (seconds > 0) {
          seconds -= 1;
        } else {
          if (minutes > 0) {
            seconds = 59;
            minutes -= 1;
          } else {
            if (hours > 0) {
              minutes = 59;
              seconds = 59;
              hours -= 1;
            } else {
              if (days > 0) {
                hours = 23;
                minutes = 59;
                seconds = 59;
                days -= 1;
              } else {
                clearInterval(timer);
                return { ...prev, days: 0, hours: 0, minutes: 0, seconds: 0 };
              }
            }
          }
        }
        
        return { ...prev, days, hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [subscriptionData.isValid]);

  const getStatusColor = () => {
    if (isValidating) return 'border-amber-500 bg-amber-500/10';
    if (domainMismatch) return 'border-rose-500 bg-rose-500/10';
    if (subscriptionData.isValid) return 'border-emerald-500 bg-emerald-500/10';
    if (validationError) return 'border-rose-500 bg-rose-500/10';
    return 'border-gray-700 bg-[#0F111A]';
  };

  const getStatusText = () => {
    if (isValidating) return 'Validating...';
    if (domainMismatch) return 'Domain Mismatch';
    if (subscriptionData.isValid) return 'Valid';
    if (validationError) return 'Invalid';
    return 'Not Validated';
  };

  const getStatusIcon = () => {
    if (isValidating) return <FaSync className="animate-spin text-amber-400" />;
    if (domainMismatch) return <FaExclamationTriangle className="text-rose-400" />;
    if (subscriptionData.isValid) return <FaCheckCircle className="text-emerald-400" />;
    return <FaTimesCircle className="text-rose-400" />;
  };

  const maskApiKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return key;
    if (isKeyVisible) return key;
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  const inputClass = 'w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500 placeholder-gray-600';
  const selectClass = 'w-full bg-[#0F111A] border border-gray-700 text-gray-200 text-xs rounded px-3 py-2 focus:outline-none focus:border-amber-500';

  return (
    <section className="min-h-screen bg-[#0F111A] text-gray-200 font-poppins">
      <Header toggleSidebar={toggleSidebar} />
      <Toaster position="top-right" toastOptions={{ style: { background: '#161B22', color: '#e5e7eb', border: '1px solid #374151' } }} />
      <div className="flex pt-[10vh]">
        <Sidebar isOpen={isSidebarOpen} />
        <main className={`transition-all duration-300 flex-1 p-6 overflow-y-auto h-[90vh] ${isSidebarOpen ? 'md:ml-[40%] lg:ml-[28%] xl:ml-[17%]' : 'ml-0'}`}>
          {/* Page Header */}
          <div className="rounded-lg mb-8 flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tighter uppercase">Opay API Management</h1>
              <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-2">
                <FaShieldAlt className="text-amber-500" /> Secure API Key Management & Validation
                {lastUpdated && (
                  <span className="text-gray-600">• Last updated: {lastUpdated}</span>
                )}
              </p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button
                onClick={toggleRunning}
                disabled={runningUpdating || !subscriptionData.isValid || domainMismatch}
                className={`px-5 py-2 rounded font-bold text-xs transition-all flex items-center gap-2 ${
                  running
                    ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30'
                    : 'bg-[#1F2937] border border-gray-700 text-gray-400 hover:border-amber-500/40 hover:text-amber-400'
                } ${(runningUpdating || !subscriptionData.isValid || domainMismatch) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!subscriptionData.isValid ? 'Valid API key required' : domainMismatch ? 'Domain mismatch - fix domain whitelist' : ''}
              >
                {running ? <FaToggleOn className="text-emerald-400" /> : <FaToggleOff />}
                {running ? 'ACTIVE' : 'INACTIVE'}
              </button>
              <button
                onClick={handleRefreshSettings}
                disabled={isLoading}
                className="bg-[#1F2937] hover:bg-amber-600/30 border border-gray-700 hover:border-amber-500/40 px-6 py-2 rounded font-bold text-xs transition-all flex items-center gap-2 text-amber-400"
              >
                <FiRefreshCw className={isLoading ? 'animate-spin' : ''} /> REFRESH
              </button>
            </div>
          </div>

          {/* Current API Key Section */}
          <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 mb-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mr-3">
                  <FaKey className="text-xl text-amber-400" />
                </div>
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current API Key</h2>
                  <p className="text-xs text-gray-500">Your active Opay API key</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {!isUpdating && (
                  <button
                    onClick={handleUpdateClick}
                    className="bg-amber-500/10 hover:bg-amber-600/30 border border-amber-500/20 text-amber-400 px-5 py-2 rounded font-bold text-xs transition-all flex items-center gap-2"
                  >
                    <FaEdit /> UPDATE KEY
                  </button>
                )}
                <button
                  onClick={handleValidateCurrentClick}
                  disabled={isValidating || !currentApiKey}
                  className={`px-5 py-2 rounded font-bold text-xs transition-all flex items-center gap-2 ${
                    isValidating
                      ? 'bg-amber-500/20 text-amber-400 cursor-wait'
                      : subscriptionData.isValid && !domainMismatch
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-600/30'
                  } ${!currentApiKey ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isValidating ? (
                    <>
                      <FaSync className="animate-spin" />
                      VALIDATING...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle />
                      REVALIDATE
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
                  Current API Key
                </label>
                <div className="flex">
                  <div className="flex-1 border border-gray-700 rounded-l-lg px-4 py-3 bg-[#0F111A] font-mono text-gray-300 text-sm">
                    {maskApiKey(currentApiKey) || 'No API key configured'}
                  </div>
                  <button
                    onClick={toggleKeyVisibility}
                    disabled={!currentApiKey}
                    className="bg-[#1C2128] hover:bg-gray-700 text-gray-400 px-3 py-3 border border-l-0 border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isKeyVisible ? 'Hide key' : 'Show key'}
                  >
                    {isKeyVisible ? <FaLock /> : <FaUnlock />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(currentApiKey)}
                    disabled={!currentApiKey}
                    className="bg-[#1C2128] hover:bg-gray-700 text-gray-400 px-4 py-3 rounded-r-lg border border-l-0 border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy full API key"
                  >
                    {copied ? <FaCheck className="text-emerald-400" /> : <FaCopy />}
                  </button>
                </div>
                {currentApiKey && (
                  <p className="mt-2 text-[10px] text-gray-600">
                    Full key: {currentApiKey.substring(0, 8)}...{currentApiKey.substring(currentApiKey.length - 4)}
                  </p>
                )}
              </div>
              
              {/* Status Display */}
              <div className={`flex items-center justify-between p-4 rounded-lg border ${getStatusColor()}`}>
                <div className="flex items-center">
                  {getStatusIcon()}
                  <span className="ml-2 text-xs font-bold uppercase tracking-wider">{getStatusText()}</span>
                  {domainMismatch && (
                    <span className="ml-2 text-[9px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      Fix domain whitelist
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400">
                  {domainMismatch ? 'Domain not whitelisted for this API key' : 
                   validationError || (subscriptionData.isValid ? '✓ Ready for use' : 'Validate API key to check status')}
                </div>
              </div>

              {/* Domain Info */}
              {allowedDomains.length > 0 && (
                <div className="p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <MdDomain className="text-amber-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Allowed Domains</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedDomains.map((domain, index) => (
                      <span 
                        key={index} 
                        className={`px-2 py-1 rounded text-[9px] font-mono ${
                          domain === primaryDomain 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-gray-700/30 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {domain} {domain === primaryDomain && '(Primary)'}
                      </span>
                    ))}
                  </div>
                  {primaryDomain && (
                    <p className="mt-2 text-[9px] text-gray-500">
                      Primary domain: <span className="text-amber-400">{primaryDomain}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Update API Key Section */}
          {isUpdating && (
            <div className="bg-[#161B22] border border-amber-500/30 rounded-lg p-6 mb-6 shadow-lg animate-pulse-once">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                <div className="flex items-center mb-4 md:mb-0">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mr-3">
                    <FaEdit className="text-xl text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-amber-400">Update API Key</h2>
                    <p className="text-xs text-gray-500">Enter a new Opay API key</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCancelUpdate}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2 rounded font-bold text-xs transition-all flex items-center gap-2"
                  >
                    <FaUndo /> CANCEL
                  </button>
                  <button
                    onClick={handleSaveNewKey}
                    disabled={isValidating || !newApiKey}
                    className={`px-5 py-2 rounded font-bold text-xs transition-all flex items-center gap-2 ${
                      isValidating
                        ? 'bg-amber-500/20 text-amber-400 cursor-wait'
                        : 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30'
                    } ${!newApiKey ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isValidating ? (
                      <>
                        <FaSync className="animate-spin" />
                        VALIDATING...
                      </>
                    ) : (
                      <>
                        <FaSave />
                        SAVE NEW KEY
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">
                    New API Key <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type={isKeyVisible ? "text" : "password"}
                    value={newApiKey}
                    onChange={handleNewKeyChange}
                    placeholder="Enter your new Opay API Key"
                    className={inputClass}
                    autoFocus
                  />
                  {hasChanges && (
                    <p className="mt-2 text-[10px] text-amber-400 flex items-center gap-1">
                      <FaExclamationTriangle className="text-amber-400" />
                      Click "Save New Key" to validate and save this API key
                    </p>
                  )}
                </div>
                
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <p className="text-[10px] text-amber-400 flex items-center gap-2">
                    <FaEdit className="text-amber-400" />
                    <span className="uppercase font-bold">
                      Important: Updating the API key will immediately switch to the new key. 
                      Make sure the new key is valid and has the correct domain whitelist.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {subscriptionData.isValid && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <FaMobileAlt className="text-xl text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Devices</p>
                      <p className="text-2xl font-bold text-white mt-1">{subscriptionData.deviceCount}</p>
                      {subscriptionData.maxDevices > 0 && (
                        <p className="text-[9px] text-gray-500">Max: {subscriptionData.maxDevices}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <FaUsers className="text-xl text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Active Numbers</p>
                      <p className="text-2xl font-bold text-white mt-1">{subscriptionData.activeCount}</p>
                      {subscriptionData.maxNumbers > 0 && (
                        <p className="text-[9px] text-gray-500">Max: {subscriptionData.maxNumbers}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <FaGlobe className="text-xl text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Domains</p>
                      <p className="text-2xl font-bold text-white mt-1">{subscriptionData.domains.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <FaClock className="text-xl text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Status</p>
                      <p className={`text-sm font-bold mt-1 ${
                        running ? 'text-emerald-400' : 'text-gray-400'
                      }`}>
                        {running ? 'Running' : 'Stopped'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-1 h-4 bg-amber-500"></div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subscription Details</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Plan</span>
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[9px] font-bold uppercase border border-amber-500/20">
                        {subscriptionData.plan}
                      </span>
                    </div>
                    
                    {subscriptionData.packageName && (
                      <div className="flex items-center justify-between p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Package</span>
                        <span className="text-xs text-gray-300">{subscriptionData.packageName}</span>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Primary Domain</label>
                      <p className="text-xs text-gray-300 bg-[#0F111A] p-2 rounded border border-gray-800">{subscriptionData.primaryDomain || 'No domain set'}</p>
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">All Domains ({subscriptionData.domains.length})</label>
                      <div className="space-y-1 bg-[#0F111A] p-2 rounded border border-gray-800 max-h-32 overflow-y-auto">
                        {subscriptionData.domains.length > 0 ? (
                          subscriptionData.domains.map((domain, index) => (
                            <div key={index} className="flex items-center text-xs text-gray-400">
                              <FiChevronRight className="text-amber-500 mr-1 text-[9px]" />
                              {domain}
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-gray-600 italic">No domains registered</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-1 h-4 bg-amber-500"></div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subscription Timeline</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Subscription ID</label>
                      <div className="flex items-center">
                        <code className="flex-1 bg-[#0F111A] px-3 py-2 rounded-lg text-gray-300 font-mono text-[10px] border border-gray-800 truncate">
                          {subscriptionData.subscriptionId || 'No subscription ID'}
                        </code>
                        <button
                          onClick={() => copyToClipboard(subscriptionData.subscriptionId)}
                          disabled={!subscriptionData.subscriptionId}
                          className="ml-2 p-2 text-gray-500 hover:text-amber-400 disabled:opacity-50 transition-colors"
                          title="Copy to clipboard"
                        >
                          <FaCopy />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                        <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">End Date</label>
                        <p className="text-xs text-gray-300 font-medium">{subscriptionData.endDate}</p>
                      </div>
                      
                      <div className="p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                        <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Latest End Date</label>
                        <p className="text-xs text-gray-300 font-medium">{subscriptionData.latestEndDate}</p>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-lg border ${
                      subscriptionData.expireDate.includes('Expired') 
                        ? 'bg-rose-500/10 border-rose-500/20' 
                        : subscriptionData.expireDate === 'No expiration date'
                        ? 'bg-gray-800/30 border-gray-700'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Expires In</p>
                          <p className={`text-sm font-bold mt-1 ${
                            subscriptionData.expireDate.includes('Expired') ? 'text-rose-400' : 
                            subscriptionData.expireDate === 'No expiration date' ? 'text-gray-400' : 'text-emerald-400'
                          }`}>
                            {subscriptionData.expireDate}
                          </p>
                        </div>
                        <MdTimer className="text-2xl text-gray-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Countdown Timer */}
              {subscriptionData.days > 0 && (
                <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 mb-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <FaCalendarAlt className="text-xl text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400">Subscription Countdown</h3>
                      <p className="text-[9px] text-gray-500">Time remaining until expiration</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                      <div className="text-2xl font-bold text-amber-400 mb-1">{subscriptionData.days}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Days</div>
                    </div>
                    
                    <div className="text-center p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                      <div className="text-2xl font-bold text-amber-400 mb-1">{subscriptionData.hours}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Hours</div>
                    </div>
                    
                    <div className="text-center p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                      <div className="text-2xl font-bold text-amber-400 mb-1">{subscriptionData.minutes}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Minutes</div>
                    </div>
                    
                    <div className="text-center p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                      <div className="text-2xl font-bold text-amber-400 mb-1">{subscriptionData.seconds}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Seconds</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* History & Webhooks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-gray-700/30 border border-gray-700">
                  <FaHistory className="text-xl text-gray-400" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Validation History</h3>
                  <p className="text-[9px] text-gray-500">Recent validation attempts</p>
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {validationHistory.length > 0 ? (
                  validationHistory.map((entry, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${
                        entry.valid && entry.domainMatch !== false
                          ? 'border-emerald-500/20 bg-emerald-500/5' 
                          : 'border-rose-500/20 bg-rose-500/5'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          entry.valid && entry.domainMatch !== false
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : entry.domainMatch === false
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {entry.valid && entry.domainMatch !== false ? 'Valid' : 
                           entry.domainMatch === false ? 'Domain Mismatch' : 'Invalid'}
                        </span>
                        <span className="text-[9px] text-gray-500">{entry.timestamp}</span>
                      </div>
                      <div className="mt-2 text-[9px] text-gray-500">
                        Devices: {entry.deviceCount} • Numbers: {entry.activeNumberCount}
                        {entry.error && (
                          <div className="mt-1 text-rose-400 truncate" title={entry.error}>
                            {entry.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <FaHistory className="text-gray-700 text-3xl mx-auto mb-2" />
                    <p className="text-[10px] text-gray-600">No validation history</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <FaServer className="text-xl text-purple-400" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Webhook Configuration</h3>
                  <p className="text-[9px] text-gray-500">Callback URLs and settings</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">OraclePay Callback URL</label>
                  <div className="flex items-center">
                    <code className="flex-1 bg-[#0F111A] px-3 py-2 rounded-lg text-[9px] text-gray-400 font-mono break-all border border-gray-800">
                      {base_url}/api/opay/oraclepay-callback
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${base_url}/api/opay/oraclepay-callback`)}
                      className="ml-2 p-2 text-gray-500 hover:text-amber-400 transition-colors"
                      title="Copy to clipboard"
                    >
                      <FaCopy />
                    </button>
                  </div>
                  <p className="mt-1 text-[9px] text-gray-600">
                    Configure this URL in your OraclePay dashboard for deposit notifications
                  </p>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#0F111A] rounded-lg border border-gray-800">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Integration Status</p>
                    <p className="text-[9px] text-gray-600">Current running state</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
                    running 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'
                  }`}>
                    {running ? 'Running' : 'Stopped'}
                  </span>
                </div>

                {subscriptionData.isValid && !domainMismatch && (
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <p className="text-[9px] text-emerald-400 font-bold uppercase flex items-center gap-2">
                      <FaCheckCircle /> API Key Valid - Integration ready to process payments
                    </p>
                  </div>
                )}

                {domainMismatch && (
                  <div className="p-3 bg-rose-500/5 rounded-lg border border-rose-500/20">
                    <p className="text-[9px] text-rose-400 font-bold uppercase flex items-center gap-2">
                      <FaExclamationTriangle /> Domain Mismatch - Please whitelist your domain in OraclePay
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <p className="text-center text-[9px] text-gray-600 uppercase tracking-wider">
              Securely validated via Opay API • 
              <a 
                href="https://api.oraclepay.org/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 text-amber-400 hover:text-amber-300 hover:underline"
              >
                View Documentation
              </a>
            </p>
          </div>
        </main>
      </div>
    </section>
  );
};

export default Opayapi;