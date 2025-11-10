export function getApiKey(req, res) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Deepgram API key not configured" });
  }

  res.json({ apiKey });
}
