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

  handleError(error, 'Registrazione completata');
}

async function loginUser() {

  const email = getValue('log-email');
  const password = getValue('log-password');

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (handleError(error)) return;

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

  document.getElementById('utente-email').innerText = user.email;

  await caricaStorico();
}

// ======================
// SAVE BOLLETTA
// ======================

async function salvaBolletta() {

  const { data: { user } } = await supabaseClient.auth.getUser();

  const bolletta = buildBolletta(user.id);

  const { error } = await supabaseClient
    .from('bollette')
    .insert([bolletta]);

  if (handleError(error, 'Bolletta salvata correttamente')) return;

  await caricaStorico();
}

// ======================
// LOAD + FILTER ENGINE
// ======================

async function caricaStorico() {

  const { data, error } = await supabaseClient
    .from('bollette')
    .select('*');

  if (handleError(error)) return;

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
// RENDER STORICO
// ======================

function renderStorico(data) {

  const storico = document.getElementById('storico');
  storico.innerHTML = '';

  data.forEach(b => {

    const item = document.createElement('div');
    item.className = 'item-storico';

    item.innerHTML = `
      <strong>${b.tipo || '-'}</strong><br>
      ${b.periodo_dal || ''} → ${b.periodo_al || ''}<br>
      💶 € ${format(b.importo)} | ⚡ ${format(b.consumi)} kWh
    `;

    storico.appendChild(item);
  });
}

// ======================
// DASHBOARD (KPI + GRAFICO)
// ======================

function renderDashboard(data) {

  const stats = calculateStats(data);

  setText('kpi-spesa', `€ ${stats.totaleSpesa}`);
  setText('kpi-consumi', stats.totaleConsumi);
  setText('kpi-media', `€ ${stats.mediaKwh}`);

  renderChart(data);
}

// ======================
// CHART
// ======================

function renderChart(data) {

  const labels = data.map(b => b.periodo_al || '');
  const values = data.map(b => b.importo || 0);

  const ctx = document.getElementById('graficoSpesa');

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
// ANALYTICS ENGINE
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
// FILTER OPTIONS AUTO
// ======================

function updateFilterOptions(data) {

  const anni = new Set();
  const fornitori = new Set();

  data.forEach(b => {

    if (b.periodo_al)
      anni.add(b.periodo_al.slice(0, 4));

    if (b.fornitore)
      fornitori.add(b.fornitore);
  });

  fillSelect('filter-anno', anni);
  fillSelect('filter-fornitore', fornitori);
}

function fillSelect(id, values) {

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

function setText(id, value) {
  document.getElementById(id).innerText = value;
}

function format(value) {
  return Number(value || 0).toFixed(2);
}

function toggleUI(isLogged) {
  document.getElementById('auth-box').style.display = isLogged ? 'none' : 'block';
  document.getElementById('app').style.display = isLogged ? 'block' : 'none';
}

function handleError(error, successMsg = null) {
  if (error) {
    alert(error.message);
    return true;
  }
  if (successMsg) alert(successMsg);
  return false;
}
