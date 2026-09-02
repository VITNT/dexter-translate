function parseBilingualTranslation(rawText) {
    const cleaned = String(rawText || "")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");
    const jsonText = objectStart >= 0 && objectEnd > objectStart
        ? cleaned.slice(objectStart, objectEnd + 1)
        : cleaned;

    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        return null;
    }

    const khmer = typeof parsed?.khmer === "string" ? parsed.khmer.trim() : "";
    let english = typeof parsed?.english === "string" ? parsed.english.trim() : "";
    if (!khmer || !english) return null;

    english = english.charAt(0).toUpperCase() + english.slice(1);
    if (!/[.!?]$/.test(english)) english += ".";

    return { khmer, english };
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const glossInput = typeof req.body?.aslString === 'string'
            ? req.body.aslString.trim()
            : '';

        if (!glossInput) {
            return res.status(400).json({ error: "Missing ASL string" });
        }
        if (glossInput.length > 500) {
            return res.status(413).json({ error: "ASL string is too long" });
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return res.status(503).json({ error: "GEMINI_API_KEY is not configured" });
        }

        const model = process.env.GEMINI_MODEL || 'gemma-4-31b-it';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${API_KEY}`;
        const prompt = `You interpret sign-language gloss into natural Khmer and English.

The input can be either:
- ASL gloss, where words are literal English labels for American Sign Language signs; or
- CSL/KSL gloss, where words are Khmer labels for Cambodian/Khmer Sign Language signs.

Infer natural sentence order from the complete gloss, but do not invent details that are not present. The Khmer and English translations must express the same meaning.

Return ONLY valid JSON in exactly this shape, with no markdown or explanation:
{"khmer":"<natural Khmer sentence>","english":"<natural English sentence>"}

Sign-language gloss: ${glossInput}`;

        const apiResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 150,
                    topP: 0.8,
                    thinkingConfig: {
                        thinkingLevel: "MINIMAL"
                    }
                }
            })
        });

        const payload = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("API Error Response:", payload);
            return res.status(apiResponse.status).json({
                error: "Google API Error",
                details: payload
            });
        }

        // Filter out the model's internal thinking process so we only parse the final answer.
        const parts = payload?.candidates?.[0]?.content?.parts || [];
        const finalText = parts
            .filter(part => !part.thought)
            .map(part => part.text || "")
            .join("");
        const translation = parseBilingualTranslation(finalText);

        if (!translation) {
            return res.status(502).json({
                error: "Translation model returned an invalid bilingual response."
            });
        }

        return res.status(200).json({ translation });

    } catch (err) {
        console.error("Server Crash:", err);
        return res.status(500).json({
            error: "Failed to connect to the AI model."
        });
    }
}

module.exports = handler;
module.exports.parseBilingualTranslation = parseBilingualTranslation;
