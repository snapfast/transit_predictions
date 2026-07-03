"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { calculateTransits, PlanetData, DivisionalChartData, Predictions, DashaInfo, SadeSatiInfo, Remedy } from "@/lib/astrology";
import KundliChart from "@/components/KundliChart";
import { Clock, MapPin, Calendar } from "lucide-react";

interface Suggestion {
  name: string;
  lat: string;
  lon: string;
}

const SUGGESTIONS_CACHE = new Map<string, Suggestion[]>();
const MAX_CACHE_SIZE = 100;

export default function Home() {
  const [dateStr, setDateStr] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [lat, setLat] = useState<number>(28.6139);
  const [lon, setLon] = useState<number>(77.2090);
  const [pob, setPob] = useState<string>("New Delhi, Delhi, India");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [chartData, setChartData] = useState<DivisionalChartData | null>(null);
  const [d9Data, setD9Data] = useState<DivisionalChartData | null>(null);
  const [d60Data, setD60Data] = useState<DivisionalChartData | null>(null);
  const [predictions, setPredictions] = useState<Predictions>({ placements: [], aspects: [] });
  const [dasha, setDasha] = useState<DashaInfo | undefined>(undefined);
  const [sadeSati, setSadeSati] = useState<SadeSatiInfo | undefined>(undefined);
  const [gocharaScore, setGocharaScore] = useState<number>(50);
  const [remedies, setRemedies] = useState<Remedy[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [scrubDays, setScrubDays] = useState<number>(0);

  useEffect(() => {
    // Initialize with current date/time on client (use a microtask to avoid cascading renders)
    queueMicrotask(() => {
      const now = new Date();
      setDateStr(now.toISOString().split("T")[0]);
      setTimeStr(now.toTimeString().slice(0, 5));
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const query = pob.trim();
    const cacheKey = query.toLowerCase();

    if (query.length < 3 || query.length > 100) {
      queueMicrotask(() => setSuggestions([]));
      return;
    }

    const cached = SUGGESTIONS_CACHE.get(cacheKey);
    if (cached) {
      SUGGESTIONS_CACHE.delete(cacheKey);
      SUGGESTIONS_CACHE.set(cacheKey, cached);
      queueMicrotask(() => setSuggestions(cached));
      return;
    }

    const controller = new AbortController();

    const fetchCities = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&featuretype=city`,
          {
            signal: controller.signal,
            headers: {
              'User-Agent': 'vedic-dashboard/0.1.0'
            }
          }
        );
        const data = await response.json();

        interface NominatimAddress {
          city?: string;
          town?: string;
          village?: string;
          suburb?: string;
          hamlet?: string;
          state?: string;
          country?: string;
        }
        interface NominatimItem {
          address: NominatimAddress;
          display_name: string;
          lat: string;
          lon: string;
        }

        const uniqueCitiesMap = data.reduce((map: Map<string, Suggestion>, item: NominatimItem) => {
          const { address, lat, lon, display_name } = item;
          const city = address.city || address.town || address.village || address.suburb || address.hamlet;
          const { state, country } = address;
          const name = city ? `${city}${state ? `, ${state}` : ''}, ${country}` : display_name;

          map.set(name, { name, lat, lon });
          return map;
        }, new Map<string, Suggestion>());

        const uniqueCities: Suggestion[] = Array.from(uniqueCitiesMap.values());

        if (SUGGESTIONS_CACHE.has(cacheKey)) {
          SUGGESTIONS_CACHE.delete(cacheKey);
        } else if (SUGGESTIONS_CACHE.size >= MAX_CACHE_SIZE) {
          const firstKey = SUGGESTIONS_CACHE.keys().next().value;
          if (firstKey !== undefined) SUGGESTIONS_CACHE.delete(firstKey);
        }
        SUGGESTIONS_CACHE.set(cacheKey, uniqueCities);

        setSuggestions(uniqueCities);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error fetching cities:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchCities, 500);
    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [pob]);

  const handleSuggestionKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      const suggestion = suggestions[activeSuggestionIndex];
      setPob(suggestion.name);
      setLat(parseFloat(suggestion.lat));
      setLon(parseFloat(suggestion.lon));
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    if (!dateStr || !timeStr) return;

    const timer = setTimeout(() => {
      try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);

        let date = new Date(year, month - 1, day, hour, minute);
        if (scrubDays !== 0) {
          date = new Date(date.getTime() + scrubDays * 24 * 60 * 60 * 1000);
        }

        if (isNaN(date.getTime())) return;

        const birthDetails = { date: new Date(year, month - 1, day, hour, minute), lat, lon };

        const { planets: p, d1, d9, d60, predictions: preds, dasha: d, sadeSati: ss, gocharaScore: gs, remedies: rems } = calculateTransits(date, lat, lon, birthDetails);
        queueMicrotask(() => {
          setPlanets(p);
          setChartData(d1);
          setD9Data(d9);
          setD60Data(d60);
          setPredictions(preds);
          setDasha(d);
          setSadeSati(ss);
          setGocharaScore(gs);
          setRemedies(rems);
        });
      } catch (e) {
        console.error("Failed to calculate transits", e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [dateStr, timeStr, lat, lon, scrubDays]);

  return (
    <main className="min-h-screen flex flex-col pb-20">
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {/* Global Controls Section - Moved Outside Tabs */}
        <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155] flex flex-wrap gap-6 items-end justify-center backdrop-blur-sm bg-opacity-80">
          <div className="space-y-2 flex-1 min-w-[200px] relative" ref={suggestionRef}>
            <label className="text-sm font-medium text-[#94A3B8] flex items-center gap-2" htmlFor="pob-input">
              <MapPin className="w-4 h-4 text-[#F59E0B]"/> City
            </label>
            <div role="combobox" aria-expanded={showSuggestions && (suggestions.length > 0 || isLoading)} aria-haspopup="listbox" aria-controls="suggestions-listbox">
              <input
                id="pob-input"
                name="pob"
                value={pob}
                onChange={(e) => {
                  setPob(e.target.value);
                  setShowSuggestions(true);
                  setActiveSuggestionIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSuggestionKeyDown}
                className="w-full p-2 bg-[#1E293B] border border-[#334155] rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none text-[#F1F5F9]"
                placeholder="City, Country"
                type="text"
                autoComplete="off"
                maxLength={100}
                aria-autocomplete="list"
                aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-option-${activeSuggestionIndex}` : undefined}
              />
            </div>

            {showSuggestions && (suggestions.length > 0 || isLoading) && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl overflow-hidden">
                {isLoading ? (
                  <div className="px-4 py-3 text-sm text-[#94A3B8]">Searching cities...</div>
                ) : (
                  <ul id="suggestions-listbox" role="listbox" className="max-h-60 overflow-y-auto custom-scrollbar">
                    {suggestions.map((suggestion, index) => (
                      <li key={index} id={`suggestion-option-${index}`} role="option" aria-selected={index === activeSuggestionIndex}>
                        <button
                          type="button"
                          onClick={() => {
                            setPob(suggestion.name);
                            setLat(parseFloat(suggestion.lat));
                            setLon(parseFloat(suggestion.lon));
                            setShowSuggestions(false);
                            setActiveSuggestionIndex(-1);
                          }}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          className={`w-full text-left px-4 py-2 text-sm text-[#F1F5F9] transition-colors ${index === activeSuggestionIndex ? 'bg-[#334155]' : 'hover:bg-[#334155]'}`}
                        >
                          {suggestion.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-[#94A3B8] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#F59E0B]"/> Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="w-full p-2 bg-[#1E293B] border border-[#334155] rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none text-[#F1F5F9]"
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-[#94A3B8] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F59E0B]"/> Time
            </label>
            <input
              type="time"
              value={timeStr}
              onChange={e => setTimeStr(e.target.value)}
              className="w-full p-2 bg-[#1E293B] border border-[#334155] rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none text-[#F1F5F9]"
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[150px] hidden md:block">
            <label className="text-sm font-medium text-[#94A3B8] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F59E0B]"/> Latitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={e => {
                setLat(parseFloat(e.target.value) || 0);
              }}
              className="w-full p-2 bg-[#1E293B] border border-[#334155] rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none text-[#F1F5F9]"
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[150px] hidden md:block">
            <label className="text-sm font-medium text-[#94A3B8] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F59E0B]"/> Longitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={lon}
              onChange={e => {
                setLon(parseFloat(e.target.value) || 0);
              }}
              className="w-full p-2 bg-[#1E293B] border border-[#334155] rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none text-[#F1F5F9]"
            />
          </div>
        </section>

        {/* Main Content Area based on Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-serif text-[#F59E0B]">Dashboard</h1>
              <div className="flex items-center gap-4">
                <div className="text-sm px-3 py-1 bg-[#1E293B] rounded-full text-[#94A3B8] border border-[#334155]">Lahiri Ayanamsa</div>
                <div className="w-10 h-10 rounded-full bg-[#334155] border-2 border-[#F59E0B] flex items-center justify-center text-sm font-bold">JD</div>
              </div>
            </header>

            {/* Gochara Score Hero Section */}
            <section className="flex flex-col items-center justify-center p-8 bg-gradient-to-b from-[#111827] to-[#0B0F19] rounded-3xl border border-[#334155] shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1E293B]/50 via-transparent to-transparent"></div>

              <div className="relative z-10 flex flex-col items-center">
                <div className="text-[#94A3B8] font-medium mb-4 uppercase tracking-widest text-sm">Gochara Score</div>

                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1E293B" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="45" fill="none"
                      stroke="#F59E0B" strokeWidth="8"
                      strokeDasharray="283"
                      strokeDashoffset={283 - (283 * gocharaScore) / 100}
                      className="transition-all duration-1000 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-5xl font-serif font-bold text-[#F1F5F9]">{gocharaScore}<span className="text-2xl text-[#94A3B8]">%</span></span>
                    <span className={`text-xs mt-1 font-medium flex items-center gap-1 ${gocharaScore >= 50 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {gocharaScore >= 50 ? (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg> Positive</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg> Challenging</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center text-center">
                  {dasha && (
                    <div className="text-lg text-[#F1F5F9] font-medium">Active Dasha: <span className="text-[#F59E0B] font-serif">{dasha.mahadasha.lord} / {dasha.antardasha.lord}</span></div>
                  )}
                  <p className="text-sm text-[#94A3B8] mt-2 max-w-xs">
                    {gocharaScore >= 70 ? "Transits are highly supportive of your goals." :
                     gocharaScore >= 50 ? "Transits are generally stable and balanced." :
                     "Transits may require extra effort and patience."}
                  </p>
                </div>
              </div>
            </section>

          {/* Transit Weather Report Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-[#111827] p-6 rounded-2xl border border-[#334155] shadow-lg relative overflow-hidden group hover:border-[#F59E0B]/50 transition-colors">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -z-10 group-hover:bg-blue-500/20 transition-colors"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-serif text-[#F1F5F9] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Saturn in 10th House
                </h3>
                <span className="px-2 py-1 bg-[#1E293B] text-xs font-medium text-[#94A3B8] rounded border border-[#334155]">Kumbha (Aquarius)</span>
              </div>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-4">
                High career focus and heavy workload. Professional responsibilities demand strict discipline. Avoid shortcuts; karma is being closely monitored.
              </p>
              <div className="flex items-center gap-4 text-xs font-medium text-[#64748B]">
                <div className="flex items-center gap-1"><span className="text-[#10B981]">↑</span> Ashtakavarga: 5</div>
                <div className="flex items-center gap-1 text-[#F59E0B]">No Vedha</div>
              </div>
            </section>

            <section className="bg-[#111827] p-6 rounded-2xl border border-[#334155] shadow-lg relative overflow-hidden group hover:border-[#F59E0B]/50 transition-colors">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-bl-full -z-10 group-hover:bg-yellow-500/20 transition-colors"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-serif text-[#F1F5F9] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  Jupiter in 2nd House
                </h3>
                <span className="px-2 py-1 bg-[#1E293B] text-xs font-medium text-[#94A3B8] rounded border border-[#334155]">Vrishabha (Taurus)</span>
              </div>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-4">
                Expansion in wealth and family matters. Speech becomes philosophical and impactful. Excellent period for long-term investments.
              </p>
              <div className="flex items-center gap-4 text-xs font-medium text-[#64748B]">
                <div className="flex items-center gap-1"><span className="text-[#10B981]">↑</span> Ashtakavarga: 6</div>
                <div className="flex items-center gap-1 text-[#EF4444]">Vedha from Sun</div>
              </div>
            </section>
          </div>

          {/* Sade Sati Dashboard */}
          {sadeSati?.isActive ? (
            <section className="bg-gradient-to-r from-[#1E293B] to-[#111827] p-6 rounded-2xl border border-[#334155] shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-serif text-[#F1F5F9]">Sade Sati Tracker</h3>
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30 animate-pulse">ACTIVE</span>
                </div>
                <p className="text-[#94A3B8] text-sm mb-4">You are currently in the <strong>{sadeSati.phase} Phase</strong> of Sade Sati.</p>

                <div className="w-full bg-[#0B0F19] rounded-full h-2.5 mb-2 border border-[#334155]">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-2.5 rounded-full" style={{ width: sadeSati.phase === 'Rising' ? '33%' : sadeSati.phase === 'Peak' ? '66%' : '100%' }}></div>
                </div>
                <div className="flex justify-between text-xs text-[#64748B] font-medium">
                  <span className={sadeSati.phase === 'Rising' ? 'text-[#F1F5F9]' : ''}>Rising</span>
                  <span className={sadeSati.phase === 'Peak' ? 'text-[#F1F5F9]' : ''}>Peak</span>
                  <span className={sadeSati.phase === 'Setting' ? 'text-[#F1F5F9]' : ''}>Setting</span>
                </div>
              </div>
              <div className="w-full md:w-auto bg-[#0B0F19] p-4 rounded-xl border border-[#334155] flex flex-col items-center justify-center">
                <span className="text-xs text-[#94A3B8] mb-1 uppercase tracking-wider">Primary Upaya</span>
                <span className="text-sm font-medium text-[#F59E0B] text-center">Hanuman Chalisa<br/>(Daily at Sunset)</span>
              </div>
            </section>
          ) : (
            <section className="bg-[#111827] p-6 rounded-2xl border border-[#334155] shadow-lg text-center">
               <h3 className="text-xl font-serif text-[#F1F5F9] mb-2">Sade Sati Status</h3>
               <p className="text-[#10B981] font-medium">You are not currently under the influence of Sade Sati.</p>
            </section>
          )}

          </div>
        )}

        {/* Tab 2: Timeline */}
        {activeTab === "timeline" && (
          <div className="space-y-8">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-serif text-[#F59E0B]">Interactive Timeline</h1>
            </header>

            <section className="bg-[#111827] p-8 rounded-2xl border border-[#334155] shadow-lg space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-serif text-[#F1F5F9]">Transit Scrubber</h3>
                <span className="text-[#F59E0B] font-mono">{scrubDays > 0 ? `+${scrubDays}` : scrubDays} days</span>
              </div>

              <input
                type="range"
                min="-30"
                max="30"
                value={scrubDays}
                onChange={(e) => setScrubDays(parseInt(e.target.value))}
                className="w-full h-2 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
              />

              <div className="flex justify-between text-xs text-[#94A3B8] font-medium uppercase tracking-wider">
                <span>-30 Days</span>
                <span>Today</span>
                <span>+30 Days</span>
              </div>

              <div className="pt-4 border-t border-[#334155] flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-[#1E293B] p-4 rounded-xl border border-[#334155]">
                  <div className="text-sm text-[#94A3B8] mb-1">Gochara Score at Selected Time</div>
                  <div className="text-3xl font-serif text-[#F1F5F9]">{gocharaScore}%</div>
                </div>
                <div className="flex-1 bg-[#1E293B] p-4 rounded-xl border border-[#334155]">
                  <div className="text-sm text-[#94A3B8] mb-1">Status</div>
                  <div className={`text-xl font-medium ${gocharaScore >= 50 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {gocharaScore >= 70 ? 'Highly Auspicious' : gocharaScore >= 50 ? 'Favorable' : 'Caution Advised'}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155]">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9] text-center">Transit Chart (D1)</h2>
                {chartData ? <KundliChart data={chartData} /> : <div className="animate-pulse h-[300px] bg-[#1E293B] rounded-lg border border-[#334155]"></div>}
              </section>

              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155] h-full">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9]">Predictions for this period</h2>
                <ul className="space-y-4">
                  {predictions.placements.slice(0, 5).map((pred, i) => (
                    <li key={i} className="flex gap-3 text-[#94A3B8] text-sm leading-relaxed">
                      <span className="text-[#F59E0B] flex-shrink-0">✦</span>
                      <p>{pred}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* Tab 3 Placeholder */}
        {activeTab === "charts" && (
          <div className="space-y-8">
            <header className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-serif text-[#F59E0B]">Deep Jyotish View</h1>
            </header>

            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8 items-start">
              {/* D1 Chart Section */}
              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155]">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9] text-center">Transit Chart (D1)</h2>
                {chartData ? <KundliChart data={chartData} /> : <div className="animate-pulse h-[300px] bg-[#1E293B] rounded-lg border border-[#334155]"></div>}
                <div className="mt-4 text-center text-sm text-[#94A3B8]">
                  * denotes retrograde motion
                </div>
              </section>

              {/* D9 Chart Section */}
              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155]">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9] text-center">Navamsa Chart (D9)</h2>
                {d9Data ? <KundliChart data={d9Data} /> : <div className="animate-pulse h-[300px] bg-[#1E293B] rounded-lg border border-[#334155]"></div>}
                <div className="mt-4 text-center text-sm text-[#94A3B8]">
                  * denotes retrograde motion
                </div>
              </section>

              {/* D60 Chart Section */}
              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155]">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9] text-center">Shashtiamsa Chart (D60)</h2>
                {d60Data ? <KundliChart data={d60Data} /> : <div className="animate-pulse h-[300px] bg-[#1E293B] rounded-lg border border-[#334155]"></div>}
                <div className="mt-4 text-center text-sm text-[#94A3B8]">
                  * denotes retrograde motion
                </div>
              </section>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Table Section */}
              <section className="bg-[#111827] rounded-2xl shadow-lg border border-[#334155] overflow-hidden md:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1E293B] text-[#F59E0B] border-b border-[#334155]">
                        <th className="p-4 font-semibold text-sm">Planet</th>
                        <th className="p-4 font-semibold text-sm">Sign</th>
                        <th className="p-4 font-semibold text-sm">Degree</th>
                        <th className="p-4 font-semibold text-sm">Nakshatra</th>
                        <th className="p-4 font-semibold text-sm text-center">House</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]">
                      {planets.map((p, i) => (
                        <tr key={i} className="hover:bg-[#1E293B]/50 transition-colors">
                          <td className="p-4 flex items-center gap-2">
                            <span className="font-medium text-[#F1F5F9]">{p.name}</span>
                            {p.isRetrograde && <span className="text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded border border-[#F59E0B]/20" title="Retrograde">R</span>}
                          </td>
                          <td className="p-4 text-[#94A3B8]">{p.rasi}</td>
                          <td className="p-4 text-[#94A3B8] font-mono text-sm">{p.degree}</td>
                          <td className="p-4 text-[#94A3B8]">{p.nakshatra}</td>
                          <td className="p-4 text-center text-[#F1F5F9] font-medium">{p.house}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Predictions Section - Placements */}
              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155]">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9]">Planetary Placements (from Moon)</h2>
                {predictions.placements.length > 0 ? (
                  <ul className="space-y-4">
                    {predictions.placements.map((pred, i) => (
                      <li key={i} className="flex gap-3 text-[#94A3B8] leading-relaxed">
                        <span className="text-[#F59E0B] flex-shrink-0 mt-1">✨</span>
                        <p>{pred}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="animate-pulse h-[200px] bg-[#1E293B] rounded-lg border border-[#334155]"></div>
                )}
              </section>

              {/* Predictions Section - Aspects */}
              <section className="bg-[#111827] p-6 rounded-2xl shadow-lg border border-[#334155]">
                <h2 className="text-xl font-serif mb-6 text-[#F1F5F9]">Planetary Aspects (from Moon)</h2>
                {predictions.aspects.length > 0 ? (
                  <ul className="space-y-4">
                    {predictions.aspects.map((pred, i) => (
                      <li key={i} className="flex gap-3 text-[#94A3B8] leading-relaxed">
                        <span className="text-[#F59E0B] flex-shrink-0 mt-1">🔭</span>
                        <p>{pred}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="animate-pulse h-[200px] bg-[#1E293B] rounded-lg border border-[#334155]"></div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* Tab 4: Remedies & Dasha */}
        {activeTab === "remedies" && (
          <div className="space-y-8">
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-serif text-[#F59E0B]">Upayas & Dasha</h1>
            </header>

            {/* Dasha Timeline */}
            {dasha && (
              <section className="bg-[#111827] p-6 rounded-2xl border border-[#334155] shadow-lg">
                <h3 className="text-xl font-serif text-[#F1F5F9] mb-6">Active Vimshottari Dasha</h3>
                <div className="space-y-6">
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-[#F59E0B] bg-[#F59E0B]/10">
                          Mahadasha: {dasha.mahadasha.lord}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-[#94A3B8]">
                          Ends {new Date(dasha.mahadasha.end).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#1E293B] border border-[#334155]">
                      <div style={{ width: "60%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#F59E0B]"></div>
                    </div>
                  </div>

                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-400 bg-blue-400/10">
                          Antardasha: {dasha.antardasha.lord}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-[#94A3B8]">
                          Ends {new Date(dasha.antardasha.end).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[#1E293B] border border-[#334155]">
                      <div style={{ width: "40%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Remedies Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {remedies.map((remedy, i) => (
                <section key={i} className="bg-[#111827] p-6 rounded-2xl border border-[#334155] shadow-lg group hover:border-[#F59E0B]/50 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-serif text-[#F1F5F9]">{remedy.planet} Upaya</h3>
                    <span className="text-xs text-[#94A3B8] bg-[#1E293B] px-2 py-1 rounded border border-[#334155]">{remedy.condition}</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-[#F59E0B] font-bold mb-1">Mantra</div>
                      <p className="text-sm text-[#F1F5F9] italic font-serif">&quot;{remedy.mantra}&quot;</p>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-1">Charity (Daan)</div>
                      <p className="text-sm text-[#94A3B8]">{remedy.charity}</p>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">Lifestyle</div>
                      <p className="text-sm text-[#94A3B8]">{remedy.lifestyle}</p>
                    </div>
                  </div>
                </section>
              ))}

              {remedies.length === 0 && (
                <div className="col-span-full py-12 text-center text-[#94A3B8]">
                  No specific remedies found for current transits. Maintaining a balanced lifestyle is recommended.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-[#334155] px-6 py-3 flex justify-between items-center z-50">
        <button onClick={() => setActiveTab("dashboard")} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          <span className="text-xs">Dashboard</span>
        </button>
        <button onClick={() => setActiveTab("timeline")} className={`flex flex-col items-center gap-1 ${activeTab === 'timeline' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="text-xs">Timeline</span>
        </button>
        <button onClick={() => setActiveTab("charts")} className={`flex flex-col items-center gap-1 ${activeTab === 'charts' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
          <span className="text-xs">Charts</span>
        </button>
        <button onClick={() => setActiveTab("remedies")} className={`flex flex-col items-center gap-1 ${activeTab === 'remedies' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
          <span className="text-xs">Upayas</span>
        </button>
      </div>
    </main>
  );
}
