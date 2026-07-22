import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import Sidebar from "../../components/sidebar/Sidebar";
import { Header } from "../../components/header/Header";
import { Slider } from "../../components/home_componets/Slider";
import Footer from "../../components/footer/Footer";
import { AiOutlineSound } from "react-icons/ai";
import Category from "../../components/home_componets/category/Categroy";
import ProviderSlider from "../../components/home_componets/provider/ProviderSlider";
import Event from "../../components/home_componets/event/Event";
import Featured from "../../components/home_componets/featured/Featured";
import logo from "../../assets/logo.png";
import axios from 'axios';
import { Mobileslider } from "../../components/home_componets/Mobileslider";
import Sports from "../../components/home_componets/sports/Sports";
import WelcomeBonusPopup from "./WelcomeBonusPopup";
import { FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

let userCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    if (userCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setUser(userCache);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${base_url}/api/user/my-information`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        userCache = data.data;
        cacheTimestamp = Date.now();
        setUser(data.data);
      } else {
        localStorage.removeItem('token');
        userCache = null;
        cacheTimestamp = null;
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      userCache = null;
      cacheTimestamp = null;
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    userCache = userData;
    cacheTimestamp = Date.now();
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, checkAuthStatus, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMOTIONAL POPUP COMPONENT (with device detection)
// ─────────────────────────────────────────────────────────────────────────────
const PromotionalPopup = () => {
  const [popups, setPopups] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [deviceType, setDeviceType] = useState('both');
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const autoPlayTimer = useRef(null);

  // Detect device type
  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      
      // Check if it's a mobile device
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
      
      // Check screen width as additional check
      const isMobileScreen = window.innerWidth <= 768;
      
      // Determine device type
      if (isMobile || isMobileScreen) {
        setDeviceType('mobile');
        console.log('Device detected: Mobile');
      } else {
        setDeviceType('computer');
        console.log('Device detected: Computer');
      }
    };

    detectDevice();
    
    // Add resize listener to detect orientation changes
    const handleResize = () => {
      const isMobileScreen = window.innerWidth <= 768;
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
      
      const newDeviceType = (isMobile || isMobileScreen) ? 'mobile' : 'computer';
      if (newDeviceType !== deviceType) {
        setDeviceType(newDeviceType);
        console.log('Device type changed to:', newDeviceType);
        // Refetch popups when device type changes
        fetchPopups(newDeviceType);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch popups based on device type
  const fetchPopups = async (device) => {
    try {
      setLoading(true);

      // Check if user chose to hide the popup within the last 3 days
      const hideUntil = localStorage.getItem('promo_popup_hide_until');
      if (hideUntil && Date.now() < parseInt(hideUntil, 10)) {
        console.log('Popup is currently hidden by user choice (3-day cooldown)');
        setLoading(false);
        return;
      }

      // Build URL with device filter
      let url = `${base_url}/api/promotional-popups`;
      if (device && device !== 'both') {
        url += `?device=${device}`;
      }
      
      console.log(`Fetching popups for device: ${device || 'all'} from:`, url);
      const response = await axios.get(url);
      
      if (response.data && response.data.success) {
        const popupData = response.data.data || [];
        console.log(`Found ${popupData.length} popups for ${device || 'all'} device`);
        
        if (popupData.length > 0) {
          setPopups(popupData);
          setIsVisible(true);
        } else {
          // If no popups for specific device, try fetching all
          if (device && device !== 'both') {
            console.log('No popups for specific device, trying both...');
            const fallbackResponse = await axios.get(`${base_url}/api/promotional-popups?device=both`);
            if (fallbackResponse.data && fallbackResponse.data.success) {
              const fallbackData = fallbackResponse.data.data || [];
              if (fallbackData.length > 0) {
                setPopups(fallbackData);
                setIsVisible(true);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching promotional popups:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch popups when device type is determined
  useEffect(() => {
    if (deviceType) {
      fetchPopups(deviceType);
    }
  }, [deviceType]);

  // Auto-play slideshow
  useEffect(() => {
    if (isVisible && popups.length > 1) {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
      }
      autoPlayTimer.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % popups.length);
      }, 5000);
    }

    return () => {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
      }
    };
  }, [isVisible, popups.length]);

  // Close popup and save 3 days visibility blackout timestamp
  const closePopup = () => {
    console.log('Closing popup and hiding for 3 days');
    
    // 3 days calculation: 3 days * 24 hours * 60 mins * 60 secs * 1000 ms
    const threeDaysFromNow = Date.now() + (3 * 24 * 60 * 60 * 1000);
    localStorage.setItem('promo_popup_hide_until', threeDaysFromNow.toString());

    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
      }
    }, 300);
  };

  // Navigate to previous slide
  const goToPrevious = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + popups.length) % popups.length);
    resetAutoPlay();
  };

  // Navigate to next slide
  const goToNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % popups.length);
    resetAutoPlay();
  };

  // Go to specific slide
  const goToSlide = (index) => {
    setCurrentIndex(index);
    resetAutoPlay();
  };

  // Reset auto-play timer
  const resetAutoPlay = () => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current);
    }
    if (popups.length > 1) {
      autoPlayTimer.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % popups.length);
      }, 5000);
    }
  };

  // Handle image click - open link if available
  const handleImageClick = () => {
    const currentPopup = popups[currentIndex];
    if (currentPopup && currentPopup.link) {
      window.open(currentPopup.link, '_blank');
    }
  };

  if (loading || !isVisible || popups.length === 0) {
    return null;
  }

  const currentPopup = popups[currentIndex];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={closePopup}
    >
      <div 
        className={`relative bg-[#120824] border border-purple-900/30 rounded-2xl p-3 md:p-5 pb-8 md:pb-10 shadow-[0_4px_24px_rgba(112,26,231,0.25)] max-w-[360px] md:max-w-3xl w-full transition-transform duration-300 ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closePopup}
          className="absolute top-2.5 right-2.5 z-20 p-1.5 bg-[#2a154d]/90 hover:bg-[#3d1f6e] rounded-full text-purple-200 transition-all duration-200 hover:scale-110 shadow-md"
        >
          <FaTimes className="text-sm md:text-base" />
        </button>

        {/* Device Type Indicator */}
        <div className="absolute top-2.5 left-2.5 z-20">
          <span className={`px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider ${
            deviceType === 'mobile' 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
          }`}>
            {deviceType === 'mobile' ? '📱 Mobile' : '💻 Desktop'}
          </span>
        </div>

        {/* Dynamic Aspect Ratio Wrapper */}
        <div className="relative rounded-xl overflow-hidden bg-[#0d051c] flex justify-center items-center w-full">
          <img
            src={currentPopup.image.startsWith('http') ? currentPopup.image : `${base_url}${currentPopup.image}`}
            alt={`Promotional ${currentIndex + 1}`}
            className="w-full h-auto max-h-[65vh] md:max-h-[55vh] object-contain md:object-fill rounded-lg"
            onClick={handleImageClick}
            onError={(e) => {
              console.error('Image failed to load:', currentPopup.image);
              e.target.src = 'https://via.placeholder.com/800x400?text=Image+Not+Found';
            }}
          />

          {/* Navigation Arrows */}
          {popups.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[#251347]/90 hover:bg-[#381c6b] rounded-full text-purple-300 transition-all duration-200 shadow-md border border-purple-800/20"
              >
                <FaChevronLeft className="text-xs md:text-sm" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-[#251347]/90 hover:bg-[#381c6b] rounded-full text-purple-300 transition-all duration-200 shadow-md border border-purple-800/20"
              >
                <FaChevronRight className="text-xs md:text-sm" />
              </button>
            </>
          )}
        </div>

        {/* Slide Indicators */}
        {popups.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {popups.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-purple-400 w-4 shadow-[0_0_6px_#a78bfa]'
                    : 'bg-purple-900/60 w-1.5 hover:bg-purple-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Link indicator */}
        {currentPopup.link && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 bg-purple-950/80 border border-purple-800/30 px-3 py-0.5 rounded-full text-purple-300 text-[9px] md:text-xs whitespace-nowrap tracking-wide">
            Click image to visit link
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HOME CONTENT
// ─────────────────────────────────────────────────────────────────────────────
const HomeContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicLogo, setDynamicLogo] = useState(logo);
  const [notice, setNotice] = useState("");
  const [brandingCache, setBrandingCache] = useState(null);

  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;

  useEffect(() => {
    const shouldShow = localStorage.getItem('show_welcome_bonus');
    if (shouldShow === 'true') {
      const t = setTimeout(() => {
        setShowWelcomePopup(true);
        localStorage.removeItem('show_welcome_bonus');
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  const fetchBrandingData = async () => {
    if (brandingCache) {
      setDynamicLogo(brandingCache);
      return;
    }

    const cachedBranding = localStorage.getItem('branding_logo');
    const cacheTime = localStorage.getItem('branding_cache_time');

    if (cachedBranding && cacheTime && Date.now() - parseInt(cacheTime) < 30 * 60 * 1000) {
      setDynamicLogo(cachedBranding);
      setBrandingCache(cachedBranding);
      return;
    }

    try {
      const response = await axios.get(`${base_url}/api/branding`);
      if (response.data.success && response.data.data && response.data.data.logo) {
        const logoUrl = response.data.data.logo.startsWith('http')
          ? response.data.data.logo
          : `${base_url}${response.data.data.logo.startsWith('/') ? '' : '/'}${response.data.data.logo}`;

        setDynamicLogo(logoUrl);
        setBrandingCache(logoUrl);
        localStorage.setItem('branding_logo', logoUrl);
        localStorage.setItem('branding_cache_time', Date.now().toString());
      }
    } catch (error) {
      console.error("Error fetching branding data:", error);
    }
  };

  const fetchNotice = async () => {
    try {
      const response = await axios.get(`${base_url}/api/notice`);
      if (response.data.success) {
        const title = response.data.data?.title ||
          "Welcome to Our Platform - Deposit Now and Get Exciting Bonuses!";
        setNotice(title);
        localStorage.setItem('notice_data', JSON.stringify({ title, timestamp: Date.now() }));
      }
    } catch (error) {
      console.error("Error fetching notice:", error);
      const cachedNotice = localStorage.getItem('notice_data');
      if (cachedNotice) {
        const parsed = JSON.parse(cachedNotice);
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
          setNotice(parsed.title);
          return;
        }
      }
      setNotice("Welcome to Our Platform - Deposit Now and Get Exciting Bonuses!");
    }
  };

  useEffect(() => {
    let mounted = true;

    const isInitialLoad =
      performance.navigation.type === performance.navigation.TYPE_NAVIGATE ||
      performance.navigation.type === performance.navigation.TYPE_RELOAD;

    if (isInitialLoad) setIsLoading(true);

    fetchBrandingData();
    fetchNotice();

    const handleLoad = () => { if (mounted) setIsLoading(false); };

    if (document.readyState === 'complete') {
      if (mounted) setIsLoading(false);
    } else {
      window.addEventListener('load', handleLoad);
      const fallbackTimer = setTimeout(() => { if (mounted) setIsLoading(false); }, 3000);
      return () => {
        mounted = false;
        window.removeEventListener('load', handleLoad);
        clearTimeout(fallbackTimer);
      };
    }

    return () => { mounted = false; };
  }, []);

  return (
    <div className="h-screen overflow-hidden font-poppins bg-[#1a1a1a] text-white">
      <PromotionalPopup />

      {showWelcomePopup && (
        <WelcomeBonusPopup onClose={() => setShowWelcomePopup(false)} />
      )}

      {isLoading && (
        <div className="fixed top-0 left-0 w-full h-full bg-[#0a0a0a] flex justify-center items-center z-[10000000]">
          <div className="relative w-36 h-36 md:w-44 md:h-44 flex justify-center items-center">
            <div
              className="absolute w-full h-full rounded-full border-[5px] border-transparent border-t-[#ff0000] border-b-[#ff0000] animate-spin"
              style={{ filter: 'drop-shadow(0 0 10px #ff0000) drop-shadow(0 0 4px #ff0000)', animationDuration: '1s' }}
            />
            <div className="z-10 flex justify-center items-center">
              <img className="w-[130px] md:w-[160px] object-contain" src={dynamicLogo} alt="Logo" />
            </div>
          </div>
        </div>
      )}

      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex h-[calc(100vh-56px)]">
        <Sidebar sidebarOpen={sidebarOpen} />

        <div className="flex-1 overflow-auto transition-all duration-300">
          <div>
            <div className="md:hidden">
              <Mobileslider />
            </div>
            <div className="md:block hidden">
              <Slider />
            </div>

            <main className="mx-auto w-full max-w-screen-xl px-2 md:px-4 md:py-4">
              <div className="p-2 md:p-4 text-black border-[1px] border-gray-800 rounded-[5px] md:rounded-[10px] flex items-center justify-between">
                <AiOutlineSound className="text-xl text-theme_color mr-2" />
                <marquee
                  behavior="scroll"
                  scrollamount="5" 
                  direction="left"
                  className="text-[12px] md:text-[14px] text-white flex-1 font-[400]"
                >
                  {notice || "Welcome to Our Platform - Deposit Now and Get Exciting Bonuses!"}
                </marquee>
              </div>

              <Category />
              <ProviderSlider />
              <Event />
              <Sports />
              <Featured />
            </main>

            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
};

const Home = () => (
  <AuthProvider>
    <HomeContent />
  </AuthProvider>
);

export default Home;