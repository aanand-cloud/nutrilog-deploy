import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

let adminClient = null;

/** Serverless-safe Supabase admin client (auth + DB only, no native WebSocket required). */
export function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: ws },
      },
    );
  }
  return adminClient;
}
