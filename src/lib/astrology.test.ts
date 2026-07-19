import { calculateVimshottariDasha, calculateSadeSati } from './astrology.js';
import assert from 'node:assert';
import { test } from 'node:test';

test('calculateSadeSati', () => {
    // Saturn in same rasi as Moon (Peak)
    let result = calculateSadeSati(10, 15);
    assert.strictEqual(result.isActive, true);
    assert.strictEqual(result.phase, 'Peak');

    // Saturn 1 rasi before Moon (Rising)
    result = calculateSadeSati(40, 10);
    assert.strictEqual(result.isActive, true);
    assert.strictEqual(result.phase, 'Rising');

    // Saturn 1 rasi after Moon (Setting)
    result = calculateSadeSati(10, 40);
    assert.strictEqual(result.isActive, true);
    assert.strictEqual(result.phase, 'Setting');

    // Saturn far from Moon (None)
    result = calculateSadeSati(10, 180);
    assert.strictEqual(result.isActive, false);
    assert.strictEqual(result.phase, 'None');
});

test('calculateVimshottariDasha', () => {
    const birthDate = new Date('1990-01-01T12:00:00Z');
    // Ashwini nakshatra starts at 0 longitude. Lord is Ketu (7 years period).
    // Let's test with a moon longitude of 1.
    // Nakshatra length is 13.333333 degrees.
    // 1 degree is 1 / 13.333333 = 0.075 of Ashwini nakshatra passed.
    // remaining is 0.925 of Ketu dasha = 0.925 * 7 * 360 = 2331 days.
    // Birth date: 1990-01-01.
    // Let's calculate for target date being exactly now, or let's test a specific target date to assert values.
    const targetDate = new Date('2024-03-07T12:00:00Z');
    const result = calculateVimshottariDasha(birthDate, 1, targetDate);

    assert.ok(result.mahadasha);
    assert.ok(result.antardasha);
    assert.ok(result.pratyantardasha);
    assert.ok(result.sookshmadasha);

    // With standard year, let's verify that the total duration of each level is correct.
    const mdDurationDays = (result.mahadasha.end.getTime() - result.mahadasha.start.getTime()) / (24 * 60 * 60 * 1000);
    // Dasha periods: Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17.
    // Total cycle is 120 years.
    // For any mahadasha, its duration in days should be exactly its period in years * 365.2425.
    const expectedYears = result.mahadasha.lord === "Ketu" ? 7 :
                          result.mahadasha.lord === "Venus" ? 20 :
                          result.mahadasha.lord === "Sun" ? 6 :
                          result.mahadasha.lord === "Moon" ? 10 :
                          result.mahadasha.lord === "Mars" ? 7 :
                          result.mahadasha.lord === "Rahu" ? 18 :
                          result.mahadasha.lord === "Jupiter" ? 16 :
                          result.mahadasha.lord === "Saturn" ? 19 : 17;

    assert.strictEqual(Math.round(mdDurationDays), Math.round(expectedYears * 365.2425));

    console.log(`Current Mahadasha for 1990 birth in Ashwini (as of 2024): ${result.mahadasha.lord}`);
    console.log(`Current Antardasha: ${result.antardasha.lord}`);
    console.log(`Current Pratyantardasha: ${result.pratyantardasha.lord}`);
    console.log(`Current Sookshmadasha: ${result.sookshmadasha.lord}`);
});
