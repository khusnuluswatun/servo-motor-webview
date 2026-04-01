
const PAGE_TO_NAV = {
  'p-menu': 'nb-menu', 'p-meas': 'nb-meas',
  'p-komp': 'nb-komp', 'p-mat': 'nb-mat', 'p-auth': 'nb-mat'
};
function goTo(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('active');
  const nb = PAGE_TO_NAV[id];
  if (nb) document.getElementById(nb).classList.add('active');
  // scroll to top
  if (pg) pg.scrollTop = 0;
}
// Set initial active nav
document.getElementById('nb-menu').classList.add('active');

function toggleMateri(card) {
  card.classList.toggle('open');
}

function showToast(msg, ms = 3500) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

function drawGauge(id, val, min, max) {
  const c = document.getElementById(id);
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H - 6, r = Math.min(W * .45, H * .88);
  const lw = 10;
  const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));

  // BG arc
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.lineWidth = lw; ctx.strokeStyle = '#e2e8f0'; ctx.lineCap = 'round'; ctx.stroke();

  // Zone arcs
  const zones = [{ e: .65, c: '#10b981' }, { e: .85, c: '#f59e0b' }, { e: 1, c: '#ef4444' }];
  let prev = 0;
  zones.forEach(z => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI + prev * Math.PI, Math.PI + z.e * Math.PI);
    ctx.lineWidth = lw; ctx.strokeStyle = z.c; ctx.lineCap = 'round'; ctx.stroke();
    prev = z.e;
  });

  // Value overlay
  if (pct > 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + pct * Math.PI);
    ctx.lineWidth = lw + 2; ctx.strokeStyle = '#ffffff0d'; ctx.lineCap = 'round';
    ctx.globalAlpha = .9; ctx.stroke(); ctx.globalAlpha = 1;
  }

  // Needle
  const ang = Math.PI + pct * Math.PI;
  const nx = cx + (r - 3) * Math.cos(ang), ny = cy + (r - 3) * Math.sin(ang);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#0f172a'; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f172a'; ctx.fill();

  // Min/max text
  ctx.font = '9px Inconsolata,monospace'; ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left'; ctx.fillText(min, 4, cy + 2);
  ctx.textAlign = 'right'; ctx.fillText(max, W - 4, cy + 2);
}

function updateDisplay(v, i) {
  const V_NOM = 220, V_TOL = 0.1, I_MAX = 15;
  [1, 2, 3].forEach((n, idx) => {
    const vi = v[idx], ii = i[idx];
    drawGauge('gv' + n, vi, 0, 280);
    drawGauge('gi' + n, ii, 0, 20);
    document.getElementById('vv' + n).textContent = isNaN(vi) ? '—' : vi.toFixed(1);
    document.getElementById('vi' + n).textContent = isNaN(ii) ? '—' : ii.toFixed(2);

    const vOk = vi >= V_NOM * (1 - V_TOL) && vi <= V_NOM * (1 + V_TOL);
    const iOk = ii <= I_MAX * .85;
    const card = document.getElementById('card' + n);
    const badge = document.getElementById('badge' + n);
  });

}

function setSyncState(s) {
  const dot = document.getElementById('sdot');
  const lbl = document.getElementById('slabel');
  dot.className = 'sync-dot';
  if (s === 'live') { dot.classList.add('live'); lbl.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); }
  else if (s === 'err') { dot.classList.add('err'); lbl.textContent = 'Error'; }
  else lbl.textContent = 'Memuat…';
}
function dateFormat(dt) {
  const date = new Date(dt);

  const formatted = date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Jakarta',
    hour12: false
  }).replace('T', ' ');
  return formatted;
}

async function fetchSheets() {
  setSyncState('loading');
  const url = `https://script.google.com/macros/s/AKfycbwckHWQCYvF1BCGAECgMqG61tSxxBX9eMHo32PQuv_hArOKAK0PaJtNDd449XtAuXbx/exec`;
  try {
    const res = await fetch(url);
    const json = await res.json();

    const p = x => parseFloat((x ?? '0').toString().replace(',', '.')) || 0;
    const last = json[json.length - 1];
    updateDisplay([p(last.V1), p(last.V2), p(last.V3)], [p(last.I1), p(last.I2), p(last.I3)]);
    const tbody = document.getElementById('logBody'); tbody.innerHTML = '';

    [...json].slice(-7).reverse().forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
            <td style="color:var(--text-3)">${index + 1}</td>
            <td>${dateFormat(item.Timestamp) || '—'}</td>
            <td>${item.V1 ?? '—'}</td>
            <td>${item.V2 ?? '—'}</td>
            <td>${item.V3 ?? '—'}</td>
            <td>${item.I1 ?? '—'}</td>
            <td>${item.I2 ?? '—'}</td>
            <td>${item.I3 ?? '—'}</td>
          `;

      tbody.appendChild(tr);
    });
    document.getElementById('rowCount').textContent = json.length + ' Data';
    setSyncState('live');

  } catch (e) { setSyncState('err'); showToast('Gagal: ' + e.message); }
}

let timer = null;
function setTimer() {
  if (timer) { clearInterval(timer); timer = null; }
  const ms = parseInt(document.getElementById('interval').value);
  if (ms > 0) timer = setInterval(fetchSheets, ms);
}

(function initDemo() {
  const v = [0, 0, 0], i = [0, 0, 0];
  updateDisplay(v, i);
})();