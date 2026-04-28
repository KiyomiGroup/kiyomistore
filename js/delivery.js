// ===========================
// WLK Delivery Zone Logic
// ===========================

const WLK_WHATSAPP = '447424985544';

let chosenZone = null;
let chosenZonePrice = null;
let chosenZoneLabel = null;

function selectZone(zone, price, label) {
  chosenZone = zone;
  chosenZonePrice = price;
  chosenZoneLabel = label;

  // UI
  ['a','b','c'].forEach(z => {
    document.getElementById('zone-' + z).classList.toggle('selected', z.toUpperCase() === zone);
  });

  const btn = document.getElementById('zoneSubmitBtn');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = `Confirm Zone ${zone} & Continue →`;
}

async function confirmDelivery() {
  if (!chosenZone) {
    showToast('Please select a delivery zone');
    return;
  }

  const orderId = new URLSearchParams(window.location.search).get('order')
    || sessionStorage.getItem('wlk_last_order')
    || 'WLK-ORDER';

  const orderData = JSON.parse(sessionStorage.getItem('wlk_last_order_data') || '{}');

  // Update Supabase
  await WLKSupabase.updateOrderDelivery(orderId, 'Zone ' + chosenZone);

  // Build WhatsApp message
  let itemsList = '';
  if (orderData.cart && orderData.cart.length > 0) {
    itemsList = orderData.cart.map(i =>
      `  • ${i.name} × ${i.qty} = ₦${(i.price * i.qty).toLocaleString()}`
    ).join('\n');
  }

  const total = orderData.total ? '₦' + orderData.total.toLocaleString() : 'Paid via Paystack';

  const msg = `*WLK ORDER CONFIRMATION — ${orderId}*

✅ Payment received via Paystack

*Items:*
${itemsList}

*Order Total: ${total}*

*Delivery Zone: Zone ${chosenZone}*
${chosenZoneLabel}
Estimated delivery fee: ${chosenZonePrice}

*Customer:*
Name: ${orderData.name || 'N/A'}
Phone: ${orderData.phone || 'N/A'}
Address: ${orderData.address || 'N/A'}

Please confirm dispatch timeline. Thank you! 🌿`;

  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${WLK_WHATSAPP}?text=${encoded}`, '_blank');

  window.location.href = 'success.html?method=paystack&order=' + orderId;
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}
