let recording = null;
let playback = null;
let currentSeed = 1;
const originalRandom = Math.random;

// Simple LCG (Linear Congruential Generator) for deterministic gameplay
function seededRandom() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
}

export function setSeed(seed) {
    currentSeed = seed;
    Math.random = seededRandom;
}

export function restoreRandom() {
    Math.random = originalRandom;
}

export function startRecording() {
    const seed = Date.now();
    setSeed(seed);
    recording = { seed, frames: [] };
}

export function recordFrame(state) {
    if (recording) {
        // Efficiently store just the necessary state
        recording.frames.push(state);
    }
}

export function stopRecording() {
    const data = recording;
    recording = null;
    restoreRandom();
    return data;
}

export function startPlayback(data) {
    if (!data) return false;
    setSeed(data.seed);
    playback = { data, frameIndex: 0 };
    return true;
}

export function getPlaybackFrame() {
    if (!playback) return null;
    if (playback.frameIndex >= playback.data.frames.length) {
        return null; // End of playback
    }
    return playback.data.frames[playback.frameIndex++];
}

export function stopPlayback() {
    playback = null;
    restoreRandom();
}

export function isRecording() { return !!recording; }
export function isReplaying() { return !!playback; }