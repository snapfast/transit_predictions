"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { calculateTransits, PlanetData, DivisionalChartData } from "@/lib/astrology";
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
          { signal: controller.signal }
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

        const date = new Date(year, month - 1, day, hour, minute);

        if (isNaN(date.getTime())) return;

        const { planets: p, d1 } = calculateTransits(date, lat, lon);
        queueMicrotask(() => {
          setPlanets(p);
          setChartData(d1);
        });
      } catch (e) {
        console.error("Failed to calculate transits", e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [dateStr, timeStr, lat, lon]);

  return (
    <main className="min-h-screen bg-orange-50/50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-orange-900">Vedic Transits Dashboard</h1>
          <p className="text-orange-700/80">Real-time planetary positions including upgrahas and outer planets.</p>
        </header>

        {/* Controls Section */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex flex-wrap gap-6 items-end justify-center">
          <div className="space-y-2 flex-1 min-w-[200px] relative" ref={suggestionRef}>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2" htmlFor="pob-input">
              <MapPin className="w-4 h-4 text-orange-600"/> City
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
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                placeholder="City, Country"
                type="text"
                autoComplete="off"
                maxLength={100}
                aria-autocomplete="list"
                aria-activedescendant={activeSuggestionIndex >= 0 ? `suggestion-option-${activeSuggestionIndex}` : undefined}
              />
            </div>

            {showSuggestions && (suggestions.length > 0 || isLoading) && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-orange-100 rounded-lg shadow-lg overflow-hidden">
                {isLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Searching cities...</div>
                ) : (
                  <ul id="suggestions-listbox" role="listbox" className="max-h-60 overflow-y-auto">
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
                          className={`w-full text-left px-4 py-2 text-sm text-gray-700 transition-colors ${index === activeSuggestionIndex ? 'bg-orange-50' : 'hover:bg-orange-50'}`}
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
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600"/> Date
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600"/> Time
            </label>
            <input
              type="time"
              value={timeStr}
              onChange={e => setTimeStr(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[150px]">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600"/> Latitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={lat}
              onChange={e => {
                setLat(parseFloat(e.target.value) || 0);
              }}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[150px]">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600"/> Longitude
            </label>
            <input
              type="number"
              step="0.0001"
              value={lon}
              onChange={e => {
                setLon(parseFloat(e.target.value) || 0);
              }}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-8 items-start">

          {/* Chart Section */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-800 text-center">Transit Chart (D1)</h2>
            {chartData ? <KundliChart data={chartData} /> : <div className="animate-pulse h-[400px] bg-gray-100 rounded-lg"></div>}
            <div className="mt-4 text-center text-sm text-gray-500">
              * denotes retrograde motion
            </div>
          </section>

          {/* Table Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-orange-50/80 text-orange-900 border-b border-orange-100">
                    <th className="p-4 font-semibold text-sm">Planet</th>
                    <th className="p-4 font-semibold text-sm">Sign</th>
                    <th className="p-4 font-semibold text-sm">Degree</th>
                    <th className="p-4 font-semibold text-sm">Nakshatra</th>
                    <th className="p-4 font-semibold text-sm text-center">House</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {planets.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center gap-2">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.isRetrograde && <span className="text-xs font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded" title="Retrograde">R</span>}
                      </td>
                      <td className="p-4 text-gray-600">{p.rasi}</td>
                      <td className="p-4 text-gray-600 font-mono text-sm">{p.degree}</td>
                      <td className="p-4 text-gray-600">{p.nakshatra}</td>
                      <td className="p-4 text-center text-gray-900 font-medium">{p.house}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
