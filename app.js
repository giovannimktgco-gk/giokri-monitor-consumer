async function registerUser(){

  const email =
    document.getElementById('reg-email').value;

  const password =
    document.getElementById('reg-password').value;

  const { error } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if(error){
    alert(error.message);
    return;
  }

  alert('Registrazione completata');
}

async function loginUser(){

  const email =
    document.getElementById('log-email').value;

  const password =
    document.getElementById('log-password').value;

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if(error){
    alert(error.message);
    return;
  }

  loadApp();
}

async function logoutUser(){
  await supabaseClient.auth.signOut();
  location.reload();
}

async function loadApp(){

  const {
    data:{user}
  } = await supabaseClient.auth.getUser();

  if(!user) return;

  document.getElementById('auth-box').style.display='none';
  document.getElementById('app').style.display='block';

  document.getElementById('utente-email').innerText =
    user.email;

  caricaStorico();
}

async function salvaBolletta(){

  const {
    data:{user}
  } = await supabaseClient.auth.getUser();

  const bolletta = {

    user_id:user.id,

    tipo:
      document.getElementById('tipo').value,

    mese:
      document.getElementById('mese').value,

    consumi:
      parseFloat(
        document.getElementById('consumi').value
      ),

    importo:
      parseFloat(
        document.getElementById('importo').value
      ),

    tariffa:
      parseFloat(
        document.getElementById('tariffa').value
      ) || null,

    quota:
      parseFloat(
        document.getElementById('quota').value
      ) || null,

    note:
      document.getElementById('note').value
  };

  const { error } =
    await supabaseClient
      .from('bollette')
      .insert([bolletta]);

  if(error){
    alert(error.message);
    return;
  }

  alert('Bolletta salvata');

  caricaStorico();
}

async function caricaStorico(){

  const {
    data:{user}
  } = await supabaseClient.auth.getUser();

  const { data,error } =
    await supabaseClient
      .from('bollette')
      .select('*')
      .eq('user_id',user.id)
      .order('mese',{ascending:false});

  if(error){
    console.log(error);
    return;
  }

  const storico =
    document.getElementById('storico');

  storico.innerHTML='';

  data.forEach(b=>{

    storico.innerHTML += `
      <div class="card">

        <h3>${b.tipo}</h3>

        <p>${b.mese}</p>

        <p>
        Consumi:
        ${b.consumi}
        </p>

        <p>
        Importo:
        € ${b.importo}
        </p>

      </div>
    `;
  });
}

window.addEventListener('load', async ()=>{

  const {
    data:{session}
  } = await supabaseClient.auth.getSession();

  if(session){
    loadApp();
  }
});
