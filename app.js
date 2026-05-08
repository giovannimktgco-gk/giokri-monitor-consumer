// ======================
// GIOKRI MONITOR
// VERSIONE COMPLETA
// ======================

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

  const { error } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if (error) {
    alert(error.message);
    return;
  }

  alert('Registrazione completata');
}

async function loginUser() {

  const email = getValue('log-email');
  const password = getValue('log-password');

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    alert(error.message);
    return;
  }

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

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) return;

  toggleUI(true);

  setTextSafe(
    'utente-email',
    user.email
  );

  await caricaStorico();
}

// ======================
// SAVE BOLLETTA
// ======================

async function salvaBolletta() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    alert('Utente non autenticato');
    return;
  }

  const bolletta =
    buildBolletta(user.id);

  const { error } =
    await supabaseClient
      .from('bollette')
      .insert([bolletta]);

  if (error) {
    alert(error.message);
    return;
  }

  alert('Bolletta salvata correttamente');

  await caricaStorico();
}

// ======================
// BUILD OBJECT
// ======================

function buildBolletta(userId) {

  return {

    user_id: userId,

    tipo:
      getValue('tipo'),

    periodo_dal:
      getValue('periodo_dal'),

    periodo_al:
      getValue('periodo_al'),

    consumi:
      parseFloat(
        getValue('consumi')
      ) || 0,

    importo:
      parseFloat(
        getValue('importo')
      ) || 0,

    tariffa:
      parseFloat(
        getValue('tariffa')
      ) || 0,

    // 🔥 FISSA / INDICIZZATA
    tariffa_tipo:
      getValue('tariffa_tipo'),

    quota:
      parseFloat(
        getValue('quota')
      ) || 0,

    fornitore:
      getValue('fornitore'),

    mercato:
      getValue('mercato'),

    pod_pdr:
      getValue('pod_pdr'),

    note:
      getValue('note')
  };
}

// ======================
// LOAD DATA
// ======================

async function caricaStorico() {

  const { data, error } =
    await supabaseClient
      .from('bollette')
      .select('*')
      .order('periodo_al', {
        ascending: true
      });

  if (error) {
    alert(error.message);
    return;
  }

  bolletteCache =
    normalizeData(data || []);

  const filtered =
    applyFilters(bolletteCache);

  renderStorico(filtered);

  renderDashboard(filtered);

  updateFilterOptions(
    bolletteCache
  );
}

// ======================
// NORMALIZE
// ======================

function normalizeData(data) {

  return data.map(b => ({

    ...b,

    tariffa_tipo:
      b.tariffa_tipo ||
      'NON SPECIFICATO'
  }));
}

// ======================
// FILTERS
// ======================

function applyFilters(data) {

  const anno =
    getValue('filter-anno');

  const fornitore =
    getValue('filter-fornitore');

  const tipo =
    getValue('filter-tipo');

  let result = [...data];

  if (anno) {

    result =
      result.filter(b =>
        (b.periodo_al || '')
          .includes(anno)
      );
  }

  if (fornitore) {

    result =
      result.filter(b =>
        b.fornitore ===
        fornitore
      );
  }

  if (tipo) {

    result =
      result.filter(b =>
        b.tipo === tipo
      );
  }

  return result;
}

// ======================
// STORICO
// ======================

function renderStorico(data) {

  const container =
    document.getElementById(
      'storico'
    );

  if (!container) return;

  container.innerHTML = '';

  data.forEach(b => {

    const div =
      document.createElement('div');

    div.className =
      'item-storico';

    div.innerHTML = `

      <strong>
        ${b.tipo || '-'}
      </strong>

      <br>

      🧾 Tariffa:
      <b>
        ${b.tariffa_tipo}
      </b>

      <br>

      📅
      ${b.periodo_dal || ''}
      →
      ${b.periodo_al || ''}

      <br>

      ⚡
      € ${format(b.importo)}
      |
      ${format(b.consumi)}
      kWh

      <br>

      💡 €/kWh:
      ${format4(b.tariffa)}

    `;

    container.appendChild(div);
  });
}

// ======================
// DASHBOARD
// ======================

function renderDashboard(data) {

  if (!data.length) {

    resetKPI();

    renderAlerts([]);

    return;
  }

  const grouped =
    groupByMonth(data);

  const months =
    Object.keys(grouped).sort();

  if (months.length < 1)
    return;

  const currentKey =
    months[months.length - 1];

  const prevKey =
    months[months.length - 2]
    || currentKey;

  const curr =
    grouped[currentKey] || [];

  const prev =
    grouped[prevKey] || [];

  const statsCurr =
    calculateStats(curr);

  const statsPrev =
    calculateStats(prev);

  // ======================
  // KPI
  // ======================

  setKPI(
    'kpi-spesa',
    'Spesa',
    statsCurr.totaleSpesa,
    statsPrev.totaleSpesa,
    currentKey,
    '€'
  );

  setKPI(
    'kpi-consumi',
    'Consumi',
    statsCurr.totaleConsumi,
    statsPrev.totaleConsumi,
    currentKey,
    'kWh'
  );

  setKPI(
    'kpi-media',
    'Costo medio',
    statsCurr.mediaKwh,
    statsPrev.mediaKwh,
    currentKey,
    '€/kWh'
  );

  // 🔥 KPI TARIFFA
  setKPI(
    'kpi-tariffa',
    'Tariffa media',
    statsCurr.tariffaMedia,
    statsPrev.tariffaMedia,
    currentKey,
    '€/kWh'
  );

  // ======================
  // ALERT
  // ======================

  const alerts =
    generateAlerts(
      statsCurr,
      statsPrev,
      curr
    );

  renderAlerts(alerts);

  // ======================
  // CHART
  // ======================

  renderChartMonthly(
    grouped
  );
}

// ======================
// KPI ENGINE
// ======================

function setKPI(
  id,
  label,
  current,
  previous,
  period,
  suffix = ''
) {

  const el =
    document.getElementById(id);

  if (!el) return;

  const curr =
    Number(current || 0);

  const prev =
    Number(previous || 0);

  const variation =
    percent(curr, prev);

  const icon =
    variation > 0
      ? '↑'
      : variation < 0
      ? '↓'
      : '→';

  const color =
    variation > 10
      ? 'red'
      : variation < -10
      ? 'green'
      : 'orange';

  el.innerHTML = `

    <div
      style="
        font-size:12px;
        color:#666;
      "
    >
      ${label}
      <br>
      ${period}
    </div>

    <div
      style="
        font-size:24px;
        font-weight:bold;
      "
    >
      ${curr.toFixed(4)}
      ${suffix}
    </div>

    <div
      style="
        font-size:12px;
        color:${color};
      "
    >
      ${icon}
      ${variation.toFixed(1)}%
      vs mese precedente
    </div>

  `;
}

// ======================
// ALERT ENGINE
// ======================

function generateAlerts(
  curr,
  prev,
  currData
) {

  const alerts = [];

  const spesaVar =
    percent(
      curr.totaleSpesa,
      prev.totaleSpesa
    );

  const tariffaVar =
    percent(
      curr.tariffaMedia,
      prev.tariffaMedia
    );

  if (spesaVar > 10) {

    alerts.push({

      type: 'danger',

      title:
        'Aumento spesa',

      message:
        `Spesa aumentata del ${spesaVar.toFixed(1)}%`
    });
  }

  if (tariffaVar > 5) {

    alerts.push({

      type: 'warning',

      title:
        'Tariffa peggiorata',

      message:
        `Tariffa aumentata del ${tariffaVar.toFixed(1)}%`
    });
  }

  const indicizzate =
    currData.filter(
      b =>
        b.tariffa_tipo ===
        'INDICIZZATA'
    ).length;

  if (
    currData.length &&
    indicizzate /
      currData.length > 0.6
  ) {

    alerts.push({

      type: 'warning',

      title:
        'Alta esposizione indicizzata',

      message:
        'Più del 60% delle bollette è indicizzato'
    });
  }

  return alerts;
}

// ======================
// ALERT UI
// ======================

function renderAlerts(alerts) {

  const el =
    document.getElementById(
      'alerts'
    );

  if (!el) return;

  if (!alerts.length) {

    el.innerHTML = `
      <div class="alert ok">
        Nessuna anomalia rilevata
      </div>
    `;

    return;
  }

  el.innerHTML =
    alerts.map(a => `

      <div class="alert ${a.type}">

        <strong>
          ${a.title}
        </strong>

        <br>

        ${a.message}

      </div>

    `).join('');
}

// ======================
// GROUP BY MONTH
// ======================

function groupByMonth(data) {

  const groups = {};

  data.forEach(b => {

    const key =
      (b.periodo_al || '')
        .slice(0, 7);

    if (!groups[key]) {

      groups[key] = [];
    }

    groups[key].push(b);
  });

  return groups;
}

// ======================
// STATS
// ======================

function calculateStats(data) {

  let spesa = 0;
  let consumi = 0;
  let tariffaTot = 0;
  let tariffaCount = 0;

  data.forEach(b => {

    spesa +=
      Number(b.importo || 0);

    consumi +=
      Number(b.consumi || 0);

    if (b.tariffa) {

      tariffaTot +=
        Number(b.tariffa);

      tariffaCount++;
    }
  });

  return {

    totaleSpesa:
      spesa,

    totaleConsumi:
      consumi,

    mediaKwh:
      spesa /
      (consumi || 1),

    tariffaMedia:
      tariffaCount
        ? tariffaTot /
          tariffaCount
        : 0
  };
}

// ======================
// CHART
// ======================

function renderChartMonthly(
  grouped
) {

  const labels =
    Object.keys(grouped).sort();

  const values =
    labels.map(m => {

      const stats =
        calculateStats(
          grouped[m]
        );

      return stats.totaleSpesa;
    });

  const ctx =
    document.getElementById(
      'graficoSpesa'
    );

  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance =
    new Chart(ctx, {

      type: 'line',

      data: {

        labels,

        datasets: [{

          label:
            'Spesa mensile €',

          data: values
        }]
      }
    });
}

// ======================
// FILTER OPTIONS
// ======================

function updateFilterOptions(
  data
) {

  fillSelect(
    'filter-anno',

    [...new Set(
      data.map(
        b =>
          (b.periodo_al || '')
            .slice(0, 4)
      )
    )]
  );

  fillSelect(
    'filter-fornitore',

    [...new Set(
      data
        .map(
          b => b.fornitore
        )
        .filter(Boolean)
    )]
  );
}

// ======================
// FILL SELECT
// ======================

function fillSelect(
  id,
  values
) {

  const el =
    document.getElementById(id);

  if (!el) return;

  const current =
    el.value;

  el.innerHTML =
    '<option value="">Tutti</option>';

  values.forEach(v => {

    const opt =
      document.createElement(
        'option'
      );

    opt.value = v;
    opt.textContent = v;

    el.appendChild(opt);
  });

  el.value = current;
}

// ======================
// HELPERS
// ======================

function percent(a, b) {

  a = Number(a || 0);
  b = Number(b || 0);

  if (b === 0) return 0;

  return ((a - b) / b) * 100;
}

function getValue(id) {

  return document
    .getElementById(id)
    ?.value || '';
}

function setTextSafe(
  id,
  value
) {

  const el =
    document.getElementById(id);

  if (el) {
    el.innerText = value;
  }
}

function format(v) {

  return Number(v || 0)
    .toFixed(2);
}

function format4(v) {

  return Number(v || 0)
    .toFixed(4);
}

function toggleUI(isLogged) {

  document.getElementById(
    'auth-box'
  ).style.display =
    isLogged
      ? 'none'
      : 'block';

  document.getElementById(
    'app'
  ).style.display =
    isLogged
      ? 'block'
      : 'none';
}

function resetKPI() {

  setTextSafe(
    'kpi-spesa',
    '0'
  );

  setTextSafe(
    'kpi-consumi',
    '0'
  );

  setTextSafe(
    'kpi-media',
    '0'
  );

  setTextSafe(
    'kpi-tariffa',
    '0'
  );
}
