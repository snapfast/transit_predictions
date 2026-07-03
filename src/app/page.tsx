"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { calculateTransits, PlanetData, DivisionalChartData, Predictions, DashaInfo, SadeSatiInfo, Remedy, AyanamsaType, AshtakavargaData } from "@/lib/astrology";
import KundliChart, { ChartStyle } from "@/components/KundliChart";
import { Clock, MapPin, Calendar, Sun, Moon, Info, Sparkles } from "lucide-react";

interface Suggestion { name: string; lat: string; lon: string; }
const SUGGESTIONS_CACHE = new Map<string, Suggestion[]>();

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
  const [predictions, setPredictions] = useState<Predictions>({ placements: [], aspects: [], yogas: [] });
  const [dasha, setDasha] = useState<DashaInfo | undefined>(undefined);
  const [sadeSati, setSadeSati] = useState<SadeSatiInfo | undefined>(undefined);
  const [natalChart, setNatalChart] = useState<DivisionalChartData | null>(null);
  const [gocharaScore, setGocharaScore] = useState<number>(50);
  const [timelineScores, setTimelineScores] = useState<number[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<Array<{ day: number, label: string }>>([]);
  const [ashtakavarga, setAshtakavarga] = useState<AshtakavargaData | undefined>(undefined);
  const [remedies, setRemedies] = useState<Remedy[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [ayanamsa, setAyanamsa] = useState<AyanamsaType>("Lahiri");
  const [referencePoint, setReferencePoint] = useState<"Moon" | "Lagna" | "Dasha Lord">("Moon");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("North");
  const [scrubDays, setScrubDays] = useState<number>(0);

  useEffect(() => {
    queueMicrotask(() => {
      const now = new Date();
      // Use local date parts to prevent timezone shifts (e.g., getting yesterday's date in UTC)
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      setDateStr(`${year}-${month}-${day}`);
      setTimeStr(`${hours}:${minutes}`);
    });
  }, []);

  // City Search logic
  useEffect(() => {
    if (pob.length < 3) {
      queueMicrotask(() => setSuggestions([]));
      return;
    }

    if (SUGGESTIONS_CACHE.has(pob)) {
      queueMicrotask(() => setSuggestions(SUGGESTIONS_CACHE.get(pob)!));
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pob)}&limit=5`,
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

        SUGGESTIONS_CACHE.set(pob, results);
        if (SUGGESTIONS_CACHE.size > 100) {
          const firstKey = SUGGESTIONS_CACHE.keys().next().value;
          if (firstKey) SUGGESTIONS_CACHE.delete(firstKey);
        }
        setSuggestions(results);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pob]);

  useEffect(() => {
    if (!dateStr || !timeStr) return;

    const timer = setTimeout(() => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);

      const birthDate = new Date(y, m - 1, d, h, min);
      let calculationDate = new Date(birthDate);
      if (scrubDays !== 0) {
        calculationDate = new Date(calculationDate.getTime() + scrubDays * 24 * 60 * 60 * 1000);
      }

      const birthDetails = { date: birthDate, lat, lon };

      let refPlanetName: string = referencePoint === "Moon" ? "Moon" : "Ascendant";
      if (referencePoint === "Dasha Lord") {
        const { dasha: initialDasha } = calculateTransits(calculationDate, lat, lon, birthDetails, ayanamsa);
        if (initialDasha) {
          refPlanetName = initialDasha.mahadasha.lord;
        }
      }

      const res = calculateTransits(calculationDate, lat, lon, birthDetails, ayanamsa, refPlanetName);

      // Calculate timeline scores and events (Optimized: No birthDetails to skip redundant heavy logic)
      const scores: number[] = [];
      const events: Array<{ day: number, label: string }> = [];
      const startTime = new Date(calculationDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const lastPositions: {[key: string]: string} = {};

      for (let i = 0; i <= 60; i++) {
        const d = new Date(startTime.getTime() + i * 24 * 60 * 60 * 1000);
        // By omitting birthDetails here, calculateTransits skips Dasha, Sade Sati, and Ashtakavarga recursions
        const t = calculateTransits(d, lat, lon, undefined, ayanamsa, refPlanetName);

        if (i % 2 === 0) {
          scores.push(t.gocharaScore);
        }

        t.planets.forEach(p => {
          if (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(p.name)) {
            if (lastPositions[p.name] && lastPositions[p.name] !== p.rasi) {
              events.push({ day: i - 30, label: `${p.name} enters ${p.rasi}` });
            }
            lastPositions[p.name] = p.rasi;
          }
        });
      }

      queueMicrotask(() => {
        setPlanets(res.planets);
        setChartData(res.d1);
        setD9Data(res.d9);
        setD60Data(res.d60);
        setPredictions(res.predictions);
        setDasha(res.dasha);
        setSadeSati(res.sadeSati);
        setGocharaScore(res.gocharaScore);
        setTimelineScores(scores);
        setTimelineEvents(events);
        setAshtakavarga(res.ashtakavarga);
        setRemedies(res.remedies);

        if (birthDetails) {
            const natal = calculateTransits(birthDetails.date, birthDetails.lat, birthDetails.lon);
            setNatalChart(natal.d1);
        }
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [dateStr, timeStr, lat, lon, scrubDays, ayanamsa, referencePoint]);

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
      setPob(s.name);
      setLat(parseFloat(s.lat));
      setLon(parseFloat(s.lon));
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <main className="min-h-screen flex flex-col pb-20 bg-[#F9F7F1] text-[#1D4046] font-sans">
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-[#1D4046]/10 flex flex-col md:flex-row gap-6 items-end justify-center">
          <div className="space-y-2 flex-1 min-w-[200px] relative" ref={suggestionRef}>
            <label className="text-sm font-semibold text-[#1D4046]/60 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F59E0B]"/> City
            </label>
            <div className="relative">
              <input
                value={pob}
                onChange={e => { setPob(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                className="w-full p-2 bg-[#F9F7F1] border border-[#1D4046]/20 rounded-lg outline-none focus:ring-1 focus:ring-[#F59E0B]"
                placeholder="Search city..."
              />
              {isLoading && <div className="absolute right-3 top-2.5 animate-spin w-4 h-4 border-2 border-[#F59E0B] border-t-transparent rounded-full" />}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-[#1D4046]/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPob(s.name);
                      setLat(parseFloat(s.lat));
                      setLon(parseFloat(s.lon));
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    onMouseEnter={() => setActiveSuggestionIndex(i)}
                    className={`w-full text-left px-4 py-3 text-sm border-b border-[#1D4046]/5 last:border-0 transition-colors ${i === activeSuggestionIndex ? 'bg-[#F59E0B]/10 text-[#F59E0B] font-bold' : 'text-[#1D4046]/80 hover:bg-[#F9F7F1]'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <div className="space-y-2 flex-1 min-w-[80px]">
              <label className="text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-widest">Lat</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={e => setLat(parseFloat(e.target.value))}
                className="w-full p-2 bg-[#F9F7F1] border border-[#1D4046]/20 rounded-lg outline-none text-sm"
              />
            </div>
            <div className="space-y-2 flex-1 min-w-[80px]">
              <label className="text-[10px] font-bold text-[#1D4046]/40 uppercase tracking-widest">Lon</label>
              <input
                type="number"
                step="any"
                value={lon}
                onChange={e => setLon(parseFloat(e.target.value))}
                className="w-full p-2 bg-[#F9F7F1] border border-[#1D4046]/20 rounded-lg outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 flex-1 min-w-[140px]">
            <label className="text-sm font-semibold text-[#1D4046]/60 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#F59E0B]"/> Date</label>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-full p-2 bg-[#F9F7F1] border border-[#1D4046]/20 rounded-lg outline-none" />
          </div>
          <div className="space-y-2 flex-1 min-w-[120px]">
            <label className="text-sm font-semibold text-[#1D4046]/60 flex items-center gap-2"><Clock className="w-4 h-4 text-[#F59E0B]"/> Time</label>
            <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} className="w-full p-2 bg-[#F9F7F1] border border-[#1D4046]/20 rounded-lg outline-none" />
          </div>
        </section>

        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h1 className="text-4xl font-serif text-[#1D4046] tracking-tight">Dashboard</h1>
              <div className="flex flex-wrap gap-4">
                <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm">
                  {["Lahiri", "Raman", "Fagan-Bradley"].map(a => <button key={a} onClick={() => setAyanamsa(a as AyanamsaType)} className={`px-3 py-1 text-xs rounded-md transition-all ${ayanamsa === a ? 'bg-[#F59E0B] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{a}</button>)}
                </div>
                <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm">
                  {["Moon", "Lagna", "Dasha Lord"].map(r => <button key={r} onClick={() => setReferencePoint(r as "Moon" | "Lagna" | "Dasha Lord")} className={`px-3 py-1 text-xs rounded-md transition-all ${referencePoint === r ? 'bg-[#1D4046] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{r}</button>)}
                </div>
              </div>
            </header>

            <section className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-[#1D4046]/10 shadow-xl relative overflow-hidden">
                {sadeSati?.isActive && (
                    <div className="absolute top-4 right-4 animate-pulse flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                        <span className="w-2 h-2 bg-red-600 rounded-full" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sade Sati: {sadeSati.phase}</span>
                    </div>
                )}
                <div className="text-[#1D4046]/40 font-bold mb-6 uppercase tracking-widest text-xs">Gochara Strength</div>
                <div className="relative w-56 h-56 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#F9F7F1" strokeWidth="8" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * gocharaScore) / 100} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className="text-6xl font-serif font-bold text-[#1D4046]">{gocharaScore.toFixed(1)}<span className="text-2xl text-[#1D4046]/40">%</span></span>
                        <span className={`text-xs mt-2 font-bold px-3 py-1 rounded-full ${gocharaScore >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{gocharaScore >= 50 ? 'AUSPICIOUS' : 'CHALLENGING'}</span>
                    </div>
                </div>
                {dasha && <div className="mt-10 text-xl text-[#1D4046] font-serif border-t border-[#1D4046]/5 pt-6 w-full text-center">Active Dasha: <span className="font-bold text-[#F59E0B]">{dasha.mahadasha.lord} / {dasha.antardasha.lord} / {dasha.pratyantardasha.lord}</span></div>}
            </section>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {planets.filter(p => ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(p.name)).map((p, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-[#1D4046]/10 shadow-sm hover:shadow-md transition-all border-l-4 border-l-[#F59E0B]">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-serif text-lg font-bold">{p.name} in {p.house}{p.house === 1 ? 'st' : p.house === 2 ? 'nd' : p.house === 3 ? 'rd' : 'th'} House</h3>
                            <span className="text-[10px] font-bold bg-[#F9F7F1] px-2 py-1 rounded border border-[#1D4046]/10 uppercase">{p.rasi}</span>
                        </div>
                        <p className="text-sm text-[#1D4046]/80 leading-relaxed mb-4">{predictions.placements.find(pr => pr.startsWith(p.name))?.split(': ')[1] || 'Analyzing transit impact...'}</p>
                        <div className="flex gap-3">
                            {p.vedha?.isObstructed && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">Vedha: {p.vedha.obstructingPlanet}</span>}
                            {p.isRetrograde && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Retrograde</span>}
                        </div>
                    </div>
                ))}
            </div>

            {predictions.yogas.length > 0 && (
                <section className="bg-[#1D4046] p-8 rounded-3xl text-white shadow-lg">
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2"><Sparkles className="text-[#F59E0B]"/> Active Planetary Yogas</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {predictions.yogas.map((y, i) => {
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
                <h1 className="text-4xl font-serif text-[#1D4046]">Sky Timeline</h1>
                <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm space-y-8">
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-xs font-bold text-[#1D4046]/40 uppercase tracking-widest mb-1">Interactive Scrubber</div>
                            <div className="text-2xl font-serif">{scrubDays === 0 ? 'Today' : `${Math.abs(scrubDays)} days ${scrubDays > 0 ? 'forward' : 'back'}`}</div>
                        </div>
                        <div className="text-4xl font-serif text-[#F59E0B]">{gocharaScore.toFixed(1)}%</div>
                    </div>
                    <input type="range" min="-30" max="30" value={scrubDays} onChange={e => setScrubDays(parseInt(e.target.value))} className="w-full h-1.5 bg-[#F9F7F1] rounded-lg appearance-none cursor-pointer accent-[#F59E0B]" />
                    <div className="h-48 w-full bg-[#F9F7F1] rounded-2xl border border-[#1D4046]/5 p-4 relative overflow-hidden">
                        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
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
                            {predictions.placements.slice(0, 6).map((p, i) => (
                                <li key={i} className="flex gap-4 text-sm text-[#1D4046]/70 leading-relaxed border-b border-[#1D4046]/5 pb-4 last:border-0"><span className="text-[#F59E0B] font-bold">✦</span>{p}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        )}

        {activeTab === "charts" && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-4xl font-serif text-[#1D4046]">Deep Jyotish View</h1>
                    <div className="flex bg-white rounded-lg border border-[#1D4046]/10 p-1 shadow-sm">
                        {["North", "South"].map(s => <button key={s} onClick={() => setChartStyle(s as ChartStyle)} className={`px-4 py-1 text-xs rounded-md transition-all ${chartStyle === s ? 'bg-[#F59E0B] text-white font-bold' : 'text-[#1D4046]/60 hover:bg-[#F9F7F1]'}`}>{s} Indian</button>)}
                    </div>
                </header>
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                        <h2 className="text-center font-serif text-lg mb-6 text-[#F59E0B]">Natal Chart (Birth)</h2>
                        {natalChart ? <KundliChart data={natalChart} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse flex items-center justify-center text-xs opacity-40 italic">Set birth time to see natal chart...</div>}
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm ring-2 ring-[#F59E0B]/20">
                        <h2 className="text-center font-serif text-lg mb-6 text-[#1D4046]">Transit Chart (Now)</h2>
                        {chartData ? <KundliChart data={chartData} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {[{t: "D9 Navamsa", d: d9Data}, {t: "D60 Shashtiamsa", d: d60Data}].map((c, i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                            <h2 className="text-center font-serif text-lg mb-6">{c.t}</h2>
                            {c.d ? <KundliChart data={c.d} style={chartStyle} /> : <div className="h-64 bg-[#F9F7F1] rounded animate-pulse" />}
                        </div>
                    ))}
                </div>
                <section className="bg-white p-8 rounded-3xl border border-[#1D4046]/10 shadow-sm">
                    <h2 className="text-2xl font-serif mb-8 text-[#1D4046]">Detailed Planetary Positions</h2>
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
                        <h2 className="text-2xl font-serif mb-8 text-[#1D4046]">Ashtakavarga Analysis (SAV)</h2>
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
                <h1 className="text-4xl font-serif text-[#1D4046]">Upayas & Dasha</h1>
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

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1D4046] px-8 py-4 rounded-full flex gap-12 shadow-2xl items-center z-50 transition-all">
        {[{id: "dashboard", icon: Sun, label: "Sky"}, {id: "timeline", icon: Moon, label: "Time"}, {id: "charts", icon: Info, label: "Deep"}, {id: "remedies", icon: Sparkles, label: "Upaya"}].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-[#F59E0B] scale-110' : 'text-white/40 hover:text-white/80'}`}>
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
            </button>
        ))}
      </nav>
    </main>
  );
}
