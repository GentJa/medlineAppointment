import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://navcyhlrtikiaabapnyr.supabase.co';
const supabaseAnonKey = 'sb_publishable_-4EIkUvnsFne1-_-BdFdFA_IIE6biVH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
