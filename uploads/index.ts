/* ═══════════════════════════════════════════════════════════════
   index.ts — Store / product listing page
   Requires: shared.ts loaded first
   ═══════════════════════════════════════════════════════════════ */
export {};  // isolates this file's scope — prevents duplicate declaration errors

/* ── Cart State ─────────────────────────────────────────────── */
let cart: CartItem[] = loadCart();

function toggleCart(): void {
  document.getElementById('cartDropdown')?.classList.toggle('open');
}

document.addEventListener('click', (e: MouseEvent) => {
  const wrapper = document.querySelector('.cart-wrapper');
  if (wrapper && !wrapper.contains(e.target as Node)) {
    document.getElementById('cartDropdown')?.classList.remove('open');
  }
});

/* ── Cart Actions ───────────────────────────────────────────── */
function addToCart(e: MouseEvent, id: number, name: string, price: number, image: string): void {
  e.stopPropagation();
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty++;
  } else {
    cart.push({ id, name, price, image, qty: 1 });
  }
  saveCart(cart);
  renderCart();
  const btn = document.getElementById('btn-' + id) as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = '✓ ADDED';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = 'ADD TO CART'; btn.classList.remove('added'); }, 1200);
  }
}

function changeQty(id: number, delta: number): void {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart(cart);
  renderCart();
}

function removeFromCart(id: number): void { cart = cart.filter(i => i.id !== id); saveCart(cart); renderCart(); }
function clearCart(): void                { cart = []; saveCart(cart); renderCart(); }

/* ── Render Cart ────────────────────────────────────────────── */
function renderCart(): void {
  const totalQty   = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const countEl = document.getElementById('cartCount') as HTMLElement;
  countEl.textContent   = String(totalQty);
  countEl.style.display = totalQty > 0 ? 'flex' : 'none';

  const footerEl = document.getElementById('cartFooter') as HTMLElement;
  const itemsEl  = document.getElementById('cartItems')  as HTMLElement;

  if (cart.length === 0) {
    itemsEl.innerHTML      = '<p class="cart-empty">— YOUR CART IS EMPTY —</p>';
    footerEl.style.display = 'none';
    return;
  }

  footerEl.style.display = 'block';
  (document.getElementById('cartTotal') as HTMLElement).textContent = 'KES ' + totalPrice.toLocaleString();

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${BASE}/${item.image}" onerror="this.src='https://placehold.co/48x48/1a1a1a/444?text=?'" alt="${item.name}" />
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <p>KES ${(item.price * item.qty).toLocaleString()}</p>
      </div>
      <div class="cart-item-qty">
        <button onclick="changeQty(${item.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="changeQty(${item.id}, +1)">+</button>
      </div>
      <button class="remove-item" onclick="removeFromCart(${item.id})">✕</button>
    </div>
  `).join('');
}

/* ── Checkout ───────────────────────────────────────────────── */
document.getElementById('checkoutBtn')?.addEventListener('click', openCheckout);

function openCheckout(): void {
  if (cart.length === 0) return;
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  (document.getElementById('checkoutItems') as HTMLElement).innerHTML = cart.map(item => `
    <div class="checkout-item">
      <span class="checkout-item-name">${item.name} <span>× ${item.qty}</span></span>
      <span class="checkout-item-price">KES ${(item.price * item.qty).toLocaleString()}</span>
    </div>
  `).join('');

  (document.getElementById('checkoutTotalAmt') as HTMLElement).textContent = 'KES ' + total.toLocaleString();
  (document.getElementById('coName')  as HTMLInputElement).value = '';
  (document.getElementById('coPhone') as HTMLInputElement).value = '';
  (document.getElementById('coError') as HTMLElement).style.display = 'none';
  showStep(1);
  document.getElementById('checkoutOverlay')?.classList.add('open');
}

function submitCheckout(): void {
  const name  = (document.getElementById('coName')  as HTMLInputElement).value.trim();
  const phone = (document.getElementById('coPhone') as HTMLInputElement).value.trim();
  const errEl = document.getElementById('coError') as HTMLElement;
  errEl.style.display = 'none';

  if (!name)            { errEl.textContent = 'Please enter your full name.';       errEl.style.display = 'block'; return; }
  if (phone.length < 9) { errEl.textContent = 'Please enter a valid phone number.'; errEl.style.display = 'block'; return; }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  showStep(2);

  const payload: CheckoutPayload = { name, phone, items: cart, total };

  fetch(CHECKOUT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res): Promise<CheckoutResponse> => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((data: CheckoutResponse) => {
      if (data.order_id) {
        const msg = 'Order #' + data.order_id + (data.message ? ' · ' + data.message : '');
        (document.getElementById('coOrderId') as HTMLElement).textContent = msg;
        showStep(3);
        cart = []; saveCart(cart); renderCart();
      } else {
        showStep(1);
        errEl.textContent   = data.error ?? 'Something went wrong. Please try again.';
        errEl.style.display = 'block';
      }
    })
    .catch(() => {
      showStep(1);
      errEl.textContent   = 'Could not connect to server. Please try again.';
      errEl.style.display = 'block';
    });
}

/* ── Search / Filter ────────────────────────────────────────── */
let allProducts: Product[] = [];

function filterProducts(): void {
  const q       = (document.getElementById('searchInput') as HTMLInputElement).value.trim().toLowerCase();
  const countEl = document.getElementById('resultsCount') as HTMLElement;
  const grid    = document.getElementById('productsGrid')  as HTMLElement;
  const list    = q
    ? allProducts.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    : allProducts;

  countEl.style.display = q ? 'block' : 'none';
  if (q) countEl.innerHTML = `<span>${list.length}</span> result${list.length !== 1 ? 's' : ''} for "${q}"`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="no-results"><strong>NO RESULTS</strong> Nothing matched "${q}". Try a different search.</div>`;
    return;
  }

  grid.innerHTML = '';
  list.forEach(p => {
    const card     = document.createElement('div');
    card.className = 'product-card';
    card.onclick   = () => { window.location.href = BASE + '/product.html?id=' + p.id; };
    card.innerHTML = `
      <img src="${BASE}/${p.image}" alt="${p.name}"
           onerror="this.src='https://placehold.co/230x210/111/333?text=DRIP'" />
      <div class="card-body">
        <h3>${highlight(p.name, q)}</h3>
        <p class="desc">${highlight(p.description, q)}</p>
        <p class="price">KES ${parseFloat(String(p.price)).toLocaleString()}</p>
        <button class="btn-cart" id="btn-${p.id}"
          onclick="addToCart(event,${p.id},'${esc(p.name)}',${p.price},'${esc(p.image)}')">
          ADD TO CART
        </button>
      </div>`;
    grid.appendChild(card);
  });
}

/* ── Skeleton Loader ────────────────────────────────────────── */
function showSkeleton(): void {
  (document.getElementById('productsGrid') as HTMLElement).innerHTML = Array.from({ length: 8 }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-desc-1"></div>
        <div class="skeleton skeleton-desc-2"></div>
        <div class="skeleton skeleton-price"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    </div>`).join('');
}

/* ── Load Products ──────────────────────────────────────────── */
function loadProducts(): void {
  showSkeleton();
  fetch(API)
    .then((res): Promise<Product[]> => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((data: Product[]) => {
      allProducts = Array.isArray(data) ? data : [];
      filterProducts();
    })
    .catch((err: Error) => {
      (document.getElementById('productsGrid') as HTMLElement).innerHTML =
        `<p style="color:var(--neon-pink);font-family:var(--font-mono);font-size:0.82rem;font-weight:700;letter-spacing:1px;grid-column:1/-1;">
           ⚠ FAILED TO LOAD PRODUCTS — ${err.message}
         </p>`;
    });
}

/* ── Init ───────────────────────────────────────────────────── */
renderCart();
loadProducts();

/* ── Expose functions to window for HTML onclick attributes ─── */
(window as any).toggleCart     = toggleCart;
(window as any).toggleTheme    = toggleTheme;
(window as any).addToCart      = addToCart;
(window as any).changeQty      = changeQty;
(window as any).removeFromCart = removeFromCart;
(window as any).clearCart      = clearCart;
(window as any).openCheckout   = openCheckout;
(window as any).closeCheckout  = closeCheckout;
(window as any).submitCheckout = submitCheckout;
(window as any).filterProducts = filterProducts;