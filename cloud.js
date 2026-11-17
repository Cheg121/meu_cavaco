import { firebaseConfig } from "./firebase-config.js";
const B = "https://www.gstatic.com/firebasejs/10.14.1/";
const cv = window.cavaco;
const on = firebaseConfig && firebaseConfig.apiKey && !/COLE/.test(firebaseConfig.apiKey);
let A, F, auth, fs, user = null, authKnown = false, ready = false, msg = "", unsubs = [], known = {}, engines = [], recd = 0;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let pop = false;
function paint() {
  const e = document.getElementById("cl");
  if (!e) return;
  if (!on || !authKnown) { e.innerHTML = ""; return; }
  if (!user) {
    e.innerHTML = '<button class="btn" id="gi" style="padding:8px 16px;font-size:14px">Entrar</button>' + (msg ? '<div class="pop" style="color:#C0392B">' + esc(msg) + "</div>" : "");
    document.getElementById("gi").onclick = login;
    return;
  }
  const ini = esc((user.email || "?").charAt(0).toUpperCase());
  e.innerHTML = '<button class="av" id="av" aria-label="Conta">' + (user.photoURL ? '<img src="' + esc(user.photoURL) + '" referrerpolicy="no-referrer" alt="">' : ini) + "</button>"
    + (pop ? '<div class="pop"><b>' + (ready ? "☁ Sincronizado" : "☁ Sincronizando…") + '</b><span class="mut">' + esc(user.email || "") + "</span>" + (msg ? '<span style="color:#C0392B">' + esc(msg) + "</span>" : "") + '<button class="btn o" id="go">Sair</button></div>' : "");
  document.getElementById("av").onclick = ev => { ev.stopPropagation(); pop = !pop; paint(); };
  const go = document.getElementById("go");
  if (go) go.onclick = () => { pop = false; A.signOut(auth); };
}
document.addEventListener("click", ev => { if (pop && !ev.target.closest("#cl")) { pop = false; paint(); } });
cv.paint = paint;

let authRes; const authReady = new Promise(r => { authRes = r; });
const CODEA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
if (on) {
  cv.share = async (kind, payload) => {
    if (!user) throw new Error("login");
    const rnd = crypto.getRandomValues(new Uint8Array(10));
    const code = Array.from(rnd, x => CODEA[x % CODEA.length]).join("");
    await F.setDoc(F.doc(fs, "shares", code), { kind, json: JSON.stringify(payload), owner: user.uid, t: Date.now() });
    return code;
  };
  cv.fetchShare = async code => {
    await Promise.race([authReady, new Promise(r => setTimeout(r, 8000))]);
    if (!user) throw new Error("login");
    const snap = await F.getDoc(F.doc(fs, "shares", code));
    if (!snap.exists()) throw new Error("none");
    const d = snap.data();
    return { kind: d.kind, payload: JSON.parse(d.json) };
  };
}

function login() {
  msg = "";
  A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch(e => {
    const c = e && e.code || "";
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
    msg = c === "auth/unauthorized-domain" ? "Domínio não autorizado: adicione este endereço em Authentication > Configurações > Domínios autorizados."
        : c === "auth/popup-blocked" ? "O navegador bloqueou a janela de login. Permita pop-ups e tente de novo."
        : "Não foi possível entrar (" + c + ").";
    paint();
  });
}

function keep() { if (user) try { localStorage.setItem("cavaco-known2-" + user.uid, JSON.stringify(known)); } catch (e) {} }
function fail(e) { msg = "Erro ao sincronizar (" + (e && e.code || "?") + ")."; paint(); }
function stop() { unsubs.forEach(f => f()); unsubs = []; engines = []; cv.onSave = null; ready = false; }

/* Cada música, cada acorde e cada repertório é um documento próprio.
   Regras de segurança: nada é apagado na nuvem antes de o servidor confirmar o estado,
   e um aparelho com dados locais nunca é "zerado" por uma cópia vazia. */
const norm = v => Array.isArray(v) ? v : (v ? [v] : []);
const AD = {
  songs: { pref: "s:",
    keys: () => cv.state().songs.map(s => s.id),
    get: k => JSON.stringify(cv.state().songs.find(s => s.id === k)),
    put: (k, j) => { let o; try { o = JSON.parse(j); } catch (e) { return; } const S = cv.state(), i = S.songs.findIndex(s => s.id === k); if (i < 0) S.songs.push(o); else S.songs[i] = o; },
    del: k => { const S = cv.state(); S.songs = S.songs.filter(s => s.id !== k); } },
  chords: { pref: "c:",
    keys: () => Object.keys(cv.state().chords),
    get: k => JSON.stringify(norm(cv.state().chords[k])),
    put: (k, j) => { try { cv.state().chords[k] = JSON.parse(j); } catch (e) {} },
    del: k => { delete cv.state().chords[k]; } },
  reps: { pref: "r:",
    keys: () => (cv.state().reps || []).map(r => r.id),
    get: k => JSON.stringify((cv.state().reps || []).find(r => r.id === k)),
    put: (k, j) => { let o; try { o = JSON.parse(j); } catch (e) { return; } const S = cv.state(); S.reps = S.reps || []; const i = S.reps.findIndex(r => r.id === k); if (i < 0) S.reps.push(o); else S.reps[i] = o; },
    del: k => { const S = cv.state(); S.reps = (S.reps || []).filter(r => r.id !== k); } }
};

function engine(u, col, a) {
  const cref = F.collection(fs, "users", u.uid, col), P = a.pref;
  let rec = false;
  const did = k => encodeURIComponent(k);
  const kof = d => { const x = d.data(); return x.k !== undefined ? x.k : decodeURIComponent(d.id); };
  function push() {
    const keys = a.keys(), has = {};
    keys.forEach(k => {
      has[k] = 1;
      const j = a.get(k);
      if (known[P + k] !== j) { known[P + k] = j; F.setDoc(F.doc(fs, "users", u.uid, col, did(k)), { k, json: j, t: Date.now() }).catch(fail); }
    });
    const mine = Object.keys(known).filter(x => x.indexOf(P) === 0);
    if (!keys.length && mine.length > 1) return;   // estado local vazio e suspeito: não apaga nada na nuvem
    mine.forEach(x => {
      const k = x.slice(P.length);
      if (!has[k]) { delete known[x]; F.deleteDoc(F.doc(fs, "users", u.uid, col, did(k))).catch(fail); }
    });
  }
  const unsub = F.onSnapshot(cref, { includeMetadataChanges: true }, snap => {
    if (!rec && !snap.metadata.fromCache) {
      const ids = {};
      snap.docs.forEach(d => { ids[kof(d)] = 1; });
      a.keys().forEach(k => { if (known[P + k] && !ids[k]) a.del(k); });          // apagado em outro aparelho
      Object.keys(known).forEach(x => { if (x.indexOf(P) === 0 && !ids[x.slice(P.length)]) delete known[x]; });
      rec = true; recd++; if (recd >= 3) ready = true;
    }
    snap.docChanges().forEach(c => {
      const k = kof(c.doc);
      if (c.type === "removed") { a.del(k); delete known[P + k]; return; }
      const j = c.doc.data().json;
      a.put(k, j); known[P + k] = j;
    });
    cv.commit(); push(); keep(); paint();
  }, fail);
  return { push, unsub };
}

/* importa o formato antigo (um documento só para acordes e outro para repertórios), uma única vez */
function mergeChords(S, r) {
  let n = 0;
  Object.keys(r || {}).forEach(k => {
    const v = norm(r[k]).filter(x => typeof x === "string"), cur = S.chords[k] === undefined ? null : norm(S.chords[k]).slice();
    if (!cur) { S.chords[k] = v; n++; }
    else { let add = 0; v.forEach(x => { if (cur.indexOf(x) < 0) { cur.push(x); add++; } }); if (add) { S.chords[k] = cur; n++; } }
  });
  return n;
}
function mergeReps(S, r) {
  let n = 0; S.reps = S.reps || [];
  (Array.isArray(r) ? r : []).forEach(x => { if (x && x.id && !S.reps.some(y => y.id === x.id)) { S.reps.push(x); n++; } });
  return n;
}
async function legacy(u) {
  const flag = "cavaco-leg-" + u.uid;
  try { if (localStorage.getItem(flag)) return; } catch (e) {}
  const S = cv.state(); let nc = 0, nr = 0;
  const take = (name, j) => { let r; try { r = JSON.parse(j); } catch (e) { return; } if (name === "chords") nc += mergeChords(S, r); else nr += mergeReps(S, r); };
  for (const name of ["chords", "reps"]) {   // primeiro o cache do aparelho (pode ter a versão antiga)
    try { const sc = await F.getDocFromCache(F.doc(fs, "users", u.uid, "meta", name)); if (sc.exists()) take(name, sc.data().json); } catch (e) {}
  }
  let okServer = true;
  for (const name of ["chords", "reps"]) {
    try {
      const ss = await Promise.race([F.getDoc(F.doc(fs, "users", u.uid, "meta", name)), new Promise((_, rj) => setTimeout(() => rj(new Error("t")), 6000))]);
      if (ss.exists()) take(name, ss.data().json);
    } catch (e) { okServer = false; }
  }
  if (okServer) try { localStorage.setItem(flag, "1"); } catch (e) {}
  if (nc || nr) { cv.commit(); if (cv.notice) cv.notice("Recuperei " + nc + " acorde(s) e " + nr + " repertório(s) de uma cópia antiga da sua conta."); }
}

function start(u) {
  try { known = JSON.parse(localStorage.getItem("cavaco-known2-" + u.uid) || "{}"); } catch (e) { known = {}; }
  recd = 0;
  engines = [engine(u, "songs", AD.songs), engine(u, "chords", AD.chords), engine(u, "reps", AD.reps)];
  unsubs = engines.map(e => e.unsub);
  cv.onSave = () => { engines.forEach(e => e.push()); keep(); };
  legacy(u).then(() => { engines.forEach(e => e.push()); keep(); }).catch(() => {});
}

if (window.__cloudTest) window.__cloudTest({ engine, AD, legacy, mergeChords, ctx: o => { A = o.A; F = o.F; fs = o.fs; user = o.user; known = o.known || {}; recd = 0; }, known: () => known });

async function init() {
  try {
    const [app, a, f] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
    A = a; F = f;
    const fb = app.initializeApp(firebaseConfig);
    auth = A.getAuth(fb);
    try { fs = F.initializeFirestore(fb, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch (e) { fs = F.getFirestore(fb); }
    A.onAuthStateChanged(auth, u => { stop(); user = u; authKnown = true; if (u) start(u); paint(); authRes(); });
  } catch (e) { /* sem conexão: o app segue funcionando só com os dados do aparelho */ }
}
if (on) init();
