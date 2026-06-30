import { FC, memo } from 'react';
import { DivisionalChartData } from '@/lib/astrology';

const HOUSE_COORDINATES = [
  null, // 1-based index
  { x: 200, y: 100 },
  { x: 100, y: 50 },
  { x: 50, y: 100 },
  { x: 100, y: 200 },
  { x: 50, y: 300 },
  { x: 100, y: 350 },
  { x: 200, y: 300 },
  { x: 300, y: 350 },
  { x: 350, y: 300 },
  { x: 300, y: 200 },
  { x: 350, y: 100 },
  { x: 300, y: 50 }
];

interface KundliChartProps {
  data: DivisionalChartData;
}

const KundliChartComponent: FC<KundliChartProps> = ({ data }) => {
  const { houses, houseRasis } = data;

  return (
    <svg viewBox="0 0 400 400" className="w-full aspect-square max-w-[500px] mx-auto relative p-4 bg-white rounded-lg shadow-sm">
      <rect x="0" y="0" width="400" height="400" fill="none" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="0" y1="0" x2="400" y2="400" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="400" y1="0" x2="0" y2="400" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="200" y1="0" x2="400" y2="200" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="400" y1="200" x2="200" y2="400" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="200" y1="400" x2="0" y2="200" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="0" y1="200" x2="200" y2="0" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />

      {HOUSE_COORDINATES.slice(1).map((coords, index) => {
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
}

const HouseContent: FC<HouseContentProps> = ({ x, y, rasi, planets }) => {
  return (
    <g>
      <text x={x} y={y - 25} textAnchor="middle" className="fill-orange-600 font-bold text-[12px]">
        {rasi}
      </text>
      <text x={x} y={y} textAnchor="middle" className="font-medium text-[16px]">
        {planets.map((p, i) => {
          const color = p.symbol === 'As' ? '#9333EA' : '#1d4046';
          return (
            <tspan key={i}>
              <tspan fill={color}>{p.symbol}</tspan>
              {p.isRetrograde && <tspan fill={color} dx="1">*</tspan>}
              {i < planets.length - 1 && <tspan fill="#1d4046">, </tspan>}
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
