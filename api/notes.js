import { createClient } from '@supabase/supabase-js';

const SAMPLE_MARKER = 'SAMPLE_NOTE_1';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
  }

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    }
    const supabase = createClient(url.href.replace(/\/$/u, ''), secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from('notes')
      .select('id,title,content')
      .order('id', { ascending: true })
      .limit(4);
    if (error || !Array.isArray(data) || data.length !== 4
        || data.some(note => typeof note.title !== 'string' || typeof note.content !== 'string')) {
      return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    }
    return response.status(200).json({
      sampleMarker: SAMPLE_MARKER,
      notes: data.map(({ title, content }) => ({ title, content })),
    });
  } catch {
    // Never log configuration, credentials, or database response details.
    return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
