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

    periodo_dal:
      document.getElementById('periodo_dal').value,

    periodo_al:
      document.getElementById('periodo_al').value,

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

    fornitore:
      document.getElementById('fornitore').value,

    mercato:
      document.getElementById('mercato').value,

    pod_pdr:
      document.getElementById('pod_pdr').value,

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

  alert('Bolletta salvata correttamente');

  caricaStorico();
}
