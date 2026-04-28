// Vercel serverless function: POST /api/share
// Body: { noteId: string, email: string }
// Looks up the note in Supabase, then sends a styled HTML email via Resend.
// Reads RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY from env — never returns them.

const LIVE_URL = 'https://hello-pioneer-nu.vercel.app';
const FROM = 'Pioneer Notes <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function renderEmail(note) {
  const title = escapeHtml(note.title || '(untitled)');
  const content = escapeHtml(note.content || '').replace(/\n/g, '<br>');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Shared note</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#4f46e5;padding:24px 32px;">
              <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Pioneer Notes</div>
              <div style="font-size:13px;color:#c7d2fe;margin-top:4px;">A note has been shared with you</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 16px;">
              <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b0d10;font-weight:700;">${title}</h2>
              <div style="font-size:16px;line-height:1.6;color:#1f2937;">${content}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              <a href="${LIVE_URL}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View all notes &rarr;</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
              Sent from Pioneer Notes &middot; <a href="${LIVE_URL}" style="color:#4f46e5;text-decoration:none;">${LIVE_URL}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(note) {
  return `A note has been shared with you on Pioneer Notes.

${note.title || '(untitled)'}

${note.content || ''}

View all notes: ${LIVE_URL}
`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { noteId, email } = body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }
  if (typeof noteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(noteId)) {
    return res.status(400).json({ error: 'invalid noteId' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'supabase not configured' });
  }
  if (!resendKey) {
    return res.status(500).json({ error: 'resend not configured' });
  }

  const noteResp = await fetch(
    `${supabaseUrl}/rest/v1/notes?id=eq.${encodeURIComponent(noteId)}&select=id,title,content`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (!noteResp.ok) {
    return res.status(502).json({ error: 'failed to fetch note' });
  }
  const notes = await noteResp.json();
  if (!Array.isArray(notes) || notes.length === 0) {
    return res.status(404).json({ error: 'note not found' });
  }
  const note = notes[0];

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: `Shared note: ${note.title || 'untitled'}`,
      html: renderEmail(note),
      text: renderText(note),
    }),
  });

  const resendBody = await resendResp.json().catch(() => ({}));
  if (!resendResp.ok) {
    return res.status(502).json({
      error: 'resend rejected the send',
      detail: resendBody?.message || resendBody?.error || `HTTP ${resendResp.status}`,
    });
  }

  return res.status(200).json({ ok: true, id: resendBody.id });
}
