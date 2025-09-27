const FALLBACK_IMG = "https://dummyimage.com/800x450/eaeaea/6b7280&text=EMUFRN";
const MONTHS_PT=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

// 🔗 SUA URL do Apps Script (Web App /exec)
const DATA_URL = "https://script.google.com/macros/s/AKfycbywqPA3PGsJkPhO0C8SZAax5m4_L-UjLkaP468c0ENEIjfu-n3LJ3MMPnYEgpKmOkUd/exec";

/* =========================
   PARSER DE DATA ROBUSTO
   Aceita:
   - "2025-12-05"
   - "2025-12-05T20:00:00-03:00"
   - "05/12/2025"
   - "05/12/2025 20:00"
   - "05-12-2025" etc.
   ========================= */
function parseDate(input) {
  if (input instanceof Date) return input;
  if (input == null) return new Date(NaN);

  // 1) Tenta nativo (cobre ISO)
  let d = new Date(input);
  if (!isNaN(d)) return d;

  const s = String(input).trim();

  // 2) yyyy-mm-dd (sem hora) -> assume 00:00
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00-03:00`);

  // 3) dd/mm/yyyy [HH:mm]? ou dd-mm-yyyy [HH:mm]?
  m = s.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})(?:[ T](\d{2}):(\d{2}))?$/);
  if (m) {
    const [, dd, mm, yyyy, HH='00', MM='00'] = m;
    return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:00-03:00`);
  }

  // 4) Último recurso: inválida
  return new Date(NaN);
}

// Para exibir mês/dia nos cards
function fmtDate(d){
  const dt = parseDate(d);
  if (isNaN(dt)) return { m: "--", d: "--" };
  return { m: MONTHS_PT[dt.getMonth()], d: String(dt.getDate()).padStart(2,"0") };
}

function withCacheBust(url){
  if(!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'v=' + Date.now();
}

function imgWithFallback(src, alt){
  const img=new Image();
  img.loading="lazy";
  img.alt=alt||"";
  img.src=withCacheBust(src || FALLBACK_IMG);
  img.onerror=()=>{ img.src = withCacheBust(FALLBACK_IMG); };
  return img;
}

function render(list){
  const root=document.getElementById("lista"), empty=document.getElementById("vazio");
  root.innerHTML="";
  if(!list.length){ empty.style.display="block"; return; }
  empty.style.display="none";

  list.forEach(ev=>{
    const {m,d}=fmtDate(ev.date);

    const card=document.createElement("article");
    card.className="card";
    card.setAttribute("role","listitem");

    // imagem do cartaz
    const imgWrap=document.createElement("div");
    imgWrap.className="card-img";
    imgWrap.appendChild(imgWithFallback(ev.image, `Cartaz do evento ${ev.title}`));
    card.appendChild(imgWrap);

    // corpo
    const body=document.createElement("div");
    body.className="card-body";

    const date=document.createElement("div");
    date.className="date";
    date.innerHTML=`<div class="m">${m}</div><div class="d">${d}</div>`;

    const content=document.createElement("div");
    content.className="content";

    // ✅ usa exatamente o que veio na planilha (coluna 'time'), sem conversão
    const horario = ev.time ? String(ev.time) : "";

    content.innerHTML=`
      <h3 class="title">${ev.title || ""}</h3>
      <div class="meta">
        ${horario ? `<span>${horario}</span><span>•</span>` : ""}
        <span>${ev.venue || ""}</span>
        ${ev.city ? `<span>•</span><span>${ev.city}</span>` : ""}
      </div>
      ${ev.artists? `<div class="meta">${ev.artists}</div>` : ""}
      <div class="tags">
        ${ev.price? `<span class="tag">${ev.price}</span>`: ""}
        ${ev.status==='ok'? `<span class="tag ok">Confirmado</span>`
          : ev.status==='warn'? `<span class="tag warn">Inscrições</span>`
          : ev.status==='bad'? `<span class="tag bad">Cancelado</span>` : ""}
        ${ev.type? `<span class="tag">${ev.type}</span>` : ""}
      </div>
      <div class="actions">
        ${ev.link? `<a class="btn primary" href="${ev.link}" target="_blank" rel="noopener">Ingressos/Inscrição</a>` : ""}
      </div>
    `;

    body.appendChild(date);
    body.appendChild(content);
    card.appendChild(body);
    root.appendChild(card);
  });
}

// Filtros (mostra apenas hoje em diante)
function aplicaFiltros(data){
  const tipo  = (document.getElementById("filtroTipo")?.value || "").toLowerCase();
  const local = (document.getElementById("filtroLocal")?.value || "").toLowerCase();
  const q     = (document.getElementById("busca")?.value || "").toLowerCase();

  const today = new Date(); today.setHours(0,0,0,0);

  return data
    // só hoje em diante
    .filter(e => {
      const dt = parseDate(e.date);
      return !isNaN(dt) && dt >= today;
    })
    // filtros opcionais
    .filter(e => !tipo  || (e.type||"").toLowerCase() === tipo)
    .filter(e => !local || (e.venue||"").toLowerCase().includes(local))
    .filter(e => !q     || ((e.title||"")+" "+(e.artists||"")+" "+(e.venue||"")).toLowerCase().includes(q))
    // ordenação por data
    .sort((a,b)=> parseDate(a.date) - parseDate(b.date));
}

let _CACHE = [];

async function carregarEventos(){
  try{
    const res=await fetch(DATA_URL + "?v=" + Date.now(), {cache:'no-store'});
    if(!res.ok){
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
    }
    const data=await res.json();
    _CACHE=data;
    render(aplicaFiltros(_CACHE));
  }catch(e){
    console.error(e);
    document.getElementById("lista").innerHTML =
      `<div class="empty">Não foi possível carregar os eventos agora.</div>`;
  }
}

["filtroTipo","filtroLocal","busca"].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener("input",()=> render(aplicaFiltros(_CACHE)));
});

document.getElementById("year").textContent=new Date().getFullYear();
carregarEventos();