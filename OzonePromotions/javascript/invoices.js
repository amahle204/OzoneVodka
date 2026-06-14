// =============================================================================
// OZONE PROMOTIONS — Invoices
// Extracted to avoid nested template literal issues in HTML <script> tags.
// =============================================================================

let _invoiceBooking = null;

// ── Main render ───────────────────────────────────────────────
async function renderInvoices() {
  const el  = document.getElementById('page-invoices');
  const db  = window.supabaseClient;
  const sym = (window.SETTINGS || {}).currencySymbol || 'R';

  el.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--oz-muted)">
    <div class="loading-spinner" style="margin:0 auto 1rem"></div>Loading…</div>`;

  // 1. Load existing invoices
  const { data: existingInvoices } = await db
    .from('invoices')
    .select(`
      id, invoice_number, invoice_date, due_date,
      client_name, service_description,
      amount_zar, vat_zar, total_zar, status,
      store:store_id(name, retailer, branch)
    `)
    .order('invoice_date', { ascending: false })
    .limit(50);

  // 2. Load completed bookings not yet invoiced
  const { data: invoicedLinks } = await db
    .from('invoices')
    .select('booking_id')
    .not('booking_id', 'is', null);

  const invoicedIds = (invoicedLinks || []).map(i => i.booking_id);

  let bkQ = db
    .from('bookings')
    .select(`
      id, ref_number, shift_date, shift_slot, shift_hours,
      hourly_rate_zar, total_pay_zar, required_promoters,
      store:store_id(id, name, retailer, branch, address, region),
      product:product_id(id, name, brand)
    `)
    .eq('status', 'completed')
    .order('shift_date', { ascending: false });

  if (invoicedIds.length) {
    bkQ = bkQ.not('id', 'in', `(${invoicedIds.join(',')})`);
  }

  const { data: completedBookings } = await bkQ;
  const uninvoiced = completedBookings || [];
  const invoices   = existingInvoices  || [];

  // Build the uninvoiced booking cards
  const uninvoicedHtml = !uninvoiced.length
    ? `<div style="text-align:center;padding:1.5rem;color:var(--oz-dim);
            border:2px dashed var(--oz-border2);border-radius:var(--r)">
         <div style="font-size:1.5rem;margin-bottom:.4rem">🎉</div>
         <div style="font-size:.84rem">All completed activations have been invoiced</div>
       </div>`
    : uninvoiced.map(b => {
        const store = b.store
          ? (b.store.retailer ? `${b.store.retailer} — ${b.store.branch}` : b.store.name)
          : '—';
        const campaign = b.product
          ? (b.product.brand ? `${b.product.brand} — ${b.product.name}` : b.product.name)
          : '—';
        const pay    = b.total_pay_zar || ((b.hourly_rate_zar || 45) * (b.shift_hours || 8));
        const dateStr = new Date(b.shift_date).toLocaleDateString('en-ZA',
          { day:'numeric', month:'short', year:'numeric' });
        const promos  = b.required_promoters || 1;
        return `<div class="card" id="bk-sel-${b.id}"
              onclick="selectInvoiceBooking('${b.id}')"
              style="margin-bottom:.6rem;cursor:pointer;padding:.85rem 1rem;
                     border:2px solid var(--oz-border2);transition:border-color .2s">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
              <div>
                <div style="font-weight:600;font-size:.88rem">${campaign}</div>
                <div style="font-size:.76rem;color:var(--oz-muted);margin-top:2px">
                  🏪 ${store}<br>
                  📅 ${dateStr} &nbsp;·&nbsp; 🕐 ${b.shift_slot || '—'}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <span class="pay-badge">${sym}${Number(pay).toLocaleString()}</span>
                <div style="font-size:.68rem;color:var(--oz-dim);margin-top:3px">
                  ${promos} promoter${promos > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>`;
      }).join('');

  // Build previous invoices table
  const statusBadge = s =>
    s === 'paid'    ? 'badge-green' :
    s === 'draft'   ? 'badge-gray'  :
    s === 'overdue' ? 'badge-red'   : 'badge-amber';

  const invoicesHtml = !invoices.length ? '' : `
    <div class="card">
      <div class="card-title" style="margin-bottom:.75rem">🧾 Previous Invoices</div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Invoice #</th><th>Store</th><th>Date</th>
          <th>Total</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
        ${invoices.map(inv => {
          const sn = inv.store
            ? (inv.store.retailer ? `${inv.store.retailer} — ${inv.store.branch}` : inv.store.name)
            : (inv.client_name || '—');
          const markPaid = inv.status !== 'paid'
            ? `<button class="btn btn-sm btn-success" onclick="markInvoicePaid('${inv.id}')">Mark Paid</button>`
            : '';
          return `<tr>
            <td><code style="color:var(--oz-accent);font-size:.72rem">${inv.invoice_number}</code></td>
            <td style="font-size:.8rem">${sn}</td>
            <td style="font-size:.78rem">${inv.invoice_date || '—'}</td>
            <td style="font-weight:600;color:var(--oz-green)">${sym}${Number(inv.total_zar||0).toLocaleString()}</td>
            <td><span class="badge ${statusBadge(inv.status)}">${inv.status}</span></td>
            <td>${markPaid}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`;

  el.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1>Store Invoices</h1>
      <p>Generate invoices from completed activations</p>
    </div>
  </div>
  <div class="two-col" style="align-items:flex-start">

    <!-- LEFT: Select a completed booking -->
    <div>
      <div class="card" style="margin-bottom:1rem">
        <div class="card-title" style="margin-bottom:.75rem">📋 Select Completed Activation</div>
        <div style="font-size:.78rem;color:var(--oz-muted);margin-bottom:.75rem">
          Only completed shifts are shown. Invoice details auto-fill from the booking.
        </div>
        ${uninvoicedHtml}
      </div>
      ${invoicesHtml}
    </div>

    <!-- RIGHT: Auto-filled invoice preview -->
    <div>
      <div class="card" id="invoice-preview-card" style="position:sticky;top:1rem">

        <div id="inv-placeholder" style="text-align:center;padding:3rem 1rem;color:var(--oz-dim)">
          <div style="font-size:2.5rem;margin-bottom:.6rem">🧾</div>
          <div style="font-size:.84rem">
            Select a completed activation on the left<br>to generate its invoice
          </div>
        </div>

        <div id="inv-filled" style="display:none">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem">
            <div>
              <div style="font-weight:800;font-size:1.1rem;color:var(--oz-accent);letter-spacing:.04em">
                OZONE PROMOTIONS
              </div>
              <div style="font-size:.73rem;color:var(--oz-dim);margin-top:2px">Tax Invoice</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:.7rem;color:var(--oz-dim)">Invoice #</div>
              <div style="font-weight:700;font-size:.88rem" id="inv-number">—</div>
              <div style="font-size:.72rem;color:var(--oz-muted);margin-top:2px" id="inv-date">—</div>
            </div>
          </div>

          <div style="background:var(--oz-surface2);border-radius:var(--r);padding:.75rem 1rem;margin-bottom:1rem;font-size:.8rem">
            <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--oz-dim);margin-bottom:.35rem">Billed To</div>
            <div style="font-weight:700" id="inv-store-name">—</div>
            <div style="color:var(--oz-muted);margin-top:2px;line-height:1.7" id="inv-store-address">—</div>
          </div>

          <div style="margin-bottom:1rem">
            <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--oz-dim);margin-bottom:.5rem">Services Rendered</div>
            <table style="width:100%;border-collapse:collapse;font-size:.8rem">
              <thead>
                <tr style="border-bottom:1px solid var(--oz-border2)">
                  <th style="text-align:left;padding:.35rem .4rem;font-size:.68rem;color:var(--oz-dim);font-weight:600;text-transform:uppercase">Description</th>
                  <th style="text-align:center;padding:.35rem .4rem;font-size:.68rem;color:var(--oz-dim);font-weight:600;text-transform:uppercase">Hours</th>
                  <th style="text-align:right;padding:.35rem .4rem;font-size:.68rem;color:var(--oz-dim);font-weight:600;text-transform:uppercase">Rate</th>
                  <th style="text-align:right;padding:.35rem .4rem;font-size:.68rem;color:var(--oz-dim);font-weight:600;text-transform:uppercase">Amount</th>
                </tr>
              </thead>
              <tbody id="inv-line-items"></tbody>
            </table>
          </div>

          <div style="border-top:1px solid var(--oz-border2);padding-top:.75rem;font-size:.82rem">
            <div style="display:flex;justify-content:space-between;margin-bottom:.3rem;color:var(--oz-muted)">
              <span>Subtotal</span><span id="inv-subtotal">—</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:.3rem;color:var(--oz-muted)">
              <span>VAT (15%)</span><span id="inv-vat">—</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:.95rem;border-top:2px solid var(--oz-border2);padding-top:.5rem;margin-top:.3rem">
              <span>Total Due</span>
              <span id="inv-total" style="color:var(--oz-accent)">—</span>
            </div>
          </div>

          <div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:var(--r);padding:.65rem .9rem;margin-top:.85rem;font-size:.76rem;color:var(--oz-muted);line-height:1.8" id="inv-shift-info"></div>

          <div style="display:flex;gap:.5rem;margin-top:1rem;flex-wrap:wrap">
            <button class="btn btn-accent" style="flex:1" onclick="saveAndPrintInvoice()">
              🖨 Save & Print
            </button>
            <button class="btn btn-outline" style="flex:1" onclick="emailInvoiceToStore()">
              📧 Email to Store
            </button>
          </div>
          <div style="font-size:.7rem;color:var(--oz-dim);text-align:center;margin-top:.5rem">
            Invoice is saved to the database when you print or email
          </div>
        </div>
      </div>
    </div>

  </div>`;
}


// ── Select a booking and fill the preview ─────────────────────
async function selectInvoiceBooking(bookingId) {
  const db  = window.supabaseClient;
  const sym = (window.SETTINGS || {}).currencySymbol || 'R';

  document.querySelectorAll('[id^="bk-sel-"]').forEach(el => {
    el.style.borderColor = 'var(--oz-border2)';
    el.style.background  = '';
  });
  const selEl = document.getElementById(`bk-sel-${bookingId}`);
  if (selEl) {
    selEl.style.borderColor = 'var(--oz-accent)';
    selEl.style.background  = 'rgba(0,212,255,.04)';
  }

  const { data: b } = await db
    .from('bookings')
    .select(`
      id, ref_number, shift_date, shift_slot, shift_hours,
      hourly_rate_zar, total_pay_zar, required_promoters,
      store:store_id(id, name, retailer, branch, address, region),
      product:product_id(name, brand, retail_price)
    `)
    .eq('id', bookingId)
    .single();

  if (!b) return;
  _invoiceBooking = b;

  const storeName = b.store
    ? (b.store.retailer ? `${b.store.retailer} — ${b.store.branch}` : b.store.name)
    : '—';
  const campaign = b.product
    ? (b.product.brand ? `${b.product.brand} — ${b.product.name}` : b.product.name)
    : 'Brand Activation';
  const dateStr = new Date(b.shift_date).toLocaleDateString('en-ZA',
    { day:'numeric', month:'long', year:'numeric' });
  const suggestedPrice = b.product?.retail_price || 0;
  const invNumber = `INV-${new Date(b.shift_date).getFullYear()}-${b.ref_number}`;

  document.getElementById('inv-placeholder').style.display = 'none';
  document.getElementById('inv-filled').style.display      = 'block';

  document.getElementById('inv-number').textContent      = invNumber;
  document.getElementById('inv-date').textContent        = dateStr;
  document.getElementById('inv-store-name').textContent  = storeName;
  document.getElementById('inv-store-address').innerHTML = b.store?.address
    ? `📍 ${b.store.address}${b.store.region ? ', ' + b.store.region : ''}`
    : '📍 Address not on record';

  document.getElementById('inv-shift-info').innerHTML = `
    📦 <strong style="color:var(--oz-text)">${campaign}</strong><br>
    🏪 ${storeName} &nbsp;·&nbsp; 📅 ${dateStr}`;

  // Show unit input fields
  document.getElementById('inv-line-items').innerHTML = `
    <tr>
      <td colspan="4" style="padding:.6rem .4rem">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <div style="font-size:.65rem;color:var(--oz-dim);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">Units Sold</div>
            <input type="number" id="inv-units" min="0" value="0" placeholder="0"
              oninput="recalcInvoice()"
              style="width:100%;padding:6px 8px;background:var(--oz-surface2);border:1px solid var(--oz-border2);border-radius:var(--r);color:var(--oz-text);font-size:.84rem">
          </div>
          <div>
            <div style="font-size:.65rem;color:var(--oz-dim);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">Price Per Unit (${sym})</div>
            <input type="number" id="inv-unit-price" min="0" step="0.01"
              value="${suggestedPrice}" placeholder="0.00"
              oninput="recalcInvoice()"
              style="width:100%;padding:6px 8px;background:var(--oz-surface2);border:1px solid var(--oz-border2);border-radius:var(--r);color:var(--oz-text);font-size:.84rem">
          </div>
          <div>
            <div style="font-size:.65rem;color:var(--oz-dim);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">VAT %</div>
            <input type="number" id="inv-vat-rate" min="0" max="100" value="15"
              oninput="recalcInvoice()"
              style="width:100%;padding:6px 8px;background:var(--oz-surface2);border:1px solid var(--oz-border2);border-radius:var(--r);color:var(--oz-text);font-size:.84rem">
          </div>
        </div>
        <div style="font-size:.72rem;color:var(--oz-muted)">
          ${campaign} &nbsp;·&nbsp; ${dateStr} &nbsp;·&nbsp; ${b.shift_slot || '—'}
        </div>
      </td>
    </tr>`;

  recalcInvoice();
}







function recalcInvoice() {
  const sym       = (window.SETTINGS || {}).currencySymbol || 'R';
  const units     = Number(document.getElementById('inv-units')?.value     || 0);
  const unitPrice = Number(document.getElementById('inv-unit-price')?.value || 0);
  const vatRate   = Number(document.getElementById('inv-vat-rate')?.value   || 15) / 100;
  const subtotal  = units * unitPrice;
  const vatAmt    = subtotal * vatRate;
  const grandTotal= subtotal + vatAmt;

  const fmt = n => sym + Number(n).toLocaleString('en-ZA',
    { minimumFractionDigits:2, maximumFractionDigits:2 });

  document.getElementById('inv-subtotal').textContent = fmt(subtotal);
  document.getElementById('inv-vat').textContent      = fmt(vatAmt);
  document.getElementById('inv-total').textContent    = fmt(grandTotal);
}


// ── Save to DB and open print window ─────────────────────────
async function saveAndPrintInvoice() {
  const b = _invoiceBooking;
  if (!b) { OZ.toast('No booking selected'); return; }

  const units     = Number(document.getElementById('inv-units')?.value     || 0);
  const unitPrice = Number(document.getElementById('inv-unit-price')?.value || 0);
  const vatRate   = Number(document.getElementById('inv-vat-rate')?.value   || 15) / 100;

  if (!units || !unitPrice) { OZ.toast('Please enter units sold and price per unit'); return; }

  const db  = window.supabaseClient;
  const sym = (window.SETTINGS || {}).currencySymbol || 'R';

  const subtotal  = units * unitPrice;
  const vatAmt    = subtotal * vatRate;
  const grandTotal= subtotal + vatAmt;

  const storeName = b.store
    ? (b.store.retailer ? `${b.store.retailer} — ${b.store.branch}` : b.store.name)
    : '—';
  const campaign = b.product
    ? (b.product.brand ? `${b.product.brand} — ${b.product.name}` : b.product.name)
    : 'Brand Activation';

  const invNumber = `INV-${new Date(b.shift_date).getFullYear()}-${b.ref_number}`;
  const today     = new Date().toISOString().split('T')[0];
  const dueDate   = new Date(Date.now() +
    ((window.SETTINGS?.paymentTermsDays || 5) * 86400000))
    .toISOString().split('T')[0];

  const { error } = await db
    .from('invoices')
    .upsert({
      invoice_number:      invNumber,
      client_name:         storeName,
      store_id:            b.store?.id || null,
      booking_id:          b.id,
      service_description: `${campaign} — ${units} units @ ${sym}${unitPrice} · ${b.shift_date}`,
      amount_zar:          subtotal,
      vat_zar:             vatAmt,
      invoice_date:        today,
      due_date:            dueDate,
      status:              'draft',
    }, { onConflict: 'invoice_number' })
    .select('id').single();

  if (error) { OZ.toast('❌ Could not save invoice: ' + error.message); return; }
  OZ.toast('✅ Invoice saved — opening print view…');

  const fmt = n => sym + Number(n).toLocaleString('en-ZA',
    { minimumFractionDigits:2, maximumFractionDigits:2 });
  const dateStr = new Date(b.shift_date).toLocaleDateString('en-ZA',
    { day:'numeric', month:'long', year:'numeric' });
  const vatPct   = Math.round(vatRate * 100);
  const storeAddr= b.store?.address
    ? `${b.store.address}${b.store.region ? ', ' + b.store.region : ''}`
    : '';
  const payTerms = window.SETTINGS?.paymentTermsDays || 5;
  const coEmail  = window.SETTINGS?.companyEmail || '';
  const coPhone  = window.SETTINGS?.companyPhone || '';

  const win = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><title>' + invNumber + '</title>'
    + '<style>'
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{font-family:Arial,sans-serif;padding:40px;color:#111;font-size:13px}'
    + '.header{display:flex;justify-content:space-between;margin-bottom:28px}'
    + '.brand{font-size:20px;font-weight:800;color:#00d4ff;letter-spacing:.05em}'
    + '.sub{font-size:11px;color:#888;margin-top:2px}'
    + '.billed-to{background:#f8f9fa;border-radius:6px;padding:12px 16px;margin-bottom:20px}'
    + '.billed-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:16px}'
    + 'th{text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;border-bottom:2px solid #e0e0e0;font-weight:600}'
    + 'th.right,td.right{text-align:right}'
    + 'th.center,td.center{text-align:center}'
    + 'td{padding:9px 8px;border-bottom:1px solid #f0f0f0;font-size:12px}'
    + '.totals td{border:none;padding:5px 8px}'
    + '.total-row td{font-weight:700;font-size:14px;border-top:2px solid #e0e0e0;padding-top:8px}'
    + '.footer{margin-top:28px;font-size:11px;color:#888;text-align:center;border-top:1px solid #e0e0e0;padding-top:14px}'
    + '@media print{body{padding:20px}}'
    + '</style></head><body>'
    + '<div class="header">'
    +   '<div><div class="brand">OZONE PROMOTIONS</div><div class="sub">Tax Invoice</div></div>'
    +   '<div style="text-align:right">'
    +     '<div style="font-weight:700;font-size:15px">' + invNumber + '</div>'
    +     '<div style="color:#888;font-size:11px;margin-top:3px">Date: ' + today + '<br>Due: ' + dueDate + '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="billed-to">'
    +   '<div class="billed-label">Billed To</div>'
    +   '<div style="font-weight:700;font-size:14px">' + storeName + '</div>'
    +   (storeAddr ? '<div style="color:#666;margin-top:3px">' + storeAddr + '</div>' : '')
    + '</div>'
    + '<table><thead><tr>'
    +   '<th>Description</th><th class="center">Units</th>'
    +   '<th class="right">Unit Price</th><th class="right">Amount</th>'
    + '</tr></thead><tbody><tr>'
    +   '<td>' + campaign + ' — Units sold at activation<br>'
    +     '<span style="font-size:11px;color:#888">'
    +       dateStr + ' · ' + (b.shift_slot || '—') + ' · ' + (b.store?.name || storeName)
    +     '</span></td>'
    +   '<td class="center">' + units + '</td>'
    +   '<td class="right">' + sym + unitPrice.toFixed(2) + '</td>'
    +   '<td class="right" style="font-weight:600">' + fmt(subtotal) + '</td>'
    + '</tr></tbody></table>'
    + '<table class="totals" style="width:260px;margin-left:auto">'
    +   '<tr><td>Subtotal</td><td class="right">' + fmt(subtotal) + '</td></tr>'
    +   '<tr><td>VAT (' + vatPct + '%)</td><td class="right">' + fmt(vatAmt) + '</td></tr>'
    +   '<tr class="total-row"><td>Total Due</td><td class="right" style="color:#00d4ff">' + fmt(grandTotal) + '</td></tr>'
    + '</table>'
    + '<div class="footer">Payment due within ' + payTerms + ' business days'
    +   (coEmail ? ' · ' + coEmail : '')
    +   (coPhone ? ' · ' + coPhone : '')
    + '</div>'
    + '</body></html>'
  );
  win.document.close();
  setTimeout(() => win.print(), 400);
  setTimeout(renderInvoices, 1000);
}


// ── Email stub ────────────────────────────────────────────────
async function emailInvoiceToStore() {
  await saveAndPrintInvoice();
  OZ.toast('📧 Email to store — coming soon');
}


// ── Mark paid ─────────────────────────────────────────────────
async function markInvoicePaid(invoiceId) {
  const db = window.supabaseClient;
  const { error } = await db
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) { OZ.toast('❌ ' + error.message); return; }
  OZ.toast('✅ Invoice marked as paid');
  renderInvoices();
}