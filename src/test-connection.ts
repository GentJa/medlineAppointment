import { supabase } from './supabase';

async function testConnection() {
  console.log('--- Supabase Diagnostic Test ---');
  console.log('Checking connection...');

  try {
    const { error } = await supabase.from('bookings').select('id').limit(1);


    if (error) {
      if (error.code === 'PGRST205') {
        console.error('❌ ERROR: Table "bookings" NOT FOUND in your Supabase project.');
        console.error('👉 ACTION REQ: Go to Supabase SQL Editor and run the content of "src/schema.sql"');
      } else if (error.message.includes('API key')) {
        console.error('❌ ERROR: Invalid API Key.');
        console.error('👉 ACTION REQ: Check your "anon" key in "src/supabase.ts". It currently looks like a Stripe key!');
      } else {
        console.error('❌ ERROR:', error.message);
      }
    } else {
      console.log('✅ SUCCESS: Connection successful and "bookings" table found!');
    }
  } catch (err: any) {
    console.error('❌ CRITICAL ERROR:', err.message);
  }
}

testConnection();
