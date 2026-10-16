import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../../src/verify-login.mjs';
import config from '../../aleph.config.json' with { type: 'json' };

function bearer(request) { return request.headers?.authorization ?? request.headers?.Authorization; }

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  let user;
  try { user = await createLoginVerifier({ config, supabaseSecretKey: key, supabaseClient: supabase })(bearer(request)); }
  catch { user = null; }
  if (!user || user.kind !== 'student') return response.status(401).json({ error: 'LOGIN_REQUIRED' });
  const id = request.query?.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) return response.status(404).json({ error: 'NOTE_NOT_FOUND' });

  if (request.method === 'GET') {
    const { data, error } = await supabase.from('notes').select('id,title,content').eq('id', id).maybeSingle();
    if (error) return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    if (!data) return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return response.status(200).json({ id: data.id, title: data.title, body: data.content });
  }
  if (request.method === 'PUT') {
    const { title, body } = request.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) return response.status(400).json({ error: 'INVALID_NOTE' });
    const { data, error } = await supabase.from('notes').update({ title: title.trim(), content: body.trim() }).eq('id', id).select('id').maybeSingle();
    if (error) return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    if (!data) return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return response.status(200).json({ id: data.id });
  }
  if (request.method === 'DELETE') {
    const { data, error } = await supabase.from('notes').delete().eq('id', id).select('id').maybeSingle();
    if (error) return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    if (!data) return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return response.status(204).end();
  }
  response.setHeader('Allow', 'GET, PUT, DELETE');
  return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
