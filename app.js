import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, addDoc, updateDoc, runTransaction, serverTimestamp, query, orderBy, limit, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDIxSYSmYPVMopRGNXdOGS-VBU9U1D08Hs",
  authDomain: "kindi-science-lab.firebaseapp.com",
  projectId: "kindi-science-lab",
  storageBucket: "kindi-science-lab.firebasestorage.app",
  messagingSenderId: "617905776784",
  appId: "1:617905776784:web:0fa9f90b560eb73a90d015"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const OWNER = 'omar.alabadi95@gmail.com';
const SCHOOL = 'مدرسة الشيخ أحمد بن عبدالله الكندي';
const TECH = 'الأستاذ محمد بن عبدالله العبادي';
const STATUSES = ['سليم','يحتاج صيانة','تالف','مفقود'];
const ORD = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
const { ICONS, GMETA } = window.LABMETA;

/* ---------- live state ---------- */
let CABS = null;          // [{id,name,items:[]}]
let cabsErr = null;
let MSGS = [];
let LOGS = [];
let USER = null, ADMIN = false, authReady = false;
let unsubAdmin = [];

onSnapshot(collection(db, 'cabinets'), snap => {
  CABS = snap.docs.map(d => ({ ...d.data(), id: +d.id })).sort((a, b) => a.id - b.id);
  cabsErr = null; refresh();
}, err => { cabsErr = err; refresh(); });

onAuthStateChanged(auth, async u => {
  USER = u; ADMIN = false;
  unsubAdmin.forEach(f => f()); unsubAdmin = [];
  if (u) {
    if (u.email === OWNER) ADMIN = true;
    else { try { ADMIN = (await getDoc(doc(db, 'admins', u.email))).exists(); } catch (e) { ADMIN = false; } }
  }
  if (ADMIN) {
    unsubAdmin.push(onSnapshot(query(collection(db, 'messages'), orderBy('time', 'desc'), limit(300)), s => { MSGS = s.docs.map(d => ({ id: d.id, ...d.data() })); if (isAdminView()) renderAdmin(); }));
    unsubAdmin.push(onSnapshot(query(collection(db, 'log'), orderBy('time', 'desc'), limit(150)), s => { LOGS = s.docs.map(d => ({ id: d.id, ...d.data() })); if (isAdminView() && A.tab === 'log') renderAdmin(); }));
  }
  authReady = true; refresh();
});

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase();
function svg(name, color, size, sw) { size = size || 18; sw = sw || 1.9; return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.atom}</svg>` }
function gm(g) { return GMETA[g] || ['#0B5FA5', '#E3EFF8', 'atom'] }
function icoBox(g, cls, size) { const [c, b, i] = gm(g); return `<span class="ib ${cls || ''}" style="background:${b}">${svg(i, c, size || 19)}</span>` }
function ptile(n, w, h, big, white) { const nn = String(n).padStart(2, '0'); return `<div class="ptile ${white ? 'w' : ''}" style="width:${w}px;height:${h}px"><span class="n">${nn}</span><span class="b" style="font-size:${big}px">${n}</span><span class="l">دولاب</span></div>` }
function tsMs(t) { return t && t.toMillis ? t.toMillis() : (typeof t === 'number' ? t : Date.now()) }
function ago(t) { const m = Math.round((Date.now() - tsMs(t)) / 60000); if (m < 1) return 'الآن'; if (m < 60) return 'قبل ' + m + ' دقيقة'; const h = Math.round(m / 60); if (h < 24) return 'قبل ' + h + ' ساعة'; const d = Math.round(h / 24); return 'قبل ' + d + ' يوم' }
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 2400) }
function cab(id) { return (CABS || []).find(c => c.id == id) }
function cabName(id) { const c = cab(id); return c ? c.name : 'الدولاب ' + id }
function allItems() { return (CABS || []).flatMap(c => (c.items || []).map(i => ({ ...i, cab: c.id }))) }
function openSheet(html) { $('#sheet').innerHTML = '<div class="grab"></div>' + html; $('#ov').classList.add('show') }
function closeSheet() { $('#ov').classList.remove('show') }
$('#ov').addEventListener('click', e => { if (e.target.id === 'ov') closeSheet() });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#ov').classList.contains('show')) closeSheet() });
function baseUrl() { return location.origin + location.pathname }
function setFab(on) {
  let f = $('#fabbar');
  if (on && !f) { f = document.createElement('div'); f.id = 'fabbar'; f.className = 'fabbar'; f.innerHTML = `<button class="fab" id="fab">${svg('msg', '#fff', 18, 2)} رسالة لفني المختبر</button>`; document.body.appendChild(f); $('#fab').onclick = msgForm }
  if (!on && f) f.remove();
  document.body.classList.toggle('has-fab', on);
}
function loading() { return `<div class="card empty">${svg('atom', '#0B5FA5', 34, 1.4)}جاري التحميل…</div>` }
function failed() { return `<div class="card empty">${svg('tube', '#B42318', 34, 1.6)}تعذّر الاتصال بقاعدة البيانات. تأكد من الإنترنت ثم حدّث الصفحة.</div>` }
async function addLog(t) { try { await addDoc(collection(db, 'log'), { t, by: USER ? USER.email : '', time: serverTimestamp() }) } catch (e) { } }
function fail(e) { console.error(e); toast('لم يتم الحفظ — تحقق من الاتصال') }

/* change one cabinet's items atomically */
async function mutateCab(id, fn) {
  const ref = doc(db, 'cabinets', String(id));
  await runTransaction(db, async tx => {
    const s = await tx.get(ref); if (!s.exists()) throw new Error('missing');
    const d = s.data(); const items = (d.items || []).map(x => ({ ...x }));
    fn(items, d); tx.update(ref, { items });
  });
}

$('#ftIcon').innerHTML = svg('micro', '#0B5FA5', 18, 1.8);

/* ---------- router ---------- */
let curView = '';
function isAdminView() { return location.hash.slice(1) === 'admin' }
function route() {
  closeSheet();
  const h = location.hash.slice(1); const nav = $('#navBtn');
  if (h === 'admin') { curView = 'admin'; nav.innerHTML = svg('back', '#22B8CF', 16, 2) + 'الصفحة الرئيسية'; nav.href = '#'; renderAdmin() }
  else if (/^cab-\d+$/.test(h)) { const id = +h.split('-')[1]; curView = 'cab'; nav.innerHTML = svg('back', '#22B8CF', 16, 2) + 'كل الدواليب'; nav.href = '#'; V.q = ''; V.g = 'all'; renderCab(id) }
  else { curView = 'home'; nav.textContent = 'لوحة التحكم'; nav.href = '#admin'; renderHome() }
  window.scrollTo(0, 0);
}
function refresh() {
  if (curView === 'home') renderHome();
  else if (curView === 'cab') { if (!$('#q') || !$('#list')) renderCab(V.cab); else drawList(); }
  else if (curView === 'admin') { if (A.tab === 'items' && $('#arows') && document.activeElement && document.activeElement.closest && document.activeElement.closest('#arows,.bar-tools')) drawRows(); else renderAdmin(); }
}
window.addEventListener('hashchange', route);

/* ---------- home ---------- */
function renderHome() {
  setFab(false);
  $('#topTitle').innerHTML = `<h1>مختبر العلوم</h1><div class="lead">دليل الأدوات والأجهزة في دواليب المختبر</div>
    <div class="strip">${['flask', 'atom', 'micro', 'magnet', 'bulb', 'tube'].map(i => `<span class="ib">${svg(i, '#BFE6F5', 17, 1.8)}</span>`).join('')}</div>`;
  if (cabsErr) { $('#app').innerHTML = failed(); return }
  if (!CABS) { $('#app').innerHTML = loading(); return }
  if (!CABS.length) { $('#app').innerHTML = `<div class="card empty">${svg('box', '#4F6475', 34, 1.6)}لم تُضف الدواليب بعد</div>`; return }
  const cards = CABS.map(c => {
    const av = (c.items || []).filter(i => i.qty > 0);
    const groups = [...new Set(av.map(i => i.group))];
    return `<a class="card cab" href="#cab-${c.id}">${ptile(c.id, 72, 84, 32)}
      <div class="info"><span class="name">${esc(c.name)}</span>
        <div class="minis">${groups.map(g => `<span title="${esc(g)}">${icoBox(g, 'mini', 15)}</span>`).join('')}</div>
        <span class="avail">${svg('box', '#0F766E', 15, 2)}${av.length} صنفاً متوفراً</span></div>
      ${svg('chev', '#0B5FA5', 18, 2)}</a>`}).join('');
  $('#app').innerHTML = `<div class="cabs">${cards}</div>
    <div class="hint"><span class="ib">${svg('qr', '#0B5FA5', 22, 1.8)}</span><span>امسح رمز QR الملصق على الدولاب لتعرف ما بداخله مباشرة.</span></div>`;
}

/* ---------- cabinet ---------- */
let V = { q: '', g: 'all', cab: null };
function renderCab(id) {
  V.cab = id;
  const c = cab(id);
  if (cabsErr) { $('#topTitle').innerHTML = ''; $('#app').innerHTML = failed(); setFab(false); return }
  if (!CABS) { $('#topTitle').innerHTML = `<div style="display:flex;align-items:center;gap:14px">${ptile(id, 62, 72, 28, true)}<div><h1 style="font-size:28px">الدولاب</h1></div></div>`; $('#app').innerHTML = loading(); setFab(false); return }
  if (!c) { $('#topTitle').innerHTML = ''; $('#app').innerHTML = `<div class="card empty">${svg('box', '#4F6475', 34, 1.6)}هذا الدولاب غير موجود</div>`; setFab(false); return }
  $('#topTitle').innerHTML = `<div style="display:flex;align-items:center;gap:14px">${ptile(id, 62, 72, 28, true)}
    <div><h1 style="font-size:28px">${esc(c.name)}</h1><div class="lead" style="display:flex;align-items:center;gap:6px">${svg('box', '#22B8CF', 14, 2)}<span id="avCount"></span> صنفاً متوفراً الآن</div></div></div>`;
  $('#app').innerHTML = `
    <div class="card tools">
      <div class="search">${svg('search', '#4F6475', 18, 2)}<input id="q" aria-label="ابحث عن أداة" placeholder="ابحث: كأس، عدسة، مقاومة…" value="${esc(V.q)}"></div>
      <div class="chips" id="chips"></div>
    </div>
    <div class="list" id="list"></div>`;
  $('#q').oninput = e => { V.q = e.target.value; drawList() };
  setFab(true);
  drawList();
}
function drawList() {
  const c = cab(V.cab); if (!c) { renderCab(V.cab); return }
  const its = (c.items || []).filter(i => i.qty > 0);
  if ($('#avCount')) $('#avCount').textContent = its.length;
  const groups = [...new Set(its.map(i => i.group))];
  if (V.g !== 'all' && !groups.includes(V.g)) V.g = 'all';
  const q = norm(V.q.trim());
  const base = its.filter(i => !q || norm(i.name).includes(q) || String(i.num).includes(q));
  const chipHtml = (k, label, n, icon, c1, b) => {
    const on = V.g === k;
    const st = on ? `background:${c1};color:#fff;border-color:${c1}` : (k === 'all' ? 'background:#fff;color:#0E2233;border-color:#DCE6EE' : `background:${b};color:${c1}`);
    return `<button class="chip" data-g="${esc(k)}" style="${st}">${svg(icon, 'currentColor', 15, 2)}${esc(label)}<small>${n}</small></button>`
  };
  $('#chips').innerHTML = chipHtml('all', 'الكل', base.length, 'atom', '#0B5FA5') + groups.map(g => { const [c1, b, i] = gm(g); return chipHtml(g, g, base.filter(x => x.group === g).length, i, c1, b) }).join('');
  $('#chips').querySelectorAll('.chip').forEach(b => b.onclick = () => { V.g = b.dataset.g; drawList() });
  const shown = (V.g === 'all' ? groups : [V.g]).map(g => [g, base.filter(i => i.group === g)]).filter(x => x[1].length);
  if (!shown.length) { $('#list').innerHTML = `<div class="card empty">${svg('tube', '#4F6475', 34, 1.6)}${its.length ? 'لا توجد أداة بهذا الاسم' : 'لا توجد أصناف متوفرة في هذا الدولاب حالياً'}</div>`; return }
  $('#list').innerHTML = shown.map(([g, list]) => {
    const [c1] = gm(g);
    return `<div class="sec">${icoBox(g, '', 16)}<span class="t" style="color:${c1}">${esc(g)}</span><span class="ln"></span><span class="c">${list.length} صنف</span></div>` +
      list.map(i => `<div class="card item">${icoBox(g, 'ico', 19)}
      <div class="body"><div class="name">${esc(i.name)}</div>
        <div class="meta"><span>رقم الصنف ${esc(i.num || '—')}</span>${i.status && i.status !== 'سليم' ? `<span class="tag" style="${i.status === 'يحتاج صيانة' ? 'background:#FDF0DB;color:#8A4B07' : 'background:#FBE4E1;color:#9F1F14'}">${esc(i.status)}</span>` : ''}${i.note ? `<span>· ${esc(i.note)}</span>` : ''}</div></div>
      <div class="qty"><b>${i.qty}</b><span>${esc(i.unit)}</span></div></div>`).join('')
  }).join('');
}

/* ---------- message ---------- */
function msgForm() {
  openSheet(`
    <div class="shead"><span class="ib">${svg('tube', '#0B5FA5', 24, 1.8)}</span><div><h3>رسالة لفني المختبر</h3><p>${esc(cabName(V.cab))} — إلى ${TECH}</p></div></div>
    <form id="mf">
      <div class="field"><label for="mNote">الرسالة</label><textarea class="inp" id="mNote" rows="6" maxlength="1000" placeholder="مثال: أخذت 3 كؤوس زجاجية 100 مل لتجربة اليوم…"></textarea></div>
      <div class="field"><label for="mWho">اسم المرسل</label><input class="inp" id="mWho" maxlength="80" placeholder="اسمك"></div>
      <div class="btns"><button class="btn grow" type="submit" id="mSend">إرسال ${svg('send', '#fff', 18, 2)}</button><button class="btn sec" type="button" id="mCancel">إلغاء</button></div>
      <div class="errtxt" id="mErr" hidden>اكتب الرسالة واسمك قبل الإرسال</div>
    </form>`);
  try { const w = localStorage.getItem('lab-who'); if (w) $('#mWho').value = w } catch (e) { }
  $('#mNote').focus();
  $('#mCancel').onclick = closeSheet;
  $('#mf').onsubmit = async e => {
    e.preventDefault();
    const note = $('#mNote').value.trim(), who = $('#mWho').value.trim();
    if (!note || !who) { $('#mErr').textContent = 'اكتب الرسالة واسمك قبل الإرسال'; $('#mErr').hidden = false; (note ? $('#mWho') : $('#mNote')).focus(); return }
    $('#mSend').disabled = true;
    try {
      await addDoc(collection(db, 'messages'), { cab: V.cab, who: who.slice(0, 80), note: note.slice(0, 1000), time: serverTimestamp(), done: false });
      try { localStorage.setItem('lab-who', who) } catch (e) { }
      $('#sheet').innerHTML = `<div class="done-box">
        <svg role="img" aria-label="تم الإرسال" width="90" height="104" viewBox="0 0 96 110" fill="none"><circle cx="62" cy="14" r="6" fill="#22B8CF" fill-opacity="0.5"></circle><circle cx="40" cy="8" r="4" fill="#22B8CF" fill-opacity="0.35"></circle><path d="M34 24h28M38 24v26L16 88a6 6 0 0 0 5.2 9h53.6a6 6 0 0 0 5.2-9L58 50V24" stroke="#0B5FA5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="#E3EFF8"></path><path d="M22 78h52l6 10a6 6 0 0 1-5.2 9H21.2a6 6 0 0 1-5.2-9z" fill="#22B8CF" fill-opacity="0.45"></path><path d="M38 66l7 7 14-14" stroke="#0B5FA5" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        <h3>وصلت رسالتك</h3><p>شكراً لك، سيطّلع عليها فني المختبر في أقرب وقت.</p>
        <button class="btn" id="okc" style="margin-top:8px">العودة للدولاب</button></div>`;
      $('#okc').onclick = closeSheet;
    } catch (err) {
      console.error(err); $('#mSend').disabled = false;
      $('#mErr').textContent = 'تعذّر الإرسال، تأكد من الإنترنت وحاول مرة أخرى'; $('#mErr').hidden = false;
    }
  };
}

/* ---------- admin ---------- */
let A = { tab: 'items', cab: 'all', q: '', g: 'all' };
function renderAdmin() {
  setFab(false);
  $('#topTitle').innerHTML = `<h1>لوحة التحكم</h1><div class="lead">${ADMIN ? 'أهلاً ' + esc(USER.displayName || USER.email) : 'خاصة بفني المختبر'}</div>`;
  if (!authReady) { $('#app').innerHTML = loading(); return }
  if (!USER || !ADMIN) {
    $('#app').innerHTML = `<div class="card login"><span class="ib">${svg('micro', '#0B5FA5', 26, 1.8)}</span><h2>تسجيل الدخول</h2>
      <p style="color:var(--muted);margin:0 0 16px;font-size:14px">${USER ? `الحساب <b dir="ltr">${esc(USER.email)}</b> ليس لديه صلاحية الدخول. اطلب من مسؤول الموقع إضافته.` : 'سجّل الدخول بحساب Google المصرّح له'}</p>
      ${USER ? `<button class="btn sec" id="lo" style="width:100%">تسجيل الخروج</button>` : `<button class="btn" id="gin" style="width:100%"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> الدخول بحساب Google</button>`}
      </div>`;
    if ($('#gin')) $('#gin').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()) } catch (e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('تعذّر تسجيل الدخول') } };
    if ($('#lo')) $('#lo').onclick = () => signOut(auth);
    return;
  }
  if (cabsErr) { $('#app').innerHTML = failed(); return }
  if (!CABS) { $('#app').innerHTML = loading(); return }
  if (!CABS.length) {
    $('#app').innerHTML = `<div class="card login"><span class="ib">${svg('box', '#0B5FA5', 26, 1.8)}</span><h2>تهيئة البيانات</h2>
      <p style="color:var(--muted);margin:0 0 16px;font-size:14px">قاعدة البيانات فارغة. اضغط لتحميل جرد الدواليب (534 صنفاً).</p>
      <button class="btn" id="seedBtn" style="width:100%">تحميل البيانات الأولية</button></div>`;
    $('#seedBtn').onclick = async () => {
      $('#seedBtn').disabled = true; $('#seedBtn').textContent = 'جاري التحميل…';
      try {
        const data = await (await fetch('./seed.json', { cache: 'no-store' })).json();
        const b = writeBatch(db);
        data.forEach(c => b.set(doc(db, 'cabinets', String(c.id)), { name: c.name, items: c.items }));
        await b.commit(); await addLog('تهيئة البيانات: ' + data.reduce((n, c) => n + c.items.length, 0) + ' صنف');
        toast('تم تحميل البيانات');
      } catch (e) { fail(e); $('#seedBtn').disabled = false; $('#seedBtn').textContent = 'تحميل البيانات الأولية' }
    };
    return;
  }
  const items = allItems();
  const unread = MSGS.filter(m => !m.done).length;
  const av = items.filter(i => i.qty > 0).length;
  const kpi = (v, l, i, c, b) => `<div class="card kpi"><span class="ib" style="background:${b}">${svg(i, c, 22, 1.9)}</span><div><b>${v}</b><span>${l}</span></div></div>`;
  $('#app').innerHTML = `
    <div class="kpis" style="margin-top:0">${kpi(items.length, 'صنف مسجّل', 'atom', '#0B5FA5', '#E3EFF8')}${kpi(av, 'صنف متوفر', 'flask', '#0F766E', '#DDF3EF')}${kpi(items.length - av, 'غير متوفر', 'tube', '#B42318', '#FBE4E1')}${kpi(unread, 'رسالة جديدة', 'msg', '#6D28D9', '#EEE8FC')}</div>
    <div class="card tabs">
      ${[['items', 'الأصناف', 'list'], ['msgs', 'الرسائل', 'msg'], ['qr', 'رموز QR', 'qr'], ['log', 'سجل الحركات', 'clock'], ['set', 'الإعدادات', 'cog']].map(([k, l, i]) => `<button data-t="${k}" class="${A.tab === k ? 'on' : ''}">${svg(i, 'currentColor', 17, 1.9)}${l}${k === 'msgs' && unread ? `<span class="badge">${unread}</span>` : ''}</button>`).join('')}
    </div>
    <div class="panel" id="panel"></div>`;
  $('.tabs').querySelectorAll('button').forEach(b => b.onclick = () => { A.tab = b.dataset.t; renderAdmin() });
  ({ items: aItems, msgs: aMsgs, qr: aQR, log: aLog, set: aSet })[A.tab]();
}
function aItems() {
  const groups = [...new Set(allItems().map(i => i.group))];
  $('#panel').innerHTML = `<div class="card">
    <div class="bar-tools">
      <div class="search">${svg('search', '#4F6475', 18, 2)}<input id="aq" aria-label="بحث" placeholder="بحث بالاسم أو رقم الصنف" value="${esc(A.q)}"></div>
      <select class="sel" id="acab" aria-label="الدولاب"><option value="all">كل الدواليب</option>${CABS.map(c => `<option value="${c.id}" ${A.cab == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select class="sel" id="ag" aria-label="القسم"><option value="all">كل الأقسام</option>${groups.map(g => `<option ${A.g === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
      <button class="btn sm" id="addIt">${svg('plus', '#fff', 16, 2.4)} إضافة صنف</button>
    </div></div>
    <div class="card" style="margin-top:10px" id="arows"></div>`;
  $('#aq').oninput = e => { A.q = e.target.value; drawRows() };
  $('#acab').onchange = e => { A.cab = e.target.value; drawRows() };
  $('#ag').onchange = e => { A.g = e.target.value; drawRows() };
  $('#addIt').onclick = () => itemForm(null);
  drawRows();
}
function drawRows() {
  const q = norm(A.q.trim());
  const rows = allItems().filter(i => (A.cab === 'all' || i.cab == A.cab) && (A.g === 'all' || i.group === A.g) && (!q || norm(i.name).includes(q) || String(i.num).includes(q)));
  const lim = rows.slice(0, 150);
  $('#arows').innerHTML = (lim.map(i => `<div class="arow" data-id="${esc(i.id)}" data-cab="${i.cab}">
      <div class="who">${icoBox(i.group, 'ico', 19)}<div style="min-width:0"><div class="name">${esc(i.name)}</div><div class="meta">${esc(cabName(i.cab))} · ${esc(i.group)} · رقم ${esc(i.num || '—')} · ${esc(i.unit)}</div></div></div>
      <div class="stepper"><button data-d="-1" aria-label="إنقاص">−</button><input class="${i.qty ? '' : 'z'}" value="${i.qty}" inputmode="numeric" aria-label="الكمية"><button data-d="1" aria-label="زيادة">+</button></div>
      <select class="stsel" aria-label="الحالة">${STATUSES.map(s => `<option ${i.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <button class="iconbtn" aria-label="تعديل">${svg('edit', 'currentColor', 18, 2)}</button>
    </div>`).join('') || '<div class="empty">لا توجد أصناف</div>') + (rows.length > 150 ? `<div class="note" style="padding-top:12px">يعرض أول 150 من ${rows.length} — استخدم البحث للتصفية</div>` : '');
  $('#arows').querySelectorAll('.arow').forEach(r => {
    const id = r.dataset.id, cid = +r.dataset.cab; const inp = r.querySelector('input');
    const find = () => allItems().find(x => String(x.id) === id);
    const setQ = async v => {
      const it = find(); if (!it) return;
      v = Math.max(0, Math.round(+v || 0)); inp.value = v; inp.classList.toggle('z', !v);
      if (v === it.qty) return;
      const old = it.qty;
      try { await mutateCab(cid, items => { const x = items.find(x => String(x.id) === id); if (x) x.qty = v }); addLog(`${it.name} (${cabName(cid)}): الكمية ${old} ← ${v}`) } catch (e) { fail(e); inp.value = old }
    };
    r.querySelectorAll('[data-d]').forEach(b => b.onclick = () => setQ((+inp.value || 0) + +b.dataset.d));
    inp.onchange = () => setQ(inp.value);
    r.querySelector('select').onchange = async e => {
      const it = find(); const v = e.target.value;
      try { await mutateCab(cid, items => { const x = items.find(x => String(x.id) === id); if (x) x.status = v }); addLog(`${it.name}: الحالة ← ${v}`); toast('تم تحديث الحالة') } catch (err) { fail(err) }
    };
    r.querySelector('.iconbtn').onclick = () => itemForm(id);
  });
}
function itemForm(id) {
  const ex = id ? allItems().find(x => String(x.id) === String(id)) : null;
  const it = ex || { cab: A.cab === 'all' ? CABS[0].id : +A.cab, group: A.g === 'all' ? '' : A.g, num: '', code: '', name: '', unit: 'عدد', qty: 0, status: 'سليم', note: '' };
  const groups = [...new Set(allItems().map(i => i.group))];
  openSheet(`<div class="shead"><span class="ib">${svg(id ? 'edit' : 'plus', '#0B5FA5', 22, 2)}</span><div><h3>${id ? 'تعديل صنف' : 'إضافة صنف جديد'}</h3><p>${id ? esc(it.name) : 'أدخل بيانات الصنف'}</p></div></div>
   <form id="if">
    <div class="field"><label for="fName">اسم الصنف</label><input class="inp" id="fName" maxlength="120" value="${esc(it.name)}"></div>
    <div class="seg2"><div class="field"><label for="fCab">الدولاب</label><select class="inp" id="fCab">${CABS.map(c => `<option value="${c.id}" ${it.cab == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="fGroup">القسم</label><select class="inp" id="fGroup"></select>
        <input class="inp" id="fGroupNew" placeholder="اسم القسم الجديد" maxlength="40" style="margin-top:6px" hidden></div></div>
    <div class="seg2"><div class="field"><label for="fQty">الكمية</label><input class="inp" id="fQty" type="number" min="0" value="${it.qty}"></div>
      <div class="field"><label for="fUnit">وحدة التخزين</label><input class="inp" id="fUnit" list="ul" value="${esc(it.unit)}"><datalist id="ul">${['عدد', 'متر', 'علبة', 'مجموعة', 'طقم', 'زوج', 'جرام'].map(u => `<option value="${u}">`).join('')}</datalist></div></div>
    <div class="seg2"><div class="field"><label for="fNum">رقم الصنف</label><input class="inp" id="fNum" value="${esc(it.num)}"></div>
      <div class="field"><label for="fCode">رمز الصنف</label><input class="inp" id="fCode" value="${esc(it.code)}"></div></div>
    <div class="field"><label for="fSt">الحالة</label><select class="inp" id="fSt">${STATUSES.map(s => `<option ${it.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="field"><label for="fNote">ملاحظة تظهر للزوار</label><input class="inp" id="fNote" maxlength="120" value="${esc(it.note)}" placeholder="اختياري"></div>
    <div class="btns"><button class="btn grow" id="fSave">حفظ</button><button type="button" class="btn sec" id="fC">إلغاء</button>${id ? '<button type="button" class="btn danger" id="fDel">حذف</button>' : ''}</div>
   </form>`);
  $('#fC').onclick = closeSheet;
  const fillGroups = keep => {
    const cid = +$('#fCab').value;
    const inCab = [...new Set(((cab(cid) || {}).items || []).map(i => i.group))];
    const others = groups.filter(g => !inCab.includes(g));
    const cur = keep || $('#fGroup').value;
    const opt = g => `<option value="${esc(g)}">${esc(g)}</option>`;
    $('#fGroup').innerHTML = (inCab.length ? `<optgroup label="أقسام ${esc(cabName(cid))}">${inCab.map(opt).join('')}</optgroup>` : '') +
      (others.length ? `<optgroup label="أقسام أخرى">${others.map(opt).join('')}</optgroup>` : '') + '<option value="__new">+ قسم جديد…</option>';
    $('#fGroup').value = [...inCab, ...others].includes(cur) ? cur : (inCab[0] || others[0] || '__new');
    $('#fGroupNew').hidden = $('#fGroup').value !== '__new';
  };
  fillGroups(it.group || null);
  $('#fCab').onchange = () => { $('#fGroup').value = ''; fillGroups() };
  $('#fGroup').onchange = () => { $('#fGroupNew').hidden = $('#fGroup').value !== '__new'; if (!$('#fGroupNew').hidden) $('#fGroupNew').focus() };
  if (id) $('#fDel').onclick = async () => {
    const b = $('#fDel'); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'اضغط للتأكيد'; return }
    b.disabled = true;
    try { await mutateCab(it.cab, items => { const k = items.findIndex(x => String(x.id) === String(id)); if (k >= 0) items.splice(k, 1) }); addLog(`حذف: ${it.name} (${cabName(it.cab)})`); closeSheet(); toast('تم الحذف') } catch (e) { fail(e); b.disabled = false }
  };
  $('#if').onsubmit = async e => {
    e.preventDefault();
    const d = { name: $('#fName').value.trim(), group: ($('#fGroup').value === '__new' ? $('#fGroupNew').value.trim() : $('#fGroup').value) || 'أخرى', qty: Math.max(0, Math.round(+$('#fQty').value || 0)), unit: $('#fUnit').value.trim() || 'عدد', num: $('#fNum').value.trim(), code: $('#fCode').value.trim(), status: $('#fSt').value, note: $('#fNote').value.trim() };
    const toCab = +$('#fCab').value;
    if (!d.name) { $('#fName').focus(); return }
    $('#fSave').disabled = true;
    try {
      if (id) {
        if (toCab === it.cab) await mutateCab(toCab, items => { const x = items.find(x => String(x.id) === String(id)); if (x) Object.assign(x, d) });
        else {
          const fromRef = doc(db, 'cabinets', String(it.cab)), toRef = doc(db, 'cabinets', String(toCab));
          await runTransaction(db, async tx => {
            const fs = await tx.get(fromRef), ts = await tx.get(toRef);
            const fi = (fs.data().items || []).map(x => ({ ...x })), ti = (ts.data().items || []).map(x => ({ ...x }));
            const k = fi.findIndex(x => String(x.id) === String(id)); const base = k >= 0 ? fi.splice(k, 1)[0] : { id };
            ti.push({ ...base, ...d }); tx.update(fromRef, { items: fi }); tx.update(toRef, { items: ti });
          });
        }
        addLog(`تعديل: ${d.name}${toCab !== it.cab ? ` (نُقل إلى ${cabName(toCab)})` : ''}`);
      } else {
        const nid = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await mutateCab(toCab, items => items.push({ id: nid, ...d }));
        addLog(`إضافة: ${d.name} (${cabName(toCab)}) — ${d.qty} ${d.unit}`);
      }
      closeSheet(); toast('تم الحفظ');
    } catch (err) { fail(err); $('#fSave').disabled = false }
  };
}
function aMsgs() {
  if (!MSGS.length) { $('#panel').innerHTML = `<div class="card empty">${svg('msg', '#4F6475', 30, 1.6)}لا توجد رسائل</div>`; return }
  $('#panel').innerHTML = `<div class="card">${MSGS.map(m => `<div class="msg ${m.done ? '' : 'new'}" data-id="${esc(m.id)}">
      <div class="mh">${m.done ? '' : '<span class="dot"></span>'}<b style="font-size:14px">${esc(m.who)}</b><span style="font-size:12px;color:var(--blue)">· ${esc(cabName(m.cab))}</span><span class="time">${ago(m.time)}</span></div>
      <div class="txt">${esc(m.note)}</div>
      <div class="btns">${m.done ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--green);font-weight:600">${svg('check', '#0F766E', 14, 2.4)}تمت المعالجة</span>` : '<button class="btn sm" data-a="done">تمت</button>'}<button class="btn sm danger" data-a="del">حذف</button></div>
    </div>`).join('')}</div>`;
  $('#panel').querySelectorAll('.msg').forEach(el => {
    const id = el.dataset.id;
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        if (b.dataset.a === 'done') await updateDoc(doc(db, 'messages', id), { done: true });
        if (b.dataset.a === 'del') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'اضغط للتأكيد'; b.disabled = false; return } await deleteDoc(doc(db, 'messages', id)) }
      } catch (e) { fail(e); b.disabled = false }
    });
  });
}
function qrSvg(url) {
  try {
    const q = qrcode(0, 'M'); q.addData(url); q.make(); const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++)for (let x = 0; x < n; x++)if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return `<svg class="code" viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges" role="img" aria-label="رمز QR"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#0E2233"/></svg>`
  } catch (e) { return `<div class="empty" style="width:170px;height:170px;padding:0;justify-content:center">${svg('qr', '#4F6475', 40, 1.4)}</div>` }
}
function aQR() {
  $('#panel').innerHTML = `<div class="card">
    <div class="bar-tools"><div style="flex:1;min-width:220px;font-size:13px;color:var(--muted)">كل رمز يفتح صفحة الدولاب على:<div dir="ltr" style="text-align:right;color:var(--ink);font-weight:600;word-break:break-all">${esc(baseUrl())}</div></div>
      <button class="btn sm sec" id="addCab">${svg('plus', '#0E2233', 16, 2.4)} إضافة دولاب</button></div>
    <div id="printArea"><div class="qrgrid">${CABS.map(c => {
      const url = baseUrl() + '#cab-' + c.id;
      const groups = [...new Set((c.items || []).map(i => i.group))];
      return `<div class="qrcard"><div class="qtop">${svg('atom', '#22B8CF', 26, 1.6)}<div><b>مختبر العلوم</b><small>${SCHOOL}</small></div></div>
        <div class="qbody"><div class="qname">${ptile(c.id, 58, 68, 26)}<h4>${esc(c.name)}</h4></div>
        <div class="qrbox"><i style="top:4px;right:4px;border-top-width:3px;border-right-width:3px;border-top-right-radius:8px"></i><i style="top:4px;left:4px;border-top-width:3px;border-left-width:3px;border-top-left-radius:8px"></i><i style="bottom:4px;right:4px;border-bottom-width:3px;border-right-width:3px;border-bottom-right-radius:8px"></i><i style="bottom:4px;left:4px;border-bottom-width:3px;border-left-width:3px;border-bottom-left-radius:8px"></i>${qrSvg(url)}</div>
        <div class="scan">${svg('qr', '#0B5FA5', 16, 2)}امسح الرمز لمعرفة محتويات الدولاب</div>
        <div class="minis" style="justify-content:center">${groups.map(g => `<span title="${esc(g)}">${icoBox(g, 'mini', 15)}</span>`).join('')}</div>
        <div class="tech">فني المختبر: ${TECH}</div>
        <button class="btn sm sec noprint" data-print="${c.id}" style="width:100%">${svg('qr', '#0B5FA5', 16, 2)} طباعة بطاقة ${esc(c.name)}</button></div></div>`
    }).join('')}</div></div>
    <div class="bar-tools"><button class="btn" id="prt">${svg('qr', '#fff', 18, 2)} طباعة كل البطاقات</button></div></div>`;
  $('#prt').onclick = () => doPrint(null);
  document.querySelectorAll('[data-print]').forEach(b => b.onclick = () => doPrint(b.closest('.qrcard')));
  $('#addCab').onclick = async () => {
    const id = Math.max(0, ...CABS.map(c => c.id)) + 1; const nm = 'الدولاب ' + (ORD[id - 1] || id);
    try { await setDoc(doc(db, 'cabinets', String(id)), { name: nm, items: [] }); addLog('إضافة: ' + nm); toast('أُضيف ' + nm) } catch (e) { fail(e) }
  };
}
function doPrint(card) {
  document.body.classList.toggle('print-one', !!card);
  document.querySelectorAll('.qrcard').forEach(c => c.classList.toggle('printing', c === card));
  try { window.print() } catch (e) { }
  setTimeout(() => { document.body.classList.remove('print-one'); document.querySelectorAll('.qrcard.printing').forEach(c => c.classList.remove('printing')) }, 600);
}
function aLog() {
  $('#panel').innerHTML = `<div class="card">${LOGS.length ? LOGS.map(l => `<div class="log"><span class="t">${new Date(tsMs(l.time)).toLocaleString('ar-OM', { dateStyle: 'short', timeStyle: 'short' })}</span><span>${esc(l.t)}${l.by ? `<span style="color:var(--muted);font-size:12px"> — ${esc(l.by)}</span>` : ''}</span></div>`).join('') : `<div class="empty">${svg('clock', '#4F6475', 30, 1.6)}لا توجد حركات بعد — أي تعديل في الكميات أو الحالة سيظهر هنا</div>`}</div>`;
}
async function aSet() {
  const owner = USER.email === OWNER;
  $('#panel').innerHTML = `<div class="card" style="padding:16px">
    <div class="field"><label>أسماء الدواليب</label>${CABS.map(c => `<input class="inp cabn" aria-label="اسم الدولاب ${c.id}" data-id="${c.id}" value="${esc(c.name)}" style="margin-bottom:6px">`).join('')}</div>
    <div class="field"><label>المشرفون (حسابات Google التي تدخل لوحة التحكم)</label>
      <div id="adm" style="display:grid;gap:6px;font-size:14px"><div dir="ltr" style="text-align:right">${esc(OWNER)} <span style="color:var(--muted)">(المالك)</span></div></div>
      ${owner ? `<div style="display:flex;gap:8px;margin-top:8px"><input class="inp" id="newAdm" dir="ltr" type="email" placeholder="example@gmail.com"><button class="btn sm" id="addAdm">إضافة</button></div>` : ''}
    </div>
    <div class="btns"><button class="btn sm sec" id="out">تسجيل الخروج</button></div></div>`;
  document.querySelectorAll('.cabn').forEach(i => i.onchange = async () => { const v = i.value.trim() || ('الدولاب ' + i.dataset.id); try { await updateDoc(doc(db, 'cabinets', i.dataset.id), { name: v }); addLog('تسمية: ' + v); toast('تم الحفظ') } catch (e) { fail(e) } });
  $('#out').onclick = async () => { await signOut(auth); location.hash = ''; };
  if (owner) {
    const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const list = async () => {
      try {
        const s = await getDocs(collection(db, 'admins'));
        $('#adm').innerHTML = `<div dir="ltr" style="text-align:right">${esc(OWNER)} <span style="color:var(--muted)">(المالك)</span></div>` + s.docs.map(d => `<div style="display:flex;align-items:center;gap:8px"><span dir="ltr" style="flex:1;text-align:right">${esc(d.id)}</span><button class="btn sm danger" data-rm="${esc(d.id)}">إزالة</button></div>`).join('');
        $('#adm').querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { try { await deleteDoc(doc(db, 'admins', b.dataset.rm)); addLog('إزالة مشرف: ' + b.dataset.rm); list() } catch (e) { fail(e) } });
      } catch (e) { }
    };
    list();
    $('#addAdm').onclick = async () => {
      const em = $('#newAdm').value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('اكتب بريداً صحيحاً'); return }
      try { await setDoc(doc(db, 'admins', em), { added: serverTimestamp() }); addLog('إضافة مشرف: ' + em); $('#newAdm').value = ''; list(); toast('تمت الإضافة') } catch (e) { fail(e) }
    };
  }
}

route();
