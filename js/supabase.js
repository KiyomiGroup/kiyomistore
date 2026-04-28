// ===========================
// WLK Supabase Integration
// ===========================
// TODO: Replace with your actual Supabase URL and anon key
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const WLKSupabase = (() => {

  async function saveOrder(orderData) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData)
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Supabase error:', err);
        return null;
      }

      const data = await res.json();
      return data[0] || data;
    } catch (e) {
      console.error('Supabase saveOrder failed:', e);
      return null;
    }
  }

  async function updateOrderDelivery(orderId, zone) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ delivery_zone: zone, status: 'confirmed' })
      });
      return res.ok;
    } catch (e) {
      console.error('updateOrderDelivery failed:', e);
      return false;
    }
  }

  return { saveOrder, updateOrderDelivery };
})();
