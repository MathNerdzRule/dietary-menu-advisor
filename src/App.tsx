// Dietary Menu Advisor - Built with Antigravity AI (V1.3)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  ChefHat, 
  ShieldCheck,
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  ChevronRight,
  Info,
  LocateFixed,
  PlusCircle,
  Skull,
  Sun,
  Moon,
  Monitor,
  Star,
  Camera as CameraIcon,
  SlidersHorizontal
} from 'lucide-react';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { createGeminiService, withRetry } from './services/geminiService';
import type { AppState, TabState, Restaurant, Recommendations, UserRestrictions, FavoriteItem, RecommendationItem } from './types';
import { ALLERGY_OPTIONS, LOCATION_MESSAGES, ANALYSIS_MESSAGES } from './constants';

const Tooltip: React.FC<{ text: string, children: React.ReactNode }> = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center justify-center">
      <div 
        onMouseEnter={() => setShow(true)} 
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow(true)}
        onTouchEnd={() => setTimeout(() => setShow(false), 2000)}
        className="flex items-center justify-center"
      >
        {children}
      </div>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-full mb-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900 dark:border-t-slate-100"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const App: React.FC = () => {
  // App State
  const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
  const [appState, setAppState] = useState<AppState>('INITIAL_SEARCH');
  const [currentTab, setCurrentTab] = useState<TabState>('RESTRICTIONS');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as any) || 'system';
  });
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  // User Selections
  const [restaurantName, setRestaurantName] = useState('');
  const [location, setLocation] = useState('');
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5);
  const [restrictions, setRestrictions] = useState<UserRestrictions>({
    glutenFree: false,
    dairyFree: false,
    gastroparesis: false,
    vegan: false,
    vegetarian: false,
    lowSodium: false,
    keto: false,
    diabetic: false,
    allergies: [],
    other: ''
  });

  // Load persisted data
  useEffect(() => {
    const loadData = async () => {
      const { value: savedFavs } = await Preferences.get({ key: 'favorites' });
      if (savedFavs) setFavorites(JSON.parse(savedFavs));

      const { value: savedRestrictions } = await Preferences.get({ key: 'restrictions' });
      if (savedRestrictions) setRestrictions(JSON.parse(savedRestrictions));
    };
    loadData();
  }, []);

  // Persist data
  useEffect(() => {
    Preferences.set({ key: 'favorites', value: JSON.stringify(favorites) });
  }, [favorites]);

  useEffect(() => {
    Preferences.set({ key: 'restrictions', value: JSON.stringify(restrictions) });
  }, [restrictions]);

  // Sync theme with DOM
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(t);
    };

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // AI Results
  const [foundRestaurant, setFoundRestaurant] = useState<Restaurant | null>(null);
  const [foundMenu, setFoundMenu] = useState<any>(null);
  const [results, setResults] = useState<Recommendations | null>(null);
  const [lastQuery, setLastQuery] = useState<{name: string, location: string} | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);

  const gemini = useMemo(() => apiKey ? createGeminiService(apiKey) : null, [apiKey]);

  const [isDetecting, setIsDetecting] = useState(false);

  // Location Detection Function
  const detectLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          if (gemini) {
            const loc = await gemini.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            setDetectedLocation(loc);
            setLocation(loc);
            setManualLocation(false);
          }
        } catch (e) {
          console.error("Geocoding failed", e);
          setError("Could not identify your city. Please enter it manually.");
        } finally {
          setIsDetecting(false);
        }
      },
      (err) => {
        console.error("Location error", err);
        setError("Location permission denied. Please enter your city manually.");
        setIsDetecting(false);
      }
    );
  };

  // Detect on mount
  useEffect(() => {
    if (gemini && !location && !manualLocation) {
      detectLocation();
    }
  }, [gemini]);

  // Loading Message Cycle
  useEffect(() => {
    if (appState === 'LOADING_MENU' || appState === 'ANALYZING_MENU' || appState === 'SEARCHING_RESTAURANTS') {
      const messages = appState === 'SEARCHING_RESTAURANTS' ? LOCATION_MESSAGES : (appState === 'LOADING_MENU' ? LOCATION_MESSAGES : ANALYSIS_MESSAGES);
      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % messages.length);
      }, 2500);
      return () => clearInterval(interval);
    }
    setLoadingMsgIdx(0);
  }, [appState]);

  // Handlers
  const handleNearbySearch = async () => {
    if (!location) return setError("Please enter a location or detect your current one.");
    
    setError(null);
    setAppState('SEARCHING_RESTAURANTS');
    try {
      const data = await withRetry(() => gemini!.searchNearbyRestaurants(location, searchRadius, restrictions));
      setNearbyRestaurants(data);
      setAppState('INITIAL_SEARCH'); // Stay on same tab but show results
    } catch (e: any) {
      setError(e.message || "Failed to search restaurants.");
      setAppState('INITIAL_SEARCH');
    }
  };

  const handleSelectRestaurant = async (res: Restaurant) => {
    setFoundRestaurant(res);
    setRestaurantName(res.name);
    setError(null);
    setAppState('LOADING_MENU');
    try {
      const data = await withRetry(() => gemini!.findRestaurantAndGetMenu(res.name, res.address || location));
      if (data && data.restaurant) {
        setFoundRestaurant(data.restaurant);
        setFoundMenu(data.menu);
        setLastQuery({ name: res.name, location: res.address || location });
        setAppState('CONFIRMING_RESTAURANT');
      } else {
        throw new Error("Could not find menu for this restaurant.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to find menu.");
      setAppState('INITIAL_SEARCH');
    }
  };

  const handleStartSearch = async () => {
    if (!restaurantName) return setError("Please enter a restaurant name.");
    if (!location) return setError("Please enter a location or detect your current one.");
    
    // Skip if searching for the exact same restaurant results we already have
    if (foundRestaurant && lastQuery?.name === restaurantName && lastQuery?.location === location) {
      setAppState('CONFIRMING_RESTAURANT');
      return;
    }

    setError(null);
    setAppState('LOADING_MENU');
    try {
      const data = await withRetry(() => gemini!.findRestaurantAndGetMenu(restaurantName, location));
      if (data && data.restaurant) {
        setFoundRestaurant(data.restaurant);
        setFoundMenu(data.menu);
        setLastQuery({ name: restaurantName, location });
        setAppState('CONFIRMING_RESTAURANT');
      } else {
        throw new Error("Could not find restaurant or menu.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to find menu.");
      setAppState('INITIAL_SEARCH');
    }
  };

  const handleAnalyze = async () => {
    setAppState('ANALYZING_MENU');
    try {
      // Append new restrictions to the analysis
      const data = await withRetry(() => gemini!.getRecommendations(foundRestaurant!, foundMenu, restrictions));
      setResults(data);
      setAppState('SHOWING_RESULTS');
    } catch (e: any) {
      setError(e.message || "Analysis failed.");
      setAppState('CONFIRMING_RESTAURANT');
    }
  };

  const handleCaptureImage = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64
      });

      if (!image.base64String) return;

      setAppState('ANALYZING_MENU');
      
      // Convert base64 to File object for the service
      const byteCharacters = atob(image.base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${image.format}` });
      const file = new File([blob], `menu_capture.${image.format}`, { type: `image/${image.format}` });

      const data = await withRetry(() => gemini!.analyzeImage(file, foundRestaurant!, restrictions));
      setResults(data);
      setAppState('SHOWING_RESULTS');
    } catch (e: any) {
      if (e.message !== "User cancelled photos app") {
        setError(e.message || "Image analysis failed. Please try again or use text analysis.");
      }
      setAppState('CONFIRMING_RESTAURANT');
    }
  };

  const toggleFavorite = (item: RecommendationItem, restaurantName: string) => {
    setFavorites(prev => {
      const isFav = prev.find(f => f.name === item.name && f.restaurantName === restaurantName);
      if (isFav) {
        return prev.filter(f => f.name !== item.name || f.restaurantName !== restaurantName);
      }
      return [...prev, { ...item, restaurantName }];
    });
  };

  const toggleAllergy = (allergy: string) => {
    setRestrictions(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy) 
        ? prev.allergies.filter(a => a !== allergy) 
        : [...prev.allergies, allergy]
    }));
  };

  return (
    <div className="min-h-screen font-sans selection:bg-nourish-200 transition-colors duration-300">
      {/* Premium Gradient Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-nourish-50 via-white to-slate-50 dark:from-nourish-950 dark:via-emerald-950 dark:to-black"></div>
      
      <header className="px-6 py-8 md:px-12" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
        <nav className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-nourish-600 rounded-xl shadow-lg shadow-nourish-200">
              <ChefHat className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-slate-900 dark:text-white">MENU</span>
              <span className="text-nourish-600">ADVISOR</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              {[
                { id: 'light', icon: Sun },
                { id: 'system', icon: Monitor },
                { id: 'dark', icon: Moon }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  className={`p-1.5 rounded-lg transition-all ${
                    theme === t.id 
                      ? 'bg-white dark:bg-slate-700 text-nourish-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <t.icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {appState === 'INITIAL_SEARCH' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 py-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                  Your Personalized <br />Dining Guide.
                </h2>
                <div className="flex justify-center mt-8">
                  <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner">
                    <button
                      onClick={() => setCurrentTab('RESTRICTIONS')}
                      className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        currentTab === 'RESTRICTIONS' 
                          ? 'bg-white dark:bg-slate-700 text-nourish-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      Dietary Profile
                    </button>
                    <button
                      onClick={() => setCurrentTab('SEARCH')}
                      className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        currentTab === 'SEARCH' 
                          ? 'bg-white dark:bg-slate-700 text-nourish-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      Find Nearby
                    </button>
                  </div>
                </div>
              </div>

              {currentTab === 'RESTRICTIONS' ? (
                <div className="glass-card p-8 rounded-[2.5rem] space-y-8 border-2 border-slate-50 dark:border-slate-800/50">
                  <div className="space-y-6">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="text-nourish-600" /> Core Restrictions
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: 'glutenFree', label: 'Gluten Free' },
                        { id: 'dairyFree', label: 'Dairy Free' },
                        { id: 'vegan', label: 'Vegan' },
                        { id: 'vegetarian', label: 'Vegetarian' },
                        { id: 'lowSodium', label: 'Low Sodium' },
                        { id: 'keto', label: 'Keto' },
                        { id: 'diabetic', label: 'Diabetic', highlight: true },
                        { id: 'gastroparesis', label: 'Gastroparesis', highlight: true },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setRestrictions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof UserRestrictions] }))}
                          className={`px-5 py-3 rounded-xl border-2 font-semibold transition-all ${
                            restrictions[opt.id as keyof UserRestrictions] 
                              ? opt.highlight ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-nourish-600 border-nourish-600 text-white shadow-lg shadow-nourish-100'
                              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6 border-t border-slate-100 dark:border-slate-800 pt-8">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <AlertTriangle className="text-amber-500 w-5 h-5" /> Allergies & Others
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGY_OPTIONS.map((allergy) => (
                        <button
                          key={allergy}
                          onClick={() => toggleAllergy(allergy)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            restrictions.allergies.includes(allergy)
                              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-lg'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {allergy}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowOtherInput(!showOtherInput)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                          showOtherInput || restrictions.other
                            ? 'bg-nourish-100 dark:bg-nourish-900 text-nourish-700 dark:text-nourish-300'
                            : 'bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <PlusCircle size={14} /> Other
                      </button>
                    </div>

                    {showOtherInput && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                        <input 
                          autoFocus
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-4 focus:ring-nourish-100 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
                          placeholder="e.g. strawberries, cilantro"
                          value={restrictions.other}
                          onChange={(e) => setRestrictions(prev => ({ ...prev, other: e.target.value }))}
                        />
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="pt-4 text-center">
                    <p className="text-xs text-slate-400 font-medium italic">Changes are saved automatically.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="glass-card p-8 rounded-[2.5rem] space-y-8 border-2 border-slate-50 dark:border-slate-800/50">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-nourish-500" /> My Location
                        </label>
                        <div className="relative group">
                          <input 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-nourish-100 outline-none transition-all pr-32 text-slate-900 dark:text-slate-100"
                            placeholder="City, State, or Zip Code"
                            value={location}
                            onChange={(e) => { setLocation(e.target.value); setManualLocation(true); }}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {detectedLocation && !manualLocation && (
                              <span className="text-[10px] font-black tracking-tighter text-nourish-700 bg-nourish-100 px-2 py-1 rounded-lg uppercase">Auto</span>
                            )}
                            <button
                              onClick={detectLocation}
                              disabled={isDetecting}
                              className={`p-2 rounded-xl transition-all ${
                                isDetecting ? 'animate-pulse bg-slate-100' : 'hover:bg-nourish-50 text-slate-400 hover:text-nourish-600'
                              }`}
                              title="Detect my location"
                            >
                              <LocateFixed className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1.5">
                          <SlidersHorizontal className="w-4 h-4 text-nourish-500" /> Search Radius: <span className="text-nourish-600 font-bold">{searchRadius} miles</span>
                        </label>
                        <input 
                          type="range"
                          min="1"
                          max="25"
                          value={searchRadius}
                          onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-nourish-600 mt-4"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleNearbySearch}
                      className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl"
                    >
                      <Search className="w-5 h-5" /> Find Matching Restaurants
                    </button>
                  </div>

                  {nearbyRestaurants.length > 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-4">Found Matches</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {nearbyRestaurants.map((res, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectRestaurant(res)}
                            className="glass-card p-6 rounded-[2rem] text-left hover:border-nourish-400 transition-all group flex justify-between items-center"
                          >
                            <div className="space-y-1">
                              <p className="font-bold text-slate-900 dark:text-white group-hover:text-nourish-600 transition-colors">{res.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{res.address}</p>
                            </div>
                            <ChevronRight className="text-slate-300 group-hover:text-nourish-600 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Search Bar for specific places */}
              {currentTab === 'SEARCH' && (
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Or lookup a specific place</p>
                  <div className="glass-card p-4 rounded-2xl flex gap-3">
                    <input 
                      className="flex-1 bg-transparent border-none focus:outline-none text-slate-900 dark:text-white px-2"
                      placeholder="Enter restaurant name..."
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                    />
                    <button 
                      onClick={handleStartSearch}
                      className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}

              {favorites.length > 0 && currentTab === 'RESTRICTIONS' && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Star size={14} className="fill-amber-400 text-amber-400" /> Recent Favorites
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {favorites.slice(-5).reverse().map((fav, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          handleSelectRestaurant({ name: fav.restaurantName, address: '' });
                        }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-left hover:border-nourish-300 transition-all group max-w-[200px]"
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{fav.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{fav.restaurantName}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100">
                  <AlertTriangle className="flex-shrink-0" />
                  <p className="font-medium text-red-600">{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {(appState === 'LOADING_MENU' || appState === 'ANALYZING_MENU' || appState === 'SEARCHING_RESTAURANTS') && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-[60vh] space-y-8"
            >
              <div className="relative">
                <div className="w-24 h-24 border-8 border-nourish-100 rounded-full"></div>
                <div className="absolute inset-0 w-24 h-24 border-8 border-nourish-600 rounded-full border-t-transparent animate-spin"></div>
                <ChefHat className="absolute inset-0 m-auto text-nourish-600 w-8 h-8" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 transition-all duration-500">
                  {appState === 'SEARCHING_RESTAURANTS' ? "Scouting nearby options..." : (appState === 'LOADING_MENU' ? LOCATION_MESSAGES[loadingMsgIdx] : ANALYSIS_MESSAGES[loadingMsgIdx])}
                </p>
                {appState === 'ANALYZING_MENU' && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
                      Note: Thorough ingredient analysis can take up to 60 seconds...
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider max-w-xs mx-auto leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2">
                      Disclaimer: This app analyzes captured sections only and does not scan the entire menu. Results may be incomplete.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {appState === 'CONFIRMING_RESTAURANT' && foundRestaurant && (
            <motion.div 
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="py-12 space-y-8 max-w-xl mx-auto"
            >
              <div className="text-center space-y-2">
                <span className="bg-nourish-100 dark:bg-emerald-900/40 text-nourish-700 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Confirm & Start</span>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Ready to Analyze?</h2>
              </div>

              <div className="glass-card p-10 rounded-[2.5rem] border-nourish-200 border-2 overflow-hidden relative space-y-10">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <ChefHat size={120} />
                </div>
                
                <div className="space-y-4 relative z-10 text-center border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{foundRestaurant.name}</h3>
                    <p className="text-slate-500 dark:text-slate-300 font-medium">{foundRestaurant.address}</p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {[
                      restrictions.glutenFree && "Gluten-Free",
                      restrictions.dairyFree && "Dairy-Free",
                      restrictions.vegan && "Vegan",
                      restrictions.vegetarian && "Vegetarian",
                      restrictions.lowSodium && "Low-Sodium",
                      restrictions.keto && "Keto",
                      restrictions.diabetic && "Diabetic",
                      restrictions.gastroparesis && "Gastroparesis",
                      ...restrictions.allergies
                    ].filter(Boolean).map((tag, i) => (
                      <span key={i} className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-4 flex flex-col items-center gap-3">
                    {foundRestaurant.website && (
                      <a 
                        href={foundRestaurant.website} 
                        target="_blank" 
                        className="inline-flex items-center gap-2 text-nourish-600 font-bold hover:text-nourish-700 transition-colors text-sm"
                      >
                        Visit Website <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    
                    <button 
                      onClick={() => setAppState('INITIAL_SEARCH')}
                      className="text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest flex items-center gap-1"
                    >
                      Not the right place? Search again
                    </button>
                  </div>
                </div>

                <div className="space-y-8 relative z-10">
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={handleAnalyze}
                      className="w-full bg-nourish-600 text-white py-6 rounded-2xl font-black text-xl shadow-xl shadow-nourish-100 hover:bg-nourish-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                      Analyze Menu Now
                    </button>
                    <button 
                      onClick={handleCaptureImage}
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-5 rounded-2xl font-bold text-lg border-2 border-slate-200 dark:border-slate-800 hover:border-nourish-400 hover:text-nourish-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                    >
                      <CameraIcon className="w-5 h-5 text-slate-400 group-hover:text-nourish-600 transition-colors" /> Use Camera Instead
                    </button>
                    <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 font-medium px-4 leading-relaxed">
                      <Info size={12} className="inline mr-1 mb-0.5" /> 
                      "Analyze Menu" uses the digital menu found for this location. "Use Camera" scans a physical menu section.
                    </p>
                  </div>

                  {/* Optional Tweak Section */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-8 space-y-6">
                    <button 
                      onClick={() => setShowOtherInput(!showOtherInput)}
                      className="flex items-center justify-between w-full text-left group"
                    >
                      <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Adjust Restrictions</span>
                      <PlusCircle size={16} className={`text-slate-300 group-hover:text-nourish-600 transition-all ${showOtherInput ? 'rotate-45' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showOtherInput && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-6"
                        >
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'glutenFree', label: 'Gluten Free' },
                              { id: 'dairyFree', label: 'Dairy Free' },
                              { id: 'vegan', label: 'Vegan' },
                              { id: 'vegetarian', label: 'Vegetarian' },
                              { id: 'lowSodium', label: 'Low Sodium' },
                              { id: 'keto', label: 'Keto' },
                              { id: 'diabetic', label: 'Diabetic' },
                              { id: 'gastroparesis', label: 'Gastroparesis' },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => setRestrictions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof UserRestrictions] }))}
                                className={`px-4 py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                                  restrictions[opt.id as keyof UserRestrictions] 
                                    ? 'bg-nourish-600 border-nourish-600 text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Other Details</label>
                            <input 
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-4 focus:ring-nourish-100 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
                              placeholder="e.g. strawberries, cilantro"
                              value={restrictions.other}
                              onChange={(e) => setRestrictions(prev => ({ ...prev, other: e.target.value }))}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {appState === 'SHOWING_RESULTS' && results && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12 py-12"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-8">
                <div className="space-y-2">
                  <button 
                    onClick={() => setAppState('INITIAL_SEARCH')}
                    className="text-sm font-bold text-nourish-600 flex items-center gap-1 hover:translate-x-[-4px] transition-transform"
                  >
                    <ChevronRight className="rotate-180 w-4 h-4" /> Start Over
                  </button>
                  <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white italic">{foundRestaurant?.name}</h2>
                  <p className="text-slate-500 dark:text-slate-300 font-medium">Personalized Menu Recommendations</p>
                </div>
                
                {!results.ingredientsFound && (
                  <div className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-4 border border-amber-200 dark:border-amber-800 flex items-start gap-3 max-w-sm">
                    <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium leading-relaxed">
                      Waring: Ingredients were not fully verified via web search. Please confirm with your server before ordering.
                    </p>
                  </div>
                )}
              </div>

              {/* Best Choices */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Best Choices</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.safe.map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="glass-card p-6 rounded-3xl border-emerald-100 border-2 space-y-4 hover:shadow-2xl hover:shadow-emerald-900/5 transition-all group"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 transition-colors">{item.name}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tooltip text={favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name) ? "Remove Favorite" : "Save Favorite"}>
                              <button 
                                onClick={() => toggleFavorite(item, foundRestaurant!.name)}
                                className={`p-2 rounded-lg transition-all ${
                                  favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name)
                                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-amber-500'
                                }`}
                              >
                                <Star size={18} className={favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name) ? 'fill-amber-500' : ''} />
                              </button>
                            </Tooltip>
                            {item.url && (
                              <Tooltip text="View Source">
                                <a href={item.url} target="_blank" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                  <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                </a>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-500 dark:text-slate-300 text-sm">{item.description}</p>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-50 dark:border-emerald-900/50">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase mb-1 flex items-center gap-1">
                          <Info size={10} /> Why it's safe
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium leading-relaxed">{item.reason}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Caution Items */}
              {results.caution.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="text-amber-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Eat with Caution</h3>
                  </div>
                  
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.caution.map((item, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card p-6 rounded-3xl border-amber-100 border-2 space-y-4 hover:shadow-2xl hover:shadow-amber-900/5 transition-all group"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 transition-colors">{item.name}</h4>
                            </div>
                            <div className="flex items-center gap-1">
                              <Tooltip text={favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name) ? "Remove Favorite" : "Save Favorite"}>
                                <button 
                                  onClick={() => toggleFavorite(item, foundRestaurant!.name)}
                                  className={`p-2 rounded-lg transition-all ${
                                    favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name)
                                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' 
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-amber-500'
                                  }`}
                                >
                                  <Star size={18} className={favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name) ? 'fill-amber-500' : ''} />
                                </button>
                              </Tooltip>
                              {item.url && (
                                <Tooltip text="View Source">
                                  <a href={item.url} target="_blank" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    <ExternalLink className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                  </a>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-500 dark:text-slate-300 text-sm">{item.description}</p>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-50 dark:border-amber-900/50">
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1 flex items-center gap-1">
                            <XCircle size={10} /> Risks
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">{item.reason}</p>
                        </div>
                      </motion.div>
                    ))}
                   </div>
                </section>
              )}

              {/* Exclusion List (Strictly Avoid) */}
              {results.avoid && results.avoid.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Skull className="text-red-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">STRICTLY AVOID</h3>
                  </div>
                  
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.avoid.map((item, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card p-6 rounded-3xl border-red-100 border-2 space-y-4 hover:shadow-2xl hover:shadow-red-900/5 transition-all group bg-red-50/10"
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="text-xl font-bold text-red-900 dark:text-red-400">{item.name}</h4>
                            </div>
                            <div className="flex items-center gap-1">
                              <Tooltip text={favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name) ? "Remove Favorite" : "Save Favorite"}>
                                <button 
                                  onClick={() => toggleFavorite(item, foundRestaurant!.name)}
                                  className={`p-2 rounded-lg transition-all ${
                                    favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name)
                                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' 
                                      : 'hover:bg-red-100/50 dark:hover:bg-red-900/50 text-red-300 dark:text-red-700 hover:text-amber-500'
                                  }`}
                                >
                                  <Star size={18} className={favorites.find(f => f.name === item.name && f.restaurantName === foundRestaurant?.name) ? 'fill-amber-500' : ''} />
                                </button>
                              </Tooltip>
                              {item.url && (
                                <Tooltip text="View Source">
                                  <a href={item.url} target="_blank" className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors">
                                    <ExternalLink className="w-4 h-4 text-red-400 dark:text-red-500" />
                                  </a>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-500 dark:text-slate-300 text-sm">{item.description}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-2xl border border-red-100 dark:border-red-900/50">
                          <p className="text-xs font-bold text-red-800 dark:text-red-400 uppercase mb-1 flex items-center gap-1">
                            <AlertTriangle size={10} /> DANGER / EXCLUDED
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">{item.reason}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 text-center text-slate-400 text-xs font-bold tracking-widest uppercase">
        © 2026 Menu Advisor
      </footer>
    </div>
  );
};

export default App;
