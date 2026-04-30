// WLK Checkout v4 — Uses Paystack redirect (not popup)
// Popup method blocked by GitHub Pages CSP — redirect is more reliable everywhere

var PAYSTACK_PUBLIC_KEY = 'pk_live_a5f0f030c3f7482268e7d5d6ffbb852774f89b4b';
var WLK_WHATSAPP = '447424985544';
var selectedPayment = 'paystack';

// ─── UI helpers ───────────────────────────────────────────────

function selectPayment(method) {
  selectedPayment = method;
  document.getElementById('optPaystack').classList.toggle('selected', method === 'paystack');
  document.getElementById('optWhatsapp').classList.toggle('selected', method === 'whatsapp');
  document.getElementById('optPaystack').querySelector('.payment-option__check').textContent = method === 'paystack' ? '✓' : '';
  document.getElementById('optWhatsapp').querySelector('.payment-option__check').textContent = method === 'whatsapp' ? '✓' : '';
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
  return 'WLK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2,4).toUpperCase();
}

// ─── Order summary ────────────────────────────────────────────

function renderOrderSummary() {
  var cart = WLKCart.getCart();
  var el = document.getElementById('checkoutOrderItems');
  if (!el) return;
  if (cart.length === 0) {
    el.innerHTML = '<p style="color:#999;font-size:13px">No items. <a href="index.html" style="color:#c9a84c;text-decoration:underline">Go back</a></p>';
    return;
  }
  var html = cart.map(function(item) {
    return '<div class="checkout-order-item">' +
      '<span class="checkout-order-item__name">' + item.name + '</span>' +
      '<span class="checkout-order-item__qty">\xd7' + item.qty + '</span>' +
      '<span class="checkout-order-item__price">' + WLKCart.formatPrice(item.price * item.qty) + '</span>' +
      '</div>';
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
    _doPaystackRedirect(data);
  }
}

// ─── WhatsApp flow ────────────────────────────────────────────

function _doWhatsApp(data) {
  var cart    = WLKCart.getCart();
  var total   = WLKCart.getTotal();
  var orderId = generateOrderId();

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

// ─── Paystack REDIRECT flow ───────────────────────────────────
// Uses Paystack's REST API to initialize a transaction, then redirects
// the user to Paystack's hosted payment page.
// This completely bypasses iframe/popup CSP restrictions.
// After payment, Paystack redirects back to delivery.html?reference=xxx

function _doPaystackRedirect(data) {
  var cart    = WLKCart.getCart();
  var total   = WLKCart.getTotal();
  var orderId = generateOrderId();
  var callbackUrl = window.location.origin + '/delivery.html?order=' + orderId;

  // Save pending order data for delivery.html to pick up after redirect
  sessionStorage.setItem('wlk_pending_order', JSON.stringify({
    orderId: orderId, cart: cart, total: total,
    name: data.name, email: data.email,
    phone: data.phone, address: data.address
  }));

  // Call Paystack Initialize Transaction API
  fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + PAYSTACK_PUBLIC_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email:        data.email,
      amount:       total * 100,
      currency:     'NGN',
      reference:    orderId,
      callback_url: callbackUrl,
      metadata: {
        custom_fields: [
          { display_name: 'Customer Name', variable_name: 'customer_name', value: data.name },
          { display_name: 'Phone',         variable_name: 'phone',         value: data.phone },
          { display_name: 'Address',       variable_name: 'address',       value: data.address }
        ]
      }
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(result) {
    if (result.status && result.data && result.data.authorization_url) {
      // Redirect to Paystack hosted page — no popup, no iframe, no CSP issues
      window.location.href = result.data.authorization_url;
    } else {
      showToast('Could not start payment. Please try WhatsApp instead.');
      resetBtn();
      console.error('Paystack init failed:', result);
    }
  })
  .catch(function(err) {
    // If API call fails (CORS on some setups), fall back to inline popup
    console.warn('Redirect init failed, trying popup fallback:', err);
    _doPaystackPopupFallback(data, cart, total, orderId);
  });
}

// ─── Paystack popup fallback (if redirect API is blocked) ────
// Plain synchronous callback — no async/await

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
        { display_name: 'Customer Name', variable_name: 'customer_name', value: data.name },
        { display_name: 'Phone',         variable_name: 'phone',         value: data.phone },
        { display_name: 'Address',       variable_name: 'address',       value: data.address }
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

// ─── Login banner ─────────────────────────────────────────────

function dismissLoginBanner() {
  var banner = document.getElementById('loginSuggestionBanner');
  if (!banner) return;
  banner.style.transition = 'opacity 0.3s';
  banner.style.opacity = '0';
  setTimeout(function() { banner.style.display = 'none'; }, 300);
}

// ─── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  if (WLKCart.getCount() === 0) {
    window.location.href = 'index.html';
    return;
  }
  renderOrderSummary();
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
