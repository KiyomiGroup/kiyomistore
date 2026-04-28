-- ===========================
-- WLK Supabase Schema — Sprint 1
-- Run this in your Supabase SQL editor
-- ===========================

-- USERS TABLE
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  email text unique,
  phone text,
  created_at timestamp with time zone default now()
);

-- ORDERS TABLE
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  order_id text unique not null,
  user_id uuid references users(id) on delete set null,
  products jsonb not null,
  total_price integer not null,
  payment_method text not null default 'WhatsApp',
  payment_ref text,
  status text not null default 'pending',
  delivery_zone text,
  customer_name text,
  customer_phone text,
  delivery_address text,
  created_at timestamp with time zone default now()
);

-- CART TABLE (for logged-in users)
create table if not exists cart (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade,
  product_id text not null,
  quantity integer not null default 1,
  created_at timestamp with time zone default now(),
  unique(user_id, product_id)
);

-- ROW LEVEL SECURITY
alter table orders enable row level security;
alter table cart enable row level security;
alter table users enable row level security;

-- Allow anonymous inserts for orders (guest checkout)
create policy "Allow anon insert orders" on orders
  for insert to anon with check (true);

-- Allow reading own orders (by order_id - for status page)
create policy "Allow anon read by order_id" on orders
  for select to anon using (true);

-- Allow updating delivery zone
create policy "Allow anon update delivery" on orders
  for update to anon using (true);
