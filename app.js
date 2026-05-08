<!-- ====================== -->
<!-- GIOKRI MONITOR -->
<!-- INDEX.HTML COMPLETO -->
<!-- ====================== -->

<!DOCTYPE html>

<html lang="it">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    GiOKri Monitor
  </title>

  <!-- SUPABASE -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>

  <!-- CHART -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>

    body{
      font-family:Arial;
      background:#f4f6f9;
      margin:0;
      padding:20px;
    }

    h1,h2,h3{
      margin-top:0;
    }

    .box{
      background:#fff;
      padding:20px;
      border-radius:10px;
      margin-bottom:20px;
      box-shadow:0 2px 8px rgba(0,0,0,0.1);
    }

    input,
    select,
    textarea,
    button{
      width:100%;
      padding:10px;
      margin-top:8px;
      margin-bottom:15px;
      border:1px solid #ccc;
      border-radius:6px;
      box-sizing:border-box;
    }

    button{
      background:#1d4ed8;
      color:white;
      border:none;
      cursor:pointer;
      font-weight:bold;
    }

    button:hover{
      opacity:0.9;
    }

    .dashboard-kpi{
      display:grid;
      grid-template-columns:
        repeat(auto-fit,minmax(220px,1fr));
      gap:15px;
      margin-bottom:20px;
    }

    .kpi-card{
      background:white;
      border-radius:10px;
      padding:15px;
      box-shadow:0 2px 8px rgba(0,0,0,0.1);
    }

    .item-storico{
      background:#fff;
      padding:15px;
      border-radius:8px;
      margin-bottom:10px;
      border-left:5px solid #1d4ed8;
    }

    .alert{
      padding:15px;
      border-radius:8px;
      margin-bottom:10px;
      color:white;
    }

    .danger{
      background:#dc2626;
    }

    .warning{
      background:#f59e0b;
    }

    .ok{
      background:#16a34a;
    }

  </style>

</head>

<body>

  <!-- ====================== -->
  <!-- LOGIN -->
  <!-- ====================== -->

  <div
    id="auth-box"
    class="box"
  >

    <h2>
      Login
    </h2>

    <input
      id="log-email"
      type="email"
      placeholder="Email"
    >

    <input
      id="log-password"
      type="password"
      placeholder="Password"
    >

    <button onclick="loginUser()">
      Accedi
    </button>

    <hr>

    <h3>
      Registrazione
    </h3>

    <input
      id="reg-email"
      type="email"
      placeholder="Email"
    >

    <input
      id="reg-password"
      type="password"
      placeholder="Password"
    >

    <button onclick="registerUser()">
      Registrati
    </button>

  </div>

  <!-- ====================== -->
  <!-- APP -->
  <!-- ====================== -->

  <div
    id="app"
    style="display:none;"
  >

    <!-- ====================== -->
    <!-- HEADER -->
    <!-- ====================== -->

    <div class="box">

      <h1>
        GiOKri Monitor
      </h1>

      <p>
        Utente:
        <span id="utente-email"></span>
      </p>

      <button onclick="logoutUser()">
        Logout
      </button>

    </div>

    <!-- ====================== -->
    <!-- FILTRI -->
    <!-- ====================== -->

    <div class="box">

      <h2>
        Filtri
      </h2>

      <select
        id="filter-anno"
        onchange="caricaStorico()"
      >
        <option value="">
          Tutti gli anni
        </option>
      </select>

      <select
        id="filter-fornitore"
        onchange="caricaStorico()"
      >
        <option value="">
          Tutti i fornitori
        </option>
      </select>

      <select
        id="filter-tipo"
        onchange="caricaStorico()"
      >
        <option value="">
          Tutti i tipi
        </option>

        <option value="LUCE">
          LUCE
        </option>

        <option value="GAS">
          GAS
        </option>
      </select>

    </div>

    <!-- ====================== -->
    <!-- KPI -->
    <!-- ====================== -->

    <div class="dashboard-kpi">

      <div class="kpi-card">
        <div id="kpi-spesa"></div>
      </div>

      <div class="kpi-card">
        <div id="kpi-consumi"></div>
      </div>

      <div class="kpi-card">
        <div id="kpi-media"></div>
      </div>

      <!-- 🔥 KPI TARIFFA -->
      <div class="kpi-card">
        <div id="kpi-tariffa"></div>
      </div>

    </div>

    <!-- ====================== -->
    <!-- ALERT -->
    <!-- ====================== -->

    <div
      id="alerts"
      class="box"
    ></div>

    <!-- ====================== -->
    <!-- GRAFICO -->
    <!-- ====================== -->

    <div class="box">

      <h2>
        Andamento Spesa
      </h2>

      <canvas id="graficoSpesa"></canvas>

    </div>

    <!-- ====================== -->
    <!-- FORM BOLLETTA -->
    <!-- ====================== -->

    <div class="box">

      <h2>
        Inserisci Bolletta
      </h2>

      <select id="tipo">

        <option value="LUCE">
          LUCE
        </option>

        <option value="GAS">
          GAS
        </option>

      </select>

      <label>
        Periodo Dal
      </label>

      <input
        type="date"
        id="periodo_dal"
      >

      <label>
        Periodo Al
      </label>

      <input
        type="date"
        id="periodo_al"
      >

      <label>
        Consumi
      </label>

      <input
        type="number"
        id="consumi"
      >

      <label>
        Importo €
      </label>

      <input
        type="number"
        step="0.01"
        id="importo"
      >

      <label>
        Tariffa €/kWh o Smc
      </label>

      <input
        type="number"
        step="0.0001"
        id="tariffa"
      >

      <!-- 🔥 TARIFFA TIPO -->

      <label>
        Tipo Tariffa
      </label>

      <select id="tariffa_tipo">

        <option value="">
          Seleziona
        </option>

        <option value="FISSA">
          Fissa
        </option>

        <option value="INDICIZZATA">
          Indicizzata
        </option>

      </select>

      <label>
        Quota Fissa €
      </label>

      <input
        type="number"
        step="0.01"
        id="quota"
      >

      <label>
        Fornitore
      </label>

      <input
        type="text"
        id="fornitore"
      >

      <label>
        Mercato
      </label>

      <select id="mercato">

        <option value="LIBERO">
          Libero
        </option>

        <option value="TUTELATO">
          Tutelato
        </option>

      </select>

      <label>
        POD / PDR
      </label>

      <input
        type="text"
        id="pod_pdr"
      >

      <label>
        Note
      </label>

      <textarea id="note"></textarea>

      <button onclick="salvaBolletta()">
        Salva Bolletta
      </button>

    </div>

    <!-- ====================== -->
    <!-- STORICO -->
    <!-- ====================== -->

    <div class="box">

      <h2>
        Storico Bollette
      </h2>

      <div id="storico"></div>

    </div>

  </div>

  <!-- ====================== -->
  <!-- CONFIG SUPABASE -->
  <!-- ====================== -->

  <script>

    const SUPABASE_URL =
      'INSERISCI_URL';

    const SUPABASE_KEY =
      'INSERISCI_ANON_KEY';

    const supabaseClient =
      supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

  </script>

  <!-- APP JS -->
  <script src="app.js"></script>

</body>

</html>
