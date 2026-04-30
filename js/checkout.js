// ===========================
// WLK Checkout Logic
// Paystack callback MUST be synchronous — no async/await inside it
// ===========================

const PAYSTACK_PUBLIC_KEY = 'pk_live_a5f0f030c3f7482268e7d5d6ffbb852774f89b4b';
const WLK_WHATSAPP = '447424985544';

let selectedPayment = 'paystack';

// ── UI helpers ──────────────────────────────────────────────

function selectPayment(method) {
  selectedPayment = method;
  document.getElementById('optPaystack').classList.toggle('selected', method === 'paystack');
  document.getElementById('optWhatsapp').classList.toggle('selected', method === 'whatsapp');
  document.getElementById('optPaystack').querySelector('.payment-option__check').textContent = method === 'paystack' ? '✓' : '';
  document.getElementById('optWhatsapp').querySelector('.payment-option__check').textContent = method === 'whatsapp' ? '✓' : '';

  const btn = document.getElementById('submitBtn');
  if (method === 'whatsapp') {
    btn.textContent = 'Order via WhatsApp →';
    btn.classList.add('checkout-submit--gold');
  } else {
    btn.textContent = 'Pay with Paystack →';
    btn.classList.remove('checkout-submit--gold');
  }
}

function resetBtn() {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = selectedPayment === 'whatsapp' ? 'Order via WhatsApp →' : 'Pay with Paystack →';
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function generateOrderId() {
  return 'WLK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ── Order summary render ─────────────────────────────────────

function renderOrderSummary() {
  const cart = WLKCart.getCart();
  const el = document.getElementById('checkoutOrderItems');
  if (!el) return;

  if (cart.length === 0) {
    el.innerHTML = '<p style="color:#999;font-size:13px">No items. <a href="index.html" style="color:#c9a84c;text-decoration:underline">Go back</a></p>';
    return;
  }

  el.innerHTML = cart.map(item => `
    <div class="checkout-order-item">
      <span class="checkout-order-item__name">${item.name}</span>
      <span class="checkout-order-item__qty">×${item.qty}</span>
      <span class="checkout-order-item__price">${WLKCart.formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('') + `
    <div class="checkout-order-total">
      <span>Total</span>
      <span>${WLKCart.formatPrice(WLKCart.getTotal())}</span>
    </div>
  `;
}

// ── Form ─────────────────────────────────────────────────────

function getFormData() {
  return {
    name:    document.getElementById('custName').value.trim(),
    email:   document.getElementById('custEmail').value.trim(),
    phone:   document.getElementById('custPhone').value.trim(),
    address: document.getElementById('custAddress').value.trim()
  };
}

function validateForm(data) {
  if (!data.name)    { showToast('Please enter your name');            return false; }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
                     { showToast('Please enter a valid email');         return false; }
  if (!data.phone)   { showToast('Please enter your phone number');    return false; }
  if (!data.address) { showToast('Please enter your delivery address'); return false; }
  return true;
}

// ── Main entry ───────────────────────────────────────────────

async function handleCheckout() {
  const data = getFormData();
  if (!validateForm(data)) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  if (selectedPayment === 'whatsapp') {
    await handleWhatsAppCheckout(data);
  } else {
    handlePaystackCheckout(data);   // NOT async — Paystack opens its own popup
  }
}

// ── WhatsApp flow ────────────────────────────────────────────

async function handleWhatsAppCheckout(customerData) {
  const cart  = WLKCart.getCart();
  const total = WLKCart.getTotal();
  const orderId = generateOrderId();

  // Fire-and-forget Supabase save (don't await critically)
  WLKSupabase.saveOrder({
    order_id: orderId, products: cart, total_price: total,
    payment_method: 'WhatsApp', status: 'pending',
    customer_name: customerData.name, customer_email: customerData.email,
    customer_phone: customerData.phone, delivery_address: customerData.address
  }).catch(console.warn);

  const lines = cart.map(i => `  • ${i.name} ×${i.qty} = ${WLKCart.formatPrice(i.price * i.qty)}`).join('\n');
  const msg = [
    `*WLK ORDER — ${orderId}*`,
    '',
    'Hello! I\'d like to place an order:',
    '',
    lines,
    '',
    `*TOTAL: ${WLKCart.formatPrice(total)}*`,
    '',
    '*My Details:*',
    `Name: ${customerData.name}`,
    `Email: ${customerData.email}`,
    `Phone: ${customerData.phone}`,
    `Address: ${customerData.address}`,
    '',
    'Please confirm availability and delivery cost. Thank you! 🌿'
  ].join('\n');

  window.open(`https://wa.me/${WLK_WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');

  sessionStorage.setItem('wlk_last_order', orderId);
  WLKCart.clearCart();
  window.location.href = 'success.html?method=whatsapp&order=' + orderId;
}

// ── Paystack flow ────────────────────────────────────────────
// RULE: callback passed to PaystackPop.setup() MUST be a plain synchronous
// function. No async, no await inside it. Do async work (Supabase) AFTER
// redirect on the next page instead.

function handlePaystackCheckout(customerData) {
  if (typeof PaystackPop === 'undefined') {
    showToast('Payment service not loaded. Please refresh and try again.');
    resetBtn();
    return;
  }

  const cart    = WLKCart.getCart();
  const total   = WLKCart.getTotal();
  const orderId = generateOrderId();

  // Persist everything to sessionStorage NOW so delivery.html can save to Supabase
  sessionStorage.setItem('wlk_pending_order', JSON.stringify({
    orderId,
    cart,
    total,
    name:    customerData.name,
    email:   customerData.email,
    phone:   customerData.phone,
    address: customerData.address
  }));

  const handler = PaystackPop.setup({
    key:      PAYSTACK_PUBLIC_KEY,
    email:    customerData.email,
    amount:   total * 100,   // kobo
    currency: 'NGN',
    ref:      orderId,
    label:    customerData.name,
    metadata: {
      custom_fields: [
        { display_name: 'Customer Name', variable_name: 'customer_name', value: customerData.name },
        { display_name: 'Phone',         variable_name: 'phone',         value: customerData.phone },
        { display_name: 'Address',       variable_name: 'address',       value: customerData.address }
      ]
    },

    // ✅ MUST be a plain synchronous function — no async/await
    callback: function(response) {
      // Store the Paystack reference synchronously
      sessionStorage.setItem('wlk_paystack_ref', response.reference);
      // Clear cart synchronously
      WLKCart.clearCart();
      // Redirect — delivery.html will handle the Supabase save
      window.location.href = 'delivery.html?order=' + orderId;
    },

    onClose: function() {
      showToast('Payment cancelled. You can try again.');
      resetBtn();
    }
  });

  handler.openIframe();
}

// ── Login banner dismiss ─────────────────────────────────────

function dismissLoginBanner() {
  const banner = document.getElementById('loginSuggestionBanner');
  if (!banner) return;
  banner.style.transition = 'opacity 0.3s, transform 0.3s';
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(-8px)';
  setTimeout(() => banner.style.display = 'none', 300);
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  if (WLKCart.getCount() === 0) {
    window.location.href = 'index.html';
    return;
  }
  renderOrderSummary();

  // Show login nudge after half a second
  setTimeout(function() {
    var banner = document.getElementById('loginSuggestionBanner');
    if (banner) {
      banner.style.display = 'block';
      setTimeout(function() {
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
      }, 50);
    }
  }, 600);
});
