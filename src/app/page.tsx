"use client";

import { useState, useEffect, useRef, KeyboardEvent, useMemo } from "react";
import { calculateTransits, getRotatedChart, PlanetData, DivisionalChartData, Predictions, DashaInfo, SadeSatiInfo, Remedy, AyanamsaType, AshtakavargaData } from "@/lib/astrology";
import KundliChart, { ChartStyle } from "@/components/KundliChart";
import { Clock, MapPin, Calendar, Sun, Info, Sparkles, User, Navigation, ChevronUp, Settings, Edit2 } from "lucide-react";

interface Suggestion { name: string; lat: string; lon: string; }
const SUGGESTIONS_CACHE = new Map<string, Suggestion[]>();

const getDurationString = (start: Date, end: Date) => {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    // Approximate days in previous month
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  return parts.join(", ");
};

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

  // UI State - moved scrubDays up before getScrubbedDateStr definition
  const [scrubDays, setScrubDays] = useState<number>(0);

  // City Search State
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestionsFor, setShowSuggestionsFor] = useState<"birth" | "transit" | null>(null);
  const [isLoadingCity, setIsLoadingCity] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Helper to calculate the scrubbed date string dynamically
  const getScrubbedDateStr = useMemo(() => {
    return () => {
      if (!transitDateStr || !transitTimeStr) return "";
      const [ty, tm, td] = transitDateStr.split('-').map(Number);
      const [th, tmin] = transitTimeStr.split(':').map(Number);
      const base = new Date(ty, tm - 1, td, th, tmin);
      const scrubbed = new Date(base.getTime() + scrubDays * 24 * 60 * 60 * 1000);
      return scrubbed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };
  }, [transitDateStr, transitTimeStr, scrubDays]);

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
  const [predictionsMoon, setPredictionsMoon] = useState<Predictions>({ placements: [], aspects: [], yogas: [], combined: [] });
  const [predictionsLagna, setPredictionsLagna] = useState<Predictions>({ placements: [], aspects: [], yogas: [], combined: [] });
  const [dasha, setDasha] = useState<DashaInfo | undefined>(undefined);
  const [sadeSati, setSadeSati] = useState<SadeSatiInfo | undefined>(undefined);
  const [natalChart, setNatalChart] = useState<DivisionalChartData | null>(null);
  const [natalPlanets, setNatalPlanets] = useState<PlanetData[]>([]);
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [expandedChart, setExpandedChart] = useState<{ data: DivisionalChartData, title: string, highlightedHouses?: number[] } | null>(null);
  const [predictionsViewMode, setPredictionsViewMode] = useState<"summary" | "detailed">("detailed");

  const getHighlightedHousesForType = (type: string): number[] => {
    switch (type) {
      case "Career & Ambition": return [1, 10];
      case "Relationship & Social": return [7, 11];
      case "Financial & Fortune": return [2, 11];
      case "Health & Vitality": return [1, 6];
      case "Spiritual & Inner Growth": return [9, 12];
      default: return [];
    }
  };

  const getActiveTransitDate = () => {
    if (!transitDateStr || !transitTimeStr) return new Date();
    const [ty, tm, td] = transitDateStr.split('-').map(Number);
    const [th, tmin] = transitTimeStr.split(':').map(Number);
    const base = new Date(ty, tm - 1, td, th, tmin);
    return new Date(base.getTime() + scrubDays * 24 * 60 * 60 * 1000);
  };

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
            setNatalPlanets(natal.planets);
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

  const natalMoonRasiIdx = useMemo(() => {
    const m = natalPlanets.find(p => p.name === "Moon");
    if (!m) return 0;
    const map: Record<string, number> = { "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5, "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11 };
    return map[m.rasi] ?? 0;
  }, [natalPlanets]);

  const natalLagnaRasiIdx = useMemo(() => {
    const l = natalPlanets.find(p => p.name === "Ascendant");
    if (!l) return 0;
    const map: Record<string, number> = { "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5, "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11 };
    return map[l.rasi] ?? 0;
  }, [natalPlanets]);

  const transitMoonRasiIdx = useMemo(() => {
    const m = planets.find(p => p.name === "Moon");
    if (!m) return 0;
    const map: Record<string, number> = { "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5, "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11 };
    return map[m.rasi] ?? 0;
  }, [planets]);

  const transitLagnaRasiIdx = useMemo(() => {
    const l = planets.find(p => p.name === "Ascendant");
    if (!l) return 0;
    const map: Record<string, number> = { "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5, "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11 };
    return map[l.rasi] ?? 0;
  }, [planets]);

  const predictionNatalChart = useMemo(() => {
    if (!natalPlanets || natalPlanets.length === 0) return null;
    const refRasiIdx = predictionReference === "Moon" ? natalMoonRasiIdx : natalLagnaRasiIdx;
    return getRotatedChart(natalPlanets, refRasiIdx);
  }, [natalPlanets, predictionReference, natalMoonRasiIdx, natalLagnaRasiIdx]);

  const predictionTransitChart = useMemo(() => {
    if (!planets || planets.length === 0) return null;
    const refRasiIdx = predictionReference === "Moon" ? transitMoonRasiIdx : transitLagnaRasiIdx;
    return getRotatedChart(planets, refRasiIdx);
  }, [planets, predictionReference, transitMoonRasiIdx, transitLagnaRasiIdx]);

  const getWhyThisPredictionDetails = useMemo(() => {
    return (type: string, contributors: string[]) => {
      const activePlanets = planets;
      const signals: string[] = [];
      const breakdown: string[] = ["Base Confidence: 65%"];
      let score = 65;

      // 1. Dasha Influence
      if (dasha) {
        const mdLord = dasha.mahadasha.lord;
        const isMdContrib = contributors.some(c => c.toLowerCase().includes(mdLord.toLowerCase()));
        if (isMdContrib) {
          score += 10;
          breakdown.push(`+10% Active Mahadasha Lord (${mdLord})`);
          signals.push(`Mahadasha Lord ${mdLord} activates this life domain.`);
        }
      }

      // 2. SAV Influence
      if (ashtakavarga) {
        let primaryHouse = 1;
        if (type === "Career & Ambition") primaryHouse = 10;
        else if (type === "Relationship & Social") primaryHouse = 7;
        else if (type === "Financial & Fortune") primaryHouse = 2;
        else if (type === "Health & Vitality") primaryHouse = 1;
        else if (type === "Spiritual & Inner Growth") primaryHouse = 9;

        const houseRasis = predictionReference === "Moon" ? (predictionNatalChart?.houseRasis || {}) : (predictionNatalChart?.houseRasis || {});
        const rasiIdx = houseRasis[primaryHouse] ? houseRasis[primaryHouse] - 1 : -1;
        if (rasiIdx !== -1) {
          const bindus = ashtakavarga.sav[rasiIdx];
          if (bindus >= 28) {
            score += 10;
            breakdown.push(`+10% Strong SAV score (${bindus} Bindus)`);
            signals.push(`High SAV strength (${bindus} points) in primary house ${primaryHouse}.`);
          } else if (bindus <= 24) {
            score -= 10;
            breakdown.push(`-10% Low SAV score (${bindus} Bindus)`);
            signals.push(`Weak SAV strength (${bindus} points) in primary house ${primaryHouse}.`);
          } else {
            signals.push(`Moderate SAV strength (${bindus} points) in primary house ${primaryHouse}.`);
          }
        }
      }

      // 3. Vedha / Obstruction Influence
      let obstructedCount = 0;
      contributors.forEach(c => {
        const planetName = c.split(' ')[0];
        const pData = activePlanets.find(p => p.name === planetName);
        if (pData?.vedha?.isObstructed) {
          obstructedCount++;
          signals.push(`${planetName} transit is currently obstructed by ${pData.vedha.obstructingPlanet} (Vedha).`);
        } else if (pData) {
          signals.push(`${planetName} is transiting House ${pData.house} from ${predictionReference}.`);
        }
      });
      if (obstructedCount > 0) {
        const penalty = obstructedCount * 12;
        score -= penalty;
        breakdown.push(`-${penalty}% Vedha Transit Obstruction`);
      }

      score = Math.min(100, Math.max(30, score));

      return {
        score,
        signals,
        breakdown,
        assumptions: [
          `Ayanamsa System: Lahiri (Chitra Paksha)`,
          `Baseline Reference: ${predictionReference === "Moon" ? "Chandra Lagna (Moon-centric)" : "Janma Lagna (Ascendant-centric)"}`,
          `Calculation Date: ${getScrubbedDateStr()}`,
          `Location Coordinate: Lat ${birthLat.toFixed(4)}, Lon ${birthLon.toFixed(4)}`
        ]
      };
    };
  }, [planets, dasha, ashtakavarga, predictionReference, predictionNatalChart, birthLat, birthLon, getScrubbedDateStr]);

  const timelinePathStr = useMemo(() => {
    if (timelineScores.length === 0) return "";
    return timelineScores.map((s, i) => `${(i / (timelineScores.length - 1)) * 100},${100 - s}`).join(' L ');
  }, [timelineScores]);

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
                      <label htmlFor="birthCity" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none">
                        <MapPin aria-hidden="true" className="w-3.5 h-3.5"/> City of Birth
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
                      <label htmlFor="transitCity" className="text-xs font-bold text-[#1D4046]/40 uppercase flex items-center gap-2 cursor-pointer hover:text-[#1D4046]/60 transition-colors select-none">
                        <MapPin aria-hidden="true" className="w-3.5 h-3.5"/> Current City
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
                  <div className="mt-12 w-full max-w-md select-none">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#1D4046]/10" />
                      <span className="text-[10px] font-bold text-[#1D4046]/30 uppercase tracking-[0.2em]">Active Influence</span>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#1D4046]/10" />
                    </div>
                    <div className="text-2xl text-[#1D4046] font-serif text-center flex flex-wrap justify-center items-center gap-1">
                      <span className="text-[#F59E0B]" title="Mahadasha">{dasha.mahadasha.lord}</span>
                      <span className="text-[#1D4046]/20">/</span>
                      <span title="Antardasha">{dasha.antardasha.lord}</span>
                      <span className="text-[#1D4046]/20">/</span>
                      <span className="text-sm text-[#1D4046]/80" title="Pratyantardasha">{dasha.pratyantardasha.lord}</span>
                      <span className="text-[#1D4046]/20">/</span>
                      <span className="text-xs text-teal-600 font-sans" title="Sookshma Dasha">{dasha.sookshmadasha.lord}</span>
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
                                    </g>
                                );
                            })}
                        </svg>

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
            {/* Header Banner explaining the page's exact purpose vs Deep page */}
            <div className="bg-gradient-to-r from-[#1D4046] to-[#254F56] text-white p-8 md:p-10 rounded-[2.5rem] shadow-xl space-y-4 select-none relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-white font-bold">Actionable Forecasts & Synthesis</h1>
                  <p className="text-xs font-bold text-white/60 uppercase tracking-[0.2em] mt-1">Predictions Hub</p>
                </div>
              </div>
              <p className="text-sm md:text-base text-white/80 max-w-3xl leading-relaxed">
                Welcome to your astrological forecast workspace. Unlike the analytical, technical positions on the <strong>Deep</strong> page, this view synthesizes transits, aspects, conjunctions, and dasha alignments relative to your {predictionReference === "Moon" ? "Moon Sign (Chandra Lagna)" : "Ascendant Sign (Janma Lagna)"} to produce actionable, classical interpretations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#F59E0B] font-bold uppercase tracking-wider">
                  <Info className="w-4 h-4" /> Supporting reference-aligned charts are highlighted for target areas
                </div>
                <div className="flex gap-2 bg-white/10 p-1 rounded-lg">
                  <button
                    onClick={() => setPredictionsViewMode("summary")}
                    className={`px-4 py-1.5 text-xs rounded-md transition-all font-bold ${predictionsViewMode === "summary" ? 'bg-[#F59E0B] text-white shadow' : 'text-white/60 hover:text-white'}`}
                  >
                    Summary View
                  </button>
                  <button
                    onClick={() => setPredictionsViewMode("detailed")}
                    className={`px-4 py-1.5 text-xs rounded-md transition-all font-bold ${predictionsViewMode === "detailed" ? 'bg-[#F59E0B] text-white shadow' : 'text-white/60 hover:text-white'}`}
                  >
                    Detailed View
                  </button>
                </div>
              </div>
            </div>

            <header className="flex flex-col md:flex-row justify-between items-center gap-4 select-none">
              <h2 className="text-2xl font-serif text-[#1D4046] tracking-tight font-bold">Configure Predictive Baseline</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm" role="group" aria-label="Select Prediction Reference">
                  {["Moon", "Lagna"].map(r => <button key={r} aria-pressed={predictionReference === r} onClick={() => setPredictionReference(r as "Moon" | "Lagna")} className={`px-3 py-1 text-xs rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] ${predictionReference === r ? 'bg-[#1D4046] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>From {r}</button>)}
                </div>
              </div>
            </header>

            {/* Combined & Synthesized Predictions */}
            <div className="space-y-6">
              <h2 className="text-xs font-bold text-[#1D4046]/60 uppercase tracking-[0.3em] flex items-center gap-3 select-none">
                <div className="h-px w-8 bg-[#F59E0B]/40" /> Combined & Synthesized Insights
              </h2>
              <div className="grid grid-cols-1 gap-12">
                {(predictionReference === "Moon" ? predictionsMoon : predictionsLagna).combined?.map((pred, i) => {
                  const targetHighlightHouses = getHighlightedHousesForType(pred.type);
                  const whyDetails = getWhyThisPredictionDetails(pred.type, pred.contributors);

                  return (
                    <div key={i} className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-[#1D4046]/10 shadow-sm hover:shadow-md transition-all border-t-4 border-t-[#F59E0B] grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left Column: Predictions text */}
                      <div className="lg:col-span-7 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-2 select-none">
                          <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border ${
                            pred.type === "Career & Ambition" ? "bg-blue-50 text-blue-700 border-blue-100" :
                            pred.type === "Relationship & Social" ? "bg-pink-50 text-pink-700 border-pink-100" :
                            pred.type === "Financial & Fortune" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            pred.type === "Health & Vitality" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            "bg-purple-50 text-purple-700 border-purple-100"
                          }`}>
                            {pred.type}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1D4046]/50">Confidence:</span>
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${whyDetails.score >= 75 ? 'bg-green-100 text-green-800' : 'bg-[#F59E0B]/10 text-[#F59E0B]'}`}>
                              {whyDetails.score}%
                            </span>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-serif text-2xl md:text-3xl font-bold text-[#1D4046] mb-3">{pred.title}</h3>
                          <p className="text-sm md:text-base text-[#1D4046]/80 leading-relaxed">{pred.description}</p>
                        </div>

                        {/* Summary vs Detailed Toggle sections */}
                        {predictionsViewMode === "detailed" && (
                          <div className="space-y-4 pt-6 border-t border-[#1D4046]/5 bg-[#F9F7F1]/30 p-6 rounded-2xl">
                            <h4 className="text-xs font-extrabold text-[#1D4046] uppercase tracking-wider flex items-center gap-2 select-none">
                              <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" /> Why this prediction?
                            </h4>
                            <div className="space-y-2 text-xs">
                              <p className="font-semibold text-[#1D4046]/60">Breakdown & Key Signals:</p>
                              <ul className="list-disc pl-4 space-y-1 text-[#1D4046]/80 leading-relaxed">
                                {whyDetails.signals.map((sig, sIdx) => (
                                  <li key={sIdx}>{sig}</li>
                                ))}
                              </ul>
                              <div className="flex flex-wrap gap-2 pt-2">
                                {whyDetails.breakdown.map((b, bIdx) => (
                                  <span key={bIdx} className="bg-white/80 border border-[#1D4046]/10 px-2 py-1 rounded text-[10px] font-bold text-[#1D4046]/60">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t border-[#1D4046]/5 text-[10px]">
                              <p className="font-semibold text-[#1D4046]/40 uppercase tracking-widest">Calculation Assumptions & Base Model:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#1D4046]/60">
                                {whyDetails.assumptions.map((ass, aIdx) => (
                                  <div key={aIdx} className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#1D4046]/20" />
                                    <span>{ass}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {pred.contributors.length > 0 && (
                          <div className="pt-4 border-t border-[#1D4046]/5">
                            <div className="text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-wider mb-2 select-none">Astrological Contributors</div>
                            <div className="flex flex-wrap gap-1.5">
                              {pred.contributors.map((contrib, cIdx) => (
                                <span key={cIdx} className="bg-[#1D4046]/5 px-2.5 py-1 text-[10px] font-bold text-[#1D4046]/70 rounded-full select-none">
                                  {contrib}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Mini Supporting Charts displays */}
                      <div className="lg:col-span-5 bg-[#F9F7F1]/30 p-6 rounded-3xl border border-[#1D4046]/5 space-y-6">
                        <div className="flex justify-between items-center pb-2 border-b border-[#1D4046]/10 select-none">
                          <div>
                            <h4 className="text-xs font-bold text-[#1D4046] uppercase tracking-wider">Supporting Reference Charts</h4>
                            <p className="text-[10px] text-[#1D4046]/50">Houses {targetHighlightHouses.join(", ")} Highlighted</p>
                          </div>
                          <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1" role="group" aria-label="Select Prediction Chart Style">
                            {["North", "South"].map(s => (
                              <button
                                key={s}
                                aria-pressed={chartStyle === s}
                                onClick={() => setChartStyle(s as ChartStyle)}
                                className={`px-2.5 py-0.5 text-[10px] rounded transition-all font-semibold ${chartStyle === s ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Natal Supporting Chart */}
                          <div className="space-y-2 relative">
                            <div className="text-center text-[10px] font-extrabold text-[#F59E0B] uppercase tracking-widest">
                              Natal (Rotated)
                            </div>
                            <div className="p-2 bg-white rounded-2xl shadow-sm border border-[#1D4046]/5 hover:scale-[1.02] transition-all cursor-pointer relative group">
                              {predictionNatalChart ? (
                                <div onClick={() => setExpandedChart({ data: predictionNatalChart, title: `Natal: ${pred.type} Supporting Chart`, highlightedHouses: targetHighlightHouses })}>
                                  <KundliChart
                                    data={predictionNatalChart}
                                    style={chartStyle}
                                    highlightedHouses={targetHighlightHouses}
                                  />
                                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                    <span className="text-[10px] bg-white px-2 py-1 rounded shadow text-[#1D4046] font-bold">Maximize Chart</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="aspect-square w-full bg-[#F9F7F1]/20 rounded-xl flex items-center justify-center text-[10px] text-center p-2 text-[#1D4046]/40 font-bold">
                                  No Natal Data
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Transit Supporting Chart */}
                          <div className="space-y-2 relative">
                            <div className="text-center text-[10px] font-extrabold text-[#1D4046]/60 uppercase tracking-widest">
                              Transit (Gochara)
                            </div>
                            <div className="p-2 bg-white rounded-2xl shadow-sm border border-[#1D4046]/5 hover:scale-[1.02] transition-all cursor-pointer relative group">
                              {predictionTransitChart ? (
                                <div onClick={() => setExpandedChart({ data: predictionTransitChart, title: `Transit: ${pred.type} Supporting Chart`, highlightedHouses: targetHighlightHouses })}>
                                  <KundliChart
                                    data={predictionTransitChart}
                                    style={chartStyle}
                                    highlightedHouses={targetHighlightHouses}
                                  />
                                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                    <span className="text-[10px] bg-white px-2 py-1 rounded shadow text-[#1D4046] font-bold">Maximize Chart</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="aspect-square w-full bg-[#F9F7F1]/20 rounded-xl flex items-center justify-center text-[10px] text-center p-2 text-[#1D4046]/40 font-bold">
                                  Calculating...
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
                <section className="bg-white p-8 rounded-[2rem] border border-[#1D4046]/10 shadow-sm space-y-8 select-none">
                    {(() => {
                        const activeDate = getActiveTransitDate();
                        const activeTime = activeDate.getTime();

                        return [
                          { label: "Mahadasha", value: dasha.mahadasha, color: "bg-[#F59E0B]", textColor: "text-[#F59E0B]" },
                          { label: "Antardasha", value: dasha.antardasha, color: "bg-[#1D4046]", textColor: "text-[#1D4046]" },
                          { label: "Pratyantardasha", value: dasha.pratyantardasha, color: "bg-green-600", textColor: "text-green-600" },
                          { label: "Sookshma Dasha", value: dasha.sookshmadasha, color: "bg-teal-500", textColor: "text-teal-600" }
                        ].map((level) => {
                            const start = new Date(level.value.start);
                            const end = new Date(level.value.end);
                            const startTime = start.getTime();
                            const endTime = end.getTime();
                            const totalDuration = endTime - startTime;
                            const elapsed = activeTime - startTime;

                            // Calculate percentage
                            let percentage = 0;
                            if (totalDuration > 0) {
                                percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
                            }

                            // Status badge
                            let status = "Upcoming";
                            let statusBg = "bg-[#1D4046]/5 text-[#1D4046]/50";
                            if (activeTime >= startTime && activeTime <= endTime) {
                                status = "Active";
                                statusBg = "bg-green-100 text-green-800 border border-green-200";
                            } else if (activeTime > endTime) {
                                status = "Completed";
                                statusBg = "bg-gray-100 text-gray-500";
                            }

                            // Duration calculations
                            const totalStr = getDurationString(start, end);
                            const elapsedStr = activeTime > startTime ? getDurationString(start, activeTime > endTime ? end : activeDate) : "0 days";
                            const remainingStr = endTime > activeTime ? getDurationString(activeTime > startTime ? activeDate : start, end) : "0 days";

                            return (
                                <div key={level.label} className="p-6 rounded-2xl border border-[#1D4046]/5 bg-[#F9F7F1]/30 hover:bg-[#F9F7F1]/50 transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest">{level.label}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusBg}`}>{status}</span>
                                            </div>
                                            <h3 className="text-2xl font-serif font-bold text-[#1D4046] mt-1">
                                                <span className={level.textColor}>{level.value.lord}</span> Period
                                            </h3>
                                        </div>
                                        <div className="text-left md:text-right text-xs text-[#1D4046]/60">
                                            <div><span className="font-bold">Range:</span> {start.toLocaleDateString()} &mdash; {end.toLocaleDateString()}</div>
                                            <div className="mt-1 font-medium text-[#1D4046]/40">Total: {totalStr}</div>
                                        </div>
                                    </div>

                                    {/* Progress Bar Container */}
                                    <div className="space-y-2">
                                        <div className="h-2.5 w-full bg-[#F9F7F1] rounded-full overflow-hidden border border-[#1D4046]/5 relative">
                                            <div
                                                className={`h-full ${level.color} transition-all duration-500 rounded-full`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] font-medium text-[#1D4046]/60">
                                            <div>
                                                <span className="text-[#1D4046]/40">Elapsed:</span> {elapsedStr} ({percentage.toFixed(1)}%)
                                            </div>
                                            <div>
                                                <span className="text-[#1D4046]/40">Remaining:</span> {remainingStr}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
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
                {/* Header Banner explaining the page's exact purpose vs Predictions page */}
                <div className="bg-gradient-to-r from-[#1D4046] to-[#142D31] text-white p-8 md:p-10 rounded-[2.5rem] shadow-xl space-y-4 select-none relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                      <Info className="w-6 h-6 text-[#F59E0B]" />
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-white font-bold">Deep Jyotish Diagnostics & Tables</h1>
                      <p className="text-xs font-bold text-white/60 uppercase tracking-[0.2em] mt-1">Analytical Center</p>
                    </div>
                  </div>
                  <p className="text-sm md:text-base text-white/80 max-w-3xl leading-relaxed">
                    Welcome to the Technical Workspace. Unlike the synthesized, domain-specific forecasts on the <strong>Predictions</strong> page, this view provides raw, un-rotated mathematical data strictly aligned to your <strong>Ascendant (Janma Lagna)</strong>. Use this for deep, classic manual analysis across divisional charts, Ashtakavarga matrices, and calculated Upgrahas.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[#F59E0B] font-bold uppercase tracking-wider pt-4 border-t border-white/10">
                    <Info className="w-4 h-4" /> All divisional charts (Natal, Transit, D9, D60) on this tab are strictly aligned to the Lagna reference point.
                  </div>
                </div>

                <header className="flex flex-col md:flex-row justify-between items-center gap-4 select-none">
                    <h2 className="text-2xl font-serif text-[#1D4046] font-bold">Diagnostics Workspace</h2>
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

      {/* Modal for Expanded/Maximized Supporting Charts */}
      {expandedChart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none" onClick={() => setExpandedChart(null)}>
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-[#1D4046]/10 shadow-2xl max-w-lg w-full space-y-6 relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-[#1D4046]/10 pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1D4046]">{expandedChart.title}</h3>
                {expandedChart.highlightedHouses && (
                  <p className="text-[10px] text-[#1D4046]/50 uppercase tracking-wider font-semibold">
                    Highlighted Houses: {expandedChart.highlightedHouses.join(", ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setExpandedChart(null)}
                className="text-xs font-bold bg-[#1D4046]/5 text-[#1D4046]/60 hover:bg-[#1D4046]/10 px-3 py-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
              >
                Close
              </button>
            </div>
            <div className="p-4 bg-[#F9F7F1]/30 rounded-2xl border border-[#1D4046]/5">
              <KundliChart
                data={expandedChart.data}
                style={chartStyle}
                highlightedHouses={expandedChart.highlightedHouses}
              />
            </div>
          </div>
        </div>
      )}

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
