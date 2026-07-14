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
        assert.ok(Array.isArray(result.predictionsMoon.yogas), "Yogas should be an array");
    });

    await t.test("Upgrahas (Shadow Planets) are calculated", () => {
        assert.ok(result.upgrahas, "Upgrahas should be present");
        assert.strictEqual(result.upgrahas.length, 11, "There should be exactly 11 Upgrahas");

        const expectedUpgrahas = [
            "Dhuma", "Vyatipata", "Parivesha", "Indrachapa", "Upaketu",
            "Kala", "Mrityu", "Ardhaprahara", "Yamaghantaka", "Gulika", "Mandi"
        ];

        for (const name of expectedUpgrahas) {
            const up = result.upgrahas.find(u => u.name === name);
            assert.ok(up, `Upgraha ${name} should be calculated`);
            assert.ok(up.rasi, `Upgraha ${name} should have a Rasi`);
            assert.ok(up.degree, `Upgraha ${name} should have a degree`);
            assert.ok(up.house >= 1 && up.house <= 12, `Upgraha ${name} should have a house between 1 and 12`);
        }

        // Verify mathematical relations for Aprakasha Grahas
        const sun = result.planets.find(p => p.name === "Sun");
        const upaketu = result.upgrahas.find(u => u.name === "Upaketu");
        if (sun && upaketu) {
            const reconstructedSunLong = (upaketu.longitude + 30) % 360;
            const diff = Math.abs(reconstructedSunLong - sun.longitude);
            const tolerance = 0.001;
            assert.ok(diff < tolerance, `Upaketu + 30 degrees (${reconstructedSunLong}) should equal Sun's longitude (${sun.longitude}), diff: ${diff}`);
        }

        // Verify Divisional charts with Upgrahas are populated
        assert.ok(result.d1WithUpgrahas, "D1 with Upgrahas should be present");
        assert.ok(result.d9WithUpgrahas, "D9 with Upgrahas should be present");
        assert.ok(result.d60WithUpgrahas, "D60 with Upgrahas should be present");

        // Verify they actually contain the upgraha symbols
        const gSymbol = result.upgrahas.find(u => u.name === "Gulika")?.symbol || "Gk";
        let foundInD1 = false;
        for (let h = 1; h <= 12; h++) {
            if (result.d1WithUpgrahas.houses[h].some(p => p.symbol === gSymbol)) {
                foundInD1 = true;
                break;
            }
        }
        assert.ok(foundInD1, "Gulika should be present in D1 with Upgrahas chart");
    });
});
