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
// SAVE
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
// FILTER ENGINE
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
      <strong>${b.tipo || '-'}</strong><br>
      ${b.periodo_dal || ''} → ${b.periodo_al || ''}<br>
      € ${format(b.importo)} | ${format(b.consumi)} kWh
    `;

    container.appendChild(div);
  });
}

// ======================
// DASHBOARD (CORE INTELLIGENCE)
// ======================

function renderDashboard(data) {

  if (!data || data.length === 0) {
    resetKPI();
    return;
  }

  // =========================
  // GROUP BY MONTH (REAL)
  // =========================

  const grouped = groupByMonth(data);

  const months = Object.keys(grouped).sort();

  if (months.length < 2) {
    renderBasicKPI(data);
    return;
  }

  const lastMonth = grouped[months[months.length - 1]];
  const prevMonth = grouped[months[months.length - 2]];

  const statsCurr = calculateStats(lastMonth);
  const statsPrev = calculateStats(prevMonth);

  // =========================
  // KPI EVOLUTION
  // =========================

  setKPI('kpi-spesa', statsCurr.totaleSpesa, statsPrev.totaleSpesa, '€');
  setKPI('kpi-consumi', statsCurr.totaleConsumi, statsPrev.totaleConsumi, '');
  setKPI('kpi-media', statsCurr.mediaKwh, statsPrev.mediaKwh, '€');

  // =========================
  // ALERT LOGIC
  // =========================

  generateAlerts(statsCurr, statsPrev);

  renderChart(data);
}

// ======================
// GROUP BY MONTH ENGINE
// ======================

function groupByMonth(data) {

  const groups = {};

  data.forEach(b => {

    const key = (b.periodo_al || '').slice(0, 7); // YYYY-MM

    if (!groups[key]) groups[key] = [];

    groups[key].push(b);
  });

  return groups;
}

// ======================
// KPI ENGINE
// ======================

function setKPI(id, current, previous, prefix = '') {

  const el = document.getElementById(id);
  if (!el) return;

  const curr = Number(current);
  const prev = Number(previous || 0);

  let variation = prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  const icon =
    variation > 0 ? '↑' :
    variation < 0 ? '↓' : '→';

  const color =
    variation > 10 ? 'red' :
    variation < -10 ? 'green' : 'orange';

  el.innerHTML = `
    <div style="font-size:22px; font-weight:bold;">
      ${prefix} ${curr.toFixed(2)}
    </div>
    <div style="font-size:12px; color:${color}; margin-top:4px;">
      ${icon} ${variation.toFixed(1)}% vs mese precedente
    </div>
  `;
}

// ======================
// ALERT ENGINE
// ======================

function generateAlerts(curr, prev) {

  const spesaDiff = ((curr.totaleSpesa - prev.totaleSpesa) / (prev.totaleSpesa || 1)) * 100;

  if (spesaDiff > 15) {
    console.warn("⚠ ALERT: aumento spesa significativo");
    showAlert("⚠ ATTENZIONE: aumento spesa > 15%");
  }
}

function showAlert(msg) {

  let box = document.getElementById('alert-box');

  if (!box) {
    box = document.createElement('div');
    box.id = 'alert-box';
    box.style.padding = '10px';
    box.style.background = '#ffdddd';
    box.style.color = '#900';
    document.getElementById('app').prepend(box);
  }

  box.innerText = msg;
}

// ======================
// CHART
// ======================

function renderChart(data) {

  const ctx = document.getElementById('graficoSpesa');
  if (!ctx) return;

  const grouped = groupByMonth(data);

  const labels = Object.keys(grouped).sort();

  const values = labels.map(m => {

    const stats = calculateStats(grouped[m]);
    return stats.totaleSpesa;
  });

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
// STATS
// ======================

function calculateStats(data) {

  let totaleSpesa = 0;
  let totaleConsumi = 0;

  data.forEach(b => {
    totaleSpesa += Number(b.importo || 0);
    totaleConsumi += Number(b.consumi || 0);
  });

  return {
    totaleSpesa: totaleSpesa.toFixed(2),
    totaleConsumi: totaleConsumi.toFixed(0),
    mediaKwh: (totaleSpesa / (totaleConsumi || 1)).toFixed(3)
  };
}

// ======================
// FILTER OPTIONS
// ======================

function updateFilterOptions(data) {

  const anni = new Set();
  const fornitori = new Set();

  data.forEach(b => {
    if (b.periodo_al) anni.add(b.periodo_al.slice(0, 4));
    if (b.fornitore) fornitori.add(b.fornitore);
  });

  fillSelectOnce('filter-anno', anni);
  fillSelectOnce('filter-fornitore', fornitori);
}

function fillSelectOnce(id, values) {

  const select = document.getElementById(id);
  if (!select) return;

  if (select.options.length > 1) return;

  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.innerText = v;
    select.appendChild(opt);
  });
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
  setTextSafe('kpi-spesa', '€ 0.00');
  setTextSafe('kpi-consumi', '0');
  setTextSafe('kpi-media', '€ 0.000');
}
