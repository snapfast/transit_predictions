"use client";

import { useState, useEffect, useRef, KeyboardEvent, useMemo } from "react";
import { calculateTransits, PlanetData, DivisionalChartData, Predictions, DashaInfo, SadeSatiInfo, Remedy, AyanamsaType, AshtakavargaData } from "@/lib/astrology";
import KundliChart, { ChartStyle } from "@/components/KundliChart";
import { Clock, MapPin, Calendar, Sun, Info, Sparkles, User, Navigation, ChevronUp, Settings, Edit2 } from "lucide-react";

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
  const svgRef = useRef<SVGSVGElement>(null);

  // Browser Geolocation / Auto-Detect Current Location
  const [isDetectingLocation, setIsDetectingLocation] = useState<"birth" | "transit" | null>(null);

  const handleUseCurrentLocation = (field: "birth" | "transit") => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsDetectingLocation(field);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { headers: { 'User-Agent': 'VedicTransitApp/1.0' } }
          );
          const data = await res.json();
          const displayName = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          if (field === "birth") {
            setBirthPob(displayName);
            setBirthLat(latitude);
            setBirthLon(longitude);
          } else {
            setTransitPob(displayName);
            setTransitLat(latitude);
            setTransitLon(longitude);
          }
        } catch (err) {
          console.error("Error reverse-geocoding location:", err);
          const fallbackName = `Detected Coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          if (field === "birth") {
            setBirthPob(fallbackName);
            setBirthLat(latitude);
            setBirthLon(longitude);
          } else {
            setTransitPob(fallbackName);
            setTransitLat(latitude);
            setTransitLon(longitude);
          }
        } finally {
          setIsDetectingLocation(null);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert(`Failed to get position: ${error.message}`);
        setIsDetectingLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Helper to calculate the scrubbed date string dynamically
  const getScrubbedDateStr = () => {
    if (!transitDateStr || !transitTimeStr) return "";
    const [ty, tm, td] = transitDateStr.split('-').map(Number);
    const [th, tmin] = transitTimeStr.split(':').map(Number);
    const base = new Date(ty, tm - 1, td, th, tmin);
    const scrubbed = new Date(base.getTime() + scrubDays * 24 * 60 * 60 * 1000);
    return scrubbed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper to handle timeline click/drag scrub interactions
  const handleSvgInteraction = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = relativeX / rect.width;
    const day = Math.round(percentage * 60 - 30);
    setScrubDays(Math.max(-30, Math.min(30, day)));
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    handleSvgInteraction(e.clientX);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.buttons === 1) {
      handleSvgInteraction(e.clientX);
    }
  };

  const handleSvgTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      handleSvgInteraction(e.touches[0].clientX);
    }
  };

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

  // Upgraha State
  const [upgrahas, setUpgrahas] = useState<PlanetData[]>([]);
  const [showUpgrahasInCharts, setShowUpgrahasInCharts] = useState<boolean>(false);
  const [d1WithUpgrahas, setD1WithUpgrahas] = useState<DivisionalChartData | null>(null);
  const [d9WithUpgrahas, setD9WithUpgrahas] = useState<DivisionalChartData | null>(null);
  const [d60WithUpgrahas, setD60WithUpgrahas] = useState<DivisionalChartData | null>(null);
  const [natalChartWithUpgrahas, setNatalChartWithUpgrahas] = useState<DivisionalChartData | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ayanamsa, setAyanamsa] = useState<AyanamsaType>("Lahiri");
  const [referencePoint, setReferencePoint] = useState<"Moon" | "Lagna" | "Dasha Lord">("Moon");
  const [predictionReference, setPredictionReference] = useState<"Moon" | "Lagna">("Moon");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("North");
  const [scrubDays, setScrubDays] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState<null | { day: number; label: string; score: number; percentX: number; percentY: number }>(null);

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

  // 1. Timeline Background Score & Event Calculation Effect
  useEffect(() => {
    if (!isInitialized || !birthDateStr || !birthTimeStr || !transitDateStr || !transitTimeStr) return;

    const timer = setTimeout(() => {
      const [by, bm, bd] = birthDateStr.split('-').map(Number);
      const [bh, bmin] = birthTimeStr.split(':').map(Number);
      const birthDateObj = new Date(by, bm - 1, bd, bh, bmin);

      const [ty, tm, td] = transitDateStr.split('-').map(Number);
      const [th, tmin] = transitTimeStr.split(':').map(Number);
      const baseTransitDate = new Date(ty, tm - 1, td, th, tmin);

      const birthDetails = { date: birthDateObj, lat: birthLat, lon: birthLon };

      let refPlanetName: string = referencePoint === "Moon" ? "Moon" : "Ascendant";
      if (referencePoint === "Dasha Lord") {
        const { dasha: initialDasha } = calculateTransits(baseTransitDate, transitLat, transitLon, birthDetails, ayanamsa);
        if (initialDasha) {
          refPlanetName = initialDasha.mahadasha.lord;
        }
      }

      // Calculate timeline scores and events for 61 days (centered around baseTransitDate)
      const scores: number[] = [];
      const events: Array<{ day: number, label: string }> = [];
      const startTime = new Date(baseTransitDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const lastPositions: {[key: string]: string} = {};

      for (let i = 0; i <= 60; i++) {
        const d = new Date(startTime.getTime() + i * 24 * 60 * 60 * 1000);
        const t = calculateTransits(d, transitLat, transitLon, undefined, ayanamsa, refPlanetName);

        scores.push(t.gocharaScore);

        for (let j = 0; j < t.planets.length; j++) {
          const p = t.planets[j];
          const n = p.name;
          if (n === "Sun" || n === "Moon" || n === "Mars" || n === "Mercury" || n === "Jupiter" || n === "Venus" || n === "Saturn") {
            if (lastPositions[n] && lastPositions[n] !== p.rasi) {
              events.push({ day: i - 30, label: `${n} enters ${p.rasi}` });
            }
            lastPositions[n] = p.rasi;
          }
        }
      }

      queueMicrotask(() => {
        setTimelineScores(scores);
        setTimelineEvents(events);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [birthDateStr, birthTimeStr, birthLat, birthLon, transitDateStr, transitTimeStr, transitLat, transitLon, ayanamsa, referencePoint, isInitialized]);

  // 2. Fast Active Single-Day Calculation Effect
  useEffect(() => {
    if (!isInitialized || !birthDateStr || !birthTimeStr || !transitDateStr || !transitTimeStr) return;

    const timer = setTimeout(() => {
      const [by, bm, bd] = birthDateStr.split('-').map(Number);
      const [bh, bmin] = birthTimeStr.split(':').map(Number);
      const birthDateObj = new Date(by, bm - 1, bd, bh, bmin);

      const [ty, tm, td] = transitDateStr.split('-').map(Number);
      const [th, tmin] = transitTimeStr.split(':').map(Number);
      const baseTransitDate = new Date(ty, tm - 1, td, th, tmin);

      const calculationDate = new Date(baseTransitDate.getTime() + scrubDays * 24 * 60 * 60 * 1000);
      const birthDetails = { date: birthDateObj, lat: birthLat, lon: birthLon };

      let refPlanetName: string = referencePoint === "Moon" ? "Moon" : "Ascendant";
      if (referencePoint === "Dasha Lord") {
        const { dasha: initialDasha } = calculateTransits(calculationDate, transitLat, transitLon, birthDetails, ayanamsa);
        if (initialDasha) {
          refPlanetName = initialDasha.mahadasha.lord;
        }
      }

      const res = calculateTransits(calculationDate, transitLat, transitLon, birthDetails, ayanamsa, refPlanetName);

      queueMicrotask(() => {
        setPlanets(res.planets);
        setChartData(res.d1Asc);
        setD9Data(res.d9Asc);
        setD60Data(res.d60Asc);
        setUpgrahas(res.upgrahas || []);
        setD1WithUpgrahas(res.d1WithUpgrahasAsc || null);
        setD9WithUpgrahas(res.d9WithUpgrahasAsc || null);
        setD60WithUpgrahas(res.d60WithUpgrahasAsc || null);
        setPredictionsMoon(res.predictionsMoon);
        setPredictionsLagna(res.predictionsLagna);
        setDasha(res.dasha);
        setSadeSati(res.sadeSati);
        setGocharaScore(res.gocharaScore);
        setAshtakavarga(res.ashtakavarga);
        setRemedies(res.remedies);

        if (birthDetails) {
            const natal = calculateTransits(birthDetails.date, birthDetails.lat, birthDetails.lon, undefined, ayanamsa);
            setNatalChart(natal.d1);
            setNatalChartWithUpgrahas(natal.d1WithUpgrahas || null);
        }
      });
    }, 50); // Minimal 50ms delay for ultra-fast, snappy scrubbing response

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

  const activeSignEvents = useMemo(() => timelineEvents.filter(e => e.day === scrubDays), [timelineEvents, scrubDays]);

  const activePlacementsMap = useMemo(() => {
    const placements = predictionReference === "Moon" ? predictionsMoon.placements : predictionsLagna.placements;
    const map = new Map<string, string>();
    for (let i = 0; i < placements.length; i++) {
        const parts = placements[i].split(': ');
        if (parts.length >= 2) {
            const planetName = parts[0].split(' ')[0];
            map.set(planetName, parts[1]);
        }
    }
    return map;
  }, [predictionsMoon, predictionsLagna, predictionReference]);

  const timelinePathStr = useMemo(() => {
    if (timelineScores.length === 0) return "";
    return timelineScores.map((s, i) => `${(i / (timelineScores.length - 1)) * 100},${100 - s}`).join(' L ');
  }, [timelineScores]);

  return (
    <main className="min-h-screen flex flex-col pb-32 bg-[#F9F7F1] text-[#1D4046] font-sans relative">
      {/* Decorative Traditional Border Motif */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#F59E0B] via-[#e28743] to-[#F59E0B] opacity-80" />

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-12 relative">

        {/* Classical Logo and Header Title */}
        <div className="text-center space-y-2 py-4 select-none">
          <div className="flex justify-center items-center gap-3">
            <span className="w-8 h-px bg-gradient-to-r from-transparent to-[#F59E0B]" />
            <span className="text-xs tracking-[0.4em] text-[#F59E0B] font-bold uppercase">Jyotisha Gochara</span>
            <span className="w-8 h-px bg-gradient-to-l from-transparent to-[#F59E0B]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#1D4046] tracking-wide">Vedic Transits</h1>
          <p className="text-xs text-[#1D4046]/60 italic font-serif">Classical Panchanga-aligned calculations for your destiny</p>
        </div>

        {/* Global Input Section (Collapsible) */}
        <section className="bg-white rounded-3xl shadow-sm border border-[#1D4046]/10 overflow-hidden transition-all duration-500 ease-in-out" ref={suggestionRef}>
          {!isSettingsOpen ? (
            <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-white to-[#F9F7F1] select-none">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                    <User aria-hidden="true" className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-widest">Natal</div>
                    <div className="font-semibold">{birthPob.split(',')[0]} • {birthDateStr}</div>
                  </div>
                </div>
                <div className="hidden md:block h-8 w-px bg-[#1D4046]/10" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1D4046]/10 flex items-center justify-center">
                    <Navigation aria-hidden="true" className="w-4 h-4 text-[#1D4046]" />
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
                <Edit2 aria-hidden="true" className="w-3.5 h-3.5" /> Modify Details
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#1D4046]/5 select-none">
                <h2 className="text-2xl font-serif flex items-center gap-3">
                  <Settings aria-hidden="true" className="w-6 h-6 text-[#F59E0B]" /> Configuration
                </h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-[#F9F7F1] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] select-none"
                  aria-label="Collapse Settings"
                >
                  <ChevronUp aria-hidden="true" className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 relative">
                {/* Birth Profile Inputs */}
                <div className="flex-1 space-y-6 lg:pr-8 lg:border-r border-[#1D4046]/10">
                  <h3 className="text-sm font-bold text-[#F59E0B] uppercase tracking-[0.2em]">Birth Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-1 md:col-span-2 relative">
                      <div className="flex justify-between items-center">
                        <label htmlFor="birthCity" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none">
                          <MapPin aria-hidden="true" className="w-3.5 h-3.5"/> City of Birth
                        </label>
                        <button
                          type="button"
                          onClick={() => handleUseCurrentLocation("birth")}
                          className="text-[10px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:underline select-none"
                        >
                          {isDetectingLocation === "birth" ? "Detecting..." : "Use My Location"}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="birthCity"
                          role="combobox"
                          aria-expanded={showSuggestionsFor === "birth" && suggestions.length > 0}
                          aria-haspopup="listbox"
                          aria-autocomplete="list"
                          aria-controls="birth-suggestions-listbox"
                          aria-activedescendant={activeSuggestionIndex >= 0 && showSuggestionsFor === "birth" ? `birth-suggestion-${activeSuggestionIndex}` : undefined}
                          aria-busy={isLoadingCity && showSuggestionsFor === "birth"}
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
                            type="button"
                            tabIndex={-1}
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
                      <label htmlFor="birthDate" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Calendar aria-hidden="true" className="w-3.5 h-3.5"/> Date</label>
                      <input id="birthDate" type="date" value={birthDateStr} onChange={e => setBirthDateStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="birthTime" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Clock aria-hidden="true" className="w-3.5 h-3.5"/> Time</label>
                      <input id="birthTime" type="time" value={birthTimeStr} onChange={e => setBirthTimeStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Transit Parameters Inputs */}
                <div className="flex-1 space-y-6 select-none">
                   <h3 className="text-sm font-bold text-[#1D4046]/40 uppercase tracking-[0.2em]">Transit Parameters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-1 md:col-span-2 relative">
                      <div className="flex justify-between items-center">
                        <label htmlFor="transitCity" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none">
                          <MapPin aria-hidden="true" className="w-3.5 h-3.5"/> Current City
                        </label>
                        <button
                          type="button"
                          onClick={() => handleUseCurrentLocation("transit")}
                          className="text-[10px] font-bold text-[#F59E0B] hover:text-[#F59E0B]/80 transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:underline select-none"
                        >
                          {isDetectingLocation === "transit" ? "Detecting..." : "Use My Location"}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="transitCity"
                          role="combobox"
                          aria-expanded={showSuggestionsFor === "transit" && suggestions.length > 0}
                          aria-haspopup="listbox"
                          aria-autocomplete="list"
                          aria-controls="transit-suggestions-listbox"
                          aria-activedescendant={activeSuggestionIndex >= 0 && showSuggestionsFor === "transit" ? `transit-suggestion-${activeSuggestionIndex}` : undefined}
                          aria-busy={isLoadingCity && showSuggestionsFor === "transit"}
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
                            type="button"
                            tabIndex={-1}
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
                      <label htmlFor="transitDate" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Calendar aria-hidden="true" className="w-3.5 h-3.5"/> Date</label>
                      <input id="transitDate" type="date" value={transitDateStr} onChange={e => setTransitDateStr(e.target.value)} className="w-full p-3 bg-[#F9F7F1] border border-[#1D4046]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#1D4046]/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="transitTime" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none"><Clock aria-hidden="true" className="w-3.5 h-3.5"/> Time</label>
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
                        {/* Outer track */}
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#F9F7F1" strokeWidth="6" />
                        {/* Inner gold decorative track */}
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="2 2" />
                        {/* Interactive dynamic progress ring */}
                        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#radial-accent-gradient)" strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * gocharaScore) / 100} className="transition-all duration-1000 ease-out" strokeLinecap="round" />

                        <defs>
                            <linearGradient id="radial-accent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#F59E0B" />
                                <stop offset="100%" stopColor="#d97706" />
                            </linearGradient>
                        </defs>
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

            {/* Integrated Transit Timeline Scrubber */}
            <section className="bg-white p-8 rounded-[3rem] border border-[#1D4046]/10 shadow-xl space-y-6 select-none relative overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-b border-[#1D4046]/5 pb-6">
                    <div className="space-y-1">
                        <div className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest flex items-center gap-2">
                            Current Position
                            {scrubDays !== 0 && (
                                <button
                                    onClick={() => setScrubDays(0)}
                                    aria-label="Reset to current date"
                                    className="bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 rounded text-[10px] font-extrabold hover:bg-[#F59E0B]/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                                >
                                    Reset to Today
                                </button>
                            )}
                        </div>
                        <div className="text-2xl font-serif text-[#1D4046]">{getScrubbedDateStr()}</div>
                        <div className="text-xs text-[#1D4046]/50">
                            {scrubDays === 0 ? "Today" : `${Math.abs(scrubDays)} days ${scrubDays > 0 ? 'forward' : 'backward'} in time`}
                        </div>
                    </div>

                    <div className="flex md:justify-center items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 flex items-center justify-center font-serif text-xl font-bold text-[#F59E0B]">
                            {gocharaScore.toFixed(0)}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest">Gochara Score</div>
                            <div className={`text-sm font-bold ${gocharaScore >= 70 ? 'text-green-600' : gocharaScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {gocharaScore >= 70 ? 'Highly Auspicious' : gocharaScore >= 50 ? 'Stable & Supportive' : 'Exercise Caution'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:items-end justify-center space-y-1">
                        <div className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest">Active Sign Transits</div>
                        <div className="flex flex-wrap md:justify-end gap-1.5 max-w-xs">
                            {activeSignEvents.length > 0 ? (
                                activeSignEvents.map((ev, i) => (
                                    <span key={i} className="text-[10px] font-bold bg-[#F59E0B] text-white px-2.5 py-1 rounded-full shadow-sm animate-bounce">
                                        {ev.label}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-[#1D4046]/40 italic">No exact sign changes today</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex flex-col justify-between pointer-events-none text-[10px] font-bold text-[#1D4046]/30 uppercase pl-1 select-none py-2">
                        <div>Excellent</div>
                        <div>Neutral</div>
                        <div>Caution</div>
                    </div>

                    <div className="h-56 w-full bg-gradient-to-b from-[#F9F7F1]/50 to-white rounded-2xl border border-[#1D4046]/5 relative overflow-hidden select-none">
                        <svg
                            ref={svgRef}
                            role="img"
                            aria-label="Interactive timeline showing transit score over 60 days"
                            className="w-full h-full select-none cursor-ew-resize overflow-visible"
                            preserveAspectRatio="none"
                            viewBox="0 0 100 100"
                            onClick={handleSvgClick}
                            onMouseMove={handleSvgMouseMove}
                            onTouchMove={handleSvgTouchMove}
                        >
                            <defs>
                                <linearGradient id="timeline-gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.18" />
                                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.00" />
                                </linearGradient>
                            </defs>

                            <line x1="0" y1="50" x2="100" y2="50" stroke="#1D4046" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.12" vectorEffect="non-scaling-stroke" />
                            <line x1="0" y1="30" x2="100" y2="30" stroke="#1D4046" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.04" vectorEffect="non-scaling-stroke" />
                            <line x1="0" y1="70" x2="100" y2="70" stroke="#1D4046" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.04" vectorEffect="non-scaling-stroke" />

                            {timelineScores.length > 0 && (
                                <path
                                    d={`M 0,100 L ${timelinePathStr} L 100,100 Z`}
                                    fill="url(#timeline-gradient)"
                                />
                            )}

                            {timelineScores.length > 0 && (
                                <path
                                    d={`M ${timelinePathStr}`}
                                    fill="none"
                                    stroke="#F59E0B"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )}

                            <line
                                x1={50 + (scrubDays / 30) * 50}
                                y1="0"
                                x2={50 + (scrubDays / 30) * 50}
                                y2="100"
                                stroke="#1D4046"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                                strokeOpacity="0.25"
                                vectorEffect="non-scaling-stroke"
                            />

                            {timelineEvents.map((ev, idx) => {
                                const xCoord = 50 + (ev.day / 30) * 50;
                                const isActiveDay = ev.day === scrubDays;
                                // find corresponding score on that day (day offset -30 to +30, index 0 to 60)
                                const scoreIndex = ev.day + 30;
                                const score = timelineScores[scoreIndex] ?? 50;
                                const yCoord = 100 - score;

                                return (
                                    <g key={idx}>
                                        <line
                                            x1={xCoord}
                                            y1="0"
                                            x2={xCoord}
                                            y2="100"
                                            stroke="#F59E0B"
                                            strokeWidth={isActiveDay ? "1.5" : "1"}
                                            strokeDasharray="2"
                                            strokeOpacity={isActiveDay ? "0.6" : "0.15"}
                                            vectorEffect="non-scaling-stroke"
                                        />
                                        <circle
                                            cx={xCoord}
                                            cy={yCoord}
                                            r={isActiveDay ? "5" : "3.5"}
                                            fill={isActiveDay ? "#F59E0B" : "#ffffff"}
                                            stroke="#F59E0B"
                                            strokeWidth="2"
                                            className="cursor-pointer transition-all duration-200 hover:scale-150 hover:fill-[#F59E0B]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setScrubDays(ev.day);
                                            }}
                                            onMouseEnter={() => {
                                                setHoveredEvent({
                                                    day: ev.day,
                                                    label: ev.label,
                                                    score,
                                                    percentX: xCoord,
                                                    percentY: yCoord,
                                                });
                                            }}
                                            onMouseLeave={() => setHoveredEvent(null)}
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Interactive Event Tooltip */}
                        {hoveredEvent && (
                            <div
                                className="absolute z-10 bg-[#1D4046] text-white p-2 rounded-lg shadow-xl text-[11px] font-sans border border-white/10 pointer-events-none transform -translate-x-1/2 -translate-y-[110%] transition-opacity duration-150"
                                style={{
                                    left: `${hoveredEvent.percentX}%`,
                                    top: `${hoveredEvent.percentY}%`,
                                }}
                            >
                                <div className="font-bold text-[#F59E0B]">{hoveredEvent.label}</div>
                                <div className="text-white/60">
                                    {hoveredEvent.day === 0 ? "Today" : `${Math.abs(hoveredEvent.day)} days ${hoveredEvent.day > 0 ? 'forward' : 'back'}`} • Score: {hoveredEvent.score.toFixed(1)}%
                                </div>
                            </div>
                        )}

                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border-2 border-[#F59E0B] shadow-[0_0_8px_#F59E0B] transition-all duration-75 pointer-events-none"
                            style={{
                                left: `calc(${50 + (scrubDays / 30) * 50}% - 6px)`,
                                top: `calc(${100 - gocharaScore}% - 6px)`,
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <input
                        type="range"
                        min="-30"
                        max="30"
                        value={scrubDays}
                        onChange={e => setScrubDays(parseInt(e.target.value))}
                        aria-label="Transit Timeline Scrubber"
                        aria-valuetext={scrubDays === 0 ? "Current Date" : `${Math.abs(scrubDays)} days ${scrubDays > 0 ? 'forward' : 'back'}`}
                        className="w-full h-1.5 bg-[#F9F7F1] rounded-lg appearance-none cursor-pointer accent-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-widest select-none">
                        <span>-30 Days</span>
                        <span>Today</span>
                        <span>+30 Days</span>
                    </div>
                </div>
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
                        <p className="text-sm text-[#1D4046]/80 leading-relaxed mb-4">{activePlacementsMap.get(p.name) || 'Analyzing transit impact...'}</p>
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
                        <p className="text-xs text-[#1D4046]/70 leading-relaxed mb-4 line-clamp-3">{activePlacementsMap.get(p.name) || 'Analyzing transit impact...'}</p>
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
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2 select-none"><Sparkles aria-hidden="true" className="text-[#F59E0B]"/> Active Planetary Yogas</h2>
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

            {/* Combined Dasha Progress Bars */}
            <h2 className="text-xs font-bold text-[#1D4046]/60 uppercase tracking-[0.3em] flex items-center gap-3 select-none">
              <div className="h-px w-8 bg-[#1D4046]/20" /> Active Dasha Periods
            </h2>
            {dasha && (
                <section className="bg-white p-8 rounded-[2rem] border border-[#1D4046]/10 shadow-sm space-y-10">
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

            {/* Combined Remedies (Upayas) */}
            <h2 className="text-xs font-bold text-[#1D4046]/60 uppercase tracking-[0.3em] flex items-center gap-3 select-none">
              <div className="h-px w-8 bg-[#1D4046]/20" /> Astrological Remedies (Upayas)
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
                {remedies.map((remedy, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2rem] border border-[#1D4046]/10 shadow-sm group hover:border-[#F59E0B]/40 transition-all">
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

        {activeTab === "charts" && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row justify-between items-center gap-4 select-none">
                    <h1 className="text-4xl font-serif text-[#1D4046]">Deep Jyotish View</h1>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm" role="group" aria-label="Select Chart Style">
                            {["North", "South"].map(s => <button key={s} aria-pressed={chartStyle === s} onClick={() => setChartStyle(s as ChartStyle)} className={`px-4 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${chartStyle === s ? 'bg-[#F59E0B] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{s} Indian</button>)}
                        </div>
                        <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm">
                            <button
                                aria-pressed={showUpgrahasInCharts}
                                onClick={() => setShowUpgrahasInCharts(!showUpgrahasInCharts)}
                                className={`px-4 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${showUpgrahasInCharts ? 'bg-[#1D4046] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}
                            >
                                {showUpgrahasInCharts ? "Hide Upgrahas in Charts" : "Show Upgrahas in Charts"}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Elegant Interactive Symbol Legend / Glossary */}
                <section className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm select-none">
                    <h2 className="text-xs font-bold text-[#1D4046]/60 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 bg-[#F59E0B] rotate-45" /> Planet & Symbol Glossary
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                        {[
                            { s: "As", n: "Ascendant", desc: "Ascendant (Lagna)" },
                            { s: "Su", n: "Sun", desc: "Surya (Sun)" },
                            { s: "Mo", n: "Moon", desc: "Chandra (Moon)" },
                            { s: "Ma", n: "Mars", desc: "Mangala (Mars)" },
                            { s: "Me", n: "Mercury", desc: "Budha (Mercury)" },
                            { s: "Ju", n: "Jupiter", desc: "Guru (Jupiter)" },
                            { s: "Ve", n: "Venus", desc: "Shukra (Venus)" },
                            { s: "Sa", n: "Saturn", desc: "Shani (Saturn)" },
                            { s: "Ra", n: "Rahu", desc: "North Node" },
                            { s: "Ke", n: "Ketu", desc: "South Node" },
                            { s: "Kl", n: "Kala", desc: "Kala (Upgraha)" },
                            { s: "Mr", n: "Mrityu", desc: "Mrityu (Upgraha)" },
                            { s: "Ar", n: "Ardhaprahara", desc: "Ardhaprahara" },
                            { s: "Yg", n: "Yamaghantaka", desc: "Yamaghantaka" },
                            { s: "Gk", n: "Gulika", desc: "Gulika (Sub-planet)" },
                            { s: "Mn", n: "Mandi", desc: "Mandi (Sub-planet)" },
                            { s: "Dh", n: "Dhuma", desc: "Dhuma (Aprakasha)" },
                            { s: "Vy", n: "Vyatipata", desc: "Vyatipata" }
                        ].map((item, idx) => (
                            <div key={idx} className="group relative flex items-center gap-2 px-3 py-2 bg-[#F9F7F1]/60 hover:bg-[#F59E0B]/10 rounded-xl border border-[#1D4046]/5 transition-all cursor-pointer">
                                <span className={`text-xs font-bold font-serif ${item.s === 'As' ? 'text-[#F59E0B]' : 'text-[#1D4046]'}`}>{item.s}</span>
                                <span className="text-[11px] text-[#1D4046]/75 font-medium truncate">{item.n}</span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1D4046] text-white text-[10px] py-1 px-2.5 rounded shadow-lg whitespace-nowrap z-50">
                                    {item.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                        <h2 className="text-center font-serif text-lg mb-6 text-[#F59E0B] select-none">Natal Chart (Birth)</h2>
                        {natalChart ? (
                            <KundliChart
                                data={showUpgrahasInCharts ? (natalChartWithUpgrahas || natalChart) : natalChart}
                                style={chartStyle}
                            />
                        ) : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse flex items-center justify-center text-xs opacity-40 italic">Set birth time to see natal chart...</div>}
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm ring-2 ring-[#F59E0B]/20">
                        <h2 className="text-center font-serif text-lg mb-6 text-[#1D4046] select-none">Transit Chart (Now)</h2>
                        {chartData ? (
                            <KundliChart
                                data={showUpgrahasInCharts ? (d1WithUpgrahas || chartData) : chartData}
                                style={chartStyle}
                            />
                        ) : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {[{t: "D9 Navamsa", d: d9Data, du: d9WithUpgrahas}, {t: "D60 Shashtiamsa", d: d60Data, du: d60WithUpgrahas}].map((c, i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                            <h2 className="text-center font-serif text-lg mb-6 select-none">{c.t}</h2>
                            {c.d ? (
                                <KundliChart
                                    data={showUpgrahasInCharts ? (c.du || c.d) : c.d}
                                    style={chartStyle}
                                />
                            ) : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
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

                {upgrahas.length > 0 && (
                    <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                        <h2 className="text-2xl font-serif mb-8 text-[#1D4046] select-none">Upgrahas (Shadow Planets & Sub-Planets)</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-[#1D4046]/10">
                                    <tr className="text-[#1D4046]/40 font-bold text-xs uppercase">
                                        <th className="pb-4">Upgraha</th>
                                        <th className="pb-4">Symbol</th>
                                        <th className="pb-4">Degree</th>
                                        <th className="pb-4">Rasi</th>
                                        <th className="pb-4">House</th>
                                        <th className="pb-4">Nakshatra</th>
                                        <th className="pb-4">Pada</th>
                                        <th className="pb-4">Kakshya</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1D4046]/5">
                                    {upgrahas.map((u) => (
                                        <tr key={u.name} className="group hover:bg-[#F9F7F1]/50">
                                            <td className="py-4 font-bold text-[#1D4046]">{u.name}</td>
                                            <td className="py-4"><span className="px-2.5 py-1 bg-[#1D4046]/5 border border-[#1D4046]/10 text-xs font-serif rounded text-[#1D4046] font-bold select-none">{u.symbol}</span></td>
                                            <td className="py-4">{u.degree}</td>
                                            <td className="py-4">{u.rasi}</td>
                                            <td className="py-4">{u.house}</td>
                                            <td className="py-4">{u.nakshatra}</td>
                                            <td className="py-4 text-center">{u.pada}</td>
                                            <td className="py-4">{u.kakshya || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

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
      </div>

      <nav aria-label="Main Navigation" role="tablist" className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1D4046]/90 backdrop-blur-md px-8 py-4 rounded-full flex gap-12 shadow-2xl items-center z-50 transition-all border border-white/10 select-none">
        {[{id: "dashboard", icon: Sun, label: "Sky"}, {id: "predictions", icon: Sparkles, label: "Predict"}, {id: "charts", icon: Info, label: "Deep"}].map(tab => (
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
