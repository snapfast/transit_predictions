"use client";

import { useState, useEffect } from "react";
import { calculateTransits, PlanetData, DivisionalChartData } from "@/lib/astrology";
import KundliChart from "@/components/KundliChart";
import { Clock, MapPin, Calendar } from "lucide-react";

export default function Home() {
  const [dateStr, setDateStr] = useState<string>("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [lat, setLat] = useState<number>(28.6139);
  const [lon, setLon] = useState<number>(77.2090);

  const [planets, setPlanets] = useState<PlanetData[]>([]);
  const [chartData, setChartData] = useState<DivisionalChartData | null>(null);

  useEffect(() => {
    // Initialize with current date/time on client
    const now = new Date();
    setDateStr(now.toISOString().split("T")[0]);
    setTimeStr(now.toTimeString().slice(0, 5));
  }, []);

  useEffect(() => {
    if (!dateStr || !timeStr) return;

    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);

        const date = new Date(year, month - 1, day, hour, minute);

        if (isNaN(date.getTime())) return;

        const { planets: p, d1 } = calculateTransits(date, lat, lon);
        setPlanets(p);
        setChartData(d1);
    } catch (e) {
        console.error("Failed to calculate transits", e);
    }
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
              onChange={e => setLat(parseFloat(e.target.value) || 0)}
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
              onChange={e => setLon(parseFloat(e.target.value) || 0)}
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
