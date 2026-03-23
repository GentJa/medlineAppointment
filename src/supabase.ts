// @ts-ignore
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://navcyhlrtikiaabapnyr.supabase.co';
// WARNING: This looks like a Stripe publishable key, not a Supabase key.
// Please replace this with your actual Supabase "anon" (public) key.
const supabaseAnonKey = 'sb_publishable_-4EIkUvnsFne1-_-BdFdFA_IIE6biVH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

