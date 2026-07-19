import * as AstModule from 'astronomy-engine';

// Workaround for ESM/CJS interop
const Ast = (AstModule as unknown as { default: typeof AstModule }).default || AstModule;


const TRANSIT_CACHE = new Map<string, {
    planets: PlanetData[],
    upgrahas?: PlanetData[],
    d1: DivisionalChartData,
    d9: DivisionalChartData,
    d60: DivisionalChartData,
    d1Asc: DivisionalChartData,
    d9Asc: DivisionalChartData,
    d60Asc: DivisionalChartData,
    d1WithUpgrahas?: DivisionalChartData,
    d9WithUpgrahas?: DivisionalChartData,
    d60WithUpgrahas?: DivisionalChartData,
    d1WithUpgrahasAsc?: DivisionalChartData,
    d9WithUpgrahasAsc?: DivisionalChartData,
    d60WithUpgrahasAsc?: DivisionalChartData,
    predictionsMoon: Predictions,
    predictionsLagna: Predictions,
    dasha?: DashaInfo,
    sadeSati?: SadeSatiInfo,
    gocharaScore: number,
    remedies: Remedy[],
    ashtakavarga?: AshtakavargaData
}>();

function getVedicDayBounds(date: Date, lat: number, lon: number): { isDay: boolean; start: Date; end: Date; weekday: number } {
    const obs = new Ast.Observer(lat, lon, 0);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const riseTimeCurr = Ast.SearchRiseSet(Ast.Body.Sun, obs, 1, dayStart, 1);
    const setTimeCurr = Ast.SearchRiseSet(Ast.Body.Sun, obs, -1, dayStart, 1);

    const sunriseCurr = riseTimeCurr ? riseTimeCurr.date : new Date(dayStart.getTime() + 6 * 3600 * 1000);
    const sunsetCurr = setTimeCurr ? setTimeCurr.date : new Date(dayStart.getTime() + 18 * 3600 * 1000);

    let isDay = false;
    let start = sunriseCurr;
    let end = sunsetCurr;
    let refDateForWeekday = date;

    if (date >= sunriseCurr && date < sunsetCurr) {
        isDay = true;
        start = sunriseCurr;
        end = sunsetCurr;
        refDateForWeekday = date;
    } else {
        isDay = false;
        if (date < sunriseCurr) {
            const prevDay = new Date(dayStart.getTime() - 24 * 3600 * 1000);
            const setTimePrev = Ast.SearchRiseSet(Ast.Body.Sun, obs, -1, prevDay, 1);
            start = setTimePrev ? setTimePrev.date : new Date(prevDay.getTime() + 18 * 3600 * 1000);
            end = sunriseCurr;
            refDateForWeekday = prevDay;
        } else {
            const nextDay = new Date(dayStart.getTime() + 24 * 3600 * 1000);
            const riseTimeNext = Ast.SearchRiseSet(Ast.Body.Sun, obs, 1, nextDay, 1);
            start = sunsetCurr;
            end = riseTimeNext ? riseTimeNext.date : new Date(nextDay.getTime() + 6 * 3600 * 1000);
            refDateForWeekday = date;
        }
    }

    const weekday = refDateForWeekday.getDay();
    return { isDay, start, end, weekday };
}

const UPGRAHA_DEFS = [
    { name: "Kala", lordIdx: 0, symbol: "Kl", isMandi: false },
    { name: "Mrityu", lordIdx: 2, symbol: "Mr", isMandi: false },
    { name: "Ardhaprahara", lordIdx: 3, symbol: "Ar", isMandi: false },
    { name: "Yamaghantaka", lordIdx: 4, symbol: "Yg", isMandi: false },
    { name: "Gulika", lordIdx: 6, symbol: "Gk", isMandi: false },
    { name: "Mandi", lordIdx: 6, symbol: "Mn", isMandi: true }
];

export function calculateUpgrahas(
    date: Date,
    lat: number,
    lon: number,
    sunLongitude: number,
    ayanamsaType: AyanamsaType,
    refRasi: number
): PlanetData[] {
    const upgrahas: PlanetData[] = [];

    // 1. Calculate Aprakasha Grahas (Sun-based)
    const dhumaLong = (sunLongitude + 133.33333333) % 360;
    const vyatipataLong = (360 - dhumaLong + 360) % 360;
    const pariveshaLong = (vyatipataLong + 180) % 360;
    const indrachapaLong = (360 - pariveshaLong + 360) % 360;
    const upaketuLong = (indrachapaLong + 16.66666667) % 360;

    const aprakasha = [
        { name: "Dhuma", symbol: "Dh", longitude: dhumaLong },
        { name: "Vyatipata", symbol: "Vy", longitude: vyatipataLong },
        { name: "Parivesha", symbol: "Pv", longitude: pariveshaLong },
        { name: "Indrachapa", symbol: "Id", longitude: indrachapaLong },
        { name: "Upaketu", symbol: "Uk", longitude: upaketuLong }
    ];

    for (let i = 0; i < aprakasha.length; i++) {
        const item = aprakasha[i];
        const rasiIdx = Math.floor(item.longitude / 30);
        const rasiDeg = item.longitude % 30;
        const nakshatradeg = 360 / 27;
        const pada = Math.floor((item.longitude % nakshatradeg) / (nakshatradeg / 4)) + 1;
        const kakshyaIdx = Math.floor(rasiDeg / 3.75);

        upgrahas.push({
            name: item.name,
            symbol: item.symbol,
            longitude: item.longitude,
            degree: formatDegree(rasiDeg),
            rasi: RASIS[rasiIdx],
            house: (rasiIdx - refRasi + 12) % 12 + 1,
            nakshatra: NAKSHATRAS[Math.floor(item.longitude / (360 / 27))],
            pada,
            isRetrograde: false,
            isCombust: false,
            kakshya: KAKSHYA_LORDS[kakshyaIdx]
        });
    }

    // 2. Calculate Kālavelā / Time-Based Grahas
    const { isDay, start, end, weekday } = getVedicDayBounds(date, lat, lon);
    const durationMs = end.getTime() - start.getTime();
    const partDurationMs = durationMs / 8;

    for (let i = 0; i < UPGRAHA_DEFS.length; i++) {
        const def = UPGRAHA_DEFS[i];
        let p = 0;
        if (isDay) {
            p = (def.lordIdx - weekday + 7) % 7;
        } else {
            p = (def.lordIdx - (weekday + 4) + 14) % 7;
        }

        const offsetFraction = def.isMandi ? (p + 0.5) : p;
        const upgrahaTime = new Date(start.getTime() + offsetFraction * partDurationMs);
        const astTime = Ast.MakeTime(upgrahaTime);
        const ayan = getAyanamsa(astTime, ayanamsaType);

        // Calculate Lagna at upgrahaTime
        const RAMC = (Ast.SiderealTime(astTime) * 15 + lon) % 360;
        const eps = Math.acos(Ast.Rotation_ECL_EQD(astTime).rot[2][2]);
        const alpha = RAMC * Math.PI / 180;
        const phi = lat * Math.PI / 180;
        const l_trop = (Math.atan2(Math.cos(alpha), -(Math.sin(alpha) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * 180 / Math.PI + 360) % 360;
        const longitude = (l_trop - ayan + 360) % 360;

        const rasiIdx = Math.floor(longitude / 30);
        const rasiDeg = longitude % 30;
        const nakshatradeg = 360 / 27;
        const pada = Math.floor((longitude % nakshatradeg) / (nakshatradeg / 4)) + 1;
        const kakshyaIdx = Math.floor(rasiDeg / 3.75);

        upgrahas.push({
            name: def.name,
            symbol: def.symbol,
            longitude,
            degree: formatDegree(rasiDeg),
            rasi: RASIS[rasiIdx],
            house: (rasiIdx - refRasi + 12) % 12 + 1,
            nakshatra: NAKSHATRAS[Math.floor(longitude / (360 / 27))],
            pada,
            isRetrograde: false,
            isCombust: false,
            kakshya: KAKSHYA_LORDS[kakshyaIdx]
        });
    }

    return upgrahas;
}

export interface PlanetData {
    name: string;
    symbol: string;
    longitude: number;
    degree: string;
    rasi: string;
    house: number;
    nakshatra: string;
    pada: number;
    isRetrograde: boolean;
    isCombust?: boolean;
    kakshya?: string;
    vedha?: {
        isObstructed: boolean;
        obstructingPlanet?: string;
    };
}

export interface DivisionalChartData {
    houses: { [key: number]: Array<{ symbol: string, isRetrograde: boolean }> };
    houseRasis: { [key: number]: number };
}

export interface AshtakavargaData {
    bav: { [key: string]: number[] }; // Planet name -> array of 12 scores
    sav: number[]; // Array of 12 scores
}

export function getD9Rasi(longitude: number): number {
    return Math.floor(longitude / (30 / 9)) % 12;
}

export function getD60Rasi(longitude: number): number {
    const rasiIdx = Math.floor(longitude / 30);
    const degInSign = longitude % 30;
    return (rasiIdx + Math.floor(degInSign * 2)) % 12;
}

export interface CombinedPrediction {
    title: string;
    description: string;
    type: 'Career & Ambition' | 'Relationship & Social' | 'Health & Vitality' | 'Spiritual & Inner Growth' | 'Financial & Fortune';
    contributors: string[];
}

export interface Predictions {
    placements: string[];
    aspects: string[];
    yogas: string[];
    combined: CombinedPrediction[];
}

export interface DashaLevel {
    lord: string;
    start: Date;
    end: Date;
}

export interface DashaInfo {
    mahadasha: DashaLevel;
    antardasha: DashaLevel;
    pratyantardasha: DashaLevel;
    sookshmadasha: DashaLevel;
}

export interface SadeSatiInfo {
    isActive: boolean;
    phase: 'Rising' | 'Peak' | 'Setting' | 'None';
}

export interface Remedy {
    planet: string;
    condition: string;
    mantra: string;
    charity: string;
    lifestyle: string;
}

export function getRemedies(planets: PlanetData[], dasha?: DashaInfo, sadeSati?: SadeSatiInfo): Remedy[] {
    const remedies: Remedy[] = [];

    if (sadeSati?.isActive) {
        remedies.push({
            planet: "Saturn",
            condition: `Sade Sati (${sadeSati.phase} Phase)`,
            mantra: "Om Sham Shanaishcharaya Namaha",
            charity: "Donate black sesame seeds or iron on Saturdays",
            lifestyle: "Practice discipline and serve the elderly"
        });
    }

    if (dasha) {
        const dashaLord = dasha.mahadasha.lord;
        remedies.push(getPlanetRemedy(dashaLord, "Active Mahadasha Lord"));
    }

    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const n = p.name;
        if (p.vedha?.isObstructed) {
            remedies.push(getPlanetRemedy(n, `Obstructed ${n} Transit`));
        }
        const isMSRK = n === "Mars" || n === "Saturn" || n === "Rahu" || n === "Ketu";
        if (p.isRetrograde && isMSRK) {
            remedies.push(getPlanetRemedy(n, `Retrograde ${n}`));
        }
        if (isMSRK) {
            const h = p.house;
            if (h === 1 || h === 2 || h === 4 || h === 5 || h === 7 || h === 8 || h === 9 || h === 12) {
                remedies.push(getPlanetRemedy(n, `${n} in House ${h}`));
            }
        }
    }

    // ⚡ Bolt Optimization: Replace O(N^2) Array.filter(Array.findIndex) with an O(N) Set-based filter
    // to prevent heavy closure and array recreations in hot paths.
    const uniqueRemedies: Remedy[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < remedies.length; i++) {
        const r = remedies[i];
        const key = r.planet + "|" + r.condition;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueRemedies.push(r);
            if (uniqueRemedies.length === 6) break;
        }
    }

    return uniqueRemedies;
}

const REMEDY_DATA: { [key: string]: { mantra: string, charity: string, lifestyle: string } } = {
    "Sun": { mantra: "Om Ghrini Suryaya Namaha", charity: "Donate wheat or copper on Sundays", lifestyle: "Wake up before sunrise, offer water to Sun" },
    "Moon": { mantra: "Om Som Somaya Namaha", charity: "Donate rice or white cloth on Mondays", lifestyle: "Respect mother, stay hydrated" },
    "Mars": { mantra: "Om Ang Angarkaya Namaha", charity: "Donate red lentils on Tuesdays", lifestyle: "Physical exercise, avoid anger" },
    "Mercury": { mantra: "Om Bum Budhaya Namaha", charity: "Donate green gram on Wednesdays", lifestyle: "Read books, plant trees" },
    "Jupiter": { mantra: "Om Gram Greem Graum Sah Gurave Namaha", charity: "Donate yellow sweets or turmeric on Thursdays", lifestyle: "Respect teachers, study scriptures" },
    "Venus": { mantra: "Om Shum Shukraya Namaha", charity: "Donate white sweets or silk on Fridays", lifestyle: "Maintain cleanliness, appreciate art" },
    "Saturn": { mantra: "Om Sham Shanaishcharaya Namaha", charity: "Donate mustard oil or black clothes on Saturdays", lifestyle: "Hard work, punctuality" },
    "Rahu": { mantra: "Om Raam Rahave Namaha", charity: "Donate coconuts or coal", lifestyle: "Bird feeding, avoid illusions" },
    "Ketu": { mantra: "Om Kem Ketave Namaha", charity: "Donate multi-colored blankets", lifestyle: "Meditation, spiritual detachment" }
};

function getPlanetRemedy(planet: string, condition: string): Remedy {
    const remedy = REMEDY_DATA[planet] || { mantra: "Om Namah Shivaya", charity: "General donation", lifestyle: "Meditate" };
    return { planet, condition, ...remedy };
}

// ⚡ Bolt Optimization: Extracted inline arrays to bitmasks for fast evaluation
const BENEFIC_HOUSES_MASK = (1 << 1) | (1 << 2) | (1 << 4) | (1 << 5) | (1 << 7) | (1 << 9) | (1 << 10) | (1 << 11);
const MALEFIC_HOUSES_MASK = (1 << 3) | (1 << 6) | (1 << 11);
const DASHA_LORD_HOUSES_MASK = (1 << 1) | (1 << 5) | (1 << 9) | (1 << 10) | (1 << 11);

export function calculateGocharaScore(planets: PlanetData[], dasha?: DashaInfo, ashtakavarga?: AshtakavargaData): number {
    // ⚡ Bolt Optimization: Switched to a single `for` loop, pre-computed bitmasks, and O(1) dict lookups.
    // Avoids re-allocating arrays and arrow functions on every call, drastically improving timeline scrubber performance.
    let score = 50;

    let dashaLordHouse = -1;
    const dashaLordName = dasha ? dasha.mahadasha.lord : null;

    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const n = p.name;

        if (n === dashaLordName) dashaLordHouse = p.house;
        if (n === "Ascendant") continue;

        let planetScore = 0;
        const isBenefic = n === "Jupiter" || n === "Venus" || n === "Mercury" || n === "Moon";
        const house = p.house;

        if (isBenefic) {
            if ((BENEFIC_HOUSES_MASK & (1 << house)) !== 0) planetScore += 8;
            else planetScore -= 4;
        } else {
            if ((MALEFIC_HOUSES_MASK & (1 << house)) !== 0) planetScore += 10;
            else planetScore -= 6;
        }

        if (p.vedha?.isObstructed) {
            planetScore = planetScore > 0 ? planetScore * 0.2 : planetScore;
        }

        if (ashtakavarga && ashtakavarga.bav[n]) {
            // RASI_INDEX_MAP is used here for O(1) lookup instead of RASIS.indexOf
            const rasiIdx = RASI_INDEX_MAP[p.rasi] ?? RASIS.indexOf(p.rasi);
            const bindus = ashtakavarga.bav[n][rasiIdx];
            if (bindus >= 5) planetScore += 5;
            else if (bindus <= 3) planetScore -= 5;
        }

        score += planetScore;
    }

    if (dashaLordHouse !== -1 && ((DASHA_LORD_HOUSES_MASK & (1 << dashaLordHouse)) !== 0)) {
        score += 15;
    }

    return Math.min(Math.max(score, 0), 100);
}


const DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const DASHA_PERIODS = [7, 20, 6, 10, 7, 18, 16, 19, 17];

export function calculateVimshottariDasha(birthDate: Date, moonLongitude: number, targetDate: Date = new Date()): DashaInfo {
    const totalCycle = 120, nakshatraLength = 360 / 27;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const YEAR_MS = 365.25636 * DAY_MS;

    const nakshatraIndex = Math.floor(moonLongitude / nakshatraLength);
    const lordIndex = nakshatraIndex % 9;
    const passedInNakshatra = (moonLongitude % nakshatraLength) / nakshatraLength;

    const firstDashaTotalYears = DASHA_PERIODS[lordIndex];
    const firstDashaRemainingYears = firstDashaTotalYears * (1 - passedInNakshatra);

    const currentDate = new Date(birthDate);
    let trueMdStart = new Date(currentDate.getTime() - Math.round(firstDashaTotalYears * passedInNakshatra * YEAR_MS));
    let dashaEnd = new Date(currentDate.getTime() + Math.round(firstDashaRemainingYears * YEAR_MS));

    let currentLordIndex = lordIndex;
    while (dashaEnd < targetDate) {
        trueMdStart = new Date(dashaEnd);
        currentLordIndex = (currentLordIndex + 1) % 9;
        const years = DASHA_PERIODS[currentLordIndex];
        dashaEnd = new Date(trueMdStart.getTime() + Math.round(years * YEAR_MS));
    }

    const currentMahadasha = { lord: DASHA_LORDS[currentLordIndex], start: trueMdStart, end: dashaEnd };

    const mdDurationMs = DASHA_PERIODS[currentLordIndex] * YEAR_MS;
    let adStart = new Date(trueMdStart);
    for (let i = 0; i < 9; i++) {
        const adIdx = (currentLordIndex + i) % 9;
        const adLord = DASHA_LORDS[adIdx];
        const adDurationMs = (DASHA_PERIODS[adIdx] / totalCycle) * mdDurationMs;
        const adEnd = new Date(adStart.getTime() + adDurationMs);
        if (adEnd > targetDate) {
            const currentAD = { lord: adLord, start: adStart, end: adEnd };
            const adDurationActual = adEnd.getTime() - adStart.getTime();
            let pdStart = new Date(adStart);
            for (let j = 0; j < 9; j++) {
                const pdIdx = (adIdx + j) % 9;
                const pdLord = DASHA_LORDS[pdIdx];
                const pdDurationMs = (DASHA_PERIODS[pdIdx] / totalCycle) * adDurationActual;
                const pdEnd = new Date(pdStart.getTime() + pdDurationMs);
                if (pdEnd > targetDate) {
                    const currentPD = { lord: pdLord, start: pdStart, end: pdEnd };
                    const pdDurationActual = pdEnd.getTime() - pdStart.getTime();
                    let sdStart = new Date(pdStart);
                    for (let k = 0; k < 9; k++) {
                        const sdIdx = (pdIdx + k) % 9;
                        const sdLord = DASHA_LORDS[sdIdx];
                        const sdDurationMs = (DASHA_PERIODS[sdIdx] / totalCycle) * pdDurationActual;
                        const sdEnd = new Date(sdStart.getTime() + sdDurationMs);
                        if (sdEnd > targetDate) {
                            return {
                                mahadasha: currentMahadasha,
                                antardasha: currentAD,
                                pratyantardasha: currentPD,
                                sookshmadasha: { lord: sdLord, start: sdStart, end: sdEnd }
                            };
                        }
                        sdStart = sdEnd;
                    }
                    const fallbackSD = { lord: pdLord, start: pdStart, end: pdEnd };
                    return { mahadasha: currentMahadasha, antardasha: currentAD, pratyantardasha: currentPD, sookshmadasha: fallbackSD };
                }
                pdStart = pdEnd;
            }
            const fallbackPD = { lord: adLord, start: adStart, end: adEnd };
            return { mahadasha: currentMahadasha, antardasha: currentAD, pratyantardasha: fallbackPD, sookshmadasha: fallbackPD };
        }
        adStart = adEnd;
    }
    const fallback = { lord: DASHA_LORDS[currentLordIndex], start: currentDate, end: dashaEnd };
    return { mahadasha: currentMahadasha, antardasha: fallback, pratyantardasha: fallback, sookshmadasha: fallback };
}

export function calculateSadeSati(natalMoonLongitude: number, transitSaturnLongitude: number): SadeSatiInfo {
    const natalMoonRasi = Math.floor(natalMoonLongitude / 30);
    const transitSaturnRasi = Math.floor(transitSaturnLongitude / 30);
    const diff = (transitSaturnRasi - natalMoonRasi + 12) % 12;
    if (diff === 11) return { isActive: true, phase: 'Rising' };
    if (diff === 0) return { isActive: true, phase: 'Peak' };
    if (diff === 1) return { isActive: true, phase: 'Setting' };
    return { isActive: false, phase: 'None' };
}

export function getRotatedChart(planets: PlanetData[], refRasiIdx: number): DivisionalChartData {
    const chart: DivisionalChartData = { houses: {}, houseRasis: {} };
    for (let i = 1; i <= 12; i++) {
        chart.houses[i] = [];
        chart.houseRasis[i] = (refRasiIdx + i - 1) % 12 + 1;
    }
    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const pRasiIdx = RASI_INDEX_MAP[p.rasi] ?? RASIS.indexOf(p.rasi);
        const house = (pRasiIdx - refRasiIdx + 12) % 12 + 1;
        if (house >= 1 && house <= 12) {
            chart.houses[house].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        }
    }
    return chart;
}

function getAspectedHouses(name: string, h: number): number[] {
    const list = [(h + 6) % 12 || 12];
    if (name === "Mars") {
        list.push((h + 3) % 12 || 12);
        list.push((h + 7) % 12 || 12);
    } else if (name === "Jupiter" || name === "Rahu" || name === "Ketu") {
        list.push((h + 4) % 12 || 12);
        list.push((h + 8) % 12 || 12);
    } else if (name === "Saturn") {
        list.push((h + 2) % 12 || 12);
        list.push((h + 9) % 12 || 12);
    }
    return list;
}

export function generatePredictionsFromRasi(planets: PlanetData[], refRasiIdx: number, refName: string): Predictions {
    const placements: string[] = [];
    const aspects: string[] = [];
    const yogas: string[] = [];

    const getHouseFromRef = (rasi: string) => ((RASI_INDEX_MAP[rasi] ?? RASIS.indexOf(rasi)) - refRasiIdx + 12) % 12 + 1;

    const housePlanets: Record<number, string[]> = {};
    const houseAspects: Record<number, string[]> = {};
    for (let h = 1; h <= 12; h++) {
        housePlanets[h] = [];
        houseAspects[h] = [];
    }

    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const n = p.name;
        if (n === "Ascendant" || n === "Gulika" || n === "Mandi" || n === "Dhuma" || n === "Vyatipata" || n === "Parivesha" || n === "Indrachapa" || n === "Upaketu" || n === "Kala" || n === "Mrityu" || n === "Ardhaprahara" || n === "Yamaghantaka") continue;
        const h = getHouseFromRef(p.rasi);
        housePlanets[h].push(n);

        const status = p.vedha?.isObstructed ? ` (Obstructed by ${p.vedha.obstructingPlanet})` : "";
        placements.push(`${n} in House ${h} from ${refName}: ${getHouseTheme(h)}${status}`);

        const aspected = getAspectedHouses(n, h);
        for (let j = 0; j < aspected.length; j++) {
            houseAspects[aspected[j]].push(n);
        }

        if (n === "Sun" || n === "Moon" || n === "Mercury" || n === "Venus") {
            aspects.push(`${n} aspects House ${(h + 6) % 12 || 12} from ${refName}.`);
        } else if (n === "Mars") {
            aspects.push(`Mars aspects Houses ${(h + 3) % 12 || 12}, ${(h + 6) % 12 || 12}, and ${(h + 7) % 12 || 12} from ${refName}.`);
        } else if (n === "Jupiter" || n === "Rahu" || n === "Ketu") {
            aspects.push(`${n} aspects Houses ${(h + 4) % 12 || 12}, ${(h + 6) % 12 || 12}, and ${(h + 8) % 12 || 12} from ${refName}.`);
        } else if (n === "Saturn") {
            aspects.push(`Saturn aspects Houses ${(h + 2) % 12 || 12}, ${(h + 6) % 12 || 12}, and ${(h + 9) % 12 || 12} from ${refName}.`);
        }
    }

    const getP = (name: string) => planets.find(p => p.name === name);
    const jup = getP("Jupiter"), merc = getP("Mercury"), sun = getP("Sun"), ven = getP("Venus"), mars = getP("Mars");

    if (jup && ((RASI_INDEX_MAP[jup.rasi] ?? RASIS.indexOf(jup.rasi)) - refRasiIdx + 12) % 3 === 0) {
        yogas.push(`Gaja Kesari Yoga: Jupiter is in a quadrant from ${refName}. Brings wealth, intelligence, and lasting fame.`);
    }
    if (sun && merc && sun.rasi === merc.rasi) {
        yogas.push("Budha Aditya Yoga: Sun and Mercury conjunction. Enhances success and intellect.");
    }
    if (ven && ((RASI_INDEX_MAP[ven.rasi] ?? RASIS.indexOf(ven.rasi)) - refRasiIdx + 12) % 12 === 0) {
        yogas.push(`Malavya Yoga tendencies: Strong Venus influence on ${refName}. Artistic talents and comforts.`);
    }
    if (mars && jup && mars.rasi === jup.rasi) {
        yogas.push("Guru Mangala Yoga: Mars and Jupiter conjunction. Drive for leadership.");
    }

    const combined: CombinedPrediction[] = [];

    // --- 1. Career & Ambition ---
    const careerContributors: string[] = [];
    const pIn10 = housePlanets[10];
    const aIn10 = houseAspects[10];
    for (let k = 0; k < pIn10.length; k++) careerContributors.push(`${pIn10[k]} in House 10`);
    for (let k = 0; k < aIn10.length; k++) careerContributors.push(`${aIn10[k]} aspecting House 10`);
    if (sun) careerContributors.push(`Sun in House ${getHouseFromRef(sun.rasi)}`);
    if (jup) careerContributors.push(`Jupiter in House ${getHouseFromRef(jup.rasi)}`);

    let careerDesc = "Based on classical principles from Phaladeepika (Ch. 14), your professional path is undergoing a significant energetic shift. ";
    if (pIn10.length > 0) {
        careerDesc += `The presence of ${pIn10.join(" and ")} directly in your 10th house of career creates a highly active environment, magnifying your professional desires and bringing these specific energies directly to your workplace. `;
    } else {
        careerDesc += "Although no major planets are directly transiting your 10th house of career, the baseline professional sector remains stable, letting you focus on foundation building. ";
    }
    if (aIn10.length > 0) {
        careerDesc += `Furthermore, the aspects of ${aIn10.join(" and ")} onto the 10th house introduce external dynamics, driving you to adjust your strategies and balance your actions. `;
    }
    const sunHouse = sun ? getHouseFromRef(sun.rasi) : 1;
    careerDesc += `The Sun, signifying your core authority and career drive, is transiting House ${sunHouse} from ${refName}, focusing your daily awareness on ${getHouseTheme(sunHouse).toLowerCase()}`;

    combined.push({
        title: "Dharma & Career Progression",
        description: careerDesc,
        type: "Career & Ambition",
        contributors: careerContributors
    });

    // --- 2. Relationship & Social ---
    const relContributors: string[] = [];
    const pIn7 = housePlanets[7];
    const aIn7 = houseAspects[7];
    const pIn11 = housePlanets[11];
    for (let k = 0; k < pIn7.length; k++) relContributors.push(`${pIn7[k]} in House 7`);
    for (let k = 0; k < aIn7.length; k++) relContributors.push(`${aIn7[k]} aspecting House 7`);
    for (let k = 0; k < pIn11.length; k++) relContributors.push(`${pIn11[k]} in House 11`);
    if (ven) relContributors.push(`Venus in House ${getHouseFromRef(ven.rasi)}`);

    let relDesc = "Drawing from Sage Parashara's Brihat Parashara Hora Shastra (Ch. 18), your relationships and social alignments are being actively re-evaluated. ";
    if (pIn7.length > 0) {
        relDesc += `With ${pIn7.join(" and ")} occupying your 7th house of partnerships, there is a strong focus on one-on-one relationships, demands from partners, or collaborative efforts. `;
    } else {
        relDesc += "With the 7th house of partnerships free of direct transits, relationships progress in a stable, familiar manner, allowing you to cultivate mutual understanding. ";
    }
    if (aIn7.length > 0) {
        relDesc += `The aspects of ${aIn7.join(", ")} on the 7th house bring a mix of supportive or challenging external influences into your relational life, requiring mindful communication. `;
    }
    const venHouse = ven ? getHouseFromRef(ven.rasi) : 1;
    relDesc += `Venus, the significator of harmony and love, transits House ${venHouse} from ${refName}, adding a layer of ${getHouseTheme(venHouse).toLowerCase().replace('.', '')} to your emotional expression. `;
    if (pIn11.length > 0) {
        relDesc += `Additionally, the presence of ${pIn11.join(" and ")} in your 11th house of community and gains enhances your social circles and network support.`;
    }

    combined.push({
        title: "Kama & Relational Dynamics",
        description: relDesc,
        type: "Relationship & Social",
        contributors: relContributors
    });

    // --- 3. Financial & Fortune ---
    const finContributors: string[] = [];
    const pIn2 = housePlanets[2];
    const aIn2 = houseAspects[2];
    const pIn11_fin = housePlanets[11];
    const aIn11_fin = houseAspects[11];
    for (let k = 0; k < pIn2.length; k++) finContributors.push(`${pIn2[k]} in House 2`);
    for (let k = 0; k < aIn2.length; k++) finContributors.push(`${aIn2[k]} aspecting House 2`);
    for (let k = 0; k < pIn11_fin.length; k++) finContributors.push(`${pIn11_fin[k]} in House 11`);
    for (let k = 0; k < aIn11_fin.length; k++) finContributors.push(`${aIn11_fin[k]} aspecting House 11`);
    if (jup) finContributors.push(`Jupiter in House ${getHouseFromRef(jup.rasi)}`);

    let finDesc = "According to Jataka Parijata (Ch. 12), financial growth and prosperity depend on the active status of the 2nd (wealth) and 11th (gains) houses. ";
    if (pIn2.length > 0 || pIn11_fin.length > 0) {
        const combinedHouses = [...pIn2.map(p => `${p} in House 2`), ...pIn11_fin.map(p => `${p} in House 11`)];
        finDesc += `The transit of ${combinedHouses.join(" and ")} activates your primary wealth houses, suggesting direct changes or active engagement in financial planning, investments, or career gains. `;
    } else {
        finDesc += "As your 2nd and 11th houses are currently unoccupied, your finances remain on a steady trajectory without sudden, unexpected fluctuations, giving you space to refine your long-term budgets. ";
    }
    if (aIn2.length > 0 || aIn11_fin.length > 0) {
        const allAspects = [...aIn2.map(p => `${p} on House 2`), ...aIn11_fin.map(p => `${p} on House 11`)];
        finDesc += `Auspicious or heavy aspects by ${allAspects.join(" and ")} bring subtle energetic adjustments to your material resources, indicating that careful planning is highly beneficial. `;
    }
    const jupHouse = jup ? getHouseFromRef(jup.rasi) : 1;
    finDesc += `Jupiter, the natural karaka of wealth and expansion, is positioned in House ${jupHouse} from ${refName}, channeling growth, fortune, or deep wisdom toward ${getHouseTheme(jupHouse).toLowerCase()}`;

    combined.push({
        title: "Artha & Prosperity Forecast",
        description: finDesc,
        type: "Financial & Fortune",
        contributors: finContributors
    });

    // --- 4. Health & Vitality ---
    const healthContributors: string[] = [];
    const pIn1 = housePlanets[1];
    const pIn6 = housePlanets[6];
    const aIn1 = houseAspects[1];
    const aIn6 = houseAspects[6];
    for (let k = 0; k < pIn1.length; k++) healthContributors.push(`${pIn1[k]} in House 1`);
    for (let k = 0; k < pIn6.length; k++) healthContributors.push(`${pIn6[k]} in House 6`);
    for (let k = 0; k < aIn1.length; k++) healthContributors.push(`${aIn1[k]} aspecting House 1`);
    for (let k = 0; k < aIn6.length; k++) healthContributors.push(`${aIn6[k]} aspecting House 6`);
    if (mars) healthContributors.push(`Mars in House ${getHouseFromRef(mars.rasi)}`);

    let healthDesc = "Drawing from Brihat Parashara Hora Shastra (Ch. 11), your physical vitality and resilience are guided by the combined state of the 1st house of self and the 6th house of health/routines. ";
    if (pIn1.length > 0) {
        healthDesc += `The presence of ${pIn1.join(" and ")} directly in your 1st house strongly colors your physical energy, personality expression, and general well-being. `;
    } else {
        healthDesc += "Your 1st house is free of transiting planets, indicating stable health and vitality with no major sudden physical disruptions. ";
    }
    if (pIn6.length > 0) {
        healthDesc += `With ${pIn6.join(" and ")} transiting the 6th house, pay closer attention to daily routines, diet, and minor physical stressors. `;
    }
    if (aIn1.length > 0 || aIn6.length > 0) {
        const healthAspects = [...aIn1.map(p => `${p} aspecting House 1`), ...aIn6.map(p => `${p} aspecting House 6`)];
        healthDesc += `The aspects of ${healthAspects.join(" and ")} indicate external factors influencing your daily physical stamina and mental state. `;
    }
    const marsHouse = mars ? getHouseFromRef(mars.rasi) : 1;
    healthDesc += `Mars, casting its vitalizing and sharp energy, transits House ${marsHouse} from ${refName}, which brings a drive for physical action or a need to manage stress.`;

    combined.push({
        title: "Arogya & Vitality Alignment",
        description: healthDesc,
        type: "Health & Vitality",
        contributors: healthContributors
    });

    // --- 5. Spiritual & Inner Growth ---
    const spiritContributors: string[] = [];
    const pIn9 = housePlanets[9];
    const pIn12 = housePlanets[12];
    const aIn9 = houseAspects[9];
    const aIn12 = houseAspects[12];
    for (let k = 0; k < pIn9.length; k++) spiritContributors.push(`${pIn9[k]} in House 9`);
    for (let k = 0; k < pIn12.length; k++) spiritContributors.push(`${pIn12[k]} in House 12`);
    for (let k = 0; k < aIn9.length; k++) spiritContributors.push(`${aIn9[k]} aspecting House 9`);
    for (let k = 0; k < aIn12.length; k++) spiritContributors.push(`${aIn12[k]} aspecting House 12`);
    const ketu = getP("Ketu");
    if (ketu) spiritContributors.push(`Ketu in House ${getHouseFromRef(ketu.rasi)}`);

    let spiritDesc = "As guided by Phaladeepika (Ch. 20), spiritual expansion, higher wisdom, and the dissolution of ego are triggered when the 9th and 12th houses are activated. ";
    if (pIn9.length > 0 || pIn12.length > 0) {
        const spiritualHouses = [...pIn9.map(p => `${p} in House 9`), ...pIn12.map(p => `${p} in House 12`)];
        spiritDesc += `The transit of ${spiritualHouses.join(" and ")} stimulates your connection to higher learning, philosophy, or introspective practices. `;
    } else {
        spiritDesc += "With the 9th and 12th houses quiet, your spiritual journey is peaceful, focusing on stable, daily integration of existing wisdom rather than intense mystical experiences. ";
    }
    if (aIn9.length > 0 || aIn12.length > 0) {
        const spiritAspects = [...aIn9.map(p => `${p} aspecting House 9`), ...aIn12.map(p => `${p} aspecting House 12`)];
        spiritDesc += `The subtle aspect of ${spiritAspects.join(" and ")} encourages you to look within, seek quietude, and pursue philosophical studies. `;
    }
    const ketuHouse = ketu ? getHouseFromRef(ketu.rasi) : 1;
    spiritDesc += `Ketu, the cosmic indicator of detachment and moksha, is transiting House ${ketuHouse} from ${refName}, urging you to release worldly attachments and embrace a deeper sense of inner peace.`;

    combined.push({
        title: "Moksha & Spiritual Evolution",
        description: spiritDesc,
        type: "Spiritual & Inner Growth",
        contributors: spiritContributors
    });

    return { placements, aspects, yogas, combined };
}

export function generatePredictions(planets: PlanetData[], refPlanetName: "Moon" | "Ascendant" = "Moon"): Predictions {
    const refPlanet = planets.find(p => p.name === refPlanetName);
    if (!refPlanet) return { placements: [], aspects: [], yogas: [], combined: [] };
    const refRasiIdx = RASI_INDEX_MAP[refPlanet.rasi] ?? RASIS.indexOf(refPlanet.rasi);
    return generatePredictionsFromRasi(planets, refRasiIdx, refPlanetName);
}

const HOUSE_THEMES: { [key: number]: string } = {
    1: "Self and vitality.", 2: "Wealth and family.", 3: "Courage and communication.",
    4: "Home and peace.", 5: "Creativity and children.", 6: "Health and routines.",
    7: "Relationships and public.", 8: "Transformation and resources.", 9: "Wisdom and travel.",
    10: "Career and reputation.", 11: "Gains and social life.", 12: "Spirituality and expenses."
};

function getHouseTheme(house: number): string {
    return HOUSE_THEMES[house] || "General influences.";
}

const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const RASIS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const RASI_INDEX_MAP: Record<string, number> = { "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5, "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11 };
const PLANET_MAP = [
    { name: "Sun", body: Ast.Body.Sun, symbol: "Su" }, { name: "Moon", body: Ast.Body.Moon, symbol: "Mo" },
    { name: "Mars", body: Ast.Body.Mars, symbol: "Ma" }, { name: "Mercury", body: Ast.Body.Mercury, symbol: "Me" },
    { name: "Jupiter", body: Ast.Body.Jupiter, symbol: "Ju" }, { name: "Venus", body: Ast.Body.Venus, symbol: "Ve" },
    { name: "Saturn", body: Ast.Body.Saturn, symbol: "Sa" }, { name: "Uranus", body: Ast.Body.Uranus, symbol: "Ur" },
    { name: "Neptune", body: Ast.Body.Neptune, symbol: "Ne" }, { name: "Pluto", body: Ast.Body.Pluto, symbol: "Pl" }
];

export type AyanamsaType = 'Lahiri' | 'Raman' | 'Fagan-Bradley';
export function getAyanamsa(time: AstModule.AstroTime, type: AyanamsaType = 'Lahiri'): number {
    const T = time.tt / 36525.0;
    const lahiri = 23.85 + 1.39638 * T + 0.000308 * T * T;
    if (type === 'Raman') return lahiri - 1.45;
    if (type === 'Fagan-Bradley') return lahiri + 0.88;
    return lahiri;
}

export function getMeanRahu(time: AstModule.AstroTime): number {
    const T = time.tt / 36525.0;
    let n = 125.04452 - 1934.136261 * T + 0.0020708 * T * T;
    n %= 360; if (n < 0) n += 360;
    return n;
}

const KAKSHYA_LORDS = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon", "Lagna"];

const formatDegree = (deg: number) => `${Math.floor(deg)}° ${Math.floor((deg % 1) * 60)}'`;

export function calculateTransits(date: Date, lat: number = 28.6139, lon: number = 77.2090, birthDetails?: { date: Date, lat: number, lon: number }, ayanamsaType: AyanamsaType = 'Lahiri', refPlanet: string = "Ascendant"): {
    planets: PlanetData[],
    upgrahas?: PlanetData[],
    d1: DivisionalChartData,
    d9: DivisionalChartData,
    d60: DivisionalChartData,
    d1Asc: DivisionalChartData,
    d9Asc: DivisionalChartData,
    d60Asc: DivisionalChartData,
    d1WithUpgrahas?: DivisionalChartData,
    d9WithUpgrahas?: DivisionalChartData,
    d60WithUpgrahas?: DivisionalChartData,
    d1WithUpgrahasAsc?: DivisionalChartData,
    d9WithUpgrahasAsc?: DivisionalChartData,
    d60WithUpgrahasAsc?: DivisionalChartData,
    predictionsMoon: Predictions,
    predictionsLagna: Predictions,
    dasha?: DashaInfo,
    sadeSati?: SadeSatiInfo,
    gocharaScore: number,
    remedies: Remedy[],
    ashtakavarga?: AshtakavargaData
} {
    // LRU Cache mechanism
    const birthKey = birthDetails ? `${birthDetails.date.getTime()}_${birthDetails.lat}_${birthDetails.lon}` : 'none';
    const cacheKey = `${date.getTime()}_${lat}_${lon}_${birthKey}_${ayanamsaType}_${refPlanet}`;

    const cachedResult = TRANSIT_CACHE.get(cacheKey);
    if (cachedResult) {
        // Refresh position for LRU
        TRANSIT_CACHE.delete(cacheKey);
        TRANSIT_CACHE.set(cacheKey, cachedResult);
        return cachedResult;
    }
    const time = Ast.MakeTime(date), ayanamsa = getAyanamsa(time, ayanamsaType);
    const calcLagna = (t: AstModule.AstroTime) => {
        const RAMC = (Ast.SiderealTime(t) * 15 + lon) % 360, eps = Math.acos(Ast.Rotation_ECL_EQD(t).rot[2][2]);
        const alpha = RAMC * Math.PI / 180, phi = lat * Math.PI / 180;
        const l_trop = (Math.atan2(Math.cos(alpha), -(Math.sin(alpha) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * 180 / Math.PI + 360) % 360;
        return (l_trop - ayanamsa + 360) % 360;
    };
    const lagnaSid = calcLagna(time), lagnaIdx = Math.floor(lagnaSid / 30);
    const raw: Array<{ name: string, symbol: string, longitude: number, degree: string, rasiIdx: number, isRetrograde: boolean, isCombust?: boolean, kakshya?: string, pada: number }> = [], timeDelta = time.AddDays(0.1);

    // Bolt Optimization: Replace `.forEach` with standard `for` loop to prevent closure creation per iteration
    for (let i = 0; i < PLANET_MAP.length; i++) {
        const p = PLANET_MAP[i];
        const pos = Ast.GeoVector(p.body, time, true), ecl = Ast.Ecliptic(pos), sidereal = (ecl.elon - ayanamsa + 360) % 360;
        const posDelta = Ast.GeoVector(p.body, timeDelta, true), eclDelta = Ast.Ecliptic(posDelta);
        let diff = eclDelta.elon - ecl.elon; if (diff > 180) diff -= 360; if (diff < -180) diff += 360;

        const rasiDeg = sidereal % 30;
        const kakshyaIdx = Math.floor(rasiDeg / 3.75);
        const nakshatraDeg = 360 / 27;
        const pada = Math.floor((sidereal % nakshatraDeg) / (nakshatraDeg / 4)) + 1;

        raw.push({
            name: p.name,
            symbol: p.symbol,
            longitude: sidereal,
            degree: formatDegree(rasiDeg),
            rasiIdx: Math.floor(sidereal / 30),
            isRetrograde: (p.name !== "Sun" && p.name !== "Moon" && diff < 0),
            kakshya: KAKSHYA_LORDS[kakshyaIdx],
            pada
        });
    }

    const sun = raw.find(p => p.name === "Sun");
    if (sun) {
        for (let i = 0; i < raw.length; i++) {
            const p = raw[i];
            const n = p.name;
            if (n === "Mars" || n === "Mercury" || n === "Jupiter" || n === "Venus" || n === "Saturn") {
                let dist = Math.abs(p.longitude - sun.longitude);
                if (dist > 180) dist = 360 - dist;
                let limit = 0;
                if (n === "Mars") limit = 17;
                else if (n === "Mercury") limit = p.isRetrograde ? 12 : 14;
                else if (n === "Jupiter") limit = 11;
                else if (n === "Venus") limit = p.isRetrograde ? 8 : 10;
                else if (n === "Saturn") limit = 15;
                p.isCombust = dist < limit;
            }
        }
    }

    const rahuSid = (getMeanRahu(time) - ayanamsa + 360) % 360;
    const rRasiDeg = rahuSid % 30;
    const kRasiDeg = (rahuSid + 180) % 360 % 30;
    const nDeg = 360/27;
    raw.push({ name: "Rahu", symbol: "Ra", longitude: rahuSid, degree: formatDegree(rRasiDeg), rasiIdx: Math.floor(rahuSid / 30), isRetrograde: true, kakshya: KAKSHYA_LORDS[Math.floor(rRasiDeg / 3.75)], pada: Math.floor((rahuSid % nDeg) / (nDeg / 4)) + 1 });
    raw.push({ name: "Ketu", symbol: "Ke", longitude: (rahuSid + 180) % 360, degree: formatDegree(kRasiDeg), rasiIdx: Math.floor(((rahuSid + 180) % 360) / 30), isRetrograde: true, kakshya: KAKSHYA_LORDS[Math.floor(kRasiDeg / 3.75)], pada: Math.floor(((rahuSid + 180) % 360 % nDeg) / (nDeg / 4)) + 1 });

    let refRasi = lagnaIdx;
    if (refPlanet === "Moon") { const m = raw.find(p => p.name === "Moon"); if (m) refRasi = m.rasiIdx; }
    else if (refPlanet !== "Ascendant") { const r = raw.find(p => p.name === refPlanet); if (r) refRasi = r.rasiIdx; }

    const lagnaRasiDeg = lagnaSid % 30;
    const planets: PlanetData[] = [{
        name: "Ascendant",
        symbol: "As",
        longitude: lagnaSid,
        degree: formatDegree(lagnaRasiDeg),
        rasi: RASIS[lagnaIdx],
        house: (lagnaIdx - refRasi + 12) % 12 + 1,
        nakshatra: NAKSHATRAS[Math.floor(lagnaSid / (360 / 27))],
        pada: Math.floor((lagnaSid % (360/27)) / ((360/27) / 4)) + 1,
        isRetrograde: false,
        kakshya: KAKSHYA_LORDS[Math.floor(lagnaRasiDeg / 3.75)]
    }];
    // Bolt Optimization: Replace `.forEach` with standard `for` loop
    for (let i = 0; i < raw.length; i++) {
        const p = raw[i];
        planets.push({ ...p, rasi: RASIS[p.rasiIdx], house: (p.rasiIdx - refRasi + 12) % 12 + 1, nakshatra: NAKSHATRAS[Math.floor(p.longitude / (360 / 27))] });
    }

    const d1: DivisionalChartData = { houses: {}, houseRasis: {} }, d9: DivisionalChartData = { houses: {}, houseRasis: {} }, d60: DivisionalChartData = { houses: {}, houseRasis: {} };
    const d1Asc: DivisionalChartData = { houses: {}, houseRasis: {} }, d9Asc: DivisionalChartData = { houses: {}, houseRasis: {} }, d60Asc: DivisionalChartData = { houses: {}, houseRasis: {} };

    // Bolt Optimization: Replace `.find` with standard `for` loop
    let mLong = lagnaSid;
    for (let i = 0; i < raw.length; i++) {
        if (raw[i].name === "Moon") {
            mLong = raw[i].longitude;
            break;
        }
    }
    const refD9 = getD9Rasi(refPlanet === "Moon" ? mLong : lagnaSid), refD60 = getD60Rasi(refPlanet === "Moon" ? mLong : lagnaSid);
    const refD9Asc = getD9Rasi(lagnaSid), refD60Asc = getD60Rasi(lagnaSid);

    for (let i = 1; i <= 12; i++) {
        d1.houses[i] = []; d1.houseRasis[i] = (refRasi + i - 1) % 12 + 1;
        d9.houses[i] = []; d9.houseRasis[i] = (refD9 + i - 1) % 12 + 1;
        d60.houses[i] = []; d60.houseRasis[i] = (refD60 + i - 1) % 12 + 1;

        d1Asc.houses[i] = []; d1Asc.houseRasis[i] = (lagnaIdx + i - 1) % 12 + 1;
        d9Asc.houses[i] = []; d9Asc.houseRasis[i] = (refD9Asc + i - 1) % 12 + 1;
        d60Asc.houses[i] = []; d60Asc.houseRasis[i] = (refD60Asc + i - 1) % 12 + 1;
    }
    // Bolt Optimization: Replace `.forEach` with standard `for` loop
    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        if (p.house >= 1 && p.house <= 12) d1.houses[p.house].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        const h9 = (getD9Rasi(p.longitude) - refD9 + 12) % 12 + 1; if (h9 >= 1 && h9 <= 12) d9.houses[h9].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        const h60 = (getD60Rasi(p.longitude) - refD60 + 12) % 12 + 1; if (h60 >= 1 && h60 <= 12) d60.houses[h60].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });

        // Ascendant-based placements
        const pRasiIdx = RASI_INDEX_MAP[p.rasi] ?? RASIS.indexOf(p.rasi);
        const h1_asc = (pRasiIdx - lagnaIdx + 12) % 12 + 1;
        if (h1_asc >= 1 && h1_asc <= 12) d1Asc.houses[h1_asc].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        const h9_asc = (getD9Rasi(p.longitude) - refD9Asc + 12) % 12 + 1; if (h9_asc >= 1 && h9_asc <= 12) d9Asc.houses[h9_asc].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        const h60_asc = (getD60Rasi(p.longitude) - refD60Asc + 12) % 12 + 1; if (h60_asc >= 1 && h60_asc <= 12) d60Asc.houses[h60_asc].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
    }

    let dasha, sadeSati, ashtakavarga;
    if (birthDetails) {
        const b = calculateTransits(birthDetails.date, birthDetails.lat, birthDetails.lon);
        const nMoon = b.planets.find(p => p.name === "Moon");
        if (nMoon) {
            dasha = calculateVimshottariDasha(birthDetails.date, nMoon.longitude, date);
            const tSat = planets.find(p => p.name === "Saturn");
            if (tSat) sadeSati = calculateSadeSati(nMoon.longitude, tSat.longitude);
        }
        ashtakavarga = calculateAshtakavarga(b.planets);
    }
    // Bolt Optimization: Replace `.find` with standard `for` loop
    let moonRasi = "Aries";
    for (let i = 0; i < planets.length; i++) {
        if (planets[i].name === "Moon") {
            moonRasi = planets[i].rasi;
            break;
        }
    }
    const moonIdx = RASI_INDEX_MAP[moonRasi] ?? RASIS.indexOf(moonRasi);
    const planetsFromMoon = planets.map(p => ({ ...p, house: ((RASI_INDEX_MAP[p.rasi] ?? RASIS.indexOf(p.rasi)) - moonIdx + 12) % 12 + 1 }));
    for (let i = 0; i < planetsFromMoon.length; i++) {
        const p = planetsFromMoon[i];
        const n = p.name;
        // Bolt Optimization: Replace inline `.includes` with boolean checks
        if (n === "Sun" || n === "Moon" || n === "Mars" || n === "Mercury" || n === "Jupiter" || n === "Venus" || n === "Saturn") {
            p.vedha = checkVedha(p, planetsFromMoon);
            // Bolt Optimization: Direct parallel index assignment instead of O(N) array .find
            planets[i].vedha = p.vedha;
        }
    }

    // Bolt Optimization: Replace `.find` with standard `for` loop
    let ascRasi = "Aries";
    for (let i = 0; i < planets.length; i++) {
        if (planets[i].name === "Ascendant") {
            ascRasi = planets[i].rasi;
            break;
        }
    }
    const ascIdx = RASI_INDEX_MAP[ascRasi] ?? RASIS.indexOf(ascRasi);
    const planetsFromLagna = planets.map(p => ({ ...p, house: ((RASI_INDEX_MAP[p.rasi] ?? RASIS.indexOf(p.rasi)) - ascIdx + 12) % 12 + 1 }));

    const result = {
        planets,
        d1,
        d9,
        d60,
        d1Asc,
        d9Asc,
        d60Asc,
        predictionsMoon: generatePredictions(planetsFromMoon, "Moon"),
        predictionsLagna: generatePredictions(planetsFromLagna, "Ascendant"),
        dasha,
        sadeSati,
        gocharaScore: calculateGocharaScore(planetsFromMoon, dasha, ashtakavarga),
        remedies: getRemedies(planetsFromMoon, dasha, sadeSati),
        ashtakavarga,
        get upgrahas() { computeUpgrahas(); return _upgrahas; },
        get d1WithUpgrahas() { computeUpgrahas(); return _d1WithUpgrahas; },
        get d9WithUpgrahas() { computeUpgrahas(); return _d9WithUpgrahas; },
        get d60WithUpgrahas() { computeUpgrahas(); return _d60WithUpgrahas; },
        get d1WithUpgrahasAsc() { computeUpgrahas(); return _d1WithUpgrahasAsc; },
        get d9WithUpgrahasAsc() { computeUpgrahas(); return _d9WithUpgrahasAsc; },
        get d60WithUpgrahasAsc() { computeUpgrahas(); return _d60WithUpgrahasAsc; }
    };

    let _upgrahasCalculated = false;
    let _upgrahas: PlanetData[] = [];
    let _d1WithUpgrahas: DivisionalChartData;
    let _d9WithUpgrahas: DivisionalChartData;
    let _d60WithUpgrahas: DivisionalChartData;
    let _d1WithUpgrahasAsc: DivisionalChartData;
    let _d9WithUpgrahasAsc: DivisionalChartData;
    let _d60WithUpgrahasAsc: DivisionalChartData;

    function computeUpgrahas() {
        if (_upgrahasCalculated) return;
        _upgrahasCalculated = true;

        let sunLong = 0;
        for (let i = 0; i < planets.length; i++) {
            if (planets[i].name === "Sun") {
                sunLong = planets[i].longitude;
                break;
            }
        }
        _upgrahas = calculateUpgrahas(date, lat, lon, sunLong, ayanamsaType, refRasi);

        _d1WithUpgrahas = { houses: {}, houseRasis: { ...d1.houseRasis } };
        _d9WithUpgrahas = { houses: {}, houseRasis: { ...d9.houseRasis } };
        _d60WithUpgrahas = { houses: {}, houseRasis: { ...d60.houseRasis } };

        _d1WithUpgrahasAsc = { houses: {}, houseRasis: { ...d1Asc.houseRasis } };
        _d9WithUpgrahasAsc = { houses: {}, houseRasis: { ...d9Asc.houseRasis } };
        _d60WithUpgrahasAsc = { houses: {}, houseRasis: { ...d60Asc.houseRasis } };

        for (let i = 1; i <= 12; i++) {
            _d1WithUpgrahas.houses[i] = [...d1.houses[i]];
            _d9WithUpgrahas.houses[i] = [...d9.houses[i]];
            _d60WithUpgrahas.houses[i] = [...d60.houses[i]];

            _d1WithUpgrahasAsc.houses[i] = [...d1Asc.houses[i]];
            _d9WithUpgrahasAsc.houses[i] = [...d9Asc.houses[i]];
            _d60WithUpgrahasAsc.houses[i] = [...d60Asc.houses[i]];
        }

        for (let i = 0; i < _upgrahas.length; i++) {
            const p = _upgrahas[i];
            if (p.house >= 1 && p.house <= 12) {
                _d1WithUpgrahas.houses[p.house].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
            }
            const h9 = (getD9Rasi(p.longitude) - refD9 + 12) % 12 + 1;
            if (h9 >= 1 && h9 <= 12) {
                _d9WithUpgrahas.houses[h9].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
            }
            const h60 = (getD60Rasi(p.longitude) - refD60 + 12) % 12 + 1;
            if (h60 >= 1 && h60 <= 12) {
                _d60WithUpgrahas.houses[h60].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
            }

            // Ascendant-based placements for Upgrahas
            const upgrahaRasiIdx = RASI_INDEX_MAP[p.rasi] ?? RASIS.indexOf(p.rasi);
            const h1_asc = (upgrahaRasiIdx - lagnaIdx + 12) % 12 + 1;
            if (h1_asc >= 1 && h1_asc <= 12) {
                _d1WithUpgrahasAsc.houses[h1_asc].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
            }
            const h9_asc = (getD9Rasi(p.longitude) - refD9Asc + 12) % 12 + 1;
            if (h9_asc >= 1 && h9_asc <= 12) {
                _d9WithUpgrahasAsc.houses[h9_asc].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
            }
            const h60_asc = (getD60Rasi(p.longitude) - refD60Asc + 12) % 12 + 1;
            if (h60_asc >= 1 && h60_asc <= 12) {
                _d60WithUpgrahasAsc.houses[h60_asc].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
            }
        }
    }



    TRANSIT_CACHE.set(cacheKey, result);
    if (TRANSIT_CACHE.size > 200) {
        const firstKey = TRANSIT_CACHE.keys().next().value;
        if (firstKey !== undefined) {
            TRANSIT_CACHE.delete(firstKey);
        }
    }

    return result;
}

const ASHTAKAVARGA_RULES: { [key: string]: { [key: string]: number[] } } = {
    "Sun": { "Sun": [1, 2, 4, 7, 8, 9, 10, 11], "Moon": [3, 6, 10, 11], "Mars": [1, 2, 4, 7, 8, 9, 10, 11], "Mercury": [3, 5, 6, 9, 10, 11, 12], "Jupiter": [5, 6, 9, 11], "Venus": [6, 7, 12], "Saturn": [1, 2, 4, 7, 8, 9, 10, 11], "Ascendant": [3, 4, 6, 10, 11, 12] },
    "Moon": { "Sun": [3, 6, 7, 8, 10, 11], "Moon": [1, 3, 6, 7, 10, 11], "Mars": [2, 3, 5, 6, 9, 10, 11], "Mercury": [1, 3, 4, 5, 7, 8, 10, 11], "Jupiter": [1, 4, 7, 8, 10, 11, 12], "Venus": [3, 4, 5, 7, 9, 10, 11], "Saturn": [3, 5, 6, 11], "Ascendant": [3, 6, 10, 11] },
    "Mars": { "Sun": [3, 5, 6, 10, 11], "Moon": [3, 6, 11], "Mars": [1, 2, 4, 7, 8, 10, 11], "Mercury": [3, 5, 6, 11], "Jupiter": [6, 10, 11, 12], "Venus": [6, 8, 11, 12], "Saturn": [1, 4, 7, 8, 9, 10, 11], "Ascendant": [1, 3, 6, 10, 11] },
    "Mercury": { "Sun": [5, 6, 9, 11, 12], "Moon": [2, 4, 6, 8, 10, 11], "Mars": [1, 2, 4, 7, 8, 9, 10, 11], "Mercury": [1, 3, 5, 6, 9, 10, 11, 12], "Jupiter": [6, 8, 11, 12], "Venus": [1, 2, 3, 4, 5, 8, 9, 11], "Saturn": [1, 2, 4, 7, 8, 9, 10, 11], "Ascendant": [1, 2, 4, 6, 8, 10, 11] },
    "Jupiter": { "Sun": [1, 2, 3, 4, 7, 8, 9, 10, 11], "Moon": [2, 5, 7, 9, 11], "Mars": [1, 2, 4, 7, 8, 10, 11], "Mercury": [1, 2, 4, 5, 6, 9, 10, 11], "Jupiter": [1, 2, 3, 4, 7, 8, 10, 11], "Venus": [2, 5, 6, 9, 10, 11], "Saturn": [3, 5, 6, 12], "Ascendant": [1, 2, 4, 5, 6, 7, 9, 10, 11] },
    "Venus": { "Sun": [8, 11, 12], "Moon": [1, 2, 3, 4, 5, 8, 9, 11, 12], "Mars": [3, 5, 6, 9, 11, 12], "Mercury": [3, 5, 6, 9, 11], "Jupiter": [5, 8, 9, 10, 11], "Venus": [1, 2, 3, 4, 5, 8, 9, 10, 11], "Saturn": [3, 4, 5, 8, 9, 10, 11], "Ascendant": [1, 2, 3, 4, 5, 8, 9, 11] },
    "Saturn": { "Sun": [1, 2, 4, 7, 8, 10, 11], "Moon": [3, 6, 11], "Mars": [3, 5, 6, 10, 11, 12], "Mercury": [6, 8, 9, 10, 11, 12], "Jupiter": [5, 6, 11, 12], "Venus": [6, 11, 12], "Saturn": [3, 5, 6, 11], "Ascendant": [1, 3, 4, 6, 10, 11] }
};

const ASHTAKAVARGA_MAIN = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const ASHTAKAVARGA_SRC = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Ascendant"];

const ASHTAKAVARGA_BITMAPS: Int32Array[] = [];
for (let j = 0; j < ASHTAKAVARGA_MAIN.length; j++) {
    const p = ASHTAKAVARGA_MAIN[j];
    const srcArray = new Int32Array(8);
    for (let k = 0; k < ASHTAKAVARGA_SRC.length; k++) {
        const src = ASHTAKAVARGA_SRC[k];
        let bitmap = 0;
        for (const house of ASHTAKAVARGA_RULES[p][src]) {
            bitmap |= (1 << (house - 1));
        }
        srcArray[k] = bitmap;
    }
    ASHTAKAVARGA_BITMAPS.push(srcArray);
}

function calculateAshtakavarga(natal: PlanetData[]): AshtakavargaData {
    // ⚡ Bolt Optimization: Uses precomputed Int32Array bitmasks (ASHTAKAVARGA_BITMAPS) instead of dynamically looping over
    // object hierarchies. Bitwise checks (`rule & (1 << offset)`) inside unrolled loops replace `Array.prototype.includes`.
    // Avoids creating `new Array(12).fill(0)` in each inner loop execution, vastly reducing GC pressure in hot paths.
    const sav = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let r0 = 0, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0, r6 = 0, r7 = 0;

    const nLen = natal.length;
    for (let j = 0; j < nLen; j++) {
        const n = natal[j].name;
        const rasi = Math.floor(natal[j].longitude / 30);
        if (n === "Sun") r0 = rasi;
        else if (n === "Moon") r1 = rasi;
        else if (n === "Mars") r2 = rasi;
        else if (n === "Mercury") r3 = rasi;
        else if (n === "Jupiter") r4 = rasi;
        else if (n === "Venus") r5 = rasi;
        else if (n === "Saturn") r6 = rasi;
        else if (n === "Ascendant") r7 = rasi;
    }

    const bav: { [key: string]: number[] } = {
        Sun: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Moon: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Mars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Mercury: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Jupiter: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Venus: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        Saturn: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };

    for (let j = 0; j < 7; j++) {
        const s = bav[ASHTAKAVARGA_MAIN[j]];
        const rulesForP = ASHTAKAVARGA_BITMAPS[j];
        const rule0 = rulesForP[0], rule1 = rulesForP[1], rule2 = rulesForP[2], rule3 = rulesForP[3];
        const rule4 = rulesForP[4], rule5 = rulesForP[5], rule6 = rulesForP[6], rule7 = rulesForP[7];

        for (let i = 0; i < 12; i++) {
            let score = 0;
            if ((rule0 & (1 << ((i - r0 + 12) % 12))) !== 0) score++;
            if ((rule1 & (1 << ((i - r1 + 12) % 12))) !== 0) score++;
            if ((rule2 & (1 << ((i - r2 + 12) % 12))) !== 0) score++;
            if ((rule3 & (1 << ((i - r3 + 12) % 12))) !== 0) score++;
            if ((rule4 & (1 << ((i - r4 + 12) % 12))) !== 0) score++;
            if ((rule5 & (1 << ((i - r5 + 12) % 12))) !== 0) score++;
            if ((rule6 & (1 << ((i - r6 + 12) % 12))) !== 0) score++;
            if ((rule7 & (1 << ((i - r7 + 12) % 12))) !== 0) score++;

            s[i] = score;
            sav[i] += score;
        }
    }
    return { bav, sav };
}

const VEDHA_PAIRS: { [key: string]: { [key: number]: number } } = { "Sun": { 3: 9, 6: 12, 10: 4, 11: 5, 9: 3, 12: 6, 4: 10, 5: 11 }, "Moon": { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8, 5: 1, 9: 3, 12: 6, 2: 7, 4: 10, 8: 11 }, "Mars": { 3: 12, 6: 9, 11: 5, 12: 3, 9: 6, 5: 11 }, "Mercury": { 2: 5, 4: 3, 6: 9, 8: 1, 10: 7, 11: 12, 5: 2, 3: 4, 9: 6, 1: 8, 7: 10, 12: 11 }, "Jupiter": { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8, 12: 2, 4: 5, 3: 7, 10: 9, 8: 11 }, "Venus": { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 1, 9: 5, 10: 4, 11: 3, 12: 6, 7: 2, 6: 12 }, "Saturn": { 3: 12, 6: 9, 11: 5, 12: 3, 9: 6, 5: 11 } };

function checkVedha(p: PlanetData, all: PlanetData[]): { isObstructed: boolean, obstructingPlanet?: string } {
    // ⚡ Bolt Optimization: Switched from `all.find(...)` to a standard `for` loop to prevent creating an arrow function
    // closure each time this runs, reducing overhead and memory allocations.
    const pName = p.name;
    const vH = VEDHA_PAIRS[pName]?.[p.house];
    if (!vH) return { isObstructed: false };

    for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o.house === vH && o.name !== pName && o.name !== "Ascendant") {
            const oName = o.name;
            if ((pName === "Sun" && oName === "Saturn") || (pName === "Saturn" && oName === "Sun")) return { isObstructed: false };
            if ((pName === "Moon" && oName === "Mercury") || (pName === "Mercury" && oName === "Moon")) return { isObstructed: false };
            return { isObstructed: true, obstructingPlanet: oName };
        }
    }
    return { isObstructed: false };
}
