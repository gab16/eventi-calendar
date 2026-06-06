import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const pw = req.headers['x-admin-password'];
  if (!pw || pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_BUCKET = process.env.R2_BUCKET_NAME || 'kalendarr-images';

  if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID) {
    return res.status(500).json({ error: 'R2 credentials not configured' });
  }

  try {
    const { recordId, base64, filename, contentType } = req.body;
    if (!recordId || !base64) {
      return res.status(400).json({ error: 'Missing recordId or base64' });
    }

    const mime = contentType || 'image/jpeg';
    const binaryData = Buffer.from(base64, 'base64');

    // Deterministic key: flyers/<recordId>.jpg — no PATCH to NocoDB needed
    const key = `flyers/${recordId}.jpg`;

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: binaryData,
      ContentType: mime,
    }));

    const publicUrl = `https://images.tattionline.com/${key}`;
    return res.status(200).json({ success: true, imageUrl: publicUrl });
  } catch (e) {
    return res.status(502).json({ error: 'Upload failed', detail: e.message });
  }
}
