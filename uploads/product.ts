/* ═══════════════════════════════════════════════════════════════
   product.ts — Product detail page
   Requires: shared.ts loaded first
   ═══════════════════════════════════════════════════════════════ */

/* ── Page State ─────────────────────────────────────────────── */
let cart: CartItem[]          = loadCart();
let qty: number               = 1;
let currentProduct: CartItem | null = null;

/* ── Cart Toggle ────────────────────────────────────────────── */
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
function addToCart(): void {
  if (!currentProduct) return;
  const item = cart.find(i => i.id === currentProduct!.id);
  if (item) {
    item.qty += qty;
  } else {
    cart.push({ ...currentProduct, qty });
  }
  saveCart(cart);
  renderCart();
  showToast('✓ ' + qty + '× ' + currentProduct.name + ' ADDED');
  const btn = document.getElementById('addBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.textContent = '✓ ADDED TO CART';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = 'ADD TO CART'; btn.classList.remove('added'); }, 1500);
  }
}

function changeQty(delta: number): void {
  qty = Math.max(1, qty + delta);
  const el = document.getElementById('qtyDisplay');
  if (el) el.textContent = String(qty);
}

function changeCartQty(id: number, delta: number): void {
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
        <button onclick="changeCartQty(${item.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="changeCartQty(${item.id}, +1)">+</button>
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

/* ── Toast ──────────────────────────────────────────────────── */
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string): void {
  const t = document.getElementById('toast') as HTMLElement;
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── Skeleton Loader ────────────────────────────────────────── */
function showSkeleton(): void {
  (document.getElementById('productContent') as HTMLElement).innerHTML = `
    <div class="skeleton-detail">
      <div class="skeleton skeleton-detail-img"></div>
      <div class="skeleton-detail-info">
        <div class="skeleton skeleton-tag"></div>
        <div class="skeleton skeleton-name"></div>
        <div class="skeleton skeleton-price-lg"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton skeleton-para-1"></div>
        <div class="skeleton skeleton-para-2"></div>
        <div class="skeleton skeleton-para-3"></div>
        <div class="skeleton-badges">
          <div class="skeleton skeleton-badge"></div>
          <div class="skeleton skeleton-badge"></div>
          <div class="skeleton skeleton-badge"></div>
        </div>
        <div class="skeleton-line"></div>
        <div class="skeleton skeleton-qty"></div>
        <div class="skeleton skeleton-cta-1"></div>
        <div class="skeleton skeleton-cta-2"></div>
      </div>
    </div>`;
}

/* ── Load Product ───────────────────────────────────────────── */
const productId = new URLSearchParams(window.location.search).get('id');

if (!productId) {
  (document.getElementById('productContent') as HTMLElement).innerHTML =
    `<p class="state-msg error">NO PRODUCT ID PROVIDED.<br>
     <a href="${BASE}/store.html" style="color:var(--neon-green);font-size:0.8rem;">← BACK TO STORE</a></p>`;
} else {
  showSkeleton();
  fetch(API + '?id=' + productId)
    .then((res): Promise<Product> => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then((p: Product) => {
      if ((p as Product & { error?: string }).error) throw new Error((p as Product & { error?: string }).error);
      currentProduct = {
        id:    parseInt(String(p.id)),
        name:  p.name,
        price: parseFloat(String(p.price)),
        image: p.image,
        qty:   1,
      };
      document.title = p.name + ' — Drip Shop';
      (document.getElementById('productContent') as HTMLElement).innerHTML = `
        <div class="product-detail">
          <div class="product-image-wrap">
            <img src="${BASE}/${p.image}" alt="${p.name}"
                 onerror="this.src='https://placehold.co/600x600/111/333?text=DRIP'" />
          </div>
          <div class="product-info">
            <p class="product-tag">// DRIP SHOP EXCLUSIVE</p>
            <h1 class="product-name">${p.name}</h1>
            <p class="product-price">KES ${parseFloat(String(p.price)).toLocaleString()}</p>
            <div class="product-divider"></div>
            <p class="product-description">${p.description}</p>
            <div class="meta-row">
              <span class="meta-badge green">IN STOCK</span>
              <span class="meta-badge">FREE DELIVERY</span>
              <span class="meta-badge">AUTHENTIC</span>
            </div>
            <div class="product-divider"></div>
            <div>
              <p class="qty-label">Quantity</p>
              <div class="qty-selector">
                <button onclick="changeQty(-1)">−</button>
                <span id="qtyDisplay">1</span>
                <button onclick="changeQty(+1)">+</button>
              </div>
            </div>
            <div class="cta-group">
              <button class="btn-add-detail" id="addBtn" onclick="addToCart()">ADD TO CART</button>
              <button class="btn-wishlist">♡ ADD TO WISHLIST</button>
            </div>
          </div>
        </div>`;
    })
    .catch(() => {
      (document.getElementById('productContent') as HTMLElement).innerHTML =
        `<p class="state-msg error">PRODUCT NOT FOUND.<br>
         <a href="${BASE}/store.html" style="color:var(--neon-green);font-size:0.8rem;margin-top:12px;display:inline-block;">← BACK TO STORE</a></p>`;
    });
}

/* ── Init ───────────────────────────────────────────────────── */
renderCart();