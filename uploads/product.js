    const API          = 'https://kevinmk.infinityfree.me/products.php';
    const BASE         = 'https://kevinmk.infinityfree.me';
    const CHECKOUT_API = 'https://kevinmk.infinityfree.me/checkout.php';
    const CART_KEY     = 'drip_cart';

    /* ── Theme ─────────────────────────────────────────────── */
    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      document.querySelector('#themeToggle .toggle-icon').textContent  = t === 'light' ? '🌙' : '☀️';
      document.querySelector('#themeToggle .toggle-label').textContent = t === 'light' ? 'DARK' : 'LIGHT';
    }
    applyTheme(localStorage.getItem('drip-theme') || 'dark');

    function toggleTheme() {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('drip-theme', next);
      applyTheme(next);
    }

    /* ── Cart ──────────────────────────────────────────────── */
    function loadCart() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
    function saveCart() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
    let cart = loadCart();
    let qty  = 1;
    let currentProduct = null;

    function toggleCart() { document.getElementById('cartDropdown').classList.toggle('open'); }

    document.addEventListener('click', e => {
      if (!document.querySelector('.cart-wrapper').contains(e.target))
        document.getElementById('cartDropdown').classList.remove('open');
    });

    function addToCart() {
      if (!currentProduct) return;
      const item = cart.find(i => i.id === currentProduct.id);
      if (item) item.qty += qty;
      else cart.push({ ...currentProduct, qty });
      saveCart();
      renderCart();
      showToast('✓ ' + qty + '× ' + currentProduct.name + ' ADDED');
      const btn = document.getElementById('addBtn');
      if (btn) {
        btn.textContent = '✓ ADDED TO CART';
        btn.classList.add('added');
        setTimeout(() => { btn.textContent = 'ADD TO CART'; btn.classList.remove('added'); }, 1500);
      }
    }

    function changeQty(delta) {
      qty = Math.max(1, qty + delta);
      const el = document.getElementById('qtyDisplay');
      if (el) el.textContent = qty;
    }

    function changeCartQty(id, delta) {
      const item = cart.find(i => i.id === id);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
      saveCart();
      renderCart();
    }

    function removeFromCart(id) { cart = cart.filter(i => i.id !== id); saveCart(); renderCart(); }
    function clearCart()        { cart = []; saveCart(); renderCart(); }

    function renderCart() {
      const totalQty   = cart.reduce((s, i) => s + i.qty, 0);
      const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);
      const countEl    = document.getElementById('cartCount');
      countEl.textContent   = totalQty;
      countEl.style.display = totalQty > 0 ? 'flex' : 'none';

      const footerEl = document.getElementById('cartFooter');
      const itemsEl  = document.getElementById('cartItems');

      if (cart.length === 0) {
        itemsEl.innerHTML      = '<p class="cart-empty">— YOUR CART IS EMPTY —</p>';
        footerEl.style.display = 'none';
        return;
      }

      footerEl.style.display = 'block';
      document.getElementById('cartTotal').textContent = 'KES ' + totalPrice.toLocaleString();
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

    /* ── Toast ─────────────────────────────────────────────── */
    let toastTimer;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
    }

    /* ── Checkout ──────────────────────────────────────────── */
    document.getElementById('checkoutBtn').addEventListener('click', openCheckout);

    function openCheckout() {
      if (cart.length === 0) return;
      const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
      document.getElementById('checkoutItems').innerHTML = cart.map(item => `
        <div class="checkout-item">
          <span class="checkout-item-name">${item.name} <span>× ${item.qty}</span></span>
          <span class="checkout-item-price">KES ${(item.price * item.qty).toLocaleString()}</span>
        </div>
      `).join('');
      document.getElementById('checkoutTotalAmt').textContent = 'KES ' + total.toLocaleString();
      document.getElementById('coName').value  = '';
      document.getElementById('coPhone').value = '';
      document.getElementById('coError').style.display = 'none';
      showStep(1);
      document.getElementById('checkoutOverlay').classList.add('open');
    }

    function closeCheckout() { document.getElementById('checkoutOverlay').classList.remove('open'); }

    document.getElementById('checkoutOverlay').addEventListener('click', function(e) {
      if (e.target === this) closeCheckout();
    });

    function showStep(n) {
      document.getElementById('coStep1').style.display = n === 1 ? 'block' : 'none';
      document.getElementById('coStep2').style.display = n === 2 ? 'block' : 'none';
      document.getElementById('coStep3').style.display = n === 3 ? 'block' : 'none';
    }

    function submitCheckout() {
      const name  = document.getElementById('coName').value.trim();
      const phone = document.getElementById('coPhone').value.trim();
      const errEl = document.getElementById('coError');
      errEl.style.display = 'none';

      if (!name)            { errEl.textContent = 'Please enter your full name.';      errEl.style.display = 'block'; return; }
      if (phone.length < 9) { errEl.textContent = 'Please enter a valid phone number.'; errEl.style.display = 'block'; return; }

      const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
      showStep(2);

      fetch(CHECKOUT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, items: cart, total })
      })
      .then(res => res.json())
      .then(data => {
        if (data.order_id) {
          document.getElementById('coOrderId').textContent = 'Order #' + data.order_id + (data.message ? ' · ' + data.message : '');
          showStep(3);
          cart = []; saveCart(); renderCart();
        } else {
          showStep(1);
          errEl.textContent = data.error || 'Something went wrong. Please try again.';
          errEl.style.display = 'block';
        }
      })
      .catch(() => {
        showStep(1);
        errEl.textContent = 'Could not connect to server. Please try again.';
        errEl.style.display = 'block';
      });
    }

    /* ── Skeleton loader ───────────────────────────────────── */
    function showSkeleton() {
      document.getElementById('productContent').innerHTML = `
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

    /* ── Load product ──────────────────────────────────────── */
    const productId = new URLSearchParams(window.location.search).get('id');

    if (!productId) {
      document.getElementById('productContent').innerHTML =
        `<p class="state-msg error">NO PRODUCT ID PROVIDED.<br>
         <a href="${BASE}/store.html" style="color:var(--neon-green);font-size:0.8rem;">← BACK TO STORE</a></p>`;
    } else {
      showSkeleton();
      fetch(API + '?id=' + productId)
        .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(p => {
          if (p.error) throw new Error(p.error);
          currentProduct = { id: parseInt(p.id), name: p.name, price: parseFloat(p.price), image: p.image };
          document.title = p.name + ' — Drip Shop';
          document.getElementById('productContent').innerHTML = `
            <div class="product-detail">
              <div class="product-image-wrap">
                <img src="${BASE}/${p.image}" alt="${p.name}"
                     onerror="this.src='https://placehold.co/600x600/111/333?text=DRIP'" />
              </div>
              <div class="product-info">
                <p class="product-tag">// DRIP SHOP EXCLUSIVE</p>
                <h1 class="product-name">${p.name}</h1>
                <p class="product-price">KES ${parseFloat(p.price).toLocaleString()}</p>
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
          document.getElementById('productContent').innerHTML =
            `<p class="state-msg error">PRODUCT NOT FOUND.<br>
             <a href="${BASE}/store.html" style="color:var(--neon-green);font-size:0.8rem;margin-top:12px;display:inline-block;">← BACK TO STORE</a></p>`;
        });
    }

    /* ── Init ──────────────────────────────────────────────── */
    renderCart();
