import { FC, memo } from 'react';
import { DivisionalChartData } from '@/lib/astrology';

interface KundliChartProps {
  data: DivisionalChartData;
}

const KundliChartComponent: FC<KundliChartProps> = ({ data }) => {
  const { houses, houseRasis } = data;

  return (
    <div className="w-full aspect-square max-w-[500px] mx-auto relative p-4 bg-white rounded-lg shadow-sm">
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <rect x="0" y="0" width="400" height="400" fill="none" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="0" y1="0" x2="400" y2="400" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="400" y1="0" x2="0" y2="400" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="200" y1="0" x2="400" y2="200" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="400" y1="200" x2="200" y2="400" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="200" y1="400" x2="0" y2="200" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="0" y1="200" x2="200" y2="0" stroke="#991B1B" strokeWidth="1.5" strokeOpacity="0.8" />

        <HouseContent x={200} y={100} rasi={houseRasis[1]} planets={houses[1]} />
        <HouseContent x={100} y={50} rasi={houseRasis[2]} planets={houses[2]} />
        <HouseContent x={50} y={100} rasi={houseRasis[3]} planets={houses[3]} />
        <HouseContent x={100} y={200} rasi={houseRasis[4]} planets={houses[4]} />
        <HouseContent x={50} y={300} rasi={houseRasis[5]} planets={houses[5]} />
        <HouseContent x={100} y={350} rasi={houseRasis[6]} planets={houses[6]} />
        <HouseContent x={200} y={300} rasi={houseRasis[7]} planets={houses[7]} />
        <HouseContent x={300} y={350} rasi={houseRasis[8]} planets={houses[8]} />
        <HouseContent x={350} y={300} rasi={houseRasis[9]} planets={houses[9]} />
        <HouseContent x={300} y={200} rasi={houseRasis[10]} planets={houses[10]} />
        <HouseContent x={350} y={100} rasi={houseRasis[11]} planets={houses[11]} />
        <HouseContent x={300} y={50} rasi={houseRasis[12]} planets={houses[12]} />
      </svg>
    </div>
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
