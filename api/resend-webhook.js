// Vercel serverless function: POST /api/resend-webhook
// Receives Resend webhook events, looks up the note_id from the original
// 'sent' row by message_id, and inserts one email_events row per event.
//
// Resend payload shape (relevant fields):
//   { type: 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced',
//     created_at: '...',
//     data: { email_id: '...', to: ['...'], ... } }

const TRACKED_EVENTS = new Set([
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'supabase not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'invalid json' });
  }

  const type = body.type;
  const data = body.data || {};
  const messageId = data.email_id;
  const recipient = Array.isArray(data.to) ? data.to[0] : data.to;
  const createdAt = body.created_at || data.created_at || null;

  // Acknowledge unknown event types with 200 so Resend doesn't retry them.
  if (!type || !TRACKED_EVENTS.has(type)) {
    return res.status(200).json({ ok: true, ignored: true });
  }
  if (typeof messageId !== 'string' || !messageId || typeof recipient !== 'string' || !recipient) {
    return res.status(400).json({ error: 'missing email_id or to' });
  }

  const sbHeaders = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  // Look up the note this message belongs to via the 'sent' row.
  let noteId = null;
  const lookupResp = await fetch(
    `${supabaseUrl}/rest/v1/email_events?message_id=eq.${encodeURIComponent(messageId)}&event_type=eq.sent&select=note_id&limit=1`,
    { headers: sbHeaders }
  );
  if (lookupResp.ok) {
    const rows = await lookupResp.json().catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) noteId = rows[0].note_id || null;
  }

  const row = {
    message_id: messageId,
    note_id: noteId,
    recipient,
    event_type: type,
  };
  if (createdAt) row.created_at = createdAt;

  const insertResp = await fetch(`${supabaseUrl}/rest/v1/email_events`, {
    method: 'POST',
    headers: {
      ...sbHeaders,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!insertResp.ok) {
    const detail = await insertResp.text().catch(() => '');
    return res.status(502).json({ error: 'failed to insert event', detail });
  }

  return res.status(200).json({ ok: true });
}
