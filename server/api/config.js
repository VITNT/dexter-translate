module.exports = function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const wlaslApiUrl = String(process.env.WLASL_API_URL || '')
        .trim()
        .replace(/\/+$/, '');

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ wlaslApiUrl });
};
