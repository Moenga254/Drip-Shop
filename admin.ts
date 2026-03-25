/* ═══════════════════════════════════════════════════════════════
   admin.ts — Admin panel (add / edit / delete products)
   Requires: shared.ts loaded first
   ═══════════════════════════════════════════════════════════════ */

/* ── Status Banner ──────────────────────────────────────────── */
function showStatus(message: string, type: 'success' | 'error' = 'success'): void {
  const el = document.getElementById('status') as HTMLElement;
  el.textContent   = message;
  el.className     = type;
  el.style.display = 'block';
  setTimeout(() => { el.className = ''; el.style.display = 'none'; }, 4000);
}

/* ── Image Preview ──────────────────────────────────────────── */
(document.getElementById('imageFile') as HTMLInputElement).addEventListener('change', function (this: HTMLInputElement) {
  const file = this.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    (document.getElementById('imagePreview')     as HTMLImageElement).src          = e.target?.result as string;
    (document.getElementById('imagePreviewWrap') as HTMLElement).style.display     = 'block';
    (document.getElementById('uploadArea')       as HTMLElement).style.display     = 'none';
  };
  reader.readAsDataURL(file);
});

(document.getElementById('removeImage') as HTMLButtonElement).addEventListener('click', () => {
  (document.getElementById('imageFile')        as HTMLInputElement).value          = '';
  (document.getElementById('imagePreview')     as HTMLImageElement).src            = '';
  (document.getElementById('imagePreviewWrap') as HTMLElement).style.display       = 'none';
  (document.getElementById('uploadArea')       as HTMLElement).style.display       = 'block';
});

/* ── Search & Filter ────────────────────────────────────────── */
let allProducts: Product[] = [];

function filterTable(): void {
  const query   = (document.getElementById('searchInput') as HTMLInputElement).value.trim().toLowerCase();
  const countEl = document.getElementById('tableCount')      as HTMLElement;
  const tbody   = document.getElementById('productTableBody') as HTMLElement;

  const filtered = query
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        String(p.price).includes(query))
    : allProducts;

  countEl.innerHTML = query
    ? `<span>${filtered.length}</span> / ${allProducts.length} products`
    : `<span>${allProducts.length}</span> product${allProducts.length !== 1 ? 's' : ''}`;

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;font-family:var(--font-mono);font-size:0.8rem;letter-spacing:2px;color:var(--text-muted);">NO RESULTS FOR "${query.toUpperCase()}"</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${BASE}/${p.image}" alt="${p.name}"
           onerror="this.src='https://placehold.co/54x54/1a1a1a/444?text=?'" /></td>
      <td class="td-name">${highlight(p.name, query)}</td>
      <td class="td-desc" title="${p.description}">${highlight(p.description, query)}</td>
      <td class="td-price">KES ${parseFloat(String(p.price)).toLocaleString()}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit"   onclick="openEditModal(${p.id},'${esc(p.name)}','${esc(p.description)}',${p.price},'${esc(p.image)}')">EDIT</button>
          <button class="btn-delete" onclick="deleteProduct(${p.id})">DELETE</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ── Load Products ──────────────────────────────────────────── */
function loadProducts(): void {
  fetch(API)
    .then((res): Promise<Product[]> => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then((data: Product[]) => {
      allProducts = Array.isArray(data) ? data : [];
      filterTable();
    })
    .catch((err: Error) => showStatus('Failed to load products: ' + err.message, 'error'));
}

/* ── Add Product ────────────────────────────────────────────── */
(document.getElementById('addForm') as HTMLFormElement).addEventListener('submit', function (this: HTMLFormElement, e: Event) {
  e.preventDefault();
  const fileInput = document.getElementById('imageFile') as HTMLInputElement;
  if (!fileInput.files?.[0]) { showStatus('Please select a product image.', 'error'); return; }

  const btn = this.querySelector('.btn-primary') as HTMLButtonElement;
  btn.textContent = 'UPLOADING...';
  btn.disabled    = true;

  const formData = new FormData();
  formData.append('name',        (document.getElementById('name')        as HTMLInputElement).value.trim());
  formData.append('description', (document.getElementById('description') as HTMLTextAreaElement).value.trim());
  formData.append('price',       (document.getElementById('price')       as HTMLInputElement).value);
  formData.append('image',       fileInput.files[0]);

  fetch(API, { method: 'POST', body: formData })
    .then((res): Promise<{ error?: string; message?: string }> => res.json())
    .then(data => {
      btn.textContent = 'ADD PRODUCT';
      btn.disabled    = false;
      if (data.error) { showStatus(data.error, 'error'); return; }
      showStatus('✓ Product added successfully!', 'success');
      this.reset();
      (document.getElementById('imagePreviewWrap') as HTMLElement).style.display = 'none';
      (document.getElementById('uploadArea')       as HTMLElement).style.display = 'block';
      (document.getElementById('searchInput')      as HTMLInputElement).value    = '';
      loadProducts();
    })
    .catch((err: Error) => {
      btn.textContent = 'ADD PRODUCT';
      btn.disabled    = false;
      showStatus('Upload failed: ' + err.message, 'error');
    });
});

/* ── Edit Modal ─────────────────────────────────────────────── */
function openEditModal(id: number, name: string, description: string, price: number, image: string): void {
  (document.getElementById('editId')          as HTMLInputElement).value     = String(id);
  (document.getElementById('editName')        as HTMLInputElement).value     = name;
  (document.getElementById('editDescription') as HTMLTextAreaElement).value  = description;
  (document.getElementById('editPrice')       as HTMLInputElement).value     = String(price);
  (document.getElementById('editImage')       as HTMLInputElement).value     = image;
  document.getElementById('modalOverlay')?.classList.add('open');
}

function closeModal(): void {
  document.getElementById('modalOverlay')?.classList.remove('open');
  (document.getElementById('editForm') as HTMLFormElement).reset();
}

document.getElementById('modalOverlay')?.addEventListener('click', function (this: HTMLElement, e: Event) {
  if (e.target === this) closeModal();
});

(document.getElementById('editForm') as HTMLFormElement).addEventListener('submit', function (e: Event) {
  e.preventDefault();
  const id = (document.getElementById('editId') as HTMLInputElement).value;
  const payload = {
    name:        (document.getElementById('editName')        as HTMLInputElement).value.trim(),
    description: (document.getElementById('editDescription') as HTMLTextAreaElement).value.trim(),
    price:       parseFloat((document.getElementById('editPrice') as HTMLInputElement).value),
    image:       (document.getElementById('editImage')       as HTMLInputElement).value.trim(),
  };
  fetch(API + '?id=' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res): Promise<{ error?: string; message?: string }> => res.json())
    .then(data => {
      if (data.error) { showStatus(data.error, 'error'); return; }
      showStatus('✓ ' + data.message, 'success');
      closeModal();
      loadProducts();
    })
    .catch(() => showStatus('Failed to update product.', 'error'));
});

/* ── Delete Product ─────────────────────────────────────────── */
function deleteProduct(id: number): void {
  if (!confirm('Delete this product?')) return;
  fetch(API + '?id=' + id, { method: 'DELETE' })
    .then((res): Promise<{ error?: string; message?: string }> => res.json())
    .then(data => {
      if (data.error) { showStatus(data.error, 'error'); return; }
      showStatus('✓ ' + data.message, 'success');
      loadProducts();
    })
    .catch(() => showStatus('Failed to delete product.', 'error'));
}

/* ── Init ───────────────────────────────────────────────────── */
loadProducts();
