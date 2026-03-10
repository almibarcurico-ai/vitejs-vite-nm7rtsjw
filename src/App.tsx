import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nnswoxfkdutivhgeiiev.supabase.co";
const SUPABASE_KEY = "sb_publishable_MUJ-13Ox5UrA20ReTPhXCw_fEDsF3O7";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDENTIALS = {
  cajero: { password: "almibar2024", role: "caja" },
  admin:  { password: "admin2024",   role: "admin" },
};

const C = {
  negro:      "#0d0d0d",
  negroCard:  "#181818",
  negroSuave: "#242424",
  rojo:       "#C41E1E",
  rojoGlow:   "rgba(196,30,30,0.35)",
  blanco:     "#FFFFFF",
  blancoSuave:"#F0EDE8",
  grisTexto:  "#9A9080",
  grisLinea:  "#2a2a2a",
  amarillo:   "#F5C518",
};

const DEFAULT_IMAGES = {
  Pizzas:          "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  Acompañamientos: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
  Bebidas:         "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80",
  Entradas:        "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=600&q=80",
  Postres:         "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
  Cockteles:       "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
  Sushi:           "https://images.unsplash.com/photo-1617196034738-26c5f7c977ce?w=600&q=80",
  default:         "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
};

const getImg = (p) => p.image_url || DEFAULT_IMAGES[p.category] || DEFAULT_IMAGES.default;
const fmt = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n || 0);

const STATUS = {
  pendiente: { label: "Pendiente",  color: "#f59e0b", bg: "#fef3c7" },
  preparando:{ label: "Preparando", color: "#3b82f6", bg: "#dbeafe" },
  listo:     { label: "Listo",      color: "#8b5cf6", bg: "#ede9fe" },
  entregado: { label: "Entregado",  color: "#10b981", bg: "#d1fae5" },
  cancelado: { label: "Cancelado",  color: "#ef4444", bg: "#fee2e2" },
};

function getRoute() {
  const h = window.location.hash.replace("#","").toLowerCase();
  if (h === "caja")  return "caja";
  if (h === "admin") return "admin";
  return "cliente";
}

function useSettings() {
  const [s, setS] = useState(null);
  useEffect(() => {
    supabase.from("settings").select("*").eq("id",1).single().then(({data}) => data && setS(data));
    const sub = supabase.channel("s-ch")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"settings"},(p) => setS(p.new))
      .subscribe();
    return () => supabase.removeChannel(sub);
  },[]);
  const update = async (u) => {
    const {data} = await supabase.from("settings").update({...u, updated_at: new Date().toISOString()}).eq("id",1).select().single();
    if (data) setS(data);
  };
  return { settings: s, updateSettings: update };
}

function useProducts() {
  const [p, setP] = useState([]);
  const load = () => supabase.from("products").select("*").order("category").then(({data}) => setP(data||[]));
  useEffect(() => {
    load();
    const sub = supabase.channel("p-ch")
      .on("postgres_changes",{event:"*",schema:"public",table:"products"}, load)
      .subscribe();
    return () => supabase.removeChannel(sub);
  },[]);
  return p;
}

function useOrders(filters = {}) {
  const [orders, setOrders] = useState([]);
  const fetchOrders = useCallback(async () => {
    let q = supabase.from("orders").select("*, order_items(*)").order("created_at",{ascending:false});
    if (filters.date) { q = q.gte("created_at", filters.date+"T00:00:00").lte("created_at", filters.date+"T23:59:59"); }
    if (filters.status) q = q.eq("status", filters.status);
    const {data} = await q;
    setOrders(data||[]);
  },[filters.date, filters.status]);
  useEffect(() => {
    fetchOrders();
    const sub = supabase.channel("o-ch")
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"}, fetchOrders)
      .on("postgres_changes",{event:"*",schema:"public",table:"order_items"}, fetchOrders)
      .subscribe();
    return () => supabase.removeChannel(sub);
  },[fetchOrders]);
  return { orders, refetch: fetchOrders };
}

export default function App() {
  const [route, setRoute] = useState(getRoute());
  const [auth, setAuth]   = useState(null);
  useEffect(() => {
    const h = () => setRoute(getRoute());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  },[]);
  const logout = () => { setAuth(null); window.location.hash = ""; };
  if (route === "caja")  { if (!auth||auth.role!=="caja")  return <Login role="caja"  onLogin={r=>setAuth({role:r})}/>; return <CajaView  onLogout={logout}/>; }
  if (route === "admin") { if (!auth||auth.role!=="admin") return <Login role="admin" onLogin={r=>setAuth({role:r})}/>; return <AdminView onLogout={logout}/>; }
  return <ClienteView />;
}

/* ── LOGIN ── */
function Login({ role, onLogin }) {
  const [u,setU] = useState(""); const [p,setP] = useState(""); const [err,setErr] = useState("");
  const go = () => {
    const c = CREDENTIALS[u];
    if (c && c.password === p && c.role === role) onLogin(role);
    else setErr("Usuario o contraseña incorrectos");
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at top,#1a0505 0%,${C.negro} 70%)`}}>
      <div style={{background:C.negroCard,border:`1px solid ${C.grisLinea}`,borderRadius:20,padding:36,width:320,display:"flex",flexDirection:"column",gap:14,boxShadow:`0 0 60px ${C.rojoGlow}`}}>
        <div style={{fontSize:52,textAlign:"center"}}>🍹</div>
        <h2 style={{textAlign:"center",margin:0,color:C.blanco,letterSpacing:2,fontSize:18,textTransform:"uppercase"}}>
          Almíbar · {role === "admin" ? "Admin" : "Caja"}
        </h2>
        <input style={inp} placeholder="Usuario" value={u} onChange={e=>setU(e.target.value)}/>
        <input style={inp} type="password" placeholder="Contraseña" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}/>
        {err && <p style={{color:"#ef4444",fontSize:13,margin:0}}>{err}</p>}
        <button style={btnRed} onClick={go}>Ingresar</button>
      </div>
    </div>
  );
}

/* ── VISTA CLIENTE ── */
function ClienteView() {
  const products = useProducts();
  const { settings } = useSettings();
  const [cart, setCart]       = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [step, setStep]       = useState("menu");
  const [activeCat, setActiveCat] = useState("all");

  const categories = ["all", ...new Set(products.map(p => p.category))];
  const filtered = activeCat === "all"
    ? products.filter(p => p.available)
    : products.filter(p => p.available && p.category === activeCat);

  const cartTotal = cart.reduce((s,i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s,i) => s + i.qty, 0);

  const add = (prod) => setCart(prev => {
    const ex = prev.find(i => i.id === prod.id);
    if (ex) return prev.map(i => i.id === prod.id ? {...i, qty: i.qty+1} : i);
    return [...prev, {...prod, qty:1}];
  });
  const remove = (id) => setCart(prev => {
    const ex = prev.find(i => i.id === id);
    if (ex.qty === 1) return prev.filter(i => i.id !== id);
    return prev.map(i => i.id === id ? {...i, qty: i.qty-1} : i);
  });

  const [trackingId, setTrackingId] = useState(null);

  const placeOrder = async (form) => {
    const total = cartTotal + (form.delivery_type === "delivery" ? (settings?.delivery_cost||0) : 0);
    const {data:order, error} = await supabase.from("orders").insert({
      customer_name: form.name, customer_phone: form.phone, address: form.address,
      delivery_type: form.delivery_type, notes: form.notes, total, status: "pendiente",
    }).select().single();
    if (error) return alert("Error al enviar pedido");
    await supabase.from("order_items").insert(
      cart.map(i => ({ order_id: order.id, product_id: i.id, product_name: i.name, price: i.price, quantity: i.qty }))
    );
    setCart([]);
    setTrackingId(order.id);
    setStep("tracking");
  };

  if (step === "tracking") return (
    <OrderTracker orderId={trackingId} onNewOrder={()=>{ setTrackingId(null); setStep("menu"); }}/>
  );

  if (step === "form") return (
    <OrderForm cart={cart} cartTotal={cartTotal} settings={settings} onSubmit={placeOrder} onBack={()=>setStep("menu")}/>
  );

  return (
    <div style={{maxWidth:520,margin:"0 auto",minHeight:"100vh",background:C.negro,paddingBottom:90}}>

      {/* Header */}
      <header style={{background:C.negro,borderBottom:`2px solid ${C.rojo}`,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:`0 2px 24px ${C.rojoGlow}`}}>
        <div>
          <h1 style={{margin:0,fontSize:20,color:C.blanco,fontWeight:900,letterSpacing:3,textTransform:"uppercase"}}>🍹 Almíbar</h1>
          {settings && (
            <span style={{fontSize:11,color:settings.open?"#10b981":"#ef4444",fontWeight:600}}>
              {settings.open ? "● Abierto" : "● Cerrado"} · {settings.hours}
            </span>
          )}
        </div>
        <button onClick={()=>setShowCart(!showCart)} style={{position:"relative",background:"transparent",border:"none",cursor:"pointer",fontSize:26,color:C.blanco,padding:4}}>
          🛒
          {cartCount > 0 && (
            <span style={{position:"absolute",top:-2,right:-4,background:C.rojo,color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{cartCount}</span>
          )}
        </button>
      </header>

      {/* Info banner */}
      <div style={{background:`linear-gradient(135deg,#1a0505 0%,#2a0808 100%)`,padding:"14px 18px",borderBottom:`1px solid ${C.grisLinea}`}}>
        <p style={{margin:0,color:C.blancoSuave,fontSize:14,fontWeight:600}}>🚗 Delivery · 🏠 Retiro en local</p>
        {settings?.min_order > 0 && (
          <p style={{margin:"3px 0 0",color:C.grisTexto,fontSize:12}}>
            Pedido mínimo {fmt(settings.min_order)} · Despacho {fmt(settings.delivery_cost)}
          </p>
        )}
      </div>

      {/* Categorías */}
      <div style={{display:"flex",gap:8,padding:"12px 14px",overflowX:"auto",background:C.negroSuave,borderBottom:`1px solid ${C.grisLinea}`,scrollbarWidth:"none"}}>
        {categories.map(c => (
          <button key={c} onClick={()=>setActiveCat(c)} style={{
            whiteSpace:"nowrap",padding:"7px 16px",borderRadius:20,cursor:"pointer",
            fontSize:13,fontWeight:700,border:"none",
            background: activeCat===c ? C.rojo : C.negro,
            color: activeCat===c ? C.blanco : C.grisTexto,
            boxShadow: activeCat===c ? `0 2px 12px ${C.rojoGlow}` : "none",
          }}>
            {c === "all" ? "Todo" : c}
          </button>
        ))}
      </div>

      {/* Grid productos — estilo PedidosYa */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,padding:"12px 10px"}}>
        {filtered.map(product => {
          const inCart = cart.find(i => i.id === product.id);
          return (
            <div key={product.id} style={{background:C.negroCard,borderRadius:14,overflow:"hidden",border:`1px solid ${C.grisLinea}`,display:"flex",flexDirection:"column"}}>
              {/* Imagen */}
              <div style={{position:"relative",height:120,overflow:"hidden",flexShrink:0}}>
                <img src={getImg(product)} alt={product.name}
                  style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
                  onError={e=>{e.target.src=DEFAULT_IMAGES.default;}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:40,background:"linear-gradient(transparent,rgba(0,0,0,0.65))"}}/>
              </div>

              {/* Info */}
              <div style={{padding:"10px 11px 12px",flex:1,display:"flex",flexDirection:"column",gap:2}}>
                <p style={{margin:0,fontWeight:700,color:C.blanco,fontSize:13,lineHeight:1.3}}>{product.name}</p>
                {product.description && (
                  <p style={{margin:0,color:C.grisTexto,fontSize:11,lineHeight:1.3}}>{product.description}</p>
                )}
                <p style={{margin:"4px 0 0",fontWeight:800,color:C.amarillo,fontSize:15}}>{fmt(product.price)}</p>
                <div style={{marginTop:"auto",paddingTop:8}}>
                  {inCart ? (
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.negroSuave,borderRadius:20,padding:"4px 8px"}}>
                      <button onClick={()=>remove(product.id)} style={qtyBtn}>−</button>
                      <span style={{color:C.blanco,fontWeight:700,fontSize:14}}>{inCart.qty}</span>
                      <button onClick={()=>add(product)} style={qtyBtn}>+</button>
                    </div>
                  ) : (
                    <button onClick={()=>add(product)} style={{width:"100%",padding:"8px 0",background:C.rojo,color:C.blanco,border:"none",borderRadius:20,fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:`0 2px 8px ${C.rojoGlow}`}}>
                      + Agregar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer carrito */}
      {showCart && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={()=>setShowCart(false)}>
          <div style={{background:C.negroCard,width:"100%",maxWidth:520,margin:"0 auto",borderRadius:"20px 20px 0 0",padding:20,maxHeight:"80vh",overflowY:"auto",border:`1px solid ${C.grisLinea}`,borderBottom:"none"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0,color:C.blanco,fontSize:17}}>Tu pedido</h3>
              <button onClick={()=>setShowCart(false)} style={{background:C.negroSuave,border:"none",borderRadius:"50%",width:32,height:32,color:C.grisTexto,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            {cart.length === 0 ? (
              <p style={{color:C.grisTexto,textAlign:"center",padding:32}}>Tu carrito está vacío</p>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.grisLinea}`}}>
                    <img src={getImg(item)} alt={item.name} style={{width:52,height:52,objectFit:"cover",borderRadius:10,flexShrink:0}} onError={e=>{e.target.src=DEFAULT_IMAGES.default;}}/>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontWeight:600,color:C.blanco,fontSize:14}}>{item.name}</p>
                      <p style={{margin:"2px 0 0",color:C.grisTexto,fontSize:12}}>{fmt(item.price)} × {item.qty}</p>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={()=>remove(item.id)} style={qtyBtn}>−</button>
                      <span style={{color:C.blanco,fontWeight:700}}>{item.qty}</span>
                      <button onClick={()=>add(item)} style={qtyBtn}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0",color:C.blanco,fontWeight:700,fontSize:16,borderTop:`1px solid ${C.grisLinea}`}}>
                  <span>Subtotal</span><span style={{color:C.amarillo}}>{fmt(cartTotal)}</span>
                </div>
                {settings?.delivery_cost > 0 && (
                  <p style={{color:C.grisTexto,fontSize:13,margin:"0 0 8px",textAlign:"right"}}>+ Despacho desde {fmt(settings.delivery_cost)}</p>
                )}
                <button style={{...btnRed,marginTop:8}} onClick={()=>{setShowCart(false);setStep("form");}}>
                  Ir al pedido →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      {cartCount > 0 && !showCart && (
        <button onClick={()=>setShowCart(true)} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:C.rojo,color:C.blanco,border:"none",borderRadius:40,padding:"14px 28px",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 4px 28px ${C.rojoGlow}`,zIndex:100,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:10}}>
          <span style={{background:"rgba(255,255,255,0.25)",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13}}>{cartCount}</span>
          Ver pedido · {fmt(cartTotal)}
        </button>
      )}
    </div>
  );
}

/* ── FORMULARIO PEDIDO ── */
function OrderForm({ cart, cartTotal, settings, onSubmit, onBack }) {
  const [form, setForm] = useState({name:"",phone:"",address:"",delivery_type:"delivery",notes:""});
  const [loading, setLoading] = useState(false);
  const total = cartTotal + (form.delivery_type === "delivery" ? (settings?.delivery_cost||0) : 0);
  const go = async () => {
    if (!form.name||!form.phone) return alert("Ingresa tu nombre y teléfono");
    if (form.delivery_type==="delivery"&&!form.address) return alert("Ingresa tu dirección");
    setLoading(true); await onSubmit(form); setLoading(false);
  };
  return (
    <div style={{maxWidth:520,margin:"0 auto",minHeight:"100vh",background:C.negro,padding:20}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.grisTexto,cursor:"pointer",fontSize:15,marginBottom:16,padding:0}}>← Volver</button>
      <h2 style={{color:C.blanco,marginBottom:20}}>Datos del pedido</h2>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["delivery","pickup"].map(t => (
          <button key={t} onClick={()=>setForm({...form,delivery_type:t})} style={{flex:1,padding:12,borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14,border:`2px solid ${form.delivery_type===t?C.rojo:C.grisLinea}`,background:form.delivery_type===t?"#2a0808":C.negroCard,color:form.delivery_type===t?C.blanco:C.grisTexto}}>
            {t==="delivery"?"🚗 Delivery":"🏠 Retiro en local"}
          </button>
        ))}
      </div>
      <input style={inp} placeholder="Tu nombre *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input style={inp} placeholder="Teléfono *" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
      {form.delivery_type==="delivery" && <input style={inp} placeholder="Dirección *" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>}
      <textarea style={{...inp,height:80,resize:"vertical"}} placeholder="Notas (opcional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
      <div style={{background:C.negroCard,border:`1px solid ${C.grisLinea}`,borderRadius:12,padding:16,marginBottom:16}}>
        {cart.map(item => (
          <div key={item.id} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:C.blancoSuave,padding:"4px 0"}}>
            <span>{item.name} × {item.qty}</span><span>{fmt(item.price*item.qty)}</span>
          </div>
        ))}
        {form.delivery_type==="delivery" && (
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:C.grisTexto,padding:"4px 0"}}>
            <span>Despacho</span><span>{fmt(settings?.delivery_cost||0)}</span>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,color:C.amarillo,fontSize:16,borderTop:`1px solid ${C.grisLinea}`,paddingTop:10,marginTop:6}}>
          <span>Total</span><span>{fmt(total)}</span>
        </div>
      </div>
      <button style={btnRed} onClick={go} disabled={loading}>{loading?"Enviando...":"Confirmar pedido"}</button>
    </div>
  );
}

/* ── SEGUIMIENTO DE PEDIDO (cliente) ── */
function OrderTracker({ orderId, onNewOrder }) {
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null); // { msg, color, icon }
  const prevStatus            = useRef(null);

  // Mensajes de notificación por estado
  const STATUS_MSGS = {
    preparando: { msg: "¡Tu pedido fue aceptado y está siendo preparado!", color: "#3b82f6", icon: "👨‍🍳" },
    listo:      { msg: "¡Tu pedido está listo para ser entregado!",        color: "#8b5cf6", icon: "📦" },
    entregado:  { msg: "¡Pedido entregado! ¡Que lo disfrutes! 🎉",         color: "#10b981", icon: "✅" },
    cancelado:  { msg: "Tu pedido fue cancelado por el local.",             color: "#ef4444", icon: "❌" },
  };

  const beep = (freq = 660, dur = 0.25) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  const showToast = (status) => {
    const t = STATUS_MSGS[status];
    if (!t) return;
    setToast(t);
    beep(status === "cancelado" ? 220 : 880);
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single()
      .then(({ data }) => {
        setOrder(data);
        prevStatus.current = data?.status;
        setLoading(false);
      });

    const sub = supabase.channel("track-" + orderId)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `id=eq.${orderId}`
      }, (payload) => {
        const newStatus = payload.new.status;
        if (newStatus !== prevStatus.current) {
          prevStatus.current = newStatus;
          showToast(newStatus);
        }
        setOrder(prev => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [orderId]);

  const STEPS = [
    { key: "pendiente",  icon: "🕐", label: "Pedido recibido",  desc: "Esperando confirmación del local" },
    { key: "preparando", icon: "👨‍🍳", label: "En preparación",  desc: "Tu pedido está siendo preparado" },
    { key: "listo",      icon: "📦", label: "Listo",            desc: "¡Tu pedido está listo!" },
    { key: "entregado",  icon: "✅", label: "Entregado",        desc: "¡Disfruta tu pedido!" },
  ];

  const stepOrder   = ["pendiente","preparando","listo","entregado"];
  const currentIdx  = order ? stepOrder.indexOf(order.status) : 0;
  const isCancelled = order?.status === "cancelado";

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.negro}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>🍹</div>
        <p style={{color:C.grisTexto,fontSize:16}}>Cargando tu pedido...</p>
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:520,margin:"0 auto",minHeight:"100vh",background:C.negro,padding:20,paddingTop:16}}>

      {/* TOAST de notificación */}
      {toast && (
        <div style={{
          position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",
          zIndex:999,maxWidth:400,width:"calc(100% - 32px)",
          background:toast.color,color:"white",
          borderRadius:14,padding:"14px 18px",
          display:"flex",alignItems:"center",gap:12,
          boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
          animation:"slideDown .3s ease",
        }}>
          <span style={{fontSize:24,flexShrink:0}}>{toast.icon}</span>
          <p style={{margin:0,fontWeight:700,fontSize:14,lineHeight:1.3}}>{toast.msg}</p>
        </div>
      )}

      {/* CSS para animación */}
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes pulseRed  { 0%,100%{ box-shadow:0 0 0 0 rgba(196,30,30,0.6); } 50%{ box-shadow:0 0 0 10px rgba(196,30,30,0); } }
      `}</style>

      {/* Header */}
      <div style={{textAlign:"center",padding:"16px 0 20px"}}>
        <h2 style={{margin:0,color:C.blanco,fontWeight:900,letterSpacing:2,textTransform:"uppercase",fontSize:18}}>🍹 Almíbar</h2>
        <p style={{color:C.grisTexto,fontSize:13,marginTop:4}}>Seguimiento de tu pedido</p>
      </div>

      {isCancelled ? (
        <div style={{background:"#1a0505",border:"1px solid #ef4444",borderRadius:16,padding:28,textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:56}}>❌</div>
          <h3 style={{color:"#ef4444",margin:"12px 0 8px",fontSize:20}}>Pedido cancelado</h3>
          <p style={{color:C.grisTexto,fontSize:14}}>Lo sentimos, el local no pudo procesar tu pedido en este momento.</p>
        </div>
      ) : (
        <div style={{background:C.negroCard,border:`1px solid ${C.grisLinea}`,borderRadius:16,padding:20,marginBottom:16}}>
          {STEPS.map((step, idx) => {
            const done    = idx < currentIdx;
            const current = idx === currentIdx;
            const pending = idx > currentIdx;
            return (
              <div key={step.key} style={{display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:40,flexShrink:0}}>
                  <div style={{
                    width:40,height:40,borderRadius:"50%",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:20,fontWeight:700,flexShrink:0,
                    background: current ? C.rojo : done ? "#10b981" : C.negroSuave,
                    border: pending ? `1px solid ${C.grisLinea}` : "none",
                    opacity: pending ? 0.35 : 1,
                    animation: current ? "pulseRed 2s infinite" : "none",
                  }}>
                    {done ? "✓" : step.icon}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div style={{width:2,height:30,background:done?"#10b981":C.grisLinea,margin:"4px 0",opacity:done?0.9:0.25,transition:"background 0.5s"}}/>
                  )}
                </div>
                <div style={{paddingTop:8,paddingBottom:idx<STEPS.length-1?20:0,opacity:pending?0.35:1,flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <p style={{margin:0,fontWeight:current?800:600,fontSize:15,color:current?C.blanco:done?"#10b981":C.grisTexto}}>
                      {step.label}
                    </p>
                    {current && (
                      <span style={{background:C.rojo,color:"white",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,letterSpacing:0.5}}>
                        AHORA
                      </span>
                    )}
                  </div>
                  {(current || done) && (
                    <p style={{margin:"3px 0 0",fontSize:12,color:C.grisTexto,lineHeight:1.4}}>{step.desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen */}
      {order && (
        <div style={{background:C.negroCard,border:`1px solid ${C.grisLinea}`,borderRadius:14,padding:16,marginBottom:16}}>
          <p style={{margin:"0 0 10px",color:C.grisTexto,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Resumen del pedido</p>
          {(order.order_items||[]).map((item,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:C.blancoSuave,padding:"3px 0"}}>
              <span>{item.quantity}× {item.product_name}</span>
              <span>{fmt(item.price*item.quantity)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,color:C.amarillo,fontSize:16,borderTop:`1px solid ${C.grisLinea}`,paddingTop:10,marginTop:8}}>
            <span>Total</span><span>{fmt(order.total)}</span>
          </div>
        </div>
      )}

      {(isCancelled || order?.status === "entregado") && (
        <button style={btnRed} onClick={onNewOrder}>Hacer otro pedido</button>
      )}
    </div>
  );
}

/* ── CAJA ── */
function CajaView({ onLogout }) {
  const [tab, setTab] = useState("pedidos");
  const today = new Date().toISOString().split("T")[0];
  const { orders } = useOrders({ date: today });
  const prevCount = useRef(0);
  useEffect(() => {
    const p = orders.filter(o=>o.status==="pendiente").length;
    if (p > prevCount.current) { try{const ctx=new AudioContext();const o=ctx.createOscillator();o.connect(ctx.destination);o.frequency.value=880;o.start();o.stop(ctx.currentTime+0.3);}catch{} }
    prevCount.current = p;
  },[orders]);
  const upd = (id, status) => supabase.from("orders").update({status}).eq("id",id);
  const active = orders.filter(o => ["pendiente","preparando","listo"].includes(o.status));
  return (
    <div style={{minHeight:"100vh",background:"#f0ede8"}}>
      <header style={{background:C.negro,borderBottom:`2px solid ${C.rojo}`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{margin:0,color:C.blanco,fontWeight:800}}>🍹 Caja · {new Date().toLocaleDateString("es-CL")}</h2>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,0.1)",color:C.blanco,border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer"}}>Salir</button>
      </header>
      <div style={{display:"flex",background:"white",borderBottom:"1px solid #e5e7eb",overflowX:"auto"}}>
        {[["pedidos","Pedidos activos"],["historial","Historial"],["cuadre","Cuadre del día"]].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{padding:"12px 20px",background:"none",border:"none",cursor:"pointer",whiteSpace:"nowrap",fontWeight:tab===k?700:500,fontSize:14,color:tab===k?C.rojo:"#6b7280",borderBottom:tab===k?`2px solid ${C.rojo}`:"2px solid transparent"}}>
            {l}{k==="pedidos"&&active.length>0&&<span style={{marginLeft:6,background:C.rojo,color:"white",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{active.length}</span>}
          </button>
        ))}
      </div>
      {tab==="pedidos" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,padding:16}}>
          {active.length===0 ? <div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#9ca3af"}}><div style={{fontSize:48}}>✅</div><p>Sin pedidos activos</p></div>
          : active.map(o => <OrderCard key={o.id} order={o} onUpdate={upd}/>)}
        </div>
      )}
      {tab==="historial" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,padding:16}}>
          {orders.filter(o=>["entregado","cancelado"].includes(o.status)).map(o=><OrderCard key={o.id} order={o} onUpdate={upd} readonly/>)}
        </div>
      )}
      {tab==="cuadre" && <Cuadre orders={orders}/>}
    </div>
  );
}

function OrderCard({ order, onUpdate, readonly }) {
  const [loading, setLoading] = useState(false);
  const st = STATUS[order.status] || STATUS.pendiente;
  const time = new Date(order.created_at).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
  const nextSt  = {pendiente:"preparando",preparando:"listo",listo:"entregado"};
  const nextLbl = {pendiente:"✓ Aceptar",preparando:"Listo para entregar →",listo:"Entregado ✓"};

  const handleUpdate = async (id, status) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) alert("Error al actualizar: " + error.message);
    } catch(e) {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const borderColor = order.status === "pendiente" ? "#f59e0b" : order.status === "cancelado" ? "#ef4444" : "#e5e7eb";

  return (
    <div style={{background:"white",borderRadius:12,padding:16,boxShadow:"0 1px 6px rgba(0,0,0,0.08)",borderLeft:`4px solid ${borderColor}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <span style={{fontWeight:700,fontSize:15}}>{order.customer_name}</span>
          <span style={{marginLeft:8,color:"#6b7280",fontSize:13}}>{order.delivery_type==="delivery"?"🚗 Delivery":"🏠 Retiro"} · {time}</span>
        </div>
        <span style={{padding:"3px 10px",borderRadius:12,fontSize:12,fontWeight:700,color:st.color,background:st.bg}}>{st.label}</span>
      </div>
      {order.address && <p style={{margin:"4px 0",color:"#6b7280",fontSize:13}}>📍 {order.address}</p>}
      {order.customer_phone && <p style={{margin:"4px 0",color:"#6b7280",fontSize:13}}>📞 {order.customer_phone}</p>}
      <div style={{background:"#f9fafb",borderRadius:8,padding:10,margin:"8px 0"}}>
        {(order.order_items||[]).map((it,i) => (
          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"2px 0"}}>
            <span>{it.quantity}× {it.product_name}</span><span style={{fontWeight:600}}>{fmt(it.price*it.quantity)}</span>
          </div>
        ))}
      </div>
      {order.notes && <p style={{color:"#92400e",fontSize:13,background:"#fffbeb",borderRadius:6,padding:"6px 10px",margin:"6px 0"}}>📝 {order.notes}</p>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,gap:8,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:17}}>{fmt(order.total)}</span>
        <div style={{display:"flex",gap:8}}>
          {!readonly && nextSt[order.status] && (
            <button
              onClick={()=>handleUpdate(order.id, nextSt[order.status])}
              disabled={loading}
              style={{
                background: loading ? "#9ca3af" : (order.status==="pendiente" ? "#10b981" : "#3b82f6"),
                color:"white",border:"none",borderRadius:8,padding:"10px 16px",
                cursor:loading?"not-allowed":"pointer",fontWeight:700,fontSize:13,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "..." : nextLbl[order.status]}
            </button>
          )}
          {!readonly && !["cancelado","entregado"].includes(order.status) && (
            <button
              onClick={()=>{ if(confirm("¿Cancelar este pedido?")) handleUpdate(order.id,"cancelado"); }}
              disabled={loading}
              style={{background:"#fee2e2",color:"#ef4444",border:"none",borderRadius:8,padding:"10px 12px",cursor:"pointer",fontWeight:700,fontSize:13}}
            >
              Rechazar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── CUADRE ── */
function Cuadre({ orders }) {
  const ent = orders.filter(o=>o.status==="entregado");
  const can = orders.filter(o=>o.status==="cancelado");
  const total = ent.reduce((s,o)=>s+o.total,0);
  const del = ent.filter(o=>o.delivery_type==="delivery");
  const pic = ent.filter(o=>o.delivery_type==="pickup");
  const prodMap = {};
  ent.forEach(o=>(o.order_items||[]).forEach(it=>{
    if(!prodMap[it.product_name]) prodMap[it.product_name]={qty:0,total:0};
    prodMap[it.product_name].qty+=it.quantity; prodMap[it.product_name].total+=it.price*it.quantity;
  }));
  const top = Object.entries(prodMap).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
  const SC = ({label,value,sub,color="#1f2937"}) => (
    <div style={{background:"white",borderRadius:12,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",borderTop:`3px solid ${color}`}}>
      <p style={{margin:0,color:"#6b7280",fontSize:13}}>{label}</p>
      <p style={{margin:"4px 0 0",fontSize:22,fontWeight:700,color}}>{value}</p>
      {sub&&<p style={{margin:0,color:"#9ca3af",fontSize:12}}>{sub}</p>}
    </div>
  );
  return (
    <div style={{padding:16}}>
      <h3 style={{marginBottom:16}}>{new Date().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        <SC label="Ventas" value={fmt(total)} sub={`${ent.length} pedidos`} color="#10b981"/>
        <SC label="Delivery" value={del.length} sub={fmt(del.reduce((s,o)=>s+o.total,0))} color="#3b82f6"/>
        <SC label="Retiro" value={pic.length} sub={fmt(pic.reduce((s,o)=>s+o.total,0))} color="#8b5cf6"/>
        <SC label="Cancelados" value={can.length} color="#ef4444"/>
      </div>
      {ent.length>0 && <p style={{fontSize:14,color:"#6b7280",marginBottom:16}}>Ticket promedio: <strong style={{color:"#1f2937",fontSize:18}}>{fmt(Math.round(total/ent.length))}</strong></p>}
      {top.length>0 && (
        <>
          <h4 style={{marginBottom:10}}>Más vendidos</h4>
          <div style={{background:"white",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 60px 100px",padding:"10px 16px",background:"#f9fafb",fontWeight:700,fontSize:13,color:"#6b7280"}}>
              <span>Producto</span><span>Cant.</span><span>Total</span>
            </div>
            {top.map(([name,d]) => (
              <div key={name} style={{display:"grid",gridTemplateColumns:"1fr 60px 100px",padding:"10px 16px",borderTop:"1px solid #f3f4f6",fontSize:14}}>
                <span>{name}</span><span>{d.qty}</span><span>{fmt(d.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── ADMIN ── */
function AdminView({ onLogout }) {
  const [tab, setTab] = useState("productos");
  const products = useProducts();
  const { settings, updateSettings } = useSettings();
  const [edit, setEdit] = useState(null);
  const [newProd, setNewProd] = useState(false);
  const toggleAvail = async (p) => supabase.from("products").update({available:!p.available}).eq("id",p.id);
  const delProd = async (id) => { if(!confirm("¿Eliminar?")) return; supabase.from("products").delete().eq("id",id); };
  const cats = [...new Set(products.map(p=>p.category))];
  return (
    <div style={{minHeight:"100vh",background:"#f0ede8"}}>
      <header style={{background:C.negro,borderBottom:`2px solid ${C.rojo}`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{margin:0,color:C.blanco,fontWeight:800}}>⚙️ Administración</h2>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,0.1)",color:C.blanco,border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer"}}>Salir</button>
      </header>
      <div style={{display:"flex",background:"white",borderBottom:"1px solid #e5e7eb",overflowX:"auto"}}>
        {[["productos","Productos"],["pedidos","Pedidos"],["config","Configuración"]].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{padding:"12px 20px",background:"none",border:"none",cursor:"pointer",whiteSpace:"nowrap",fontWeight:tab===k?700:500,fontSize:14,color:tab===k?C.rojo:"#6b7280",borderBottom:tab===k?`2px solid ${C.rojo}`:"2px solid transparent"}}>{l}</button>
        ))}
      </div>
      {tab==="productos" && (
        <div style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{margin:0}}>Productos ({products.length})</h3>
            <button style={{background:C.rojo,color:"white",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700}} onClick={()=>setNewProd(true)}>+ Nuevo</button>
          </div>
          {newProd && <ProdForm onSave={async d=>{await supabase.from("products").insert(d);setNewProd(false);}} onCancel={()=>setNewProd(false)}/>}
          {edit && <ProdForm product={edit} onSave={async d=>{await supabase.from("products").update(d).eq("id",edit.id);setEdit(null);}} onCancel={()=>setEdit(null)}/>}
          {cats.map(cat => (
            <div key={cat} style={{marginBottom:24}}>
              <h4 style={{color:"#6b7280",marginBottom:8}}>{cat}</h4>
              {products.filter(p=>p.category===cat).map(p => (
                <div key={p.id} style={{background:"white",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                  <img src={getImg(p)} alt={p.name} style={{width:52,height:52,objectFit:"cover",borderRadius:8,flexShrink:0}} onError={e=>{e.target.src=DEFAULT_IMAGES.default;}}/>
                  <div style={{flex:1}}>
                    <p style={{margin:0,fontWeight:600}}>{p.name}</p>
                    <p style={{margin:0,color:"#6b7280",fontSize:13}}>{fmt(p.price)}{p.description&&` · ${p.description}`}</p>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button onClick={()=>toggleAvail(p)} style={{border:"none",borderRadius:20,padding:"4px 12px",cursor:"pointer",fontWeight:600,fontSize:12,background:p.available?"#d1fae5":"#fee2e2",color:p.available?"#10b981":"#ef4444"}}>{p.available?"Activo":"Inactivo"}</button>
                    <button onClick={()=>setEdit(p)} style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 8px",cursor:"pointer"}}>✏️</button>
                    <button onClick={()=>delProd(p.id)} style={{background:"#fee2e2",border:"none",borderRadius:8,padding:"6px 8px",cursor:"pointer"}}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {tab==="pedidos" && <AdminPedidos/>}
      {tab==="config" && settings && <ConfigForm settings={settings} onSave={updateSettings}/>}
    </div>
  );
}

function ProdForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({name:product?.name||"",description:product?.description||"",category:product?.category||"",price:product?.price||"",available:product?.available??true,image_url:product?.image_url||""});
  const [preview, setPreview] = useState(product?.image_url||"");
  const handleImg = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const r = new FileReader();
    r.onload = ev => { setPreview(ev.target.result); setForm(f=>({...f,image_url:ev.target.result})); };
    r.readAsDataURL(file);
  };
  const go = () => { if(!form.name||!form.category||!form.price) return alert("Completa todos los campos"); onSave({...form,price:parseInt(form.price)}); };
  return (
    <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,padding:16,marginBottom:24}}>
      <h4 style={{marginBottom:12}}>{product?"Editar producto":"Nuevo producto"}</h4>
      <div style={{marginBottom:12,textAlign:"center"}}>
        <img src={preview||(DEFAULT_IMAGES[form.category]||DEFAULT_IMAGES.default)} alt="preview" style={{width:"100%",height:150,objectFit:"cover",borderRadius:10,border:"1px solid #e5e7eb"}}/>
        <div style={{marginTop:8,display:"flex",gap:8,justifyContent:"center"}}>
          <label style={{padding:"7px 14px",background:C.negro,color:"white",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600}}>
            📷 Subir imagen<input type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
          </label>
          {preview && <button onClick={()=>{setPreview("");setForm(f=>({...f,image_url:""}));}} style={{padding:"7px 12px",background:"#fee2e2",border:"none",borderRadius:8,cursor:"pointer",fontSize:13}}>Quitar</button>}
        </div>
        <p style={{color:"#9ca3af",fontSize:11,marginTop:4}}>Sin imagen usa la referencial de la categoría</p>
      </div>
      {[["Nombre *","name"],["Categoría *","category"],["Descripción","description"]].map(([ph,k]) => (
        <input key={k} style={inpLight} placeholder={ph} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>
      ))}
      <input style={inpLight} placeholder="Precio (CLP) *" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
      <div style={{display:"flex",gap:8}}>
        <button style={{background:C.rojo,color:"white",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:700,fontSize:15,cursor:"pointer",flex:1}} onClick={go}>Guardar</button>
        <button style={{background:"#f3f4f6",color:"#1f2937",border:"none",borderRadius:10,padding:"11px 20px",fontWeight:600,fontSize:15,cursor:"pointer"}} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function AdminPedidos() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const { orders } = useOrders({ date });
  const upd = (id,status) => supabase.from("orders").update({status}).eq("id",id);
  return (
    <div style={{padding:16}}>
      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
        <label style={{fontWeight:600}}>Fecha:</label>
        <input type="date" style={{...inpLight,marginBottom:0,width:"auto"}} value={date} onChange={e=>setDate(e.target.value)}/>
      </div>
      <p style={{color:"#6b7280",marginBottom:16}}>{orders.length} pedidos · Entregado: {fmt(orders.filter(o=>o.status==="entregado").reduce((s,o)=>s+o.total,0))}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {orders.map(o=><OrderCard key={o.id} order={o} onUpdate={upd}/>)}
      </div>
    </div>
  );
}

function ConfigForm({ settings, onSave }) {
  const [form, setForm] = useState({...settings});
  const [saved, setSaved] = useState(false);
  const go = async () => {
    await onSave({business_name:form.business_name,whatsapp:form.whatsapp,delivery_cost:parseInt(form.delivery_cost),min_order:parseInt(form.min_order),delivery_enabled:form.delivery_enabled,open:form.open,hours:form.hours});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  return (
    <div style={{padding:16,maxWidth:480}}>
      <h3 style={{marginBottom:16}}>Configuración</h3>
      {[["Nombre del negocio","business_name","text"],["Horario","hours","text"],["Costo delivery (CLP)","delivery_cost","number"],["Pedido mínimo (CLP)","min_order","number"]].map(([lbl,k,t]) => (
        <div key={k}>
          <label style={{display:"block",fontWeight:600,fontSize:13,color:"#374151",marginBottom:4}}>{lbl}</label>
          <input style={inpLight} type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>
        </div>
      ))}
      {[["Delivery activo","delivery_enabled"],["Local abierto","open"]].map(([lbl,k]) => (
        <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #f3f4f6"}}>
          <span style={{fontWeight:600}}>{lbl}</span>
          <input type="checkbox" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})} style={{width:18,height:18,cursor:"pointer"}}/>
        </div>
      ))}
      <button style={{...btnRed,marginTop:20,background:saved?"#10b981":C.rojo}} onClick={go}>{saved?"✓ Guardado":"Guardar cambios"}</button>
    </div>
  );
}

/* ── ESTILOS BASE ── */
const inp = {
  width:"100%",padding:"11px 14px",borderRadius:10,
  border:`1px solid ${C.grisLinea}`,background:C.negroSuave,
  color:C.blanco,fontSize:15,marginBottom:12,
  boxSizing:"border-box",outline:"none",fontFamily:"inherit",
};
const inpLight = {
  width:"100%",padding:"10px 14px",borderRadius:10,
  border:"1px solid #e5e7eb",background:"white",
  color:"#1f2937",fontSize:15,marginBottom:12,
  boxSizing:"border-box",outline:"none",fontFamily:"inherit",
};
const btnRed = {
  background:C.rojo,color:C.blanco,border:"none",borderRadius:10,
  padding:"13px 20px",fontWeight:800,fontSize:15,cursor:"pointer",
  width:"100%",letterSpacing:0.5,boxShadow:`0 4px 16px ${C.rojoGlow}`,
};
const qtyBtn = {
  width:28,height:28,borderRadius:"50%",border:`1px solid ${C.grisLinea}`,
  background:C.negroSuave,cursor:"pointer",fontWeight:700,fontSize:16,
  color:C.blanco,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,
};
