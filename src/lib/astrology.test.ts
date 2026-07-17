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
    // Ashwini nakshatra starts at 0 longitude. Lord is Ketu.
    const result = calculateVimshottariDasha(birthDate, 1);

    assert.ok(result.mahadasha);
    assert.ok(result.antardasha);
    assert.ok(result.pratyantardasha);
    assert.ok(result.sookshmadasha);
    console.log(`Current Mahadasha for 1990 birth in Ashwini: ${result.mahadasha.lord}`);
    console.log(`Current Antardasha: ${result.antardasha.lord}`);
    console.log(`Current Pratyantardasha: ${result.pratyantardasha.lord}`);
    console.log(`Current Sookshmadasha: ${result.sookshmadasha.lord}`);
});
