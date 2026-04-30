// WLK Checkout v5 — Paystack via Supabase Edge Function
// Secret key lives in Supabase Edge Function, never in this file.

// ─── Config ───────────────────────────────────────────────────
var PAYSTACK_PUBLIC_KEY = 'pk_live_a5f0f030c3f7482268e7d5d6ffbb852774f89b4b';
var WLK_WHATSAPP        = '447424985544';
// SUPABASE_URL and SUPABASE_ANON_KEY are already declared in supabase.js

var PAYSTACK_INIT_URL = SUPABASE_URL + '/functions/v1/paystack-init';

var selectedPayment = 'paystack';

// ─── UI helpers ───────────────────────────────────────────────

function selectPayment(method) {
  selectedPayment = method;

  ['paystack', 'whatsapp'].forEach(function(m) {
    var el = document.getElementById('opt-' + m);
    if (!el) return;
    el.classList.toggle('selected', m === method);
    el.querySelector('.payment-option__check').textContent = m === method ? '✓' : '';
  });

  var btn = document.getElementById('submitBtn');
  if (method === 'whatsapp') {
    btn.textContent = 'Order via WhatsApp →';
    btn.classList.add('checkout-submit--gold');
  } else {
    btn.textContent = 'Pay with Paystack →';
    btn.classList.remove('checkout-submit--gold');
  }
}

function resetBtn() {
  var btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = selectedPayment === 'whatsapp' ? 'Order via WhatsApp →' : 'Pay with Paystack →';
}

var _toastTimer;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { t.classList.remove('show'); }, 3500);
}

function generateOrderId() {
  return 'WLK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ─── Order summary ────────────────────────────────────────────

function renderOrderSummary() {
  var cart = WLKCart.getCart();
  var el   = document.getElementById('checkoutOrderItems');
  if (!el) return;

  if (cart.length === 0) {
    el.innerHTML = '<p style="color:#999;font-size:13px">No items. <a href="index.html" style="color:#c9a84c;text-decoration:underline">Go back</a></p>';
    return;
  }

  var html = cart.map(function(item) {
    return '<div class="checkout-order-item">'
      + '<span class="checkout-order-item__name">' + item.name + '</span>'
      + '<span class="checkout-order-item__qty">\xd7' + item.qty + '</span>'
      + '<span class="checkout-order-item__price">' + WLKCart.formatPrice(item.price * item.qty) + '</span>'
      + '</div>';
  }).join('');
  html += '<div class="checkout-order-total"><span>Total</span><span>' + WLKCart.formatPrice(WLKCart.getTotal()) + '</span></div>';
  el.innerHTML = html;
}

// ─── Form ─────────────────────────────────────────────────────

function getFormData() {
  return {
    name:    document.getElementById('custName').value.trim(),
    email:   document.getElementById('custEmail').value.trim(),
    phone:   document.getElementById('custPhone').value.trim(),
    address: document.getElementById('custAddress').value.trim()
  };
}

function validateForm(data) {
  if (!data.name)    { showToast('Please enter your name');             return false; }
  if (!data.email || data.email.indexOf('@') < 1) { showToast('Please enter a valid email'); return false; }
  if (!data.phone)   { showToast('Please enter your phone number');     return false; }
  if (!data.address) { showToast('Please enter your delivery address'); return false; }
  return true;
}

// ─── Main entry ───────────────────────────────────────────────

function handleCheckout() {
  var data = getFormData();
  if (!validateForm(data)) return;

  var btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Processing\u2026';

  if (selectedPayment === 'whatsapp') {
    _doWhatsApp(data);
  } else {
    _doPaystack(data);
  }
}

// ─── WhatsApp flow ────────────────────────────────────────────

function _doWhatsApp(data) {
  var cart    = WLKCart.getCart();
  var total   = WLKCart.getTotal();
  var orderId = generateOrderId();

  saveCustomerDetails(data);
  saveOrderToHistory(orderId, cart, total, data, 'WhatsApp');

  try {
    WLKSupabase.saveOrder({
      order_id: orderId, products: cart, total_price: total,
      payment_method: 'WhatsApp', status: 'pending',
      customer_name: data.name, customer_email: data.email,
      customer_phone: data.phone, delivery_address: data.address
    });
  } catch(e) { console.warn('Supabase:', e); }

  var lines = cart.map(function(i) {
    return '  \u2022 ' + i.name + ' \xd7' + i.qty + ' = ' + WLKCart.formatPrice(i.price * i.qty);
  }).join('\n');

  var msg = '*WLK ORDER \u2014 ' + orderId + '*\n\n'
    + 'Hello! I\'d like to order:\n\n' + lines + '\n\n'
    + '*TOTAL: ' + WLKCart.formatPrice(total) + '*\n\n'
    + 'Name: ' + data.name + '\nEmail: ' + data.email
    + '\nPhone: ' + data.phone + '\nAddress: ' + data.address
    + '\n\nPlease confirm & delivery cost. Thank you \ud83c\udf3f';

  window.open('https://wa.me/' + WLK_WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
  sessionStorage.setItem('wlk_last_order', orderId);
  WLKCart.clearCart();
  window.location.href = 'success.html?method=whatsapp&order=' + orderId;
}

// ─── Paystack flow (via Supabase Edge Function) ───────────────

function _doPaystack(data) {
  var cart        = WLKCart.getCart();
  var total       = WLKCart.getTotal();
  var orderId     = generateOrderId();
  var callbackUrl = window.location.origin + '/delivery.html?order=' + orderId;

  saveCustomerDetails(data);
  saveOrderToHistory(orderId, cart, total, data, 'Paystack');

  // Save pending order so delivery.html can pick it up after redirect
  sessionStorage.setItem('wlk_pending_order', JSON.stringify({
    orderId: orderId, cart: cart, total: total,
    name: data.name, email: data.email,
    phone: data.phone, address: data.address
  }));

  fetch(PAYSTACK_INIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email:       data.email,
      amount:      total,
      orderId:     orderId,
      name:        data.name,
      phone:       data.phone,
      address:     data.address,
      callbackUrl: callbackUrl
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(result) {
    if (result.status && result.authorization_url) {
      window.location.href = result.authorization_url;
    } else {
      showToast(result.error || 'Could not start payment. Please try WhatsApp.');
      resetBtn();
    }
  })
  .catch(function(err) {
    console.error('Paystack edge function error:', err);
    // Fall back to inline popup using the public key
    _doPaystackPopupFallback(data, cart, total, orderId);
  });
}

// ─── Paystack popup fallback (if edge function unreachable) ──

function _doPaystackPopupFallback(data, cart, total, orderId) {
  if (typeof PaystackPop === 'undefined') {
    showToast('Payment unavailable. Please use WhatsApp checkout.');
    resetBtn();
    return;
  }

  var handler = PaystackPop.setup({
    key:      PAYSTACK_PUBLIC_KEY,
    email:    data.email,
    amount:   total * 100,
    currency: 'NGN',
    ref:      orderId,
    label:    data.name,
    metadata: {
      custom_fields: [
        { display_name: 'Customer Name',   variable_name: 'customer_name', value: data.name    },
        { display_name: 'Phone',           variable_name: 'phone',         value: data.phone   },
        { display_name: 'Address',         variable_name: 'address',       value: data.address }
      ]
    },
    callback: function(response) {
      sessionStorage.setItem('wlk_paystack_ref', response.reference);
      WLKCart.clearCart();
      window.location.href = 'delivery.html?order=' + orderId;
    },
    onClose: function() {
      showToast('Payment cancelled.');
      resetBtn();
    }
  });

  handler.openIframe();
}

// ─── Customer memory (no login needed) ───────────────────────

var CUSTOMER_KEY  = 'wlk_customer';
var ORDER_HIST_KEY = 'wlk_order_history';

function saveCustomerDetails(data) {
  try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data)); } catch(e) {}
}

function loadCustomerDetails() {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || null; } catch(e) { return null; }
}

function prefillForm() {
  var saved = loadCustomerDetails();
  if (!saved) return;
  var fields = { custName: 'name', custEmail: 'email', custPhone: 'phone', custAddress: 'address' };
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    if (el && saved[fields[id]]) el.value = saved[fields[id]];
  });
}

function saveOrderToHistory(orderId, cart, total, data, method) {
  try {
    var history = JSON.parse(localStorage.getItem(ORDER_HIST_KEY)) || [];
    history.unshift({
      orderId:  orderId,
      date:     new Date().toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }),
      items:    cart.map(function(i) { return i.name + ' ×' + i.qty; }).join(', '),
      total:    total,
      method:   method
    });
    // Keep last 10 orders
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem(ORDER_HIST_KEY, JSON.stringify(history));
  } catch(e) {}
}

function renderPastOrders() {
  try {
    var history = JSON.parse(localStorage.getItem(ORDER_HIST_KEY)) || [];
    if (history.length === 0) return;
    var section = document.getElementById('pastOrdersSection');
    var list    = document.getElementById('pastOrdersList');
    if (!section || !list) return;

    list.innerHTML = history.map(function(o) {
      return '<div class="past-order-item">'
        + '<div class="past-order-item__header">'
        +   '<span class="past-order-item__id">' + o.orderId + '</span>'
        +   '<span class="past-order-item__date">' + o.date + '</span>'
        + '</div>'
        + '<div class="past-order-item__products">' + o.items + '</div>'
        + '<div class="past-order-item__footer">'
        +   '<span class="past-order-item__total">' + WLKCart.formatPrice(o.total) + '</span>'
        +   '<span class="past-order-item__method">' + o.method + '</span>'
        + '</div>'
        + '</div>';
    }).join('');

    section.style.display = 'block';
  } catch(e) {}
}

// ─── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  if (WLKCart.getCount() === 0) {
    window.location.href = 'index.html';
    return;
  }
  renderOrderSummary();
  prefillForm();
  renderPastOrders();
});
