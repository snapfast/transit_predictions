import test from "node:test";
import assert from "node:assert";
import { calculateTransits } from "./astrology";

test("Advanced Jyotish Logic: Ashtakavarga and Vedha", async (t) => {
    const birth = { date: new Date("1990-01-01T12:00:00Z"), lat: 28.61, lon: 77.21 };
    const transitDate = new Date("2024-03-07T12:00:00Z");

    const result = calculateTransits(transitDate, 28.61, 77.21, birth);

    await t.test("Ashtakavarga data is generated", () => {
        assert.ok(result.ashtakavarga, "Ashtakavarga should be present");
        assert.strictEqual(result.ashtakavarga.sav.length, 12, "SAV should have 12 signs");
        assert.ok(Object.keys(result.ashtakavarga.bav).length >= 7, "BAV should have at least 7 planets");
    });

    await t.test("Vedha logic is integrated", () => {
        const mars = result.planets.find(p => p.name === "Mars");
        assert.ok(mars && typeof mars.vedha !== 'undefined', "Mars should have vedha info");
    });

    await t.test("Yogas are calculated", () => {
        assert.ok(Array.isArray(result.predictions.yogas), "Yogas should be an array");
    });
});
