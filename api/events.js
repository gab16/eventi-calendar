export default async function handler(req, res) {
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const NOCODB_URL = process.env.NOCODB_URL || 'https://nocodb.tattionline.com';
  const BASE_ID = process.env.NOCODB_BASE_ID;
  const EVENTS_TABLE = process.env.NOCODB_EVENTS_TABLE;

  if (!NOCODB_TOKEN) return res.status(500).json({ error: 'NOCODB_TOKEN not configured' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const region = req.query.region || '';
    let where = `(status,eq,approved)`;
    if (region) where += `~and(region,eq,${region})`;

    const url = `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${EVENTS_TABLE}`
      + `?where=${encodeURIComponent(where)}`
      + `&limit=200`
      + `&sort=date_start`;

    const resp = await fetch(url, {
      headers: { 'xc-token': NOCODB_TOKEN },
    });

    if (!resp.ok) {
      const body = await resp.text();
      return res.status(resp.status).json({ error: 'NocoDB error', detail: body });
    }

    const data = await resp.json();
    const events = (data.list || []).map(f => ({
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
      is_sponsored: !!f.is_sponsored,
      region: f.region || '',
      flyer_image: f.flyer_image ? JSON.parse(f.flyer_image)[0]?.url || null : null,
      flyer_thumb: f.flyer_image ? JSON.parse(f.flyer_image)[0]?.thumbnails?.large?.url || null : null,
    }));

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json({ events, count: events.length });
  } catch (e) {
    return res.status(502).json({ error: 'Failed to fetch events', detail: e.message });
  }
}
