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

  const emailEl = document.getElementById('utente-email');
  if (emailEl) emailEl.innerText = user.email;

  await caricaStorico();
}

// ======================
// SAVE BOLLETTA
// ======================

async function salvaBolletta() {

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    alert("Utente non autenticato");
    return;
  }

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
// RENDER STORICO
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
// DASHBOARD KPI + CHART
// ======================

function renderDashboard(data) {

  if (!data) data = [];

  const stats = calculateStats(data);

  setTextSafe('kpi-spesa', `€ ${stats.totaleSpesa}`);
  setTextSafe('kpi-consumi', stats.totaleConsumi);
  setTextSafe('kpi-media', `€ ${stats.mediaKwh}`);

  renderChart(data);
}

// ======================
// CHART
// ======================

function renderChart(data) {

  const ctx = document.getElementById('graficoSpesa');
  if (!ctx) return;

  const labels = data.map(b => b.periodo_al || '');
  const values = data.map(b => b.importo || 0);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spesa €',
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
// HELPERS SAFE
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
  const auth = document.getElementById('auth-box');
  const app = document.getElementById('app');

  if (auth) auth.style.display = isLogged ? 'none' : 'block';
  if (app) app.style.display = isLogged ? 'block' : 'none';
}
