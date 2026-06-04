export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  const NOCODB_TOKEN = process.env.NOCODB_TOKEN;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const NOCODB_URL = 'https://nocodb.tattionline.com';
  const BASE_ID = 'p8agcx6gvem4u30';
  const TABLE_ID = 'mrpiz5gilnibj2j';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const pw = req.headers['x-admin-password'];
  if (!pw || pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!NOCODB_TOKEN) return res.status(500).json({ error: 'NOCODB_TOKEN not configured' });

  try {
    const { recordId, base64, filename, contentType } = req.body;
    if (!recordId || !base64) {
      return res.status(400).json({ error: 'Missing recordId or base64' });
    }

    const mime = contentType || 'image/jpeg';
    const fname = filename || 'flyer.jpg';
    const binaryData = Buffer.from(base64, 'base64');

    // Step 1: Upload binary to NocoDB storage
    const formData = new FormData();
    const blob = new Blob([binaryData], { type: mime });
    formData.append('file', blob, fname);

    // Try new API path first, fall back to legacy
    let uploadResp = await fetch(`${NOCODB_URL}/api/v1/storage/upload?path=flyer_images`, {
      method: 'POST',
      headers: { 'xc-token': NOCODB_TOKEN },
      body: formData,
    });

    // Fallback to legacy path
    if (!uploadResp.ok && uploadResp.status === 404) {
      uploadResp = await fetch(`${NOCODB_URL}/api/v1/db/storage/upload`, {
        method: 'POST',
        headers: { 'xc-token': NOCODB_TOKEN },
        body: formData,
      });
    }

    if (!uploadResp.ok) {
      const detail = await uploadResp.text();
      return res.status(502).json({ error: 'NocoDB storage upload failed', detail });
    }

    const uploaded = await uploadResp.json();
    // NocoDB returns an array
    const attachment = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    // Step 2: Patch the record's flyer_image field
    const patchResp = await fetch(
      `${NOCODB_URL}/api/v1/db/data/noco/${BASE_ID}/${TABLE_ID}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'xc-token': NOCODB_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flyer_image: [attachment] }),
      }
    );

    if (!patchResp.ok) {
      const detail = await patchResp.text();
      return res.status(502).json({ error: 'NocoDB record patch failed', detail });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(502).json({ error: 'Upload failed', detail: e.message });
  }
}
