export default async function handler(req, res) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const AIRTABLE_BASE = 'appjmCsXtF4V9wmmt';
  const AIRTABLE_TABLE = 'tblhaBmXjcrE8U8ku';

  if (!AIRTABLE_PAT) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const filter = encodeURIComponent("{status}='approved'");
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`
      + `?filterByFormula=${filter}`
      + `&maxRecords=200`
      + `&sort%5B0%5D%5Bfield%5D=date_start`
      + `&sort%5B0%5D%5Bdirection%5D=asc`;

    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
    });

    if (!resp.ok) {
      const body = await resp.text();
      return res.status(resp.status).json({ error: 'Airtable error', detail: body });
    }

    const data = await resp.json();
    const events = (data.records || []).map(rec => {
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
        is_sponsored: !!f.is_sponsored,
        region: f.region || '',
        flyer_image: f.flyer_image && f.flyer_image[0] ? f.flyer_image[0].url : null,
        flyer_thumb: f.flyer_image && f.flyer_image[0] && f.flyer_image[0].thumbnails ? f.flyer_image[0].thumbnails.large.url : null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json({ events, count: events.length });
  } catch (e) {
    return res.status(502).json({ error: 'Failed to fetch events', detail: e.message });
  }
}
