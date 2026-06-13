// =============================================================================
// OZONE PROMOTIONS — Bookings Modal Functions
// Kept in a separate .js file to avoid HTML parser interference with
// nested template literals inside <script> tags.
// =============================================================================

// ── Who Accepted modal ────────────────────────────────────────
async function showAcceptedModal(groupKey) {
  const [storeId, shiftDate, productId] = groupKey.split('__');
  const db = window.supabaseClient;

  const { data: rows } = await db.from('bookings').select(`
    id, status, ref_number,
    promoter:promoter_id(first_name, last_name, email, phone)
  `)
  .eq('store_id',   storeId)
  .eq('shift_date', shiftDate)
  .eq('product_id', productId)
  .in('status', ['confirmed', 'pending', 'declined']);

  const confirmed = (rows||[]).filter(r => r.status === 'confirmed');
  const pending   = (rows||[]).filter(r => r.status === 'pending');
  const declined  = (rows||[]).filter(r => r.status === 'declined');

  const rowHtml = (list, badge, badgeCls) => list.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;
         padding:8px 0;border-bottom:1px solid var(--oz-border)">
      <div>
        <div style="font-weight:600;font-size:.88rem">
          ${r.promoter ? r.promoter.first_name+' '+r.promoter.last_name : '—'}
        </div>
        <div style="font-size:.74rem;color:var(--oz-muted)">
          ${r.promoter?.email||''} ${r.promoter?.phone ? '· '+r.promoter.phone : ''}
        </div>
      </div>
      <span class="badge ${badgeCls}">${badge}</span>
    </div>`).join('');

  const confirmedHtml = confirmed.length ? `
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px;
         color:var(--oz-green);font-weight:700;margin-bottom:4px">
      ✅ Confirmed (${confirmed.length})
    </div>
    ${rowHtml(confirmed, '✓ Confirmed', 'badge-green')}` : '';

  const pendingHtml = pending.length ? `
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px;
         color:var(--oz-accent3);font-weight:700;margin:12px 0 4px">
      ⏳ Awaiting Reply (${pending.length})
    </div>
    ${rowHtml(pending, 'Pending', 'badge-amber')}` : '';

  const declinedHtml = declined.length ? `
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:1px;
         color:var(--oz-red);font-weight:700;margin:12px 0 4px">
      ❌ Declined (${declined.length})
    </div>
    ${rowHtml(declined, 'Declined', 'badge-red')}` : '';

  const emptyHtml = !rows?.length
    ? `<div style="text-align:center;padding:1.5rem;color:var(--oz-dim)">No responses yet.</div>`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.cssText = 'z-index:9500';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h2>👥 Who Accepted This Offer?</h2>
      <div style="font-size:.8rem;color:var(--oz-muted);margin-bottom:1rem">
        ${shiftDate} &nbsp;·&nbsp; Store: ${storeId}
      </div>
      ${confirmedHtml}
      ${pendingHtml}
      ${declinedHtml}
      ${emptyHtml}
      <div class="modal-footer" style="margin-top:1.2rem">
        <button class="btn btn-ghost"
          onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}


// ── Job QR codes modal ────────────────────────────────────────
async function showJobQR(groupKey) {
  const [storeId, shiftDate, productId] = groupKey.split('__');
  const db = window.supabaseClient;

  const { data: rows } = await db.from('bookings').select(`
    id, ref_number, shift_slot,
    promoter:promoter_id(first_name, last_name),
    store:store_id(name, retailer, branch),
    product:product_id(name, brand)
  `)
  .eq('store_id',   storeId)
  .eq('shift_date', shiftDate)
  .eq('product_id', productId)
  .eq('status', 'confirmed');

  if (!rows?.length) {
    OZ.toast('No confirmed promoters for this activation yet');
    return;
  }

  const storeName   = rows[0].store
    ? (rows[0].store.retailer
        ? `${rows[0].store.retailer} — ${rows[0].store.branch}`
        : rows[0].store.name)
    : '—';
  const productName = rows[0].product
    ? (rows[0].product.brand
        ? `${rows[0].product.brand} — ${rows[0].product.name}`
        : rows[0].product.name)
    : '—';
  const shiftSlot = rows[0].shift_slot || '—';
  const dateStr   = new Date(shiftDate).toLocaleDateString('en-ZA', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const qrCardId = id => `qr-job-${id.slice(-6)}`;

  // Build each card HTML before the outer template literal
  const qrCards = rows.map(r => {
    const tok   = `OZ-${r.ref_number}-${shiftDate}`;
    const pname = r.promoter
      ? `${r.promoter.first_name} ${r.promoter.last_name}`
      : r.ref_number;
    const cid   = qrCardId(r.id);
    return `
    <div style="background:var(--oz-surface2);border:1px solid var(--oz-border);
         border-radius:var(--r);padding:1rem;display:flex;align-items:center;gap:1rem">
      <div style="background:#fff;border-radius:6px;padding:6px;flex-shrink:0">
        <canvas id="${cid}" width="100" height="100"></canvas>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:.88rem">${pname}</div>
        <div style="font-size:.72rem;color:var(--oz-dim);font-family:monospace;margin-top:3px">${tok}</div>
        <div style="display:flex;gap:6px;margin-top:.6rem">
          <button class="btn btn-sm btn-outline"
            onclick="downloadJobQR('${cid}','${pname}')">⬇ Download</button>
          <button class="btn btn-sm btn-ghost"
            onclick="printJobQR('${cid}','${pname}','${storeName}','${dateStr}','${shiftSlot}','${productName}','${tok}')">🖨 Print</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.cssText = 'z-index:9500';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h2>📲 Activation QR Codes</h2>
      <div style="font-size:.82rem;color:var(--oz-muted);margin-bottom:1.2rem;line-height:1.7">
        <strong style="color:var(--oz-text)">${storeName}</strong><br>
        📅 ${dateStr} &nbsp;·&nbsp; 🕐 ${shiftSlot}<br>
        🛍 ${productName}
      </div>
      <div style="display:flex;flex-direction:column;gap:.75rem" id="qr-job-list">
        ${qrCards}
      </div>
      <div class="modal-footer" style="margin-top:1.2rem;display:flex;gap:8px">
        <button class="btn btn-ghost"
          onclick="this.closest('.modal-overlay').remove()">Close</button>
        <button class="btn btn-accent" id="qr-print-all-btn">🖨 Print All</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const allIds = rows.map(r => qrCardId(r.id));
  overlay.querySelector('#qr-print-all-btn')
    .addEventListener('click', () => setTimeout(() => printAllJobQRs(allIds), 300));

  if (typeof QRCode !== 'undefined') {
    rows.forEach(r => {
      const tok    = `OZ-${r.ref_number}-${shiftDate}`;
      const canvas = document.getElementById(qrCardId(r.id));
      if (!canvas) return;
      QRCode.toCanvas(canvas, tok, {
        width: 100, margin: 1,
        color: { dark: '#000', light: '#fff' }
      }, err => { if (err) console.warn('QR error:', err); });
    });
  }
}


// ── Download single QR ────────────────────────────────────────
function downloadJobQR(canvasId, name) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const a = document.createElement('a');
  a.download = `OzoneQR-${name.replace(/\s/g, '-')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  OZ.toast('QR downloaded');
}


// ── Print single QR ───────────────────────────────────────────
function printJobQR(canvasId, name, store, dateStr, slot, product, token) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html><head><title>Ozone QR — ${name}</title>
<style>
  body { font-family:Arial,sans-serif;text-align:center;padding:40px }
  img  { width:200px;display:block;margin:16px auto }
  p    { margin:4px 0;font-size:13px;color:#555 }
  .token { font-size:10px;color:#aaa;font-family:monospace;margin-top:10px }
  @media print { body { padding:20px } }
</style>
</head><body>
  <h2 style="margin-bottom:4px">Ozone Promotions</h2>
  <p style="font-size:15px;font-weight:bold">${store}</p>
  <p>${dateStr} · ${slot}</p>
  <p>${product}</p>
  <img src="${dataUrl}" alt="QR Code">
  <p style="font-weight:bold;font-size:14px">👤 ${name}</p>
  <p>Scan to check in to your shift</p>
  <div class="token">${token}</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}


// ── Print all QRs ─────────────────────────────────────────────
function printAllJobQRs(canvasIds) {
  const parts = canvasIds.map(id => {
    const canvas = document.getElementById(id);
    return canvas
      ? `<div style="page-break-inside:avoid;margin-bottom:30px;text-align:center">
           <img src="${canvas.toDataURL('image/png')}"
                style="width:180px;display:block;margin:0 auto">
         </div>`
      : '';
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html><head><title>Ozone QR — All</title>
<style>
  body { font-family:Arial,sans-serif;padding:30px }
  @media print { .no-print { display:none } }
</style>
</head><body>
  <h2 style="text-align:center;margin-bottom:20px">Ozone Promotions — Shift QR Codes</h2>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px">
    ${parts}
  </div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}


// ── Auto-sweep past bookings ──────────────────────────────────
async function sweepPastBookings() {
  const today = new Date().toISOString().split('T')[0];
  const db    = window.supabaseClient;

  await db.from('bookings')
    .update({ status: 'completed' })
    .eq('status', 'confirmed')
    .lt('shift_date', today);

  await db.from('bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .lt('shift_date', today);
}