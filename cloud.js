import { firebaseConfig } from "./firebase-config.js";
const B = "https://www.gstatic.com/firebasejs/10.14.1/";
const cv = window.cavaco;
const on = firebaseConfig && firebaseConfig.apiKey && !/COLE/.test(firebaseConfig.apiKey);
let A, F, auth, fs, user = null, authKnown = false, ready = false, msg = "", unsubs = [], known = {};
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

function keep() { if (user) try { localStorage.setItem("cavaco-known-" + user.uid, JSON.stringify(known)); } catch (e) {} }
function fail(e) { msg = "Erro ao sincronizar (" + (e && e.code || "?") + ")."; paint(); }
function stop() { unsubs.forEach(f => f()); unsubs = []; cv.onSave = null; ready = false; }

function push(S) {
  if (!user) return;
  const ids = {};
  S.songs.forEach(s => {
    ids[s.id] = 1;
    const j = JSON.stringify(s);
    if (known[s.id] !== j) {
      known[s.id] = j;
      F.setDoc(F.doc(fs, "users", user.uid, "songs", s.id), { json: j, t: Date.now() }).catch(fail);
    }
  });
  Object.keys(known).forEach(id => {
    if (id.slice(0, 2) === "__" || ids[id]) return;
    delete known[id];
    F.deleteDoc(F.doc(fs, "users", user.uid, "songs", id)).catch(fail);
  });
  const cj = JSON.stringify(S.chords || {});
  if (known.__c !== cj) {
    known.__c = cj;
    F.setDoc(F.doc(fs, "users", user.uid, "meta", "chords"), { json: cj }).catch(fail);
  }
  const rj = JSON.stringify(S.reps || []);
  if (known.__r !== rj) {
    known.__r = rj;
    F.setDoc(F.doc(fs, "users", user.uid, "meta", "reps"), { json: rj }).catch(fail);
  }
  keep();
}

function start(u) {
  try { known = JSON.parse(localStorage.getItem("cavaco-known-" + u.uid) || "{}"); } catch (e) { known = {}; }
  let reconciled = false, firstC = true;
  cv.onSave = push;
  unsubs.push(F.onSnapshot(F.collection(fs, "users", u.uid, "songs"), { includeMetadataChanges: true }, snap => {
    const S = cv.state();
    if (!reconciled && !snap.metadata.fromCache) {
      // músicas apagadas em outro aparelho enquanto este estava fechado
      const ids = {};
      snap.docs.forEach(d => ids[d.id] = 1);
      S.songs = S.songs.filter(s => ids[s.id] || !known[s.id]);
      Object.keys(known).forEach(id => { if (id.slice(0, 2) !== "__" && !ids[id]) delete known[id]; });
      reconciled = true; ready = true;
    }
    snap.docChanges().forEach(c => {
      const id = c.doc.id;
      if (c.type === "removed") { S.songs = S.songs.filter(s => s.id !== id); delete known[id]; return; }
      const d = c.doc.data();
      let s; try { s = JSON.parse(d.json); } catch (e) { return; }
      const i = S.songs.findIndex(x => x.id === id);
      if (i < 0) S.songs.push(s); else S.songs[i] = s;
      known[id] = d.json;
    });
    cv.commit(); push(S); paint();
  }, fail));
  unsubs.push(F.onSnapshot(F.doc(fs, "users", u.uid, "meta", "chords"), snap => {
    const S = cv.state();
    if (snap.exists()) {
      let r = {}; try { r = JSON.parse(snap.data().json); } catch (e) {}
      S.chords = firstC ? Object.assign({}, S.chords, r) : r;
      known.__c = snap.data().json;
    }
    firstC = false;
    cv.commit(); push(S);
  }, fail));
  let firstR = true;
  unsubs.push(F.onSnapshot(F.doc(fs, "users", u.uid, "meta", "reps"), snap => {
    const S = cv.state();
    if (snap.exists()) {
      let r = []; try { r = JSON.parse(snap.data().json); } catch (e) {}
      if (firstR) { const ids = {}; r.forEach(x => ids[x.id] = 1); r = r.concat((S.reps || []).filter(x => !ids[x.id])); }
      S.reps = r; known.__r = snap.data().json;
    }
    firstR = false;
    cv.commit(); push(S);
  }, fail));
}

async function init() {
  try {
    const [app, a, f] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
    A = a; F = f;
    const fb = app.initializeApp(firebaseConfig);
    auth = A.getAuth(fb);
    try { fs = F.initializeFirestore(fb, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch (e) { fs = F.getFirestore(fb); }
    A.onAuthStateChanged(auth, u => { stop(); user = u; authKnown = true; if (u) start(u); paint(); });
  } catch (e) { /* sem conexão: o app segue funcionando só com os dados do aparelho */ }
}
if (on) init();
