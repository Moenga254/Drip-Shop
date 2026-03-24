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

    function toggleCart() { document.getElementById('cartDropdown').classList.toggle('open'); }

    document.addEventListener('click', e => {
      if (!document.querySelector('.cart-wrapper').contains(e.target))
        document.getElementById('cartDropdown').classList.remove('open');
    });

    function addToCart(e, id, name, price, image) {
      e.stopPropagation();
      const item = cart.find(i => i.id === id);
      if (item) item.qty++;
      else cart.push({ id, name, price, image, qty: 1 });
      saveCart();
      renderCart();
      const btn = document.getElementById('btn-' + id);
      if (btn) {
        btn.textContent = '✓ ADDED';
        btn.classList.add('added');
        setTimeout(() => { btn.textContent = 'ADD TO CART'; btn.classList.remove('added'); }, 1200);
      }
    }

    function changeQty(id, delta) {
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
            <button onclick="changeQty(${item.id}, -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeQty(${item.id}, +1)">+</button>
          </div>
          <button class="remove-item" onclick="removeFromCart(${item.id})">✕</button>
        </div>
      `).join('');
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

    function closeCheckout() {
      document.getElementById('checkoutOverlay').classList.remove('open');
    }

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

      if (!name)               { errEl.textContent = 'Please enter your full name.';     errEl.style.display = 'block'; return; }
      if (phone.length < 9)    { errEl.textContent = 'Please enter a valid phone number.'; errEl.style.display = 'block'; return; }

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

    /* ── Search / filter ───────────────────────────────────── */
    let allProducts = [];

    function esc(str) { return String(str).replace(/'/g, "\\'"); }

    function highlight(text, q) {
      if (!q) return text;
      return text.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
        '<mark class="highlight">$1</mark>');
    }

    function filterProducts() {
      const q       = document.getElementById('searchInput').value.trim().toLowerCase();
      const countEl = document.getElementById('resultsCount');
      const grid    = document.getElementById('productsGrid');
      const list    = q ? allProducts.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) : allProducts;

      countEl.style.display = q ? 'block' : 'none';
      if (q) countEl.innerHTML = `<span>${list.length}</span> result${list.length !== 1 ? 's' : ''} for "${q}"`;

      if (list.length === 0) {
        grid.innerHTML = `<div class="no-results"><strong>NO RESULTS</strong>Nothing matched "${q}". Try a different search.</div>`;
        return;
      }

      grid.innerHTML = '';
      list.forEach(p => {
        const card     = document.createElement('div');
        card.className = 'product-card';
        card.onclick   = () => window.location.href = BASE + '/product.html?id=' + p.id;
        card.innerHTML = `
          <img src="${BASE}/${p.image}" alt="${p.name}"
               onerror="this.src='https://placehold.co/230x210/111/333?text=DRIP'" />
          <div class="card-body">
            <h3>${highlight(p.name, q)}</h3>
            <p class="desc">${highlight(p.description, q)}</p>
            <p class="price">KES ${parseFloat(p.price).toLocaleString()}</p>
            <button class="btn-cart" id="btn-${p.id}"
              onclick="addToCart(event,${p.id},'${esc(p.name)}',${p.price},'${esc(p.image)}')">
              ADD TO CART
            </button>
          </div>`;
        grid.appendChild(card);
      });
    }

    /* ── Skeleton loader ───────────────────────────────────── */
    function showSkeleton() {
      document.getElementById('productsGrid').innerHTML = Array.from({ length: 8 }).map(() => `
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

    /* ── Load products ─────────────────────────────────────── */
    function loadProducts() {
      showSkeleton();
      fetch(API)
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(data => {
          allProducts = Array.isArray(data) ? data : [];
          filterProducts();
        })
        .catch(err => {
          document.getElementById('productsGrid').innerHTML =
            `<p style="color:var(--neon-pink);font-family:var(--font-mono);font-size:0.82rem;font-weight:700;letter-spacing:1px;grid-column:1/-1;">
               ⚠ FAILED TO LOAD PRODUCTS — ${err.message}
             </p>`;
        });
    }

    /* ── Init ──────────────────────────────────────────────── */
    renderCart();
    loadProducts();
