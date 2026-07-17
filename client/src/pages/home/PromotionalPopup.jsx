// components/home_componets/PromotionalPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaTimes, FaArrowLeft, FaArrowRight } from 'react-icons/fa';

const PromotionalPopup = () => {
  const [popups, setPopups] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const base_url = import.meta.env.VITE_API_KEY_Base_URL;
  const autoPlayTimer = useRef(null);

  // Check if popup has been closed before
  const hasPopupBeenClosed = () => {
    return localStorage.getItem('promotional_popup_closed') === 'true';
  };

  // Get current session popup display count
  const getPopupDisplayCount = () => {
    const count = parseInt(sessionStorage.getItem('promotional_popup_count') || '0');
    return count;
  };

  // Increment popup display count for this session
  const incrementPopupCount = () => {
    const currentCount = getPopupDisplayCount();
    sessionStorage.setItem('promotional_popup_count', String(currentCount + 1));
  };

  // Fetch popups
  useEffect(() => {
    const fetchPopups = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${base_url}/api/promotional-popups`);
        
        if (response.data.success && response.data.data.length > 0) {
          setPopups(response.data.data);
          
          // Check if we should show the popup
          const closed = hasPopupBeenClosed();
          const displayCount = getPopupDisplayCount();
          
          // Show popup if not closed and displayed less than 2 times this session
          if (!closed && displayCount < 2) {
            setIsVisible(true);
            incrementPopupCount();
          }
        }
      } catch (error) {
        console.error('Error fetching promotional popups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPopups();

    // Cleanup timer on unmount
    return () => {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
      }
    };
  }, []);

  // Auto-play slideshow
  useEffect(() => {
    if (isVisible && popups.length > 1) {
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

  // Close popup
  const closePopup = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      localStorage.setItem('promotional_popup_closed', 'true');
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

  // If no popups or loading, don't render
  if (loading || !isVisible || popups.length === 0) {
    return null;
  }

  const currentPopup = popups[currentIndex];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={closePopup}
    >
      <div 
        className={`relative bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl max-w-4xl w-full transition-transform duration-300 ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closePopup}
          className="absolute top-3 right-3 z-20 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all duration-200 hover:scale-110"
        >
          <FaTimes className="text-xl" />
        </button>

        {/* Image Container */}
        <div className="relative">
          <img
            src={currentPopup.image.startsWith('http') ? currentPopup.image : `${base_url}${currentPopup.image}`}
            alt={`Promotional ${currentIndex + 1}`}
            className="w-full h-auto max-h-[80vh] object-contain cursor-pointer"
            onClick={handleImageClick}
          />

          {/* Navigation Arrows - Desktop */}
          {popups.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200 hover:scale-110"
              >
                <FaArrowLeft className="text-xl" />
              </button>
              <button
                onClick={goToNext}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200 hover:scale-110"
              >
                <FaArrowRight className="text-xl" />
              </button>
            </>
          )}

          {/* Mobile Navigation Arrows */}
          {popups.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              <button
                onClick={goToNext}
                className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200"
              >
                <FaArrowRight className="text-sm" />
              </button>
            </>
          )}
        </div>

        {/* Slide Indicators */}
        {popups.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {popups.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-white w-6'
                    : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}

        {/* Optional: Slide Counter */}
        {popups.length > 1 && (
          <div className="absolute bottom-4 right-4 z-10 bg-black/50 px-3 py-1 rounded-full text-white text-xs">
            {currentIndex + 1} / {popups.length}
          </div>
        )}

        {/* Link indicator - show if image has link */}
        {currentPopup.link && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-black/60 px-4 py-1 rounded-full text-white text-xs">
            Click image to visit link
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionalPopup;