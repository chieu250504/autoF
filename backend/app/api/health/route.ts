import { supabase } from '@/lib/supabase';
import { handleOptions, jsonResponse } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  let dbStatus = false;
  let dbLatencyMs = 0;

  try {
    const start = Date.now();
    const { error } = await supabase.from('fbradar_config').select('id').limit(1);
    dbLatencyMs = Date.now() - start;
    dbStatus = !error;
  } catch {
    dbStatus = false;
  }

  return jsonResponse({
    status: 'online',
    service: 'FB Group Keyword Radar Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus,
      latency_ms: dbLatencyMs,
    },
  });
}

