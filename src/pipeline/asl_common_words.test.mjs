import assert from "node:assert/strict";
import { test } from "node:test";
import {
    appendCommonAslFrame,
    detectCommonAslWord,
    measureCommonAslHandshape
} from "./asl_common_words.mjs";

function point(x, y, z = 0) {
    return { x, y, z };
}

function baseHand() {
    const hand = Array.from({ length: 21 }, () => point(0, 0, 0));
    hand[0] = point(0, 0.55);
    hand[1] = point(-0.18, 0.2);
    hand[2] = point(-0.34, 0.02);
    hand[3] = point(-0.52, -0.08);
    hand[4] = point(-0.82, -0.12);

    const fingers = [
        [-0.3, 5],
        [0, 9],
        [0.28, 13],
        [0.52, 17]
    ];
    for (const [x, base] of fingers) {
        hand[base] = point(x, 0);
        hand[base + 1] = point(x, -0.35);
        hand[base + 2] = point(x, -0.68);
        hand[base + 3] = point(x, -1);
    }
    return hand;
}

function curlFinger(hand, base) {
    const x = hand[base].x;
    hand[base + 1] = point(x, -0.3, 0.02);
    hand[base + 2] = point(x + 0.16, -0.13, 0.04);
    hand[base + 3] = point(x + 0.06, 0.04, 0.06);
}

function okHand() {
    const hand = baseHand();
    curlFinger(hand, 5);
    hand[4] = point(-0.23, 0.01, 0.02);
    hand[8] = point(-0.22, 0.02, 0.02);
    return hand;
}

function iLoveYouHand() {
    const hand = baseHand();
    curlFinger(hand, 9);
    curlFinger(hand, 13);
    return hand;
}

function transformHand(hand, {
    x = 0.5,
    y = 0.5,
    scale = 0.16,
    angle = 0,
    mirrored = false
} = {}) {
    const radians = angle * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return hand.map(source => {
        const localX = mirrored ? -source.x : source.x;
        return point(
            x + (localX * cosine - source.y * sine) * scale,
            y + (localX * sine + source.y * cosine) * scale,
            source.z * scale
        );
    });
}

function handData(hand, side = "Right") {
    return {
        landmarks: [hand],
        handednesses: [[{ categoryName: side }]]
    };
}

function appendHeldFrames(hand) {
    let history = [];
    for (let timestamp = 0; timestamp <= 400; timestamp += 50) {
        history = appendCommonAslFrame(history, handData(hand), null, timestamp);
    }
    return history;
}

test("OK uses a scale- and rotation-normalized thumb/index pinch", () => {
    for (const mirrored of [false, true]) {
        for (const scale of [0.08, 0.16, 0.28]) {
            for (const angle of [-45, 0, 38]) {
                const hand = transformHand(okHand(), { mirrored, scale, angle });
                assert.equal(measureCommonAslHandshape(hand)?.ok, true);
                assert.equal(detectCommonAslWord(appendHeldFrames(hand))?.word, "OK");
            }
        }
    }
});

test("I love you requires index, pinky, and thumb extension with two curled fingers", () => {
    const hand = transformHand(iLoveYouHand(), { angle: 24, mirrored: true });
    const shape = measureCommonAslHandshape(hand);
    assert.equal(shape?.iLoveYou, true);
    assert.equal(shape?.ok, false);
    assert.equal(detectCommonAslWord(appendHeldFrames(hand))?.word, "I love you");
});

function pose() {
    const landmarks = Array.from({ length: 33 }, () => point(0.5, 0.75));
    landmarks[0] = point(0.5, 0.3);
    landmarks[7] = point(0.43, 0.34);
    landmarks[8] = point(0.57, 0.34);
    landmarks[11] = point(0.35, 0.64);
    landmarks[12] = point(0.65, 0.64);
    return { landmarks: [landmarks] };
}

function helloHistory({ travel = 0.16, mirrored = false } = {}) {
    let history = [];
    const frameCount = 9;
    for (let index = 0; index < frameCount; index++) {
        const progress = index / (frameCount - 1);
        const direction = mirrored ? -1 : 1;
        const x = 0.5 + direction * (0.035 + travel * progress);
        const y = 0.49 - 0.025 * progress;
        const hand = transformHand(baseHand(), { x, y, scale: 0.12, mirrored });
        history = appendCommonAslFrame(history, handData(hand), pose(), index * 50);
    }
    return history;
}

test("Hello is an open palm moving outward from the temple", () => {
    assert.equal(detectCommonAslWord(helloHistory())?.word, "Hello");
    assert.equal(detectCommonAslWord(helloHistory({ mirrored: true }))?.word, "Hello");
});

test("a held open palm and a momentary pinch are rejected", () => {
    assert.equal(detectCommonAslWord(helloHistory({ travel: 0 })), null);

    const hand = transformHand(okHand());
    let history = [];
    for (let timestamp = 0; timestamp <= 150; timestamp += 50) {
        history = appendCommonAslFrame(history, handData(hand), null, timestamp);
    }
    assert.equal(detectCommonAslWord(history), null);
});

test("frame history is bounded to the math recognizer window", () => {
    const hand = transformHand(baseHand());
    let history = appendCommonAslFrame([], handData(hand), pose(), 0);
    history = appendCommonAslFrame(history, handData(hand), pose(), 2000);
    assert.equal(history.length, 1);
});
