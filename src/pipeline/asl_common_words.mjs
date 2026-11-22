const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_DIP = 7;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_DIP = 11;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_DIP = 15;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_DIP = 19;
const PINKY_TIP = 20;

const POSE_NOSE = 0;
const POSE_LEFT_EAR = 7;
const POSE_RIGHT_EAR = 8;
const POSE_LEFT_SHOULDER = 11;
const POSE_RIGHT_SHOULDER = 12;

const EPSILON = 1e-6;
const HISTORY_WINDOW_MS = 1400;
const STATIC_WINDOW_MS = 520;
const STATIC_HOLD_MS = 280;
const MOTION_MIN_MS = 250;
const MOTION_MAX_MS = 1100;

const FINGERS = {
    index: [INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP],
    middle: [MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP],
    ring: [RING_MCP, RING_PIP, RING_DIP, RING_TIP],
    pinky: [PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP]
};

function finitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function point3(point) {
    return {
        x: Number(point?.x) || 0,
        y: Number(point?.y) || 0,
        z: Number(point?.z) || 0
    };
}

function subtract(left, right) {
    return {
        x: left.x - right.x,
        y: left.y - right.y,
        z: left.z - right.z
    };
}

function dot(left, right) {
    return left.x * right.x + left.y * right.y + left.z * right.z;
}

function magnitude(vector) {
    return Math.hypot(vector.x, vector.y, vector.z);
}

function distance(left, right) {
    return magnitude(subtract(point3(left), point3(right)));
}

function angleDegrees(first, vertex, last) {
    const incoming = subtract(point3(first), point3(vertex));
    const outgoing = subtract(point3(last), point3(vertex));
    const denominator = magnitude(incoming) * magnitude(outgoing);
    if (denominator < EPSILON) return 0;
    const cosine = Math.max(-1, Math.min(1, dot(incoming, outgoing) / denominator));
    return Math.acos(cosine) * 180 / Math.PI;
}

function validHand(hand) {
    return Array.isArray(hand)
        && hand.length >= 21
        && hand.slice(0, 21).every(finitePoint);
}

function fingerIsStraight(hand, finger) {
    const [mcp, pip, dip, tip] = FINGERS[finger];
    return angleDegrees(hand[mcp], hand[pip], hand[dip]) >= 150
        && angleDegrees(hand[pip], hand[dip], hand[tip]) >= 145
        && distance(hand[tip], hand[WRIST]) > distance(hand[pip], hand[WRIST]) * 1.08;
}

function fingerIsCurled(hand, finger) {
    const [mcp, pip, dip, tip] = FINGERS[finger];
    return angleDegrees(hand[mcp], hand[pip], hand[dip]) <= 138
        || angleDegrees(hand[pip], hand[dip], hand[tip]) <= 135
        || distance(hand[tip], hand[WRIST]) < distance(hand[pip], hand[WRIST]) * 1.03;
}

function thumbIsExtended(hand, palmWidth) {
    return angleDegrees(hand[THUMB_MCP], hand[THUMB_IP], hand[THUMB_TIP]) >= 140
        && distance(hand[THUMB_TIP], hand[INDEX_MCP]) >= palmWidth * 0.55;
}

export function measureCommonAslHandshape(hand) {
    if (!validHand(hand)) return null;
    const palmWidth = distance(hand[INDEX_MCP], hand[PINKY_MCP]);
    if (palmWidth < 0.015) return null;

    const straight = Object.fromEntries(
        Object.keys(FINGERS).map(finger => [finger, fingerIsStraight(hand, finger)])
    );
    const curled = Object.fromEntries(
        Object.keys(FINGERS).map(finger => [finger, fingerIsCurled(hand, finger)])
    );
    const pinchRatio = distance(hand[THUMB_TIP], hand[INDEX_TIP]) / palmWidth;
    const wrist = point3(hand[WRIST]);

    return {
        palmWidth,
        wrist,
        pinchRatio,
        straight,
        curled,
        openPalm: straight.index && straight.middle && straight.ring && straight.pinky,
        ok: pinchRatio <= 0.32 && straight.middle && straight.ring && straight.pinky,
        iLoveYou: straight.index
            && straight.pinky
            && curled.middle
            && curled.ring
            && thumbIsExtended(hand, palmWidth)
    };
}

function handednessLabel(handData, index) {
    const category = handData?.handednesses?.[index]?.[0];
    const label = String(category?.categoryName || category?.displayName || '').toLowerCase();
    return label === 'left' || label === 'right' ? label : `hand-${index}`;
}

export function appendCommonAslFrame(history, handData, poseData, timestamp) {
    const safeHistory = Array.isArray(history) ? history : [];
    const time = Number(timestamp);
    if (!Number.isFinite(time)) return safeHistory.slice();

    const frame = {
        timestamp: time,
        hands: (handData?.landmarks || [])
            .map((landmarks, index) => ({
                side: handednessLabel(handData, index),
                landmarks
            }))
            .filter(hand => validHand(hand.landmarks)),
        pose: poseData?.landmarks?.[0] || null
    };
    const next = [...safeHistory, frame];
    const cutoff = time - HISTORY_WINDOW_MS;
    while (next.length > 1 && next[0].timestamp < cutoff) next.shift();
    return next;
}

function samplesBySide(history) {
    const sides = new Map();
    for (const frame of history || []) {
        for (const hand of frame.hands || []) {
            const shape = measureCommonAslHandshape(hand.landmarks);
            if (!shape) continue;
            if (!sides.has(hand.side)) sides.set(hand.side, []);
            sides.get(hand.side).push({
                timestamp: frame.timestamp,
                landmarks: hand.landmarks,
                pose: frame.pose,
                shape
            });
        }
    }
    return [...sides.values()];
}

function heldShapeMatch(samples, property, word) {
    const latestTimestamp = samples.at(-1)?.timestamp;
    if (!Number.isFinite(latestTimestamp)) return null;
    const window = samples.filter(sample => sample.timestamp >= latestTimestamp - STATIC_WINDOW_MS);
    if (window.length < 5 || !window.at(-1).shape[property]) return null;
    const duration = window.at(-1).timestamp - window[0].timestamp;
    if (duration < STATIC_HOLD_MS) return null;

    const matching = window.filter(sample => sample.shape[property]);
    const ratio = matching.length / window.length;
    if (ratio < 0.78 || !window.slice(-2).every(sample => sample.shape[property])) return null;

    const averagePalmWidth = matching.reduce((sum, sample) => sum + sample.shape.palmWidth, 0)
        / matching.length;
    const wristDrift = distance(matching[0].shape.wrist, matching.at(-1).shape.wrist)
        / averagePalmWidth;
    if (wristDrift > 0.7) return null;

    const confidence = Math.min(0.98, 0.78 + ratio * 0.14 + Math.min(duration / 1000, 0.06));
    return { word, confidence, source: 'landmark-geometry' };
}

function validPose(pose) {
    return Array.isArray(pose)
        && finitePoint(pose[POSE_NOSE])
        && finitePoint(pose[POSE_LEFT_EAR])
        && finitePoint(pose[POSE_RIGHT_EAR])
        && finitePoint(pose[POSE_LEFT_SHOULDER])
        && finitePoint(pose[POSE_RIGHT_SHOULDER]);
}

function palmCenter(hand) {
    const indices = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];
    return indices.reduce((sum, index) => ({
        x: sum.x + hand[index].x / indices.length,
        y: sum.y + hand[index].y / indices.length,
        z: sum.z + (Number(hand[index].z) || 0) / indices.length
    }), { x: 0, y: 0, z: 0 });
}

function trailingOpenPalmSamples(samples) {
    const latestTimestamp = samples.at(-1)?.timestamp;
    if (!Number.isFinite(latestTimestamp)) return [];
    const recent = samples.filter(sample => latestTimestamp - sample.timestamp <= MOTION_MAX_MS);
    const trailing = [];
    for (let index = recent.length - 1; index >= 0; index--) {
        if (!recent[index].shape.openPalm) break;
        trailing.unshift(recent[index]);
    }
    return trailing;
}

function detectHello(samples) {
    const openSamples = trailingOpenPalmSamples(samples).filter(sample => validPose(sample.pose));
    if (openSamples.length < 6) return null;
    const start = openSamples[0];
    const end = openSamples.at(-1);
    const duration = end.timestamp - start.timestamp;
    if (duration < MOTION_MIN_MS || duration > MOTION_MAX_MS) return null;

    const shoulders = distance(
        start.pose[POSE_LEFT_SHOULDER],
        start.pose[POSE_RIGHT_SHOULDER]
    );
    if (shoulders < 0.08) return null;

    const startPalm = palmCenter(start.landmarks);
    const endPalm = palmCenter(end.landmarks);
    const startTip = start.landmarks[MIDDLE_TIP];
    const startNearTemple = Math.min(
        distance(startTip, start.pose[POSE_LEFT_EAR]),
        distance(startTip, start.pose[POSE_RIGHT_EAR]),
        distance(startTip, start.pose[POSE_NOSE])
    ) / shoulders;
    if (startNearTemple > 0.72) return null;

    const nose = point3(start.pose[POSE_NOSE]);
    const radialProgress = (
        Math.hypot(endPalm.x - nose.x, endPalm.y - nose.y)
        - Math.hypot(startPalm.x - nose.x, startPalm.y - nose.y)
    ) / shoulders;
    const horizontalTravel = Math.abs(endPalm.x - startPalm.x) / shoulders;
    const downwardTravel = (endPalm.y - startPalm.y) / shoulders;
    const totalTravel = distance(startPalm, endPalm) / shoulders;
    if (
        radialProgress < 0.13
        || horizontalTravel < 0.10
        || totalTravel < 0.16
        || downwardTravel > 0.20
    ) return null;

    let outwardSteps = 0;
    let comparableSteps = 0;
    let previousRadius = null;
    for (const sample of openSamples) {
        const samplePalm = palmCenter(sample.landmarks);
        const sampleNose = validPose(sample.pose) ? sample.pose[POSE_NOSE] : nose;
        const radius = Math.hypot(samplePalm.x - sampleNose.x, samplePalm.y - sampleNose.y);
        if (previousRadius !== null) {
            comparableSteps++;
            if (radius >= previousRadius - shoulders * 0.025) outwardSteps++;
        }
        previousRadius = radius;
    }
    const outwardRatio = comparableSteps ? outwardSteps / comparableSteps : 0;
    if (outwardRatio < 0.65) return null;

    const confidence = Math.min(
        0.97,
        0.78 + Math.min(radialProgress, 0.35) * 0.35 + outwardRatio * 0.08
    );
    return { word: 'Hello', confidence, source: 'landmark-geometry' };
}

export function detectCommonAslWord(history) {
    const candidates = [];
    for (const samples of samplesBySide(history)) {
        const hello = detectHello(samples);
        const ok = heldShapeMatch(samples, 'ok', 'OK');
        const iLoveYou = heldShapeMatch(samples, 'iLoveYou', 'I love you');
        if (hello) candidates.push(hello);
        if (ok) candidates.push(ok);
        if (iLoveYou) candidates.push(iLoveYou);
    }
    return candidates.sort((left, right) => right.confidence - left.confidence)[0] || null;
}
