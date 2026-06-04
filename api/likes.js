export default async function handler(req, res) {
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const NOCODB_URL = process.env.NOCODB_URL || 'https://nocodb.kalendarr.com';
  const BASE_ID = process.env.NOCODB_BASE_ID;
  const LIKES_TABLE = process.env.NOCODB_LIKES_TABLE;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const baseUrl = `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${LIKES_TABLE}`;
  const headers = { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' };

  // GET — fetch all likes for a user
  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const where = `(user_id,eq,${userId})`;
      const resp = await fetch(`${baseUrl}?where=${encodeURIComponent(where)}&limit=500`, { headers });
      if (!resp.ok) return res.status(resp.status).json({ error: 'NocoDB error' });
      const data = await resp.json();
      const eventIds = (data.list || []).map(r => r.event_id);
      return res.status(200).json({ eventIds });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch likes', detail: e.message });
    }
  }

  // POST — add a like
  if (req.method === 'POST') {
    try {
      const { userId, eventId } = req.body;
      if (!userId || !eventId) return res.status(400).json({ error: 'Missing userId or eventId' });
      const resp = await fetch(baseUrl, {
        method: 'POST', headers,
        body: JSON.stringify({ user_id: userId, event_id: eventId, liked_at: new Date().toISOString() }),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: 'Failed to like' });
      return res.status(201).json({ success: true });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to like', detail: e.message });
    }
  }

  // DELETE — remove a like
  if (req.method === 'DELETE') {
    try {
      const { userId, eventId } = req.body;
      if (!userId || !eventId) return res.status(400).json({ error: 'Missing userId or eventId' });
      // Find the like record first
      const where = `(user_id,eq,${userId})~and(event_id,eq,${eventId})`;
      const findResp = await fetch(`${baseUrl}?where=${encodeURIComponent(where)}&limit=1`, { headers });
      const findData = await findResp.json();
      if (!findData.list || findData.list.length === 0) return res.status(404).json({ error: 'Like not found' });
      const likeId = findData.list[0].Id;
      const delResp = await fetch(`${baseUrl}/${likeId}`, { method: 'DELETE', headers });
      if (!delResp.ok) return res.status(delResp.status).json({ error: 'Failed to unlike' });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to unlike', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
