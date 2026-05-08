
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
// INIT APP
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

  const filtered = applyFilters(bolletteCache);

  renderStorico(filtered);
  renderDashboard(filtered);
  updateFilterOptions(bolletteCache);
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
// STORICO
// ======================

function renderStorico(data) {

  const container = document.getElementById('storico');
  if (!container) return;

  container.innerHTML = '';

  data.forEach(b => {

    const div = document.createElement('div');
    div.className = 'item-storico';

    div.innerHTML = `
      <strong>${b.tipo || '-'}</strong>
      (${b.tariffa_tipo || 'n/d'})<br>
      ${b.periodo_dal || ''} → ${b.periodo_al || ''}<br>
      € ${format(b.importo)} | ${format(b.consumi)} kWh
    `;

    container.appendChild(div);
  });
}

// ======================
// DASHBOARD CORE
// ======================

function renderDashboard(data) {

  if (!data || data.length === 0) {
    resetKPI();
    return;
  }

  const selectedMonth = getValue('kpi-mese');

  const grouped = groupByMonth(data);
  const months = Object.keys(grouped).sort();

  if (months.length < 2) return;

  let currentKey;
  let prevKey;

  if (selectedMonth && grouped[selectedMonth]) {

    currentKey = selectedMonth;

    const idx = months.indexOf(selectedMonth);
    prevKey = months[idx - 1] || months[idx];

  } else {

    currentKey = months[months.length - 1];
    prevKey = months[months.length - 2];
  }

  const curr = grouped[currentKey] || [];
  const prev = grouped[prevKey] || [];

  const statsCurr = calculateStats(curr);
  const statsPrev = calculateStats(prev);

  setKPI('kpi-spesa', 'Spesa', statsCurr.totaleSpesa, statsPrev.totaleSpesa, currentKey);
  setKPI('kpi-consumi', 'Consumi', statsCurr.totaleConsumi, statsPrev.totaleConsumi, currentKey);
  setKPI('kpi-media', 'Costo medio', statsCurr.mediaKwh, statsPrev.mediaKwh, currentKey);
  setKPI('kpi-tariffa', 'Tariffa €/kWh-Smc', statsCurr.tariffaMedia, statsPrev.tariffaMedia, currentKey);

  renderChartMonthly(grouped);
}

// ======================
// KPI ENGINE
// ======================

function setKPI(id, label, current, previous, period) {

  const el = document.getElementById(id);
  if (!el) return;

  const curr = Number(current);
  const prev = Number(previous || 0);

  const variation = prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  const icon =
    variation > 0 ? '↑' :
    variation < 0 ? '↓' : '→';

  const color =
    variation > 10 ? 'red' :
    variation < -10 ? 'green' : 'orange';

  el.innerHTML = `
    <div style="font-size:12px; color:#666;">
      ${label} - ${period || ''}
    </div>

    <div style="font-size:22px; font-weight:bold;">
      ${curr.toFixed(4)}
    </div>

    <div style="font-size:12px; color:${color}; margin-top:4px;">
      ${icon} ${variation.toFixed(1)}% vs mese precedente
    </div>
  `;
}

// ======================
// GROUP BY MONTH
// ======================

function groupByMonth(data) {

  const groups = {};

  data.forEach(b => {

    const key = (b.periodo_al || '').slice(0, 7);

    if (!groups[key]) groups[key] = [];

    groups[key].push(b);
  });

  return groups;
}

// ======================
// CHART
// ======================

function renderChartMonthly(grouped) {

  const labels = Object.keys(grouped).sort();

  const values = labels.map(m => {
    const stats = calculateStats(grouped[m]);
    return stats.totaleSpesa;
  });

  const ctx = document.getElementById('graficoSpesa');
  if (!ctx) return;

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Spesa mensile €',
        data: values
      }]
    }
  });
}

// ======================
// STATS ENGINE
// ======================

function calculateStats(data) {

  let totaleSpesa = 0;
  let totaleConsumi = 0;
  let tariffaTot = 0;
  let countTariffa = 0;

  data.forEach(b => {

    totaleSpesa += Number(b.importo || 0);
    totaleConsumi += Number(b.consumi || 0);

    if (b.tariffa) {
      tariffaTot += Number(b.tariffa);
      countTariffa++;
    }
  });

  return {
    totaleSpesa: totaleSpesa.toFixed(2),
    totaleConsumi: totaleConsumi.toFixed(0),
    mediaKwh: (totaleSpesa / (totaleConsumi || 1)).toFixed(3),
    tariffaMedia: (countTariffa ? tariffaTot / countTariffa : 0).toFixed(4)
  };
}

// ======================
// FILTER OPTIONS
// ======================

function updateFilterOptions(data) {

  const mesi = new Set();
  const anni = new Set();
  const fornitori = new Set();

  data.forEach(b => {

    if (b.periodo_al) {
      mesi.add(b.periodo_al.slice(0, 7));
      anni.add(b.periodo_al.slice(0, 4));
    }

    if (b.fornitore) fornitori.add(b.fornitore);
  });

  fillSelectOnce('kpi-mese', mesi);
  fillSelectOnce('filter-anno', anni);
  fillSelectOnce('filter-fornitore', fornitori);
}

// ======================
// BUILD OBJECT
// ======================

function buildBolletta(userId) {

  return {
    user_id: userId,
    tipo: getValue('tipo'),
    periodo_dal: getValue('periodo_dal'),
    periodo_al: getValue('periodo_al'),
    consumi: toNumber('consumi'),
    importo: toNumber('importo'),
    tariffa: toNumber('tariffa', true),
    tariffa_tipo: getValue('tariffa_tipo'),
    quota: toNumber('quota', true),
    fornitore: getValue('fornitore'),
    mercato: getValue('mercato'),
    pod_pdr: getValue('pod_pdr'),
    note: getValue('note')
  };
}

// ======================
// HELPERS
// ======================

function getValue(id) {
  return document.getElementById(id)?.value || '';
}

function toNumber(id, nullable = false) {
  const val = parseFloat(document.getElementById(id)?.value);
  return isNaN(val) ? (nullable ? null : 0) : val;
}

function setTextSafe(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function format(v) {
  return Number(v || 0).toFixed(2);
}

function toggleUI(isLogged) {
  document.getElementById('auth-box').style.display = isLogged ? 'none' : 'block';
  document.getElementById('app').style.display = isLogged ? 'block' : 'none';
}

function resetKPI() {
  setTextSafe('kpi-spesa', '0');
  setTextSafe('kpi-consumi', '0');
  setTextSafe('kpi-media', '0');
  setTextSafe('kpi-tariffa', '0');
}
