export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const AIRTABLE_BASE = 'appjmCsXtF4V9wmmt';
  const AIRTABLE_TABLE = 'tblhaBmXjcrE8U8ku';

  if (!AIRTABLE_PAT) return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const pw = req.headers['x-admin-password'];
  if (!pw || pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { recordId, base64, filename, contentType } = req.body;
    if (!recordId || !base64) {
      return res.status(400).json({ error: 'Missing recordId or base64' });
    }

    // Step 1: Get upload URL from Airtable
    const uploadReqUrl = `https://content.airtable.com/v0/${AIRTABLE_BASE}/uploadAttachment`;
    const uploadReqResp = await fetch(uploadReqUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: contentType || 'image/jpeg',
        filename: filename || 'flyer.jpg',
      }),
    });

    if (uploadReqResp.ok) {
      const uploadData = await uploadReqResp.json();
      const { uploadUrl, id: attachmentId } = uploadData;

      // Step 2: Upload the binary to the upload URL
      const binaryData = Buffer.from(base64, 'base64');
      const putResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'image/jpeg' },
        body: binaryData,
      });

      if (putResp.ok) {
        // Step 3: Attach to record
        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${recordId}`;
        const patchResp = await fetch(airtableUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: { flyer_image: [{ id: attachmentId }] },
          }),
        });

        if (patchResp.ok) {
          return res.status(200).json({ success: true });
        }
        const patchBody = await patchResp.text();
        // Fall through to URL method
      }
    }

    // Fallback: Try URL-based attachment method
    // First upload to tmpfiles.org (free, no auth, 1hr expiry — enough for Airtable to fetch)
    const binaryData = Buffer.from(base64, 'base64');
    const formData = new FormData();
    const blob = new Blob([binaryData], { type: contentType || 'image/jpeg' });
    formData.append('file', blob, filename || 'flyer.jpg');

    const tmpResp = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });

    if (tmpResp.ok) {
      const tmpData = await tmpResp.json();
      // tmpfiles.org returns URL like https://tmpfiles.org/12345/file.jpg
      // Need to convert to direct link: https://tmpfiles.org/dl/12345/file.jpg
      let tmpUrl = tmpData.data?.url;
      if (tmpUrl) {
        tmpUrl = tmpUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${recordId}`;
        const patchResp = await fetch(airtableUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: { flyer_image: [{ url: tmpUrl, filename: filename || 'flyer.jpg' }] },
          }),
        });

        if (patchResp.ok) {
          return res.status(200).json({ success: true });
        }
        const body = await patchResp.text();
        return res.status(patchResp.status).json({ error: 'Airtable attach failed', detail: body });
      }
    }

    return res.status(500).json({ error: 'All upload methods failed' });
  } catch (e) {
    return res.status(502).json({ error: 'Upload failed', detail: e.message });
  }
}
