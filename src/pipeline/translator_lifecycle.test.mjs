import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import { setMaxListeners } from 'node:events';

const source = fs.readFileSync(new URL('../../client/translator.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace('export function mountTranslator', 'function mountTranslator');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({ cameraFailure = false, delayedCamera = false } = {}) {
    const requests = [];
    let stops = 0, cameraRequests = 0, trackerOptions = 0, detections = 0;
    let resolveCamera;
    class Element extends EventTarget {
        style = {}; dataset = {}; childNodes = []; textContent = ''; innerText = '';
        classList = { toggle() {}, add() {}, remove() {}, contains() { return false; } };
        videoWidth = 640; videoHeight = 480; currentTime = 1; paused = true;
        closest() { return this; }
        setAttribute() {} removeAttribute() {} load() {} pause() { this.paused = true; }
        async play() { this.paused = false; }
        getContext() { return { clearRect() {} }; }
    }
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    const window = Object.assign(new EventTarget(), {
        location: { hostname: 'localhost' },
        requestAnimationFrame: () => 1, cancelAnimationFrame() {}
    });
    const gesture = class { addCurl() {} };
    const stream = { getTracks: () => [{ stop: () => ++stops }] };
    const signalController = class extends AbortController {
        constructor() { super(); setMaxListeners(30, this.signal); }
    };
    const sandbox = {
        window, console: { log() {}, warn() {}, error() {} }, AbortController: signalController, AbortSignal, setTimeout, clearTimeout,
        performance, Node: { TEXT_NODE: 3 },
        document: { getElementById: get, getElementsByClassName: () => [get('canvas')],
            querySelectorAll: () => [], createElement: () => new Element() },
        navigator: { userAgent: 'test', mediaDevices: { async getUserMedia() {
            ++cameraRequests;
            if (cameraFailure) throw new Error('Permission denied');
            if (delayedCamera) return new Promise(resolve => { resolveCamera = resolve; });
            return stream;
        } } },
        buildHandSignature: () => [], hasVisibleHandLandmarks: () => false,
        appendCommonAslFrame: () => [],
        fp: { Finger: {}, FingerCurl: {}, GestureDescription: gesture, GestureEstimator: class {} },
        tf: { async setBackend() {}, env: () => ({ set() {} }), enableProdMode() {},
            async loadLayersModel(path) { requests.push(path); return { dispose() {} }; } },
        FilesetResolver: { async forVisionTasks() { return {}; } },
        PoseLandmarker: { async createFromOptions() { return { close() {}, detectForVideo: () => ({ landmarks: [] }) }; } },
        HandLandmarker: { async createFromOptions() { return {
            async setOptions() { ++trackerOptions; }, close() {},
            detectForVideo() { ++detections; return { landmarks: [] }; }
        }; } },
        async fetch(path) {
            requests.push(path);
            if (path === '/api/config') return { ok: true, json: async () => ({ wlaslApiUrl: 'http://localhost:8001' }) };
            if (String(path).endsWith('/health')) return new Promise(() => {});
            if (path === './models/asl/wlasl/manifest.json') return { ok: true, json: async () => ({ enabled: false }) };
            if (path === './asl_word_labels.json') return { ok: false };
            if (path === './asl-labels.json') return { json: async () => ['A'] };
            if (path === '/api/translate') return { ok: true, json: async () => ({ translation: { khmer: 'សួស្តី', english: 'Hello.' } }) };
            throw new Error(`Unexpected request: ${path}`);
        }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return { window, get, requests, mount: sandbox.mountTranslator,
        releaseCamera: () => resolveCamera(stream),
        stats: () => ({ stops, cameraRequests, trackerOptions, detections }) };
}

test('spelling starts detection without word assets, server health, or a redundant tracker reset', async () => {
    const h = harness();
    const cleanup = h.mount();
    await h.window.startCam();
    assert.equal(h.get('cameraBtn').textContent, 'Stop Camera');
    assert.notEqual(h.get('captureStateLabel').textContent, 'Camera off');
    assert.deepEqual(h.requests, ['./asl-labels.json', './asl-model.json']);
    assert.equal(h.stats().trackerOptions, 0);
    assert.equal(h.stats().detections, 1, "A camera frame reaches the detector before startup completes.");
    cleanup();
    assert.equal(h.stats().stops, 1);
    assert.equal(h.get('webcamFeed').srcObject, null);
});

test('failed permission restores a retryable camera button', async () => {
    const h = harness({ cameraFailure: true });
    const cleanup = h.mount();
    await h.window.startCam();
    assert.equal(h.get('cameraBtn').disabled, false);
    assert.equal(h.get('cameraBtn').textContent, 'Start Camera');
    assert.match(h.get('captureStateDetail').textContent, /Permission denied/);
    cleanup();
});

test('duplicate starts request one camera and unmount stops a late permission result', async () => {
    const h = harness({ delayedCamera: true });
    const cleanup = h.mount();
    const starting = h.window.startCam();
    await flush();
    await h.window.startCam();
    assert.equal(h.stats().cameraRequests, 1);
    cleanup();
    h.releaseCamera();
    await starting;
    assert.equal(h.stats().stops, 1);
    assert.equal(h.get('webcamFeed').srcObject, null);
});

test('interpretation provides empty-input feedback and rebinds once after remount', async () => {
    const h = harness();
    const first = h.mount();
    await h.window.translateSentence();
    assert.match(h.get('translationStatus').innerText, /Add signs/);
    first();
    const cleanup = h.mount();
    h.get('builtSentence').childNodes = [{ nodeType: 3, textContent: 'HELLO' }];
    h.get('translateSentenceBtn').dispatchEvent(new Event('click'));
    await flush();
    assert.equal(h.requests.filter(path => path === '/api/translate').length, 1);
    assert.equal(h.get('englishTranslation').innerText, 'Hello.');
    assert.equal(h.get('translateSentenceBtn').disabled, false);
    cleanup();
});


test('ASL Words starts local detection while optional server health is stalled', async () => {
    const h = harness();
    const cleanup = h.mount();
    await h.window.selectMode('asl_word', 'ASL Words', h.get('wordMode'));
    await h.window.startCam();
    assert.equal(h.get('cameraBtn').textContent, 'Stop Camera');
    assert.equal(h.stats().trackerOptions, 1);
    assert.ok(h.requests.some(path => path.endsWith('/health')));
    cleanup();
});
