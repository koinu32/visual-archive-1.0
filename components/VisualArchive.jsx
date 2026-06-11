"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";

// ============================================================
// AI Visual Archive V4 — 浅色简洁版
// 视觉: 浅色系 · 简洁轻松 · 纯文字无图标
// 新增: 骨架加载 · 卡片打磨 · 搜索 · 上传进度 · 排序
// 数据: Supabase 持久化
// ============================================================

const FONT_LINK_ID = "va-fonts";
const SB = "https://usdmrfbwmvjboxwipvix.supabase.co";
const SK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzZG1yZmJ3bXZqYm94d2lwdml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDc3NjcsImV4cCI6MjA5NjU4Mzc2N30.4gbkWT2tjxq1udHMu6zXGSpezUlCLutN34FoTViYKOY";
const SH = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json" };

async function sbGet(t, q = "") { return (await fetch(`${SB}/rest/v1/${t}?${q}`, { headers: SH })).json(); }
async function sbInsert(t, d) { return (await fetch(`${SB}/rest/v1/${t}`, { method: "POST", headers: { ...SH, Prefer: "return=representation" }, body: JSON.stringify(d) })).json(); }
async function sbUpdate(t, id, d) { return (await fetch(`${SB}/rest/v1/${t}?id=eq.${id}`, { method: "PATCH", headers: { ...SH, Prefer: "return=representation" }, body: JSON.stringify(d) })).json(); }
async function sbDelete(t, id) { await fetch(`${SB}/rest/v1/${t}?id=eq.${id}`, { method: "DELETE", headers: SH }); }
async function sbUpload(b, p, blob, ct) { return (await fetch(`${SB}/storage/v1/object/${b}/${p}`, { method: "POST", headers: { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": ct, "x-upsert": "true" }, body: blob })).ok; }
function sbUrl(b, p) { return `${SB}/storage/v1/object/public/${b}/${p}`; }

function compressImage(dataUrl, maxW = 1200, q = 0.7) {
  return new Promise((res) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); const r = Math.min(maxW / img.width, 1); c.width = img.width * r; c.height = img.height * r; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => res(b), "image/jpeg", q); }; img.src = dataUrl; });
}
function urlToBase64(url) {
  return new Promise((res, rej) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").drawImage(img, 0, 0); res(c.toDataURL("image/jpeg", 0.9).split(",")[1]); }; img.onerror = rej; img.src = url; });
}
function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ base64: r.result.split(",")[1], dataUrl: r.result, type: file.type }); r.onerror = rej; r.readAsDataURL(file); });
}

async function analyzeImageFast(base64, mediaType, existingMedia = []) {
  const ml = existingMedia.length ? `已有媒介(优先归入,名称一致): ${existingMedia.map((m) => `${m.zh}/${m.en}`).join("、")}。不属于才新建。` : "";
  const sys = "视觉风格分析引擎。只返回JSON无前言无markdown。" + ml + '{"media":{"zh":"中文媒介","en":"英文"},"substyle":{"zh":"子风格","en":"substyle"},"tags":[{"zh":"中文","en":"en"}...最多6个],"palette":["#hex"x4]}。media粒度粗(用3D不是3D渲染)。';
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 500, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: sys }] }] }) });
  const d = await r.json(); return JSON.parse((d.content || []).map((i) => i.text || "").join("\n").replace(/```json|```/g, "").trim());
}
async function generatePromptAI(base64) {
  const sys = '只返回JSON:{"prompt_reverse":{"subject":"主体","style":"风格","lighting":"光影","color":"色调","material":"材质","composition":"构图","mood":"情绪"},"full_prompt":"Midjourney英文prompt逗号分隔"}';
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 700, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } }, { type: "text", text: sys }] }] }) });
  const d = await r.json(); return JSON.parse((d.content || []).map((i) => i.text || "").join("\n").replace(/```json|```/g, "").trim());
}

const MEDIA_ALIASES = { "3d":["3d","3d渲染","3d render","三维","cgi"], "摄影":["摄影","photography","photo","照片"], "设计":["设计","design","graphic design","平面"], "插画":["插画","illustration","插图"], "超现实":["超现实","surreal","surrealism","超现实主义"] };
function normMedia(n) { const s = (n||"").toLowerCase().trim(); for (const [k,v] of Object.entries(MEDIA_ALIASES)) { if (v.some(a => s===a||s.includes(a))) return k; } return s; }
const tagKey = (t) => (t.en||t.zh||"").toLowerCase().trim();
const sameTag = (a,b) => (a.zh&&a.zh===b.zh)||(a.en&&b.en&&a.en.toLowerCase()===b.en.toLowerCase());

// ========== 浅色系视觉常量 ==========
const C = {
  bg: "#f6f5f2",      // 温暖米白
  bg2: "#eeedea",     // 卡片/区域底色
  panel: "#ffffff",   // 浮层白
  line: "#e2e0db",    // 柔和分隔
  txt: "#1c1b18",     // 主文字
  dim: "#7a7770",     // 次要文字
  faint: "#b8b3ab",   // 极淡文字
  accent: "#1c1b18",  // 按钮/强调(沉稳深色)
  accentSoft: "#e8e6e1", // 轻柔强调背景
  shadow: "0 2px 12px rgba(0,0,0,.06)", // 柔和阴影
  shadowHover: "0 6px 24px rgba(0,0,0,.1)",
};
const serif = '"Noto Serif SC", serif';
const mono = '"JetBrains Mono", "SF Mono", monospace';
const sans = '"Noto Sans SC", system-ui, sans-serif';

// ============================================================
export default function App() {
  const [media, setMedia] = useState([]);
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState("inspiration");
  const [view, setView] = useState("library");
  const [activeMediaId, setActiveMediaId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [promptMode, setPromptMode] = useState("structured");
  const [filterTag, setFilterTag] = useState(null);
  const [toast, setToast] = useState(null);
  const [workDetail, setWorkDetail] = useState(null);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    if (!document.getElementById(FONT_LINK_ID)) {
      const l = document.createElement("link"); l.id = FONT_LINK_ID; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600&family=Noto+Sans+SC:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [mR, iR, wR] = await Promise.all([sbGet("media","order=created_at.asc"), sbGet("images","order=created_at.desc"), sbGet("works","order=created_at.desc")]);
        const mm = {}; (mR||[]).forEach(m => { m.images=[]; m.palette=m.palette||[]; mm[m.id]=m; });
        (iR||[]).forEach(im => { im.publicUrl=sbUrl("inspirations",im.storage_path); im.tags=im.tags||[]; im.substyle=im.substyle||null; im.analysis=im.analysis||{}; if(mm[im.media_id]) mm[im.media_id].images.push(im); });
        setMedia(Object.values(mm));
        setWorks((wR||[]).map(w => ({ ...w, publicUrl: w.storage_path ? sbUrl("works",w.storage_path) : "" })));
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const activeMedia = media.find(m => m.id === activeMediaId);
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  const ingest = useCallback(async (file, setStep) => {
    setStep("compress");
    const { base64, dataUrl, type } = await fileToBase64(file);
    setStep("analyze");
    const analysis = await analyzeImageFast(base64, type, media);
    const aiM = analysis.media || { zh:"未分类", en:"Uncategorized" };
    const aiK = normMedia(aiM.en)||normMedia(aiM.zh);
    let target = media.find(m => { const mk=normMedia(m.en),mz=normMedia(m.zh); return m.zh===aiM.zh||(m.en&&aiM.en&&m.en.toLowerCase()===aiM.en.toLowerCase())||mk===aiK||mz===aiK; });
    let isNew = false;
    if (!target) { const [c] = await sbInsert("media", { zh:aiM.zh, en:aiM.en, blurb:"AI 识别的新媒介。", palette:analysis.palette||[] }); target = { ...c, images:[], palette:c.palette||[] }; setMedia(p => [target,...p]); isNew = true; }
    setStep("upload");
    const blob = await compressImage(dataUrl, 1200, 0.7);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2,7)}.jpg`;
    await sbUpload("inspirations", path, blob, "image/jpeg");
    setStep("save");
    const [row] = await sbInsert("images", { media_id:target.id, storage_path:path, source:"upload", tags:analysis.tags||[], substyle:analysis.substyle||null, analysis });
    const img = { ...row, publicUrl:sbUrl("inspirations",path), tags:row.tags||[], analysis };
    setMedia(p => p.map(m => m.id===target.id ? { ...m, images:[img,...m.images] } : m));
    setStep("done");
    return { targetName:target.zh, isNew };
  }, [media]);

  const moveImage = useCallback(async (iid, from, to) => {
    await sbUpdate("images", iid, { media_id: to });
    setMedia(p => { let mv=null; return p.map(m => { if(m.id===from){const f=m.images.find(i=>i.id===iid);if(f)mv=f;return{...m,images:m.images.filter(i=>i.id!==iid)};} if(m.id===to&&mv)return{...m,images:[mv,...m.images]};return m;}); });
    setDetail(null);
  }, []);
  const updateTags = useCallback(async (iid, nt) => {
    await sbUpdate("images", iid, { tags: nt });
    setMedia(p => p.map(m => ({...m,images:m.images.map(i=>i.id===iid?{...i,tags:nt}:i)}))); setDetail(d => d&&d.id===iid?{...d,tags:nt}:d);
  }, []);
  const genPrompt = useCallback(async (img) => {
    const b64 = await urlToBase64(img.publicUrl); const pr = await generatePromptAI(b64);
    await sbUpdate("images", img.id, { prompt_data: pr }); const nx = { ...img.analysis, ...pr };
    setMedia(p => p.map(m => ({...m,images:m.images.map(i=>i.id===img.id?{...i,analysis:nx,prompt_data:pr}:i)}))); setDetail(d => d&&d.id===img.id?{...d,analysis:nx,prompt_data:pr}:d); return nx;
  }, []);
  const addWork = useCallback(async (w) => {
    let path=""; if(w.dataUrl){const blob=await compressImage(w.dataUrl,w.kind==="creation"?2000:1200,w.kind==="creation"?.85:.7);path=`${Date.now()}-${Math.random().toString(36).slice(2,7)}.jpg`;await sbUpload("works",path,blob,"image/jpeg");}
    const [row]=await sbInsert("works",{kind:w.kind,storage_path:path,title:w.title,prompt:w.prompt,note:w.note}); setWorks(p=>[{...row,publicUrl:path?sbUrl("works",path):""},...p]);
  }, []);
  const deleteWork = useCallback(async id => { await sbDelete("works",id); setWorks(p=>p.filter(w=>w.id!==id)); setWorkDetail(null); }, []);

  const allImages = media.flatMap(m => m.images.map(im => ({...im,_mediaZh:m.zh,_mediaId:m.id})));
  const tagMap = {}; allImages.forEach(im => (im.tags||[]).forEach(t => { const k=tagKey(t); if(k){if(!tagMap[k])tagMap[k]={tag:t,count:0};tagMap[k].count++;}}));
  const tagList = Object.values(tagMap).sort((a,b) => b.count-a.count);

  // 搜索:按标签的 zh/en 模糊匹配
  const searchResults = searchQ.trim() ? allImages.filter(im => {
    const q = searchQ.toLowerCase();
    return (im.tags||[]).some(t => (t.zh||"").includes(q)||(t.en||"").toLowerCase().includes(q)) || (im.substyle?.zh||"").includes(q) || (im.substyle?.en||"").toLowerCase().includes(q);
  }) : [];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}><Spinner /><div style={{ fontFamily:serif, fontSize:18, color:C.dim, marginTop:20 }}>正在加载档案馆…</div></div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.txt, fontFamily:sans }}>
      <style>{`
        *{box-sizing:border-box}::selection{background:${C.accent};color:${C.bg}}
        .va-fade{animation:vaFade .45s ease both}@keyframes vaFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes vaSpin{to{transform:rotate(360deg)}}
        .va-card{transition:transform .3s ease,box-shadow .3s ease;border-radius:10px;overflow:hidden;cursor:pointer}
        .va-card:hover{transform:translateY(-3px);box-shadow:${C.shadowHover}}
        .va-img-wrap{overflow:hidden;border-radius:8px;background:${C.bg2};position:relative;cursor:pointer}
        .va-img-wrap img{transition:opacity .4s ease,transform .4s ease;display:block;width:100%}
        .va-img-wrap:hover img{transform:scale(1.02)}
        .va-btn{transition:all .2s;cursor:pointer;border:none;outline:none}.va-btn:hover{opacity:.75}
        .va-scroll::-webkit-scrollbar{width:6px}.va-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:3px}
        .va-skeleton{background:linear-gradient(90deg,${C.bg2} 25%,${C.line} 50%,${C.bg2} 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>

      <Header zone={zone} view={view} activeMedia={activeMedia} filterTag={filterTag} searchQ={searchQ} setSearchQ={setSearchQ}
        onZone={z=>{setZone(z);if(z==="inspiration"){setView("library");setActiveMediaId(null);setFilterTag(null);setSearchQ("");}}}
        onHome={()=>{setZone("inspiration");setView("library");setActiveMediaId(null);setFilterTag(null);setSearchQ("");}} />

      {zone==="inspiration" && view==="library" && !searchQ.trim() && (
        <Library media={media} tagList={tagList} onIngest={ingest} onToast={showToast}
          onFilterTag={t=>{setFilterTag(t);setView("filter");}} onOpen={id=>{setActiveMediaId(id);setView("media");}} />
      )}
      {zone==="inspiration" && searchQ.trim() && (
        <SearchResults q={searchQ} images={searchResults} onOpenImage={setDetail} />
      )}
      {zone==="inspiration" && view==="filter" && filterTag && !searchQ.trim() && (
        <FilterView tag={filterTag} images={allImages.filter(im=>(im.tags||[]).some(t=>sameTag(t,filterTag)))}
          tagList={tagList} onPickTag={setFilterTag} onOpenImage={setDetail} onBack={()=>{setView("library");setFilterTag(null);}} />
      )}
      {zone==="inspiration" && view==="media" && activeMedia && !searchQ.trim() && (
        <MediaView media={activeMedia} onOpenImage={setDetail} />
      )}
      {zone==="studio" && <Studio works={works} onAdd={addWork} onOpen={setWorkDetail} onToast={showToast} />}

      {detail && <Detail img={detail} mode={promptMode} setMode={setPromptMode} onClose={()=>setDetail(null)}
        onUpdateTags={updateTags} onGeneratePrompt={genPrompt} mediaList={media} onMoveMedia={moveImage} />}
      {workDetail && <WorkDetail work={workDetail} onClose={()=>setWorkDetail(null)} onDelete={deleteWork} />}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ============================================================
function Header({ zone, view, activeMedia, filterTag, searchQ, setSearchQ, onZone, onHome }) {
  const tab = (z, label) => (
    <span onClick={()=>onZone(z)} className="va-btn"
      style={{ fontFamily:sans, fontSize:14, fontWeight:500, color:zone===z?C.txt:C.faint,
        borderBottom:zone===z?`2px solid ${C.accent}`:"2px solid transparent", paddingBottom:4 }}>{label}</span>
  );
  return (
    <header style={{ position:"sticky", top:0, zIndex:40, backdropFilter:"blur(24px)", background:"rgba(246,245,242,.85)",
      borderBottom:`1px solid ${C.line}`, padding:"16px 40px", display:"flex", alignItems:"center", gap:20 }}>
      <span onClick={onHome} className="va-btn" style={{ fontFamily:serif, fontSize:20, fontWeight:600, color:C.txt, letterSpacing:".5px" }}>视觉档案馆</span>
      <div style={{ display:"flex", gap:16, marginLeft:4 }}>{tab("inspiration","灵感")}{tab("studio","创作台")}</div>
      {zone==="inspiration" && (
        <div style={{ marginLeft:"auto", position:"relative" }}>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="搜索标签或风格…"
            style={{ fontFamily:sans, fontSize:13, background:C.bg2, border:`1px solid ${C.line}`, color:C.txt, padding:"8px 16px",
              borderRadius:20, outline:"none", width:220, transition:"all .2s" }}
            onFocus={e=>{e.target.style.borderColor=C.dim;e.target.style.width="280px"}}
            onBlur={e=>{e.target.style.borderColor=C.line;e.target.style.width="220px"}} />
        </div>
      )}
      {zone==="inspiration" && !searchQ.trim() && (view==="media"||view==="filter") && (
        <span style={{ fontFamily:mono, fontSize:12, color:C.dim }}>
          <span onClick={onHome} className="va-btn" style={{ color:C.faint }}>档案馆</span>{" / "}
          {view==="media"&&activeMedia?activeMedia.zh:filterTag?"#"+filterTag.zh:""}
        </span>
      )}
    </header>
  );
}

// ============================================================
function Library({ media, tagList, onIngest, onToast, onFilterTag, onOpen }) {
  return (
    <main style={{ padding:"48px 40px 100px", maxWidth:1400, margin:"0 auto" }} className="va-fade">
      <div style={{ marginBottom:32, maxWidth:600 }}>
        <h1 style={{ fontFamily:serif, fontSize:44, fontWeight:600, lineHeight:1.15, margin:0, color:C.txt }}>你的视觉档案馆</h1>
        <p style={{ color:C.dim, fontSize:15, lineHeight:1.7, marginTop:14 }}>粘贴或拖入灵感,AI 自动归档。数据永久保存。</p>
      </div>
      <HeroIngest media={media} onIngest={onIngest} onToast={onToast} />
      <TagBar tagList={tagList} onFilterTag={onFilterTag} />
      <div style={{ fontFamily:sans, fontSize:13, color:C.dim, fontWeight:500, paddingBottom:10, borderBottom:`1px solid ${C.line}`, marginBottom:22, letterSpacing:".5px" }}>按媒介浏览</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:20 }}>
        {media.map((m,i) => <MediaCard key={m.id} media={m} onClick={()=>onOpen(m.id)} index={i} />)}
      </div>
    </main>
  );
}

// ---------- 上传(含进度步骤) ----------
function HeroIngest({ media, onIngest, onToast }) {
  const [step, setStep] = useState(null); // null|compress|analyze|upload|save|done
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState(null);
  const inputRef = useRef();
  const STEPS = { compress:"压缩图片…", analyze:"AI 分析风格…", upload:"上传存储…", save:"写入档案…", done:"完成" };

  const handleFile = useCallback(async (file) => {
    if (!file||!file.type.startsWith("image/")) return;
    setErr(null);
    try {
      const { targetName, isNew } = await onIngest(file, setStep);
      onToast(isNew ? `已新建「${targetName}」并归档` : `已归入「${targetName}」`);
    } catch(e) { setErr("失败:"+(e.message||"请重试")); }
    finally { setTimeout(()=>setStep(null), 800); }
  }, [onIngest, onToast]);

  useEffect(() => {
    const onPaste = e => { const items = e.clipboardData?.items; if(!items)return; for(const it of items){if(it.type.startsWith("image/")){handleFile(it.getAsFile());break;}} };
    window.addEventListener("paste", onPaste); return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const busy = step && step !== "done";
  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
      onClick={()=>!busy&&inputRef.current?.click()} className="va-btn"
      style={{ border:`1.5px dashed ${drag?C.dim:C.line}`, borderRadius:12, padding:"36px 28px", textAlign:"center",
        background:drag?C.bg2:C.panel, boxShadow:drag?C.shadow:"none", transition:"all .25s", marginBottom:40 }}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={e=>handleFile(e.target.files[0])} />
      {busy ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16 }}>
          <Spinner />
          <div>
            <div style={{ fontFamily:sans, fontSize:14, color:C.txt, fontWeight:500 }}>{STEPS[step]}</div>
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              {["compress","analyze","upload","save"].map(s => (
                <div key={s} style={{ width:40, height:3, borderRadius:2, background: Object.keys(STEPS).indexOf(s) <= Object.keys(STEPS).indexOf(step) ? C.accent : C.line, transition:"all .3s" }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <><div style={{ fontFamily:serif, fontSize:22, color:C.txt, fontWeight:500 }}>粘贴 · 拖入 · 或点击上传</div>
          <div style={{ fontFamily:sans, fontSize:12, color:C.faint, marginTop:8 }}>⌘V 粘贴 · AI 自动识别媒介与风格 · 数据永久保存</div></>
      )}
      {err && <div style={{ color:"#c44", fontSize:12, marginTop:10 }}>{err}</div>}
    </div>
  );
}

function TagBar({ tagList, onFilterTag }) {
  if (tagList.length === 0) return null;
  return (
    <div style={{ marginBottom:40 }}>
      <div style={{ fontFamily:sans, fontSize:13, color:C.dim, fontWeight:500, paddingBottom:10, borderBottom:`1px solid ${C.line}`, marginBottom:14, letterSpacing:".5px" }}>标签 · 跨媒介筛选</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {tagList.map(({tag,count}) => (
          <span key={tagKey(tag)} onClick={()=>onFilterTag(tag)} className="va-btn"
            style={{ fontFamily:sans, fontSize:12, color:C.txt, background:C.panel, border:`1px solid ${C.line}`, boxShadow:"0 1px 3px rgba(0,0,0,.04)",
              padding:"5px 12px", borderRadius:16, display:"inline-flex", gap:6, alignItems:"baseline" }}>
            {tag.zh}{tag.en&&<span style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{tag.en}</span>}
            <span style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MediaCard({ media, onClick, index }) {
  const covers = media.images.slice(0,4);
  return (
    <div onClick={onClick} className="va-card va-fade" style={{ animationDelay:`${index*50}ms`, background:C.panel, boxShadow:C.shadow }}>
      <div style={{ height:170, display:"grid", gridTemplateColumns:covers.length>1?"1fr 1fr":"1fr", gridAutoRows:"1fr", gap:2, background:C.bg2 }}>
        {covers.length===0 ? (
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", gap:8 }}>
            <div style={{ display:"flex", gap:5 }}>{(media.palette||[]).map((c,i) => <div key={i} style={{ width:18, height:18, borderRadius:"50%", background:c }} />)}</div>
            <span style={{ fontFamily:sans, fontSize:11, color:C.faint }}>暂无灵感</span>
          </div>
        ) : covers.map((img,i) => <LazyImg key={i} src={img.publicUrl} style={{ width:"100%", height:"100%", objectFit:"cover", gridColumn:covers.length===1?"1/-1":"auto" }} />)}
      </div>
      <div style={{ padding:"18px 20px 22px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <h3 style={{ fontFamily:serif, fontSize:22, fontWeight:600, margin:0 }}>{media.zh}</h3>
            <span style={{ fontFamily:mono, fontSize:11, color:C.faint }}>{media.en}</span>
          </div>
          <span style={{ fontFamily:mono, fontSize:11, color:C.dim }}>{media.images.length}</span>
        </div>
        <p style={{ color:C.dim, fontSize:12, lineHeight:1.6, margin:"8px 0 0" }}>{media.blurb}</p>
      </div>
    </div>
  );
}

// ---------- 图片懒加载+骨架屏 ----------
function LazyImg({ src, style, className="" }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position:"relative", overflow:"hidden", ...(style?.height?{height:style.height}:{}), ...(style?.gridColumn?{gridColumn:style.gridColumn}:{}) }}>
      {!loaded && <div className="va-skeleton" style={{ position:"absolute", inset:0 }} />}
      <img src={src} alt="" onLoad={()=>setLoaded(true)}
        style={{ ...style, opacity:loaded?1:0, transition:"opacity .4s ease", position:loaded?"relative":"absolute" }}
        className={className} />
    </div>
  );
}

// ============================================================
function MediaView({ media, onOpenImage }) {
  const [sort, setSort] = useState("newest"); // newest|oldest
  const withMeta = media.images.map(im => ({...im,_mediaId:media.id,_mediaZh:media.zh}));
  const sorted = sort==="oldest" ? [...withMeta].reverse() : withMeta;
  return (
    <main style={{ padding:"48px 40px 100px", maxWidth:1400, margin:"0 auto" }} className="va-fade">
      <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:6 }}>
        <h1 style={{ fontFamily:serif, fontSize:38, fontWeight:600, margin:0 }}>{media.zh}</h1>
        <span style={{ fontFamily:mono, fontSize:16, color:C.faint }}>{media.en}</span>
      </div>
      <p style={{ color:C.dim, fontSize:13, margin:"0 0 6px", maxWidth:500, lineHeight:1.6 }}>{media.blurb}</p>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <span style={{ fontFamily:mono, fontSize:11, color:C.faint }}>{media.images.length} 张灵感</span>
        <div style={{ display:"flex", gap:4 }}>
          {[["newest","最新"],["oldest","最早"]].map(([k,l]) => (
            <button key={k} onClick={()=>setSort(k)} className="va-btn"
              style={{ fontFamily:sans, fontSize:11, padding:"4px 12px", borderRadius:12, border:`1px solid ${C.line}`,
                background:sort===k?C.accent:C.panel, color:sort===k?C.bg:C.dim }}>{l}</button>
          ))}
        </div>
      </div>
      {media.images.length===0 ? <Empty text="还没有内容,回首页拖一张图进来。" />
        : <MasonryGrid images={sorted} onOpen={onOpenImage} />}
    </main>
  );
}

// ============================================================
function SearchResults({ q, images, onOpenImage }) {
  return (
    <main style={{ padding:"48px 40px 100px", maxWidth:1400, margin:"0 auto" }} className="va-fade">
      <h1 style={{ fontFamily:serif, fontSize:32, fontWeight:600, margin:"0 0 4px" }}>搜索「{q}」</h1>
      <p style={{ color:C.dim, fontSize:13, margin:"0 0 28px" }}>找到 {images.length} 张匹配的灵感</p>
      {images.length===0 ? <Empty text="没有找到匹配的灵感,试试换个关键词。" />
        : <MasonryGrid images={images} onOpen={onOpenImage} showMedia />}
    </main>
  );
}

function FilterView({ tag, images, tagList, onPickTag, onOpenImage, onBack }) {
  return (
    <main style={{ padding:"48px 40px 100px", maxWidth:1400, margin:"0 auto" }} className="va-fade">
      <span onClick={onBack} className="va-btn" style={{ fontFamily:sans, fontSize:12, color:C.faint }}>← 返回</span>
      <h1 style={{ fontFamily:serif, fontSize:36, fontWeight:600, margin:"8px 0 4px" }}>
        <span style={{ color:C.faint }}>#</span> {tag.zh}
        {tag.en && <span style={{ fontFamily:mono, fontSize:16, color:C.faint, marginLeft:10 }}>{tag.en}</span>}
      </h1>
      <p style={{ color:C.dim, fontSize:13, margin:"0 0 24px" }}>{images.length} 张灵感</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:32 }}>
        {tagList.map(({tag:t,count}) => { const a=sameTag(t,tag); return (
          <span key={tagKey(t)} onClick={()=>onPickTag(t)} className="va-btn"
            style={{ fontFamily:sans, fontSize:12, color:a?C.bg:C.txt, background:a?C.accent:C.panel, border:`1px solid ${a?C.accent:C.line}`,
              padding:"5px 12px", borderRadius:16 }}>{t.zh} <span style={{ fontFamily:mono, fontSize:10, color:a?"rgba(255,255,255,.6)":C.faint }}>{count}</span></span>
        );})}
      </div>
      {images.length===0?<Empty text="暂无匹配。" />:<MasonryGrid images={images} onOpen={onOpenImage} showMedia />}
    </main>
  );
}

function MasonryGrid({ images, onOpen, showMedia }) {
  return (
    <div style={{ columns:"4 240px", columnGap:14 }}>
      {images.map((img,i) => (
        <div key={img.id} onClick={()=>onOpen(img)} className="va-img-wrap va-fade" style={{ animationDelay:`${i*30}ms`, marginBottom:14 }}>
          <LazyImg src={img.publicUrl} style={{ width:"100%", borderRadius:8 }} />
          {showMedia && img._mediaZh && (
            <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"18px 10px 8px", borderRadius:"0 0 8px 8px",
              background:"linear-gradient(transparent,rgba(0,0,0,.55))", fontFamily:sans, fontSize:10, color:"#fff" }}>{img._mediaZh}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
function Detail({ img, mode, setMode, onClose, onUpdateTags, onGeneratePrompt, mediaList=[], onMoveMedia }) {
  const [copied,setCopied] = useState(false);
  const [addingTag,setAddingTag] = useState(false);
  const [tagVal,setTagVal] = useState("");
  const [genBusy,setGenBusy] = useState(false);
  const [genErr,setGenErr] = useState(null);
  const [moveOpen,setMoveOpen] = useState(false);
  const a = {...(img.analysis||{}),...(img.prompt_data||{})};
  const tags = img.tags||[];
  const pr = a.prompt_reverse||{};
  const hasPrompt = !!a.full_prompt;
  const fields = [["主体/场景",pr.subject],["风格/流派",pr.style],["光影",pr.lighting],["色调",pr.color],["材质/质感",pr.material],["构图/镜头",pr.composition],["情绪",pr.mood]];

  const copy = () => { navigator.clipboard?.writeText(a.full_prompt||""); setCopied(true); setTimeout(()=>setCopied(false),1500); };
  const doGen = async () => { setGenErr(null);setGenBusy(true);try{await onGeneratePrompt(img);}catch(e){setGenErr("失败");}finally{setGenBusy(false);}};
  const rmTag = t => onUpdateTags(img.id,tags.filter(x=>!sameTag(x,t)));
  const addTag = () => { const v=tagVal.trim(); if(v&&!tags.some(t=>t.zh===v||t.en===v)){const iz=/[\u4e00-\u9fa5]/.test(v); onUpdateTags(img.id,[...tags,iz?{zh:v,en:""}:{zh:v,en:v}]);} setTagVal("");setAddingTag(false); };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,.3)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div onClick={e=>e.stopPropagation()} className="va-fade va-scroll"
        style={{ background:C.panel, borderRadius:12, maxWidth:960, width:"100%", maxHeight:"88vh", overflow:"auto",
          display:"grid", gridTemplateColumns:"1fr 1fr", boxShadow:"0 16px 48px rgba(0,0,0,.15)" }}>
        <div style={{ background:C.bg2, display:"flex", alignItems:"center", justifyContent:"center", padding:20, borderRadius:"12px 0 0 12px" }}>
          <img src={img.publicUrl} alt="" style={{ maxWidth:"100%", maxHeight:"78vh", borderRadius:6 }} />
        </div>
        <div style={{ padding:"32px 32px 36px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{(img.source||"upload").toUpperCase()} · {(img.created_at||"").slice(0,10)}</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap", position:"relative" }}>
                {a.media && <span style={{ fontFamily:serif, fontSize:16, color:C.txt, fontWeight:500 }}>{a.media.zh}<span style={{ fontFamily:mono, fontSize:10, color:C.faint, marginLeft:5 }}>{a.media.en}</span></span>}
                {img.substyle?.zh && <span style={{ fontFamily:mono, fontSize:11, color:C.dim }}>/ {img.substyle.zh}</span>}
                {onMoveMedia && img._mediaId && (
                  <span style={{ position:"relative" }}>
                    <span onClick={()=>setMoveOpen(v=>!v)} className="va-btn" style={{ fontFamily:sans, fontSize:10, color:C.dim, border:`1px solid ${C.line}`, padding:"3px 10px", borderRadius:10 }}>移动</span>
                    {moveOpen && (
                      <div className="va-scroll" style={{ position:"absolute", top:"120%", left:0, zIndex:10, background:C.panel, border:`1px solid ${C.line}`, borderRadius:8, padding:6, minWidth:150, boxShadow:C.shadowHover }}>
                        {mediaList.filter(m=>m.id!==img._mediaId).map(m => (
                          <div key={m.id} onClick={()=>{onMoveMedia(img.id,img._mediaId,m.id);setMoveOpen(false);}} className="va-btn"
                            style={{ fontFamily:sans, fontSize:12, color:C.txt, padding:"7px 8px", borderRadius:6 }}>{m.zh}</div>
                        ))}
                      </div>
                    )}
                  </span>
                )}
              </div>
            </div>
            <span onClick={onClose} className="va-btn" style={{ fontSize:20, color:C.faint, lineHeight:1, paddingLeft:10 }}>×</span>
          </div>

          <div style={{ marginTop:14, display:"flex", flexWrap:"wrap", gap:5 }}>
            {tags.map(t => (
              <span key={tagKey(t)+t.zh} style={{ fontFamily:sans, fontSize:11, color:C.txt, background:C.bg2, border:`1px solid ${C.line}`,
                padding:"3px 4px 3px 10px", borderRadius:12, display:"inline-flex", alignItems:"baseline", gap:4 }}>
                {t.zh}{t.en&&<span style={{ fontFamily:mono, fontSize:9, color:C.faint }}>{t.en}</span>}
                <span onClick={()=>rmTag(t)} className="va-btn" style={{ color:C.faint, fontSize:12, lineHeight:1, padding:"0 3px" }}>×</span>
              </span>
            ))}
            {addingTag ? <input autoFocus value={tagVal} onChange={e=>setTagVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} onBlur={addTag}
              placeholder="回车添加" style={{ fontFamily:sans, fontSize:11, background:C.bg2, border:`1px solid ${C.dim}`, color:C.txt, padding:"3px 10px", borderRadius:12, outline:"none", width:80 }} />
              : <span onClick={()=>setAddingTag(true)} className="va-btn" style={{ fontFamily:sans, fontSize:11, color:C.faint, border:`1px dashed ${C.line}`, padding:"3px 10px", borderRadius:12 }}>+</span>}
          </div>

          {a.palette && <div style={{ marginTop:22 }}>
            <SL>色彩</SL>
            <div style={{ display:"flex", gap:6 }}>{a.palette.map((c,i) => <div key={i} style={{ flex:1 }}><div style={{ height:32, background:c, borderRadius:6, border:`1px solid ${C.line}` }} /><div style={{ fontFamily:mono, fontSize:9, color:C.faint, marginTop:3, textAlign:"center" }}>{c}</div></div>)}</div>
          </div>}

          <div style={{ marginTop:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <SL noLine>Prompt 反推</SL>
              {hasPrompt && <div style={{ display:"flex", gap:4 }}>
                {["structured","full"].map(m => <button key={m} onClick={()=>setMode(m)} className="va-btn"
                  style={{ fontFamily:sans, fontSize:10, padding:"3px 10px", borderRadius:10, border:`1px solid ${C.line}`,
                    background:mode===m?C.accent:C.panel, color:mode===m?C.bg:C.dim }}>{m==="structured"?"结构化":"完整"}</button>)}
              </div>}
            </div>
            {!hasPrompt ? (
              <div style={{ border:`1px dashed ${C.line}`, borderRadius:10, padding:"24px 16px", textAlign:"center", background:C.bg }}>
                {genBusy ? <><Spinner /><div style={{ fontFamily:sans, fontSize:12, color:C.dim, marginTop:10 }}>正在反推…</div></>
                  : <><div style={{ fontFamily:sans, fontSize:13, color:C.dim, marginBottom:12 }}>想复刻这张图?让 AI 反推 Prompt。</div>
                    <button onClick={doGen} className="va-btn" style={{ fontFamily:sans, fontSize:12, padding:"8px 20px", borderRadius:8, border:"none", background:C.accent, color:C.bg }}>生成 Prompt</button>
                    {genErr&&<div style={{ color:"#c44", fontSize:11, marginTop:8 }}>{genErr}</div>}</>}
              </div>
            ) : (<>
              {mode==="structured" ? (
                <div style={{ borderRadius:8, overflow:"hidden", border:`1px solid ${C.line}` }}>
                  {fields.map(([l,v],i) => <div key={l} style={{ display:"grid", gridTemplateColumns:"80px 1fr", padding:"9px 14px", gap:10, background:i%2===0?C.bg:C.panel }}>
                    <span style={{ fontFamily:sans, fontSize:10, color:C.faint }}>{l}</span><span style={{ fontSize:13, color:C.txt, lineHeight:1.5 }}>{v||"—"}</span></div>)}
                </div>
              ) : <div style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:14, fontFamily:mono, fontSize:12, lineHeight:1.7, color:C.txt }}>{a.full_prompt||"—"}</div>}
              <button onClick={copy} className="va-btn" style={{ marginTop:12, width:"100%", fontFamily:sans, fontSize:12, padding:"10px", borderRadius:8, border:`1px solid ${C.line}`, background:copied?C.accent:C.panel, color:copied?C.bg:C.txt }}>
                {copied?"已复制":"复制 Prompt"}</button>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
function Studio({ works, onAdd, onOpen, onToast }) {
  const [tab,setTab] = useState("creation");
  const [formOpen,setFormOpen] = useState(false);
  const list = works.filter(w => w.kind===tab);
  const tb = (k,l) => <span onClick={()=>{setTab(k);setFormOpen(false);}} className="va-btn"
    style={{ fontFamily:sans, fontSize:14, fontWeight:500, color:tab===k?C.txt:C.faint, borderBottom:tab===k?`2px solid ${C.accent}`:"2px solid transparent", paddingBottom:4 }}>{l}</span>;
  return (
    <main style={{ padding:"48px 40px 100px", maxWidth:1400, margin:"0 auto" }} className="va-fade">
      <div style={{ maxWidth:600, marginBottom:28 }}>
        <h1 style={{ fontFamily:serif, fontSize:44, fontWeight:600, lineHeight:1.15, margin:0 }}>创作台</h1>
        <p style={{ color:C.dim, fontSize:15, lineHeight:1.7, marginTop:14 }}>你的作品与珍藏 Prompt。</p>
      </div>
      <div style={{ display:"flex", gap:20, alignItems:"center", paddingBottom:12, borderBottom:`1px solid ${C.line}`, marginBottom:24 }}>
        {tb("creation","我的创作")}{tb("prompt","Prompt 收藏")}
        <span onClick={()=>setFormOpen(v=>!v)} className="va-btn"
          style={{ marginLeft:"auto", fontFamily:sans, fontSize:12, color:formOpen?C.bg:C.txt, background:formOpen?C.accent:C.panel, border:`1px solid ${C.line}`, padding:"7px 16px", borderRadius:8 }}>
          {formOpen?"收起":tab==="creation"?"+ 作品":"+ Prompt"}</span>
      </div>
      {formOpen && <WorkForm kind={tab} onSubmit={async w=>{await onAdd(w);setFormOpen(false);onToast(tab==="creation"?"已保存":"已收藏");}} />}
      {list.length===0 ? <Empty text={tab==="creation"?"还没有作品。点右上角添加。":"还没有收藏的 Prompt。"} />
        : <div style={{ columns:"4 240px", columnGap:14 }}>{list.map((w,i) => <WorkCard key={w.id} work={w} index={i} onClick={()=>onOpen(w)} />)}</div>}
    </main>
  );
}

function WorkForm({ kind, onSubmit }) {
  const [dataUrl,setDataUrl]=useState(null);const [title,setTitle]=useState("");const [prompt,setPrompt]=useState("");const [note,setNote]=useState("");const [busy,setBusy]=useState(false);
  const inputRef=useRef();
  const pick=async f=>{if(!f||!f.type.startsWith("image/"))return;const{dataUrl}=await fileToBase64(f);setDataUrl(dataUrl);};
  const go=async()=>{if(!dataUrl||busy)return;setBusy(true);try{await onSubmit({kind,dataUrl,title:title.trim(),prompt:prompt.trim(),note:note.trim()});}finally{setBusy(false);}};
  const is={width:"100%",background:C.bg,border:`1px solid ${C.line}`,color:C.txt,borderRadius:8,padding:"10px 12px",fontFamily:sans,fontSize:13,outline:"none",resize:"vertical"};
  return (
    <div className="va-fade" style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:18, border:`1px solid ${C.line}`, borderRadius:12, padding:20, marginBottom:28, background:C.panel, boxShadow:C.shadow }}>
      <div onClick={()=>inputRef.current?.click()} className="va-btn"
        style={{ aspectRatio:"1", border:`1.5px dashed ${dataUrl?"transparent":C.line}`, borderRadius:8,
          background:dataUrl?`url(${dataUrl}) center/cover`:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={e=>pick(e.target.files[0])} />
        {!dataUrl&&<span style={{ fontFamily:sans, fontSize:11, color:C.faint }}>上传配图</span>}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={kind==="creation"?"标题":"名称"} style={is} />
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Prompt" rows={3} style={{...is,fontFamily:mono,fontSize:12}} />
        {kind==="creation"&&<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="备注(可选)" rows={2} style={is} />}
        <button onClick={go} className="va-btn" style={{ alignSelf:"flex-start", fontFamily:sans, fontSize:12, padding:"8px 20px", borderRadius:8,
          border:"none", background:dataUrl&&!busy?C.accent:C.line, color:dataUrl&&!busy?C.bg:C.faint }}>{busy?"保存中…":"保存"}</button>
      </div>
    </div>
  );
}

function WorkCard({ work, index, onClick }) {
  return (
    <div onClick={onClick} className="va-img-wrap va-fade" style={{ animationDelay:`${index*30}ms`, marginBottom:14 }}>
      {work.publicUrl && <LazyImg src={work.publicUrl} style={{ width:"100%", borderRadius:8 }} />}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"20px 10px 8px", borderRadius:"0 0 8px 8px", background:"linear-gradient(transparent,rgba(0,0,0,.6))" }}>
        {work.title&&<div style={{ fontFamily:serif, fontSize:13, color:"#fff" }}>{work.title}</div>}
        {work.kind==="creation"&&<span style={{ fontFamily:sans, fontSize:9, color:"rgba(255,255,255,.7)" }}>我的创作</span>}
      </div>
    </div>
  );
}

function WorkDetail({ work, onClose, onDelete }) {
  const [copied,setCopied]=useState(false);
  const copy=()=>{navigator.clipboard?.writeText(work.prompt||"");setCopied(true);setTimeout(()=>setCopied(false),1500);};
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,.3)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div onClick={e=>e.stopPropagation()} className="va-fade va-scroll"
        style={{ background:C.panel, borderRadius:12, maxWidth:900, width:"100%", maxHeight:"88vh", overflow:"auto", display:"grid", gridTemplateColumns:"1fr 1fr", boxShadow:"0 16px 48px rgba(0,0,0,.15)" }}>
        <div style={{ background:C.bg2, display:"flex", alignItems:"center", justifyContent:"center", padding:20, borderRadius:"12px 0 0 12px" }}>
          {work.publicUrl&&<img src={work.publicUrl} alt="" style={{ maxWidth:"100%", maxHeight:"78vh", borderRadius:6 }} />}
        </div>
        <div style={{ padding:"32px 32px 36px" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div><div style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{work.kind==="creation"?"我的创作":"Prompt 收藏"} · {(work.created_at||"").slice(0,10)}</div>
              {work.title&&<div style={{ fontFamily:serif, fontSize:22, fontWeight:500, marginTop:6 }}>{work.title}</div>}</div>
            <span onClick={onClose} className="va-btn" style={{ fontSize:20, color:C.faint }}>×</span>
          </div>
          {work.prompt&&<div style={{ marginTop:20 }}><SL>Prompt</SL>
            <div style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:14, fontFamily:mono, fontSize:12, lineHeight:1.7, color:C.txt }}>{work.prompt}</div>
            <button onClick={copy} className="va-btn" style={{ marginTop:10, width:"100%", fontFamily:sans, fontSize:12, padding:"9px", borderRadius:8, border:`1px solid ${C.line}`, background:copied?C.accent:C.panel, color:copied?C.bg:C.txt }}>{copied?"已复制":"复制 Prompt"}</button>
          </div>}
          {work.note&&<div style={{ marginTop:20 }}><SL>备注</SL><p style={{ fontSize:13, color:C.dim, lineHeight:1.7, margin:0 }}>{work.note}</p></div>}
          <div style={{ marginTop:24, paddingTop:16, borderTop:`1px solid ${C.line}` }}>
            <span onClick={()=>onDelete(work.id)} className="va-btn" style={{ fontFamily:sans, fontSize:11, color:C.faint, border:`1px solid ${C.line}`, padding:"6px 14px", borderRadius:8 }}>删除</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
function SL({ children, noLine }) {
  return <div style={{ fontFamily:sans, fontSize:11, color:C.dim, fontWeight:500, letterSpacing:".5px", paddingBottom:noLine?0:8,
    borderBottom:noLine?"none":`1px solid ${C.line}`, marginBottom:noLine?0:14 }}>{children}</div>;
}
function Spinner() { return <div style={{ width:22, height:22, border:`2px solid ${C.line}`, borderTopColor:C.accent, borderRadius:"50%", margin:"0 auto", animation:"vaSpin .8s linear infinite" }} />; }
function Toast({ msg }) { return <div className="va-fade" style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:200,
  background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"10px 20px", fontFamily:sans, fontSize:13, color:C.txt, boxShadow:"0 4px 20px rgba(0,0,0,.1)" }}>{msg}</div>; }
function Empty({ text }) { return <div style={{ padding:"60px 0", textAlign:"center" }}>
  <div style={{ fontFamily:serif, fontSize:18, color:C.faint }}>{text}</div>
</div>; }
