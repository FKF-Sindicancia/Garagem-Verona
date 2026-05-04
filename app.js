import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc, onSnapshot,
  query, orderBy, getDocs, setDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAg-NL6ECEgLatPvISBk5d67bMYEMnBv1o",
  authDomain: "garagem-verona.firebaseapp.com",
  projectId: "garagem-verona",
  storageBucket: "garagem-verona.firebasestorage.app",
  messagingSenderId: "630913810844",
  appId: "1:630913810844:web:d0346360944c6a9aa08859"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let registros = [];
let placasCad = [];
let marcaSel = '';
let corSel = '';
let filtroAtual = 'todos';
let buscaAtual = '';
let unsubRegistros = null;
let usuarioLogado = null;
let userRole = null;
let placaEditando = null;

function normalizarRole(role) {
  return (role || '').toString().trim().toLowerCase();
}
function normalizarPlaca(placa) {
  return (placa || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function isAdmin() { return userRole === 'admin'; }
function isPortaria() { return userRole === 'portaria'; }
function isViewOnly() { return userRole === 'viewer' || userRole === 'view only'; }
function canWrite() { return isAdmin() || isPortaria(); }
function canSeeMultaEnviada() { return isAdmin() || isViewOnly(); }
function shouldShowMultaOption(registro) {
  return canSeeMultaEnviada() && calcMins(registro.entrada, registro.saida) > 30;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' · ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 30000);
updateClock();

function aplicarPermissoesUI() {
  const entradaTab = document.querySelector('[data-tab-button="entrada"]');
  const btnRegistrar = document.getElementById('btn-registrar');
  const importCard = document.getElementById('import-card');

  if (isViewOnly()) {
    if (entradaTab) entradaTab.style.display = 'none';
    if (btnRegistrar) btnRegistrar.style.display = 'none';
    if (importCard) importCard.style.display = 'none';
    switchTab('dashboard');
  } else {
    if (entradaTab) entradaTab.style.display = '';
    if (btnRegistrar) btnRegistrar.style.display = '';
    if (importCard) importCard.style.display = '';
  }
}

onAuthStateChanged(auth, async (user) => {
  usuarioLogado = user;

  if (user) {
    try {
      const perfilSnap = await getDoc(doc(db, 'usuarios', user.email));
      if (!perfilSnap.exists()) throw new Error('Usuário sem perfil na coleção usuarios.');
      userRole = normalizarRole(perfilSnap.data().role);

      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('user-email').textContent = `${user.email || ''} · ${userRole}`;
      aplicarPermissoesUI();
      toast('Login realizado!');
      await carregarPlacas();
      iniciarListener();
    } catch (e) {
      console.error(e);
      document.getElementById('login-erro').textContent = e.message || 'Erro ao carregar permissões.';
      await signOut(auth);
    }
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('user-email').textContent = '';
    registros = [];
    placasCad = [];
    userRole = null;
    placaEditando = null;
    if (unsubRegistros) {
      unsubRegistros();
      unsubRegistros = null;
    }
    document.getElementById('tabela-body').innerHTML = '<tr><td colspan="9" class="loading">Faça login para carregar registros...</td></tr>';
    document.getElementById('placas-body').innerHTML = '<tr><td colspan="8" class="loading">Faça login para carregar placas...</td></tr>';
  }
});

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erro = document.getElementById('login-erro');
  const btn = document.getElementById('btn-login');

  erro.textContent = '';
  if (!email || !senha) {
    erro.textContent = 'Informe e-mail e senha.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    document.getElementById('login-senha').value = '';
  } catch (e) {
    erro.textContent = 'Login inválido ou usuário sem permissão.';
    console.error(e);
  }
  btn.disabled = false;
  btn.textContent = 'Entrar';
}

async function sair() {
  try {
    await signOut(auth);
    toast('Você saiu do sistema.');
  } catch (e) {
    toast('Erro ao sair.');
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    fazerLogin();
  }
});

function switchTab(t) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tabButton === t));
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  if (!usuarioLogado) return;
  if (t === 'dashboard') iniciarListener();
  if (t === 'placas') carregarPlacas();
}

function iniciarListener() {
  if (!usuarioLogado || unsubRegistros) return;
  const q = query(collection(db, 'registros'), orderBy('entrada', 'desc'));
  unsubRegistros = onSnapshot(q, (snap) => {
    registros = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      entrada: d.data().entrada?.toDate(),
      saida: d.data().saida?.toDate() || null
    }));
    renderTabela();
  }, (error) => {
    console.error(error);
    toast('Sem permissão para carregar registros.');
  });
}

async function carregarPlacas() {
  if (!usuarioLogado) return;
  try {
    const snap = await getDocs(collection(db, 'placas'));
    placasCad = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPlacas();
  } catch (e) {
    console.error(e);
    toast('Sem permissão para carregar placas.');
  }
}

function checkPlaca(el) {
  const v = normalizarPlaca(el.value);
  const sug = document.getElementById('sugestao-placa');
  const found = placasCad.find((p) => normalizarPlaca(p.placa) === v);

  if (found && v.length >= 4) {
    sug.style.display = 'block';
    sug.textContent = 'Morador: ' + (found.nome || '—') + ' — Apto ' + (found.apto || '—') + ', ' + (found.torre || '—') + (found.marca ? ' — ' + found.marca : '') + (found.cor ? ' / ' + found.cor : '');
    document.getElementById('nome').value = found.nome || '';
    document.getElementById('apto').value = found.apto || '';
    document.getElementById('torre').value = found.torre || '';
    selecionarMarcaVisual(found.marca || '');
    selecionarCorVisual(found.cor || '');
  } else {
    sug.style.display = 'none';
    document.getElementById('nome').value = '';
    document.getElementById('apto').value = '';
    document.getElementById('torre').value = '';
    selecionarMarcaVisual('');
    selecionarCorVisual('');
  }
}

function selecionarMarcaVisual(marca) {
  marcaSel = marca || '';
  document.querySelectorAll('.marca-btn').forEach((b) => b.classList.toggle('sel', b.textContent === marcaSel));
}
function selecionarCorVisual(cor) {
  corSel = cor || '';
  document.querySelectorAll('.cor-opt').forEach((c) => c.classList.toggle('sel', c.dataset.cor === corSel));
  document.getElementById('cor-sel').textContent = corSel ? 'Cor: ' + corSel : '';
}
function selMarca(el) {
  document.querySelectorAll('.marca-btn').forEach((b) => b.classList.remove('sel'));
  el.classList.add('sel');
  marcaSel = el.textContent;
}
function selCor(el) {
  document.querySelectorAll('.cor-opt').forEach((c) => c.classList.remove('sel'));
  el.classList.add('sel');
  corSel = el.dataset.cor;
  document.getElementById('cor-sel').textContent = 'Cor: ' + corSel;
}

async function registrarEntrada() {
  if (!usuarioLogado) { toast('Faça login para registrar.'); return; }
  if (!canWrite()) { toast('Usuário sem permissão para registrar entrada.'); return; }

  const placa = normalizarPlaca(document.getElementById('placa').value.trim());
  if (!placa) { toast('Informe a placa do veículo!'); return; }

  const jaDentro = registros.find((r) => normalizarPlaca(r.placa) === placa && !r.saida);
  if (jaDentro) {
    alert('Este veículo já consta como estando na garagem. Não é possível registrar uma nova entrada para a mesma placa. Por favor, reporte o erro via WhatsApp: 13 99136-9790.');
    const msg = encodeURIComponent('Olá, estou com erro no sistema da garagem. Placa: ' + placa + ' já consta como dentro.');
    window.open('https://wa.me/5513991369790?text=' + msg, '_blank');
    toast('Veículo já está na garagem.');
    return;
  }

  const btn = document.getElementById('btn-registrar');
  btn.disabled = true;
  btn.textContent = 'Registrando...';

  const dados = {
    placa,
    nome: document.getElementById('nome').value.trim(),
    apto: document.getElementById('apto').value.trim(),
    torre: document.getElementById('torre').value.trim(),
    marca: marcaSel,
    cor: corSel,
    obs: document.getElementById('obs').value.trim(),
    entrada: new Date(),
    saida: null,
    criadoPor: usuarioLogado.email || '',
    multaEnviada: false
  };

  try {
    await addDoc(collection(db, 'registros'), dados);
    await atualizarCadastroPlaca(placa, dados);
    limparFormularioEntrada();
    toast('Entrada registrada!');
    switchTab('dashboard');
  } catch (e) {
    toast('Erro ao salvar. Verifique a conexão/permissão.');
    console.error(e);
  }

  btn.disabled = false;
  btn.textContent = 'Registrar entrada';
}

async function atualizarCadastroPlaca(placa, dados) {
  const placaExistente = placasCad.find((p) => normalizarPlaca(p.placa) === placa);
  const cadastroAtualizado = {
    placa,
    nome: dados.nome || placaExistente?.nome || '',
    apto: dados.apto || placaExistente?.apto || '',
    torre: dados.torre || placaExistente?.torre || '',
    marca: dados.marca || placaExistente?.marca || '',
    cor: dados.cor || placaExistente?.cor || '',
    origem: placaExistente?.origem || 'Portaria',
    atualizadoPor: usuarioLogado.email || '',
    atualizadoEm: new Date()
  };
  await setDoc(doc(db, 'placas', placa), cadastroAtualizado);
  const idx = placasCad.findIndex((p) => normalizarPlaca(p.placa) === placa);
  if (idx >= 0) placasCad[idx] = cadastroAtualizado;
  else placasCad.push(cadastroAtualizado);
}

function limparFormularioEntrada() {
  ['placa', 'nome', 'apto', 'torre', 'obs'].forEach((id) => document.getElementById(id).value = '');
  document.getElementById('sugestao-placa').style.display = 'none';
  document.getElementById('cor-sel').textContent = '';
  document.querySelectorAll('.marca-btn').forEach((b) => b.classList.remove('sel'));
  document.querySelectorAll('.cor-opt').forEach((c) => c.classList.remove('sel'));
  marcaSel = '';
  corSel = '';
}

async function registrarSaida(id) {
  if (!usuarioLogado) { toast('Faça login para registrar saída.'); return; }
  if (!canWrite()) { toast('Usuário sem permissão para registrar saída.'); return; }
  try {
    await updateDoc(doc(db, 'registros', id), { saida: new Date(), saidaPor: usuarioLogado.email || '' });
    toast('Saída registrada!');
  } catch (e) {
    toast('Erro ao registrar saída.');
  }
}

async function registrarSaidaManual(id, value) {
  if (!usuarioLogado) { toast('Faça login para registrar saída.'); return; }
  if (!isAdmin()) { toast('Somente admin pode definir horário de saída manual.'); return; }
  if (!value) return;

  const dataSaida = new Date(value);
  if (Number.isNaN(dataSaida.getTime())) {
    toast('Horário de saída inválido.');
    return;
  }

  try {
    await updateDoc(doc(db, 'registros', id), {
      saida: dataSaida,
      saidaPor: usuarioLogado.email || '',
      saidaManual: true
    });
    toast('Saída manual registrada!');
  } catch (e) {
    console.error(e);
    toast('Erro ao registrar saída manual.');
  }
}

function renderAcaoSaida(r) {
  if (r.saida) return '';

  if (isAdmin()) {
    return '<input type="datetime-local" onchange="registrarSaidaManual(\'' + r.id + '\', this.value)" style="font-size:12px;padding:4px;min-width:165px;">';
  }

  if (isPortaria()) {
    return '<button class="btn btn-saida" onclick="registrarSaida(\'' + r.id + '\')">Registrar saída</button>';
  }

  return '';
}

function formatTime(d) {
  if (!d) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function calcMins(entrada, saida) {
  const fim = saida || new Date();
  return Math.floor((fim - entrada) / 60000);
}
function calcTempo(entrada, saida) {
  const mins = calcMins(entrada, saida);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? h + 'h ' + (m < 10 ? '0' : '') + m + 'min' : m + 'min';
}
function isIncompleto(r) { return !r.nome || !r.marca || !r.cor; }
function getStatus(r) {
  const mins = calcMins(r.entrada, r.saida);
  if (r.saida) return mins > 60 ? 'excedido' : 'saiu';
  if (mins > 60) return 'excedido';
  if (mins > 50) return 'atencao';
  return 'dentro';
}
function badgeStatus(r) {
  if (isIncompleto(r) && !r.saida) return '<span class="badge badge-inc">incompleto</span>';
  const s = getStatus(r);
  if (s === 'excedido') return '<span class="badge badge-danger">excedido</span>';
  if (s === 'atencao') return '<span class="badge badge-warn">quase 1h</span>';
  if (s === 'dentro') return '<span class="badge badge-in">no local</span>';
  return '<span class="badge badge-ok">saiu</span>';
}

function setFiltro(f, el) {
  filtroAtual = f;
  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
  el.classList.add('active');
  renderTabela();
}
function filtrarTabela(v) {
  buscaAtual = v.toLowerCase();
  renderTabela();
}

function renderDashboardHead() {
  document.getElementById('dashboard-head').innerHTML = `
    <tr>
      <th>Placa</th><th>Motorista</th><th>Apto / Torre</th><th>Marca / Cor</th>
      <th>Entrada</th><th>Saída</th><th>Tempo</th><th>Status</th>
      ${canSeeMultaEnviada() ? '<th>Multa enviada</th>' : ''}
      <th></th>
    </tr>`;
}

async function toggleMultaEnviada(id, checked) {
  if (!isAdmin()) {
    toast('Somente admin pode marcar multa enviada.');
    renderTabela();
    return;
  }
  try {
    await updateDoc(doc(db, 'registros', id), {
      multaEnviada: checked,
      multaEnviadaPor: usuarioLogado.email || '',
      multaEnviadaEm: new Date()
    });
    toast(checked ? 'Multa marcada como enviada.' : 'Multa desmarcada.');
  } catch (e) {
    console.error(e);
    toast('Erro ao atualizar multa enviada.');
  }
}

function renderTabela() {
  let lista = [...registros];
  if (filtroAtual === 'dentro') lista = lista.filter((r) => !r.saida);
  if (filtroAtual === 'excedidos') lista = lista.filter((r) => getStatus(r) === 'excedido');
  if (filtroAtual === 'incompletos') lista = lista.filter((r) => isIncompleto(r) && !r.saida);
  if (buscaAtual) lista = lista.filter((r) => (r.placa + r.nome + r.apto + r.torre + r.marca + r.cor).toLowerCase().includes(buscaAtual));

  document.getElementById('s-total').textContent = registros.length;
  document.getElementById('s-dentro').textContent = registros.filter((r) => !r.saida).length;
  document.getElementById('s-exc').textContent = registros.filter((r) => getStatus(r) === 'excedido').length;
  document.getElementById('s-inc').textContent = registros.filter((r) => isIncompleto(r) && !r.saida).length;

  const excedidos = registros.filter((r) => getStatus(r) === 'excedido').length;
  const incompletos = registros.filter((r) => isIncompleto(r) && !r.saida).length;
  document.getElementById('alert-exc').style.display = excedidos > 0 ? 'block' : 'none';
  document.getElementById('alert-exc').textContent = excedidos + ' veículo(s) com permanência excedida — verificar imediatamente.';
  document.getElementById('alert-inc').style.display = incompletos > 0 ? 'block' : 'none';
  document.getElementById('alert-inc').textContent = incompletos + ' registro(s) incompleto(s) — solicitar ao porteiro que complete os dados.';

  renderDashboardHead();
  const tbody = document.getElementById('tabela-body');
  const colspan = canSeeMultaEnviada() ? 10 : 9;
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">Nenhum registro encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((r) => `
    <tr>
      <td><span class="placa">${r.placa}</span></td>
      <td style="color:${r.nome ? 'inherit' : 'var(--text-muted)'}">${r.nome || '<em>não informado</em>'}</td>
      <td>${r.apto && r.torre ? r.apto + ' / ' + r.torre : r.apto || r.torre || '—'}</td>
      <td>${r.marca || '—'}${r.cor ? ' <span style="font-size:11px;color:var(--text-muted)">' + r.cor + '</span>' : ''}</td>
      <td style="font-family:'DM Mono',monospace">${formatTime(r.entrada)}</td>
      <td style="font-family:'DM Mono',monospace">${formatTime(r.saida)}</td>
      <td style="font-family:'DM Mono',monospace;font-weight:${calcMins(r.entrada, r.saida) > 60 ? '600' : '400'};color:${calcMins(r.entrada, r.saida) > 60 ? 'var(--danger)' : 'inherit'}">${calcTempo(r.entrada, r.saida)}</td>
      <td>${badgeStatus(r)}</td>
      ${canSeeMultaEnviada() ? `<td>${shouldShowMultaOption(r) ? '<input type="checkbox" ' + (r.multaEnviada ? 'checked' : '') + ' ' + (isAdmin() ? '' : 'disabled') + ' onchange="toggleMultaEnviada(\'' + r.id + '\', this.checked)">' : '—'}</td>` : ''}
      <td>${renderAcaoSaida(r)}</td>
    </tr>`).join('');
}

function renderPlacas() {
  document.getElementById('placas-head').innerHTML = `
    <tr><th>Placa</th><th>Morador</th><th>Apto</th><th>Torre</th><th>Marca</th><th>Cor</th><th>Origem</th>${isAdmin() ? '<th>Ações</th>' : ''}</tr>`;

  const tbody = document.getElementById('placas-body');
  const colspan = isAdmin() ? 8 : 7;
  if (placasCad.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="loading">Nenhuma placa cadastrada.</td></tr>';
    return;
  }

  tbody.innerHTML = placasCad.map((p) => {
    const id = normalizarPlaca(p.id || p.placa);
    if (isAdmin() && placaEditando === id) return renderPlacaEditavel(p, id);
    return renderPlacaNormal(p, id);
  }).join('');
}

function renderPlacaNormal(p, id) {
  return `
    <tr>
      <td><span class="placa">${p.placa || '—'}</span></td>
      <td>${p.nome || '—'}</td><td>${p.apto || '—'}</td><td>${p.torre || '—'}</td>
      <td>${p.marca || '—'}</td><td>${p.cor || '—'}</td>
      <td><span class="badge ${p.origem === 'Ucondo' ? 'badge-in' : 'badge-ok'}">${p.origem || '—'}</span></td>
      ${isAdmin() ? `<td><button class="btn btn-export" onclick="editarPlaca('${id}')">Editar</button></td>` : ''}
    </tr>`;
}
function renderPlacaEditavel(p, id) {
  return `
    <tr>
      <td><input id="edit-placa-${id}" value="${p.placa || ''}" style="font-family:'DM Mono',monospace;text-transform:uppercase;min-width:100px;"></td>
      <td><input id="edit-nome-${id}" value="${p.nome || ''}" style="min-width:140px;"></td>
      <td><input id="edit-apto-${id}" value="${p.apto || ''}" style="min-width:70px;"></td>
      <td><input id="edit-torre-${id}" value="${p.torre || ''}" style="min-width:80px;"></td>
      <td><input id="edit-marca-${id}" value="${p.marca || ''}" style="min-width:100px;"></td>
      <td><input id="edit-cor-${id}" value="${p.cor || ''}" style="min-width:80px;"></td>
      <td><span class="badge ${p.origem === 'Ucondo' ? 'badge-in' : 'badge-ok'}">${p.origem || '—'}</span></td>
      <td><button class="btn btn-saida" onclick="salvarPlaca('${id}')">Salvar</button> <button class="btn btn-logout" onclick="cancelarEdicaoPlaca()">Cancelar</button></td>
    </tr>`;
}
function editarPlaca(id) { if (!isAdmin()) return; placaEditando = id; renderPlacas(); }
function cancelarEdicaoPlaca() { placaEditando = null; renderPlacas(); }
async function salvarPlaca(idAtual) {
  if (!isAdmin()) { toast('Somente admin pode editar placas.'); return; }
  const placaNova = normalizarPlaca(document.getElementById('edit-placa-' + idAtual).value);
  if (!placaNova) { toast('A placa não pode ficar vazia.'); return; }
  const placaOriginal = placasCad.find((p) => normalizarPlaca(p.id || p.placa) === idAtual);
  const dados = {
    placa: placaNova,
    nome: document.getElementById('edit-nome-' + idAtual).value.trim(),
    apto: document.getElementById('edit-apto-' + idAtual).value.trim(),
    torre: document.getElementById('edit-torre-' + idAtual).value.trim(),
    marca: document.getElementById('edit-marca-' + idAtual).value.trim(),
    cor: document.getElementById('edit-cor-' + idAtual).value.trim(),
    origem: placaOriginal?.origem || 'Editado',
    atualizadoPor: usuarioLogado.email || '',
    atualizadoEm: new Date()
  };
  try {
    await setDoc(doc(db, 'placas', placaNova), dados);
    if (idAtual !== placaNova) await deleteDoc(doc(db, 'placas', idAtual));
    placaEditando = null;
    toast('Cadastro da placa atualizado!');
    await carregarPlacas();
  } catch (e) {
    console.error(e);
    toast('Erro ao salvar placa.');
  }
}

function exportarCSV() {
  if (registros.length === 0) { toast('Nenhum registro para exportar.'); return; }
  const header = 'Placa,Motorista,Apto,Torre,Marca,Cor,Entrada,Saída,Tempo,Status,Obs\n';
  const rows = registros.map((r) => [
    r.placa, r.nome || '', r.apto || '', r.torre || '', r.marca || '', r.cor || '',
    r.entrada ? r.entrada.toLocaleString('pt-BR') : '',
    r.saida ? r.saida.toLocaleString('pt-BR') : '',
    calcTempo(r.entrada, r.saida), getStatus(r), r.obs || ''
  ].map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'garagem-verona-' + new Date().toLocaleDateString('pt-BR').replace(/\//g, '-') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado!');
}

function processCSV(e) {
  if (!usuarioLogado) { toast('Faça login para importar placas.'); return; }
  if (!canWrite()) { toast('Usuário sem permissão para importar placas.'); return; }
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const lines = ev.target.result.split('\n').filter((l) => l.trim());
    let added = 0;
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''));
      const placa = normalizarPlaca(cols[0]);
      if (placa && !placasCad.find((p) => normalizarPlaca(p.placa) === placa)) {
        const dados = { placa, nome: cols[1] || '', apto: cols[2] || '', torre: cols[3] || '', marca: cols[4] || '', cor: cols[5] || '', origem: 'Ucondo' };
        try { await setDoc(doc(db, 'placas', placa), dados); placasCad.push(dados); added++; }
        catch (err) { console.error(err); }
      }
    }
    toast(added + ' placa(s) importada(s)!');
    renderPlacas();
  };
  reader.readAsText(file);
  e.target.value = '';
}

window.fazerLogin = fazerLogin;
window.sair = sair;
window.switchTab = switchTab;
window.checkPlaca = checkPlaca;
window.selMarca = selMarca;
window.selCor = selCor;
window.registrarEntrada = registrarEntrada;
window.registrarSaida = registrarSaida;
window.registrarSaidaManual = registrarSaidaManual;
window.toggleMultaEnviada = toggleMultaEnviada;
window.setFiltro = setFiltro;
window.filtrarTabela = filtrarTabela;
window.exportarCSV = exportarCSV;
window.processCSV = processCSV;
window.editarPlaca = editarPlaca;
window.cancelarEdicaoPlaca = cancelarEdicaoPlaca;
window.salvarPlaca = salvarPlaca;

setInterval(() => {
  if (usuarioLogado && document.getElementById('tab-dashboard').classList.contains('active')) renderTabela();
}, 60000);
