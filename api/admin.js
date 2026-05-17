export default async function handler(req, res) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const AIRTABLE_BASE = 'appjmCsXtF4V9wmmt';
  const AIRTABLE_TABLE = 'tblhaBmXjcrE8U8ku';

  if (!AIRTABLE_PAT) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Auth check
  const pw = req.headers['x-admin-password'];
  if (!pw || pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`;
  const headers = {
    'Authorization': `Bearer ${AIRTABLE_PAT}`,
    'Content-Type': 'application/json',
  };

  // GET — fetch all events (no status filter)
  if (req.method === 'GET') {
    try {
      let allRecords = [];
      let offset = null;

      do {
        let url = `${airtableUrl}?maxRecords=100&sort%5B0%5D%5Bfield%5D=date_start&sort%5B0%5D%5Bdirection%5D=desc`;
        if (offset) url += `&offset=${offset}`;

        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          const body = await resp.text();
          return res.status(resp.status).json({ error: 'Airtable error', detail: body });
        }

        const data = await resp.json();
        allRecords = allRecords.concat(data.records || []);
        offset = data.offset || null;
      } while (offset);

      const events = allRecords.map(rec => {
        const f = rec.fields;
        return {
          id: rec.id,
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
          flyer_image: f.flyer_image && f.flyer_image[0] ? f.flyer_image[0].url : null,
          flyer_thumb: f.flyer_image && f.flyer_image[0] && f.flyer_image[0].thumbnails ? f.flyer_image[0].thumbnails.large.url : null,
        };
      });

      return res.status(200).json({ events, count: events.length });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch', detail: e.message });
    }
  }

  // PATCH — update an event
  if (req.method === 'PATCH') {
    try {
      const { id, fields } = req.body;
      if (!id || !fields) {
        return res.status(400).json({ error: 'Missing id or fields' });
      }

      // Only allow updating safe fields
      const allowed = ['event_name','date_start','date_end','time_start','location_name','address',
        'category','organizer','price','description','language','phone','status','is_sponsored'];
      const safeFields = {};
      for (const key of allowed) {
        if (key in fields) safeFields[key] = fields[key];
      }

      const resp = await fetch(`${airtableUrl}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: safeFields }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        return res.status(resp.status).json({ error: 'Airtable update failed', detail: body });
      }

      const data = await resp.json();
      return res.status(200).json({ success: true, record: data });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to update', detail: e.message });
    }
  }

  // POST — create a new event
  if (req.method === 'POST') {
    try {
      const { fields } = req.body;
      if (!fields || !fields.event_name || !fields.date_start) {
        return res.status(400).json({ error: 'Missing required fields (event_name, date_start)' });
      }

      const allowed = ['event_name','date_start','date_end','time_start','location_name','address',
        'category','organizer','price','description','language','phone','status','is_sponsored'];
      const safeFields = { status: 'pending' };
      for (const key of allowed) {
        if (key in fields && fields[key] !== '' && fields[key] !== null && fields[key] !== undefined) {
          safeFields[key] = fields[key];
        }
      }

      // Normalize dates to YYYY-MM-DD
      if (safeFields.date_start) safeFields.date_start = new Date(safeFields.date_start).toISOString().slice(0, 10);
      if (safeFields.date_end) safeFields.date_end = new Date(safeFields.date_end).toISOString().slice(0, 10);

      const resp = await fetch(airtableUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields: safeFields }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        return res.status(resp.status).json({ error: 'Airtable create failed', detail: body, sentFields: safeFields });
      }

      const data = await resp.json();
      return res.status(201).json({ success: true, record: data });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to create', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
