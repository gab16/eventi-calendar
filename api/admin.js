export default async function handler(req, res) {
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const NOCODB_URL = process.env.NOCODB_URL || 'https://nocodb.tattionline.com';
  const BASE_ID = process.env.NOCODB_BASE_ID;
  const EVENTS_TABLE = process.env.NOCODB_EVENTS_TABLE;

  if (!NOCODB_TOKEN) return res.status(500).json({ error: 'NOCODB_TOKEN not configured' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const pw = req.headers['x-admin-password'];
  if (!pw || pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

  const baseUrl = `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${EVENTS_TABLE}`;
  const headers = { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' };

  function parseAttachment(val) {
    try {
      const arr = typeof val === 'string' ? JSON.parse(val) : val;
      if (!Array.isArray(arr) || arr.length === 0) return { url: null, thumb: null };
      const a = arr[0];
      const base = NOCODB_URL;
      const url = a.signedPath ? `${base}/${a.signedPath}` : (a.url || null);
      const thumb = a.thumbnails?.card_cover?.signedPath
        ? `${base}/${a.thumbnails.card_cover.signedPath}`
        : (a.thumbnails?.large?.url || url);
      return { url, thumb };
    } catch (e) {
      return { url: null, thumb: null };
    }
  }

  if (req.method === 'GET') {
    try {
      let allRecords = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const resp = await fetch(`${baseUrl}?limit=100&offset=${(page-1)*100}&sort=-date_start`, { headers });
        if (!resp.ok) {
          const detail = await resp.text();
          return res.status(resp.status).json({ error: 'NocoDB error', detail });
        }
        const data = await resp.json();
        allRecords = allRecords.concat(data.list || []);
        hasMore = data.pageInfo?.isLastPage === false;
        page++;
      }
      const events = allRecords.map(f => {
        const { url, thumb } = parseAttachment(f.flyer_image);
        return {
          id: f.Id,
          event_name: f.event_name || '',
          date_start: (f.date_start || '').slice(0, 10),
          date_end: f.date_end ? f.date_end.slice(0, 10) : null,
          time_start: f.time_start || '',
          location_name: f.location_name || '',
          address: f.address || '',
          category: f.category || '',
          organizer: f.organizer || '',
          price: f.price || '',
          description: f.description || '',
          language: f.language || '',
          phone: f.phone || '',
          confidence: f.confidence || '',
          status: f.status || 'pending',
          is_sponsored: !!f.is_sponsored,
          region: f.region || '',
          flyer_image: url,
          flyer_thumb: thumb,
        };
      });
      return res.status(200).json({ events, count: events.length });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch', detail: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, fields } = req.body;
      if (!id || !fields) return res.status(400).json({ error: 'Missing id or fields' });
      const allowed = ['event_name','date_start','date_end','time_start','location_name','address',
        'category','organizer','price','description','language','phone','status','is_sponsored','region'];
      const safeFields = {};
      for (const key of allowed) {
        if (key in fields) safeFields[key] = fields[key];
      }
      const resp = await fetch(`${baseUrl}/${id}`, {
        method: 'PATCH', headers, body: JSON.stringify(safeFields),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: 'NocoDB update failed' });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to update', detail: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fields } = req.body;
      if (!fields?.event_name || !fields?.date_start) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const allowed = ['event_name','date_start','date_end','time_start','location_name','address',
        'category','organizer','price','description','language','phone','status','is_sponsored','region'];
      const safeFields = { status: 'pending' };
      for (const key of allowed) {
        if (key in fields && fields[key] !== '' && fields[key] != null) safeFields[key] = fields[key];
      }
      if (safeFields.date_start) safeFields.date_start = new Date(safeFields.date_start).toISOString().slice(0, 10);
      if (safeFields.date_end) safeFields.date_end = new Date(safeFields.date_end).toISOString().slice(0, 10);
      const resp = await fetch(baseUrl, {
        method: 'POST', headers, body: JSON.stringify(safeFields),
      });
      if (!resp.ok) return res.status(resp.status).json({ error: 'NocoDB create failed' });
      const data = await resp.json();
      return res.status(201).json({ success: true, record: data });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to create', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
