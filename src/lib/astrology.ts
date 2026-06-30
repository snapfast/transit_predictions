import * as AstModule from 'astronomy-engine';

// Workaround for ESM/CJS interop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ast = (AstModule as any).default || AstModule;

export interface PlanetData {
    name: string;
    symbol: string;
    longitude: number;
    degree: string;
    rasi: string;
    house: number;
    nakshatra: string;
    isRetrograde: boolean;
}

export interface DivisionalChartData {
    houses: { [key: number]: Array<{ symbol: string, isRetrograde: boolean }> };
    houseRasis: { [key: number]: number };
}

export function getD9Rasi(longitude: number): number {
    return Math.floor(longitude / (30 / 9)) % 12;
}

export function getD60Rasi(longitude: number): number {
    const rasiIdx = Math.floor(longitude / 30);
    const degInSign = longitude % 30;
    return (rasiIdx + Math.floor(degInSign * 2)) % 12;
}

export interface Predictions {
    placements: string[];
    aspects: string[];
}

export function generatePredictions(planets: PlanetData[]): Predictions {
    const placements: string[] = [];
    const aspects: string[] = [];

    const getPlanet = (name: string) => planets.find(p => p.name === name);
    const moon = getPlanet("Moon");

    if (!moon) {
        return { placements, aspects };
    }

    const moonRasiIdx = RASIS.indexOf(moon.rasi);

    const getHouseFromMoon = (planetRasi: string) => {
        const planetRasiIdx = RASIS.indexOf(planetRasi);
        return ((planetRasiIdx - moonRasiIdx + 12) % 12) + 1;
    };

    planets.forEach(planet => {
        if (planet.name === "Ascendant" || planet.name === "Gulika" || planet.name === "Mandi") return;

        const houseFromMoon = getHouseFromMoon(planet.rasi);

        if (planet.name === "Moon") {
            placements.push(`The Moon is in ${planet.rasi} (House ${houseFromMoon} from itself). This highlights themes of ${getHouseTheme(houseFromMoon)} in your emotional landscape today.`);
        } else if (planet.name === "Sun") {
            placements.push(`The Sun is in ${planet.rasi} (House ${houseFromMoon} from Moon). Your core energy and focus will be drawn towards matters of ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Jupiter") {
            placements.push(`Jupiter's expansive presence in the ${houseFromMoon}th house from the Moon brings potential for growth and optimism regarding ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Saturn") {
            placements.push(`Saturn's transit in the ${houseFromMoon}th house from the Moon reminds you to maintain discipline and responsibility in the area of ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Mars") {
             placements.push(`Mars in the ${houseFromMoon}th house from the Moon brings energy and drive to matters of ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Mercury") {
             placements.push(`Mercury in the ${houseFromMoon}th house from the Moon affects your communication and intellect in the realm of ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Venus") {
             placements.push(`Venus in the ${houseFromMoon}th house from the Moon influences harmony, relationships, and comforts concerning ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Rahu") {
             placements.push(`Rahu in the ${houseFromMoon}th house from the Moon creates worldly desires and unconventional approaches towards ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Ketu") {
             placements.push(`Ketu in the ${houseFromMoon}th house from the Moon brings detachment and spiritual introspection regarding ${getHouseTheme(houseFromMoon)}.`);
        } else if (planet.name === "Uranus" || planet.name === "Neptune" || planet.name === "Pluto") {
             placements.push(`${planet.name} in the ${houseFromMoon}th house from the Moon brings its outer planetary influence to matters of ${getHouseTheme(houseFromMoon)}.`);
        }

        // Calculate aspects
        if (planet.name === "Sun" || planet.name === "Moon" || planet.name === "Mercury" || planet.name === "Venus") {
            const aspectedHouse = (houseFromMoon + 6) % 12 || 12;
            aspects.push(`${planet.name} aspects the ${aspectedHouse}th house from the Moon, influencing ${getHouseTheme(aspectedHouse)}.`);
        } else if (planet.name === "Mars") {
            const aspect4 = (houseFromMoon + 3) % 12 || 12;
            const aspect7 = (houseFromMoon + 6) % 12 || 12;
            const aspect8 = (houseFromMoon + 7) % 12 || 12;
            aspects.push(`Mars aspects the ${aspect4}th, ${aspect7}th, and ${aspect8}th houses from the Moon, driving energy towards ${getHouseTheme(aspect4)}, ${getHouseTheme(aspect7)}, and ${getHouseTheme(aspect8)}.`);
        } else if (planet.name === "Jupiter" || planet.name === "Rahu" || planet.name === "Ketu") {
            const aspect5 = (houseFromMoon + 4) % 12 || 12;
            const aspect7 = (houseFromMoon + 6) % 12 || 12;
            const aspect9 = (houseFromMoon + 8) % 12 || 12;
            aspects.push(`${planet.name} aspects the ${aspect5}th, ${aspect7}th, and ${aspect9}th houses from the Moon, expanding ${getHouseTheme(aspect5)}, ${getHouseTheme(aspect7)}, and ${getHouseTheme(aspect9)}.`);
        } else if (planet.name === "Saturn") {
            const aspect3 = (houseFromMoon + 2) % 12 || 12;
            const aspect7 = (houseFromMoon + 6) % 12 || 12;
            const aspect10 = (houseFromMoon + 9) % 12 || 12;
            aspects.push(`Saturn aspects the ${aspect3}th, ${aspect7}th, and ${aspect10}th houses from the Moon, bringing structure and discipline to ${getHouseTheme(aspect3)}, ${getHouseTheme(aspect7)}, and ${getHouseTheme(aspect10)}.`);
        }
    });

    return { placements, aspects };
}

function getHouseTheme(house: number): string {
    const themes: { [key: number]: string } = {
        1: "self, vitality, and new beginnings",
        2: "finances, family, and speech",
        3: "courage, siblings, and short journeys",
        4: "home, mother, and inner peace",
        5: "creativity, intellect, and children",
        6: "health, daily routines, and overcoming obstacles",
        7: "partnerships, relationships, and business",
        8: "transformation, sudden changes, and shared resources",
        9: "luck, higher wisdom, and long travels",
        10: "career, public image, and achievements",
        11: "gains, friendships, and long-term goals",
        12: "spirituality, letting go, and hidden matters"
    };
    return themes[house] || "general life events";
}

const NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
    "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

const RASIS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const PLANET_MAP = [
    { name: "Sun", body: Ast.Body.Sun, symbol: "Su" },
    { name: "Moon", body: Ast.Body.Moon, symbol: "Mo" },
    { name: "Mars", body: Ast.Body.Mars, symbol: "Ma" },
    { name: "Mercury", body: Ast.Body.Mercury, symbol: "Me" },
    { name: "Jupiter", body: Ast.Body.Jupiter, symbol: "Ju" },
    { name: "Venus", body: Ast.Body.Venus, symbol: "Ve" },
    { name: "Saturn", body: Ast.Body.Saturn, symbol: "Sa" },
    { name: "Uranus", body: Ast.Body.Uranus, symbol: "Ur" },
    { name: "Neptune", body: Ast.Body.Neptune, symbol: "Ne" },
    { name: "Pluto", body: Ast.Body.Pluto, symbol: "Pl" },
];

export function getLahiriAyanamsa(time: AstModule.AstroTime): number {
    const T = time.tt / 36525.0;
    return 23.85 + 1.39638 * T + 0.000308 * T * T;
}

export function getMeanRahu(time: AstModule.AstroTime): number {
    // Julian century from J2000.0 TT
    const T = time.tt / 36525.0;

    // Mean longitude of the Moon's ascending node (Rahu)
    // Formula from Jean Meeus, Astronomical Algorithms
    // Normalized to 0-360 degrees
    let nodeLong = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000;

    // Normalize to 0..360
    nodeLong = nodeLong % 360.0;
    if (nodeLong < 0) nodeLong += 360.0;

    return nodeLong;
}

function formatDegree(deg: number): string {
    const d = Math.floor(deg);
    const m = Math.floor((deg - d) * 60);
    return `${d}° ${m}'`;
}

export function calculateTransits(date: Date, lat: number = 28.6139, lon: number = 77.2090): { planets: PlanetData[], d1: DivisionalChartData, d9: DivisionalChartData, d60: DivisionalChartData, predictions: Predictions } {
    const time = Ast.MakeTime(date);
    const ayanamsa = getLahiriAyanamsa(time);

    // Calculate Ascendant (Lagna)
    const siderealTime = Ast.SiderealTime(time);
    const RAMC = (siderealTime * 15 + lon) % 360;
    const rad = Math.PI / 180;
    const phi = lat * rad;
    const rot = Ast.Rotation_ECL_EQD(time);
    const eps = Math.acos(rot.rot[2][2]);
    const alpha = RAMC * rad;
    const lagnaTropical = (Math.atan2(Math.cos(alpha), -(Math.sin(alpha) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / rad + 360) % 360;
    const lagnaSidereal = (lagnaTropical - ayanamsa + 360) % 360;
    const lagnaRasiIdx = Math.floor(lagnaSidereal / 30);

    const planets: PlanetData[] = [];

    // Ascendant
    planets.push({
        name: "Ascendant",
        symbol: "As",
        longitude: lagnaSidereal,
        degree: formatDegree(lagnaSidereal % 30),
        rasi: RASIS[lagnaRasiIdx],
        house: 1,
        nakshatra: NAKSHATRAS[Math.floor(lagnaSidereal / (360 / 27))],
        isRetrograde: false
    });

    // Traditional and Modern Planets
    const timeDelta = time.AddDays(0.1); // +0.1 days
    PLANET_MAP.forEach(p => {
        const pos = Ast.GeoVector(p.body, time, true);
        const ecl = Ast.Ecliptic(pos);
        const siderealLong = (ecl.elon - ayanamsa + 360) % 360;
        const rasiIdx = Math.floor(siderealLong / 30);
        const house = ((rasiIdx - lagnaRasiIdx + 12) % 12) + 1;
        const nakIdx = Math.floor(siderealLong / (360 / 27));

        // Check for retrograde motion
        let isRetrograde = false;
        if (p.name !== "Sun" && p.name !== "Moon") {
            const posDelta = Ast.GeoVector(p.body, timeDelta, true);
            const eclDelta = Ast.Ecliptic(posDelta);
            let lonDiff = eclDelta.elon - ecl.elon;
            if (lonDiff > 180) lonDiff -= 360;
            if (lonDiff < -180) lonDiff += 360;
            isRetrograde = lonDiff < 0;
        }

        planets.push({
            name: p.name,
            symbol: p.symbol,
            longitude: siderealLong,
            degree: formatDegree(siderealLong % 30),
            rasi: RASIS[rasiIdx],
            house: house,
            nakshatra: NAKSHATRAS[nakIdx],
            isRetrograde
        });
    });

    // Nodes (Rahu and Ketu)
    const rahuTropical = getMeanRahu(time);
    const rahuSidereal = (rahuTropical - ayanamsa + 360) % 360;
    const ketuSidereal = (rahuSidereal + 180) % 360;

    const rahuRasiIdx = Math.floor(rahuSidereal / 30);
    const ketuRasiIdx = Math.floor(ketuSidereal / 30);

    planets.push({
        name: "Rahu",
        symbol: "Ra",
        longitude: rahuSidereal,
        degree: formatDegree(rahuSidereal % 30),
        rasi: RASIS[rahuRasiIdx],
        house: ((rahuRasiIdx - lagnaRasiIdx + 12) % 12) + 1,
        nakshatra: NAKSHATRAS[Math.floor(rahuSidereal / (360 / 27))],
        isRetrograde: true
    });

    planets.push({
        name: "Ketu",
        symbol: "Ke",
        longitude: ketuSidereal,
        degree: formatDegree(ketuSidereal % 30),
        rasi: RASIS[ketuRasiIdx],
        house: ((ketuRasiIdx - lagnaRasiIdx + 12) % 12) + 1,
        nakshatra: NAKSHATRAS[Math.floor(ketuSidereal / (360 / 27))],
        isRetrograde: true
    });

    // Calculate Upgrahas (Gulika and Mandi)
    const dayOfWeek = date.getDay(); // 0: Sunday, 1: Monday, ...
    const observer = new Ast.Observer(lat, lon, 0);

    // Find sunrise and sunset for the current day
    // const sunriseTime = time;
    // const sunsetTime = time;
    let isDayTime = true;

    // Approximate daytime calculation
    const searchRise = Ast.SearchRiseSet(Ast.Body.Sun, observer, 1, time, -1);
    const searchSet = Ast.SearchRiseSet(Ast.Body.Sun, observer, -1, time, 1);

    let dayStart, dayEnd;

    if (searchRise && searchSet) {
       // if current time is between sunrise and sunset
       if (time.tt > searchRise.tt && time.tt < searchSet.tt) {
           dayStart = searchRise.tt;
           dayEnd = searchSet.tt;
           isDayTime = true;
       } else {
           isDayTime = false;
           // If night time, we need sunset to next sunrise
           const nextRise = Ast.SearchRiseSet(Ast.Body.Sun, observer, 1, time, 1);
           if (searchSet.tt < time.tt && nextRise) {
               dayStart = searchSet.tt;
               dayEnd = nextRise.tt;
           } else {
               dayStart = searchSet.tt;
               dayEnd = searchSet.tt + 0.5; // fallback 12 hours
           }
       }
    } else {
        dayStart = time.tt;
        dayEnd = time.tt + 0.5;
    }

    const duration = dayEnd - dayStart;
    const muhurtaLength = duration / 8;

    // Gulika & Mandi parts (Day: Sun=7, Mon=6, Tue=5, Wed=4, Thu=3, Fri=2, Sat=1. Night: Sun=3, Mon=2, Tue=1, Wed=7, Thu=6, Fri=5, Sat=4)
    const gulikaPartsDay = [7, 6, 5, 4, 3, 2, 1];
    const gulikaPartsNight = [3, 2, 1, 7, 6, 5, 4];

    const mandiPartsDay = [6, 5, 4, 3, 2, 1, 7];
    const mandiPartsNight = [2, 1, 7, 6, 5, 4, 3];

    const partOffsetGulika = isDayTime ? gulikaPartsDay[dayOfWeek] : gulikaPartsNight[dayOfWeek];
    const partOffsetMandi = isDayTime ? mandiPartsDay[dayOfWeek] : mandiPartsNight[dayOfWeek];

    const gulikaStartTt = dayStart + (partOffsetGulika - 1) * muhurtaLength;
    const mandiStartTt = dayStart + (partOffsetMandi - 1) * muhurtaLength;

    // To get the position of Gulika/Mandi, we calculate the Ascendant at their start time
    const calcAscendantAtTime = (tt: number) => {
        // Tt to UT difference is small, simplify for Ascendant calculation
        const astroTime = new Ast.AstroTime(tt);
        const st = Ast.SiderealTime(astroTime);
        const r = (st * 15 + lon) % 360;
        const a = r * rad;
        const rotAt = Ast.Rotation_ECL_EQD(astroTime);
        const epsAt = Math.acos(rotAt.rot[2][2]);
        const lagnaTrop = (Math.atan2(Math.cos(a), -(Math.sin(a) * Math.cos(epsAt) + Math.tan(phi) * Math.sin(epsAt))) / rad + 360) % 360;
        return (lagnaTrop - ayanamsa + 360) % 360;
    };

    const gulikaSidereal = calcAscendantAtTime(gulikaStartTt);
    const mandiSidereal = calcAscendantAtTime(mandiStartTt);

    planets.push({
        name: "Gulika",
        symbol: "Gu",
        longitude: gulikaSidereal,
        degree: formatDegree(gulikaSidereal % 30),
        rasi: RASIS[Math.floor(gulikaSidereal / 30)],
        house: ((Math.floor(gulikaSidereal / 30) - lagnaRasiIdx + 12) % 12) + 1,
        nakshatra: NAKSHATRAS[Math.floor(gulikaSidereal / (360 / 27))],
        isRetrograde: false
    });

    planets.push({
        name: "Mandi",
        symbol: "Md",
        longitude: mandiSidereal,
        degree: formatDegree(mandiSidereal % 30),
        rasi: RASIS[Math.floor(mandiSidereal / 30)],
        house: ((Math.floor(mandiSidereal / 30) - lagnaRasiIdx + 12) % 12) + 1,
        nakshatra: NAKSHATRAS[Math.floor(mandiSidereal / (360 / 27))],
        isRetrograde: false
    });


    // Generate D1, D9, and D60 Chart Data
    const d1Houses: { [key: number]: Array<{ symbol: string, isRetrograde: boolean }> } = {};
    const d1HouseRasis: { [key: number]: number } = {};
    const d9Houses: { [key: number]: Array<{ symbol: string, isRetrograde: boolean }> } = {};
    const d9HouseRasis: { [key: number]: number } = {};
    const d60Houses: { [key: number]: Array<{ symbol: string, isRetrograde: boolean }> } = {};
    const d60HouseRasis: { [key: number]: number } = {};

    const lagnaD9RasiIdx = getD9Rasi(lagnaSidereal);
    const lagnaD60RasiIdx = getD60Rasi(lagnaSidereal);

    for (let i = 1; i <= 12; i++) {
        d1Houses[i] = [];
        d1HouseRasis[i] = ((lagnaRasiIdx + i - 1) % 12) + 1; // 1-based index (Aries = 1)

        d9Houses[i] = [];
        d9HouseRasis[i] = ((lagnaD9RasiIdx + i - 1) % 12) + 1;

        d60Houses[i] = [];
        d60HouseRasis[i] = ((lagnaD60RasiIdx + i - 1) % 12) + 1;
    }

    planets.forEach(p => {
        if (p.house >= 1 && p.house <= 12) {
            d1Houses[p.house].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        }

        // D9
        const d9RasiIdx = getD9Rasi(p.longitude);
        const d9House = ((d9RasiIdx - lagnaD9RasiIdx + 12) % 12) + 1;
        if (d9House >= 1 && d9House <= 12) {
            d9Houses[d9House].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        }

        // D60
        const d60RasiIdx = getD60Rasi(p.longitude);
        const d60House = ((d60RasiIdx - lagnaD60RasiIdx + 12) % 12) + 1;
        if (d60House >= 1 && d60House <= 12) {
            d60Houses[d60House].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        }
    });

    const predictions = generatePredictions(planets);

    return {
        planets,
        d1: { houses: d1Houses, houseRasis: d1HouseRasis },
        d9: { houses: d9Houses, houseRasis: d9HouseRasis },
        d60: { houses: d60Houses, houseRasis: d60HouseRasis },
        predictions
    };
}
