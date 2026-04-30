// ===========================
// WLK Delivery Zone Logic
// Also handles Supabase order save for Paystack flow
// (because Paystack callback must be synchronous — save happens here instead)
// ===========================

const WLK_WHATSAPP_DELIVERY = '447424985544';

let chosenZone      = null;
let chosenZonePrice = null;
let chosenZoneLabel = null;
let pendingOrder    = null;

// ── On load: save the Paystack order to Supabase ─────────────

document.addEventListener('DOMContentLoaded', async function() {
  const raw = sessionStorage.getItem('wlk_pending_order');
  if (!raw) return;

  try {
    pendingOrder = JSON.parse(raw);
    const paystackRef = sessionStorage.getItem('wlk_paystack_ref') || '';

    // Save order to Supabase now that we're on delivery page
    await WLKSupabase.saveOrder({
      order_id:         pendingOrder.orderId,
      products:         pendingOrder.cart,
      total_price:      pendingOrder.total,
      payment_method:   'Paystack',
      payment_ref:      paystackRef,
      status:           'paid',
      customer_name:    pendingOrder.name,
      customer_email:   pendingOrder.email,
      customer_phone:   pendingOrder.phone,
      delivery_address: pendingOrder.address
    });

    // Clean up so it doesn't re-save on refresh
    sessionStorage.removeItem('wlk_pending_order');
    sessionStorage.removeItem('wlk_paystack_ref');
    sessionStorage.setItem('wlk_last_order', pendingOrder.orderId);

  } catch (e) {
    console.warn('Could not save order to Supabase:', e);
    // Not a fatal error — order was paid, we still proceed
  }
});

// ── Zone selection ────────────────────────────────────────────

function selectZone(zone, price, label) {
  chosenZone      = zone;
  chosenZonePrice = price;
  chosenZoneLabel = label;

  ['a','b','c'].forEach(z => {
    document.getElementById('zone-' + z).classList.toggle('selected', z.toUpperCase() === zone);
  });

  const btn = document.getElementById('zoneSubmitBtn');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = `Confirm Zone ${zone} & Send to WhatsApp →`;
}

// ── Confirm and send to WhatsApp ──────────────────────────────

async function confirmDelivery() {
  if (!chosenZone) {
    showToast('Please select a delivery zone');
    return;
  }

  const orderId = new URLSearchParams(window.location.search).get('order')
    || sessionStorage.getItem('wlk_last_order')
    || 'WLK-ORDER';

  // Get order data — from pendingOrder (if still in memory) or sessionStorage
  const orderData = pendingOrder || JSON.parse(sessionStorage.getItem('wlk_last_order_data') || '{}');

  // Update delivery zone in Supabase
  WLKSupabase.updateOrderDelivery(orderId, 'Zone ' + chosenZone).catch(console.warn);

  // Build WhatsApp confirmation message
  const itemsList = (orderData.cart || []).map(i =>
    `  • ${i.name} ×${i.qty} = ₦${(i.price * i.qty).toLocaleString()}`
  ).join('\n');

  const totalFmt = orderData.total
    ? '₦' + Number(orderData.total).toLocaleString()
    : 'Paid via Paystack';

  const msg = [
    `*WLK ORDER CONFIRMED — ${orderId}*`,
    '',
    '✅ Payment received via Paystack',
    '',
    '*Items Ordered:*',
    itemsList || '  (see order ID)',
    '',
    `*Order Total: ${totalFmt}*`,
    '',
    `*Delivery Zone: Zone ${chosenZone}*`,
    chosenZoneLabel,
    `Estimated delivery fee: ${chosenZonePrice}`,
    '',
    '*Customer Details:*',
    `Name: ${orderData.name || 'N/A'}`,
    `Phone: ${orderData.phone || 'N/A'}`,
    `Address: ${orderData.address || 'N/A'}`,
    '',
    'Please confirm dispatch timeline. Thank you! 🌿'
  ].join('\n');

  window.open(
    `https://wa.me/${WLK_WHATSAPP_DELIVERY}?text=${encodeURIComponent(msg)}`,
    '_blank'
  );

  window.location.href = 'success.html?method=paystack&order=' + orderId;
}

// ── Toast ─────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
