export default async function handler(req, res) {
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const NOCODB_URL = process.env.NOCODB_URL || 'https://nocodb.tattionline.com';
  const BASE_ID = process.env.NOCODB_BASE_ID;
  const USERS_TABLE = process.env.NOCODB_USERS_TABLE;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    const where = `(username,eq,${username})~and(password,eq,${password})`;
    const url = `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${USERS_TABLE}?where=${encodeURIComponent(where)}&limit=1`;

    const resp = await fetch(url, { headers: { 'xc-token': NOCODB_TOKEN } });
    if (!resp.ok) return res.status(500).json({ error: 'Auth service error' });

    const data = await resp.json();
    if (!data.list || data.list.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = data.list[0];
    return res.status(200).json({
      success: true,
      userId: user.Id,
      username: user.username,
      display_name: user.display_name,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Auth failed', detail: e.message });
  }
}
