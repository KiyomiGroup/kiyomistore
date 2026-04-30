// WLK Delivery Zone — handles return from Paystack redirect
// Paystack returns to: delivery.html?order=WLK-XXX&trxref=xxx&reference=xxx

var WLK_WHATSAPP_DEL = '447424985544';
var chosenZone      = null;
var chosenZonePrice = null;
var chosenZoneLabel = null;
var pendingOrder    = null;

document.addEventListener('DOMContentLoaded', function() {
  var params  = new URLSearchParams(window.location.search);
  var orderId = params.get('order') || sessionStorage.getItem('wlk_last_order') || '';
  var ref     = params.get('reference') || params.get('trxref') || sessionStorage.getItem('wlk_paystack_ref') || '';

  // Read pending order saved before Paystack redirect
  var raw = sessionStorage.getItem('wlk_pending_order');
  if (raw) {
    try { pendingOrder = JSON.parse(raw); } catch(e) {}
  }

  // Save to Supabase now (async is fine here — we're not inside Paystack callback)
  if (pendingOrder && pendingOrder.orderId) {
    WLKSupabase.saveOrder({
      order_id:         pendingOrder.orderId,
      products:         pendingOrder.cart,
      total_price:      pendingOrder.total,
      payment_method:   'Paystack',
      payment_ref:      ref,
      status:           'paid',
      customer_name:    pendingOrder.name,
      customer_email:   pendingOrder.email,
      customer_phone:   pendingOrder.phone,
      delivery_address: pendingOrder.address
    }).then(function() {
      sessionStorage.removeItem('wlk_pending_order');
      sessionStorage.removeItem('wlk_paystack_ref');
      sessionStorage.setItem('wlk_last_order', pendingOrder.orderId);
    }).catch(function(e) { console.warn('Supabase save:', e); });
  }
});

// ─── Zone selection ───────────────────────────────────────────

function selectZone(zone, price, label) {
  chosenZone      = zone;
  chosenZonePrice = price;
  chosenZoneLabel = label;

  ['a','b','c'].forEach(function(z) {
    document.getElementById('zone-' + z).classList.toggle('selected', z.toUpperCase() === zone);
  });

  var btn = document.getElementById('zoneSubmitBtn');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = 'Confirm Zone ' + zone + ' & Send to WhatsApp \u2192';
}

// ─── Confirm ─────────────────────────────────────────────────

function confirmDelivery() {
  if (!chosenZone) { showToast('Please select a delivery zone'); return; }

  var params  = new URLSearchParams(window.location.search);
  var orderId = params.get('order') || sessionStorage.getItem('wlk_last_order') || 'WLK-ORDER';
  var data    = pendingOrder || {};

  WLKSupabase.updateOrderDelivery(orderId, 'Zone ' + chosenZone).catch(function(e) { console.warn(e); });

  var lines = (data.cart || []).map(function(i) {
    return '  \u2022 ' + i.name + ' \xd7' + i.qty + ' = \u20a6' + (i.price * i.qty).toLocaleString();
  }).join('\n');

  var totalFmt = data.total ? '\u20a6' + Number(data.total).toLocaleString() : 'Paid via Paystack';

  var msg = '*WLK ORDER CONFIRMED \u2014 ' + orderId + '*\n\n'
    + '\u2705 Payment received via Paystack\n\n'
    + '*Items:*\n' + (lines || '  (see order ID)') + '\n\n'
    + '*Order Total: ' + totalFmt + '*\n\n'
    + '*Delivery Zone: Zone ' + chosenZone + '*\n'
    + chosenZoneLabel + '\n'
    + 'Estimated fee: ' + chosenZonePrice + '\n\n'
    + '*Customer:*\n'
    + 'Name: ' + (data.name || 'N/A') + '\n'
    + 'Phone: ' + (data.phone || 'N/A') + '\n'
    + 'Address: ' + (data.address || 'N/A') + '\n\n'
    + 'Please confirm dispatch. Thank you \ud83c\udf3f';

  window.open('https://wa.me/' + WLK_WHATSAPP_DEL + '?text=' + encodeURIComponent(msg), '_blank');
  window.location.href = 'success.html?method=paystack&order=' + orderId;
}

// ─── Toast ────────────────────────────────────────────────────

var _toastT;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(function() { t.classList.remove('show'); }, 2800);
}
