// ===========================
// WLK App — Main Logic
// ===========================

function addToCart(id, name, price, img) {
  WLKCart.addItem(id, name, price, img);
  showToast('Added to cart ✓');
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function goToCheckout() {
  if (WLKCart.getCount() === 0) {
    showToast('Your cart is empty');
    return;
  }
  closeCart();
  window.location.href = 'checkout.html';
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
