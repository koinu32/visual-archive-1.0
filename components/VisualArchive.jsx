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

// ============================================================
// 设置面板:管理 AI 接口(增删改 + 选择当前激活的)
// ============================================================
function SettingsPanel({ providers, activeId, onChange, onClose }) {
  const [list, setList] = useState(providers);
  const [aid, setAid] = useState(activeId);
  const [editing, setEditing] = useState(null); // provider id 或 "new"

  const commit = (newList, newAid) => { setList(newList); if(newAid)setAid(newAid); onChange(newList, newAid||aid); };
  const updateField = (id, key, val) => commit(list.map(p => p.id===id ? {...p, [key]:val} : p));
  const addNew = () => {
    const id = "custom-" + Date.now().toString(36);
    const np = { id, label:"自定义接口", type:"openai", baseUrl:"", model:"", apiKey:"" };
    commit([...list, np]); setEditing(id);
  };
  const removeOne = (id) => {
    if (list.length<=1) return;
    const nl = list.filter(p => p.id!==id);
    const nAid = id===aid ? nl[0].id : aid;
    commit(nl, nAid);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", zIndex:300,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.panel, borderRadius:14, width:"100%", maxWidth:680, maxHeight:"85vh",
        overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }} className="va-scroll">
        <div style={{ padding:"24px 28px 16px", borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:serif, fontSize:22, fontWeight:600, color:C.txt }}>AI 接口配置</div>
            <div style={{ fontFamily:sans, fontSize:12, color:C.dim, marginTop:6 }}>服务端豆包 Key 读取环境变量; 浏览器直连接口 Key 仅存于本机 localStorage。</div>
          </div>
          <span onClick={onClose} className="va-btn" style={{ marginLeft:"auto", fontFamily:mono, fontSize:12, color:C.dim,
            border:`1px solid ${C.line}`, padding:"6px 12px", borderRadius:14 }}>关闭</span>
        </div>

        <div style={{ padding:"16px 28px 28px" }}>
          {list.map(p => {
            const isActive = p.id === aid;
            const isOpen = editing === p.id;
            const keyStatus = p.type === "server-openai" ? "服务端 Key" : ((p.apiKey && p.apiKey.trim()) ? "✓ Key 已配置" : "✗ Key 未填");
            return (
              <div key={p.id} style={{ border:`1px solid ${isActive?C.accent:C.line}`, borderRadius:10, marginBottom:10, overflow:"hidden",
                background: isActive ? C.accentSoft : "transparent" }}>
                <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <span onClick={()=>commit(list, p.id)} className="va-btn" style={{
                    width:18, height:18, borderRadius:"50%", border:`2px solid ${isActive?C.accent:C.line}`,
                    background: isActive?C.accent:"transparent", flexShrink:0, position:"relative",
                  }}>
                    {isActive && <span style={{ position:"absolute", inset:3, background:C.bg, borderRadius:"50%" }} />}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:sans, fontSize:14, fontWeight:500, color:C.txt }}>{p.label}</div>
                    <div style={{ fontFamily:mono, fontSize:11, color:C.dim, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {p.type} · {p.model || "(未填模型)"} · {keyStatus}
                    </div>
                  </div>
                  <span onClick={()=>setEditing(isOpen?null:p.id)} className="va-btn" style={{
                    fontFamily:mono, fontSize:11, color:C.dim, border:`1px solid ${C.line}`, padding:"4px 10px", borderRadius:12, background:C.panel,
                  }}>{isOpen?"收起":"编辑"}</span>
                  {list.length>1 && (
                    <span onClick={()=>{ if(confirm(`删除「${p.label}」?`)) removeOne(p.id); }} className="va-btn" style={{
                      fontFamily:mono, fontSize:11, color:"#b04848", border:`1px solid ${C.line}`, padding:"4px 10px", borderRadius:12, background:C.panel,
                    }}>删除</span>
                  )}
                </div>
                {isOpen && (
                  <div style={{ padding:"4px 16px 16px", borderTop:`1px dashed ${C.line}`, background:C.panel }}>
                    <Field label="显示名" value={p.label} onChange={v=>updateField(p.id,"label",v)} />
                    <Field label="类型" value={p.type} onChange={v=>updateField(p.id,"type",v)}
                      hint="server-openai 使用本项目服务端代理; 豆包、通义、DeepSeek 等浏览器直连兼容接口可填 openai"
                      as="select" options={["server-openai","anthropic","openai","gemini"]} />
                    <Field label="Base URL" value={p.baseUrl} onChange={v=>updateField(p.id,"baseUrl",v)}
                      hint="完整 endpoint(openai 类型需到 /chat/completions,gemini 类型只需到 /v1beta)" />
                    <Field label="模型" value={p.model} onChange={v=>updateField(p.id,"model",v)}
                      hint="如 claude-sonnet-4-20250514 / gpt-4o / gemini-2.0-flash / doubao-1.5-vision-pro-32k-250115" />
                    <Field label="API Key" value={p.apiKey} onChange={v=>updateField(p.id,"apiKey",v)} type="password" />
                  </div>
                )}
              </div>
            );
          })}
          <span onClick={addNew} className="va-btn" style={{
            display:"inline-block", marginTop:6, fontFamily:sans, fontSize:13, color:C.txt,
            border:`1px dashed ${C.line}`, padding:"10px 18px", borderRadius:10, background:"transparent",
          }}>+ 添加自定义接口</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, hint, type, as, options }) {
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ fontFamily:mono, fontSize:11, color:C.dim, marginBottom:6 }}>{label}</div>
      {as==="select" ? (
        <select value={value} onChange={e=>onChange(e.target.value)} style={{
          width:"100%", fontFamily:sans, fontSize:13, padding:"8px 10px", background:C.bg, border:`1px solid ${C.line}`,
          color:C.txt, borderRadius:8, outline:"none",
        }}>
          {(options||[]).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input value={value||""} onChange={e=>onChange(e.target.value)} type={type||"text"} style={{
          width:"100%", fontFamily:type==="password"?mono:sans, fontSize:13, padding:"8px 10px", background:C.bg,
          border:`1px solid ${C.line}`, color:C.txt, borderRadius:8, outline:"none",
        }} />
      )}
      {hint && <div style={{ fontFamily:sans, fontSize:11, color:C.faint, marginTop:5, lineHeight:1.5 }}>{hint}</div>}
    </div>
  );
}
