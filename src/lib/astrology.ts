import * as AstModule from 'astronomy-engine';

// Workaround for ESM/CJS interop
const Ast = (AstModule as unknown as { default: typeof AstModule }).default || AstModule;


const TRANSIT_CACHE = new Map<string, {
    planets: PlanetData[], d1: DivisionalChartData, d9: DivisionalChartData, d60: DivisionalChartData,
    predictionsMoon: Predictions, predictionsLagna: Predictions, dasha?: DashaInfo, sadeSati?: SadeSatiInfo, gocharaScore: number, remedies: Remedy[], ashtakavarga?: AshtakavargaData
}>();

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

export interface Predictions {
    placements: string[];
    aspects: string[];
    yogas: string[];
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

    planets.forEach(p => {
        if (p.vedha?.isObstructed) {
            remedies.push(getPlanetRemedy(p.name, `Obstructed ${p.name} Transit`));
        }
        if (p.isRetrograde && ["Mars", "Saturn", "Rahu", "Ketu"].includes(p.name)) {
            remedies.push(getPlanetRemedy(p.name, `Retrograde ${p.name}`));
        }
        if (["Mars", "Saturn", "Rahu", "Ketu"].includes(p.name) && [1, 2, 4, 5, 7, 8, 9, 12].includes(p.house)) {
            remedies.push(getPlanetRemedy(p.name, `${p.name} in House ${p.house}`));
        }
    });

    return remedies.filter((v, i, a) => a.findIndex(t => t.planet === v.planet && t.condition === v.condition) === i).slice(0, 6);
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

export function calculateGocharaScore(planets: PlanetData[], dasha?: DashaInfo, ashtakavarga?: AshtakavargaData): number {
    let score = 50;

    planets.forEach(p => {
        if (p.name === "Ascendant") return;

        let planetScore = 0;
        const isBenefic = ["Jupiter", "Venus", "Mercury", "Moon"].includes(p.name);
        const house = p.house;

        if (isBenefic) {
            if ([1, 2, 4, 5, 7, 9, 10, 11].includes(house)) planetScore += 8;
            else planetScore -= 4;
        } else {
            if ([3, 6, 11].includes(house)) planetScore += 10;
            else planetScore -= 6;
        }

        if (p.vedha?.isObstructed) {
            planetScore = planetScore > 0 ? planetScore * 0.2 : planetScore;
        }

        if (ashtakavarga && ashtakavarga.bav[p.name]) {
            const rasiIdx = RASIS.indexOf(p.rasi);
            const bindus = ashtakavarga.bav[p.name][rasiIdx];
            if (bindus >= 5) planetScore += 5;
            else if (bindus <= 3) planetScore -= 5;
        }

        score += planetScore;
    });

    if (dasha) {
        const dashaLord = planets.find(p => p.name === dasha.mahadasha.lord);
        if (dashaLord && [1, 5, 9, 10, 11].includes(dashaLord.house)) score += 15;
    }

    return Math.min(Math.max(score, 0), 100);
}

const DASHA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const DASHA_PERIODS = [7, 20, 6, 10, 7, 18, 16, 19, 17];

export function calculateVimshottariDasha(birthDate: Date, moonLongitude: number, targetDate: Date = new Date()): DashaInfo {
    const totalCycle = 120, nakshatraLength = 360 / 27;

    const nakshatraIndex = Math.floor(moonLongitude / nakshatraLength);
    const lordIndex = nakshatraIndex % 9;
    const passedInNakshatra = (moonLongitude % nakshatraLength) / nakshatraLength;

    const firstDashaTotalYears = DASHA_PERIODS[lordIndex];
    const firstDashaRemainingYears = firstDashaTotalYears * (1 - passedInNakshatra);

    let currentDate = new Date(birthDate);
    let dashaEnd = new Date(currentDate);
    dashaEnd.setFullYear(dashaEnd.getFullYear() + Math.floor(firstDashaRemainingYears));
    dashaEnd.setMonth(dashaEnd.getMonth() + Math.floor((firstDashaRemainingYears % 1) * 12));

    let currentLordIndex = lordIndex;
    while (dashaEnd < targetDate) {
        currentDate = new Date(dashaEnd);
        currentLordIndex = (currentLordIndex + 1) % 9;
        const years = DASHA_PERIODS[currentLordIndex];
        dashaEnd = new Date(currentDate);
        dashaEnd.setFullYear(dashaEnd.getFullYear() + years);
    }

    const currentMahadasha = { lord: DASHA_LORDS[currentLordIndex], start: new Date(currentDate), end: new Date(dashaEnd) };

    const mdDurationMs = dashaEnd.getTime() - currentDate.getTime();
    let adStart = new Date(currentDate);
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
                    return { mahadasha: currentMahadasha, antardasha: currentAD, pratyantardasha: { lord: pdLord, start: pdStart, end: pdEnd } };
                }
                pdStart = pdEnd;
            }
            return { mahadasha: currentMahadasha, antardasha: currentAD, pratyantardasha: { lord: adLord, start: adStart, end: adEnd } };
        }
        adStart = adEnd;
    }
    const fallback = { lord: DASHA_LORDS[currentLordIndex], start: currentDate, end: dashaEnd };
    return { mahadasha: currentMahadasha, antardasha: fallback, pratyantardasha: fallback };
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

export function generatePredictions(planets: PlanetData[], refPlanetName: "Moon" | "Ascendant" = "Moon"): Predictions {
    const placements: string[] = [];
    const aspects: string[] = [];
    const yogas: string[] = [];

    const refPlanet = planets.find(p => p.name === refPlanetName);
    if (!refPlanet) return { placements, aspects, yogas };

    const refRasiIdx = RASIS.indexOf(refPlanet.rasi);
    const getHouseFromRef = (rasi: string) => (RASIS.indexOf(rasi) - refRasiIdx + 12) % 12 + 1;

    planets.forEach(p => {
        if (["Ascendant", "Gulika", "Mandi"].includes(p.name)) return;
        const h = getHouseFromRef(p.rasi);
        const status = p.vedha?.isObstructed ? ` (Obstructed by ${p.vedha.obstructingPlanet})` : "";
        placements.push(`${p.name} in House ${h} from ${refPlanetName}: ${getHouseTheme(h)}${status}`);

        if (["Sun", "Moon", "Mercury", "Venus"].includes(p.name)) {
            aspects.push(`${p.name} aspects House ${(h + 6) % 12 || 12} from ${refPlanetName}.`);
        } else if (p.name === "Mars") {
            aspects.push(`Mars aspects Houses ${(h + 3) % 12 || 12}, ${(h + 6) % 12 || 12}, and ${(h + 7) % 12 || 12} from ${refPlanetName}.`);
        } else if (["Jupiter", "Rahu", "Ketu"].includes(p.name)) {
            aspects.push(`${p.name} aspects Houses ${(h + 4) % 12 || 12}, ${(h + 6) % 12 || 12}, and ${(h + 8) % 12 || 12} from ${refPlanetName}.`);
        } else if (p.name === "Saturn") {
            aspects.push(`Saturn aspects Houses ${(h + 2) % 12 || 12}, ${(h + 6) % 12 || 12}, and ${(h + 9) % 12 || 12} from ${refPlanetName}.`);
        }
    });

    const getP = (name: string) => planets.find(p => p.name === name);
    const jup = getP("Jupiter"), merc = getP("Mercury"), sun = getP("Sun"), ven = getP("Venus"), mars = getP("Mars");

    if (jup && refPlanet && (RASIS.indexOf(jup.rasi) - RASIS.indexOf(refPlanet.rasi) + 12) % 3 === 0) {
        yogas.push(`Gaja Kesari Yoga: Jupiter is in a quadrant from ${refPlanetName}. Brings wealth, intelligence, and lasting fame.`);
    }
    if (sun && merc && sun.rasi === merc.rasi) {
        yogas.push("Budha Aditya Yoga: Sun and Mercury conjunction. Enhances success and intellect.");
    }
    if (ven && refPlanet && (RASIS.indexOf(ven.rasi) - RASIS.indexOf(refPlanet.rasi) + 12) % 12 === 0) {
        yogas.push(`Malavya Yoga tendencies: Strong Venus influence on ${refPlanetName}. Artistic talents and comforts.`);
    }
    if (mars && jup && mars.rasi === jup.rasi) {
        yogas.push("Guru Mangala Yoga: Mars and Jupiter conjunction. Drive for leadership.");
    }

    return { placements, aspects, yogas };
}

function getHouseTheme(house: number): string {
    const themes: { [key: number]: string } = {
        1: "Self and vitality.", 2: "Wealth and family.", 3: "Courage and communication.",
        4: "Home and peace.", 5: "Creativity and children.", 6: "Health and routines.",
        7: "Relationships and public.", 8: "Transformation and resources.", 9: "Wisdom and travel.",
        10: "Career and reputation.", 11: "Gains and social life.", 12: "Spirituality and expenses."
    };
    return themes[house] || "General influences.";
}

const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const RASIS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
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

const formatDegree = (deg: number) => `${Math.floor(deg)}° ${Math.floor((deg % 1) * 60)}'`;

export function calculateTransits(date: Date, lat: number = 28.6139, lon: number = 77.2090, birthDetails?: { date: Date, lat: number, lon: number }, ayanamsaType: AyanamsaType = 'Lahiri', refPlanet: string = "Ascendant"): {
    planets: PlanetData[], d1: DivisionalChartData, d9: DivisionalChartData, d60: DivisionalChartData,
    predictionsMoon: Predictions, predictionsLagna: Predictions, dasha?: DashaInfo, sadeSati?: SadeSatiInfo, gocharaScore: number, remedies: Remedy[], ashtakavarga?: AshtakavargaData
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

    PLANET_MAP.forEach(p => {
        const pos = Ast.GeoVector(p.body, time, true), ecl = Ast.Ecliptic(pos), sidereal = (ecl.elon - ayanamsa + 360) % 360;
        const posDelta = Ast.GeoVector(p.body, timeDelta, true), eclDelta = Ast.Ecliptic(posDelta);
        let diff = eclDelta.elon - ecl.elon; if (diff > 180) diff -= 360; if (diff < -180) diff += 360;

        const rasiDeg = sidereal % 30;
        const kakshyaLords = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon", "Lagna"];
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
            kakshya: kakshyaLords[kakshyaIdx],
            pada
        });
    });

    const sun = raw.find(p => p.name === "Sun");
    if (sun) {
        raw.forEach(p => {
            if (["Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(p.name)) {
                let dist = Math.abs(p.longitude - sun.longitude);
                if (dist > 180) dist = 360 - dist;
                const limits: { [key: string]: number } = { "Mars": 17, "Mercury": 14, "Jupiter": 11, "Venus": 10, "Saturn": 15 };
                if (p.name === "Mercury" && p.isRetrograde) limits["Mercury"] = 12;
                if (p.name === "Venus" && p.isRetrograde) limits["Venus"] = 8;
                p.isCombust = dist < (limits[p.name] || 0);
            }
        });
    }

    const rahuSid = (getMeanRahu(time) - ayanamsa + 360) % 360;
    const rRasiDeg = rahuSid % 30;
    const kRasiDeg = (rahuSid + 180) % 360 % 30;
    const nDeg = 360/27;
    raw.push({ name: "Rahu", symbol: "Ra", longitude: rahuSid, degree: formatDegree(rRasiDeg), rasiIdx: Math.floor(rahuSid / 30), isRetrograde: true, kakshya: ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon", "Lagna"][Math.floor(rRasiDeg / 3.75)], pada: Math.floor((rahuSid % nDeg) / (nDeg / 4)) + 1 });
    raw.push({ name: "Ketu", symbol: "Ke", longitude: (rahuSid + 180) % 360, degree: formatDegree(kRasiDeg), rasiIdx: Math.floor(((rahuSid + 180) % 360) / 30), isRetrograde: true, kakshya: ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon", "Lagna"][Math.floor(kRasiDeg / 3.75)], pada: Math.floor(((rahuSid + 180) % 360 % nDeg) / (nDeg / 4)) + 1 });

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
        kakshya: ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon", "Lagna"][Math.floor(lagnaRasiDeg / 3.75)]
    }];
    raw.forEach(p => planets.push({ ...p, rasi: RASIS[p.rasiIdx], house: (p.rasiIdx - refRasi + 12) % 12 + 1, nakshatra: NAKSHATRAS[Math.floor(p.longitude / (360 / 27))] }));

    const d1: DivisionalChartData = { houses: {}, houseRasis: {} }, d9: DivisionalChartData = { houses: {}, houseRasis: {} }, d60: DivisionalChartData = { houses: {}, houseRasis: {} };
    const mLong = raw.find(p => p.name === "Moon")?.longitude || lagnaSid;
    const refD9 = getD9Rasi(refPlanet === "Moon" ? mLong : lagnaSid), refD60 = getD60Rasi(refPlanet === "Moon" ? mLong : lagnaSid);
    for (let i = 1; i <= 12; i++) {
        d1.houses[i] = []; d1.houseRasis[i] = (refRasi + i - 1) % 12 + 1;
        d9.houses[i] = []; d9.houseRasis[i] = (refD9 + i - 1) % 12 + 1;
        d60.houses[i] = []; d60.houseRasis[i] = (refD60 + i - 1) % 12 + 1;
    }
    planets.forEach(p => {
        if (p.house >= 1 && p.house <= 12) d1.houses[p.house].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        const h9 = (getD9Rasi(p.longitude) - refD9 + 12) % 12 + 1; if (h9 >= 1 && h9 <= 12) d9.houses[h9].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
        const h60 = (getD60Rasi(p.longitude) - refD60 + 12) % 12 + 1; if (h60 >= 1 && h60 <= 12) d60.houses[h60].push({ symbol: p.symbol, isRetrograde: p.isRetrograde });
    });

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
    const moonIdx = RASIS.indexOf(planets.find(p => p.name === "Moon")?.rasi || "Aries");
    const planetsFromMoon = planets.map(p => ({ ...p, house: (RASIS.indexOf(p.rasi) - moonIdx + 12) % 12 + 1 }));
    planetsFromMoon.forEach(p => {
        if (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"].includes(p.name)) {
            p.vedha = checkVedha(p, planetsFromMoon);
            const target = planets.find(tp => tp.name === p.name);
            if (target) target.vedha = p.vedha;
        }
    });

    const ascIdx = RASIS.indexOf(planets.find(p => p.name === "Ascendant")?.rasi || "Aries");
    const planetsFromLagna = planets.map(p => ({ ...p, house: (RASIS.indexOf(p.rasi) - ascIdx + 12) % 12 + 1 }));

    const result = { planets, d1, d9, d60, predictionsMoon: generatePredictions(planetsFromMoon, "Moon"), predictionsLagna: generatePredictions(planetsFromLagna, "Ascendant"), dasha, sadeSati, gocharaScore: calculateGocharaScore(planetsFromMoon, dasha, ashtakavarga), remedies: getRemedies(planetsFromMoon, dasha, sadeSati), ashtakavarga };

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

function calculateAshtakavarga(natal: PlanetData[]): AshtakavargaData {
    const bav: { [key: string]: number[] } = {}, sav = new Array(12).fill(0), main = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
    const rasis: { [key: string]: number } = {}; [...main, "Ascendant"].forEach(n => rasis[n] = Math.floor((natal.find(p => p.name === n)?.longitude || 0) / 30));
    main.forEach(p => {
        const s = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) {
            [...main, "Ascendant"].forEach(src => { if (ASHTAKAVARGA_RULES[p][src].includes((i - rasis[src] + 12) % 12 + 1)) { s[i]++; sav[i]++; } });
        }
        bav[p] = s;
    });
    return { bav, sav };
}

const VEDHA_PAIRS: { [key: string]: { [key: number]: number } } = { "Sun": { 3: 9, 6: 12, 10: 4, 11: 5, 9: 3, 12: 6, 4: 10, 5: 11 }, "Moon": { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8, 5: 1, 9: 3, 12: 6, 2: 7, 4: 10, 8: 11 }, "Mars": { 3: 12, 6: 9, 11: 5, 12: 3, 9: 6, 5: 11 }, "Mercury": { 2: 5, 4: 3, 6: 9, 8: 1, 10: 7, 11: 12, 5: 2, 3: 4, 9: 6, 1: 8, 7: 10, 12: 11 }, "Jupiter": { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8, 12: 2, 4: 5, 3: 7, 10: 9, 8: 11 }, "Venus": { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 1, 9: 5, 10: 4, 11: 3, 12: 6, 7: 2, 6: 12 }, "Saturn": { 3: 12, 6: 9, 11: 5, 12: 3, 9: 6, 5: 11 } };

function checkVedha(p: PlanetData, all: PlanetData[]): { isObstructed: boolean, obstructingPlanet?: string } {
    const vH = VEDHA_PAIRS[p.name]?.[p.house]; if (!vH) return { isObstructed: false };
    const obs = all.find(o => o.house === vH && o.name !== p.name && o.name !== "Ascendant");
    if (obs) {
        if ((p.name === "Sun" && obs.name === "Saturn") || (p.name === "Saturn" && obs.name === "Sun")) return { isObstructed: false };
        if ((p.name === "Moon" && obs.name === "Mercury") || (p.name === "Mercury" && obs.name === "Moon")) return { isObstructed: false };
        return { isObstructed: true, obstructingPlanet: obs.name };
    }
    return { isObstructed: false };
}
