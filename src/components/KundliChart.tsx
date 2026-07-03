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
}

const KundliChartComponent: FC<KundliChartProps> = ({ data, style = 'North' }) => {
  const { houses, houseRasis } = data;

  if (style === 'South') {
    return (
        <svg viewBox="0 0 400 400" className="w-full aspect-square max-w-[500px] mx-auto relative p-4 bg-[#F9F7F1] rounded-lg shadow-sm border border-[#1D4046]/20">
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
    <svg viewBox="0 0 400 400" className="w-full aspect-square max-w-[500px] mx-auto relative p-4 bg-[#F9F7F1] rounded-lg shadow-sm border border-[#1D4046]/20">
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
