import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mugaogyqtqgwhrfkfdgm.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_bqawiRtLOW9NFC3eJrWM-g_u6VeoKzL';

export const supabase = createClient(supabaseUrl, supabaseKey);
