/* ═══════════════════════════════════════════════════════════════
   shared.ts — Load this FIRST on every page via:
   <script src="shared.js"></script>
   ═══════════════════════════════════════════════════════════════ */

/* ── Shared Constants ───────────────────────────────────────── */
const API          = 'https://kevinmk.infinityfree.me/products.php';
const BASE         = 'https://kevinmk.infinityfree.me';
const CHECKOUT_API = 'https://kevinmk.infinityfree.me/checkout.php';
const CART_KEY     = 'drip_cart';

/* ── Shared Interfaces ──────────────────────────────────────── */
interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  qty: number;
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: number | string;
  image: string;
}

interface CheckoutPayload {
  name: string;
  phone: string;
  items: CartItem[];
  total: number;
}

interface CheckoutResponse {
  order_id?: number | string;
  message?: string;
  error?: string;
}

/* ── Shared Cart Helpers ────────────────────────────────────── */
function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartItem[]; }
  catch { return []; }
}

function saveCart(cart: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/* ── Shared Theme ───────────────────────────────────────────── */
function applyTheme(t: string): void {
  document.documentElement.setAttribute('data-theme', t);
  const icon  = document.querySelector<HTMLElement>('#themeToggle .toggle-icon');
  const label = document.querySelector<HTMLElement>('#themeToggle .toggle-label');
  if (icon)  icon.textContent  = t === 'light' ? '🌙' : '☀️';
  if (label) label.textContent = t === 'light' ? 'DARK' : 'LIGHT';
}

function toggleTheme(): void {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('drip-theme', next);
  applyTheme(next);
}

/* ── Shared Utility ─────────────────────────────────────────── */
function esc(str: string | number): string {
  return String(str).replace(/'/g, "\\'");
}

function highlight(text: string, q: string): string {
  if (!q) return text;
  return text.replace(
    new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
    '<mark class="highlight">$1</mark>'
  );
}

/* ── Shared Checkout Modal ──────────────────────────────────── */
function showStep(n: 1 | 2 | 3): void {
  (document.getElementById('coStep1') as HTMLElement).style.display = n === 1 ? 'block' : 'none';
  (document.getElementById('coStep2') as HTMLElement).style.display = n === 2 ? 'block' : 'none';
  (document.getElementById('coStep3') as HTMLElement).style.display = n === 3 ? 'block' : 'none';
}

function closeCheckout(): void {
  document.getElementById('checkoutOverlay')?.classList.remove('open');
}

// Close checkout on overlay background click
document.getElementById('checkoutOverlay')?.addEventListener('click', function (this: HTMLElement, e: Event) {
  if (e.target === this) closeCheckout();
});

/* ── Init theme on every page ───────────────────────────────── */
applyTheme(localStorage.getItem('drip-theme') ?? 'dark');
