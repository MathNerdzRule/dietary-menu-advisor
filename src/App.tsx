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
  LocateFixed
} from 'lucide-react';
import { createGeminiService, withRetry } from './services/geminiService';
import type { AppState, Restaurant, Recommendations, UserRestrictions } from './types';
import { ALLERGY_OPTIONS, LOADING_MESSAGES } from './constants';

const App: React.FC = () => {
  // App State
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [appState, setAppState] = useState<AppState>('INITIAL_SEARCH');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // User Selections
  const [restaurantName, setRestaurantName] = useState('');
  const [location, setLocation] = useState('');
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState(false);
  const [restrictions, setRestrictions] = useState<UserRestrictions>({
    glutenFree: false,
    dairyFree: false,
    gastroparesis: false,
    allergies: [],
    other: ''
  });

  // AI Results
  const [foundRestaurant, setFoundRestaurant] = useState<Restaurant | null>(null);
  const [foundMenu, setFoundMenu] = useState<any>(null);
  const [results, setResults] = useState<Recommendations | null>(null);

  const gemini = useMemo(() => apiKey ? createGeminiService(apiKey) : null, [apiKey]);

  // Handle API Key Persistence
  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

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
    if (appState === 'LOADING_MENU' || appState === 'ANALYZING_MENU') {
      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [appState]);

  // Handlers
  const handleStartSearch = async () => {
    if (!restaurantName) return setError("Please enter a restaurant name.");
    if (!location) return setError("Please enter a location or detect your current one.");
    setError(null);
    setAppState('LOADING_MENU');
    try {
      const data = await withRetry(() => gemini!.findRestaurantAndGetMenu(restaurantName, location));
      if (data && data.restaurant) {
        setFoundRestaurant(data.restaurant);
        setFoundMenu(data.menu);
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
      const data = await withRetry(() => gemini!.getRecommendations(foundRestaurant!, foundMenu, restrictions));
      setResults(data);
      setAppState('SHOWING_RESULTS');
    } catch (e: any) {
      setError(e.message || "Analysis failed.");
      setAppState('CONFIRMING_RESTAURANT');
    }
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
    <div className="min-h-screen font-sans selection:bg-nourish-200">
      {/* Premium Gradient Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-nourish-50 via-white to-slate-50"></div>
      
      <header className="px-6 py-8 md:px-12">
        <nav className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-nourish-600 rounded-xl shadow-lg shadow-nourish-200">
              <ChefHat className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MENU<span className="text-nourish-600">ADVISOR</span></h1>
          </div>
          
          {!apiKey && (
            <div className="glass-card px-4 py-2 rounded-2xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-nourish-600" />
              <input 
                type="password" 
                placeholder="Gemini API Key" 
                className="bg-transparent text-sm focus:outline-none w-32 md:w-48"
                onChange={(e) => saveApiKey(e.target.value)}
              />
            </div>
          )}
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
              className="space-y-12 py-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-extrabold text-slate-900 leading-tight">
                  Safely navigate <br />any restaurant menu.
                </h2>
                <p className="text-lg text-slate-500 max-w-lg mx-auto">
                  Powered by AI to cross-reference ingredients with your specific dietary needs, including Gastroparesis.
                </p>
              </div>

              <div className="glass-card p-8 rounded-[2rem] space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-1.5">
                      <Search className="w-4 h-4 text-nourish-500" /> Restaurant Name
                    </label>
                    <input 
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-nourish-100 focus:border-nourish-400 outline-none transition-all"
                      placeholder="e.g. The Cheesecake Factory"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-nourish-500" /> Location
                    </label>
                    <div className="relative group">
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-nourish-100 focus:border-nourish-400 outline-none transition-all pr-32"
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
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Dietary Restrictions</h3>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'glutenFree', label: 'Gluten Free' },
                      { id: 'dairyFree', label: 'Dairy Free' },
                      { id: 'gastroparesis', label: 'Gastroparesis', highlight: true },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setRestrictions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof UserRestrictions] }))}
                        className={`px-6 py-3 rounded-xl border-2 font-semibold transition-all ${
                          restrictions[opt.id as keyof UserRestrictions] 
                            ? opt.highlight ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-nourish-600 border-nourish-600 text-white shadow-lg shadow-nourish-100'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-slate-400 mb-3 ml-1">COMMON ALLERGIES</h4>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGY_OPTIONS.map((allergy) => (
                        <button
                          key={allergy}
                          onClick={() => toggleAllergy(allergy)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            restrictions.allergies.includes(allergy)
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {allergy}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleStartSearch}
                  disabled={!apiKey}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  <Search className="w-5 h-5" /> Start Analyzing Menu
                </button>
                {!apiKey && <p className="text-center text-sm text-red-500 font-medium">Please enter your Gemini API key above to start.</p>}
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-pulse">
                  <AlertTriangle className="flex-shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}
            </motion.div>
          )}

          {(appState === 'LOADING_MENU' || appState === 'ANALYZING_MENU') && (
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
                <p className="text-2xl font-bold text-slate-800 transition-all duration-500">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
                {appState === 'ANALYZING_MENU' && (
                  <p className="text-sm text-slate-400 font-medium animate-pulse">
                    Note: Thorough ingredient analysis can take up to 60 seconds...
                  </p>
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
                <span className="bg-nourish-100 text-nourish-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Restaurant Found</span>
                <h2 className="text-3xl font-bold text-slate-900">Is this the correct place?</h2>
              </div>

              <div className="glass-card p-10 rounded-[2.5rem] border-nourish-200 border-2 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <ChefHat size={120} />
                </div>
                
                <div className="space-y-6 relative z-10 text-center">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900">{foundRestaurant.name}</h3>
                    <p className="text-slate-500 font-medium">{foundRestaurant.address}</p>
                  </div>

                  {foundRestaurant.website && (
                    <a 
                      href={foundRestaurant.website} 
                      target="_blank" 
                      className="inline-flex items-center gap-2 text-nourish-600 font-bold hover:text-nourish-700 transition-colors"
                    >
                      Visit Website <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <div className="pt-8 grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setAppState('INITIAL_SEARCH')}
                      className="border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                    >
                      No, Search Again
                    </button>
                    <button 
                      onClick={handleAnalyze}
                      className="bg-nourish-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-nourish-100 hover:bg-nourish-700 active:scale-[0.98] transition-all"
                    >
                      Yes, That's It!
                    </button>
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
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
                <div className="space-y-2">
                  <button 
                    onClick={() => setAppState('INITIAL_SEARCH')}
                    className="text-sm font-bold text-nourish-600 flex items-center gap-1 hover:translate-x-[-4px] transition-transform"
                  >
                    <ChevronRight className="rotate-180 w-4 h-4" /> Start Over
                  </button>
                  <h2 className="text-4xl font-extrabold text-slate-900 italic">{foundRestaurant?.name}</h2>
                  <p className="text-slate-500 font-medium">Personalized Safety Recommendations</p>
                </div>
                
                {!results.ingredientsFound && (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start gap-3 max-w-sm">
                    <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
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
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Best Choices</h3>
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
                          <h4 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{item.name}</h4>
                          {item.url && (
                            <a href={item.url} target="_blank" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                              <ExternalLink className="w-4 h-4 text-slate-400" />
                            </a>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm">{item.description}</p>
                      </div>
                      <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-50">
                        <p className="text-xs font-bold text-emerald-800 uppercase mb-1 flex items-center gap-1">
                          <Info size={10} /> Why it's safe
                        </p>
                        <p className="text-xs text-emerald-700 font-medium leading-relaxed">{item.reason}</p>
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
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Eat with Caution</h3>
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
                            <h4 className="text-xl font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{item.name}</h4>
                             {item.url && (
                              <a href={item.url} target="_blank" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <ExternalLink className="w-4 h-4 text-slate-400" />
                              </a>
                            )}
                          </div>
                          <p className="text-slate-500 text-sm">{item.description}</p>
                        </div>
                        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-50">
                          <p className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                            <XCircle size={10} /> Risks
                          </p>
                          <p className="text-xs text-amber-700 font-medium leading-relaxed">{item.reason}</p>
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
        © 2025 Dietary Menu Advisor • Built with Antigravity AI
      </footer>
    </div>
  );
};

export default App;
