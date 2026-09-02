const SUPPORTED_LANGUAGES = Object.freeze({
    "km-KH": "km",
    "en-US": "en"
});

function splitSpeechText(text, maxCharacters = 180) {
    const characters = Array.from(String(text || "").trim());
    const chunks = [];

    while (characters.length > maxCharacters) {
        let splitAt = maxCharacters;
        const preferredBoundary = Math.floor(maxCharacters * 0.6);
        for (let index = maxCharacters; index >= preferredBoundary; index -= 1) {
            if (/[\s។.!?]/u.test(characters[index - 1])) {
                splitAt = index;
                break;
            }
        }
        chunks.push(characters.splice(0, splitAt).join("").trim());
    }

    if (characters.length > 0) chunks.push(characters.join("").trim());
    return chunks.filter(Boolean);
}

async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const text = typeof req.query?.text === "string" ? req.query.text.trim() : "";
    const language = typeof req.query?.language === "string" ? req.query.language : "";
    const translateLanguage = SUPPORTED_LANGUAGES[language];

    if (!text) return res.status(400).json({ error: "Missing speech text" });
    if (Array.from(text).length > 600) {
        return res.status(413).json({ error: "Speech text is too long" });
    }
    if (!translateLanguage) {
        return res.status(400).json({ error: "Unsupported speech language" });
    }

    try {
        const audioParts = [];
        for (const chunk of splitSpeechText(text)) {
            const endpoint = new URL("https://translate.google.com/translate_tts");
            endpoint.search = new URLSearchParams({
                ie: "UTF-8",
                client: "tw-ob",
                tl: translateLanguage,
                q: chunk
            }).toString();

            const audioResponse = await fetch(endpoint, {
                headers: { "User-Agent": "Mozilla/5.0 Dexter/1.0" }
            });
            const contentType = audioResponse.headers?.get?.("content-type") || "";
            if (!audioResponse.ok || (contentType && !contentType.startsWith("audio/"))) {
                throw new Error(`Speech service returned ${audioResponse.status}`);
            }
            audioParts.push(Buffer.from(await audioResponse.arrayBuffer()));
        }

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(Buffer.concat(audioParts));
    } catch (error) {
        console.error("Speech generation failed:", error);
        return res.status(502).json({ error: "Speech audio is temporarily unavailable" });
    }
}

module.exports = handler;
module.exports.splitSpeechText = splitSpeechText;
