# WLK — Weight Loss by Kiyomi
## Sprint 1 — E-Commerce System

---

## 🚀 Setup (5 Steps)

### 1. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run contents of `supabase-schema.sql`
3. Copy your **Project URL** and **anon key** from Settings → API

### 2. Configure Supabase
In `js/supabase.js`, replace:
```js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 3. Configure Paystack
In `js/checkout.js`, replace:
```js
const PAYSTACK_PUBLIC_KEY = 'pk_test_YOUR_PAYSTACK_KEY_HERE';
```
Get your key from [dashboard.paystack.com](https://dashboard.paystack.com)

### 4. Update WhatsApp Number
The WhatsApp number `447424985544` is used in:
- `js/checkout.js` → `WLK_WHATSAPP`
- `js/delivery.js` → `WLK_WHATSAPP`
- `success.html` → the WhatsApp link

### 5. Deploy to GitHub Pages
```bash
git init
git add .
git commit -m "WLK Sprint 1"
git remote add origin https://github.com/YOUR_USERNAME/wlk-store.git
git push -u origin main
```
Then in GitHub repo: **Settings → Pages → Deploy from main branch**

---

## 📁 File Structure

```
wlk/
├── index.html          # Homepage + product listing
├── checkout.html       # Single-page checkout
├── delivery.html       # Delivery zone selection (post-Paystack)
├── success.html        # Order confirmation
├── css/
│   └── style.css       # All styles (mobile-first)
├── js/
│   ├── cart.js         # Cart logic (localStorage)
│   ├── app.js          # UI interactions
│   ├── supabase.js     # Supabase API calls
│   ├── checkout.js     # Paystack + WhatsApp checkout
│   └── delivery.js     # Zone selection + WhatsApp dispatch
├── images/             # Product photos
└── supabase-schema.sql # Run in Supabase SQL editor
```

---

## 🛒 User Flows

### Flow A — Paystack
1. Browse products on homepage
2. Add to cart → View cart drawer
3. Proceed to checkout
4. Enter name, phone, address
5. Select Paystack → Pay
6. On success → Delivery zone selection
7. Select zone → Redirect to WhatsApp with full order

### Flow B — WhatsApp
1. Browse + add to cart
2. Checkout → Select WhatsApp
3. System generates order → Opens WhatsApp with prefilled message
4. Order saved in Supabase

---

## 🗄️ Supabase Tables

| Table | Purpose |
|-------|---------|
| `orders` | All orders (guest + logged in) |
| `users` | Optional registered users |
| `cart` | Synced cart for logged-in users |

---

## 📦 Product Images Used
- `hero-main-1.jpg` — Brand label design
- `product-lite-1.jpg` — 350ml bottle
- `product-core-1.jpg` — 500ml bottle
- `product-bundle-1.jpg` — Bundle (2 bottles + card)
- `product-bundle-2.jpg` — Bundle with capsules
- `product-capsule-1.jpg` — Detox capsule container

---

## ⚡ Sprint 2 Notes (DO NOT BUILD YET)
- Premium UI redesign
- Editorial layout system
- Animation upgrade
- Advanced conversion optimization
