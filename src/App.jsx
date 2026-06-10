import { useEffect, useState, useRef } from "react";
import "./App.css";

const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : `${window.location.protocol}//${window.location.host}`;

function validarCPF(cpf) {
  if (typeof cpf !== "string") return false;
  cpf = cpf.replace(/[^\d]/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  let soma = 0;
  let resto;
  
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
}

function buscarUsuarioSalvo() {
  const salvo = localStorage.getItem("usuarioLogado");
  if (!salvo) return null;
  try {
    const parsed = JSON.parse(salvo);
    if (parsed && parsed.vendedor) {
      return parsed.vendedor;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export default function App() {
  const usuarioInicial = buscarUsuarioSalvo();

  const [usuarioLogado, setUsuarioLogado] = useState(usuarioInicial);
  const [adminToken, setAdminToken] = useState(localStorage.getItem("adminToken") || "");
  const [pagina, setPagina] = useState(usuarioInicial ? "vendedor-dashboard" : "landing");
  const [mobileMenuAberto, setMobileMenuAberto] = useState(false);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && !usuarioLogado) {
      setPagina("cadastro-vendedor");
    }
  }, [usuarioLogado]);

  function sair() {
    localStorage.removeItem("usuarioLogado");
    setUsuarioLogado(null);
    setPagina("landing");
  }

  function loginSucesso(vendedor) {
    localStorage.setItem("usuarioLogado", JSON.stringify(vendedor));
    setUsuarioLogado(vendedor);
    setPagina("vendedor-dashboard");
  }

  function loginAdminSucesso(token) {
    localStorage.setItem("adminToken", token);
    setAdminToken(token);
    setPagina("admin-dashboard");
  }

  function sairAdmin() {
    localStorage.removeItem("adminToken");
    setAdminToken("");
    setPagina("landing");
  }

  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);

  const navegarComMobileClose = (novaPagina) => {
    setPagina(novaPagina);
    setMobileMenuAberto(false);
  };

  return (
    <div className="app">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button className="mobile-menu-toggle" onClick={() => setMobileMenuAberto(!mobileMenuAberto)}>
          {mobileMenuAberto ? "✕" : "☰"}
        </button>
        <div className="mobile-header-logo">⚡ NEXUS</div>
        <div style={{ width: "40px" }} />
      </header>

      {/* Backdrop for mobile menu drawer */}
      {mobileMenuAberto && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuAberto(false)} />
      )}

      <Sidebar
        pagina={pagina}
        setPagina={navegarComMobileClose}
        usuarioLogado={usuarioLogado}
        sair={sair}
        adminToken={adminToken}
        sairAdmin={sairAdmin}
        sidebarRecolhida={sidebarRecolhida}
        setSidebarRecolhida={setSidebarRecolhida}
        mobileMenuAberto={mobileMenuAberto}
      />

      <main className="conteudo">
        {usuarioLogado && usuarioLogado.suspensao_ate && new Date(usuarioLogado.suspensao_ate) > new Date() ? (
          <TelaSuspensao usuarioLogado={usuarioLogado} setUsuarioLogado={setUsuarioLogado} sair={sair} />
        ) : usuarioLogado && usuarioLogado.ativo === 0 ? (
          <TelaFilaEspera usuarioLogado={usuarioLogado} sair={sair} />
        ) : pagina.startsWith("admin-") && !adminToken ? (
          <LoginAdmin loginAdminSucesso={loginAdminSucesso} setPagina={setPagina} />
        ) : (
          <>
            {/* Admin Pages */}
            {pagina === "admin-dashboard" && <AdminDashboard />}
            {pagina === "admin-vendedores" && <AdminVendedores />}
            {pagina === "admin-captura" && <AdminCaptura />}
            {pagina === "admin-leads" && <AdminLeads />}
            {pagina === "admin-mensagens" && <AdminMensagens />}
            {pagina === "admin-prevendas" && <AdminPreVendas />}

            {/* Seller Pages */}
            {pagina === "landing" && (
              <LandingPage setPagina={setPagina} />
            )}
            {pagina === "cadastro-vendedor" && (
              <CadastroVendedor setPagina={setPagina} loginSucesso={loginSucesso} />
            )}
            {pagina === "login" && (
              <Login loginSucesso={loginSucesso} setPagina={setPagina} />
            )}

            {pagina === "vendedor-dashboard" && (
              <VendedorDashboard usuarioLogado={usuarioLogado} setUsuarioLogado={setUsuarioLogado} />
            )}
            {pagina === "vendedor-leads" && (
              <VendedorLeads usuarioLogado={usuarioLogado} setUsuarioLogado={setUsuarioLogado} />
            )}
            {pagina === "vendedor-whatsapp" && (
              <VendedorWhatsapp usuarioLogado={usuarioLogado} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Sidebar({ pagina, setPagina, usuarioLogado, sair, adminToken, sairAdmin, sidebarRecolhida, setSidebarRecolhida, mobileMenuAberto }) {
  return (
    <aside className={`sidebar ${sidebarRecolhida ? "recolhida" : ""} ${mobileMenuAberto ? "aberto-mobile" : ""}`}>
      <div className="logo-container" style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: sidebarRecolhida ? "center" : "space-between", 
        flexDirection: sidebarRecolhida ? "column" : "row",
        gap: sidebarRecolhida ? "16px" : "10px",
        marginBottom: "32px", 
        padding: "0 8px",
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="logo-icon-wrapper" style={{
            background: "linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            borderRadius: "10px",
            padding: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#goldGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 8px rgba(251,191,36,0.3))" }}>
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          {!sidebarRecolhida && (
            <span style={{ 
              fontFamily: "'Outfit', sans-serif", 
              fontWeight: 900, 
              fontSize: "1.45rem", 
              letterSpacing: "4px", 
              color: "var(--primary)"
            }}>
              NEXUS
            </span>
          )}
        </div>
        
        <button 
          onClick={() => setSidebarRecolhida(!sidebarRecolhida)} 
          className="sidebar-toggle-btn"
          style={{ 
            width: "auto", 
            margin: 0, 
            padding: "6px 8px", 
            background: "transparent", 
            border: "none", 
            color: "var(--text-tertiary)", 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title={sidebarRecolhida ? "Expandir Menu" : "Recolher Menu"}
        >
          {sidebarRecolhida ? "▶" : "◀"}
        </button>
      </div>

      {!usuarioLogado ? (
        pagina.startsWith("admin-") ? (
          // Admin view
          <>
            <div className="sidebar-header" style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "0 0 10px 0", fontWeight: "700" }}>PAINEL DO ADMIN</div>
            {adminToken ? (
              <>
                <button
                  className={pagina === "admin-dashboard" ? "ativo" : ""}
                  onClick={() => setPagina("admin-dashboard")}
                >
                  <span className="sidebar-icon">📊</span>
                  <span className="sidebar-text">Dashboard Geral</span>
                </button>
                <button
                  className={pagina === "admin-vendedores" ? "ativo" : ""}
                  onClick={() => setPagina("admin-vendedores")}
                >
                  <span className="sidebar-icon">👥</span>
                  <span className="sidebar-text">Vendedores</span>
                </button>
                <button
                  className={pagina === "admin-captura" ? "ativo" : ""}
                  onClick={() => setPagina("admin-captura")}
                >
                  <span className="sidebar-icon">🔍</span>
                  <span className="sidebar-text">Capturar Leads</span>
                </button>
                <button
                  className={pagina === "admin-leads" ? "ativo" : ""}
                  onClick={() => setPagina("admin-leads")}
                >
                  <span className="sidebar-icon">📇</span>
                  <span className="sidebar-text">Leads Capturados</span>
                </button>
                <button
                  className={pagina === "admin-mensagens" ? "ativo" : ""}
                  onClick={() => setPagina("admin-mensagens")}
                >
                  <span className="sidebar-icon">💬</span>
                  <span className="sidebar-text">Modelos de Mensagem</span>
                </button>
                <button
                  className={pagina === "admin-prevendas" ? "ativo" : ""}
                  onClick={() => setPagina("admin-prevendas")}
                >
                  <span className="sidebar-icon">💰</span>
                  <span className="sidebar-text">Pré-Vendas / Comissão</span>
                </button>
                <div className="sidebar-footer">
                  <button onClick={sairAdmin} className="btn-danger" style={{ color: "white" }}>
                    <span className="sidebar-icon">🚪</span>
                    <span className="sidebar-text">Sair do Admin</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sidebar-text" style={{ padding: "10px", color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>
                  Acesso Restrito
                </div>
                <div className="sidebar-footer">
                  <button
                    onClick={() => setPagina("login")}
                    style={{ background: "transparent", border: "1px dashed var(--border-color)", color: "var(--text-secondary)", marginTop: "6px" }}
                  >
                    <span className="sidebar-icon">🚪</span>
                    <span className="sidebar-text">Portal Vendedor</span>
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          // Seller visitor view (login/register)
          <>
            <div className="sidebar-header" style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "0 0 10px 0", fontWeight: "700" }}>PORTAL DO VENDEDOR</div>
            <button
              className={pagina === "landing" ? "ativo" : ""}
              onClick={() => setPagina("landing")}
            >
              <span className="sidebar-icon">🏠</span>
              <span className="sidebar-text">Apresentação Inicial</span>
            </button>
            <button
              className={pagina === "cadastro-vendedor" ? "ativo" : ""}
              onClick={() => setPagina("cadastro-vendedor")}
            >
              <span className="sidebar-icon">📝</span>
              <span className="sidebar-text">Criar Minha Conta</span>
            </button>
            <button
              className={pagina === "login" ? "ativo" : ""}
              onClick={() => setPagina("login")}
            >
              <span className="sidebar-icon">🔑</span>
              <span className="sidebar-text">Entrar (Login)</span>
            </button>
            <div className="sidebar-footer">
              <button
                onClick={() => setPagina("admin-dashboard")}
                style={{ background: "transparent", border: "1px dashed var(--border-color)", color: "var(--text-secondary)", marginTop: "6px" }}
              >
                <span className="sidebar-icon">⚙️</span>
                <span className="sidebar-text">Painel do Admin</span>
              </button>
            </div>
          </>
        )
      ) : (
        // Seller menu
        <>
          <div className="sidebar-header" style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", margin: "0 0 10px 0", fontWeight: "700" }}>PORTAL VENDEDOR</div>
          <div className="sidebar-profile" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-primary)", fontWeight: "600", fontSize: "0.95rem", marginBottom: "20px", padding: "0 8px" }}>
            <span className="sidebar-icon">👤</span>
            <span className="sidebar-text" style={{ display: "flex", flexDirection: "column" }}>
              {usuarioLogado.nome}
              {usuarioLogado.ativo === 0 && (
                <span style={{ fontSize: "0.75rem", color: "var(--warning)", display: "block", marginTop: "4px" }}>⏳ Fila de Espera</span>
              )}
            </span>
          </div>
          {usuarioLogado.ativo === 1 && (
            <>
              <button
                className={pagina === "vendedor-dashboard" ? "ativo" : ""}
                onClick={() => setPagina("vendedor-dashboard")}
              >
                <span className="sidebar-icon">📊</span>
                <span className="sidebar-text">Meu Dashboard</span>
              </button>
              <button
                className={pagina === "vendedor-leads" ? "ativo" : ""}
                onClick={() => setPagina("vendedor-leads")}
              >
                <span className="sidebar-icon">📋</span>
                <span className="sidebar-text">Meus Leads</span>
              </button>
              <button
                className={pagina === "vendedor-whatsapp" ? "ativo" : ""}
                onClick={() => setPagina("vendedor-whatsapp")}
              >
                <span className="sidebar-icon">💬</span>
                <span className="sidebar-text">Conectar WhatsApp</span>
              </button>
            </>
          )}
          <div className="sidebar-footer">
            <button onClick={sair} className="btn-danger" style={{ color: "white" }}>
              <span className="sidebar-icon">🚪</span>
              <span className="sidebar-text">Sair da Conta</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

// 1. ADMIN DASHBOARD
function AdminDashboard() {
  const [estatisticas, setEstatisticas] = useState({
    total: 0,
    novo: 0,
    distribuido: 0,
    enviada: 0,
    vacuo: 0,
    nquero: 0,
    depois: 0,
    prevenda: 0,
    comprou: 0,
    comissaoTotal: 0,
    faturamentoTotal: 0,
    lucroTotal: 0,
    preVendasPendentes: 0,
  });

  const [estoqueLeads, setEstoqueLeads] = useState(0);

  const [vendedores, setVendedores] = useState([]);
  const [limiteVendedores, setLimiteVendedores] = useState(100);
  const [comissaoVenda, setComissaoVenda] = useState(150);
  const [precoProduto, setPrecoProduto] = useState(200);
  const [linkAfiliacaoKiwify, setLinkAfiliacaoKiwify] = useState("");
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");
  const [configErro, setConfigErro] = useState("");
  const [configSucesso, setConfigSucesso] = useState("");

  async function carregarDados() {
    try {
      const resLeads = await fetch(`${API_URL}/leads`);
      const dataLeads = await resLeads.json();
      
      const resVendedores = await fetch(`${API_URL}/vendedores`);
      const dataVendedores = await resVendedores.json();

      const resPreVendas = await fetch(`${API_URL}/pre-vendas`);
      const dataPreVendas = await resPreVendas.json();

      const resConfig = await fetch(`${API_URL}/configuracoes`);
      const dataConfig = await resConfig.json();

      const resEstoque = await fetch(`${API_URL}/admin/estoque-leads`);
      const dataEstoque = await resEstoque.json();
      if (dataEstoque.ok) {
        setEstoqueLeads(dataEstoque.count);
      }

      if (dataLeads.ok && dataVendedores.ok && dataPreVendas.ok && dataConfig.ok) {
        const leads = dataLeads.leads;
        const comVal = dataConfig.comissao_venda ? Number(dataConfig.comissao_venda) : 150;
        const preVal = dataConfig.preco_produto ? Number(dataConfig.preco_produto) : 200;

        let stats = {
          total: leads.length,
          novo: leads.filter(l => l.status === "disponivel").length,
          distribuido: leads.filter(l => l.status === "reservado").length,
          enviada: leads.filter(l => l.status === "Mensagem enviada").length,
          vacuo: leads.filter(l => l.status === "Vácuo").length,
          nquero: leads.filter(l => l.status === "Respondeu mas não quer").length,
          depois: leads.filter(l => l.status === "Respondeu mas vai comprar depois").length,
          prevenda: leads.filter(l => l.status === "Pré-venda feita").length,
          comprou: leads.filter(l => l.status === "Comprou").length,
          comissaoTotal: dataPreVendas.preVendas.filter(p => p.status === "Aprovada").length * comVal,
          faturamentoTotal: dataPreVendas.preVendas.filter(p => p.status === "Aprovada").length * preVal,
          lucroTotal: dataPreVendas.preVendas.filter(p => p.status === "Aprovada").length * (preVal - comVal),
          preVendasPendentes: dataPreVendas.preVendas.filter(p => p.status === "Pendente").length,
        };
        
        setEstatisticas(stats);
        setComissaoVenda(comVal);
        setPrecoProduto(preVal);
        
        const vList = dataVendedores.vendedores.map(v => {
          const leadsVendedor = leads.filter(l => l.vendedor_id === v.id);
          const vendas = leadsVendedor.filter(l => l.status === "Comprou").length;
          return {
            ...v,
            totalLeads: leadsVendedor.length,
            vendas,
            comissao: vendas * comVal
          };
        });
        setVendedores(vList);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do dashboard", e);
    }
  }

  async function carregarConfigs() {
    try {
      const res = await fetch(`${API_URL}/configuracoes`);
      const data = await res.json();
      if (data.ok) {
        setLimiteVendedores(data.limite_vendedores_ativos);
        if (data.comissao_venda) setComissaoVenda(Number(data.comissao_venda));
        if (data.preco_produto) setPrecoProduto(Number(data.preco_produto));
        if (data.link_afiliacao_kiwify) setLinkAfiliacaoKiwify(data.link_afiliacao_kiwify);
      }
    } catch (e) {
      console.error("Erro ao carregar configurações", e);
    }
  }

  async function salvarConfiguracoes(e) {
    e.preventDefault();
    setConfigErro("");
    setConfigSucesso("");
    
    try {
      const payload = { 
        limite_vendedores_ativos: limiteVendedores,
        comissao_venda: comissaoVenda,
        preco_produto: precoProduto,
        link_afiliacao_kiwify: linkAfiliacaoKiwify
      };
      if (novaSenhaAdmin.trim() !== "") {
        payload.senha_administrador = novaSenhaAdmin;
      }
      
      const res = await fetch(`${API_URL}/configuracoes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setConfigErro(data.error || "Erro ao salvar configurações.");
        return;
      }
      
      setConfigSucesso("Configurações atualizadas com sucesso!");
      setNovaSenhaAdmin("");
      carregarDados();
    } catch (err) {
      setConfigErro("Erro ao comunicar com o servidor.");
    }
  }

  useEffect(() => {
    carregarDados();
    carregarConfigs();
  }, []);

  return (
    <section>
      <h1>Painel de Controle</h1>
      <p className="subtitle">Visão geral em tempo real de toda a sua operação de prospecção.</p>

      <div className="dashboard-grid">
        <div className="stat-card info">
          <span className="stat-label">Total de Leads</span>
          <span className="stat-value">{estatisticas.total}</span>
          <span className="stat-desc">Todos os registros no sistema</span>
        </div>
        <div className="stat-card success" style={{ borderLeft: "4px solid var(--primary)" }}>
          <span className="stat-label">⛽ Combustível de Leads</span>
          <span className="stat-value">{estoqueLeads}</span>
          <span className="stat-desc">Leads disponíveis para prospecção</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reservados</span>
          <span className="stat-value">{estatisticas.distribuido}</span>
          <span className="stat-desc">Aguardando envio de mensagens</span>
        </div>
        <div className="stat-card info">
          <span className="stat-label">Mensagens Enviadas</span>
          <span className="stat-value">{estatisticas.enviada}</span>
          <span className="stat-desc">Primeiro contato automático disparado</span>
        </div>
        <div className="stat-card success">
          <span className="stat-label">Pré-vendas Feitas</span>
          <span className="stat-value">{estatisticas.prevenda}</span>
          <span className="stat-desc">{estatisticas.preVendasPendentes} pendentes de aprovação</span>
        </div>
        <div className="stat-card success">
          <span className="stat-label">Vendas Feitas</span>
          <span className="stat-value">{estatisticas.comprou}</span>
          <span className="stat-desc">Leads qualificados e convertidos</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-label">Comissão Total</span>
          <span className="stat-value">R$ {estatisticas.comissaoTotal}</span>
          <span className="stat-desc">R$ {comissaoVenda} por venda aprovada</span>
        </div>
        <div className="stat-card info">
          <span className="stat-label">Faturamento Total</span>
          <span className="stat-value">R$ {estatisticas.faturamentoTotal}</span>
          <span className="stat-desc">R$ {precoProduto} por produto vendido</span>
        </div>
        <div className="stat-card success">
          <span className="stat-label">Lucro Líquido</span>
          <span className="stat-value" style={{ color: "var(--success)" }}>R$ {estatisticas.lucroTotal}</span>
          <span className="stat-desc">R$ {precoProduto - comissaoVenda} lucro por venda</span>
        </div>
      </div>

      <div className="card">
        <h2>Desempenho por Vendedor</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Status</th>
                <th>Leads Atribuídos</th>
                <th>Limite Diário</th>
                <th>Vendas Convertidas</th>
                <th>Comissão Acumulada</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>Nenhum vendedor registrado.</td>
                </tr>
              ) : (
                vendedores.map(v => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.nome}</strong>
                      <br /><small>{v.email}</small>
                      {v.link_kiwify && (
                        <>
                          <br />
                          <small 
                            style={{ color: "var(--text-tertiary)", cursor: "pointer", display: "inline-block", marginTop: "2px" }} 
                            onClick={() => {
                              window.open(v.link_kiwify, "_blank");
                            }} 
                            title="Clique para abrir Link Kiwify"
                          >
                            🔗 Kiwify: abrir link
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${v.ativo ? "badge-prevenda" : "badge-vacuo"}`}>
                        {v.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>{v.totalLeads} leads</td>
                    <td>{v.limite_diario} por dia</td>
                    <td><strong>{v.vendas}</strong></td>
                    <td style={{ color: "var(--success)", fontWeight: "bold" }}>R$ {v.comissao}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: "30px" }}>
        <h2>Configurações do Sistema</h2>
        <p className="subtitle">Altere o limite de vendedores ativos e a senha de acesso administrativo.</p>
        
        {configErro && <div className="alert alert-error">{configErro}</div>}
        {configSucesso && <div className="alert alert-success">{configSucesso}</div>}
        
        <form onSubmit={salvarConfiguracoes} style={{ marginTop: "15px" }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Limite de Vendedores Ativos (Licenças)</label>
              <input 
                type="number" 
                min="1" 
                value={limiteVendedores} 
                onChange={e => setLimiteVendedores(Number(e.target.value))} 
                required 
              />
              <small style={{ color: "var(--text-secondary)" }}>
                Vendedores adicionais ficarão automaticamente na fila de espera.
              </small>
            </div>

            <div className="form-group">
              <label>Preço do Produto (R$)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01"
                value={precoProduto} 
                onChange={e => setPrecoProduto(Number(e.target.value))} 
                required 
              />
              <small style={{ color: "var(--text-secondary)" }}>
                Valor total cobrado por cada venda efetuada.
              </small>
            </div>

            <div className="form-group">
              <label>Comissão do Vendedor por Venda (R$)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01"
                value={comissaoVenda} 
                onChange={e => setComissaoVenda(Number(e.target.value))} 
                required 
              />
              <small style={{ color: "var(--text-secondary)" }}>
                Comissão paga ao vendedor por cada venda aprovada.
              </small>
            </div>
            
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label>Link de Afiliação Geral Kiwify (URL)</label>
              <input 
                type="text" 
                value={linkAfiliacaoKiwify} 
                onChange={e => setLinkAfiliacaoKiwify(e.target.value)} 
                required 
                placeholder="Ex: https://dashboard.kiwify.com.br/affiliate/join/..."
              />
              <small style={{ color: "var(--text-secondary)" }}>
                Este link será aberto quando o vendedor clicar em "Gerar Link" no cadastro de perfil.
              </small>
            </div>

            <div className="form-group">
              <label>Alterar Senha do Administrador</label>
              <input 
                type="password" 
                value={novaSenhaAdmin} 
                onChange={e => setNovaSenhaAdmin(e.target.value)} 
                placeholder="Deixe em branco para não alterar" 
              />
              <small style={{ color: "var(--text-secondary)" }}>
                Nova senha para login no painel de controle.
              </small>
            </div>
          </div>
          
          <button className="btn btn-primary" type="submit" style={{ marginTop: "10px" }}>
            💾 Salvar Configurações
          </button>
        </form>
      </div>
    </section>
  );
}

// 2. ADMIN VENDEDORES
function AdminVendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    whatsapp: "",
    limite_diario: 25,
    cpf: "",
    link_kiwify: "",
  });
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [editando, setEditando] = useState(null);

  async function carregarVendedores() {
    try {
      const res = await fetch(`${API_URL}/vendedores`);
      const dados = await res.json();
      if (dados.ok) setVendedores(dados.vendedores);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarVendedores();
  }, []);

  function formatarCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  }

  function alterarCampo(e) {
    const { name, value } = e.target;
    if (name === "cpf") {
      setForm(f => ({ ...f, [name]: formatarCPF(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  }

  async function gerarLinkAfiliacao() {
    try {
      const res = await fetch(`${API_URL}/configuracoes`);
      const data = await res.json();
      if (data.ok && data.link_afiliacao_kiwify) {
        window.open(data.link_afiliacao_kiwify, "_blank");
      } else {
        window.open("https://dashboard.kiwify.com.br/affiliate/join/exemplo", "_blank");
      }
    } catch (e) {
      window.open("https://dashboard.kiwify.com.br/affiliate/join/exemplo", "_blank");
    }
  }

  async function salvarVendedor(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!validarCPF(form.cpf)) {
      setErro("O CPF informado é inválido.");
      return;
    }

    try {
      let res;
      if (editando) {
        // Edit seller
        res = await fetch(`${API_URL}/vendedores/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            email: form.email,
            senha: form.senha || undefined, // only update password if filled
            whatsapp: form.whatsapp,
            limite_diario: Number(form.limite_diario),
            cpf: form.cpf,
            link_kiwify: form.link_kiwify,
          })
        });
      } else {
        // Create seller
        res = await fetch(`${API_URL}/vendedores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao salvar vendedor.");
        return;
      }

      setSucesso(editando ? "Vendedor atualizado com sucesso!" : "Vendedor cadastrado com sucesso!");
      setForm({ nome: "", email: "", senha: "", whatsapp: "", limite_diario: 25, cpf: "", link_kiwify: "" });
      setEditando(null);
      carregarVendedores();
    } catch (err) {
      setErro("Falha de conexão com o servidor.");
    }
  }

  function iniciarEdicao(vendedor) {
    setEditando(vendedor);
    setForm({
      nome: vendedor.nome,
      email: vendedor.email,
      senha: "", // keep blank unless change requested
      whatsapp: vendedor.whatsapp || "",
      limite_diario: vendedor.limite_diario,
      cpf: vendedor.cpf || "",
      link_kiwify: vendedor.link_kiwify || "",
    });
  }

  async function alternarAtivo(vendedor) {
    try {
      const res = await fetch(`${API_URL}/vendedores/${vendedor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: vendedor.ativo ? 0 : 1 })
      });
      if (res.ok) {
        carregarVendedores();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section>
      <h1>Gerenciamento de Vendedores</h1>
      <p className="subtitle">Cadastre e gerencie os limites diários e contas de acesso dos vendedores.</p>

      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success">{sucesso}</div>}

      <div className="card">
        <h2>{editando ? "Editar Vendedor" : "Cadastrar Novo Vendedor"}</h2>
        <form onSubmit={salvarVendedor}>
          <div className="form-grid">
            <div className="form-group">
              <label>Nome do Vendedor</label>
              <input name="nome" value={form.nome} onChange={alterarCampo} required placeholder="Ex: Marc Thay" />
            </div>
            <div className="form-group">
              <label>CPF</label>
              <input name="cpf" value={form.cpf} onChange={alterarCampo} required placeholder="000.000.000-00" />
            </div>
            <div className="form-group">
              <label>Link de Afiliado Kiwify</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input name="link_kiwify" value={form.link_kiwify} onChange={alterarCampo} placeholder="Cole seu link de afiliado Kiwify aqui (Opcional)" style={{ flexGrow: 1 }} />
                <button type="button" className="btn btn-secondary" style={{ margin: 0, padding: "0 16px", whiteSpace: "nowrap" }} onClick={gerarLinkAfiliacao}>
                  Gerar Link
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Email de Login</label>
              <input name="email" type="email" value={form.email} onChange={alterarCampo} required placeholder="vendedor@email.com" />
            </div>
            <div className="form-group">
              <label>Senha {editando && "(deixe em branco para não alterar)"}</label>
              <input name="senha" type="password" value={form.senha} onChange={alterarCampo} required={!editando} placeholder="******" />
            </div>
            <div className="form-group">
              <label>Número do WhatsApp</label>
              <input name="whatsapp" value={form.whatsapp} onChange={alterarCampo} required placeholder="Ex: 5511999999999" />
            </div>
            <div className="form-group">
              <label>Limite Diário de Leads</label>
              <input name="limite_diario" type="number" min="1" max="500" value={form.limite_diario} onChange={alterarCampo} required />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-primary" type="submit">
              {editando ? "Salvar Alterações" : "Cadastrar Vendedor"}
            </button>
            {editando && (
              <button className="btn btn-secondary" type="button" onClick={() => {
                setEditando(null);
                setForm({ nome: "", email: "", senha: "", whatsapp: "", limite_diario: 25, cpf: "", link_kiwify: "" });
              }}>Cancelar Edição</button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ margin: 0 }}>Vendedores Registrados</h2>
          <input 
            type="text" 
            placeholder="🔍 Filtrar por nome..." 
            value={filtroNome} 
            onChange={e => setFiltroNome(e.target.value)} 
            style={{ maxWidth: "250px", margin: 0 }}
          />
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Contato / Link Kiwify</th>
                <th>Limite Diário</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center" }}>Nenhum vendedor cadastrado.</td>
                </tr>
              ) : vendedores.filter(v => v.nome.toLowerCase().includes(filtroNome.toLowerCase())).length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center" }}>Nenhum vendedor encontrado com o nome "{filtroNome}".</td>
                </tr>
              ) : (
                vendedores
                  .filter(v => v.nome.toLowerCase().includes(filtroNome.toLowerCase()))
                  .map(v => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.nome}</strong>
                        <br /><small>{v.email}</small>
                        <br /><small style={{ color: "var(--text-tertiary)" }}>CPF: {v.cpf || "Não cadastrado"}</small>
                      </td>
                      <td>
                        <span>📞 {v.whatsapp}</span>
                        {v.link_kiwify && (
                          <>
                            <br />
                            <small style={{ color: "var(--text-tertiary)" }}>
                              Kiwify: <a href={v.link_kiwify} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>Abrir link</a>
                            </small>
                          </>
                        )}
                      </td>
                      <td>{v.limite_diario} leads/dia</td>
                      <td>
                        <span className={`badge ${v.ativo ? "badge-prevenda" : "badge-vacuo"}`}>
                          {v.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => iniciarEdicao(v)}>
                            ✏️ Editar
                          </button>
                          <button className={`btn ${v.ativo ? "btn-danger" : "btn-success"}`} style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => alternarAtivo(v)}>
                            {v.ativo ? "🚫 Desativar" : "✅ Ativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// 3. ADMIN LEADS CAPTURE
function AdminCaptura() {
  const [form, setForm] = useState({ query: "", nicho: "", limite: 15, nacional: false, bairros: "" });
  const [status, setStatus] = useState({ active: false, currentQuery: null, leadsCount: 0, capturas: [], recentLeads: [] });
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [minimizado, setMinimizado] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(true);
  const [prevActive, setPrevActive] = useState(false);

  async function checkStatus() {
    try {
      const res = await fetch(`${API_URL}/capturar-status`);
      const data = await res.json();
      if (data.ok) {
        setStatus({
          active: data.active,
          currentQuery: data.currentQuery,
          leadsCount: data.leadsCount,
          capturas: data.capturas || [],
          recentLeads: data.recentLeads || []
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status.active && !prevActive) {
      setMostrarModal(true);
      setMinimizado(false);
    }
    setPrevActive(status.active);
  }, [status.active, prevActive]);

  function alterarCampo(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ 
      ...f, 
      [name]: type === "checkbox" ? checked : value 
    }));
  }

  async function iniciarCaptura(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!form.query || !form.nicho) {
      setErro("A query de busca e o nicho são obrigatórios.");
      return;
    }

    if (form.nacional) {
      const confirmar = window.confirm("Esse processo pode demorar um pouco, você tem certeza?");
      if (!confirmar) return;
    }

    try {
      const res = await fetch(`${API_URL}/capturar-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao iniciar captura.");
        return;
      }

      setSucesso(data.message);
      checkStatus();
    } catch (err) {
      setErro("Erro ao comunicar com o servidor.");
    }
  }

  return (
    <section>
      <h1>Captura de Leads do Google Maps</h1>
      <p className="subtitle">Busque com precisão no Google Maps utilizando termos e categorize por nicho obrigatório.</p>

      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success">{sucesso}</div>}

      {status.active && (
        <div className="alert alert-info">
          <div className="loading-spinner" style={{ width: "20px", height: "20px", margin: "0" }}></div>
          <span>Extração de leads em segundo plano ativa. Você pode continuar usando o sistema normalmente enquanto os leads são salvos!</span>
        </div>
      )}

      <div className="card">
        <h2>Nova Busca e Extração</h2>
        <form onSubmit={iniciarCaptura}>
          <div className="form-grid">
            <div className="form-group">
              <label>O que buscar no Google Maps? (Termo de Busca)</label>
              <input 
                name="query" 
                value={form.query} 
                onChange={alterarCampo} 
                placeholder="Ex: Barbearia, Padaria, Academia" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Nicho Comercial (Obrigatório)</label>
              <input 
                name="nicho" 
                value={form.nicho} 
                onChange={alterarCampo} 
                placeholder="Ex: Barbearias, Padarias, Academias" 
                required 
              />
            </div>
            <div className="form-group">
              <label>{form.nacional ? "Limite de Leads por Cidade" : "Limite Máximo de Leads"}</label>
              <input 
                name="limite" 
                type="number" 
                min="1" 
                max="100" 
                value={form.limite} 
                onChange={alterarCampo} 
                required 
              />
              <small style={{ color: "var(--text-secondary)" }}>
                {form.nacional 
                  ? "Limite coletado em cada uma das cidades do país." 
                  : "Número total máximo de resultados a coletar localmente."
                }
              </small>
            </div>
          </div>

          {!form.nacional && (
            <div className="form-group" style={{ margin: "20px 0" }}>
              <label>Multiplicar Busca por Bairros/Regiões (Opcional - Separados por vírgula)</label>
              <input 
                name="bairros" 
                value={form.bairros} 
                onChange={alterarCampo} 
                placeholder="Ex: Pituba, Barra, Rio Vermelho, Brotas, Itapuã" 
              />
              <small style={{ color: "var(--text-secondary)", display: "block", marginTop: "4px" }}>
                Ao preencher, o sistema buscará o termo de busca individualmente em cada bairro (ex: se buscar "hamburgueria em Salvador", ele pesquisará "hamburgueria em Salvador - Pituba", etc.), garantindo uma varredura completa da cidade.
              </small>
            </div>
          )}

          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", margin: "15px 0 20px 0" }}>
            <input 
              type="checkbox" 
              name="nacional" 
              id="nacional" 
              checked={form.nacional} 
              onChange={alterarCampo} 
              style={{ width: "20px", height: "20px", cursor: "pointer", margin: 0 }}
            />
            <label 
              htmlFor="nacional" 
              style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)", cursor: "pointer", userSelect: "none", margin: 0 }}
            >
              🇧🇷 Varredura por Cidades (Buscar sequencialmente nas principais cidades do Brasil por estado em segundo plano)
            </label>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn btn-primary" type="submit">
              🔍 Iniciar Captura Automática
            </button>
            <button 
              className="btn btn-danger" 
              type="button"
              onClick={async () => {
                if (window.confirm("Tem certeza que deseja APAGAR TODOS os leads do sistema? Essa ação excluirá permanentemente todos os leads e pré-vendas registrados e é irreversível.")) {
                  try {
                    const res = await fetch(`${API_URL}/leads/limpar`, { method: "DELETE" });
                    const data = await res.json();
                    if (res.ok) {
                      alert(data.message);
                      checkStatus();
                    } else {
                      alert(data.error);
                    }
                  } catch (e) {
                    console.error(e);
                    alert("Erro ao comunicar com o servidor.");
                  }
                }
              }}
            >
              🗑️ Apagar Todos os Leads
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Fila de Capturas e Histórico</h2>
        <p className="subtitle">Monitore as capturas locais ou nacionais em execução e concluídas.</p>
        
        <div className="table-container" style={{ marginTop: "15px" }}>
          <table>
            <thead>
              <tr>
                <th>Termo</th>
                <th>Nicho</th>
                <th>Abrangência</th>
                <th>Status</th>
                <th>Progresso / Detalhes</th>
                <th>Leads Coletados</th>
                <th>Iniciado Em</th>
              </tr>
            </thead>
            <tbody>
              {status.capturas && status.capturas.length > 0 ? (
                status.capturas.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.query}</strong></td>
                    <td><span className="badge info">{c.nicho}</span></td>
                    <td>{c.nacional ? "🇧🇷 Por Cidades" : "📍 Local"}</td>
                    <td>
                      <span className={`badge ${
                        c.status === "rodando" ? "warning" : 
                        c.status === "concluido" ? "success" : "danger"
                      }`}>
                        {c.status === "rodando" ? "Rodando" : 
                         c.status === "concluido" ? "Concluído" : "Erro"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {c.status === "rodando" && (
                          <div className="loading-spinner" style={{ width: "12px", height: "12px", margin: "0" }}></div>
                        )}
                        <span>{c.progresso}</span>
                        {c.status === "rodando" && (
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: "4px 8px", fontSize: "0.75rem", margin: "0 0 0 10px", lineHeight: "1" }}
                            onClick={async () => {
                              if (window.confirm("Deseja realmente cancelar esta captura?")) {
                                try {
                                  const res = await fetch(`${API_URL}/capturar-cancelar/${c.id}`, { method: "POST" });
                                  if (res.ok) {
                                    checkStatus();
                                  }
                                } catch (e) {
                                  console.error("Erro ao cancelar captura:", e);
                                }
                              }
                            }}
                          >
                            ⏹️ Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                    <td><strong>{c.leadsCount}</strong> leads</td>
                    <td>
                      <small>
                        {new Date(c.criadoEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </small>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", color: "var(--text-tertiary)" }}>
                    Nenhuma busca ativa ou concluída nesta sessão do servidor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Instruções de Uso</h2>
        <p style={{ lineHeight: "1.6", color: "var(--text-secondary)" }}>
          O sistema abre o Google Maps em background usando automação <strong>Playwright</strong> de forma invisível. Ele pesquisa o termo informado, rola a lista de resultados lateral, acessa os detalhes de cada estabelecimento comercial, obtém o telefone (se visível), o endereço e o website. <br />
          Em seguida, o número é validado, duplicados são filtrados e os leads são cadastrados automaticamente com o status inicial de <strong>"Novo"</strong>.
        </p>
      </div>

      {/* Janela Flutuante de Coleta em Tempo Real */}
      <style>{`
        @keyframes pulse-glow {
          0% { transform: scale(1); box-shadow: 0 10px 25px rgba(217, 119, 6, 0.35); }
          50% { transform: scale(1.02); box-shadow: 0 10px 30px rgba(217, 119, 6, 0.6); }
          100% { transform: scale(1); box-shadow: 0 10px 25px rgba(217, 119, 6, 0.35); }
        }
        @keyframes slide-up {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {status.active && mostrarModal && !minimizado && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "360px",
          maxHeight: "480px",
          backgroundColor: "rgba(30, 30, 40, 0.94)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.55)",
          zIndex: 1000,
          color: "white",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Outfit', sans-serif",
          overflow: "hidden",
          animation: "slide-up 0.3s ease-out"
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(90deg, rgba(79, 70, 229, 0.25) 0%, rgba(30, 30, 40, 0.1) 100%)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="pulse-green" style={{
                width: "10px",
                height: "10px",
                backgroundColor: "#d97706",
                borderRadius: "50%",
                display: "inline-block",
                boxShadow: "0 0 8px #d97706"
              }}></span>
              <strong style={{ fontSize: "0.95rem", letterSpacing: "0.02em" }}>Coletando Leads...</strong>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button 
                onClick={() => setMinimizado(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  padding: "0px 4px",
                  lineHeight: 1
                }}
                title="Minimizar"
              >
                —
              </button>
              <button 
                onClick={() => setMostrarModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: "0px 4px",
                  lineHeight: 1
                }}
                title="Fechar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "16px 20px 20px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Info Box */}
            <div style={{ 
              backgroundColor: "rgba(255, 255, 255, 0.03)", 
              padding: "12px 14px", 
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
              <div style={{ fontSize: "0.75rem", color: "#a1a1aa", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Termo de Busca
              </div>
              <div style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "0.95rem" }}>
                {status.currentQuery || "Buscando..."}
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "8px" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#a1a1aa", fontWeight: "600" }}>COLETADOS</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: "800", color: "#818cf8" }}>{status.leadsCount} leads</div>
                </div>
                {status.capturas && status.capturas.find(c => c.status === "rodando") && (
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", color: "#a1a1aa", fontWeight: "600" }}>ABRANGÊNCIA</span>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "#e4e4e7", marginTop: "2px" }}>
                      {status.capturas.find(c => c.status === "rodando").nacional ? "🇧🇷 Nacional" : "📍 Local"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Progress Text */}
            {status.capturas && status.capturas.find(c => c.status === "rodando") && status.capturas.find(c => c.status === "rodando").progresso && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.82rem", color: "#38bdf8", backgroundColor: "rgba(56, 189, 248, 0.08)", padding: "8px 12px", borderRadius: "8px" }}>
                <div className="loading-spinner" style={{ width: "12px", height: "12px", borderWidth: "2px", borderColor: "#38bdf8 transparent transparent transparent", margin: 0 }}></div>
                <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {status.capturas.find(c => c.status === "rodando").progresso}
                </span>
              </div>
            )}

            {/* Recent Leads list */}
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#a1a1aa", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Últimos Leads Coletados
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {status.recentLeads && status.recentLeads.length > 0 ? (
                  status.recentLeads.slice(0, 5).map((l, idx) => (
                    <div key={idx} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.03)"
                    }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: "10px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {l.empresa}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#71717a" }}>
                          {l.cidade} - {l.estado}
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: "0.75rem", 
                        fontWeight: "700", 
                        color: "#34d399", 
                        backgroundColor: "rgba(52, 211, 153, 0.08)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontFamily: "monospace"
                      }}>
                        {l.telefone ? l.telefone.replace(/^55/, "") : ""}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0", color: "#71717a", fontSize: "0.8rem" }}>
                    Aguardando captura do primeiro lead...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer with Abort Action */}
          {status.capturas && status.capturas.find(c => c.status === "rodando") && (
            <div style={{
              padding: "10px 20px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "flex-end",
              backgroundColor: "rgba(0, 0, 0, 0.15)"
            }}>
              <button 
                className="btn btn-danger"
                style={{ padding: "6px 12px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}
                onClick={async () => {
                  const running = status.capturas.find(c => c.status === "rodando");
                  if (running && window.confirm("Deseja realmente cancelar esta varredura?")) {
                    try {
                      await fetch(`${API_URL}/capturar-cancelar/${running.id}`, { method: "POST" });
                      checkStatus();
                    } catch (e) {
                      console.error("Erro ao cancelar captura:", e);
                    }
                  }
                }}
              >
                ⏹️ Parar Varredura
              </button>
            </div>
          )}
        </div>
      )}

      {/* Minimized Widget */}
      {status.active && (minimizado || !mostrarModal) && (
        <div 
          onClick={() => {
            setMinimizado(false);
            setMostrarModal(true);
          }}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            height: "46px",
            backgroundColor: "rgba(217, 119, 6, 0.95)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "23px",
            boxShadow: "0 10px 25px rgba(217, 119, 6, 0.35)",
            zIndex: 1000,
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "0 18px",
            cursor: "pointer",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "0.88rem",
            fontWeight: "700",
            animation: "pulse-glow 2s infinite"
          }}
        >
          <div className="loading-spinner" style={{ width: "12px", height: "12px", borderWidth: "2px", borderColor: "white transparent transparent transparent", margin: 0 }}></div>
          <span>Coleta Ativa: {status.leadsCount} leads</span>
          <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>↗️</span>
        </div>
      )}
    </section>
  );
}

// 4. ADMIN LEADS LIST & AUTO DISTRIBUTION
function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [filtros, setFiltros] = useState({ nicho: "", status: "" });
  const [distribuindo, setDistribuindo] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState("");

  // Estados para Importação de CSV
  const [csvFile, setCsvFile] = useState(null);
  const [csvLeads, setCsvLeads] = useState([]);
  const [nichoPadrao, setNichoPadrao] = useState("Geral");
  const [csvErro, setCsvErro] = useState("");
  const [csvSucesso, setCsvSucesso] = useState("");
  const [importandoCsv, setImportandoCsv] = useState(false);

  function handleCsvChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    setCsvErro("");
    setCsvSucesso("");
    setCsvLeads([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setCsvErro("O arquivo CSV está vazio ou contém apenas o cabeçalho.");
          return;
        }

        // Detectar separador (, ou ;)
        const headerLine = lines[0];
        const separator = headerLine.includes(";") ? ";" : ",";

        // Parsear cabeçalhos
        const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());
        
        // Mapear índices das colunas
        const idxEmpresa = headers.findIndex(h => h.includes("empresa") || h.includes("nome") || h.includes("name") || h.includes("estabelecimento") || h.includes("lead"));
        const idxTelefone = headers.findIndex(h => h.includes("telefone") || h.includes("phone") || h.includes("celular") || h.includes("tel"));
        const idxCidade = headers.findIndex(h => h.includes("cidade") || h.includes("city") || h.includes("municipio"));
        const idxEstado = headers.findIndex(h => h.includes("estado") || h.includes("state") || h.includes("uf"));
        const idxNicho = headers.findIndex(h => h.includes("nicho") || h.includes("niche") || h.includes("categoria"));
        const idxSite = headers.findIndex(h => h.includes("site") || h.includes("website") || h.includes("link"));
        const idxEndereco = headers.findIndex(h => h.includes("endereco") || h.includes("address") || h.includes("logradouro") || h.includes("rua"));

        if (idxEmpresa === -1 || idxTelefone === -1) {
          setCsvErro("Colunas obrigatórias 'empresa' (ou 'nome') e 'telefone' não identificadas no cabeçalho.");
          return;
        }

        const parsedLeads = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const cols = line.split(separator).map(c => {
            let val = c.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1).trim();
            }
            return val;
          });

          if (cols.length <= Math.max(idxEmpresa, idxTelefone)) {
            continue;
          }

          const empresaVal = cols[idxEmpresa];
          const telefoneVal = cols[idxTelefone];

          if (!empresaVal || !telefoneVal) continue;

          parsedLeads.push({
            empresa: empresaVal,
            telefone: telefoneVal,
            cidade: idxCidade !== -1 ? cols[idxCidade] : "",
            estado: idxEstado !== -1 ? cols[idxEstado] : "",
            nicho: idxNicho !== -1 && cols[idxNicho] ? cols[idxNicho] : "",
            site: idxSite !== -1 ? cols[idxSite] : "",
            endereco: idxEndereco !== -1 ? cols[idxEndereco] : ""
          });
        }

        if (parsedLeads.length === 0) {
          setCsvErro("Nenhum lead válido foi encontrado no CSV.");
        } else {
          setCsvLeads(parsedLeads);
        }
      } catch (err) {
        setCsvErro("Erro ao processar arquivo: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function enviarCsv() {
    if (csvLeads.length === 0 || importandoCsv) return;
    setImportandoCsv(true);
    setCsvErro("");
    setCsvSucesso("");

    // Preencher nicho padrão se estiver vazio
    const leadsFinal = csvLeads.map(l => ({
      ...l,
      nicho: l.nicho || nichoPadrao
    }));

    try {
      const res = await fetch(`${API_URL}/leads/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsFinal })
      });
      const data = await res.json();
      if (res.ok) {
        setCsvSucesso(data.message);
        setCsvLeads([]);
        setCsvFile(null);
        
        // Resetar campo de arquivo
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = "";
        
        carregarLeads();
      } else {
        setCsvErro(data.error || "Erro ao importar leads.");
      }
    } catch (err) {
      setCsvErro("Falha na comunicação com o servidor.");
    } finally {
      setImportandoCsv(false);
    }
  }

  async function carregarLeads() {
    try {
      const res = await fetch(`${API_URL}/leads`);
      const data = await res.json();
      if (data.ok) setLeads(data.leads);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarLeads();
  }, []);

  async function distribuirLeads() {
    setDistribuindo(true);
    setMensagemStatus("");
    try {
      const res = await fetch(`${API_URL}/distribuir-leads`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMensagemStatus(data.message);
        carregarLeads();
      } else {
        setMensagemStatus(`Erro: ${data.error}`);
      }
    } catch (e) {
      setMensagemStatus("Erro ao conectar com o servidor.");
    } finally {
      setDistribuindo(false);
    }
  }

  function exportarLeadsCSV() {
    if (leadsFiltrados.length === 0) {
      alert("Não há leads para exportar.");
      return;
    }

    const headers = [
      "ID",
      "Empresa",
      "Telefone",
      "Nicho",
      "Cidade",
      "Estado",
      "Status",
      "Vendedor Responsável",
      "Origem",
      "Termo de Busca (Query)",
      "Endereço",
      "Site",
      "Última Mensagem",
      "Observações",
      "Criado Em"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const stringified = String(val);
      return `"${stringified.replace(/"/g, '""')}"`;
    };

    const rows = leadsFiltrados.map(l => [
      l.id,
      l.empresa,
      l.telefone,
      l.nicho,
      l.cidade,
      l.estado,
      l.status,
      l.vendedor_nome || "Não atribuído",
      l.origem,
      l.query_origem,
      l.endereco,
      l.site,
      l.ultima_mensagem,
      l.observacoes,
      l.criado_em
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(";"),
      ...rows.map(row => row.map(escapeCsv).join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_exportados_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Get unique niches and statuses for dropdown filters
  const nichosUnicos = [...new Set(leads.map(l => l.nicho))];
  const statusUnicos = [...new Set(leads.map(l => l.status))];

  const leadsFiltrados = leads.filter(l => {
    const matchNicho = filtros.nicho ? l.nicho === filtros.nicho : true;
    const matchStatus = filtros.status ? l.status === filtros.status : true;
    return matchNicho && matchStatus;
  });

  return (
    <section>
      <h1>Base Geral de Leads</h1>
      <p className="subtitle">Visualize todos os leads capturados, filtre por nicho/status e realize a distribuição automática.</p>

      {mensagemStatus && (
        <div className={`alert ${mensagemStatus.includes("Erro") ? "alert-error" : "alert-success"}`}>
          {mensagemStatus}
        </div>
      )}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "12px" }}>
          <div className="form-group" style={{ minWidth: "180px" }}>
            <select value={filtros.nicho} onChange={e => setFiltros(f => ({ ...f, nicho: e.target.value }))}>
              <option value="">Filtrar por Nicho (Todos)</option>
              {nichosUnicos.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: "180px" }}>
            <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
              <option value="">Filtrar por Status (Todos)</option>
              {statusUnicos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-primary" onClick={distribuirLeads} disabled={distribuindo}>
            🚀 {distribuindo ? "Distribuindo..." : "Distribuir Leads para Vendedores"}
          </button>
          <button className="btn btn-secondary" onClick={exportarLeadsCSV}>
            📥 Exportar Leads (CSV)
          </button>
          <button 
            className="btn btn-danger" 
            onClick={async () => {
              if (window.confirm("Tem certeza que deseja APAGAR TODOS os leads do sistema? Essa ação excluirá permanentemente todos os leads e pré-vendas registrados e é irreversível.")) {
                try {
                  const res = await fetch(`${API_URL}/leads/limpar`, { method: "DELETE" });
                  const data = await res.json();
                  if (res.ok) {
                    setMensagemStatus(data.message);
                    carregarLeads();
                  } else {
                    setMensagemStatus("Erro: " + data.error);
                  }
                } catch (e) {
                  console.error(e);
                  setMensagemStatus("Erro ao comunicar com o servidor.");
                }
              }
            }}
          >
            🗑️ Limpar Carteira
          </button>
        </div>
      </div>

      {/* Card de Importação de CSV */}
      <div className="card" style={{ marginTop: "20px" }}>
        <h2>📥 Importar Leads via CSV</h2>
        <p className="subtitle" style={{ fontSize: "0.85rem", marginTop: "-5px", marginBottom: "15px" }}>
          Suba arquivos no formato <code style={{ color: "var(--primary)" }}>.csv</code> para importar seus leads. 
          O cabeçalho deve conter colunas como <code style={{ color: "var(--primary)" }}>empresa</code> e <code style={{ color: "var(--primary)" }}>telefone</code> (obrigatórias), 
          além de <code style={{ color: "var(--primary)" }}>cidade, estado, nicho, site, endereco</code> (opcionais).
        </p>

        {csvErro && <div className="alert alert-error" style={{ padding: "8px 12px", fontSize: "0.85rem", marginBottom: "15px" }}>{csvErro}</div>}
        {csvSucesso && <div className="alert alert-success" style={{ padding: "8px 12px", fontSize: "0.85rem", marginBottom: "15px" }}>{csvSucesso}</div>}

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1, minWidth: "250px" }}>
            <label>Selecione o arquivo CSV</label>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCsvChange}
              style={{
                border: "1px dashed var(--border-color)",
                padding: "8px",
                borderRadius: "8px",
                background: "var(--bg-tertiary)",
                width: "100%",
                cursor: "pointer"
              }}
            />
          </div>

          <div className="form-group" style={{ width: "200px" }}>
            <label>Nicho Padrão (Fallback)</label>
            <input 
              type="text" 
              value={nichoPadrao} 
              onChange={e => setNichoPadrao(e.target.value)} 
              placeholder="Ex: Geral"
            />
          </div>

          <div>
            <button 
              className="btn btn-primary" 
              onClick={enviarCsv} 
              disabled={csvLeads.length === 0 || importandoCsv}
              style={{ padding: "12px 20px" }}
              type="button"
            >
              {importandoCsv ? "Importando..." : `Confirmar Importação (${csvLeads.length} Leads)`}
            </button>
          </div>
        </div>

        {csvLeads.length > 0 && (
          <div style={{ marginTop: "15px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-tertiary)" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "var(--primary)", fontSize: "0.9rem" }}>🔍 Pré-visualização dos Leads:</h4>
            <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.85rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ textAlign: "left", padding: "4px" }}>Empresa</th>
                    <th style={{ textAlign: "left", padding: "4px" }}>Telefone</th>
                    <th style={{ textAlign: "left", padding: "4px" }}>Nicho</th>
                    <th style={{ textAlign: "left", padding: "4px" }}>Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {csvLeads.slice(0, 5).map((l, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "4px" }}>{l.empresa}</td>
                      <td style={{ padding: "4px" }}>{l.telefone}</td>
                      <td style={{ padding: "4px" }}>{l.nicho || nichoPadrao}</td>
                      <td style={{ padding: "4px" }}>{l.cidade || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvLeads.length > 5 && (
                <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: "6px", fontSize: "0.8rem" }}>
                  ... e mais {csvLeads.length - 5} leads.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
          <h2>Lista de Leads ({leadsFiltrados.length})</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Nicho</th>
                <th>Cidade/UF</th>
                <th>Status</th>
                <th>Vendedor Responsável</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>Nenhum lead encontrado com os filtros atuais.</td>
                </tr>
              ) : (
                leadsFiltrados.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.empresa}</strong>
                      {l.site && (
                        <><br /><a href={l.site} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "var(--primary)" }}>🌐 Acessar Site</a></>
                      )}
                    </td>
                    <td>{l.telefone}</td>
                    <td><span className="badge badge-distribuido" style={{ textTransform: "none" }}>{l.nicho}</span></td>
                    <td>{l.cidade} / {l.estado}</td>
                    <td>
                      <span className={`badge badge-${l.status.toLowerCase().replace(/[^a-z]/g, "")}`}>
                        {l.status}
                      </span>
                    </td>
                    <td>{l.vendedor_nome ? <strong>👤 {l.vendedor_nome}</strong> : <span style={{ color: "var(--text-tertiary)" }}>Não atribuído</span>}</td>
                    <td><small>{l.origem}<br />({l.query_origem})</small></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// 5. ADMIN MESSAGING TEMPLATE
// 5. ADMIN MESSAGING TEMPLATE
function AdminMensagens() {
  const [abaAtiva, setAbaAtiva] = useState("prospeccao"); // "prospeccao" ou "chat-rapido"
  const [mensagens, setMensagens] = useState([]);
  const [form, setForm] = useState({ nome: "", texto: "" });
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function carregarDados() {
    try {
      const endpoint = abaAtiva === "prospeccao" ? "/mensagens" : "/respostas-rapidas";
      const res = await fetch(`${API_URL}${endpoint}`);
      const data = await res.json();
      if (data.ok) {
        if (abaAtiva === "prospeccao") {
          setMensagens(data.mensagens || []);
        } else {
          setMensagens(data.templates || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [abaAtiva]);

  async function salvarMensagem(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!form.nome || !form.texto) {
      setErro("Título/Nome e Texto são obrigatórios.");
      return;
    }

    try {
      const isProsp = abaAtiva === "prospeccao";
      const endpoint = isProsp ? "/mensagens" : "/respostas-rapidas";
      const url = editingId ? `${API_URL}${endpoint}/${editingId}` : `${API_URL}${endpoint}`;
      const method = editingId ? "PUT" : "POST";
      
      const body = isProsp 
        ? { nome: form.nome, texto: form.texto }
        : { titulo: form.nome, texto: form.texto };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso(editingId ? "Atualizado com sucesso!" : "Criado com sucesso!");
        setForm({ nome: "", texto: "" });
        setEditingId(null);
        carregarDados();
      } else {
        setErro(data.error || "Erro ao salvar.");
      }
    } catch (e) {
      setErro("Erro de comunicação com o servidor.");
    }
  }

  async function ativarMensagem(id) {
    try {
      const res = await fetch(`${API_URL}/mensagens/${id}/ativar`, { method: "PUT" });
      if (res.ok) {
        carregarDados();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function iniciarEdicao(m) {
    setEditingId(m.id);
    setForm({ 
      nome: abaAtiva === "prospeccao" ? m.nome : m.titulo, 
      texto: m.texto 
    });
    setErro("");
    setSucesso("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicao() {
    setEditingId(null);
    setForm({ nome: "", texto: "" });
    setErro("");
    setSucesso("");
  }

  async function excluirMensagem(id) {
    if (!window.confirm("Tem certeza que deseja excluir este modelo?")) {
      return;
    }

    setErro("");
    setSucesso("");
    try {
      const endpoint = abaAtiva === "prospeccao" ? "/mensagens" : "/respostas-rapidas";
      const res = await fetch(`${API_URL}${endpoint}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setSucesso("Excluído com sucesso!");
        if (editingId === id) {
          cancelarEdicao();
        }
        carregarDados();
      } else {
        setErro(data.error || "Erro ao excluir.");
      }
    } catch (e) {
      setErro("Erro de comunicação.");
    }
  }

  const isProsp = abaAtiva === "prospeccao";

  return (
    <section>
      <h1>Modelos de Mensagem</h1>
      <p className="subtitle">
        {isProsp 
          ? "Configure o modelo de mensagem que os vendedores dispararão automaticamente via WhatsApp Web."
          : "Configure as respostas rápidas pré-salvas que os vendedores usarão no chat de duas vias."}
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          className={`btn ${isProsp ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setAbaAtiva("prospeccao");
            cancelarEdicao();
          }}
          type="button"
        >
          📢 Prospecção Automática
        </button>
        <button
          className={`btn ${!isProsp ? "btn-primary" : "btn-secondary"}`}
          onClick={() => {
            setAbaAtiva("chat-rapido");
            cancelarEdicao();
          }}
          type="button"
        >
          💬 Respostas Rápidas (Chat)
        </button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success">{sucesso}</div>}

      <div className="card">
        <h2>
          {editingId 
            ? (isProsp ? "Editar Modelo de Mensagem" : "Editar Resposta Rápida")
            : (isProsp ? "Criar Novo Modelo" : "Criar Nova Resposta Rápida")}
        </h2>
        <form onSubmit={salvarMensagem}>
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label>
              {isProsp 
                ? "Nome do Modelo (Identificação Interna)" 
                : "Título do Atalho (Ex: Preço, Como Funciona, Pix)"}
            </label>
            <input 
              name="nome" 
              value={form.nome} 
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} 
              placeholder={isProsp ? "Ex: Primeiro Contato - Padarias" : "Ex: Link de Pagamento"} 
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label>
              {isProsp 
                ? "Texto da Mensagem (Suporta variáveis)" 
                : "Texto da Resposta (Suporta variáveis)"}
            </label>
            <textarea 
              name="texto" 
              value={form.texto} 
              onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} 
              rows="6" 
              placeholder={isProsp ? "Olá {saudacao}! Vi a empresa {empresa} no..." : "Excelente! Compre no link seguro: {link_kiwify}"} 
              required 
            />
            <small style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
              {isProsp ? (
                <>
                  Variáveis dinâmicas suportadas: <code style={{ color: "var(--primary)" }}>{"{saudacao}"}</code> (Bom dia/Boa tarde/Boa noite), <code style={{ color: "var(--primary)" }}>{"{empresa}"}</code> (Nome do lead), <code style={{ color: "var(--primary)" }}>{"{nicho}"}</code> (Nicho comercial).
                </>
              ) : (
                <>
                  Variáveis dinâmicas suportadas: <code style={{ color: "var(--primary)" }}>{"{link_kiwify}"}</code> (Link de afiliado do vendedor), <code style={{ color: "var(--primary)" }}>{"{empresa}"}</code> (Nome da empresa do lead).
                </>
              )}
            </small>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-primary" type="submit">
              {editingId ? "Salvar Alterações" : "Salvar Modelo"}
            </button>
            {editingId && (
              <button className="btn btn-secondary" type="button" onClick={cancelarEdicao}>
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>{isProsp ? "Modelos Salvos" : "Respostas Rápidas Salvas"}</h2>
        {isProsp && (
          <p className="subtitle" style={{ fontSize: "0.85rem", marginTop: "-5px", marginBottom: "15px" }}>
            Ative múltiplos modelos simultaneamente para rotacionar as mensagens de modo aleatório nos disparos automáticos.
          </p>
        )}
        {mensagens.length === 0 ? (
          <p>Nenhum modelo cadastrado.</p>
        ) : (
          mensagens.map(m => (
            <div className={`msg-item ${isProsp && m.ativa === 1 ? "active" : ""}`} key={m.id}>
              <div style={{ flex: 1, paddingRight: "15px" }}>
                <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)" }}>
                  {isProsp ? m.nome : m.titulo} 
                  {isProsp && m.ativa === 1 && <span className="badge badge-prevenda" style={{ marginLeft: "10px" }}>Ativo em Rotação</span>}
                </h3>
                <p style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>{m.texto}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignSelf: "center" }}>
                {isProsp && (
                  <button 
                    className={`btn ${m.ativa === 1 ? "btn-secondary" : "btn-primary"}`} 
                    style={{ padding: "6px 12px", fontSize: "0.85rem", whiteSpace: "nowrap" }} 
                    onClick={() => ativarMensagem(m.id)}
                  >
                    {m.ativa === 1 ? "🔴 Desativar" : "🟢 Ativar"}
                  </button>
                )}
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: "6px 12px", fontSize: "0.85rem", whiteSpace: "nowrap", border: "1px solid var(--border-color)" }} 
                  onClick={() => iniciarEdicao(m)}
                >
                  ✏️ Editar
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: "6px 12px", fontSize: "0.85rem", whiteSpace: "nowrap", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--danger)" }} 
                  onClick={() => excluirMensagem(m.id)}
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// 6. ADMIN PRE-SALES & COMMISSIONS
function AdminPreVendas() {
  const [preVendas, setPreVendas] = useState([]);
  const [mensagem, setMensagem] = useState("");

  async function carregarPreVendas() {
    try {
      const res = await fetch(`${API_URL}/pre-vendas`);
      const data = await res.json();
      if (data.ok) setPreVendas(data.preVendas);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarPreVendas();
  }, []);

  async function atualizarPreVenda(id, status) {
    try {
      const res = await fetch(`${API_URL}/pre-vendas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setMensagem(`Pré-venda ${status.toLowerCase()} com sucesso!`);
        carregarPreVendas();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section>
      <h1>Controle de Pré-Vendas e Comissões</h1>
      <p className="subtitle">Aprove ou rejeite as pré-vendas enviadas pelos vendedores para consolidar as comissões e atualizar o status do lead para "Comprou".</p>

      {mensagem && <div className="alert alert-success">{mensagem}</div>}

      <div className="card">
        <h2>Pré-Vendas Submetidas</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Lead / Empresa</th>
                <th>WhatsApp Lead</th>
                <th>Observações do Fechamento</th>
                <th>Data Submissão</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {preVendas.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>Nenhuma pré-venda registrada.</td>
                </tr>
              ) : (
                preVendas.map(pv => (
                  <tr key={pv.id}>
                    <td><strong>{pv.vendedor_nome}</strong></td>
                    <td><strong>{pv.empresa}</strong><br /><small>{pv.nicho}</small></td>
                    <td>{pv.telefone}</td>
                    <td>{pv.observacoes || <span style={{ color: "var(--text-tertiary)" }}>Sem observações</span>}</td>
                    <td>{new Date(pv.criado_em).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className={`badge ${pv.status === "Pendente" ? "badge-depois" : pv.status === "Aprovada" ? "badge-prevenda" : "badge-vacuo"}`}>
                        {pv.status}
                      </span>
                    </td>
                    <td>
                      {pv.status === "Pendente" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => atualizarPreVenda(pv.id, "Aprovada")}>
                            ✅ Aprovar
                          </button>
                          <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => atualizarPreVenda(pv.id, "Recusada")}>
                            🚫 Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>Concluída</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// Landing Page com painel fake de vendas e termos
function LandingPage({ setPagina }) {
  const [funcionarios, setFuncionarios] = useState(893);
  const [vendas, setVendas] = useState(581);
  const [feed, setFeed] = useState([
    { id: 1, nome: "Ana Paula S.", venda: 4, comissao: 800, tempo: "há 2 min" },
    { id: 2, nome: "Rodrigo M.", venda: 2, comissao: 800, tempo: "há 5 min" },
    { id: 3, nome: "Thiago K.", venda: 6, comissao: 800, tempo: "há 8 min" }
  ]);

  useEffect(() => {
    const intervalFunc = setInterval(() => {
      setFuncionarios(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        const novo = prev + delta;
        return Math.min(Math.max(novo, 880), 915);
      });
    }, 3500);

    const intervalVendas = setInterval(() => {
      setVendas(prev => prev + 1);
      
      const NOMES = [
        "Ana Paula S.", "Rodrigo M.", "Thiago K.", "Mariana C.", 
        "Felipe T.", "Juliana R.", "Lucas V.", "Camila L.", 
        "Marcos G.", "Isabela D.", "Renato F.", "Gabriela B."
      ];
      const nomeSorteado = NOMES[Math.floor(Math.random() * NOMES.length)];
      const nVenda = Math.floor(Math.random() * 5) + 1;
      
      setFeed(prev => {
        const novaNotif = {
          id: Date.now(),
          nome: nomeSorteado,
          venda: nVenda,
          comissao: 800,
          tempo: "agora mesmo"
        };
        return [novaNotif, ...prev.slice(0, 2)];
      });
    }, 8000);

    return () => {
      clearInterval(intervalFunc);
      clearInterval(intervalVendas);
    };
  }, []);

  const valorComissoes = (vendas * 800).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  });

  return (
    <div className="landing-container">
      <section className="landing-hero">
        <div className="landing-glow"></div>
        <div style={{ display: "inline-block", background: "linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(217, 119, 6,0.1) 100%)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "50px", padding: "6px 16px", fontSize: "0.85rem", fontWeight: "700", color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "24px" }}>
          ⚡ SISTEMA DE ALTA CONVERSÃO ENTERPRISE
        </div>
        <h1 className="landing-title" style={{ background: "linear-gradient(135deg, #ffffff 30%, #fbbf24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Sua Máquina de Vendas no Automático
        </h1>
        <p className="landing-subtitle">
          A única plataforma enterprise de prospecção e vendas automatizada que faz o seu WhatsApp faturar alto. Ofereça soluções premium para leads qualificados e receba comissões de elite direto na sua conta.
        </p>
      </section>

      <section className="landing-activity-panel" style={{ background: "rgba(11, 19, 41, 0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(217, 119, 6, 0.2)" }}>
        <h2 className="panel-title" style={{ background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Painel de Faturamento em Tempo Real
        </h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ backgroundColor: "rgba(217, 119, 6, 0.1)", color: "#d97706" }}>
              <span className="stat-pulse" style={{ backgroundColor: "#d97706", boxShadow: "0 0 0 0 rgba(217, 119, 6, 0.7)" }}></span>
              👤
            </div>
            <div className="stat-info">
              <span className="stat-number">{funcionarios}</span>
              <span className="stat-label">Licenciados faturando agora</span>
            </div>
          </div>
          
          <div className="stat-card highlight" style={{ border: "1px solid rgba(251, 191, 36, 0.3)", background: "linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, transparent 100%)" }}>
            <div className="stat-icon-wrapper" style={{ backgroundColor: "rgba(251, 191, 36, 0.1)", color: "#fbbf24" }}>
              💵
            </div>
            <div className="stat-info">
              <span className="stat-number" style={{ color: "#fbbf24" }}>{valorComissoes}</span>
              <span className="stat-label">Comissões distribuídas hoje</span>
            </div>
          </div>
        </div>

        <div className="live-feed-container" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <h3 className="feed-subtitle">Histórico de Lucro Instantâneo</h3>
          <div className="feed-list">
            {feed.map(item => (
              <div key={item.id} className="feed-item fade-in" style={{ background: "rgba(255, 255, 255, 0.01)", borderColor: "rgba(255, 255, 255, 0.05)" }}>
                <div className="feed-avatar" style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)" }}>
                  {item.nome.charAt(0)}
                </div>
                <div className="feed-text">
                  <span><strong>{item.nome}</strong> acabou de realizar a <strong>{item.venda}ª venda</strong> do dia.</span>
                  <div className="feed-meta">
                    <span className="comissao-pill" style={{ background: "rgba(251, 191, 36, 0.12)", color: "#fbbf24", border: "1px solid rgba(251, 191, 36, 0.2)" }}>
                      +{item.comissao} R$ Comissão
                    </span>
                    <span className="feed-time">{item.tempo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-how-it-works">
        <h2 className="section-title">Como Funciona?</h2>
        <p className="section-subtitle">É simples, rápido e de altíssima conversão. Você está a apenas três passos de ativar a sua máquina.</p>
        
        <div className="steps-container">
          <div className="step-card" style={{ background: "rgba(11, 19, 41, 0.4)", borderColor: "rgba(255, 255, 255, 0.05)" }}>
            <div className="step-num" style={{ background: "linear-gradient(135deg, var(--accent-gold) 0%, #fbbf24 100%)", boxShadow: "0 4px 15px rgba(251, 191, 36, 0.3)" }}>1</div>
            <h3>Crie seu Perfil de Vendas</h3>
            <p>Crie sua conta em menos de 1 minuto e insira seu link de afiliado da Kiwify para receber as comissões direto na sua conta.</p>
          </div>
          <div className="step-card" style={{ background: "rgba(11, 19, 41, 0.4)", borderColor: "rgba(255, 255, 255, 0.05)" }}>
            <div className="step-num">2</div>
            <h3>Conecte seu WhatsApp</h3>
            <p>Faça a conexão instantânea por QR Code ou número do seu WhatsApp com total estabilidade e segurança.</p>
          </div>
          <div className="step-card" style={{ background: "rgba(11, 19, 41, 0.4)", borderColor: "rgba(255, 255, 255, 0.05)" }}>
            <div className="step-num">3</div>
            <h3>Ative os Disparos e Fature</h3>
            <p>O robô entra em ação. O sistema automatizado começa a ofertar o produto exclusivo para milhares de leads altamente propensos a comprar.</p>
          </div>
        </div>

        <div className="callout-box">
          <p>
            Feche a venda com o seu link e receba comissão de <strong>R$ 800 reais</strong> por transação depositada de forma imediata no seu saldo da <strong>Kiwify</strong>.
          </p>
          <button className="btn-cta" onClick={() => setPagina("cadastro-vendedor")}>
            🚀 QUERO ATIVAR MINHA OPERAÇÃO E FATURAR
          </button>
        </div>
      </section>

      <section className="landing-disclaimer">
        <div className="disclaimer-box">
          <h3 style={{ color: "var(--accent-gold)" }}>⚠️ Termo de Responsabilidade Operacional</h3>
          <p>
            A integridade, segurança e a estabilidade da sua conta do WhatsApp são de responsabilidade exclusiva do licenciador/vendedor.
          </p>
          <p>
            A plataforma opera com técnicas avançadas contra bloqueios, mas caso o número seja desativado devido ao alto volume de envios, o procedimento padrão é prático: <strong>basta descartar o chip antigo e conectar um novo número</strong> para continuar faturando sem interrupções.
          </p>
        </div>
      </section>
    </div>
  );
}

// 6.5. VENDEDOR DASHBOARD
function VendedorDashboard({ usuarioLogado, setUsuarioLogado }) {

  const [stats, setStats] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [novoLinkKiwify, setNovoLinkKiwify] = useState(usuarioLogado.link_kiwify || "");
  const [salvandoLink, setSalvandoLink] = useState(false);

  useEffect(() => {
    if (usuarioLogado.link_kiwify) {
      setNovoLinkKiwify(usuarioLogado.link_kiwify);
    }
  }, [usuarioLogado.link_kiwify]);

  async function salvarLinkKiwify() {
    if (!novoLinkKiwify.trim()) {
      setMensagemErro("Por favor, informe um link de afiliado válido.");
      return;
    }
    setSalvandoLink(true);
    setMensagemSucesso("");
    setMensagemErro("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_kiwify: novoLinkKiwify.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...usuarioLogado, link_kiwify: novoLinkKiwify.trim() };
        localStorage.setItem("usuarioLogado", JSON.stringify(updatedUser));
        setUsuarioLogado(updatedUser);
        setMensagemSucesso("Link de afiliado Kiwify cadastrado com sucesso!");
      } else {
        setMensagemErro(data.error || "Erro ao atualizar link de afiliado.");
      }
    } catch (e) {
      setMensagemErro("Erro de comunicação com o servidor.");
    } finally {
      setSalvandoLink(false);
    }
  }

  async function carregarStats() {
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/dashboard-stats`);
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
      } else {
        setErro(data.error || "Erro ao carregar estatísticas.");
      }
    } catch (e) {
      setErro("Erro de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarStats();
  }, [usuarioLogado.id]);

  async function ativarModoGerente() {
    setMensagemSucesso("");
    setMensagemErro("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/ativar-gerente`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setMensagemSucesso(data.message || "Modo gerente ativado com sucesso!");
        carregarStats();
      } else {
        setMensagemErro(data.error || "Erro ao ativar modo gerente.");
      }
    } catch (e) {
      setMensagemErro("Erro de comunicação com o servidor.");
    }
  }

  if (carregando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
        <div className="pulse" style={{ color: "var(--primary)", fontWeight: "600" }}>Carregando painel de controle...</div>
      </div>
    );
  }

  if (erro) {
    return <div className="alert alert-error">{erro}</div>;
  }

  if (!stats) return null;

  // Calculo de porcentagem da meta
  const pctMeta = Math.min(100, Math.round((stats.leads_hoje / stats.limite_diario) * 100));

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1>Painel da Minha Operação</h1>
          <p className="subtitle" style={{ margin: 0 }}>Acompanhe seu faturamento, progresso de envios diários e comissões da Máquina de Vendas.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary" onClick={carregarStats} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            🔄 Atualizar
          </button>
        </div>
      </div>

      {mensagemSucesso && <div className="alert alert-success" style={{ marginBottom: "20px" }}>{mensagemSucesso}</div>}
      {mensagemErro && <div className="alert alert-error" style={{ marginBottom: "20px" }}>{mensagemErro}</div>}

      {(!usuarioLogado.link_kiwify || usuarioLogado.link_kiwify.trim() === "") && (
        <div className="card" style={{ 
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)", 
          border: "1px solid rgba(251, 191, 36, 0.3)", 
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 8px 32px rgba(251, 191, 36, 0.05)",
          textAlign: "left"
        }}>
          <h3 style={{ color: "var(--accent-gold)", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px 0", fontSize: "1.15rem", fontWeight: "700" }}>
            ⚠️ Falta cadastrar o link de afiliado
          </h3>
          <div style={{ marginBottom: "15px" }}>
            <p style={{ fontSize: "1rem", margin: "0 0 8px 0" }}>
              👉 <a href="https://dashboard.kiwify.com/join/affiliate/lSr40GrG" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: "700", textDecoration: "underline" }}>Clique aqui para se afiliar ao produto e conseguir as comissões</a>
            </p>
            <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
              Após se afiliar, copie seu link de vendas gerado na Kiwify, cole no campo abaixo e salve. Quando o cliente se interessar envie o link gerado.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input 
              type="text" 
              placeholder="Cole seu link de afiliado Kiwify aqui" 
              value={novoLinkKiwify}
              onChange={(e) => setNovoLinkKiwify(e.target.value)}
              style={{ 
                flexGrow: 1, 
                padding: "10px 14px", 
                borderRadius: "8px", 
                border: "1px solid var(--border-color)", 
                background: "var(--bg-secondary)", 
                color: "var(--text-primary)",
                fontSize: "0.9rem"
              }} 
            />
            <button 
              className="btn btn-primary" 
              style={{ margin: 0, padding: "10px 20px" }}
              disabled={salvandoLink}
              onClick={salvarLinkKiwify}
            >
              {salvandoLink ? "Salvando..." : "Salvar Link"}
            </button>
          </div>
        </div>
      )}

      {/* Grid de Principais Indicadores */}
      <div className="dashboard-grid">
        <div className="stat-card success" style={{ borderLeft: "4px solid var(--primary)" }}>
          <span className="stat-label" style={{ color: "var(--primary)" }}>Minhas Comissões</span>
          <span className="stat-number" style={{ color: "var(--primary)", fontSize: "2.3rem" }}>
            {stats.comissao_acumulada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Comissão acumulada disponível na Kiwify
          </span>
        </div>

        <div className="stat-card info" style={{ borderLeft: "4px solid var(--info)" }}>
          <span className="stat-label" style={{ color: "var(--info)" }}>Faturamento Gerado</span>
          <span className="stat-number">
            {stats.faturamento_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Total em vendas fechadas por você
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Vendas Fechadas</span>
          <span className="stat-number">{stats.vendas_fechadas}</span>
          <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Pré-vendas aprovadas pelo admin
          </span>
        </div>

        <div className="stat-card warning" style={{ borderLeft: "4px solid var(--warning)" }}>
          <span className="stat-label" style={{ color: "var(--warning)" }}>Leads em Carteira</span>
          <span className="stat-number">{stats.total_leads}</span>
          <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Total de leads vinculados a você
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginTop: "24px" }} className="dashboard-flex-responsive">
        
        {/* Painel de Metas Diárias */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 15px 0" }}>
              🎯 Meta de Prospecção Diária
              <span className="badge" style={{ backgroundColor: pctMeta === 100 ? "var(--success-bg)" : "rgba(251, 191, 36, 0.1)", color: pctMeta === 100 ? "var(--primary)" : "var(--accent-gold)", fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", fontWeight: "700" }}>
                {pctMeta}% Completo
              </span>
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "20px" }}>
              Cada lead coletado ou importado entra na sua cota diária de disparos. Fique atento ao limite estabelecido.
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: "600", marginBottom: "8px" }}>
              <span>Leads Consumidos Hoje: {stats.leads_hoje}</span>
              <span>Limite Diário: {stats.limite_diario}</span>
            </div>

            {/* Barra de Progresso Estilizada */}
            <div style={{ width: "100%", height: "12px", backgroundColor: "var(--bg-tertiary)", borderRadius: "6px", overflow: "hidden", marginBottom: "16px" }}>
              <div style={{ 
                width: `${pctMeta}%`, 
                height: "100%", 
                background: "linear-gradient(90deg, var(--primary) 0%, #34d399 100%)", 
                borderRadius: "6px",
                transition: "width 0.4s ease"
              }}></div>
            </div>

            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
              {stats.capacidade_hoje > 0 ? (
                <>Você ainda pode disparar para mais <strong>{stats.capacidade_hoje} novos leads</strong> hoje antes de atingir o limite.</>
              ) : (
                <strong style={{ color: "var(--primary)" }}>🎉 Excelente trabalho! Você completou sua meta de prospecção diária para hoje.</strong>
              )}
            </p>
          </div>
        </div>

        {/* Funil de Leads */}
        <div className="card">
          <h2>📊 Funil de Leads</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.95rem" }}>🆕 Reservados (Aguardando Disparo)</span>
              <strong style={{ fontSize: "1.1rem" }}>{stats.leads_novos}</strong>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.95rem" }}>💬 Envio Iniciado/Efetuado</span>
              <strong style={{ fontSize: "1.1rem" }}>{stats.leads_contatados}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.95rem" }}>💰 Pré-venda Submetida</span>
              <strong style={{ fontSize: "1.1rem" }}>{stats.leads_pre_venda}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.95rem" }}>📈 Vendas Aprovadas</span>
              <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>{stats.vendas_fechadas}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Modo Gerente - Não Gerente (Qualificação) */}
      {stats.eh_gerente === 0 && (
        <div className="card" style={{ marginTop: "24px", background: "linear-gradient(135deg, rgba(217, 119, 6, 0.03) 0%, rgba(251, 191, 36, 0.03) 100%)", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "15px" }}>
            <div>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                💼 Seja um Gerente
                <span className="badge" style={{ backgroundColor: "rgba(251, 191, 36, 0.15)", color: "var(--accent-gold)", fontSize: "0.8rem", padding: "3px 8px" }}>
                  Comissão Passiva R$ 100,00
                </span>
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "6px", maxWidth: "800px", lineHeight: "1.4" }}>
                Monte sua equipe de vendas e ganhe comissão sem precisar fazer nada! Ao se tornar gerente, você poderá convidar pessoas.
                Todas as vendas aprovadas dos seus indicados renderão <strong>R$ 100,00</strong> para você. (Requisitos: 100 leads enviados E pelo menos 1 venda concluída)
              </p>
            </div>
            <div>
              <button 
                className="btn btn-primary"
                style={{ 
                  margin: 0,
                  background: (stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1) ? "linear-gradient(135deg, var(--primary) 0%, #d97706 100%)" : "var(--bg-tertiary)",
                  color: (stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1) ? "#fff" : "var(--text-tertiary)",
                  cursor: (stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1) ? "pointer" : "not-allowed",
                  border: (stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1) ? "none" : "1px solid var(--border-color)",
                  boxShadow: (stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1) ? "0 4px 15px rgba(217, 119, 6, 0.3)" : "none"
                }}
                disabled={!(stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1)}
                onClick={ativarModoGerente}
              >
                {stats.leads_enviados >= 100 && stats.vendas_fechadas >= 1 ? "🚀 Ativar Modo Gerente" : "🔒 Requisitos Pendentes"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }} className="dashboard-flex-responsive">
            {/* Primeira barra: Leads enviados */}
            <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "8px" }}>
                <span>Leads Enviados (Mensagens WhatsApp)</span>
                <span>{stats.leads_enviados} de 100 leads enviados</span>
              </div>
              <div style={{ width: "100%", height: "10px", backgroundColor: "var(--bg-tertiary)", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ 
                  width: `${Math.min(100, (stats.leads_enviados / 100) * 100)}%`, 
                  height: "100%", 
                  background: stats.leads_enviados >= 100 ? "linear-gradient(90deg, var(--primary) 0%, #34d399 100%)" : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)", 
                  borderRadius: "5px",
                  transition: "width 0.4s ease"
                }}></div>
              </div>
            </div>

            {/* Segunda barra: Vendas realizadas */}
            <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "600", marginBottom: "8px" }}>
                <span>Vendas Aprovadas Realizadas</span>
                <span>{stats.vendas_fechadas} de 1 venda</span>
              </div>
              <div style={{ width: "100%", height: "10px", backgroundColor: "var(--bg-tertiary)", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ 
                  width: `${Math.min(100, (stats.vendas_fechadas / 1) * 100)}%`, 
                  height: "100%", 
                  background: stats.vendas_fechadas >= 1 ? "linear-gradient(90deg, var(--primary) 0%, #34d399 100%)" : "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)", 
                  borderRadius: "5px",
                  transition: "width 0.4s ease"
                }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modo Gerente - Gerente Ativo */}
      {stats.eh_gerente === 1 && (
        <div style={{ marginTop: "24px" }}>
          {/* Link de Convite de Gerente */}
          <div className="card" style={{ background: "linear-gradient(135deg, rgba(217, 119, 6, 0.05) 0%, rgba(251, 191, 36, 0.05) 100%)", border: "1px solid rgba(251, 191, 36, 0.25)" }}>
            <h2 style={{ margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              💼 Meu Link de Indicação (Recrutar Vendedores)
              <span className="badge" style={{ backgroundColor: "rgba(217, 119, 6, 0.15)", color: "var(--primary)", fontSize: "0.8rem", padding: "4px 8px" }}>Modo Gerente Ativo</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "15px" }}>
              Compartilhe o link abaixo para cadastrar vendedores na sua equipe. Toda vez que um indicado fizer uma venda que for aprovada pelo administrador, você ganha <strong>R$ 100,00</strong> na hora.
            </p>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input 
                type="text" 
                readOnly 
                value={`${window.location.origin}?ref=${usuarioLogado.id}`} 
                style={{ 
                  flexGrow: 1, 
                  backgroundColor: "var(--bg-tertiary)", 
                  color: "#fff", 
                  border: "1px solid var(--border-color)", 
                  padding: "12px", 
                  borderRadius: "8px",
                  fontFamily: "monospace",
                  fontSize: "0.95rem"
                }}
              />
              <button 
                className="btn btn-primary" 
                style={{ margin: 0, padding: "12px 24px" }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}?ref=${usuarioLogado.id}`);
                  setLinkCopiado(true);
                  setTimeout(() => setLinkCopiado(false), 2500);
                }}
              >
                {linkCopiado ? "✅ Copiado!" : "📋 Copiar Link"}
              </button>
            </div>
          </div>

          {/* Grid de Estatísticas do Gerente */}
          <div className="dashboard-grid" style={{ marginTop: "24px" }}>
            <div className="stat-card success" style={{ borderLeft: "4px solid var(--primary)", background: "rgba(217, 119, 6, 0.02)" }}>
              <span className="stat-label" style={{ color: "var(--primary)" }}>Comissão de Equipe</span>
              <span className="stat-number" style={{ color: "var(--primary)", fontSize: "2.3rem" }}>
                {stats.comissao_gerente_acumulada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Ganhos de comissão passiva (R$ 100/venda)
              </span>
            </div>

            <div className="stat-card info" style={{ borderLeft: "4px solid var(--info)", background: "rgba(59, 130, 246, 0.02)" }}>
              <span className="stat-label" style={{ color: "var(--info)" }}>Vendas da Minha Equipe</span>
              <span className="stat-number">{stats.indicados_sales_count}</span>
              <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Vendas totais geradas pelos seus indicados
              </span>
            </div>

            <div className="stat-card warning" style={{ borderLeft: "4px solid var(--warning)", background: "rgba(251, 191, 36, 0.02)" }}>
              <span className="stat-label" style={{ color: "var(--warning)" }}>Vendedores Recrutados</span>
              <span className="stat-number">{stats.indicados_count}</span>
              <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Parceiros ativos sob sua gerência
              </span>
            </div>
          </div>

          {/* Lista de Vendedores Indicados */}
          <div className="card" style={{ marginTop: "24px" }}>
            <h2>👥 Minha Equipe de Vendedores</h2>
            {stats.indicados_list.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "30px 0", margin: 0 }}>
                Você ainda não recrutou nenhum vendedor. Envie seu link de indicação para começar a lucrar passivamente!
              </p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>WhatsApp</th>
                      <th>E-mail</th>
                      <th>Data de Cadastro</th>
                      <th style={{ textAlign: "center" }}>Vendas Aprovadas</th>
                      <th style={{ textAlign: "right" }}>Comissão Gerada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.indicados_list.map(ind => (
                      <tr key={ind.id}>
                        <td><strong>{ind.nome}</strong></td>
                        <td>{ind.whatsapp || "Não cadastrado"}</td>
                        <td>{ind.email}</td>
                        <td>{new Date(ind.criado_em).toLocaleDateString("pt-BR")}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{ind.vendas_aprovadas}</td>
                        <td style={{ textAlign: "right", color: "var(--primary)", fontWeight: "bold" }}>
                          {(ind.vendas_aprovadas * 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Histórico de Fechamentos Recentes */}
      <div className="card" style={{ marginTop: "24px" }}>
        <h2>🤝 Últimas Vendas Aprovadas</h2>
        {stats.recent_sales.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "30px 0", margin: 0 }}>Nenhuma venda aprovada recente. Continue prospectando e envie pré-vendas quando fechar negócio!</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Lead / Empresa</th>
                  <th>WhatsApp</th>
                  <th>Nicho</th>
                  <th>Data de Aprovação</th>
                  <th>Comissão Recebida</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_sales.map(sale => (
                  <tr key={sale.id}>
                    <td><strong>{sale.empresa}</strong></td>
                    <td>{sale.telefone}</td>
                    <td>{sale.nicho}</td>
                    <td>{new Date(sale.atualizado_em).toLocaleDateString("pt-BR")}</td>
                    <td style={{ color: "var(--primary)", fontWeight: "bold" }}>
                      {stats.comissao_venda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Informações de Perfil / Link de Afiliado */}
      {usuarioLogado.link_kiwify && (
        <div className="card" style={{ marginTop: "24px" }}>
          <h2>⚙️ Link de Afiliado Cadastrado</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "15px" }}>
            Este é o seu link de afiliado Kiwify configurado. Todas as pré-vendas fechadas por você usarão este link.
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input 
              type="text" 
              value={novoLinkKiwify}
              onChange={(e) => setNovoLinkKiwify(e.target.value)}
              placeholder="Cole seu link de afiliado Kiwify aqui" 
              style={{ 
                flexGrow: 1, 
                padding: "10px 14px", 
                borderRadius: "8px", 
                border: "1px solid var(--border-color)", 
                background: "var(--bg-secondary)", 
                color: "var(--text-primary)",
                fontSize: "0.9rem"
              }}
            />
            <button 
              className="btn btn-primary" 
              style={{ margin: 0, padding: "10px 20px" }}
              disabled={salvandoLink}
              onClick={salvarLinkKiwify}
            >
              {salvandoLink ? "Atualizando..." : "Atualizar Link"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// 7. SELLER PORTAL LOGIN
function Login({ loginSucesso, setPagina }) {
  const [form, setForm] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState("");

  function alterarCampo(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function fazerLogin(e) {
    e.preventDefault();
    setErro("");

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao realizar login.");
        return;
      }

      loginSucesso(data.vendedor);
    } catch (err) {
      setErro("Erro ao comunicar com o servidor.");
    }
  }

  return (
    <div className="login-container">
      <form className="card login-card" onSubmit={fazerLogin}>
        <h2>Login do Vendedor</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>Acesse sua carteira de leads atribuídos.</p>

        {erro && <div className="alert alert-error" style={{ padding: "10px", fontSize: "0.85rem" }}>{erro}</div>}

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Endereço de E-mail</label>
          <input name="email" type="email" value={form.email} onChange={alterarCampo} required placeholder="vendedor@email.com" />
        </div>

        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label>Senha de Acesso</label>
          <input name="senha" type="password" value={form.senha} onChange={alterarCampo} required placeholder="******" />
        </div>

        <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
          Entrar no Portal
        </button>

        <button className="btn btn-secondary" style={{ width: "100%", marginTop: "10px" }} type="button" onClick={() => setPagina("admin-dashboard")}>
          Voltar para Admin
        </button>
      </form>
    </div>
  );
}

// 8. SELLER LEADS LIST & MESSAGING
function VendedorLeads({ usuarioLogado, setUsuarioLogado }) {
  const [leads, setLeads] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [whatsappStatus, setWhatsappStatus] = useState("disconnected");
  
  const [limiteDisparo, setLimiteDisparo] = useState("10");
  
  // Pre-sale Modal State
  const [modalLead, setModalLead] = useState(null);
  const [obsPreVenda, setObsPreVenda] = useState("");

  // Chat Drawer State
  const [chatLead, setChatLead] = useState(null);



  // Dispatch sending state
  const [isSending, setIsSending] = useState(false);
  const [showTestNotice, setShowTestNotice] = useState(false);

  async function carregarLeads() {
    try {
      const res = await fetch(`${API_URL}/leads/vendedor/${usuarioLogado.id}`);
      const data = await res.json();
      if (data.ok) setLeads(data.leads);
    } catch (e) {
      console.error(e);
    }
  }

  const [stats, setStats] = useState({ leads_hoje: 0, limite_diario: 10, capacidade_hoje: 10 });

  async function carregarStats() {
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/dashboard-stats`);
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function checarStatusWhatsapp() {
    try {
      const res = await fetch(`${API_URL}/whatsapp/status/${usuarioLogado.id}`);
      const data = await res.json();
      if (data.ok) {
        setWhatsappStatus(data.status);
        setIsSending(data.isSending || false);
        // If sending is in progress, poll leads list to show real-time updates
        if (data.isSending) {
          carregarLeads();
          carregarStats();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarLeads();
    carregarStats();
    checarStatusWhatsapp();
    
    // Auto-connect WhatsApp session on dashboard mount (restoring saved cookies or preparing QR/Phone pairing)
    fetch(`${API_URL}/whatsapp/conectar/${usuarioLogado.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone: usuarioLogado.whatsapp || "" })
    }).catch(e => console.error("Erro ao auto-conectar whatsapp:", e));
    
    // Poll WhatsApp status and stats regularly
    const interval = setInterval(() => {
      checarStatusWhatsapp();
      carregarStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function dispararMensagensAutomaticas() {
    setErro("");
    setSucesso("");
    
    if (whatsappStatus !== "connected") {
      setErro("Seu WhatsApp não está conectado. Acesse o menu 'Conectar WhatsApp' antes de disparar.");
      return;
    }

    const isTeste = !usuarioLogado.opcoes_chip || usuarioLogado.opcoes_chip === 'pendente';
    const limitVal = isTeste ? 10 : (limiteDisparo ? parseInt(limiteDisparo, 10) : null);

    try {
      // Auto-collect leads if active reserved queue is empty and capacity is available
      const reservadoCount = leads.filter(l => l.status === "reservado").length;
      if (reservadoCount === 0 && stats.capacidade_hoje > 0) {
        console.log("Nenhum lead reservado disponível. Coletando novos leads automaticamente...");
        const resColeta = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/coletar-leads`, {
          method: "POST"
        });
        const dataColeta = await resColeta.json();
        
        if (!resColeta.ok && dataColeta.error && !dataColeta.error.includes("atingiu seu limite")) {
          setErro(dataColeta.error || "Erro ao coletar novos leads.");
          return;
        }

        // Reload leads list and stats after collecting
        const resLeads = await fetch(`${API_URL}/leads/vendedor/${usuarioLogado.id}`);
        const dataLeads = await resLeads.json();
        if (dataLeads.ok) {
          setLeads(dataLeads.leads);
        }
        await carregarStats();
      }

      const res = await fetch(`${API_URL}/whatsapp/disparar/${usuarioLogado.id}`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limite: limitVal > 0 ? limitVal : null })
      });
      const data = await res.json();

      if (res.ok) {
        setSucesso(data.message);
        if (isTeste) {
          setShowTestNotice(true);
        }
        setIsSending(true);
        // Reload leads list after a short delay
        setTimeout(() => {
          carregarLeads();
          carregarStats();
        }, 3000);
      } else {
        setErro(data.error);
      }
    } catch (e) {
      setErro("Falha de conexão com o servidor.");
    }
  }

  async function iniciarVendasTeste() {
    setErro("");
    setSucesso("");
    
    if (whatsappStatus !== "connected") {
      setErro("Seu WhatsApp não está conectado. Acesse o menu 'Conectar WhatsApp' antes de disparar.");
      return;
    }

    try {
      // 1. Coletar leads de teste (limite 10)
      const resColeta = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/coletar-leads`, {
        method: "POST"
      });
      const dataColeta = await resColeta.json();
      
      if (!resColeta.ok && dataColeta.error && !dataColeta.error.includes("atingiu seu limite")) {
        setErro(dataColeta.error || "Erro ao coletar leads de teste.");
        return;
      }

      // 2. Carregar leads
      const resLeads = await fetch(`${API_URL}/leads/vendedor/${usuarioLogado.id}`);
      const dataLeads = await resLeads.json();
      if (dataLeads.ok) {
        setLeads(dataLeads.leads);
      }

      // 3. Disparar para exatamente 10 leads
      const resDisparo = await fetch(`${API_URL}/whatsapp/disparar/${usuarioLogado.id}`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limite: 10 })
      });
      const dataDisparo = await resDisparo.json();

      if (resDisparo.ok) {
        setSucesso(dataDisparo.message || "Disparo de teste iniciado!");
        setShowTestNotice(true);
        setIsSending(true);
        // Recarregar após um curto delay para atualizar a tela
        setTimeout(() => {
          carregarLeads();
          checarStatusWhatsapp();
        }, 3000);
      } else {
        setErro(dataDisparo.error);
      }
    } catch (e) {
      setErro("Erro de comunicação com o servidor ao iniciar vendas de teste.");
    }
  }

  async function coletarLeads() {
    setErro("");
    setSucesso("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/coletar-leads`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSucesso(data.message);
        carregarLeads();
        carregarStats();
      } else {
        setErro(data.error || "Erro ao coletar leads.");
      }
    } catch (e) {
      setErro("Falha de conexão com o servidor ao coletar leads.");
    }
  }

  async function cancelarDisparo() {
    setErro("");
    setSucesso("");
    try {
      const res = await fetch(`${API_URL}/whatsapp/cancelar-disparo/${usuarioLogado.id}`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSucesso("Envio cancelado. O disparador irá parar graciosamente em breve.");
        setIsSending(false);
        carregarLeads();
      } else {
        setErro(data.error || "Erro ao solicitar cancelamento.");
      }
    } catch (e) {
      setErro("Falha de conexão com o servidor ao cancelar disparo.");
    }
  }

  async function atualizarStatusLead(id, status) {
    try {
      const res = await fetch(`${API_URL}/leads/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        carregarLeads();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function submeterPreVenda(e) {
    e.preventDefault();
    if (!modalLead) return;

    try {
      const res = await fetch(`${API_URL}/pre-vendas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: modalLead.id,
          vendedor_id: usuarioLogado.id,
          observacoes: obsPreVenda
        })
      });
      if (res.ok) {
        setModalLead(null);
        setObsPreVenda("");
        setSucesso("Pré-venda registrada com sucesso! Aguarde aprovação do Admin.");
        carregarLeads();
      }
    } catch (e) {
      console.error(e);
    }
  }

  const totalEnviados = leads.filter(l => l.status === "Mensagem enviada" || l.status === "Pré-venda feita" || l.status === "Comprou").length;
  const isTeste = !usuarioLogado.opcoes_chip || usuarioLogado.opcoes_chip === 'pendente';
  const temVendasIniciadas = leads.length > 0;

  // Filter out unmessaged leads from visible list
  const leadsVisiveis = leads.filter(l => l.status !== "reservado");
  const leadsFiltrados = statusFiltro ? leadsVisiveis.filter(l => l.status === statusFiltro) : leadsVisiveis;
  const statusUnicos = [...new Set(leadsVisiveis.map(l => l.status))];
  const leadsEnviados = leadsVisiveis
    .filter(l => l.status === "Mensagem enviada" && l.ultima_mensagem)
    .sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em))
    .slice(0, 5);

  async function selecionarOpcaoChip(opcao) {
    setErro("");
    setSucesso("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/opcao-chip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opcao })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem("usuarioLogado", JSON.stringify(data.vendedor));
        setUsuarioLogado(data.vendedor);
        setSucesso(opcao === "pessoal" ? "Acesso total de 25 leads liberado!" : "Conta suspensa para aquecimento de chip por 14 dias.");
      } else {
        setErro(data.error || "Erro ao selecionar opção.");
      }
    } catch (e) {
      setErro("Falha de conexão com o servidor.");
    }
  }

  if (isTeste && !temVendasIniciadas) {
    return (
      <section>
        <h1>Minha Carteira de Leads</h1>
        <p className="subtitle">Gerencie contatos, dispare mensagens automatizadas via WhatsApp Web e qualifique suas negociações.</p>

        {erro && <div className="alert alert-error">{erro}</div>}
        {sucesso && <div className="alert alert-success">{sucesso}</div>}

        <div className="card" style={{
          background: "linear-gradient(135deg, rgba(217, 119, 6, 0.06) 0%, rgba(251, 191, 36, 0.04) 100%)",
          border: "1px solid rgba(217, 119, 6, 0.2)",
          borderRadius: "16px",
          padding: "40px 24px",
          textAlign: "center",
          maxWidth: "650px",
          margin: "40px auto",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px"
        }}>
          <div style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(217, 119, 6, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
            color: "var(--primary)",
            marginBottom: "8px",
            boxShadow: "0 0 20px rgba(217, 119, 6, 0.2)"
          }}>
            ⚡
          </div>
          
          <div style={{ maxWidth: "500px" }}>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "1.75rem", fontWeight: "800", color: "var(--text-primary)" }}>
              Ative sua Máquina de Vendas
            </h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "1.05rem", lineHeight: "1.6" }}>
              Como novo vendedor, você passará pela <strong>Fase de Teste</strong>. Você receberá <strong>10 leads qualificados</strong> para iniciar os disparos de mensagens automáticas imediatamente.
            </p>
          </div>

          <div style={{
            width: "100%",
            background: "var(--bg-tertiary)",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "left",
            border: "1px solid var(--border-color)"
          }}>
            <h4 style={{ margin: "0 0 15px 0", fontSize: "0.95rem", color: "var(--text-primary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Requisitos para Ativação:
            </h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ 
                  fontSize: "1.1rem", 
                  color: whatsappStatus === "connected" ? "var(--success)" : "var(--danger)" 
                }}>
                  {whatsappStatus === "connected" ? "✓" : "✗"}
                </span>
                <div>
                  <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)" }}>Conectar WhatsApp:</span>{" "}
                  <span style={{ 
                    fontSize: "0.9rem", 
                    fontWeight: "700", 
                    color: whatsappStatus === "connected" ? "var(--success)" : "var(--danger)",
                    background: whatsappStatus === "connected" ? "rgba(217, 119, 6, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    padding: "2px 8px",
                    borderRadius: "4px"
                  }}>
                    {whatsappStatus === "connected" ? "CONECTADO" : "DESCONECTADO"}
                  </span>
                </div>
              </div>
              
              {whatsappStatus !== "connected" && (
                <p style={{ margin: "0 0 0 24px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  ⚠️ Acesse a tela <strong>"Conectar WhatsApp"</strong> no menu lateral para escanear o QR Code antes de continuar.
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.1rem", color: "var(--primary)" }}>✓</span>
                <div>
                  <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)" }}>Envio Automático:</span>{" "}
                  <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    O robô começará a oferecer o produto aos leads assim que você clicar no botão.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ width: "100%" }}>
            <button 
              className="btn btn-primary pulse" 
              onClick={iniciarVendasTeste} 
              disabled={whatsappStatus !== "connected"}
              style={{
                width: "100%",
                padding: "16px 24px",
                fontSize: "1.1rem",
                fontWeight: "700",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxShadow: whatsappStatus === "connected" ? "0 10px 20px rgba(217, 119, 6, 0.25)" : "none"
              }}
            >
              🚀 Iniciar Vendas (Fase de Teste)
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1>Minha Carteira de Leads</h1>
      <p className="subtitle">Gerencie contatos, dispare mensagens automatizadas via WhatsApp Web e qualifique suas negociações.</p>

      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success">{sucesso}</div>}

      {/* Aviso de Fase de Teste e Esteira de Chips */}
      {(!usuarioLogado.opcoes_chip || usuarioLogado.opcoes_chip === 'pendente') && totalEnviados >= 10 && (
        <div className="card" style={{ 
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)", 
          border: "1px solid rgba(251, 191, 36, 0.3)", 
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 8px 32px rgba(251, 191, 36, 0.05)",
          textAlign: "left"
        }}>
          <h3 style={{ color: "var(--accent-gold)", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px 0", fontSize: "1.15rem", fontWeight: "700" }}>
            ⚡ Fase de Teste e Esteira de Chips
          </h3>
          <p style={{ fontSize: "0.95rem", color: "var(--text-primary)", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            Como novo vendedor, <strong>você está em fase de teste com limite de 10 leads por dia</strong>. Para continuar e liberar o acesso total de 25 leads diários, escolha uma das opções abaixo:
          </p>
          <ol style={{ paddingLeft: "20px", fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: "0 0 20px 0" }}>
            <li style={{ marginBottom: "8px" }}>
              <strong>Comprar um chip novo de R$ 15,00:</strong> Aquecer o chip por 14 dias para evitar bloqueios. Sua conta entrará em suspensão durante esse período.
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Usar o seu chip pessoal:</strong> Como ele já está aquecido, você pode continuar vendendo com limite total de 25 leads diários.
            </li>
          </ol>
          <div style={{ background: "rgba(251, 191, 36, 0.04)", borderLeft: "3px solid var(--accent-gold)", padding: "12px 16px", borderRadius: "0 8px 8px 0", marginBottom: "20px" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: "1.5", margin: 0 }}>
              <strong>Sugestão:</strong> Compre um chip novo e use como pessoal, e esse atual vira sua máquina de vendas. Se ele bloquear daqui a um mês, repita o processo da esteira de chips!
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "15px" }}>
            <button 
              className="btn btn-success" 
              onClick={() => selecionarOpcaoChip("pessoal")}
              style={{ margin: 0, padding: "10px 20px", fontSize: "0.9rem", fontWeight: "600" }}
            >
              🚀 Usarei meu chip pessoal como máquina de vendas
            </button>
            <button 
              className="btn btn-warning" 
              onClick={() => selecionarOpcaoChip("novo")}
              style={{ margin: 0, padding: "10px 20px", fontSize: "0.9rem", fontWeight: "600", background: "#d97706", borderColor: "#d97706", color: "white" }}
            >
              🛒 Comprar chip novo e aquecer (Suspender por 14 dias)
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
        {!isTeste ? (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="form-group" style={{ minWidth: "220px", margin: 0 }}>
              <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                <option value="">Todos os status</option>
                {statusUnicos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={coletarLeads}
              style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              📥 Coletar Novos Leads
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge badge-success pulse" style={{ padding: "6px 12px", fontSize: "0.85rem", borderRadius: "6px", textTransform: "none", background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--primary)", margin: 0 }}>
              🎯 Modo de Teste: Envio de 10 Leads
            </span>
            {stats.capacidade_hoje > 0 && (
              <button 
                className="btn btn-secondary" 
                onClick={coletarLeads}
                style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}
              >
                📥 Coletar Reposição ({stats.capacidade_hoje})
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
          {!isTeste && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                Quantidade a disparar:
              </label>
              <input 
                type="number" 
                min="1" 
                max="100" 
                value={limiteDisparo} 
                onChange={e => setLimiteDisparo(e.target.value)} 
                placeholder="Tudo" 
                style={{ 
                  width: "80px", 
                  padding: "8px 12px", 
                  border: "1px solid var(--border-color)", 
                  borderRadius: "8px", 
                  background: "var(--bg-secondary)", 
                  color: "var(--text-primary)",
                  margin: 0
                }}
              />
            </div>
          )}
          {isSending ? (
            <button 
              className="btn btn-danger pulse" 
              onClick={cancelarDisparo}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f44336", borderColor: "#f44336", height: "42px" }}
            >
              ⏹️ Parar Envio
            </button>
          ) : (
            <button className="btn btn-primary" onClick={dispararMensagensAutomaticas} disabled={whatsappStatus !== "connected"}>
              {isTeste ? "🚀 Iniciar Vendas (Fase de Teste)" : "🚀 Iniciar Vendas"}
            </button>
          )}
        </div>
      </div>

      {/* Registro de Envios Recentes */}
      <div className="card" style={{ marginBottom: "20px", borderLeft: isSending ? "4px solid var(--success)" : "4px solid var(--border-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            📤 Registro de Envios Recentes
            {isSending && <span className="badge badge-success pulse" style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px" }}>🟢 Envio em Progresso</span>}
          </h3>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {isSending ? "Atualizando automaticamente..." : "Aguardando novos disparos"}
          </span>
        </div>
        
        {leadsEnviados.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "10px 0 0 0" }}>
            Nenhuma mensagem enviada nesta sessão ainda.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
            {leadsEnviados.map(l => (
              <div 
                key={l.id} 
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "10px 14px", 
                  background: "var(--bg-secondary)", 
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  fontSize: "0.9rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  <strong style={{ whiteSpace: "nowrap" }}>{l.empresa}</strong>
                  <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>({l.telefone})</span>
                  <span 
                    style={{ 
                      color: "var(--text-secondary)", 
                      fontSize: "0.85rem", 
                      marginLeft: "10px",
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}
                    title={l.ultima_mensagem}
                  >
                    "{l.ultima_mensagem}"
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginLeft: "12px" }}>
                  {l.atualizado_em ? new Date(l.atualizado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Leads Atribuídos ({leadsFiltrados.length})</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Nicho</th>
                <th>Cidade</th>
                <th>Status</th>
                <th>Última Mensagem</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)" }}>
                    {isSending ? "Disparando mensagens automáticas... os leads aparecerão nesta lista conforme forem prospectados." : "Nenhum lead nesta lista."}
                  </td>
                </tr>
              ) : (
                leadsFiltrados.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.empresa}</strong>
                      <br /><small>{l.endereco}</small>
                      {l.site && (
                        <><br /><a href={l.site} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "var(--primary)" }}>🌐 Website</a></>
                      )}

                    </td>
                    <td>{l.telefone}</td>
                    <td><span className="badge badge-distribuido" style={{ textTransform: "none" }}>{l.nicho}</span></td>
                    <td>{l.cidade} - {l.estado}</td>
                    <td>
                      <span className={`badge badge-${l.status.toLowerCase().replace(/[^a-z]/g, "")}`}>
                        {l.status}
                      </span>
                    </td>
                    <td>
                      {l.ultima_mensagem ? (
                        <div style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.ultima_mensagem}>
                          {l.ultima_mensagem}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>Nenhuma enviada</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <select 
                          value={l.status} 
                          onChange={(e) => atualizarStatusLead(l.id, e.target.value)}
                          style={{ padding: "6px", fontSize: "0.85rem", width: "auto" }}
                        >
                          <option value="reservado">Reservado</option>
                          <option value="Mensagem enviada">Mensagem enviada</option>
                          <option value="Vácuo">Vácuo</option>
                          <option value="Respondeu mas não quer">Não quer</option>
                          <option value="Respondeu mas vai comprar depois">Comprar depois</option>
                        </select>
                        
                        {l.status !== "Pré-venda feita" && l.status !== "Comprou" && (
                          <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => setModalLead(l)}>
                            💰 Pré-Venda
                          </button>
                        )}

                        <button 
                          className="btn btn-primary" 
                          style={{ 
                            padding: "6px 12px", 
                            fontSize: "0.85rem",
                            background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
                            border: "none",
                            color: "white"
                          }} 
                          onClick={() => setChatLead(l)}
                        >
                          💬 Conversar
                        </button>


                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-sale qualified modal */}
      {modalLead && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Marcar Pré-Venda Concluída</h3>
              <button className="close-btn" onClick={() => setModalLead(null)}>&times;</button>
            </div>
            <form onSubmit={submeterPreVenda}>
              <p style={{ marginBottom: "15px", color: "var(--text-secondary)" }}>
                Preencha as observações do fechamento de interesse para a empresa <strong>{modalLead.empresa}</strong>.
              </p>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label>Observações / Resumo da Conversa</label>
                <textarea 
                  value={obsPreVenda} 
                  onChange={e => setObsPreVenda(e.target.value)} 
                  rows="4" 
                  placeholder="Ex: Demonstrou interesse no plano trimestral, quer que ligue para fechar contrato..."
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalLead(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success">Confirmar Pré-Venda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Drawer */}
      <ChatDrawer 
        lead={chatLead} 
        vendedorId={usuarioLogado.id} 
        onClose={() => setChatLead(null)} 
        onMessageSent={carregarLeads}
      />



    </section>
  );
}





// 9. SELLER WHATSAPP CONNECTION
function VendedorWhatsapp({ usuarioLogado }) {
  const [status, setStatus] = useState("disconnected");
  const [qrCode, setQrCode] = useState(null);
  const [phoneCode, setPhoneCode] = useState(null);
  const [modoConexao, setModoConexao] = useState("qr"); // 'qr' ou 'telefone'
  const [telefoneInput, setTelefoneInput] = useState(usuarioLogado.whatsapp || "");
  const [loading, setLoading] = useState(false);
  const [screenshotTimestamp, setScreenshotTimestamp] = useState(null);

  async function carregarStatus() {
    try {
      const res = await fetch(`${API_URL}/whatsapp/status/${usuarioLogado.id}`);
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status);
        setQrCode(data.qrCode);
        setPhoneCode(data.phoneCode || null);
        if (data.status !== "disconnected") {
          setScreenshotTimestamp(Date.now());
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarStatus();
    // Poll every 3 seconds
    const interval = setInterval(carregarStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  async function conectar(e) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const body = modoConexao === "telefone" ? { telefone: telefoneInput } : {};
      await fetch(`${API_URL}/whatsapp/conectar/${usuarioLogado.id}`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      carregarStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function desconectar() {
    setLoading(true);
    try {
      await fetch(`${API_URL}/whatsapp/desconectar/${usuarioLogado.id}`, { method: "POST" });
      setStatus("disconnected");
      setQrCode(null);
      setPhoneCode(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h1>Conectar seu WhatsApp</h1>
      <p className="subtitle">Estabeleça uma sessão exclusiva do WhatsApp Web para disparar mensagens automatizadas direto do seu número.</p>

      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px" }}>
        
        {status === "disconnected" && !loading && (
          <>
            <div style={{ fontSize: "5rem", marginBottom: "10px" }}>🔌</div>
            <h2>WhatsApp Desconectado</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px", textAlign: "center", maxWidth: "450px" }}>
              Selecione o método de pareamento ideal para você. Se estiver no celular, recomendamos usar a conexão por número de telefone.
            </p>

            <div style={{ display: "flex", gap: "10px", marginBottom: "25px", background: "var(--bg-tertiary)", padding: "4px", borderRadius: "8px" }}>
              <button 
                type="button"
                className={`btn ${modoConexao === "qr" ? "btn-primary" : "btn-secondary"}`} 
                style={{ margin: 0, padding: "8px 16px", fontSize: "0.9rem" }}
                onClick={() => setModoConexao("qr")}
              >
                🖥️ QR Code (Computador)
              </button>
              <button 
                type="button"
                className={`btn ${modoConexao === "telefone" ? "btn-primary" : "btn-secondary"}`} 
                style={{ margin: 0, padding: "8px 16px", fontSize: "0.9rem" }}
                onClick={() => setModoConexao("telefone")}
              >
                📱 Número (Celular)
              </button>
            </div>

            {modoConexao === "qr" ? (
              <button className="btn btn-primary" onClick={conectar}>
                Gerar QR Code de Conexão
              </button>
            ) : (
              <form onSubmit={conectar} style={{ width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", gap: "15px" }}>
                <div className="form-group">
                  <label>Confirme seu número com DDI e DDD (Apenas números)</label>
                  <input 
                    type="text" 
                    value={telefoneInput} 
                    onChange={e => setTelefoneInput(e.target.value)} 
                    placeholder="Ex: 5511999999999" 
                    required 
                  />
                </div>
                <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>
                  Obter Código de Pareamento
                </button>
              </form>
            )}
          </>
        )}

        {(status === "connecting" || status === "syncing") && (
          <>
            <h2>{status === "syncing" ? "Sincronizando Conversas..." : "Conectando ao WhatsApp Web..."}</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "15px", textAlign: "center", maxWidth: "450px" }}>
              {status === "syncing"
                ? "Seu QR Code/Código foi lido com sucesso! O WhatsApp está sincronizando suas mensagens em segundo plano. Por favor, aguarde alguns segundos..."
                : phoneCode
                  ? "Siga os passos abaixo no seu celular para parear a conta:"
                  : "O sistema está carregando a interface em background. Por favor, aguarde o carregamento ou faça a leitura do QR Code abaixo:"}
            </p>
            
            {loading && <div className="loading-spinner"></div>}
            
            {phoneCode ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                {/* Visual Alert Box */}
                <div style={{ 
                  background: "rgba(212, 175, 55, 0.1)", 
                  border: "1px solid var(--primary)", 
                  padding: "15px 20px", 
                  borderRadius: "8px", 
                  marginBottom: "20px",
                  textAlign: "center",
                  maxWidth: "450px",
                  width: "100%"
                }}>
                  <strong style={{ color: "var(--primary)", display: "block", fontSize: "1.1rem", marginBottom: "5px" }}>
                    🔑 Código de Pareamento Disponível!
                  </strong>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Passe este código de 8 dígitos para o funcionário digitar no celular dele para concluir o cadastro do vendedor.
                  </span>
                </div>

                {/* Big Explicit Code Display */}
                <div style={{ textAlign: "center", marginBottom: "25px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                    Código a ser digitado no Celular:
                  </span>
                  <div 
                    style={{ 
                      background: "var(--bg-tertiary)", 
                      padding: "20px 40px", 
                      borderRadius: "12px", 
                      border: "2px dashed var(--primary)", 
                      fontSize: "3rem", 
                      fontWeight: "900", 
                      letterSpacing: "0.15em", 
                      color: "var(--primary)",
                      margin: "10px 0",
                      cursor: "pointer",
                      boxShadow: "0 0 15px rgba(212, 175, 55, 0.2)",
                      maxWidth: "380px",
                      width: "100%",
                      textAlign: "center"
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(phoneCode);
                      alert(`Código copiado: ${phoneCode}`);
                    }}
                    title="Clique para copiar o código"
                  >
                    {phoneCode}
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                    💡 Clique no código acima para copiá-lo.
                  </span>
                </div>
                
                {/* Step-by-Step Instructions */}
                <div className="card" style={{ maxWidth: "450px", textAlign: "left", width: "100%", background: "var(--bg-tertiary)" }}>
                  <h4 style={{ margin: "0 0 15px 0", color: "var(--text-primary)", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                    📱 Como o funcionário deve cadastrar no celular:
                  </h4>
                  <ol style={{ paddingLeft: "20px", margin: 0, color: "var(--text-secondary)", lineHeight: "1.8", fontSize: "0.95rem" }}>
                    <li style={{ marginBottom: "8px" }}>
                      Abra o aplicativo do <strong>WhatsApp</strong> no celular que será usado para vender.
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      Acesse as <strong>Configurações</strong> (ou toque nos <strong>3 pontinhos</strong> no canto superior direito no Android) e selecione <strong>Aparelhos Conectados</strong>.
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      Toque no botão <strong>Conectar um Aparelho</strong>.
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      Na tela da câmera que se abre, toque em <strong>Conectar com número de telefone</strong> (ou <i>Link with phone number instead</i>) na parte inferior da tela.
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      Digite o código de 8 dígitos acima (<strong>{phoneCode}</strong>) na tela do celular.
                    </li>
                  </ol>
                </div>
                
                {qrCode && (
                  <div style={{ marginTop: "20px", textAlign: "center", width: "100%" }}>
                    <details>
                      <summary style={{ color: "var(--text-secondary)", cursor: "pointer" }}>Ver Captura de Tela do Pareamento</summary>
                      <div className="qr-container" style={{ marginTop: "10px" }}>
                        <img className="qr-image" style={{ maxWidth: "100%", height: "auto" }} src={`data:image/png;base64,${qrCode}`} alt="WhatsApp Web Screenshot" />
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ) : (qrCode && status !== "syncing") ? (
              <div className="qr-container">
                <img className="qr-image" src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" />
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "12px", fontWeight: "600" }}>
                  Aponte a câmera do seu WhatsApp para este QR Code.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "20px 0", maxWidth: "450px", width: "100%" }}>
                <div className="loading-spinner" style={{ marginBottom: "20px" }}></div>
                
                <h4 style={{ color: "var(--text-primary)", marginBottom: "15px" }}>
                  {status === "syncing" ? "Sincronizando conversas..." : "Solicitando código de pareamento..."}
                </h4>
                
                <div style={{ width: "100%", textAlign: "left", background: "var(--bg-tertiary)", padding: "15px", borderRadius: "8px", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", color: "var(--success)" }}>
                    <span>✓</span> <span>Navegador virtual iniciado no servidor</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", color: "var(--success)" }}>
                    <span>✓</span> <span>Conectado à página do WhatsApp Web</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", color: status === "syncing" ? "var(--success)" : "var(--primary)" }}>
                    <span>{status === "syncing" ? "✓" : "⚡"}</span> 
                    <span>{status === "syncing" ? "Número de telefone enviado" : "Enviando número e aguardando o código..."}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: status === "syncing" ? "var(--primary)" : "var(--text-tertiary)" }}>
                    <span>{status === "syncing" ? "⚡" : "○"}</span> 
                    <span>{status === "syncing" ? "Sincronizando dados com o aparelho..." : "Geração do código de 8 dígitos no painel (pode levar 10-15s)"}</span>
                  </div>
                </div>
              </div>
            )}
            
            <button className="btn btn-secondary" style={{ marginTop: "20px" }} onClick={desconectar}>
              Cancelar Conexão
            </button>
          </>
        )}

        {status === "connected" && (
          <>
            <div style={{ fontSize: "5rem", color: "var(--success)", marginBottom: "10px" }}>✅</div>
            <h2>WhatsApp Conectado!</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px", textAlign: "center", maxWidth: "450px" }}>
              Seu dispositivo está emparelhado e ativo no servidor. O disparo automático de mensagens já está disponível para uso na sua lista de leads.
            </p>
            <button className="btn btn-danger" onClick={desconectar}>
              Desconectar WhatsApp
            </button>
          </>
        )}

        {(status === "starting" || (loading && status === "disconnected")) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="loading-spinner"></div>
            <p>Iniciando o navegador virtual no servidor...</p>
            <small style={{ color: "var(--text-tertiary)", marginTop: "4px" }}>Isso pode levar de 3 a 5 segundos.</small>
          </div>
        )}

        {status === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="loading-spinner"></div>
            <p>Carregando a página do WhatsApp Web...</p>
            <small style={{ color: "var(--text-tertiary)", marginTop: "4px" }}>Geralmente leva de 5 a 15 segundos para carregar o sistema.</small>
          </div>
        )}

        {/* Diagnostic console */}
        <div style={{ marginTop: "30px", width: "100%", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
          <details>
            <summary style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.9rem", fontWeight: "600" }} onClick={() => setScreenshotTimestamp(Date.now())}>
              🛠️ Ver Logs de Depuração do Servidor
            </summary>
            <div style={{ marginTop: "15px", background: "#111", padding: "15px", borderRadius: "8px", border: "1px solid #333", maxHeight: "450px", overflowY: "auto", textAlign: "left" }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ padding: "4px 8px", fontSize: "0.8rem", margin: "0 0 10px 0", float: "right" }}
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_URL}/whatsapp/debug-logs`);
                    const txt = await res.text();
                    document.getElementById("debug-log-box").innerText = txt;
                  } catch (e) {
                    document.getElementById("debug-log-box").innerText = "Erro ao carregar logs: " + e.message;
                  }
                  setScreenshotTimestamp(Date.now());
                }}
              >
                🔄 Atualizar Logs
              </button>
              
              {screenshotTimestamp && (
                <div style={{ marginBottom: "15px", borderBottom: "1px solid #333", paddingBottom: "15px", width: "100%" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                    📷 Captura da Tela do Servidor (Chromium) - Atualiza automaticamente:
                  </span>
                  <img 
                    src={`${API_URL}/whatsapp/debug-screenshot/${usuarioLogado.id}?t=${screenshotTimestamp}`} 
                    alt="Sem captura de tela disponível no momento" 
                    style={{ width: "100%", maxHeight: "300px", objectFit: "contain", borderRadius: "6px", border: "1px solid #444", background: "#000", display: "block" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                    onLoad={(e) => {
                      e.target.style.display = "block";
                    }}
                  />
                </div>
              )}

              <pre id="debug-log-box" style={{ margin: 0, fontSize: "0.8rem", color: "#0f0", fontFamily: "Courier New, monospace", whiteSpace: "pre-wrap" }}>
                Clique em 'Atualizar Logs' para ver as mensagens do servidor.
              </pre>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

// 10. SELLER SELF-REGISTRATION
function CadastroVendedor({ setPagina, loginSucesso }) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    whatsapp: "",
    cpf: "",
    link_kiwify: "",
  });
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [indicadoPorId, setIndicadoPorId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setIndicadoPorId(ref);
    }
  }, []);

  async function gerarLinkAfiliacao() {
    try {
      const res = await fetch(`${API_URL}/configuracoes`);
      const data = await res.json();
      if (data.ok && data.link_afiliacao_kiwify) {
        window.open(data.link_afiliacao_kiwify, "_blank");
      } else {
        window.open("https://dashboard.kiwify.com.br/affiliate/join/exemplo", "_blank");
      }
    } catch (e) {
      window.open("https://dashboard.kiwify.com.br/affiliate/join/exemplo", "_blank");
    }
  }

  function formatarCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  }

  function alterarCampo(e) {
    const { name, value } = e.target;
    if (name === "cpf") {
      setForm(f => ({ ...f, [name]: formatarCPF(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  }

  async function fazerCadastro(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (form.senha.length < 6) {
      setErro("A senha de acesso deve ter no mínimo 6 caracteres.");
      return;
    }

    if (form.senha !== confirmarSenha) {
      setErro("As senhas não coincidem. Verifique a confirmação.");
      return;
    }

    if (!validarCPF(form.cpf)) {
      setErro("O CPF informado é inválido.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/vendedores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          limite_diario: 25,
          indicado_por_id: indicadoPorId
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao realizar cadastro.");
        return;
      }

      setSucesso("Cadastro realizado com sucesso! Acessando sua conta...");
      setForm({ nome: "", email: "", senha: "", whatsapp: "", cpf: "", link_kiwify: "" });
      setConfirmarSenha("");
      setTimeout(() => {
        loginSucesso(data.vendedor);
      }, 1500);
    } catch (err) {
      setErro("Erro de comunicação com o servidor.");
    }
  }

  return (
    <div className="login-container">
      <form className="card login-card" onSubmit={fazerCadastro}>
        <h2>Criar Conta de Vendedor</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>Crie sua conta para começar a prospectar.</p>

        {erro && <div className="alert alert-error" style={{ padding: "10px", fontSize: "0.85rem" }}>{erro}</div>}
        {sucesso && <div className="alert alert-success" style={{ padding: "10px", fontSize: "0.85rem" }}>{sucesso}</div>}

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Seu Nome</label>
          <input name="nome" type="text" value={form.nome} onChange={alterarCampo} required placeholder="Ex: Marc Thay" />
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>CPF</label>
          <input name="cpf" type="text" value={form.cpf} onChange={alterarCampo} required placeholder="000.000.000-00" />
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Número do WhatsApp</label>
          <input name="whatsapp" type="text" value={form.whatsapp} onChange={alterarCampo} required placeholder="Ex: 5511999999999" />
        </div>



        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Endereço de E-mail</label>
          <input name="email" type="email" value={form.email} onChange={alterarCampo} required placeholder="vendedor@email.com" />
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label>Senha de Acesso</label>
          <input name="senha" type="password" value={form.senha} onChange={alterarCampo} required placeholder="Mínimo 6 caracteres" />
        </div>

        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label>Confirmar Senha de Acesso</label>
          <input name="confirmarSenha" type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} required placeholder="Repita a senha de acesso" />
        </div>

        <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
          Cadastrar Conta
        </button>

        <button className="btn btn-secondary" style={{ width: "100%", marginTop: "10px" }} type="button" onClick={() => setPagina("login")}>
          Já tenho conta (Entrar)
        </button>
      </form>
    </div>
  );
}

// 11. SELLER QUEUE SCREEN
function TelaFilaEspera({ usuarioLogado, sair }) {
  const [statusFila, setStatusFila] = useState({
    ativo: 0,
    posicao_fila: usuarioLogado.posicao_fila || 1,
  });
  const [limiteAtivos, setLimiteAtivos] = useState(100);
  
  async function checarStatusFila() {
    try {
      const res = await fetch(`${API_URL}/vendedores/fila/${usuarioLogado.id}`);
      const data = await res.json();
      if (data.ok) {
        setStatusFila({
          ativo: data.ativo,
          posicao_fila: data.posicao_fila,
        });
        
        if (data.ativo === 1) {
          window.location.reload();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function carregarLimite() {
    try {
      const res = await fetch(`${API_URL}/configuracoes`);
      const data = await res.json();
      if (data.ok) {
        setLimiteAtivos(data.limite_vendedores_ativos);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    checarStatusFila();
    carregarLimite();
    const interval = setInterval(checarStatusFila, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 80px)" }}>
      <div className="card" style={{ maxWidth: "500px", textAlign: "center", padding: "40px" }}>
        <div style={{ fontSize: "5rem", marginBottom: "20px" }}>⏳</div>
        <h2>Você está na Fila de Espera!</h2>
        <p style={{ color: "var(--text-secondary)", margin: "15px 0 25px 0", lineHeight: "1.6" }}>
          A plataforma limita o acesso simultâneo a um máximo de <strong>{limiteAtivos} vendedores ativos</strong> para garantir que haja leads suficientes e velocidade máxima para todos.
        </p>
        
        <div style={{ background: "var(--bg-tertiary)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)", marginBottom: "30px" }}>
          <span style={{ display: "block", fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.05em" }}>
            Sua Posição Atual
          </span>
          <span style={{ fontSize: "3rem", fontWeight: "800", color: "var(--primary)" }}>
            {statusFila.posicao_fila}º
          </span>
          <span style={{ display: "block", fontSize: "0.8rem", color: "var(--text-tertiary)", marginTop: "8px" }}>
            Atualizando em tempo real. Assim que um vendedor ativo sair, desconectar ou ficar inativo por 48h, você assumirá a vaga!
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={checarStatusFila}>
            🔄 Atualizar Status
          </button>
          <button className="btn btn-danger" onClick={sair}>
            🚪 Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}

// 12. SELLER SUSPENSION SCREEN
function TelaSuspensao({ usuarioLogado, setUsuarioLogado, sair }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const diasRestantes = Math.max(1, Math.ceil((new Date(usuarioLogado.suspensao_ate) - new Date()) / (1000 * 60 * 60 * 24)));

  async function usarChipPessoal() {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/opcao-chip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opcao: "pessoal" })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem("usuarioLogado", JSON.stringify(data.vendedor));
        setUsuarioLogado(data.vendedor);
      } else {
        setErro(data.error || "Ocorreu um erro ao atualizar opção.");
      }
    } catch (e) {
      setErro("Falha de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 80px)" }}>
      <div className="card" style={{ 
        maxWidth: "550px", 
        textAlign: "center", 
        padding: "40px", 
        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(31, 41, 55, 0.1) 100%)",
        border: "1px solid rgba(239, 68, 68, 0.25)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        borderRadius: "20px"
      }}>
        <div style={{ fontSize: "5rem", marginBottom: "20px" }}>❄️</div>
        <h2 style={{ color: "#ef4444", fontSize: "1.75rem", fontWeight: "800", marginBottom: "15px" }}>Aqueça seu chip novo por 14 dias!</h2>
        
        <p style={{ color: "var(--text-primary)", margin: "15px 0 25px 0", lineHeight: "1.6", fontSize: "1.05rem" }}>
          Sua conta está suspensa temporariamente enquanto você realiza o aquecimento do chip novo para evitar bloqueios. 
          Faltam aproximadamente <strong style={{ color: "#ef4444", fontSize: "1.2rem" }}>{diasRestantes} dias</strong> para liberar sua conta para prospecção premium (25 leads por dia).
        </p>

        {erro && <div className="alert alert-error" style={{ marginBottom: "20px" }}>{erro}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center", alignItems: "center", width: "100%" }}>
          <button 
            className="btn btn-success" 
            onClick={usarChipPessoal}
            disabled={loading}
            style={{ width: "100%", padding: "14px 20px", fontSize: "1rem", fontWeight: "600", borderRadius: "10px" }}
          >
            {loading ? "Processando..." : "🔄 Mudei de ideia, usarei o chip pessoal"}
          </button>
          
          <button 
            className="btn btn-danger" 
            onClick={sair}
            style={{ width: "100%", padding: "12px 20px", fontSize: "0.95rem", borderRadius: "10px", background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
          >
            🚪 Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}


// ADMIN LOGIN SCREEN
function LoginAdmin({ loginAdminSucesso, setPagina }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  async function fazerLoginAdmin(e) {
    e.preventDefault();
    setErro("");

    try {
      console.log("Requisitando login do admin para:", `${API_URL}/admin/login`);
      const res = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha })
      });
      console.log("Status da resposta:", res.status);
      const data = await res.json();
      console.log("Dados recebidos:", data);

      if (!res.ok) {
        setErro(data.error || "Senha incorreta.");
        return;
      }

      loginAdminSucesso(data.token);
    } catch (err) {
      console.error("Erro no login administrativo:", err);
      setErro(`Erro ao comunicar com o servidor: ${err.message}`);
    }
  }

  return (
    <div className="login-container">
      <form className="card login-card" onSubmit={fazerLoginAdmin}>
        <h2>Acesso Administrativo</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>Digite a senha do administrador para acessar o painel.</p>

        {erro && <div className="alert alert-error" style={{ padding: "10px", fontSize: "0.85rem" }}>{erro}</div>}

        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label>Senha do Admin</label>
          <input 
            type="password" 
            value={senha} 
            onChange={e => setSenha(e.target.value)} 
            required 
            placeholder="Digite a senha do administrador" 
          />
        </div>

        <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
          Acessar Painel
        </button>

        <button className="btn btn-secondary" style={{ width: "100%", marginTop: "10px" }} type="button" onClick={() => setPagina("login")}>
          Voltar para Portal Vendedor
        </button>
      </form>
    </div>
  );
}

function ChatDrawer({ lead, vendedorId, onClose, onMessageSent }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [templates, setTemplates] = useState([]);
  const messagesContainerRef = useRef(null);

  const isOpen = !!lead;

  useEffect(() => {
    if (!lead) {
      setTemplates([]);
      return;
    }
    
    async function carregarTemplates() {
      try {
        const res = await fetch(`${API_URL}/respostas-rapidas?vendedorId=${vendedorId}&leadId=${lead.id}`);
        const data = await res.json();
        if (data.ok) {
          setTemplates(data.templates || []);
        }
      } catch (err) {
        console.error("Erro ao carregar templates rápidos:", err);
      }
    }
    
    carregarTemplates();
  }, [lead, vendedorId]);

  async function carregarMensagens(showSilent = true, triggerSync = false) {
    if (!lead) return;
    try {
      const url = triggerSync 
        ? `${API_URL}/leads/${lead.id}/mensagens?sync=true`
        : `${API_URL}/leads/${lead.id}/mensagens`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setMensagens(data.mensagens || []);
      }
    } catch (e) {
      console.error("Erro ao carregar mensagens:", e);
      if (!showSilent) {
        setErro("Não foi possível carregar as mensagens.");
      }
    }
  }

  useEffect(() => {
    if (!lead) {
      setMensagens([]);
      return;
    }

    carregarMensagens(false, true);

    const interval = setInterval(() => {
      carregarMensagens(true, false);
    }, 3000);

    return () => clearInterval(interval);
  }, [lead]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [mensagens, isOpen]);

  if (!isOpen) return null;

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;

    const textoMsg = texto.trim();
    setTexto("");
    setErro("");
    setEnviando(true);

    const tempId = "temp_" + Date.now();
    const tempMsg = {
      id: tempId,
      lead_id: lead.id,
      vendedor_id: vendedorId,
      direcao: "out",
      texto: textoMsg,
      timestamp: new Date().toISOString()
    };
    setMensagens(prev => [...prev, tempMsg]);

    try {
      const res = await fetch(`${API_URL}/leads/${lead.id}/mensagens/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoMsg, vendedorId })
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao enviar mensagem.");
        setMensagens(prev => prev.filter(m => m.id !== tempId));
      } else {
        carregarMensagens(true);
        if (onMessageSent) onMessageSent();
      }
    } catch (err) {
      setErro("Falha na conexão com o servidor.");
      setMensagens(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setEnviando(false);
    }
  }

  function formatarHora(isoString) {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  return (
    <>
      <div className="chat-drawer-backdrop" onClick={onClose} />
      <div className={`chat-drawer ${isOpen ? "open" : ""}`}>
        <div className="chat-drawer-header">
          <div>
            <h3>{lead.empresa}</h3>
            <div className="chat-drawer-header-subtitle">
              <span>{lead.telefone}</span>
              <span style={{ margin: "0 6px" }}>•</span>
              <span className={`badge badge-${lead.status.toLowerCase().replace(/[^a-z]/g, "")}`} style={{ padding: "2px 6px", fontSize: "0.7rem" }}>
                {lead.status}
              </span>
            </div>
          </div>
          <button className="chat-drawer-close" onClick={onClose} title="Fechar Chat">
            &times;
          </button>
        </div>

        {erro && (
          <div className="alert alert-error" style={{ margin: "10px 16px", padding: "8px 12px", fontSize: "0.8rem" }}>
            {erro}
          </div>
        )}

        <div className="chat-drawer-messages" ref={messagesContainerRef}>
          {mensagens.length === 0 ? (
            <div className="chat-no-messages">
              <div className="chat-no-messages-icon">💬</div>
              <p>Nenhuma mensagem trocada ainda.</p>
              <small style={{ color: "var(--text-tertiary)" }}>
                Envie uma mensagem abaixo para iniciar a conversa!
              </small>
            </div>
          ) : (
            mensagens.map((msg) => (
              <div key={msg.id} className={`chat-bubble-container ${msg.direcao}`}>
                <div className={`chat-bubble ${msg.direcao}`}>
                  {msg.texto}
                </div>
                <div className="chat-bubble-meta">
                  {formatarHora(msg.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>

        {templates.length > 0 && (
          <div className="chat-drawer-templates-container">
            <div className="chat-drawer-templates-label">Respostas Rápidas</div>
            <div className="chat-drawer-templates">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chat-template-btn"
                  onClick={() => setTexto(t.texto)}
                  title={t.texto}
                >
                  {t.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="chat-drawer-footer" onSubmit={enviar}>
          <input
            type="text"
            className="chat-drawer-input"
            placeholder="Digite uma mensagem..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={enviando}
            autoFocus
          />
          <button type="submit" className="chat-drawer-send-btn" disabled={!texto.trim() || enviando}>
            {enviando ? "..." : "Enviar"}
          </button>
        </form>
      </div>
    </>
  );
}
