import { FC, memo } from 'react';
import { DivisionalChartData } from '@/lib/astrology';

const NORTH_HOUSE_COORDINATES = [
  null,
  { x: 200, y: 100 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 100, y: 200 },
  { x: 50, y: 300 }, { x: 100, y: 350 }, { x: 200, y: 300 }, { x: 300, y: 350 },
  { x: 350, y: 300 }, { x: 300, y: 200 }, { x: 350, y: 100 }, { x: 300, y: 50 }
];

export type ChartStyle = 'North' | 'South';

interface KundliChartProps {
  data: DivisionalChartData;
  style?: ChartStyle;
  highlightedHouses?: number[];
}

const NORTH_HOUSE_POLYGONS = [
  null,
  "200,200 100,100 200,0 300,100", // House 1
  "0,0 200,0 100,100",             // House 2
  "0,0 0,200 100,100",             // House 3
  "100,100 0,200 100,300 200,200", // House 4
  "0,200 0,400 100,300",           // House 5
  "0,400 200,400 100,300",         // House 6
  "200,200 100,300 200,400 300,300", // House 7
  "200,400 400,400 300,300",       // House 8
  "400,200 400,400 300,300",       // House 9
  "200,200 300,300 400,200 300,100", // House 10
  "400,0 400,200 300,100",         // House 11
  "200,0 400,0 300,100"            // House 12
];

const KundliChartComponent: FC<KundliChartProps> = ({ data, style = 'North', highlightedHouses = [] }) => {
  const { houses, houseRasis } = data;

  if (style === 'South') {
    return (
        <svg role="img" aria-label="South Indian Style Astrological Chart" viewBox="0 0 400 400" className="w-full aspect-square max-w-[500px] mx-auto relative p-4 bg-[#F9F7F1] rounded-lg shadow-sm border border-[#1D4046]/20 select-none">
            {/* House Background Highlights */}
            {highlightedHouses.map(houseNum => {
                const rasiIdx = houseRasis[houseNum];
                if (!rasiIdx) return null;

                const southMap: Record<number, {x: number, y: number}> = {
                    1: {x: 150, y: 50}, 2: {x: 250, y: 50}, 3: {x: 350, y: 50},
                    4: {x: 350, y: 150}, 5: {x: 350, y: 250}, 6: {x: 350, y: 350},
                    7: {x: 250, y: 350}, 8: {x: 150, y: 350}, 9: {x: 50, y: 350},
                    10: {x: 50, y: 250}, 11: {x: 50, y: 150}, 12: {x: 50, y: 50}
                };
                const c = southMap[rasiIdx];
                return (
                    <rect
                        key={`highlight-${houseNum}`}
                        x={c.x - 50}
                        y={c.y - 50}
                        width="100"
                        height="100"
                        fill="#F59E0B"
                        fillOpacity="0.15"
                    />
                );
            })}

            <rect x="0" y="0" width="400" height="400" fill="none" stroke="#1D4046" strokeWidth="1.5" />
            <line x1="100" y1="0" x2="100" y2="400" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="200" y1="0" x2="200" y2="400" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="300" y1="0" x2="300" y2="400" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="0" y1="100" x2="400" y2="100" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="0" y1="200" x2="400" y2="200" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />
            <line x1="0" y1="300" x2="400" y2="300" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />
            <rect x="100" y="100" width="200" height="200" fill="#F59E0B" fillOpacity="0.05" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.3" />

            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(rasiIdx => {
                const houseNum = Object.keys(houseRasis).find(k => houseRasis[Number(k)] === rasiIdx);
                if (!houseNum) return null;

                const southMap: Record<number, {x: number, y: number}> = {
                    1: {x: 150, y: 50}, 2: {x: 250, y: 50}, 3: {x: 350, y: 50},
                    4: {x: 350, y: 150}, 5: {x: 350, y: 250}, 6: {x: 350, y: 350},
                    7: {x: 250, y: 350}, 8: {x: 150, y: 350}, 9: {x: 50, y: 350},
                    10: {x: 50, y: 250}, 11: {x: 50, y: 150}, 12: {x: 50, y: 50}
                };
                const c = southMap[rasiIdx];
                return (
                    <HouseContent key={rasiIdx} x={c.x} y={c.y} rasi={rasiIdx} planets={houses[Number(houseNum)]} isSouth />
                );
            })}
        </svg>
    )
  }

  return (
    <svg role="img" aria-label="North Indian Style Astrological Chart" viewBox="0 0 400 400" className="w-full aspect-square max-w-[500px] mx-auto relative p-4 bg-[#F9F7F1] rounded-lg shadow-sm border border-[#1D4046]/20 select-none">
      {/* House Background Highlights */}
      {highlightedHouses.map(houseNum => {
        const poly = NORTH_HOUSE_POLYGONS[houseNum];
        if (!poly) return null;
        return (
          <polygon
            key={`highlight-${houseNum}`}
            points={poly}
            fill="#F59E0B"
            fillOpacity="0.15"
          />
        );
      })}

      <rect x="0" y="0" width="400" height="400" fill="none" stroke="#1D4046" strokeWidth="1.5" />
      <line x1="0" y1="0" x2="400" y2="400" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="400" y1="0" x2="0" y2="400" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="200" y1="0" x2="400" y2="200" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="400" y1="200" x2="200" y2="400" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="200" y1="400" x2="0" y2="200" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="0" y1="200" x2="200" y2="0" stroke="#1D4046" strokeWidth="1" strokeOpacity="0.5" />

      {NORTH_HOUSE_COORDINATES.slice(1).map((coords, index) => {
        const houseNum = index + 1;
        if (!coords) return null;
        return (
          <HouseContent
            key={houseNum}
            x={coords.x}
            y={coords.y}
            rasi={houseRasis[houseNum]}
            planets={houses[houseNum]}
          />
        );
      })}
    </svg>
  );
};

interface HouseContentProps {
  x: number;
  y: number;
  rasi: number;
  planets: Array<{ symbol: string, isRetrograde: boolean }>;
  isSouth?: boolean;
}

const HouseContent: FC<HouseContentProps> = ({ x, y, rasi, planets, isSouth }) => {
  return (
    <g>
      <text x={x} y={y - (isSouth ? 15 : 25)} textAnchor="middle" className="fill-[#F59E0B] font-bold text-[12px]">
        {rasi}
      </text>
      <text x={x} y={y + (isSouth ? 10 : 0)} textAnchor="middle" className="font-medium text-[14px]">
        {planets.map((p, i) => {
          const color = p.symbol === 'As' ? '#F59E0B' : '#1D4046';
          return (
            <tspan key={i}>
              <tspan fill={color}>{p.symbol}</tspan>
              {p.isRetrograde && <tspan fill={color} dx="1">*</tspan>}
              {i < planets.length - 1 && <tspan fill="#1D4046" dx="2"> </tspan>}
            </tspan>
          );
        })}
      </text>
    </g>
  );
};

const KundliChart = memo(KundliChartComponent);
KundliChart.displayName = 'KundliChart';

export default KundliChart;
