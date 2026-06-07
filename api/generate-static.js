import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const pw = req.headers['x-admin-password'] || req.query.pw;
  if (!pw || pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

  const NOCODB_URL = process.env.NOCODB_URL || 'https://nocodb.tattionline.com';
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const BASE_ID = process.env.NOCODB_BASE_ID || 'p8agcx6gvem4u30';
  const TABLE_ID = process.env.NOCODB_EVENTS_TABLE || 'mrpiz5gilnibj2j';
  const R2_BASE = 'https://images.tattionline.com/flyers';

  try {
    // Fetch all events from NocoDB
    const allRecords = [];
    let offset = 0;
    while (true) {
      const url = `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${TABLE_ID}?limit=200&offset=${offset}&sort=date_start`;
      const resp = await fetch(url, { headers: { 'xc-token': NOCODB_TOKEN } });
      if (!resp.ok) throw new Error('NocoDB fetch failed: ' + resp.status);
      const data = await resp.json();
      allRecords.push(...(data.list || []));
      if ((data.list || []).length < 200) break;
      offset += 200;
    }

    const events = allRecords.map(f => ({
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
      flyer_image: `${R2_BASE}/${f.Id}.jpg`,
      flyer_thumb: `${R2_BASE}/${f.Id}.jpg`,
    }));

    const payload = JSON.stringify({ events, count: events.length });

    // Upload to R2
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'kalendarr-images',
      Key: 'events.json',
      Body: payload,
      ContentType: 'application/json',
    }));

    return res.status(200).json({ success: true, count: events.length });
  } catch (e) {
    return res.status(502).json({ error: 'Failed', detail: e.message });
  }
}
