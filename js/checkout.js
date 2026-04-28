// ===========================
// WLK Checkout Logic
// ===========================

// TODO: Replace with your Paystack public key
const PAYSTACK_PUBLIC_KEY = 'pk_test_3fbe60983209e114473e736ac2b369be025b7bc3';
const WLK_WHATSAPP = '447424985544';

let selectedPayment = 'paystack';

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

function generateOrderId() {
  return 'WLK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function renderOrderSummary() {
  const cart = WLKCart.getCart();
  const el = document.getElementById('checkoutOrderItems');
  if (!el) return;

  if (cart.length === 0) {
    el.innerHTML = '<p style="color:#999;font-size:13px">No items. <a href="index.html" style="color:#c9a84c;text-decoration:underline">Go back</a></p>';
    return;
  }

  const itemsHtml = cart.map(item => `
    <div class="checkout-order-item">
      <span class="checkout-order-item__name">${item.name}</span>
      <span class="checkout-order-item__qty">×${item.qty}</span>
      <span class="checkout-order-item__price">${WLKCart.formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('');

  el.innerHTML = itemsHtml + `
    <div class="checkout-order-total">
      <span>Total</span>
      <span>${WLKCart.formatPrice(WLKCart.getTotal())}</span>
    </div>
  `;
}

function getFormData() {
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  return { name, phone, address };
}

function validateForm(data) {
  if (!data.name) { showToast('Please enter your name'); return false; }
  if (!data.phone) { showToast('Please enter your phone'); return false; }
  if (!data.address) { showToast('Please enter your address'); return false; }
  return true;
}

async function handleCheckout() {
  const data = getFormData();
  if (!validateForm(data)) return;

  if (selectedPayment === 'whatsapp') {
    await handleWhatsAppCheckout(data);
  } else {
    handlePaystackCheckout(data);
  }
}

// ===== WHATSAPP FLOW =====
async function handleWhatsAppCheckout(customerData) {
  const cart = WLKCart.getCart();
  const total = WLKCart.getTotal();
  const orderId = generateOrderId();

  // Save to Supabase (best effort)
  await WLKSupabase.saveOrder({
    order_id: orderId,
    products: cart,
    total_price: total,
    payment_method: 'WhatsApp',
    status: 'pending',
    customer_name: customerData.name,
    customer_phone: customerData.phone,
    delivery_address: customerData.address
  });

  const itemsList = cart.map(i => `  • ${i.name} × ${i.qty} = ${WLKCart.formatPrice(i.price * i.qty)}`).join('\n');

  const msg = `*WLK ORDER — ${orderId}*

Hello! I'd like to place an order:

${itemsList}

*TOTAL: ${WLKCart.formatPrice(total)}*

*Customer Details:*
Name: ${customerData.name}
Phone: ${customerData.phone}
Address: ${customerData.address}

Please confirm availability and delivery cost. Thank you! 🌿`;

  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${WLK_WHATSAPP}?text=${encoded}`, '_blank');

  // Store order ID and redirect
  sessionStorage.setItem('wlk_last_order', orderId);
  WLKCart.clearCart();
  window.location.href = 'success.html?method=whatsapp&order=' + orderId;
}

// ===== PAYSTACK FLOW =====
function handlePaystackCheckout(customerData) {
  const total = WLKCart.getTotal();
  const cart = WLKCart.getCart();
  const orderId = generateOrderId();
  const email = customerData.phone + '@wlk.order'; // fallback email since we don't collect it

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: total * 100, // Paystack uses kobo
    currency: 'NGN',
    ref: orderId,
    metadata: {
      custom_fields: [
        { display_name: 'Customer Name', variable_name: 'customer_name', value: customerData.name },
        { display_name: 'Phone', variable_name: 'phone', value: customerData.phone },
        { display_name: 'Address', variable_name: 'address', value: customerData.address }
      ]
    },
    callback: async function(response) {
      // Payment successful
      await WLKSupabase.saveOrder({
        order_id: orderId,
        products: cart,
        total_price: total,
        payment_method: 'Paystack',
        payment_ref: response.reference,
        status: 'paid',
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        delivery_address: customerData.address
      });

      sessionStorage.setItem('wlk_last_order', orderId);
      sessionStorage.setItem('wlk_last_order_data', JSON.stringify({
        orderId,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        cart,
        total
      }));

      WLKCart.clearCart();
      window.location.href = 'delivery.html?order=' + orderId;
    },
    onClose: function() {
      showToast('Payment cancelled');
    }
  });

  handler.openIframe();
}

// Toast for checkout page
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (WLKCart.getCount() === 0) {
    // If cart is empty, redirect back
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 100);
    return;
  }
  renderOrderSummary();
});
