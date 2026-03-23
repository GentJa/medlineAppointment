// @ts-ignore
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://navcyhlrtikiaabapnyr.supabase.co';
// WARNING: This key starts with 'sb_publishable_', which is typical for Stripe.
// If you are getting authentication errors, please verify this is your Supabase 'anon' (public) key.
// You can find the correct key in your Supabase Dashboard settings under API.
const supabaseAnonKey = 'sb_publishable_-4EIkUvnsFne1-_-BdFdFA_IIE6biVH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

