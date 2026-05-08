
// ======================
// STATE
// ======================

let chartInstance = null;
let bolletteCache = [];

// ======================
// AUTH
// ======================

async function registerUser() {

  const email = getValue('reg-email');
  const password = getValue('reg-password');

  const { error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) return alert(error.message);

  alert('Registrazione completata');
}

async function loginUser() {

  const email = getValue('log-email');
  const password = getValue('log-password');

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) return alert(error.message);

  await loadApp();
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  location.reload();
}

// ======================
// INIT
// ======================

async function loadApp() {

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) return;

  toggleUI(true);

  setTextSafe('utente-email', user.email);

  await caricaStorico();
}

// ======================
// SAVE BOLLETTA
// ======================

async function salvaBolletta() {

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) return alert("Utente non autenticato");

  const bolletta = buildBolletta(user.id);

  const { error } = await supabaseClient
    .from('bollette')
    .insert([bolletta]);

  if (error) return alert(error.message);

  alert('Bolletta salvata correttamente');

  await caricaStorico();
}

// ======================
// LOAD DATA
// ======================

async function caricaStorico() {

  const { data, error } = await supabaseClient
    .from('bollette')
    .select('*');

  if (error) return alert(error.message);

  bolletteCache = data || [];

  const filtered = applyFilters(bollettaCacheFix(bolletteCache));

  renderStorico(filtered);
  renderDashboard(filtered);
  updateFilterOptions(bolletteCache);
}

// ======================
// FIX CONSISTENZA DATI
// ======================

function bollettaCacheFix(data) {
  return data.map(b => ({
    ...b,
    tariffa_tipo: b.tariffa_tipo || 'NON SPECIFICATO'
  }));
}

// ======================
// FILTERS
// ======================

function applyFilters(data) {

  const anno = getValue('filter-anno');
  const fornitore = getValue('filter-fornitore');
  const tipo = getValue('filter-tipo');

  let result = data;

  if (anno) {
    result = result.filter(b =>
      (b.periodo_al || '').includes(anno)
    );
  }

  if (fornitore) {
    result = result.filter(b =>
      b.fornitore === fornitore
    );
  }

  if (tipo) {
    result = result.filter(b =>
      b.tipo === tipo
    );
  }

  return result;
}

// ======================
// STORICO (ORA MOSTRA TIPO TARIFFA SICURO)
// ======================

function renderStorico(data) {

  const container = document.getElementById('storico');
  if (!container) return;

  container.innerHTML = '';

  data.forEach(b => {

    const div = document.createElement('div');
    div.className = 'item-storico';

    div.innerHTML = `
      <strong>${b.tipo || '-'}</strong><br>
      🧾 Tariffa: <b>${b.tariffa_tipo}</b><br>
      📅 ${b.periodo_dal || ''} → ${b.periodo_al || ''}<br>
      ⚡ € ${format(b.importo)} | ${format(b.consumi)} kWh
    `;

    container.appendChild(div);
  });
}

// ======================
// DASHBOARD
// ======================

function renderDashboard(data) {

  if (!data || data.length === 0) {
    resetKPI();
    renderAlerts([]);
    return;
  }

  const selectedMonth = getValue('kpi-mese');

  const grouped = groupByMonth(data);
  const months = Object.keys(grouped).sort();

  if (months.length < 2) return;

  let currentKey = months[months.length - 1];
  let prevKey = months[months.length - 2];

  if (selectedMonth && grouped[selectedMonth]) {
    currentKey = selectedMonth;
    const idx = months.indexOf(selectedMonth);
    prevKey = months[idx - 1] || months[idx];
  }

  const curr = grouped[currentKey] || [];
  const prev = grouped[prevKey] || [];

  const statsCurr = calculateStats(curr);
  const statsPrev = calculateStats(prev);

  setKPI('kpi-spesa', 'Spesa', statsCurr.totaleSpesa, statsPrev.totaleSpesa, currentKey);
  setKPI('kpi-consumi', 'Consumi', statsCurr.totaleConsumi, statsPrev.totaleConsumi, currentKey);
  setKPI('kpi-media', 'Costo medio', statsCurr.mediaKwh, statsPrev.mediaKwh, currentKey);
  setKPI('kpi-tariffa', 'Tariffa €/kWh-Smc', statsCurr.tariffaMedia, statsPrev.tariffaMedia, currentKey);

  const alerts = generateAlerts(statsCurr, statsPrev, curr, prev);
  renderAlerts(alerts);

  renderChartMonthly(grouped);
}

// ======================
// ALERT ENGINE
// ======================

function generateAlerts(curr, prev, currData, prevData) {

  const alerts = [];

  const spesaVar = percent(curr.totaleSpesa, prev.totaleSpesa);
  const consVar = percent(curr.totaleConsumi, prev.totaleConsumi);
  const tariffaVar = percent(curr.tariffaMedia, prev.tariffaMedia);

  if (spesaVar > 10) {
    alerts.push({
      type: 'danger',
      title: 'Aumento spesa',
      message: `Spesa +${spesaVar.toFixed(1)}% vs mese precedente`
    });
  }

  if (consVar > 15) {
    alerts.push({
      type: 'warning',
      title: 'Consumi in aumento',
      message: `Consumi +${consVar.toFixed(1)}%`
    });
  }

  if (tariffaVar > 5) {
    alerts.push({
      type: 'danger',
      title: 'Tariffa in aumento',
      message: `Tariffa +${tariffaVar.toFixed(1)}%`
    });
  }

  const indic = currData.filter(b => b.tariffa_tipo === 'INDICIZZATA').length;
  if (currData.length && indic / currData.length > 0.6) {
    alerts.push({
      type: 'warning',
      title: 'Rischio volatilità',
      message: 'Oltre 60% contratti indicizzati'
    });
  }

  return alerts;
}

function percent(a, b) {
  a = Number(a || 0);
  b = Number(b || 0);
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

// ======================
// KPI ENGINE
// ======================

function setKPI(id, label, current, previous, period) {

  const el = document.getElementById(id);
  if (!el) return;

  const curr = Number(current);
  const prev = Number(previous || 0);

  const varPct = percent(curr, prev);

  const icon = varPct > 0 ? '↑' : varPct < 0 ? '↓' : '→';

  el.innerHTML = `
    <div style="font-size:12px;color:#666">${label} - ${period}</div>
    <div style="font-size:22px;font-weight:bold">${curr.toFixed(4)}</div>
    <div style="font-size:12px;color:${varPct > 10 ? 'red' : varPct < -10 ? 'green' : 'orange'}">
      ${icon} ${varPct.toFixed(1)}%
    </div>
  `;
}

// ======================
// STATS
// ======================

function calculateStats(data) {

  let spesa = 0;
  let cons = 0;
  let t = 0;
  let c = 0;

  data.forEach(b => {
    spesa += Number(b.importo || 0);
    cons += Number(b.consumi || 0);

    if (b.tariffa) {
      t += Number(b.tariffa);
      c++;
    }
  });

  return {
    totaleSpesa: spesa.toFixed(2),
    totaleConsumi: cons.toFixed(0),
    mediaKwh: (spesa / (cons || 1)).toFixed(3),
    tariffaMedia: (c ? t / c : 0).toFixed(4)
  };
}

// ======================
// ALERT UI
// ======================

function renderAlerts(alerts) {

  const el = document.getElementById('alerts');
  if (!el) return;

  if (!alerts.length) {
    el.innerHTML = `<div class="alert ok">Nessuna anomalia rilevata</div>`;
    return;
  }

  el.innerHTML = alerts.map(a =>
    `<div class="alert ${a.type}">
      <b>${a.title}</b><br>${a.message}
    </div>`
  ).join('');
}

// ======================
// HELPERS
// ======================

function getValue(id) {
  return document.getElementById(id)?.value || '';
}

function setTextSafe(id, v) {
  const el = document.getElementById(id);
  if (el) el.innerText = v;
}

function format(v) {
  return Number(v || 0).toFixed(2);
}

function toggleUI(on) {
  document.getElementById('auth-box').style.display = on ? 'none' : 'block';
  document.getElementById('app').style.display = on ? 'block' : 'none';
}

function resetKPI() {
  setTextSafe('kpi-spesa', '0');
  setTextSafe('kpi-consumi', '0');
  setTextSafe('kpi-media', '0');
  setTextSafe('kpi-tariffa', '0');
}
