export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

      // Beta users - no tunnel dependency
      const users = [
        { id: 14, username: 'nikie', password: 'Poggio00', display_name: 'Nikie', default_region: 'Maremma' },
        { id: 15, username: 'gabe', password: 'Poggio11', display_name: 'Gabe', default_region: 'Maremma' },
        { id: 16, username: 'user2', password: 'Poggio22', display_name: 'Tester 2', default_region: 'Maremma' },
        { id: 17, username: 'user3', password: 'Poggio33', display_name: 'Tester 3', default_region: null },
        { id: 18, username: 'user4', password: 'Poggio44', display_name: 'Tester 4', default_region: null },
        { id: 19, username: 'user5', password: 'Poggio55', display_name: 'Tester 5', default_region: null },
        { id: 20, username: 'user6', password: 'Poggio66', display_name: 'Tester 6', default_region: null },
        { id: 21, username: 'user7', password: 'Poggio77', display_name: 'Tester 7', default_region: null },
        { id: 22, username: 'user8', password: 'Poggio88', display_name: 'Tester 8', default_region: null },
        { id: 23, username: 'user9', password: 'Poggio99', display_name: 'Tester 9', default_region: null },
      ];

      const user = users.find(u => u.username === username && u.password === password);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      return res.status(200).json({
        success: true,
        userId: user.id,
        username: user.username,
        display_name: user.display_name,
        default_region: user.default_region,
      });
    } catch (e) {
      return res.status(502).json({ error: 'Auth failed', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
