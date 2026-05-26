
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
  if (pg) pg.scrollTop = 0;
}
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

// Update gauges per-fase (tegangan, arus, daya, frekuensi)
function updateDisplay(v, i, w, f) {
  [1, 2, 3].forEach((n, idx) => {
    const vi = v[idx], ii = i[idx], wi = w[idx], fi = f[idx];
    drawGauge('gv' + n, vi, 0, 280);
    drawGauge('gi' + n, ii, 0, 20);
    drawGauge('gw' + n, wi, 0, 5000);
    drawGauge('gf' + n, fi, 45, 55);
    document.getElementById('vv' + n).textContent = isNaN(vi) ? '—' : vi.toFixed(1);
    document.getElementById('vi' + n).textContent = isNaN(ii) ? '—' : ii.toFixed(2);
    document.getElementById('vw' + n).textContent = isNaN(wi) ? '—' : wi.toFixed(1);
    document.getElementById('vf' + n).textContent = isNaN(fi) ? '—' : fi.toFixed(2);
  });
}

// Update gauges line-to-line (tegangan, arus, daya)
function updateDisplayLL(v, i, w) {
  [1, 2, 3].forEach((n, idx) => {
    const vi = v[idx], ii = i[idx], wi = w[idx];
    drawGauge('gvl' + n, vi, 0, 500);
    drawGauge('gil' + n, ii, 0, 20);
    drawGauge('gwl' + n, wi, 0, 10000);
    document.getElementById('vvl' + n).textContent = isNaN(vi) ? '—' : vi.toFixed(1);
    document.getElementById('vil' + n).textContent = isNaN(ii) ? '—' : ii.toFixed(2);
    document.getElementById('vwl' + n).textContent = isNaN(wi) ? '—' : wi.toFixed(1);
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

// Auto-refresh: On = setTimeout 5s setelah data terakhir diupdate
let autoRefreshOn = false;
let autoRefreshTimer = null;

function setTimer() {
  const val = document.getElementById('interval').value;
  autoRefreshOn = (val === '1');
  if (!autoRefreshOn) {
    if (autoRefreshTimer) { clearTimeout(autoRefreshTimer); autoRefreshTimer = null; }
  } else {
    if (!autoRefreshTimer) {
      autoRefreshTimer = setTimeout(fetchSheets, 5000);
    }
  }
}

async function fetchSheets() {
  if (autoRefreshTimer) { clearTimeout(autoRefreshTimer); autoRefreshTimer = null; }
  setSyncState('loading');
  const url = 'proxy.php'; // bypass CORS

  try {
    const res = await fetch(url);
    const raw = await res.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error('JSON parse gagal. Response: ' + raw.substring(0, 120));
    }

    const p = x => parseFloat((x ?? '0').toString().replace(',', '.')) || 0;
    const SENSOR_KEYS = [
      'Vr (V)', 'Vs (V)', 'Vt (V)',
      'Ir (A)', 'Is (A)', 'It (A)',
      'Pr (W)', 'Ps (W)', 'Pt (W)',
      'Fr (Hz)', 'Fs (Hz)', 'Ft (Hz)',
      'Vrs (V)', 'Vst (V)', 'Vtr (V)',
      'Irs (A)', 'Ist (A)', 'Itr (A)'
    ];

    // baris = valid jika minimal 1 nilai sensor tidak kosong & bukan 0
    const isValidRow = row => SENSOR_KEYS.some(k => {
      const val = p(row[k]);
      return !isNaN(val) && val !== 0;
    });

    const validJson = json.filter(isValidRow);

    if (validJson.length === 0) {
      setSyncState('live');
      showToast('Tidak ada data valid di sheet.');
      if (autoRefreshOn) autoRefreshTimer = setTimeout(fetchSheets, 5000);
      return;
    }

    const last = validJson[validJson.length - 1];

    updateDisplay(
      [p(last["Vr (V)"]), p(last["Vs (V)"]), p(last["Vt (V)"])], //ganti kolom disini
      [p(last["Ir (A)"]), p(last["Is (A)"]), p(last["It (A)"])],
      [p(last["Pr (W)"]), p(last["Ps (W)"]), p(last["Pt (W)"])],
      [p(last["Fr (Hz)"]), p(last["Fs (Hz)"]), p(last["Ft (Hz)"])]
    );

    // Update line-to-line gauges
    // Hitung daya line-to-line: P = √3 × V × I × 0.85
    let vrs = p(last["Vrs (V)"]), vst = p(last["Vst (V)"]), vtr = p(last["Vtr (V)"]);
    let irs = p(last["Irs (A)"]), ist = p(last["Ist (A)"]), itr = p(last["Itr (A)"]);
    let sqrtt3 = Math.sqrt(3);
    let pff = 0.85;
    updateDisplayLL(
      [vrs, vst, vtr],
      [irs, ist, itr],
      [sqrtt3 * vrs * irs * pff, sqrtt3 * vst * ist * pff, sqrtt3 * vtr * itr * pff]
    );

    let FASE_KEYS = ['Vr (V)', 'Vs (V)', 'Vt (V)', 'Ir (A)', 'Is (A)', 'It (A)', 'Pr (W)', 'Ps (W)', 'Pt (W)', 'Fr (Hz)', 'Fs (Hz)', 'Ft (Hz)'];
    let faseRows = [...validJson].reverse().filter(row => FASE_KEYS.some(k => p(row[k]) !== 0)).slice(0, 4);

    // Log per-fase (4 latest) — skip baris yang semua nilai per-fase = 0
    let tbody = document.getElementById('logBody');
    tbody.innerHTML = '';
    faseRows.forEach(item => {
      let tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateFormat(item.Timestamp) || '—'}</td>
        <td>${p(item["Vr (V)"]).toFixed(1)}</td>
        <td>${p(item["Ir (A)"]).toFixed(2)}</td>
        <td>${p(item["Pr (W)"]).toFixed(1)}</td>
        <td>${p(item["Fr (Hz)"]).toFixed(2)}</td>
        <td>${p(item["Vs (V)"]).toFixed(1)}</td>
        <td>${p(item["Is (A)"]).toFixed(2)}</td>
        <td>${p(item["Ps (W)"]).toFixed(1)}</td>
        <td>${p(item["Fs (Hz)"]).toFixed(2)}</td>
        <td>${p(item["Vt (V)"]).toFixed(1)}</td>
        <td>${p(item["It (A)"]).toFixed(2)}</td>
        <td>${p(item["Pt (W)"]).toFixed(1)}</td>
        <td>${p(item["Ft (Hz)"]).toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    const LL_KEYS = ['Vrs (V)', 'Vst (V)', 'Vtr (V)', 'Irs (A)', 'Ist (A)', 'Itr (A)'];
    const llRows = [...validJson].reverse().filter(row => LL_KEYS.some(k => p(row[k]) !== 0)).slice(0, 4);
    const sqrt3 = Math.sqrt(3), pf = 0.85;

    // Log line-to-line (4 terbaru) — skip baris yang semua nilai LL = 0
    const tbodyLL = document.getElementById('logBodyLL');
    tbodyLL.innerHTML = '';
    llRows.forEach(item => {
      const tr = document.createElement('tr');
      const vrs = p(item["Vrs (V)"]), vst = p(item["Vst (V)"]), vtr = p(item["Vtr (V)"]);
      const irs = p(item["Irs (A)"]), ist = p(item["Ist (A)"]), itr = p(item["Itr (A)"]);

      tr.innerHTML = `
        <td>${dateFormat(item.Timestamp) || '—'}</td>
        <td>${vrs.toFixed(1)}</td>
        <td>${irs.toFixed(2)}</td>
        <td>${(sqrt3 * vrs * irs * pf).toFixed(1)}</td>
        <td>${vst.toFixed(1)}</td>
        <td>${ist.toFixed(2)}</td>
        <td>${(sqrt3 * vst * ist * pf).toFixed(1)}</td>
        <td>${vtr.toFixed(1)}</td>
        <td>${itr.toFixed(2)}</td>
        <td>${(sqrt3 * vtr * itr * pf).toFixed(1)}</td>
      `;
      tbodyLL.appendChild(tr);
    });

    document.getElementById('rowCountFase').textContent = validJson.length + ' Data';
    document.getElementById('rowCount').textContent = validJson.length + ' Data';
    setSyncState('live');

    if (autoRefreshOn) {
      autoRefreshTimer = setTimeout(fetchSheets, 5000);
    }

  } catch (e) {
    setSyncState('err');
    showToast('Gagal: ' + e.message);
    // coba lagi jika auto-refresh On
    if (autoRefreshOn) {
      autoRefreshTimer = setTimeout(fetchSheets, 5000);
    }
  }
}

(function initDemo() {
  updateDisplay([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]);
  updateDisplayLL([0, 0, 0], [0, 0, 0], [0, 0, 0]);
})();