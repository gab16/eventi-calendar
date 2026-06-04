export default async function handler(req, res) {
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const NOCODB_URL = process.env.NOCODB_URL || 'https://nocodb.kalendarr.com';
  const BASE_ID = process.env.NOCODB_BASE_ID;
  const USERS_TABLE = process.env.NOCODB_USERS_TABLE;
  const baseUrl = `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${USERS_TABLE}`;
  const headers = { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' };

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Login
  if (req.method === 'POST') {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

      // encode only the whole where string, not individual values
      const where = `(username,eq,${username})~and(password,eq,${password})`;
      const url = `${baseUrl}?where=${encodeURIComponent(where)}&limit=1`;

      const resp = await fetch(url, { headers });
      if (!resp.ok) { const t = await resp.text(); return res.status(500).json({ error: 'Auth service error', status: resp.status, detail: t, url }); }

      const data = await resp.json();
      if (!data.list || data.list.length === 0) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      const user = data.list[0];
      return res.status(200).json({
        success: true,
        userId: user.Id,
        username: user.username,
        display_name: user.display_name,
        default_region: user.default_region ?? null,
      });
    } catch (e) {
      return res.status(502).json({ error: 'Auth failed', detail: e.message });
    }
  }

  // Save default region
  if (req.method === 'PATCH') {
    try {
      const { userId, default_region } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      const resp = await fetch(`${baseUrl}/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ default_region: default_region || null }),
      });
      if (!resp.ok) return res.status(500).json({ error: 'Update failed' });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(502).json({ error: 'Update failed', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
