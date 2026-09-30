'use strict';
const $ = selector => document.querySelector(selector);
const state = {
  products: [], user: null, cart: readCart(), filter: 'All', sort: 'featured',
  search: '', detailQuantity: 1, authMode: 'login', pendingCheckout: false,
  currentPanel: null, lastOrder: null
};
const money = n => `Rs ${Number(n).toLocaleString('en-PK')}`;
const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[c]);
function readCart() {
  try {
    const data = JSON.parse(localStorage.getItem('mono_cart') || '{}');
    if (data && !Array.isArray(data) && typeof data === 'object') return Object.fromEntries(Object.entries(data).filter(([id,q]) => /^\d+$/.test(id) && Number.isSafeInteger(q) && q > 0 && q <= 20));
  } catch {}
  return {};
}
function saveCart() { localStorage.setItem('mono_cart', JSON.stringify(state.cart)); updateCount(); }
const productById = id => state.products.find(p => p.id === Number(id));
const cartEntries = () => Object.entries(state.cart).map(([id, qty]) => ({ product: productById(id), qty })).filter(x => x.product && x.product.stock > 0);
const subtotal = () => cartEntries().reduce((s, x) => s + x.product.price * Math.min(x.qty, x.product.stock), 0);
function updateCount() {
  const count = Object.values(state.cart).reduce((s, q) => s + q, 0);
  $('#cart-count').textContent = count;
  $('#cart-count').hidden = !count;
  $('#drawer-count').textContent = `(${count})`;
}
async function request(url, options={}) {
  const response = await fetch(url, { credentials:'same-origin', headers:{ 'Accept':'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}) }, ...options });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
let toastTimer;
function toast(message) { const el = $('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),3000); }
function routeTo(query='') {
  const url = '/' + query;
  if (location.pathname + location.search !== url) history.pushState({},'',url);
  renderRoute();
  window.scrollTo({top:0,behavior:'instant'});
}
function goShop(category) {
  closePanels();
  if (category) state.filter=category;
  state.search=''; $('#global-search').value='';
  if (location.search) routeTo(); else renderHome();
  requestAnimationFrame(() => $('#shop')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function visibleProducts() {
  const needle = state.search.trim().toLowerCase();
  let list = state.products.filter(p => (state.filter==='All' || p.category===state.filter) && (!needle || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(needle)));
  switch (state.sort) {
    case 'low': list.sort((a,b)=>a.price-b.price); break;
    case 'high': list.sort((a,b)=>b.price-a.price); break;
    case 'az': list.sort((a,b)=>a.name.localeCompare(b.name)); break;
    default: list.sort((a,b)=>b.featured-a.featured || a.id-b.id);
  }
  return list;
}
const card = p => `<article class="product-card">
  <div class="product-media" style="--tone:${p.accent}" data-detail="${p.slug}" tabindex="0" role="link" aria-label="View ${escapeHTML(p.name)}">
    ${p.badge ? `<span class="product-badge">${escapeHTML(p.badge)}</span>` : ''}
    <img src="${p.image}" alt="${escapeHTML(p.name)}" loading="lazy" width="310" height="310" />
    <button type="button" class="quick-add" data-add="${p.id}" ${p.stock<1?'disabled':''} title="Add ${escapeHTML(p.name)} to bag" aria-label="Add ${escapeHTML(p.name)} to bag"><svg><use href="#i-plus"/></svg></button>
  </div><div class="product-text"><div class="product-topline">${escapeHTML(p.category)}</div><h3 class="product-name" data-detail="${p.slug}" tabindex="0" role="link">${escapeHTML(p.name)}</h3><span class="price">${p.stock ? money(p.price) : 'Sold out'}${p.compare_price && p.stock ? `<span class="old-price">${money(p.compare_price)}</span>`:''}</span></div>
</article>`;
function gridMarkup() { const arr=visibleProducts(); return arr.length?arr.map(card).join(''):`<div class="empty-results"><h3>Nothing in this collection. Yet.</h3><p>Try a different category or search term.</p><button class="button outline" data-reset-search>See all products</button></div>`; }
function updateGrid() { if ($('#product-grid')) { $('#product-grid').innerHTML=gridMarkup(); $('#catalog-count').textContent=`${visibleProducts().length} products`; document.querySelectorAll('[data-filter]').forEach(el => el.classList.toggle('active',el.dataset.filter===state.filter)); } }
function renderHome() {
  $('#page').innerHTML=`
  <section class="hero"><div class="container hero-inner"><div class="hero-copy"><span class="hero-overline">THE EVERYDAY EDIT / 2026</span><h1>Good design.<br/><em>Better</em> every day.</h1><p class="hero-description">Thoughtfully chosen essentials to make the moments you spend working, listening and living feel a little better.</p><div class="hero-buttons"><button class="button primary" data-scroll-shop>Explore collection <svg><use href="#i-arrow"/></svg></button><a href="#story" class="button ghost" data-story>Our philosophy <svg><use href="#i-arrow"/></svg></a></div><div class="hero-meta"><span class="meta-line"></span><span>MADE FOR THE WAY YOU LIVE</span></div></div>
  <div class="hero-visual"><div class="hero-orbit"></div><img class="hero-img" src="/assets/headphones.svg" width="640" height="580" alt="Arc wireless headphones in a contemporary product display"/><div class="hero-floating"><span class="eyebrow">EDITOR'S PICK</span><strong>ARC / 01</strong><span>Wireless headphones</span></div><span class="hero-side-tag"><strong>01 — 08</strong>DISCOVER THE EDIT</span></div></div></section>
  <section class="values-bar" aria-label="Shopping benefits"><div class="container values-grid"><div class="value-item"><span class="value-icon"><svg><use href="#i-spark"/></svg></span><div><h3>Considered essentials</h3><p>Less noise. More meaning.</p></div></div><div class="value-item"><span class="value-icon"><svg><use href="#i-package"/></svg></span><div><h3>Curated collection</h3><p>Made for every day.</p></div></div><div class="value-item"><span class="value-icon"><svg><use href="#i-check"/></svg></span><div><h3>Simple demo checkout</h3><p>Explore a complete store.</p></div></div></div></section>
  <section class="catalog container" id="shop"><span class="eyebrow section-overline">THE COLLECTION</span><div class="catalog-head"><div><h2 class="section-title">Find your everyday.</h2><p>The little things that make a big difference.</p></div><span id="catalog-count" class="catalog-count"></span></div>
  <div class="catalog-toolbar"><div class="filter-list" aria-label="Product categories">${['All','Workspace','Audio','Carry','Mobile'].map(cat=>`<button type="button" class="filter-button ${state.filter===cat?'active':''}" data-filter="${cat}">${cat==='All'?'All products':cat}</button>`).join('')}</div><label class="sort-control">SORT BY <select id="sort-products" aria-label="Sort products"><option value="featured" ${state.sort==='featured'?'selected':''}>Featured</option><option value="low" ${state.sort==='low'?'selected':''}>Price: Low to high</option><option value="high" ${state.sort==='high'?'selected':''}>Price: High to low</option><option value="az" ${state.sort==='az'?'selected':''}>Name: A–Z</option></select></label></div>
  <div id="product-grid" class="products-grid"></div></section>
  <section class="story-band" id="story"><div class="container story-inner"><div class="story-art"><div class="story-circle"><img src="/assets/lamp.svg" loading="lazy" alt="Minimal desk lamp"/></div><span class="story-stamp">GOOD<br/>THINGS<br/>DAILY</span></div><div class="story-copy"><span class="eyebrow">THE MONO. POINT OF VIEW</span><h2>Less, but<br/>so much better.</h2><p>We believe the objects around us should do more than just work. They should feel good to use, look right at home, and make room for the things that actually matter. MONO. is a fictional storefront made to demonstrate a fully working e-commerce experience.</p><a href="#shop" data-shop class="story-link">Explore our selection <svg><use href="#i-arrow"/></svg></a></div></div></section>
  <section class="newsletter container"><span class="eyebrow">KEEP IT SIMPLE</span><h2>Make room for better.</h2><p>Designed as a CodeAlpha full-stack internship project.<br/>Explore, create an account, add to bag and place a demo order.</p></section>`;
  updateGrid();
}
function renderDetail(product) {
  state.detailQuantity=1;
  $('#page').innerHTML=`<section class="inner-page container"><nav class="breadcrumbs"><a href="/" data-home>Home</a><svg><use href="#i-chevron"/></svg><a href="#shop" data-category="${escapeHTML(product.category)}">${escapeHTML(product.category)}</a><svg><use href="#i-chevron"/></svg><span>${escapeHTML(product.name)}</span></nav>
  <div class="detail-layout"><div class="detail-image" style="--tone:${product.accent}"><img src="${product.image}" alt="${escapeHTML(product.name)}"/></div><div class="detail-info"><span class="eyebrow">${escapeHTML(product.category)} / MONO. ESSENTIALS</span><h1>${escapeHTML(product.name)}</h1><div class="detail-price">${money(product.price)} ${product.compare_price?`<span class="old-price">${money(product.compare_price)}</span>`:''}</div><p class="detail-description">${escapeHTML(product.description)}</p><div class="detail-actions"><div class="quantity detail-quantity"><button type="button" data-detail-qty="-1" aria-label="Decrease quantity"><svg><use href="#i-minus"/></svg></button><span id="detail-qty">1</span><button type="button" data-detail-qty="1" aria-label="Increase quantity"><svg><use href="#i-plus"/></svg></button></div><button type="button" class="button primary" data-add="${product.id}" data-detail-add="1" ${product.stock<1?'disabled':''}>${product.stock?'Add to bag':'Sold out'} <svg><use href="#i-arrow"/></svg></button></div><div class="detail-meta"><p><svg><use href="#i-check"/></svg> Thoughtfully curated everyday essential</p><p><svg><use href="#i-package"/></svg> ${product.stock} ${product.stock===1?'unit':'units'} available in this demo</p><p><svg><use href="#i-truck"/></svg> Demonstration checkout — no real delivery</p></div></div></div></section>`;
}
async function renderOrders() {
  if (!state.user) { state.pendingCheckout=false; showAuth('login'); routeTo(); return; }
  $('#page').innerHTML='<div class="container loading-state"><div class="loader"></div><p>Loading your orders...</p></div>';
  try {
    const data = await request('/api/orders');
    if (new URLSearchParams(location.search).get('view')!=='orders') return;
    $('#page').innerHTML=`<section class="inner-page container"><a href="/" class="back-link" data-home><svg><use href="#i-arrow"/></svg> Back to the shop</a><span class="eyebrow">MY ACCOUNT</span><h1 class="orders-title">Your orders.</h1><div class="account-banner"><div><strong>${escapeHTML(state.user.name)}</strong><span>${escapeHTML(state.user.email)}</span></div><button data-logout type="button">Sign out</button></div>
      ${data.orders.length ? `<div class="orders-list">${data.orders.map(o=>`<article class="order-card"><div class="order-top"><div><strong>Order #${o.id}</strong><p>${escapeHTML(o.created_at)} · ${escapeHTML(o.shipping_city)}</p></div><span class="status-tag">${escapeHTML(o.status)}</span></div>${o.items.map(it=>`<div class="order-line"><span>${escapeHTML(it.product_name)} × ${it.quantity}</span><span>${money(it.unit_price*it.quantity)}</span></div>`).join('')}<div class="order-line order-total"><span>Order total</span><span>${money(o.total)}</span></div></article>`).join('')}</div>` : `<div class="empty-results"><h3>No orders just yet.</h3><p>Your next favorite thing might be one click away.</p><button type="button" class="button primary" data-scroll-shop>Browse collection <svg><use href="#i-arrow"/></svg></button></div>`}</section>`;
  } catch (err) { $('#page').innerHTML=`<div class="container empty-results"><h3>Couldn't load orders.</h3><p>${escapeHTML(err.message)}</p><button type="button" class="button outline" data-orders>Try again</button></div>`; }
}
function renderSuccess() {
  const o=state.lastOrder;
  if (!o) { routeTo(); return; }
  $('#page').innerHTML=`<section class="container success-page"><div class="success-icon"><svg><use href="#i-check"/></svg></div><span class="eyebrow">ORDER PLACED</span><h1>It's official.</h1><p>Your demo order <strong>#${o.id}</strong> has been placed. This portfolio project doesn't charge you or ship physical products.</p><div class="success-total">${money(o.total)}</div><button class="button primary" data-orders>View order history <svg><use href="#i-arrow"/></svg></button><button class="button outline" data-scroll-shop>Keep exploring</button></section>`;
}
function renderRoute() {
  const query = new URLSearchParams(location.search);
  const slug=query.get('product'), view=query.get('view');
  if (slug) { const p=state.products.find(item=>item.slug===slug); if (p) renderDetail(p); else $('#page').innerHTML=`<div class="container empty-results" style="margin:80px auto"><h3>We couldn't find that product.</h3><button class="button primary" data-home>Back to shop</button></div>`; }
  else if (view==='orders') renderOrders(); else if (view==='success') renderSuccess(); else renderHome();
  updateCount();
}
function addToCart(id, qty=1) {
  const p=productById(id);
  if (!p || p.stock===0) return toast('This item is currently unavailable.');
  const next=(state.cart[p.id] || 0)+qty;
  if (next>Math.min(p.stock,20)) return toast('You have reached the available quantity for this item.');
  state.cart[p.id]=next;
  saveCart(); renderCart(); toast('Added to your bag.');
}
function changeCart(id, diff) {
  const p=productById(id); if (!p) return;
  const next=(state.cart[id]||0)+diff;
  if (next>Math.min(p.stock,20)) return toast('Maximum available quantity reached.');
  if (next<=0) delete state.cart[id]; else state.cart[id]=next;
  saveCart(); renderCart();
}
function renderCart() {
  const entries=cartEntries();
  $('#drawer-items').innerHTML=entries.length?entries.map(({product:p,qty})=>`<article class="cart-item"><div class="cart-thumbnail" style="--tone:${p.accent}" data-detail="${p.slug}"><img src="${p.image}" alt="${escapeHTML(p.name)}"/></div><div><span class="cart-item-category">${escapeHTML(p.category)}</span><h3 class="cart-item-title">${escapeHTML(p.name)}</h3><div class="cart-item-price">${money(p.price)}</div><div class="cart-item-bottom"><div class="quantity"><button type="button" data-cart-change="-1" data-id="${p.id}" aria-label="Decrease ${escapeHTML(p.name)} quantity"><svg><use href="#i-minus"/></svg></button><span>${qty}</span><button type="button" data-cart-change="1" data-id="${p.id}" aria-label="Increase ${escapeHTML(p.name)} quantity"><svg><use href="#i-plus"/></svg></button></div><button class="remove-item" type="button" data-remove="${p.id}">Remove</button></div></div></article>`).join(''):`<div class="empty-bag"><svg><use href="#i-bag"/></svg><h3>Your bag is empty.</h3><p>Good things are waiting to be discovered.</p><button class="button primary" data-scroll-shop>Start exploring <svg><use href="#i-arrow"/></svg></button></div>`;
  $('#drawer-bottom').innerHTML=entries.length?`<div class="subtotal-row"><span>Subtotal</span><strong>${money(subtotal())}</strong></div><p class="shipping-note">Demo store: no real charges or shipping.</p><button class="button primary wide" type="button" data-checkout>Continue to checkout <svg><use href="#i-arrow"/></svg></button>`:'';
  updateCount();
}
function closePanels() {
  state.currentPanel=null;
  $('#overlay').hidden=true;
  for(const selector of ['#cart-drawer','#auth-modal','#checkout-modal']) { const el=$(selector); el.classList.remove('open'); el.setAttribute('aria-hidden','true'); }
  document.body.classList.remove('lock-scroll');
}
function showPanel(which) {
  closePanels();
  state.currentPanel=which;
  $('#overlay').hidden=false;
  const el=$(`#${which}`); el.classList.add('open'); el.setAttribute('aria-hidden','false');
  document.body.classList.add('lock-scroll');
}
function showCart() { renderCart(); showPanel('cart-drawer'); }
function showAuth(mode='login') {
  state.authMode=mode;
  $('#auth-error').hidden=true;
  updateAuthUI(); showPanel('auth-modal');
  $('#auth-email').focus();
}
function updateAuthUI() {
  const register=state.authMode==='register';
  $('#auth-title').textContent=register?'Make yourself at home.':'Good to see you.';
  $('#auth-subtitle').textContent=register?'Create your account to get started.':'Sign in to continue where you left off.';
  $('#auth-name-wrap').hidden=!register;
  $('#auth-name').required=register;
  $('#auth-password').autocomplete=register?'new-password':'current-password';
  $('#password-hint').hidden=!register;
  $('#auth-submit').innerHTML=`${register?'Create account':'Sign in'} <svg><use href="#i-arrow"/></svg>`;
  document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.authTab===state.authMode));
}
function startCheckout() {
  if (!cartEntries().length) return toast('Add something to your bag first.');
  if (!state.user) { state.pendingCheckout=true; showAuth('login'); return; }
  $('#checkout-error').hidden=true;
  $('#ship-name').value=state.user.name;
  $('#ship-email').value=state.user.email;
  $('#checkout-total').textContent=money(subtotal());
  showPanel('checkout-modal');
}
async function refreshProducts() {
  const {products}=await request('/api/products'); state.products=products;
  for (const id of Object.keys(state.cart)) { const p=productById(id); if (!p || p.stock===0) delete state.cart[id]; else state.cart[id]=Math.min(state.cart[id],p.stock,20); }
  saveCart();
}
function closeMobileMenu() { $('#mobile-nav').hidden=true; }
function clickHandler(e) {
  const el=e.target.closest('button, a, [data-detail]'); if (!el) return;
  if (el.matches('[data-home]')) {e.preventDefault();closeMobileMenu();closePanels();state.search='';routeTo();return;}
  if (el.matches('[data-category]')) {e.preventDefault();closeMobileMenu();goShop(el.dataset.category);return;}
  if (el.matches('[data-shop],[data-scroll-shop]')) {e.preventDefault();closeMobileMenu();state.filter='All';goShop();return;}
  if (el.matches('[data-story]')) {e.preventDefault();closeMobileMenu();closePanels(); if(location.search)routeTo();requestAnimationFrame(()=>$('#story')?.scrollIntoView({behavior:'smooth'}));return;}
  if (el.matches('[data-add]')) {e.stopPropagation();addToCart(Number(el.dataset.add),el.dataset.detailAdd?state.detailQuantity:1);return;}
  if (el.matches('[data-detail]')) {closePanels();routeTo(`?product=${encodeURIComponent(el.dataset.detail)}`);return;}
  if (el.matches('[data-filter]')) {state.filter=el.dataset.filter;updateGrid();return;}
  if (el.matches('[data-reset-search]')) {state.filter='All';state.search='';$('#global-search').value='';updateGrid();return;}
  if (el.matches('[data-cart-change]')) {changeCart(Number(el.dataset.id),Number(el.dataset.cartChange));return;}
  if (el.matches('[data-remove]')) {delete state.cart[Number(el.dataset.remove)];saveCart();renderCart();return;}
  if (el.matches('[data-checkout]')) {startCheckout();return;}
  if (el.matches('[data-detail-qty]')) {const p=state.products.find(item=>item.slug===new URLSearchParams(location.search).get('product')); state.detailQuantity=Math.min(Math.max(1,state.detailQuantity+Number(el.dataset.detailQty)),Math.min(20,p?.stock||1));$('#detail-qty').textContent=state.detailQuantity;return;}
  if (el.matches('[data-auth-tab]')) {state.authMode=el.dataset.authTab;$('#auth-error').hidden=true;updateAuthUI();return;}
  if (el.matches('[data-orders]')) {e.preventDefault();closePanels();if(!state.user){state.pendingCheckout=false;showAuth();}else routeTo('?view=orders');return;}
  if (el.matches('[data-account]')) {state.user?routeTo('?view=orders'):showAuth();return;}
  if (el.matches('[data-logout]')) {void logout();return;}
  if (el.matches('[data-close]')) {closePanels();return;}
}
async function logout() {
  try { await request('/api/auth/logout',{method:'POST',body:'{}'});state.user=null;state.pendingCheckout=false;toast('Signed out.');closePanels();routeTo(); }
  catch(err){toast(err.message);}
}
async function submitAuth(e) {
  e.preventDefault();const btn=$('#auth-submit'); btn.disabled=true; $('#auth-error').hidden=true;
  try {
    const form=e.currentTarget;const field=n=>form.elements.namedItem(n).value;const payload={email:field('email').trim(),password:field('password')};
    if(state.authMode==='register')payload.name=field('name').trim();
    const {user}=await request(`/api/auth/${state.authMode}`,{method:'POST',body:JSON.stringify(payload)});
    state.user=user;form.reset();closePanels();toast(`Welcome${user.name?' back, '+user.name.split(' ')[0]:''}!`);
    if (state.pendingCheckout) {state.pendingCheckout=false;startCheckout();}
    else if(new URLSearchParams(location.search).get('view')==='orders')renderOrders();
  }catch(err){$('#auth-error').textContent=err.message;$('#auth-error').hidden=false;}
  finally{btn.disabled=false;}
}
async function submitCheckout(e) {
  e.preventDefault();const btn=$('#place-order');btn.disabled=true;$('#checkout-error').hidden=true;
  const form=e.currentTarget;const field=n=>form.elements.namedItem(n).value;
  const payload={name:field('name').trim(),email:field('email').trim(),phone:field('phone').trim(),city:field('city').trim(),address:field('address').trim(),notes:field('notes').trim(),items:cartEntries().map(x=>({id:x.product.id,quantity:x.qty}))};
  try {
    const {order}=await request('/api/orders',{method:'POST',body:JSON.stringify(payload)});
    state.lastOrder=order;state.cart={};saveCart();form.reset();closePanels();await refreshProducts();routeTo('?view=success');
  }catch(err){$('#checkout-error').textContent=err.message;$('#checkout-error').hidden=false;if(/available|stock/i.test(err.message))await refreshProducts();}
  finally{btn.disabled=false;}
}
async function init() {
  $('#year').textContent=new Date().getFullYear();
  try {
    const [catalog,account]=await Promise.all([request('/api/products'),request('/api/auth/me')]);
    state.products=catalog.products;state.user=account.user;
    for (const id of Object.keys(state.cart)) {const p=productById(id);if(!p||!p.stock)delete state.cart[id];else state.cart[id]=Math.min(state.cart[id],p.stock,20);}
    saveCart();renderRoute();
  } catch(err) {
    $('#page').innerHTML=`<div class="container empty-results" style="margin:90px auto"><h3>The store is temporarily unavailable.</h3><p>${escapeHTML(err.message)}</p><button type="button" class="button outline" onclick="location.reload()">Refresh page</button></div>`;
  }
}
document.addEventListener('click',clickHandler);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closePanels();closeMobileMenu();}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-detail][role="link"]')){e.preventDefault();closePanels();routeTo(`?product=${encodeURIComponent(e.target.dataset.detail)}`);}
});
$('#cart-toggle').addEventListener('click',showCart);
$('#account-toggle').addEventListener('click',()=>state.user?routeTo('?view=orders'):showAuth());
$('#search-toggle').addEventListener('click',()=>{$('#search-row').hidden=false;if(location.search)routeTo();$('#global-search').focus();requestAnimationFrame(()=>$('#shop')?.scrollIntoView({behavior:'smooth'}));});
$('#close-search').addEventListener('click',()=>{$('#search-row').hidden=true;state.search='';$('#global-search').value='';if(!location.search)updateGrid();});
$('#global-search').addEventListener('input',e=>{state.search=e.target.value;if(location.search)routeTo();else updateGrid();});
$('#menu-toggle').addEventListener('click',()=>{$('#mobile-nav').hidden=!$('#mobile-nav').hidden;});
$('#overlay').addEventListener('click',closePanels);
$('#auth-form').addEventListener('submit',submitAuth);
$('#checkout-form').addEventListener('submit',submitCheckout);
document.addEventListener('change',e=>{if(e.target.matches('#sort-products')){state.sort=e.target.value;updateGrid();}});
window.addEventListener('popstate',renderRoute);
init();
