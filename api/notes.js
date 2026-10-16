import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import config from '../aleph.config.json' with { type: 'json' };

const SAMPLE_MARKER = 'SAMPLE_NOTE_1';

function services() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) throw new Error('NOTES_UNAVAILABLE');
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return { supabase, verify: createLoginVerifier({ config, supabaseSecretKey: secretKey, supabaseClient: supabase }) };
}

function bearer(request) { return request.headers?.authorization ?? request.headers?.Authorization; }

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  let auth;
  try { auth = await services(); } catch { return response.status(503).json({ error: 'NOTES_UNAVAILABLE' }); }
  let user;
  try { user = await auth.verify(bearer(request)); } catch { user = null; }
  if (!user || user.kind !== 'student') return response.status(401).json({ error: 'LOGIN_REQUIRED' });

  if (request.method === 'GET') {
    const { data, error } = await auth.supabase.from('notes').select('id,title,content').eq('owner_id', user.userId).order('id');
    if (error) return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    return response.status(200).json({ sampleMarker: SAMPLE_MARKER, notes: data.map(({ id, title, content }) => ({ id, title, body: content })) });
  }
  if (request.method === 'POST') {
    const { title, body, id } = request.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) return response.status(400).json({ error: 'INVALID_NOTE' });
    const row = { title: title.trim(), content: body.trim(), owner_id: user.userId };
    if (id !== undefined) {
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) return response.status(400).json({ error: 'INVALID_NOTE_ID' });
      row.id = id;
    }
    const { data, error } = await auth.supabase.from('notes').insert(row).select('id').single();
    if (error) return response.status(503).json({ error: 'NOTES_UNAVAILABLE' });
    return response.status(201).json({ id: data.id });
  }
  response.setHeader('Allow', 'GET, POST');
  return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
