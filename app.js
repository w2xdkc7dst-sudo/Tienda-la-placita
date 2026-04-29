const { useState, useEffect, useMemo } = React;
const { collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc, query, orderBy } = window.firestoreLib;

const db = window.__db;

function formatCOP(n) { return "$" + Number(n).toLocaleString("es-CO"); }
function today() { return new Date().toISOString().slice(0, 10); }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function getWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
  return mon.toISOString().slice(0, 10);
}
function getMonth(dateStr) { return dateStr.slice(0, 7); }
function dayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
}
function diasHasta(dateStr) {
  const hoy = new Date(today() + "T00:00:00");
  const fecha = new Date(dateStr + "T00:00:00");
  return Math.round((fecha - hoy) / 86400000);
}

const TABS = ["📊 Resumen", "🛒 Ventas", "📦 Pedidos", "🔔 Recordatorios", "📅 Semana", "🗓️ Mes"];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: "bold", color: "#c9a84c", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #2a2f3e" }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, val, color, big }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e2330" }}>
      <span style={{ fontSize: big ? 14 : 13, color: "#aaa" }}>{label}</span>
      <span style={{ fontSize: big ? 18 : 14, fontWeight: big ? "bold" : "normal", color: color || "#e8e6e0" }}>{val}</span>
    </div>
  );
}
function Input({ placeholder, value, onChange, type = "text" }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 8, color: "#e8e6e0", fontFamily: "Georgia, serif", fontSize: 13, padding: "10px 12px", marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
  );
}
function Btn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ width: "100%", background: "#c9a84c", border: "none", borderRadius: 8, color: "#0f1117", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", padding: "11px 0", cursor: "pointer", marginTop: 4 }}>
      {label}
    </button>
  );
}
function Empty({ text }) {
  return <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>{text}</div>;
}
function Tag({ label, val, color }) {
  return (
    <div style={{ background: "#0f1117", borderRadius: 6, padding: "4px 8px" }}>
      <div style={{ fontSize: 10, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: "bold", color }}>{val}</div>
    </div>
  );
}
function ItemCard({ title, sub, val, valColor, onDelete }) {
  return (
    <div style={{ background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 10, padding: "12px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontWeight: "bold", fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: "bold", color: valColor }}>{val}</span>
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
      </div>
    </div>
  );
}

function TienditaApp() {
  const [ventas, setVentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState(0);

  const [ventaDesc, setVentaDesc] = useState("");
  const [ventaVal, setVentaVal] = useState("");
  const [ventaFecha, setVentaFecha] = useState(today());
  const [pedDesc, setPedDesc] = useState("");
  const [pedVal, setPedVal] = useState("");
  const [pedPagado, setPedPagado] = useState("");
  const [pedFecha, setPedFecha] = useState(today());
  const [pedProveedor, setPedProveedor] = useState("");
  const [recDesc, setRecDesc] = useState("");
  const [recFecha, setRecFecha] = useState(tomorrow());
  const [recValor, setRecValor] = useState("");
  const [recProveedor, setRecProveedor] = useState("");
  const [recHora, setRecHora] = useState("08:00");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsubs = [];
    const qV = query(collection(db, "ventas"), orderBy("creadoEn", "desc"));
    unsubs.push(onSnapshot(qV, snap => { setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCargando(false); }));
    const qP = query(collection(db, "pedidos"), orderBy("creadoEn", "desc"));
    unsubs.push(onSnapshot(qP, snap => { setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }));
    const qR = query(collection(db, "recordatorios"), orderBy("creadoEn", "desc"));
    unsubs.push(onSnapshot(qR, snap => { setRecordatorios(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }));
    return () => unsubs.forEach(u => u());
  }, []);

  function showToast(msg, type = "ok") { setToast({ msg, type }); setTimeout(() => setToast(null), 2600); }

  async function addVenta() {
    if (!ventaDesc.trim() || !ventaVal) return showToast("Completa todos los campos", "err");
    await addDoc(collection(db, "ventas"), { desc: ventaDesc.trim(), valor: Number(ventaVal), fecha: ventaFecha, creadoEn: Date.now() });
    setVentaDesc(""); setVentaVal(""); showToast("✅ Venta registrada");
  }
  async function deleteVenta(id) { await deleteDoc(doc(db, "ventas", id)); }

  async function addPedido() {
    if (!pedDesc.trim() || !pedVal) return showToast("Completa todos los campos", "err");
    await addDoc(collection(db, "pedidos"), { desc: pedDesc.trim(), valorEsperado: Number(pedVal), valorPagado: pedPagado ? Number(pedPagado) : Number(pedVal), proveedor: pedProveedor.trim(), fecha: pedFecha, creadoEn: Date.now() });
    setPedDesc(""); setPedVal(""); setPedPagado(""); setPedProveedor(""); showToast("✅ Pedido registrado");
  }
  async function deletePedido(id) { await deleteDoc(doc(db, "pedidos", id)); }

  async function addRecordatorio() {
    if (!recDesc.trim() || !recFecha) return showToast("Completa todos los campos", "err");
    await addDoc(collection(db, "recordatorios"), { desc: recDesc.trim(), fecha: recFecha, hora: recHora, valor: recValor ? Number(recValor) : null, proveedor: recProveedor.trim(), recibido: false, creadoEn: Date.now() });
    setRecDesc(""); setRecValor(""); setRecProveedor(""); setRecFecha(tomorrow()); showToast("✅ Recordatorio guardado");
  }
  async function marcarRecibido(id, actual) { await updateDoc(doc(db, "recordatorios", id), { recibido: !actual }); }
  async function deleteRecordatorio(id) { await deleteDoc(doc(db, "recordatorios", id)); }

  const totalVentas = useMemo(() => ventas.reduce((s, v) => s + v.valor, 0), [ventas]);
  const totalPedidosEsperado = useMemo(() => pedidos.reduce((s, p) => s + p.valorEsperado, 0), [pedidos]);
  const totalPedidosPagado = useMemo(() => pedidos.reduce((s, p) => s + p.valorPagado, 0), [pedidos]);
  const diferenciaPedidos = totalPedidosPagado - totalPedidosEsperado;
  const gananciaTotal = totalVentas - totalPedidosPagado;
  const hoyVentas = useMemo(() => ventas.filter(v => v.fecha === today()).reduce((s, v) => s + v.valor, 0), [ventas]);
  const hoyPedidos = useMemo(() => pedidos.filter(p => p.fecha === today()).reduce((s, p) => s + p.valorPagado, 0), [pedidos]);
  const semanaActual = getWeek(today());
  const semanaVentas = useMemo(() => ventas.filter(v => getWeek(v.fecha) === semanaActual).reduce((s, v) => s + v.valor, 0), [ventas, semanaActual]);
  const semanaPedidos = useMemo(() => pedidos.filter(p => getWeek(p.fecha) === semanaActual).reduce((s, p) => s + p.valorPagado, 0), [pedidos, semanaActual]);
  const semanaGanancia = semanaVentas - semanaPedidos;
  const mesActual = getMonth(today());
  const mesVentas = useMemo(() => ventas.filter(v => getMonth(v.fecha) === mesActual).reduce((s, v) => s + v.valor, 0), [ventas, mesActual]);
  const mesPedidos = useMemo(() => pedidos.filter(p => getMonth(p.fecha) === mesActual).reduce((s, p) => s + p.valorPagado, 0), [pedidos, mesActual]);
  const mesGanancia = mesVentas - mesPedidos;

  const diasSemana = useMemo(() => {
    const dias = {};
    ventas.filter(v => getWeek(v.fecha) === semanaActual).forEach(v => { dias[v.fecha] = dias[v.fecha] || { ventas: 0, pedidos: 0 }; dias[v.fecha].ventas += v.valor; });
    pedidos.filter(p => getWeek(p.fecha) === semanaActual).forEach(p => { dias[p.fecha] = dias[p.fecha] || { ventas: 0, pedidos: 0 }; dias[p.fecha].pedidos += p.valorPagado; });
    return Object.entries(dias).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ventas, pedidos, semanaActual]);

  const semanasMes = useMemo(() => {
    const sems = {};
    ventas.filter(v => getMonth(v.fecha) === mesActual).forEach(v => { const w = getWeek(v.fecha); sems[w] = sems[w] || { ventas: 0, pedidos: 0 }; sems[w].ventas += v.valor; });
    pedidos.filter(p => getMonth(p.fecha) === mesActual).forEach(p => { const w = getWeek(p.fecha); sems[w] = sems[w] || { ventas: 0, pedidos: 0 }; sems[w].pedidos += p.valorPagado; });
    return Object.entries(sems).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ventas, pedidos, mesActual]);

  const color = (n) => n >= 0 ? "#22c55e" : "#f87171";
  const recBadge = recordatorios.filter(r => !r.recibido && diasHasta(r.fecha) >= 0 && diasHasta(r.fecha) <= 2).length;
  const alertasBanner = useMemo(() =>
    recordatorios.filter(r => !r.recibido).map(r => ({ ...r, dias: diasHasta(r.fecha) }))
      .filter(r => r.dias >= 0 && r.dias <= 2).sort((a, b) => a.dias - b.dias),
    [recordatorios]);

  if (cargando) return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🏪</div>
      <div style={{ color: "#c9a84c", fontSize: 16 }}>Cargando tu tiendita…</div>
      <div style={{ color: "#555", fontSize: 12, marginTop: 8 }}>Conectando con la nube ☁️</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e8e6e0", fontFamily: "'Georgia', serif", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #0f1117 100%)", borderBottom: "2px solid #c9a84c", padding: "20px 20px 14px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 1, color: "#c9a84c" }}>🏪 Mi Tiendita</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Control de cuentas</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#152d15", border: "1px solid #22c55e", borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 11, color: "#86efac" }}>En vivo</span>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? "#7f1d1d" : "#152d15", border: `1px solid ${toast.type === "err" ? "#f87171" : "#22c55e"}`, borderRadius: 10, padding: "10px 20px", color: toast.type === "err" ? "#fca5a5" : "#86efac", fontSize: 13, zIndex: 999, whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}

      {alertasBanner.map(r => (
        <div key={r.id} style={{ background: r.dias === 0 ? "#7f1d1d" : "#78350f", borderBottom: `2px solid ${r.dias === 0 ? "#f87171" : "#f59e0b"}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{r.dias === 0 ? "🚨" : "⚠️"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: r.dias === 0 ? "#fca5a5" : "#fcd34d" }}>
              {r.dias === 0 ? "HOY llega:" : r.dias === 1 ? "MAÑANA llega:" : "En 2 días llega:"} {r.desc}
            </div>
            {r.valor && <div style={{ fontSize: 11, color: "#ccc" }}>Tener listo: {formatCOP(r.valor)}</div>}
          </div>
          <button onClick={() => marcarRecibido(r.id, r.recibido)} style={{ background: "#22c55e", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, padding: "4px 8px", cursor: "pointer", fontFamily: "Georgia, serif" }}>✓ Recibido</button>
        </div>
      ))}

      <div style={{ display: "flex", overflowX: "auto", background: "#161a24", borderBottom: "1px solid #2a2f3e", position: "sticky", top: 64, zIndex: 99, scrollbarWidth: "none" }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ flex: "0 0 auto", padding: "12px 14px", border: "none", cursor: "pointer", background: tab === i ? "#c9a84c" : "transparent", color: tab === i ? "#0f1117" : "#aaa", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: tab === i ? "bold" : "normal", whiteSpace: "nowrap", position: "relative" }}>
            {t}
            {i === 3 && recBadge > 0 && (
              <span style={{ position: "absolute", top: 6, right: 4, background: "#f87171", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>{recBadge}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px" }}>
        {tab === 0 && (
          <div>
            {recBadge > 0 && (
              <div onClick={() => setTab(3)} style={{ background: "#1c1408", border: "1px solid #f59e0b", borderRadius: 10, padding: "10px 14px", marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🔔</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#fcd34d" }}>{recBadge} pedido{recBadge > 1 ? "s" : ""} próximo{recBadge > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>Toca para ver los recordatorios →</div>
                </div>
              </div>
            )}
            <Section title="Hoy">
              <Row label="Ventas hoy" val={formatCOP(hoyVentas)} color="#c9a84c" />
              <Row label="Pedidos pagados hoy" val={formatCOP(hoyPedidos)} color="#f87171" />
              <Row label="Ganancia del día" val={formatCOP(hoyVentas - hoyPedidos)} color={color(hoyVentas - hoyPedidos)} big />
            </Section>
            <Section title="Esta semana">
              <Row label="Ventas" val={formatCOP(semanaVentas)} color="#c9a84c" />
              <Row label="Pedidos pagados" val={formatCOP(semanaPedidos)} color="#f87171" />
              <Row label="Ganancia semanal" val={formatCOP(semanaGanancia)} color={color(semanaGanancia)} big />
            </Section>
            <Section title="Este mes">
              <Row label="Ventas" val={formatCOP(mesVentas)} color="#c9a84c" />
              <Row label="Pedidos pagados" val={formatCOP(mesPedidos)} color="#f87171" />
              <Row label="Ganancia mensual" val={formatCOP(mesGanancia)} color={color(mesGanancia)} big />
            </Section>
            <Section title="Pedidos — ¿Estás pagando de más?">
              <Row label="Total esperado" val={formatCOP(totalPedidosEsperado)} color="#aaa" />
              <Row label="Total pagado" val={formatCOP(totalPedidosPagado)} color="#aaa" />
              <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: diferenciaPedidos > 0 ? "#2d1515" : "#152d15", border: `1px solid ${diferenciaPedidos > 0 ? "#f87171" : "#22c55e"}` }}>
                <div style={{ fontSize: 12, color: "#aaa" }}>{diferenciaPedidos > 0 ? "⚠️ Estás pagando DE MÁS:" : diferenciaPedidos < 0 ? "✅ Estás pagando de menos:" : "✅ Estás pagando exacto"}</div>
                {diferenciaPedidos !== 0 && <div style={{ fontSize: 20, fontWeight: "bold", color: color(-diferenciaPedidos), marginTop: 4 }}>{formatCOP(Math.abs(diferenciaPedidos))}</div>}
              </div>
            </Section>
            <Section title="Total general">
              <Row label="Total ventas" val={formatCOP(totalVentas)} color="#c9a84c" />
              <Row label="Total pedidos pagados" val={formatCOP(totalPedidosPagado)} color="#f87171" />
              <Row label="Ganancia total" val={formatCOP(gananciaTotal)} color={color(gananciaTotal)} big />
            </Section>
          </div>
        )}

        {tab === 1 && (
          <div>
            <Section title="Registrar venta">
              <Input placeholder="¿Qué vendiste?" value={ventaDesc} onChange={setVentaDesc} />
              <Input placeholder="Valor ($)" value={ventaVal} onChange={setVentaVal} type="number" />
              <Input placeholder="Fecha" value={ventaFecha} onChange={setVentaFecha} type="date" />
              <Btn onClick={addVenta} label="+ Agregar venta" />
            </Section>
            <Section title={`Historial de ventas (${ventas.length})`}>
              {ventas.length === 0 && <Empty text="Aún no hay ventas registradas" />}
              {ventas.map(v => <ItemCard key={v.id} title={v.desc} sub={dayLabel(v.fecha)} val={formatCOP(v.valor)} valColor="#c9a84c" onDelete={() => deleteVenta(v.id)} />)}
            </Section>
          </div>
        )}

        {tab === 2 && (
          <div>
            <Section title="Registrar pedido">
              <Input placeholder="¿Qué pediste?" value={pedDesc} onChange={setPedDesc} />
              <Input placeholder="Proveedor (opcional)" value={pedProveedor} onChange={setPedProveedor} />
              <Input placeholder="Valor esperado ($)" value={pedVal} onChange={setPedVal} type="number" />
              <Input placeholder="Valor que pagaste ($) — si fue diferente" value={pedPagado} onChange={setPedPagado} type="number" />
              <div style={{ fontSize: 11, color: "#888", marginBottom: 8, marginTop: -4 }}>Si dejás vacío el valor pagado, se asume igual al esperado</div>
              <Input placeholder="Fecha" value={pedFecha} onChange={setPedFecha} type="date" />
              <Btn onClick={addPedido} label="+ Agregar pedido" />
            </Section>
            <Section title={`Historial de pedidos (${pedidos.length})`}>
              {pedidos.length === 0 && <Empty text="Aún no hay pedidos registrados" />}
              {pedidos.map(p => {
                const diff = p.valorPagado - p.valorEsperado;
                return (
                  <div key={p.id} style={{ background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: 14 }}>{p.desc}</div>
                        {p.proveedor && <div style={{ fontSize: 11, color: "#888" }}>📦 {p.proveedor}</div>}
                        <div style={{ fontSize: 11, color: "#888" }}>{dayLabel(p.fecha)}</div>
                      </div>
