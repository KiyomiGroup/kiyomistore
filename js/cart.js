// ===========================
// WLK Cart System
// localStorage for guests
// ===========================

const WLKCart = (() => {
  const CART_KEY = 'wlk_cart';

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateUI();
  }

  function addItem(id, name, price, img) {
    const cart = getCart();
    const existing = cart.find(i => i.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id, name, price, img, qty: 1 });
    }
    saveCart(cart);
    return cart;
  }

  function removeItem(id) {
    const cart = getCart().filter(i => i.id !== id);
    saveCart(cart);
  }

  function updateQty(id, qty) {
    if (qty < 1) { removeItem(id); return; }
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if (item) item.qty = qty;
    saveCart(cart);
  }

  function getTotal() {
    return getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  function getCount() {
    return getCart().reduce((sum, i) => sum + i.qty, 0);
  }

  function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateUI();
  }

  function formatPrice(n) {
    return '₦' + n.toLocaleString('en-NG');
  }

  function updateUI() {
    const cart = getCart();
    const count = getCount();
    const total = getTotal();

    // Update badges
    const badge = document.getElementById('headerCartBadge');
    if (badge) badge.textContent = count;

    // Cart bar
    const cartBar = document.getElementById('cartBar');
    const cartCount = document.getElementById('cartCount');
    if (cartBar && cartCount) {
      cartCount.textContent = count + (count === 1 ? ' item' : ' items');
      if (count > 0) {
        cartBar.classList.add('visible');
      } else {
        cartBar.classList.remove('visible');
      }
    }

    // Total
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = formatPrice(total);

    // Cart items
    const itemsEl = document.getElementById('cartItems');
    if (!itemsEl) return;

    if (cart.length === 0) {
      itemsEl.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
      return;
    }

    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.img}" alt="${item.name}" class="cart-item__img" onerror="this.style.background='#e8e4dc'">
        <div class="cart-item__info">
          <div class="cart-item__name">${item.name}</div>
          <div class="cart-item__price">${formatPrice(item.price * item.qty)}</div>
          <div class="cart-item__controls">
            <button class="cart-item__qty-btn" onclick="WLKCart.updateQty('${item.id}', ${item.qty - 1})">−</button>
            <span class="cart-item__qty">${item.qty}</span>
            <button class="cart-item__qty-btn" onclick="WLKCart.updateQty('${item.id}', ${item.qty + 1})">+</button>
            <button class="cart-item__remove" onclick="WLKCart.removeItem('${item.id}')">Remove</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Init
  document.addEventListener('DOMContentLoaded', updateUI);

  return { addItem, removeItem, updateQty, getCart, getTotal, getCount, clearCart, formatPrice, updateUI };
})();
