"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { calculateTransits, PlanetData, DivisionalChartData, Predictions, DashaInfo, SadeSatiInfo, Remedy, AyanamsaType, AshtakavargaData } from "@/lib/astrology";
import KundliChart, { ChartStyle } from "@/components/KundliChart";
import { Clock, MapPin, Calendar, Sun, Moon, Info, Sparkles, User, Navigation, ChevronUp, Settings, Edit2 } from "lucide-react";

interface Suggestion { name: string; lat: string; lon: string; }
const SUGGESTIONS_CACHE = new Map<string, Suggestion[]>();

export default function Home() {
  // Birth Profile State
  const [birthDateStr, setBirthDateStr] = useState<string>("");
  const [birthTimeStr, setBirthTimeStr] = useState<string>("");
  const [birthLat, setBirthLat] = useState<number>(28.6139);
  const [birthLon, setBirthLon] = useState<number>(77.2090);
  const [birthPob, setBirthPob] = useState<string>("New Delhi, Delhi, India");

  // Transit Parameters State
  const [transitDateStr, setTransitDateStr] = useState<string>("");
  const [transitTimeStr, setTransitTimeStr] = useState<string>("");
  const [transitLat, setTransitLat] = useState<number>(28.6139);
  const [transitLon, setTransitLon] = useState<number>(77.2090);
  const [transitPob, setTransitPob] = useState<string>("New Delhi, Delhi, India");

  // City Search State
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestionsFor, setShowSuggestionsFor] = useState<"birth" | "transit" | null>(null);
  const [isLoadingCity, setIsLoadingCity] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Astrological Data State
  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [chartData, setChartData] = useState<DivisionalChartData | null>(null);
  const [d9Data, setD9Data] = useState<DivisionalChartData | null>(null);
  const [d60Data, setD60Data] = useState<DivisionalChartData | null>(null);
  const [predictionsMoon, setPredictionsMoon] = useState<Predictions>({ placements: [], aspects: [], yogas: [] });
  const [predictionsLagna, setPredictionsLagna] = useState<Predictions>({ placements: [], aspects: [], yogas: [] });
  const [dasha, setDasha] = useState<DashaInfo | undefined>(undefined);
  const [sadeSati, setSadeSati] = useState<SadeSatiInfo | undefined>(undefined);
  const [natalChart, setNatalChart] = useState<DivisionalChartData | null>(null);
  const [gocharaScore, setGocharaScore] = useState<number>(50);
  const [timelineScores, setTimelineScores] = useState<number[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<Array<{ day: number, label: string }>>([]);
  const [ashtakavarga, setAshtakavarga] = useState<AshtakavargaData | undefined>(undefined);
  const [remedies, setRemedies] = useState<Remedy[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ayanamsa, setAyanamsa] = useState<AyanamsaType>("Lahiri");
  const [referencePoint, setReferencePoint] = useState<"Moon" | "Lagna" | "Dasha Lord">("Moon");
  const [predictionReference, setPredictionReference] = useState<"Moon" | "Lagna">("Moon");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("North");
  const [scrubDays, setScrubDays] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  // Load from local storage and set initial transit time
  useEffect(() => {
    queueMicrotask(() => {
      // 1. Load birth details from local storage if available
      const savedBirthDate = localStorage.getItem("birthDateStr");
      const savedBirthTime = localStorage.getItem("birthTimeStr");
      const savedBirthLat = localStorage.getItem("birthLat");
      const savedBirthLon = localStorage.getItem("birthLon");
      const savedBirthPob = localStorage.getItem("birthPob");

      if (savedBirthDate) {
        setBirthDateStr(savedBirthDate);
        setIsSettingsOpen(false);
      }
      if (savedBirthTime) setBirthTimeStr(savedBirthTime);
      if (savedBirthLat) setBirthLat(parseFloat(savedBirthLat));
      if (savedBirthLon) setBirthLon(parseFloat(savedBirthLon));
      if (savedBirthPob) setBirthPob(savedBirthPob);

      // 2. Set transit defaults to "Right Now"
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      setTransitDateStr(`${year}-${month}-${day}`);
      setTransitTimeStr(`${hours}:${minutes}`);

      // If no saved birth details, default birth to exactly 30 years ago from now (as a sensible placeholder)
      if (!savedBirthDate) setBirthDateStr(`${year - 30}-${month}-${day}`);
      if (!savedBirthTime) setBirthTimeStr(`12:00`);

      setIsInitialized(true);
    });
  }, []);

  // Save birth details to local storage when they change
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem("birthDateStr", birthDateStr);
    localStorage.setItem("birthTimeStr", birthTimeStr);
    localStorage.setItem("birthLat", birthLat.toString());
    localStorage.setItem("birthLon", birthLon.toString());
    localStorage.setItem("birthPob", birthPob);
  }, [birthDateStr, birthTimeStr, birthLat, birthLon, birthPob, isInitialized]);

  // Unified City Search logic
  useEffect(() => {
    const query = showSuggestionsFor === "birth" ? birthPob : (showSuggestionsFor === "transit" ? transitPob : "");

    if (!showSuggestionsFor || query.length < 3) {
      queueMicrotask(() => setSuggestions([]));
      return;
    }

    if (SUGGESTIONS_CACHE.has(query)) {
      queueMicrotask(() => setSuggestions(SUGGESTIONS_CACHE.get(query)!));
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setIsLoadingCity(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'VedicTransitApp/1.0' }
          }
        );
        const data = await res.json();
        const results = data.map((item: { display_name: string; lat: string; lon: string }) => ({
          name: item.display_name,
          lat: item.lat,
          lon: item.lon,
        }));

        SUGGESTIONS_CACHE.set(query, results);
        if (SUGGESTIONS_CACHE.size > 100) {
          const firstKey = SUGGESTIONS_CACHE.keys().next().value;
          if (firstKey) SUGGESTIONS_CACHE.delete(firstKey);
        }
        setSuggestions(results);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      } finally {
        setIsLoadingCity(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [birthPob, transitPob, showSuggestionsFor]);

  // Main Calculation Effect
  useEffect(() => {
    if (!isInitialized || !birthDateStr || !birthTimeStr || !transitDateStr || !transitTimeStr) return;

    const timer = setTimeout(() => {
      const [by, bm, bd] = birthDateStr.split('-').map(Number);
      const [bh, bmin] = birthTimeStr.split(':').map(Number);
      const birthDateObj = new Date(by, bm - 1, bd, bh, bmin);

      const [ty, tm, td] = transitDateStr.split('-').map(Number);
      const [th, tmin] = transitTimeStr.split(':').map(Number);
      let calculationDate = new Date(ty, tm - 1, td, th, tmin);

      if (scrubDays !== 0) {
        calculationDate = new Date(calculationDate.getTime() + scrubDays * 24 * 60 * 60 * 1000);
      }

      const birthDetails = { date: birthDateObj, lat: birthLat, lon: birthLon };

      let refPlanetName: string = referencePoint === "Moon" ? "Moon" : "Ascendant";
      if (referencePoint === "Dasha Lord") {
        const { dasha: initialDasha } = calculateTransits(calculationDate, transitLat, transitLon, birthDetails, ayanamsa);
        if (initialDasha) {
          refPlanetName = initialDasha.mahadasha.lord;
        }
      }

      const res = calculateTransits(calculationDate, transitLat, transitLon, birthDetails, ayanamsa, refPlanetName);

      // Calculate timeline scores and events (Optimized: No birthDetails to skip redundant heavy logic)
      const scores: number[] = [];
      const events: Array<{ day: number, label: string }> = [];
      const startTime = new Date(calculationDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const lastPositions: {[key: string]: string} = {};

      for (let i = 0; i <= 60; i++) {
        const d = new Date(startTime.getTime() + i * 24 * 60 * 60 * 1000);
        // By omitting birthDetails here, calculateTransits skips Dasha, Sade Sati, and Ashtakavarga recursions
        const t = calculateTransits(d, transitLat, transitLon, undefined, ayanamsa, refPlanetName);

        if (i % 2 === 0) {
          scores.push(t.gocharaScore);
        }

        for (let j = 0; j < t.planets.length; j++) {
          const p = t.planets[j];
          const n = p.name;
          // Bolt Optimization: Replace `.forEach` and `.includes` with standard `for` loop and boolean checks
          if (n === "Sun" || n === "Moon" || n === "Mars" || n === "Mercury" || n === "Jupiter" || n === "Venus" || n === "Saturn") {
            if (lastPositions[n] && lastPositions[n] !== p.rasi) {
              events.push({ day: i - 30, label: `${n} enters ${p.rasi}` });
            }
            lastPositions[n] = p.rasi;
          }
        }
      }

      queueMicrotask(() => {
        setPlanets(res.planets);
        setChartData(res.d1);
        setD9Data(res.d9);
        setD60Data(res.d60);
        setPredictionsMoon(res.predictionsMoon);
        setPredictionsLagna(res.predictionsLagna);
        setDasha(res.dasha);
        setSadeSati(res.sadeSati);
        setGocharaScore(res.gocharaScore);
        setTimelineScores(scores);
        setTimelineEvents(events);
        setAshtakavarga(res.ashtakavarga);
        setRemedies(res.remedies);

        if (birthDetails) {
            const natal = calculateTransits(birthDetails.date, birthDetails.lat, birthDetails.lon, undefined, ayanamsa);
            setNatalChart(natal.d1);
        }
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [birthDateStr, birthTimeStr, birthLat, birthLon, transitDateStr, transitTimeStr, transitLat, transitLon, scrubDays, ayanamsa, referencePoint, isInitialized]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      const s = suggestions[activeSuggestionIndex];
      if (showSuggestionsFor === "birth") {
        setBirthPob(s.name);
        setBirthLat(parseFloat(s.lat));
        setBirthLon(parseFloat(s.lon));
      } else if (showSuggestionsFor === "transit") {
        setTransitPob(s.name);
        setTransitLat(parseFloat(s.lat));
        setTransitLon(parseFloat(s.lon));
      }
      setSuggestions([]);
      setShowSuggestionsFor(null);
      setActiveSuggestionIndex(-1);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setShowSuggestionsFor(null);
      setActiveSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setSuggestions([]);
        setShowSuggestionsFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionSelect = (s: Suggestion) => {
    if (showSuggestionsFor === "birth") {
      setBirthPob(s.name);
      setBirthLat(parseFloat(s.lat));
      setBirthLon(parseFloat(s.lon));
    } else if (showSuggestionsFor === "transit") {
      setTransitPob(s.name);
      setTransitLat(parseFloat(s.lat));
      setTransitLon(parseFloat(s.lon));
    }
    setSuggestions([]);
    setShowSuggestionsFor(null);
  };

  return (
    <main className="min-h-screen flex flex-col pb-32 bg-[#F9F7F1] text-[#1D4046] font-sans">
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-12 relative">

        {/* Global Input Section (Collapsible) */}
        <section className="bg-white rounded-3xl shadow-sm border border-[#1D4046]/10 overflow-hidden transition-all duration-500 ease-in-out" ref={suggestionRef}>
          {!isSettingsOpen ? (
            <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-white to-[#F9F7F1] select-none">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-widest">Natal</div>
                    <div className="font-semibold">{birthPob.split(',')[0]} • {birthDateStr}</div>
                  </div>
                </div>
                <div className="hidden md:block h-8 w-px bg-[#1D4046]/10" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1D4046]/10 flex items-center justify-center">
                    <Navigation className="w-4 h-4 text-[#1D4046]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-widest">Transit</div>
                    <div className="font-semibold">{transitPob.split(',')[0]} • {transitDateStr}</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1D4046] text-white rounded-full text-xs font-bold hover:bg-[#1D4046]/90 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F7F1] focus-visible:ring-[#F59E0B] select-none"
              >
                <Edit2 className="w-3.5 h-3.5" /> Modify Details
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#1D4046]/5 select-none">
                <h2 className="text-2xl font-serif flex items-center gap-3">
                  <Settings className="w-6 h-6 text-[#F59E0B]" /> Configuration
                </h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-[#F9F7F1] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] select-none"
                  aria-label="Collapse Settings"
                >
                  <ChevronUp className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 relative">
                {/* Birth Profile Inputs */}
                <div className="flex-1 space-y-6 lg:pr-8 lg:border-r border-[#1D4046]/10">
                  <h3 className="text-sm font-bold text-[#F59E0B] uppercase tracking-[0.2em]">Birth Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-1 md:col-span-2 relative">
                      <label htmlFor="birthCity" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none">
                        <MapPin className="w-3.5 h-3.5"/> City of Birth
                      </label>
                      <div className="relative">
                        <input
                          id="birthCity"
                          role="combobox"
                          aria-expanded={showSuggestionsFor === "birth" && suggestions.length > 0}
                          aria-haspopup="listbox"
                          aria-autocomplete="list"
                          aria-controls="birth-suggestions-listbox"
                          aria-activedescendant={activeSuggestionIndex >= 0 && showSuggestionsFor === "birth" ? `birth-suggestion-${activeSuggestionIndex}` : undefined}
                          value={birthPob}
                          onChange={e => { setBirthPob(e.target.value); setShowSuggestionsFor("birth"); }}
                          onKeyDown={handleKeyDown}
                          onFocus={() => setShowSuggestionsFor("birth")}
                          className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all"
                          placeholder="Search birth city..."
                        />
                        {isLoadingCity && showSuggestionsFor === "birth" && <div role="status" aria-label="Loading cities..." className="absolute right-3 top-3.5 animate-spin w-4 h-4 border-2 border-[#F59E0B] border-t-transparent rounded-full" />}

                    {/* Birth Suggestions Dropdown */}
                    {showSuggestionsFor === "birth" && suggestions.length > 0 && (
                      <div id="birth-suggestions-listbox" role="listbox" className="absolute z-50 w-full mt-1 bg-white border border-[#1D4046]/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto shadow-[#1D4046]/20 top-full left-0 select-none">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            id={`birth-suggestion-${i}`}
                            role="option"
                            aria-selected={i === activeSuggestionIndex}
                            onClick={() => handleSuggestionSelect(s)}
                            onMouseEnter={() => setActiveSuggestionIndex(i)}
                            className={`w-full text-left px-4 py-3 text-sm border-b border-[#1D4046]/5 last:border-0 transition-colors focus-visible:outline-none focus-visible:bg-[#F59E0B]/10 select-none ${i === activeSuggestionIndex ? 'bg-[#F59E0B]/10 text-[#F59E0B] font-bold' : 'text-[#1D4046]/80 hover:bg-[#F9F7F1]'}`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="birthDate" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Calendar className="w-3.5 h-3.5"/> Date</label>
                      <input id="birthDate" type="date" value={birthDateStr} onChange={e => setBirthDateStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="birthTime" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Clock className="w-3.5 h-3.5"/> Time</label>
                      <input id="birthTime" type="time" value={birthTimeStr} onChange={e => setBirthTimeStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Transit Parameters Inputs */}
                <div className="flex-1 space-y-6 select-none">
                   <h3 className="text-sm font-bold text-[#1D4046]/40 uppercase tracking-[0.2em]">Transit Parameters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-1 md:col-span-2 relative">
                      <label htmlFor="transitCity" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none">
                        <MapPin className="w-3.5 h-3.5"/> Current City
                      </label>
                      <div className="relative">
                        <input
                          id="transitCity"
                          role="combobox"
                          aria-expanded={showSuggestionsFor === "transit" && suggestions.length > 0}
                          aria-haspopup="listbox"
                          aria-autocomplete="list"
                          aria-controls="transit-suggestions-listbox"
                          aria-activedescendant={activeSuggestionIndex >= 0 && showSuggestionsFor === "transit" ? `transit-suggestion-${activeSuggestionIndex}` : undefined}
                          value={transitPob}
                          onChange={e => { setTransitPob(e.target.value); setShowSuggestionsFor("transit"); }}
                          onKeyDown={handleKeyDown}
                          onFocus={() => setShowSuggestionsFor("transit")}
                          className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#1D4046]/20 transition-all"
                          placeholder="Search transit city..."
                        />
                        {isLoadingCity && showSuggestionsFor === "transit" && <div role="status" aria-label="Loading cities..." className="absolute right-3 top-3.5 animate-spin w-4 h-4 border-2 border-[#F59E0B] border-t-transparent rounded-full" />}

                    {/* Transit Suggestions Dropdown */}
                    {showSuggestionsFor === "transit" && suggestions.length > 0 && (
                      <div id="transit-suggestions-listbox" role="listbox" className="absolute z-50 w-full mt-1 bg-white border border-[#1D4046]/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto shadow-[#1D4046]/20 top-full left-0 select-none">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            id={`transit-suggestion-${i}`}
                            role="option"
                            aria-selected={i === activeSuggestionIndex}
                            onClick={() => handleSuggestionSelect(s)}
                            onMouseEnter={() => setActiveSuggestionIndex(i)}
                            className={`w-full text-left px-4 py-3 text-sm border-b border-[#1D4046]/5 last:border-0 transition-colors focus-visible:outline-none focus-visible:bg-[#F59E0B]/10 select-none ${i === activeSuggestionIndex ? 'bg-[#F59E0B]/10 text-[#F59E0B] font-bold' : 'text-[#1D4046]/80 hover:bg-[#F9F7F1]'}`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="transitDate" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Calendar className="w-3.5 h-3.5"/> Date</label>
                      <input id="transitDate" type="date" value={transitDateStr} onChange={e => setTransitDateStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#1D4046]/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="transitTime" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Clock className="w-3.5 h-3.5"/> Time</label>
                      <input id="transitTime" type="time" value={transitTimeStr} onChange={e => setTransitTimeStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#1D4046]/20 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 select-none">
              <h1 className="text-4xl font-serif text-[#1D4046] tracking-tight select-none">Your Personal Energy Forecast</h1>
              <div className="flex flex-wrap gap-4">
                <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm" role="group" aria-label="Select Ayanamsa">
                  {["Lahiri", "Raman", "Fagan-Bradley"].map(a => <button key={a} aria-pressed={ayanamsa === a} onClick={() => setAyanamsa(a as AyanamsaType)} className={`px-3 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${ayanamsa === a ? 'bg-[#F59E0B] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{a}</button>)}
                </div>
                <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm" role="group" aria-label="Select Reference Point">
                  {["Moon", "Lagna", "Dasha Lord"].map(r => <button key={r} aria-pressed={referencePoint === r} onClick={() => setReferencePoint(r as "Moon" | "Lagna" | "Dasha Lord")} className={`px-3 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${referencePoint === r ? 'bg-[#1D4046] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{r}</button>)}
                </div>
              </div>
            </header>

            <section className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] border border-[#1D4046]/10 shadow-xl relative overflow-hidden select-none">
                {sadeSati?.isActive && (
                    <div className="absolute top-6 right-6 animate-pulse flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm">
                        <span className="w-2.5 h-2.5 bg-red-600 rounded-full" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Sade Sati: {sadeSati.phase}</span>
                    </div>
                )}

                <div className="mb-10 text-center space-y-2">
                  <h2 className="text-sm font-bold text-[#1D4046]/40 uppercase tracking-[0.3em]">Energy Forecast</h2>
                  <p className="text-2xl font-serif text-[#1D4046]">
                    {gocharaScore >= 70 ? "Highly Supportive Energies" :
                     gocharaScore >= 50 ? "Balanced & Steady Growth" :
                     gocharaScore >= 30 ? "Exercise Caution & Patience" :
                     "Intense Karmic Period"}
                  </p>
                </div>

                <div className="relative w-64 h-64 flex items-center justify-center">
                    <svg role="img" aria-label="Transit Score Radial Graph" className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#F9F7F1" strokeWidth="10" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#F59E0B" strokeWidth="10" strokeDasharray="283" strokeDashoffset={283 - (283 * gocharaScore) / 100} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className="text-7xl font-serif font-bold text-[#1D4046] tracking-tighter">{gocharaScore.toFixed(1)}<span className="text-2xl text-[#1D4046]/40 ml-1">%</span></span>
                        <div className={`mt-4 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm ${gocharaScore >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {gocharaScore >= 50 ? 'Auspicious' : 'Challenging'}
                        </div>
                    </div>
                </div>

                {dasha && (
                  <div className="mt-12 w-full max-w-md">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#1D4046]/10" />
                      <span className="text-[10px] font-bold text-[#1D4046]/30 uppercase tracking-[0.2em]">Active Influence</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#1D4046]/10" />
                    </div>
                    <div className="text-2xl text-[#1D4046] font-serif text-center">
                      <span className="text-[#F59E0B]">{dasha.mahadasha.lord}</span>
                      <span className="mx-2 text-[#1D4046]/20">/</span>
                      <span>{dasha.antardasha.lord}</span>
                      <span className="mx-2 text-[#1D4046]/20">/</span>
                      <span className="text-sm opacity-60">{dasha.pratyantardasha.lord}</span>
                    </div>
                  </div>
                )}
            </section>
          </div>
        )}

        {activeTab === "predictions" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 select-none">
              <h1 className="text-4xl font-serif text-[#1D4046] tracking-tight select-none">Predictions</h1>
              <div className="flex flex-wrap gap-4">
                <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm" role="group" aria-label="Select Prediction Reference">
                  {["Moon", "Lagna"].map(r => <button key={r} aria-pressed={predictionReference === r} onClick={() => setPredictionReference(r as "Moon" | "Lagna")} className={`px-3 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${predictionReference === r ? 'bg-[#1D4046] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>From {r}</button>)}
                </div>
              </div>
            </header>

            <div className="space-y-6">
              <h2 className="text-xs font-bold text-[#1D4046]/60 uppercase tracking-[0.3em] flex items-center gap-3 select-none">
                <div className="h-px w-8 bg-[#F59E0B]/40" /> Major Influences
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {planets.filter(p => ["Sun", "Moon", dasha?.mahadasha.lord].includes(p.name)).map((p, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-[#1D4046]/10 shadow-sm hover:shadow-md transition-all border-l-4 border-l-[#F59E0B]">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-serif text-lg font-bold">{p.name}</h3>
                            <span className="text-[10px] font-bold bg-[#F9F7F1] px-2 py-1 rounded border border-[#1D4046]/10 uppercase">{p.rasi}</span>
                        </div>
                        <p className="text-sm text-[#1D4046]/80 leading-relaxed mb-4">{(predictionReference === "Moon" ? predictionsMoon : predictionsLagna).placements.find(pr => pr.startsWith(p.name))?.split(': ')[1] || 'Analyzing transit impact...'}</p>
                        <div className="flex gap-3">
                            {p.vedha?.isObstructed && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">Vedha: {p.vedha.obstructingPlanet}</span>}
                            {p.isRetrograde && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Retrograde</span>}
                        </div>
                    </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xs font-bold text-[#1D4046]/60 uppercase tracking-[0.3em] flex items-center gap-3 select-none">
                <div className="h-px w-8 bg-[#1D4046]/20" /> Supporting Transits
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80">
                {planets.filter(p => ["Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(p.name) && p.name !== dasha?.mahadasha.lord).map((p, i) => (
                    <div key={i} className="bg-white/60 p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-serif text-base font-bold">{p.name}</h3>
                            <span className="text-[10px] font-bold bg-[#F9F7F1] px-2 py-1 rounded border border-[#1D4046]/10 uppercase">{p.rasi}</span>
                        </div>
                        <p className="text-xs text-[#1D4046]/70 leading-relaxed mb-4 line-clamp-3">{(predictionReference === "Moon" ? predictionsMoon : predictionsLagna).placements.find(pr => pr.startsWith(p.name))?.split(': ')[1] || 'Analyzing transit impact...'}</p>
                        <div className="flex gap-3">
                            {p.vedha?.isObstructed && <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">Vedha</span>}
                            {p.isRetrograde && <span className="text-[10px] font-bold text-orange-600/60 bg-orange-50 px-2 py-0.5 rounded">Retrograde</span>}
                        </div>
                    </div>
                ))}
              </div>
            </div>

            {(predictionReference === "Moon" ? predictionsMoon : predictionsLagna).yogas.length > 0 && (
                <section className="bg-[#1D4046] p-8 rounded-3xl text-white shadow-lg">
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2 select-none"><Sparkles className="text-[#F59E0B]"/> Active Planetary Yogas</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {(predictionReference === "Moon" ? predictionsMoon : predictionsLagna).yogas.map((y, i) => {
                            const [title, desc] = y.split(': ');
                            return (
                                <div key={i} className="bg-white/10 p-4 rounded-xl border border-white/10">
                                    <div className="font-bold text-[#F59E0B] mb-1">{title}</div>
                                    <div className="text-sm text-white/80">{desc}</div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <h1 className="text-4xl font-serif text-[#1D4046] select-none">Sky Timeline</h1>
                <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm space-y-8 select-none">
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest mb-1">Interactive Scrubber</div>
                            <div className="text-2xl font-serif">{scrubDays === 0 ? 'Transit Date' : `${Math.abs(scrubDays)} days ${scrubDays > 0 ? 'forward' : 'back'}`}</div>
                        </div>
                        <div className="text-4xl font-serif text-[#F59E0B]">{gocharaScore.toFixed(1)}%</div>
                    </div>
                    <input type="range" min="-30" max="30" value={scrubDays} onChange={e => setScrubDays(parseInt(e.target.value))} aria-label="Transit Timeline Scrubber" className="w-full h-1.5 bg-[#F9F7F1] rounded-lg appearance-none cursor-pointer accent-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]" />
                    <div className="h-48 w-full bg-[#F9F7F1] rounded-2xl border border-[#1D4046]/5 p-4 relative overflow-hidden">
                        <svg role="img" aria-label="Interactive timeline showing transit score over 60 days" className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                            {timelineScores.length > 0 && (
                              <path d={`M ${timelineScores.map((s, i) => `${(i / (timelineScores.length - 1)) * 100},${100 - s}`).join(' L ')}`} fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
                            )}
                            <line x1="50" y1="0" x2="50" y2="100" stroke="#1D4046" strokeWidth="1" strokeDasharray="4" strokeOpacity="0.2" />

                            {timelineEvents.map((ev, idx) => (
                                <g key={idx}>
                                    <line x1={50 + (ev.day / 30) * 50} y1="0" x2={50 + (ev.day / 30) * 50} y2="100" stroke="#F59E0B" strokeWidth="0.5" strokeDasharray="2" opacity="0.5" />
                                    <circle cx={50 + (ev.day / 30) * 50} cy="10" r="1.5" fill="#F59E0B" />
                                </g>
                            ))}

                            <circle cx={50 + (scrubDays / 30) * 50} cy={100 - gocharaScore} r="4" fill="#F59E0B" />
                        </svg>

                        {/* Event Tooltips (Subtle) */}
                        <div className="absolute top-2 left-0 w-full flex justify-center pointer-events-none">
                            {timelineEvents.filter(e => Math.abs(e.day - scrubDays) < 1).map((e, i) => (
                                <div key={i} className="bg-[#1D4046] text-white text-[10px] px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in">
                                    {e.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                      <h2 className="text-center font-serif text-xl mb-6">Transit Chart (D1)</h2>
                      {chartData ? <KundliChart data={chartData} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                        <h2 className="font-serif text-xl mb-6">Detailed Forecast</h2>
                        <ul className="space-y-4">
                            {(referencePoint === "Lagna" ? predictionsLagna : predictionsMoon).placements.slice(0, 6).map((p, i) => (
                                <li key={i} className="flex gap-4 text-sm text-[#1D4046]/70 leading-relaxed border-b border-[#1D4046]/5 pb-4 last:border-0"><span className="text-[#F59E0B] font-bold">✦</span>{p}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        )}

        {activeTab === "charts" && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row justify-between items-center gap-4 select-none">
                    <h1 className="text-4xl font-serif text-[#1D4046]">Deep Jyotish View</h1>
                    <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm" role="group" aria-label="Select Chart Style">
                        {["North", "South"].map(s => <button key={s} aria-pressed={chartStyle === s} onClick={() => setChartStyle(s as ChartStyle)} className={`px-4 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${chartStyle === s ? 'bg-[#F59E0B] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{s} Indian</button>)}
                    </div>
                </header>
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                        <h2 className="text-center font-serif text-lg mb-6 text-[#F59E0B] select-none">Natal Chart (Birth)</h2>
                        {natalChart ? <KundliChart data={natalChart} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse flex items-center justify-center text-xs opacity-40 italic">Set birth time to see natal chart...</div>}
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm ring-2 ring-[#F59E0B]/20">
                        <h2 className="text-center font-serif text-lg mb-6 text-[#1D4046] select-none">Transit Chart (Now)</h2>
                        {chartData ? <KundliChart data={chartData} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {[{t: "D9 Navamsa", d: d9Data}, {t: "D60 Shashtiamsa", d: d60Data}].map((c, i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                            <h2 className="text-center font-serif text-lg mb-6 select-none">{c.t}</h2>
                            {c.d ? <KundliChart data={c.d} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
                        </div>
                    ))}
                </div>
                <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                    <h2 className="text-2xl font-serif mb-8 text-[#1D4046] select-none">Detailed Planetary Positions (Transit)</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-[#1D4046]/10">
                                <tr className="text-[#1D4046]/40 font-bold text-xs uppercase">
                                    <th className="pb-4">Planet</th>
                                    <th className="pb-4">Degree</th>
                                    <th className="pb-4">Rasi</th>
                                    <th className="pb-4">Nakshatra</th>
                                    <th className="pb-4">Pada</th>
                                    <th className="pb-4">Kakshya</th>
                                    <th className="pb-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1D4046]/5">
                                {planets.map((p) => (
                                    <tr key={p.name} className="group hover:bg-[#F9F7F1]/50">
                                        <td className="py-4 font-bold text-[#1D4046]">{p.name}</td>
                                        <td className="py-4">{p.degree}</td>
                                        <td className="py-4">{p.rasi}</td>
                                        <td className="py-4">{p.nakshatra}</td>
                                        <td className="py-4 text-center">{p.pada}</td>
                                        <td className="py-4">{p.kakshya || "-"}</td>
                                        <td className="py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {p.isRetrograde && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded">RET</span>}
                                                {p.isCombust && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded">COM</span>}
                                                {p.vedha?.isObstructed && <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold rounded">VED</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {ashtakavarga && (
                    <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                        <h2 className="text-2xl font-serif mb-8 text-[#1D4046] select-none">Ashtakavarga Analysis (SAV)</h2>
                        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3 mb-10">
                            {ashtakavarga.sav.map((s, i) => (
                                <div key={i} className={`p-4 rounded-2xl border text-center transition-all ${s >= 28 ? 'bg-green-50 border-green-200' : s <= 25 ? 'bg-red-50 border-red-200' : 'bg-[#F9F7F1] border-[#1D4046]/10'}`}>
                                    <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase mb-1">{["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"][i]}</div>
                                    <div className={`text-xl font-bold ${s >= 28 ? 'text-green-700' : s <= 25 ? 'text-red-700' : 'text-[#1D4046]'}`}>{s}</div>
                                </div>
                            ))}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-[#1D4046]/10"><tr className="text-[#1D4046]/40 font-bold text-xs uppercase"><th className="pb-4">Planet</th>{["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"].map(s => <th key={s} className="pb-4">{s}</th>)}</tr></thead>
                                <tbody className="divide-y divide-[#1D4046]/5">
                                    {Object.entries(ashtakavarga.bav).map(([p, scores]) => (
                                        <tr key={p} className="group hover:bg-[#F9F7F1]/50"><td className="py-4 font-bold text-[#1D4046]">{p}</td>{scores.map((s, idx) => <td key={idx} className={`py-4 ${s >= 5 ? 'text-green-600 font-bold' : s <= 3 ? 'text-red-500' : 'text-[#1D4046]/60'}`}>{s}</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        )}

        {activeTab === "remedies" && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <h1 className="text-4xl font-serif text-[#1D4046] select-none">Upayas & Dasha</h1>
                {dasha && (
                    <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm space-y-10">
                        {[
                          { label: "Mahadasha", value: dasha.mahadasha, color: "bg-[#F59E0B]" },
                          { label: "Antardasha", value: dasha.antardasha, color: "bg-[#1D4046]" },
                          { label: "Pratyantardasha", value: dasha.pratyantardasha, color: "bg-green-600" }
                        ].map((level, idx) => (
                            <div key={level.label}>
                                <div className="flex justify-between items-end mb-3">
                                    <div className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest">
                                      {level.label}: <span className={level.label === "Mahadasha" ? "text-[#F59E0B]" : "text-[#1D4046]"}>{level.value.lord}</span>
                                    </div>
                                    <div className="text-xs text-[#1D4046]/40 font-bold">
                                      Ends {new Date(level.value.end).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-[#F9F7F1] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${level.color} transition-all duration-1000`}
                                    style={{ width: `${(idx + 1) * 25}%` }}
                                  />
                                </div>
                            </div>
                        ))}
                    </section>
                )}
                <div className="grid md:grid-cols-2 gap-6">
                    {remedies.map((remedy, i) => (
                        <div key={i} className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm group hover:border-[#F59E0B]/40 transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-serif font-bold text-[#1D4046]">{remedy.planet} Upaya</h3>
                                <span className="text-[10px] font-bold text-[#F59E0B] bg-[#F59E0B]/5 px-3 py-1 rounded-full border border-[#F59E0B]/20 uppercase">{remedy.condition}</span>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-[#F9F7F1] p-4 rounded-2xl border border-[#1D4046]/5">
                                    <div className="text-[10px] font-bold text-[#F59E0B] uppercase mb-2 tracking-widest">Sattvic Mantra</div>
                                    <p className="font-serif italic text-[#1D4046] leading-relaxed">&ldquo;{remedy.mantra}&rdquo;</p>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase mb-1 tracking-widest">Charity (Daan)</div>
                                    <p className="text-sm text-[#1D4046]/80">{remedy.charity}</p>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase mb-1 tracking-widest">Lifestyle</div>
                                    <p className="text-sm text-[#1D4046]/80">{remedy.lifestyle}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <nav aria-label="Main Navigation" role="tablist" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1D4046]/90 backdrop-blur-md px-8 py-4 rounded-full flex gap-12 shadow-2xl items-center z-50 transition-all border border-white/10 select-none">
        {[{id: "dashboard", icon: Sun, label: "Sky"}, {id: "predictions", icon: Sparkles, label: "Predict"}, {id: "timeline", icon: Moon, label: "Time"}, {id: "charts", icon: Info, label: "Deep"}, {id: "remedies", icon: User, label: "Upaya"}].map(tab => (
            <button
                key={tab.id} role="tab" aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 p-2 -m-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:bg-white/5 transition-all ${activeTab === tab.id ? 'text-[#F59E0B] scale-110' : 'text-white/40 hover:text-white/80'}`}>
                <tab.icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{tab.label}</span>
            </button>
        ))}
      </nav>
    </main>
  );
}
