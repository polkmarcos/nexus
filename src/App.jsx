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

function formatarAcesso(isoString) {
  if (!isoString) return "Nunca acessou";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Nunca acessou";
    const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${data} às ${hora}`;
  } catch (e) {
    return "Nunca acessou";
  }
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
  const [adminMensagensAba, setAdminMensagensAba] = useState("prospeccao");
  const [mobileMenuAberto, setMobileMenuAberto] = useState(false);
  const [whatsappSuporte, setWhatsappSuporte] = useState("");
  const [urlRecuperarToken, setUrlRecuperarToken] = useState("");

  useEffect(() => {
    async function obterConfigSuporte() {
      try {
        const res = await fetch(`${API_URL}/configuracoes`);
        const data = await res.json();
        if (data.ok && data.whatsapp_suporte !== undefined) {
          setWhatsappSuporte(data.whatsapp_suporte);
        }
      } catch (err) {
        console.error("Erro ao obter WhatsApp de suporte:", err);
      }
    }
    obterConfigSuporte();
  }, [usuarioLogado]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("recuperar_token");
    if (resetToken) {
      setUrlRecuperarToken(resetToken);
      setPagina("recuperar-senha");
      const url = new URL(window.location.href);
      url.searchParams.delete("recuperar_token");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

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
        whatsappSuporte={whatsappSuporte}
      />

      <main className="conteudo">
        {usuarioLogado && usuarioLogado.suspensao_ate && new Date(usuarioLogado.suspensao_ate) > new Date() ? (
          <TelaSuspensao usuarioLogado={usuarioLogado} setUsuarioLogado={setUsuarioLogado} sair={sair} />
        ) : usuarioLogado && usuarioLogado.ativo === 0 && (usuarioLogado.eh_gerente || 0) === 0 ? (
          <TelaFilaEspera usuarioLogado={usuarioLogado} sair={sair} />
        ) : pagina.startsWith("admin-") && !adminToken ? (
          <LoginAdmin loginAdminSucesso={loginAdminSucesso} setPagina={setPagina} />
        ) : (
          <>
            {/* Admin Pages */}
            {pagina === "admin-dashboard" && <AdminDashboard setPagina={setPagina} setAdminMensagensAba={setAdminMensagensAba} />}
            {pagina === "admin-vendedores" && <AdminVendedores />}
            {pagina === "admin-captura" && <AdminCaptura />}
            {pagina === "admin-leads" && <AdminLeads />}
            {pagina === "admin-mensagens" && <AdminMensagens abaAtiva={adminMensagensAba} setAbaAtiva={setAdminMensagensAba} />}
            {pagina === "admin-prevendas" && <AdminPreVendas />}
            {pagina === "admin-sandbox" && <AdminSandbox />}

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
            {pagina === "recuperar-senha" && (
              <RecuperarSenha 
                setPagina={setPagina} 
                urlToken={urlRecuperarToken} 
                setUrlToken={setUrlRecuperarToken} 
              />
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
            {pagina === "vendedor-mensagens" && (
              <VendedorMensagens usuarioLogado={usuarioLogado} />
            )}
          </>
        )}
      </main>

      {/* Floating WhatsApp Support Button */}
      {whatsappSuporte && (
        <a 
          href={`https://wa.me/${whatsappSuporte.replace(/\D/g, "")}?text=Olá,%20preciso%20de%20suporte%20no%20painel%20da%20Nexus.`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-whatsapp-suporte-flutuante"
          title="Suporte WhatsApp"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.197 1.45 4.817 1.457 5.432.003 9.851-4.354 9.854-9.707.001-2.592-1.01-5.029-2.846-6.868-1.837-1.838-4.279-2.849-6.874-2.85-5.437 0-9.859 4.355-9.863 9.709-.001 1.76.478 3.483 1.39 5.018l-.993 3.627 3.715-.986zm11.387-5.474c-.3-.15-1.772-.875-2.046-.975-.274-.1-.474-.15-.674.15-.2.3-.773.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.488-1.777-1.663-2.077-.175-.3-.018-.463.13-.61L9.67 9.89c.125-.15.175-.25.25-.425.075-.175.037-.325-.019-.425-.056-.1-.474-1.144-.65-1.569-.17-.411-.34-.356-.47-.356-.12-.006-.26-.006-.4-.006s-.36.05-.55.25c-.2.2-.75.735-.75 1.792 0 1.057.77 2.077.877 2.227.11.15 1.516 2.314 3.67 3.243.513.221.913.353 1.225.452.516.164.986.141 1.356.085.414-.062 1.771-.725 2.022-1.425.25-.7.25-1.299.175-1.424-.076-.125-.275-.2-.575-.35z"/>
          </svg>
        </a>
      )}
    </div>
  );
}

function Sidebar({ pagina, setPagina, usuarioLogado, sair, adminToken, sairAdmin, sidebarRecolhida, setSidebarRecolhida, mobileMenuAberto, whatsappSuporte }) {
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
                  onClick={() => {
                    setPagina("admin-mensagens");
                    setAdminMensagensAba("prospeccao");
                  }}
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
                <button
                  className={pagina === "admin-sandbox" ? "ativo" : ""}
                  onClick={() => setPagina("admin-sandbox")}
                >
                  <span className="sidebar-icon">🧪</span>
                  <span className="sidebar-text">Sandbox / Testes</span>
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
          {(usuarioLogado.ativo === 1 || (usuarioLogado.eh_gerente || 0) !== 0) && (
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
              <button
                className={pagina === "vendedor-mensagens" ? "ativo" : ""}
                onClick={() => setPagina("vendedor-mensagens")}
              >
                <span className="sidebar-icon">✉️</span>
                <span className="sidebar-text">Minhas Mensagens</span>
              </button>
            </>
          )}
          <div className="sidebar-footer">
            {whatsappSuporte && (
              <a 
                href={`https://wa.me/${whatsappSuporte.replace(/\D/g, "")}?text=Olá,%20preciso%20de%20suporte%20no%20painel%20da%20Nexus.`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-whatsapp-suporte"
              >
                <span className="sidebar-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: "block" }}>
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.197 1.45 4.817 1.457 5.432.003 9.851-4.354 9.854-9.707.001-2.592-1.01-5.029-2.846-6.868-1.837-1.838-4.279-2.849-6.874-2.85-5.437 0-9.859 4.355-9.863 9.709-.001 1.76.478 3.483 1.39 5.018l-.993 3.627 3.715-.986zm11.387-5.474c-.3-.15-1.772-.875-2.046-.975-.274-.1-.474-.15-.674.15-.2.3-.773.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.488-1.777-1.663-2.077-.175-.3-.018-.463.13-.61L9.67 9.89c.125-.15.175-.25.25-.425.075-.175.037-.325-.019-.425-.056-.1-.474-1.144-.65-1.569-.17-.411-.34-.356-.47-.356-.12-.006-.26-.006-.4-.006s-.36.05-.55.25c-.2.2-.75.735-.75 1.792 0 1.057.77 2.077.877 2.227.11.15 1.516 2.314 3.67 3.243.513.221.913.353 1.225.452.516.164.986.141 1.356.085.414-.062 1.771-.725 2.022-1.425.25-.7.25-1.299.175-1.424-.076-.125-.275-.2-.575-.35z"/>
                  </svg>
                </span>
                <span className="sidebar-text">Suporte WhatsApp</span>
              </a>
            )}
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
function AdminDashboard({ setPagina, setAdminMensagensAba }) {
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
    totalCliques: 0,
  });

  const [estoqueLeads, setEstoqueLeads] = useState(0);

  const [vendedores, setVendedores] = useState([]);
  const [limiteVendedores, setLimiteVendedores] = useState(100);
  const [comissaoVenda, setComissaoVenda] = useState(150);
  const [precoProduto, setPrecoProduto] = useState(200);
  const [linkAfiliacaoKiwify, setLinkAfiliacaoKiwify] = useState("");
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");
  const [queryDisparo, setQueryDisparo] = useState("");
  const [nichoDisparo, setNichoDisparo] = useState("");
  const [limiteDisparo, setLimiteDisparo] = useState(20);
  const [msgRobo, setMsgRobo] = useState("");
  const [msgHumano, setMsgHumano] = useState("");
  const [whatsappSuporte, setWhatsappSuporte] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [linkVendaPadrao, setLinkVendaPadrao] = useState("");
  const [horaInicioDisparo, setHoraInicioDisparo] = useState(8);
  const [horaFimDisparo, setHoraFimDisparo] = useState(20);
  const [configErro, setConfigErro] = useState("");
  const [configSucesso, setConfigSucesso] = useState("");
  const [configAbaAtiva, setConfigAbaAtiva] = useState("geral");

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
        const cliquesGlobais = dataConfig.cliques_globais ? Number(dataConfig.cliques_globais) : 0;
        const cliquesVendedores = dataVendedores.vendedores.reduce((sum, v) => sum + (v.cliques_link || 0), 0);
        const cliquesLeads = leads.reduce((sum, l) => sum + (l.cliques_link || 0), 0);

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
          totalCliques: cliquesLeads + cliquesVendedores + cliquesGlobais,
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
            comissao: vendas * comVal,
            comissao_gerente: v.comissao_gerente || 0,
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
        if (data.query_disparo !== undefined) setQueryDisparo(data.query_disparo);
        if (data.nicho_disparo !== undefined) setNichoDisparo(data.nicho_disparo);
        if (data.limite_disparo !== undefined) setLimiteDisparo(Number(data.limite_disparo));
        if (data.mensagem_resposta_robo !== undefined) setMsgRobo(data.mensagem_resposta_robo);
        if (data.mensagem_resposta_humano !== undefined) setMsgHumano(data.mensagem_resposta_humano);
        if (data.whatsapp_suporte !== undefined) setWhatsappSuporte(data.whatsapp_suporte);
        if (data.smtp_host !== undefined) setSmtpHost(data.smtp_host);
        if (data.smtp_port !== undefined) setSmtpPort(data.smtp_port);
        if (data.smtp_user !== undefined) setSmtpUser(data.smtp_user);
        if (data.smtp_pass !== undefined) setSmtpPass(data.smtp_pass);
        if (data.smtp_from !== undefined) setSmtpFrom(data.smtp_from);
        if (data.link_venda_padrao !== undefined) setLinkVendaPadrao(data.link_venda_padrao);
        if (data.hora_inicio_disparo !== undefined) setHoraInicioDisparo(Number(data.hora_inicio_disparo));
        if (data.hora_fim_disparo !== undefined) setHoraFimDisparo(Number(data.hora_fim_disparo));
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
        link_afiliacao_kiwify: linkAfiliacaoKiwify,
        query_disparo: queryDisparo,
        nicho_disparo: nichoDisparo,
        limite_disparo: limiteDisparo,
        mensagem_resposta_robo: msgRobo,
        mensagem_resposta_humano: msgHumano,
        whatsapp_suporte: whatsappSuporte,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        smtp_from: smtpFrom,
        link_venda_padrao: linkVendaPadrao,
        hora_inicio_disparo: horaInicioDisparo,
        hora_fim_disparo: horaFimDisparo
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
    const interval = setInterval(carregarDados, 10000);
    return () => clearInterval(interval);
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
        <div className="stat-card info" style={{ borderLeft: "4px solid var(--info)" }}>
          <span className="stat-label">Cliques no Link</span>
          <span className="stat-value">{estatisticas.totalCliques || 0} 🖱️</span>
          <span className="stat-desc">Total de cliques nos links enviados</span>
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
                <th>Nível</th>
                <th>Atividade / Robô</th>
                <th>Status</th>
                <th>Leads Atribuídos</th>
                <th>Limite Diário</th>
                <th>Vendas Convertidas</th>
                <th>Comissão Própria</th>
                <th>Comissão Gerência</th>
                <th>Total Ganho</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>Nenhum vendedor registrado.</td>
                </tr>
              ) : (
                vendedores.map(v => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.nome}</strong>
                      <br /><small>{v.email}</small>
                      {v.pix && (
                        <>
                          <br />
                          <small style={{ color: "var(--success)", fontWeight: "600" }}>🔑 PIX: {v.pix}</small>
                        </>
                      )}
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
                      {v.eh_gerente === 0 && <span className="badge badge-vacuo" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>Vendedor</span>}
                      {v.eh_gerente === 1 && <span className="badge badge-prevenda" style={{ fontSize: "0.75rem", padding: "2px 6px", textTransform: "none" }}>Gerente Base</span>}
                      {v.eh_gerente === 2 && <span className="badge" style={{ fontSize: "0.75rem", padding: "2px 6px", textTransform: "none", backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6", border: "1px solid rgba(139, 92, 246, 0.3)" }}>Gerente Pro</span>}
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div>
                          {v.ultimo_acesso && (Math.abs(Date.now() - new Date(v.ultimo_acesso).getTime()) < 5 * 60 * 1000) ? (
                            <span className="badge" style={{
                              backgroundColor: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              fontSize: "0.75rem",
                              padding: "3px 8px",
                              textTransform: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }}></span>
                              Online
                            </span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                              <span className="badge" style={{
                                backgroundColor: "rgba(107, 114, 128, 0.15)",
                                color: "#6b7280",
                                border: "1px solid rgba(107, 114, 128, 0.3)",
                                fontSize: "0.75rem",
                                padding: "3px 8px",
                                textTransform: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6b7280", display: "inline-block" }}></span>
                                Offline
                              </span>
                              <small style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                                {formatarAcesso(v.ultimo_acesso)}
                              </small>
                            </div>
                          )}
                        </div>
                        <div>
                          {v.robo_ativo === 1 ? (
                            <span className="badge" style={{
                              backgroundColor: "rgba(139, 92, 246, 0.15)",
                              color: "#8b5cf6",
                              border: "1px solid rgba(139, 92, 246, 0.3)",
                              fontSize: "0.75rem",
                              padding: "3px 8px",
                              textTransform: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              ⚡ Robô Disparado
                            </span>
                          ) : (
                            <span className="badge" style={{
                              backgroundColor: "rgba(245, 158, 11, 0.15)",
                              color: "#f59e0b",
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                              fontSize: "0.75rem",
                              padding: "3px 8px",
                              textTransform: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              ⏸️ Robô Parado
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${v.ativo ? "badge-prevenda" : "badge-vacuo"}`}>
                        {v.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>{v.totalLeads} leads</td>
                    <td>{v.limite_diario} por dia</td>
                    <td><strong>{v.vendas}</strong></td>
                    <td style={{ color: "var(--success)", fontWeight: "bold" }}>
                      {v.comissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td style={{ color: "var(--primary)", fontWeight: "bold" }}>
                      {(v.comissao_gerente || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td style={{ color: "var(--success)", fontWeight: "bold", fontSize: "1.05rem" }}>
                      {(v.comissao + (v.comissao_gerente || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: "30px" }}>
        <h2>Configurações do Sistema</h2>
        <p className="subtitle">Altere as configurações de licenças, vendas, disparo, robô de mensagens e SMTP de e-mail.</p>
        
        {configErro && <div className="alert alert-error">{configErro}</div>}
        {configSucesso && <div className="alert alert-success">{configSucesso}</div>}

        {/* Tab navigation */}
        <div style={{ 
          display: "flex", 
          gap: "8px", 
          borderBottom: "1px solid var(--border-color)", 
          paddingBottom: "12px", 
          marginTop: "20px",
          marginBottom: "20px",
          overflowX: "auto",
          whiteSpace: "nowrap"
        }}>
          {[
            { id: "geral", label: "⚙️ Geral & Licenças" },
            { id: "links", label: "🔗 Links de Venda" },
            { id: "disparo", label: "🎯 Coleta & Disparo" },
            { id: "robo", label: "🤖 Robô Auto-Reply" },
            { id: "email", label: "📧 Servidor de E-mail (SMTP)" }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setConfigAbaAtiva(t.id)}
              style={{
                background: configAbaAtiva === t.id ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                color: configAbaAtiva === t.id ? "#ffffff" : "var(--text-secondary)",
                border: "1px solid " + (configAbaAtiva === t.id ? "var(--primary)" : "var(--border-color)"),
                padding: "8px 16px",
                borderRadius: "var(--border-radius)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.85rem",
                width: "auto",
                margin: 0,
                transition: "all 0.2s ease"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        
        <form onSubmit={salvarConfiguracoes}>
          {configAbaAtiva === "geral" && (
            <div className="form-grid" style={{ marginTop: "10px" }}>
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

              <div className="form-group">
                <label>📞 WhatsApp de Suporte (DDD + Número)</label>
                <input 
                  type="text" 
                  value={whatsappSuporte} 
                  onChange={e => setWhatsappSuporte(e.target.value)} 
                  placeholder="Ex: 5511999999999" 
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Número com código do país (55) e DDD que os funcionários usarão para tirar dúvidas.
                </small>
              </div>
            </div>
          )}

          {configAbaAtiva === "links" && (
            <div className="form-grid" style={{ marginTop: "10px" }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>🔗 Link de Solicitação de Afiliação (Kiwify)</label>
                <input 
                  type="text" 
                  value={linkAfiliacaoKiwify} 
                  onChange={e => setLinkAfiliacaoKiwify(e.target.value)} 
                  required 
                  placeholder="Ex: https://dashboard.kiwify.com.br/affiliate/join/..."
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Este link será aberto quando o vendedor clicar em "Gerar Link" no cadastro de perfil para se filiar ao seu produto.
                </small>
              </div>

              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>🛍️ Link de Venda Geral / Fallback (Site do Produto / Checkout)</label>
                <input 
                  type="text" 
                  value={linkVendaPadrao} 
                  onChange={e => setLinkVendaPadrao(e.target.value)} 
                  required 
                  placeholder="Ex: https://pay.kiwify.com.br/..."
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Este link será enviado nas mensagens de prospecção/auto-reply para os clientes finais caso o vendedor não tenha cadastrado seu link de afiliação de vendas próprio.
                </small>
              </div>
            </div>
          )}

          {configAbaAtiva === "disparo" && (
            <div className="form-grid" style={{ marginTop: "10px" }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>🎯 Query de Disparo (Busca no Google Maps)</label>
                <input
                  type="text"
                  value={queryDisparo}
                  onChange={e => setQueryDisparo(e.target.value)}
                  placeholder="Ex: hamburgueria em Mogi das Cruzes SP"
                  required
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Texto exato de busca que o vendedor usará ao disparar mensagens. Ex: <strong>"pizzaria em São Paulo SP"</strong>
                </small>
              </div>

              <div className="form-group">
                <label>🏷️ Nicho de Disparo</label>
                <input
                  type="text"
                  value={nichoDisparo}
                  onChange={e => setNichoDisparo(e.target.value)}
                  placeholder="Ex: hamburguerias"
                  required
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Categoria do nicho para classificação dos leads no banco de dados.
                </small>
              </div>

              <div className="form-group">
                <label>📊 Limite de Leads por Disparo</label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={limiteDisparo}
                  onChange={e => setLimiteDisparo(Number(e.target.value))}
                  required
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Quantidade máxima de leads que serão raspados e disparados por sessão de envio.
                </small>
              </div>

              <div className="form-group">
                <label>⏰ Horário de Início dos Disparos (0-23h)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={horaInicioDisparo}
                  onChange={e => setHoraInicioDisparo(Number(e.target.value))}
                  required
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Hora do dia em que os envios do robô começam. Ex: 8 para 08:00.
                </small>
              </div>

              <div className="form-group">
                <label>⏰ Horário de Término dos Disparos (0-23h)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={horaFimDisparo}
                  onChange={e => setHoraFimDisparo(Number(e.target.value))}
                  required
                />
                <small style={{ color: "var(--text-secondary)" }}>
                  Hora do dia em que os envios são pausados. Ex: 20 para 20:00.
                </small>
              </div>
            </div>
          )}

          {configAbaAtiva === "robo" && (
            <div style={{
              padding: "24px 30px",
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              marginTop: "10px",
              flexWrap: "wrap"
            }}>
              <div style={{ flex: "1 1 300px" }}>
                <strong style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px", fontSize: "1.05rem" }}>
                  🤖 Respostas Automáticas (Robô vs Humano)
                </strong>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Os modelos de mensagens enviadas automaticamente quando o lead responder (Robô/Menu digital ou Humano/Pessoa real) agora possuem um painel dedicado com explicações de critérios, variáveis e substituição do link de afiliado.
                </p>
              </div>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  setAdminMensagensAba("auto-reply");
                  setPagina("admin-mensagens");
                }}
                style={{ padding: "10px 20px", fontSize: "0.88rem", whiteSpace: "nowrap", width: "auto", margin: 0 }}
              >
                ⚙️ Configurar Respostas Automáticas
              </button>
            </div>
          )}

          {configAbaAtiva === "email" && (
            <div className="form-grid" style={{ marginTop: "10px" }}>
              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <strong style={{ fontSize: "1.1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  📧 Servidor de E-mail (SMTP para Recuperação de Senha)
                </strong>
                <p style={{ margin: "4px 0 12px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Defina o servidor de SMTP para envio de e-mails de recuperação de senha aos vendedores. Deixe em branco para simular no console.
                </p>
              </div>

              <div className="form-group">
                <label>SMTP Host</label>
                <input 
                  type="text" 
                  value={smtpHost} 
                  onChange={e => setSmtpHost(e.target.value)} 
                  placeholder="Ex: smtp.hostinger.com" 
                />
              </div>

              <div className="form-group">
                <label>SMTP Porta</label>
                <input 
                  type="text" 
                  value={smtpPort} 
                  onChange={e => setSmtpPort(e.target.value)} 
                  placeholder="Ex: 465 ou 587" 
                />
              </div>

              <div className="form-group">
                <label>SMTP Usuário / E-mail</label>
                <input 
                  type="text" 
                  value={smtpUser} 
                  onChange={e => setSmtpUser(e.target.value)} 
                  placeholder="Ex: suporte@seudominio.com" 
                />
              </div>

              <div className="form-group">
                <label>SMTP Senha</label>
                <input 
                  type="password" 
                  value={smtpPass} 
                  onChange={e => setSmtpPass(e.target.value)} 
                  placeholder="Senha do e-mail ou token" 
                />
              </div>

              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label>SMTP Remetente (E-mail que envia)</label>
                <input 
                  type="text" 
                  value={smtpFrom} 
                  onChange={e => setSmtpFrom(e.target.value)} 
                  placeholder="Ex: suporte@seudominio.com" 
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: "24px", borderTop: "1px solid var(--border-color)", paddingTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit" style={{ padding: "12px 30px", fontSize: "0.95rem", width: "auto", margin: 0 }}>
              💾 Salvar Configurações
            </button>
          </div>
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
    eh_gerente: 0,
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
    const interval = setInterval(carregarVendedores, 10000);
    return () => clearInterval(interval);
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
            nome: form.nome.toUpperCase().trim(),
            email: form.email,
            senha: form.senha || undefined, // only update password if filled
            whatsapp: form.whatsapp,
            limite_diario: Number(form.limite_diario),
            cpf: form.cpf,
            link_kiwify: form.link_kiwify,
            eh_gerente: Number(form.eh_gerente),
          })
        });
      } else {
        // Create seller
        res = await fetch(`${API_URL}/vendedores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            nome: form.nome.toUpperCase().trim(),
            limite_diario: Number(form.limite_diario),
            eh_gerente: Number(form.eh_gerente),
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Erro ao salvar vendedor.");
        return;
      }

      setSucesso(editando ? "Vendedor atualizado com sucesso!" : "Vendedor cadastrado com sucesso!");
      setForm({ nome: "", email: "", senha: "", whatsapp: "", limite_diario: 25, cpf: "", link_kiwify: "", eh_gerente: 0 });
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
      eh_gerente: vendedor.eh_gerente || 0,
    });
  }

  async function alternarDisparoRobo(vendedor) {
    try {
      setErro("");
      setSucesso("");
      const isRobotActive = vendedor.robo_ativo === 1;
      const url = isRobotActive 
        ? `${API_URL}/whatsapp/cancelar-disparo/${vendedor.id}` 
        : `${API_URL}/whatsapp/disparar/${vendedor.id}`;
      
      const res = await fetch(url, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso(data.message || (isRobotActive ? "Robô pausado com sucesso." : "Robô iniciado com sucesso."));
        carregarVendedores();
      } else {
        setErro(data.error || "Erro ao alterar estado do robô.");
      }
    } catch (e) {
      console.error(e);
      setErro("Falha de conexão ao alterar estado do robô.");
    }
  }

  async function excluirVendedor(vendedor) {
    if (!vendedor || !vendedor.id) return;
    if (!window.confirm(`Tem certeza absoluta que deseja excluir permanentemente a conta do vendedor "${vendedor.nome}"? Esta ação não pode ser desfeita e removerá todo o histórico associado.`)) {
      return;
    }
    try {
      setErro("");
      setSucesso("");
      const res = await fetch(`${API_URL}/vendedores/${vendedor.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso("Conta do vendedor excluída com sucesso.");
        setEditando(null);
        setForm({ nome: "", email: "", senha: "", whatsapp: "", limite_diario: 25, cpf: "", link_kiwify: "", eh_gerente: 0 });
        carregarVendedores();
      } else {
        setErro(data.error || "Erro ao excluir conta do vendedor.");
      }
    } catch (e) {
      console.error(e);
      setErro("Falha de conexão com o servidor ao excluir vendedor.");
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
              <input name="nome" value={form.nome} onChange={alterarCampo} required placeholder="Ex: João da Silva" />
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
            <div className="form-group">
              <label>Nível de Acesso (Gerência)</label>
              <select name="eh_gerente" value={form.eh_gerente} onChange={alterarCampo}>
                <option value={0}>Regular Vendedor</option>
                <option value={1}>Gerente Base (R$ 100/venda)</option>
                <option value={2}>Gerente Pro (R$ 300/venda)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", width: "100%" }}>
            <button className="btn btn-primary" type="submit">
              {editando ? "Salvar Alterações" : "Cadastrar Vendedor"}
            </button>
            {editando && (
              <>
                <button className="btn btn-secondary" type="button" onClick={() => {
                  setEditando(null);
                  setForm({ nome: "", email: "", senha: "", whatsapp: "", limite_diario: 25, cpf: "", link_kiwify: "", eh_gerente: 0 });
                }}>Cancelar Edição</button>
                <button 
                  className="btn btn-danger" 
                  type="button" 
                  onClick={() => excluirVendedor(editando)}
                  style={{ marginLeft: "auto" }}
                >
                  🗑️ Excluir Conta
                </button>
              </>
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
                <th>Atividade / Robô</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>Nenhum vendedor cadastrado.</td>
                </tr>
              ) : vendedores.filter(v => v.nome.toLowerCase().includes(filtroNome.toLowerCase())).length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>Nenhum vendedor encontrado com o nome "{filtroNome}".</td>
                </tr>
              ) : (
                vendedores
                  .filter(v => v.nome.toLowerCase().includes(filtroNome.toLowerCase()))
                  .map(v => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.nome}</strong>{" "}
                        {v.eh_gerente === 1 && <span className="badge badge-prevenda" style={{ fontSize: "0.7rem", padding: "1px 5px", textTransform: "none" }}>Gerente Base</span>}
                        {v.eh_gerente === 2 && <span className="badge" style={{ fontSize: "0.7rem", padding: "1px 5px", textTransform: "none", backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6", border: "1px solid rgba(139, 92, 246, 0.3)" }}>Gerente Pro</span>}
                        <br /><small>{v.email}</small>
                        <br /><small style={{ color: "var(--text-tertiary)" }}>CPF: {v.cpf || "Não cadastrado"}</small>
                        {v.pix && (
                          <>
                            <br /><small style={{ color: "var(--success)", fontWeight: "600" }}>🔑 PIX: {v.pix}</small>
                          </>
                        )}
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
                      <td style={{ verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div>
                            {v.ultimo_acesso && (Math.abs(Date.now() - new Date(v.ultimo_acesso).getTime()) < 5 * 60 * 1000) ? (
                              <span className="badge" style={{
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                color: "#10b981",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                fontSize: "0.75rem",
                                padding: "3px 8px",
                                textTransform: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }}></span>
                                Online
                              </span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                <span className="badge" style={{
                                  backgroundColor: "rgba(107, 114, 128, 0.15)",
                                  color: "#6b7280",
                                  border: "1px solid rgba(107, 114, 128, 0.3)",
                                  fontSize: "0.75rem",
                                  padding: "3px 8px",
                                  textTransform: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6b7280", display: "inline-block" }}></span>
                                  Offline
                                </span>
                                <small style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
                                  {formatarAcesso(v.ultimo_acesso)}
                                </small>
                              </div>
                            )}
                          </div>
                          <div>
                            {v.robo_ativo === 1 ? (
                              <span className="badge" style={{
                                backgroundColor: "rgba(139, 92, 246, 0.15)",
                                color: "#8b5cf6",
                                border: "1px solid rgba(139, 92, 246, 0.3)",
                                fontSize: "0.75rem",
                                padding: "3px 8px",
                                textTransform: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}>
                                ⚡ Robô Disparado
                              </span>
                            ) : (
                              <span className="badge" style={{
                                backgroundColor: "rgba(245, 158, 11, 0.15)",
                                color: "#f59e0b",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                fontSize: "0.75rem",
                                padding: "3px 8px",
                                textTransform: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}>
                                ⏸️ Robô Parado
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
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
                          <button className={`btn ${v.robo_ativo === 1 ? "btn-danger" : "btn-success"}`} style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => alternarDisparoRobo(v)}>
                            {v.robo_ativo === 1 ? "⏸️ Pausar" : "⚡ Disparar"}
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
  const [selectedChatLead, setSelectedChatLead] = useState(null);

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
    const interval = setInterval(() => {
      carregarLeads();
    }, 5000);
    return () => clearInterval(interval);
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

  async function excluirLead(id, empresa) {
    if (!window.confirm(`Tem certeza que deseja excluir o lead da empresa "${empresa}"?`)) {
      return;
    }
    setMensagemStatus("");
    try {
      const res = await fetch(`${API_URL}/leads/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMensagemStatus(`Lead de "${empresa}" excluído com sucesso.`);
        carregarLeads();
      } else {
        setMensagemStatus("Erro: " + data.error);
      }
    } catch (e) {
      console.error(e);
      setMensagemStatus("Erro ao comunicar com o servidor.");
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
                <th>Cliques</th>
                <th>Vendedor Responsável</th>
                <th>Última Mensagem</th>
                <th>Origem</th>
                <th style={{ textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>Nenhum lead encontrado com os filtros atuais.</td>
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
                    <td>
                      <span className="badge" style={{ background: l.cliques_link > 0 ? "var(--success)" : "rgba(255,255,255,0.05)", color: l.cliques_link > 0 ? "black" : "var(--text-secondary)" }}>
                        {l.cliques_link || 0} 🖱️
                      </span>
                    </td>
                    <td>{l.vendedor_nome ? <strong>👤 {l.vendedor_nome}</strong> : <span style={{ color: "var(--text-tertiary)" }}>Não atribuído</span>}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {l.ultima_mensagem ? (
                          <div 
                            style={{ 
                              maxWidth: "180px", 
                              overflow: "hidden", 
                              textOverflow: "ellipsis", 
                              whiteSpace: "nowrap",
                              fontSize: "0.85rem",
                              color: "var(--text-secondary)"
                            }} 
                            title={l.ultima_mensagem}
                          >
                            {l.ultima_mensagem}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>Nenhuma enviada</span>
                        )}
                        {l.vendedor_id && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ 
                              padding: "3px 8px", 
                              fontSize: "0.75rem", 
                              width: "fit-content",
                              marginTop: "2px",
                              background: "rgba(217, 119, 6, 0.1)",
                              borderColor: "rgba(217, 119, 6, 0.2)",
                              color: "var(--primary)",
                              cursor: "pointer"
                            }}
                            onClick={() => setSelectedChatLead(l)}
                          >
                            💬 Ver Histórico
                          </button>
                        )}
                      </div>
                    </td>
                    <td><small>{l.origem}<br />({l.query_origem})</small></td>
                    <td style={{ textAlign: "center" }}>
                      <button 
                        type="button"
                        className="btn btn-secondary" 
                        onClick={() => excluirLead(l.id, l.empresa)}
                        style={{ padding: "6px 10px", fontSize: "0.8rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444" }}
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedChatLead && (
        <ChatDrawer
          lead={selectedChatLead}
          vendedorId={selectedChatLead.vendedor_id}
          onClose={() => setSelectedChatLead(null)}
          readOnly={true}
        />
      )}
    </section>
  );
}

// 5. ADMIN MESSAGING TEMPLATE
// 5. ADMIN MESSAGING TEMPLATE
function AdminMensagens({ abaAtiva, setAbaAtiva }) {
  const [mensagens, setMensagens] = useState([]);
  const [form, setForm] = useState({ nome: "", texto: "", condicao_site: "qualquer" });
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Auto-reply state
  const [msgRobo, setMsgRobo] = useState("");
  const [msgHumano, setMsgHumano] = useState("");
  const [autoReplySucesso, setAutoReplySucesso] = useState("");
  const [autoReplyErro, setAutoReplyErro] = useState("");

  async function carregarDados() {
    try {
      if (abaAtiva === "auto-reply") {
        const res = await fetch(`${API_URL}/configuracoes`);
        const data = await res.json();
        if (data.ok) {
          setMsgRobo(data.mensagem_resposta_robo || "");
          setMsgHumano(data.mensagem_resposta_humano || "");
        }
        return;
      }
      
      const isProsp = abaAtiva === "prospeccao";
      const isSec = abaAtiva === "secundaria";
      
      let endpoint;
      if (isProsp) {
        endpoint = "/mensagens?tipo=primaria";
      } else if (isSec) {
        endpoint = "/mensagens?tipo=secundaria";
      } else {
        endpoint = "/respostas-rapidas";
      }

      const res = await fetch(`${API_URL}${endpoint}`);
      const data = await res.json();
      if (data.ok) {
        if (isProsp || isSec) {
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

  async function salvarAutoReply(e) {
    e.preventDefault();
    setAutoReplyErro("");
    setAutoReplySucesso("");
    try {
      const res = await fetch(`${API_URL}/configuracoes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem_resposta_robo: msgRobo, mensagem_resposta_humano: msgHumano })
      });
      const data = await res.json();
      if (res.ok) {
        setAutoReplySucesso("Mensagens de resposta automática salvas com sucesso!");
      } else {
        setAutoReplyErro(data.error || "Erro ao salvar.");
      }
    } catch (e) {
      setAutoReplyErro("Erro de comunicação com o servidor.");
    }
  }

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
      const isSec = abaAtiva === "secundaria";
      const isMsgTemplate = isProsp || isSec;

      const endpoint = isMsgTemplate ? "/mensagens" : "/respostas-rapidas";
      const url = editingId ? `${API_URL}${endpoint}/${editingId}` : `${API_URL}${endpoint}`;
      const method = editingId ? "PUT" : "POST";
      
      const body = isMsgTemplate 
        ? { 
            nome: form.nome, 
            texto: form.texto, 
            condicao_site: form.condicao_site,
            tipo: isProsp ? "primaria" : "secundaria"
          }
        : { titulo: form.nome, texto: form.texto };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setSucesso(editingId ? "Atualizado com sucesso!" : "Criado com sucesso!");
        setForm({ nome: "", texto: "", condicao_site: "qualquer" });
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
    const isMsgTemplate = abaAtiva === "prospeccao" || abaAtiva === "secundaria";
    setForm({ 
      nome: isMsgTemplate ? m.nome : m.titulo, 
      texto: m.texto,
      condicao_site: m.condicao_site || "qualquer"
    });
    setErro("");
    setSucesso("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicao() {
    setEditingId(null);
    setForm({ nome: "", texto: "", condicao_site: "qualquer" });
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
      const isMsgTemplate = abaAtiva === "prospeccao" || abaAtiva === "secundaria";
      const endpoint = isMsgTemplate ? "/mensagens" : "/respostas-rapidas";
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
  const isSec = abaAtiva === "secundaria";
  const isProspOrSec = isProsp || isSec;
  const isAutoReply = abaAtiva === "auto-reply";

  return (
    <section>
      <h1>Modelos de Mensagem</h1>
      <p className="subtitle">
        {isProsp 
          ? "Configure os modelos de mensagens que os vendedores dispararão automaticamente como contato inicial."
          : isSec
            ? "Configure as mensagens secundárias (follow-up) enviadas após 5 minutos ou ao receber resposta."
            : isAutoReply
              ? "Configure as mensagens enviadas automaticamente quando o lead responder — se não usar mensagens secundárias."
              : "Configure as respostas rápidas pré-salvas que os vendedores usarão no chat de duas vias."}
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button
          className={`btn ${isProsp ? "btn-primary" : "btn-secondary"}`}
          onClick={() => { setAbaAtiva("prospeccao"); cancelarEdicao(); }}
          type="button"
        >
          📢 Prospecção Automática
        </button>
        <button
          className={`btn ${isSec ? "btn-primary" : "btn-secondary"}`}
          onClick={() => { setAbaAtiva("secundaria"); cancelarEdicao(); }}
          type="button"
        >
          🔗 Mensagens Secundárias
        </button>
        <button
          className={`btn ${isAutoReply ? "btn-primary" : "btn-secondary"}`}
          onClick={() => { setAbaAtiva("auto-reply"); cancelarEdicao(); }}
          type="button"
          style={isAutoReply ? {} : { borderColor: "var(--primary)", color: "var(--primary)", background: "var(--primary-light)" }}
        >
          🤖 Resposta Automática (Robô / Humano)
        </button>
        <button
          className={`btn ${abaAtiva === "chat-rapido" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => { setAbaAtiva("chat-rapido"); cancelarEdicao(); }}
          type="button"
        >
          💬 Respostas Rápidas (Chat)
        </button>
      </div>

      {/* ── AUTO-REPLY TAB ── */}
      {isAutoReply && (
        <>
          {autoReplyErro && <div className="alert alert-error">{autoReplyErro}</div>}
          {autoReplySucesso && <div className="alert alert-success">{autoReplySucesso}</div>}

          <div className="card" style={{ borderLeft: "4px solid var(--primary)", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "1.5rem" }}>ℹ️</span>
              <div>
                <strong style={{ color: "var(--text-primary)" }}>Como funciona</strong>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "4px 0 0 0", lineHeight: 1.5 }}>
                  Após o disparo inicial, o sistema monitora o chat por até 4 horas. Quando o lead responde, 
                  detecta automaticamente se é um <strong>robô/atendimento automático</strong> ou um <strong>humano</strong> 
                  e envia a mensagem correspondente configurada abaixo.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "12px" }}>
              <div style={{ flex: 1, minWidth: "200px", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px", borderLeft: "3px solid #ef4444" }}>
                <strong style={{ color: "#ef4444", fontSize: "0.85rem" }}>🤖 Critérios de ROBÔ</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: "16px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  <li>Responde no mesmo minuto do envio</li>
                  <li>Contém "atendimento automático", "Digite 1", "menu de opções"...</li>
                  <li>Mensagem muito longa com várias opções</li>
                </ul>
              </div>
              <div style={{ flex: 1, minWidth: "200px", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px", borderLeft: "3px solid #22c55e" }}>
                <strong style={{ color: "#22c55e", fontSize: "0.85rem" }}>👤 Critérios de HUMANO</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: "16px", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  <li>Resposta orgânica, curta ou natural</li>
                  <li>Responde minutos/horas depois</li>
                  <li>Nenhum indicador de bot detectado</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={salvarAutoReply} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* BOT MESSAGE */}
            <div className="card" style={{ borderLeft: "4px solid #ef4444" }}>
              <label style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                🤖 Mensagem para <strong style={{ color: "#ef4444" }}>Robô / Atendimento Automático</strong>
              </label>
              <textarea
                rows={5}
                value={msgRobo}
                onChange={e => setMsgRobo(e.target.value)}
                placeholder="Ex: Olá! Percebi que vocês têm um atendimento automático. Gostaria de falar com o responsável para apresentar algo que pode aumentar muito as vendas de vocês. Qual o melhor horário?"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "0.95rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box"
                }}
              />
              <small style={{ color: "var(--text-secondary)", marginTop: "6px", display: "block" }}>
                Enviada quando detectar resposta automática, menu de opções, bot, horário de funcionamento etc.
                Variáveis: <code style={{ color: "var(--primary)" }}>{"{empresa}"}</code>
              </small>
            </div>

            {/* HUMAN MESSAGE */}
            <div className="card" style={{ borderLeft: "4px solid #22c55e" }}>
              <label style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                👤 Mensagem para <strong style={{ color: "#22c55e" }}>Humano / Responsável</strong>
              </label>
              <textarea
                rows={5}
                value={msgHumano}
                onChange={e => setMsgHumano(e.target.value)}
                placeholder="Ex: Que ótimo falar com você! 😊 Tenho uma proposta que pode aumentar bastante as vendas de vocês. Veja a demonstração personalizada e adquira com desconto especial: {link_kiwify}"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "0.95rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box"
                }}
              />
              <small style={{ color: "var(--text-secondary)", marginTop: "6px", display: "block" }}>
                Enviada quando uma pessoa real responder. O link de afiliado do vendedor é inserido automaticamente.{" "}
                Variáveis: <code style={{ color: "#22c55e" }}>{"{link_kiwify}"}</code> (link do vendedor — <strong>obrigatório para vender</strong>),{" "}
                <code style={{ color: "var(--primary)" }}>{"{empresa}"}</code> (nome do lead).
              </small>

              {/* Preview badge */}
              {msgHumano && !msgHumano.includes("{link_kiwify}") && (
                <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.4)", borderRadius: "6px", fontSize: "0.85rem", color: "#ca8a04" }}>
                  ⚠️ <strong>Dica:</strong> adicione <code>{"{link_kiwify}"}</code> na mensagem para enviar o link de afiliado automaticamente quando um humano responder!
                </div>
              )}
            </div>

            <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start", padding: "12px 28px" }}>
              💾 Salvar Mensagens de Resposta Automática
            </button>
          </form>
        </>
      )}

      {/* ── PROSPECCAO / SECUNDARIA / CHAT-RAPIDO TABS ── */}
      {!isAutoReply && (
        <>
          {erro && <div className="alert alert-error">{erro}</div>}
          {sucesso && <div className="alert alert-success">{sucesso}</div>}

          <div className="card">
            <h2>
              {editingId 
                ? (isProspOrSec ? "Editar Modelo de Mensagem" : "Editar Resposta Rápida")
                : (isProspOrSec ? "Criar Novo Modelo" : "Criar Nova Resposta Rápida")}
            </h2>
            <form onSubmit={salvarMensagem}>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label>
                  {isProspOrSec 
                    ? "Nome do Modelo (Identificação Interna)" 
                    : "Título do Atalho (Ex: Preço, Como Funciona, Pix)"}
                </label>
                <input 
                  name="nome" 
                  value={form.nome} 
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} 
                  placeholder={isProspOrSec ? "Ex: Primeiro Contato - Padarias" : "Ex: Link de Pagamento"} 
                  required 
                />
              </div>
              {isProspOrSec && (
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label>🌐 Condição de Envio (Baseado no Site do Lead)</label>
                  <select
                    value={form.condicao_site}
                    onChange={e => setForm(f => ({ ...f, condicao_site: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "0.95rem"
                    }}
                  >
                    <option value="qualquer">Qualquer Lead (COM ou SEM site)</option>
                    <option value="com_site">Somente Leads que POSSUEM site cadastrado</option>
                    <option value="sem_site">Somente Leads que NÃO possuem site cadastrado</option>
                  </select>
                  <small style={{ color: "var(--text-secondary)" }}>
                    Filtra automaticamente o modelo ideal de mensagem dependendo se o lead tem ou não um site no Google Maps.
                  </small>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label>
                  {isProspOrSec 
                    ? "Texto da Mensagem (Suporta variáveis)" 
                    : "Texto da Resposta (Suporta variáveis)"}
                </label>
                <textarea 
                  name="texto" 
                  value={form.texto} 
                  onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} 
                  rows="6" 
                  placeholder={isProspOrSec ? "Olá {saudacao}! Vi a empresa {empresa} no..." : "Excelente! Compre no link seguro: {link_kiwify}"} 
                  required 
                />
                <small style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                  {isProspOrSec ? (
                    <>
                      Variáveis dinâmicas suportadas: <code style={{ color: "var(--primary)" }}>{"{saudacao}"}</code> (Bom dia/Boa tarde/Boa noite), <code style={{ color: "var(--primary)" }}>{"{empresa}"}</code> (Nome do lead), <code style={{ color: "var(--primary)" }}>{"{nicho}"}</code> (Nicho comercial), <code style={{ color: "var(--primary)" }}>{"{link_kiwify}"}</code> (Link do vendedor).
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
            <h2>{isProspOrSec ? (isProsp ? "Modelos Salvos" : "Mensagens Secundárias Salvas") : "Respostas Rápidas Salvas"}</h2>
            {isProspOrSec && (
              <p className="subtitle" style={{ fontSize: "0.85rem", marginTop: "-5px", marginBottom: "15px" }}>
                Ative múltiplos modelos simultaneamente para rotacionar as mensagens de modo aleatório nos disparos automáticos.
              </p>
            )}
            {mensagens.length === 0 ? (
              <p>Nenhum modelo cadastrado.</p>
            ) : (
              mensagens.map(m => (
                <div className={`msg-item ${isProspOrSec && m.ativa === 1 ? "active" : ""}`} key={m.id}>
                  <div style={{ flex: 1, paddingRight: "15px" }}>
                    <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {isProspOrSec ? m.nome : m.titulo} 
                      {isProspOrSec && m.ativa === 1 && <span className="badge badge-prevenda">Ativo em Rotação</span>}
                      {isProspOrSec && m.condicao_site === "com_site" && <span className="badge" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "2px 8px" }}>🌐 Apenas COM Site</span>}
                      {isProspOrSec && m.condicao_site === "sem_site" && <span className="badge" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px" }}>🚫 Apenas SEM Site</span>}
                    </h3>
                    <p style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>{m.texto}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignSelf: "center" }}>
                    {isProspOrSec && (
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
        </>
      )}
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

// 7. ADMIN SANDBOX / TESTING VIEW
function AdminSandbox() {
  const [vendedores, setVendedores] = useState([]);
  const [vendedorId, setVendedorId] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("mensagem"); // "mensagem" | "scraper" | "whatsapp"
  
  // Envio
  const [modoEnvio, setModoEnvio] = useState("unico"); // "unico" | "lote"
  const [telefone, setTelefone] = useState("");
  const [telefonesLote, setTelefonesLote] = useState("");
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [delayLote, setDelayLote] = useState(5); // em segundos
  const [enviando, setEnviando] = useState(false);
  const [resultadoMsg, setResultadoMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState(""); // "success" | "error"

  // Status WA
  const [waStatus, setWaStatus] = useState("");
  const [waChecking, setWaChecking] = useState(false);

  // Scraper Test
  const [queryScraper, setQueryScraper] = useState("");
  const [limitScraper, setLimitScraper] = useState(3);
  const [scraping, setScraping] = useState(false);
  const [leadsScrapados, setLeadsScrapados] = useState([]);
  const [scraperErro, setScraperErro] = useState("");

  async function carregarVendedores() {
    try {
      const res = await fetch(`${API_URL}/vendedores`);
      const data = await res.json();
      if (data.ok) {
        setVendedores(data.vendedores || []);
        if (data.vendedores.length > 0) {
          setVendedorId(data.vendedores[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    carregarVendedores();
  }, []);

  async function verificarStatusWhatsApp() {
    if (!vendedorId) {
      alert("Selecione um vendedor primeiro.");
      return;
    }
    setWaChecking(true);
    setWaStatus("");
    try {
      const res = await fetch(`${API_URL}/whatsapp/status/${vendedorId}`);
      const data = await res.json();
      if (data.ok) {
        setWaStatus(data.status); // "connected", "disconnected", "initializing"
      } else {
        setWaStatus("Erro ao verificar: " + data.error);
      }
    } catch (e) {
      setWaStatus("Falha de conexão com o servidor");
    } finally {
      setWaChecking(false);
    }
  }

  async function enviarTeste(e) {
    e.preventDefault();
    if (!vendedorId) {
      setResultadoMsg("Selecione um vendedor.");
      setStatusMsg("error");
      return;
    }
    if (modoEnvio === "unico" && !telefone.trim()) {
      setResultadoMsg("Informe o número de telefone.");
      setStatusMsg("error");
      return;
    }
    if (modoEnvio === "lote" && !telefonesLote.trim()) {
      setResultadoMsg("Informe a lista de telefones.");
      setStatusMsg("error");
      return;
    }
    if (!mensagemTexto.trim()) {
      setResultadoMsg("Digite a mensagem a ser enviada.");
      setStatusMsg("error");
      return;
    }

    setEnviando(true);
    setResultadoMsg("");
    setStatusMsg("");

    try {
      if (modoEnvio === "unico") {
        const res = await fetch(`${API_URL}/admin/sandbox/enviar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendedorId,
            telefone: telefone.trim(),
            texto: mensagemTexto.trim()
          })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setResultadoMsg("Mensagem avulsa enviada com sucesso!");
          setStatusMsg("success");
          setTelefone("");
        } else {
          setResultadoMsg(data.error || "Erro ao enviar mensagem.");
          setStatusMsg("error");
        }
      } else {
        // Envio lote
        const listaTels = telefonesLote
          .split(/[\n,;]/)
          .map(t => t.trim().replace(/\D/g, ""))
          .filter(t => t.length >= 8);

        if (listaTels.length === 0) {
          setResultadoMsg("Nenhum telefone válido encontrado na lista.");
          setStatusMsg("error");
          setEnviando(false);
          return;
        }

        const res = await fetch(`${API_URL}/admin/sandbox/enviar-lote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendedorId,
            telefones: listaTels,
            texto: mensagemTexto.trim(),
            delay: delayLote * 1000
          })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setResultadoMsg(`Disparo em lote iniciado em background para ${listaTels.length} números!`);
          setStatusMsg("success");
          setTelefonesLote("");
        } else {
          setResultadoMsg(data.error || "Erro ao iniciar disparo em lote.");
          setStatusMsg("error");
        }
      }
    } catch (err) {
      setResultadoMsg("Falha na comunicação com o servidor.");
      setStatusMsg("error");
    } finally {
      setEnviando(false);
    }
  }

  async function testarScraper(e) {
    e.preventDefault();
    if (!queryScraper.trim()) {
      setScraperErro("Digite um termo de busca.");
      return;
    }
    setScraping(true);
    setScraperErro("");
    setLeadsScrapados([]);

    try {
      const res = await fetch(`${API_URL}/admin/sandbox/testar-captura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryScraper.trim(),
          limit: Number(limitScraper)
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setLeadsScrapados(data.leads || []);
        if ((data.leads || []).length === 0) {
          setScraperErro("Nenhum estabelecimento encontrado ou todos os contatos já existem.");
        }
      } else {
        setScraperErro(data.error || "Erro ao rodar scraper dry-run.");
      }
    } catch (err) {
      setScraperErro("Erro na comunicação com o servidor.");
    } finally {
      setScraping(false);
    }
  }

  return (
    <section>
      <h1>Sandbox e Painel de Testes</h1>
      <p className="subtitle">Espaço seguro para testar envio de mensagens individuais/lote, validar sessões de WhatsApp e testar capturas do Google Maps sem salvar ou alterar dados de produção.</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
        <button 
          className={`btn ${abaAtiva === "mensagem" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setAbaAtiva("mensagem")}
        >
          💬 Disparos de Teste
        </button>
        <button 
          className={`btn ${abaAtiva === "scraper" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setAbaAtiva("scraper")}
        >
          🔍 Testar Scraper
        </button>
        <button 
          className={`btn ${abaAtiva === "whatsapp" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setAbaAtiva("whatsapp")}
        >
          📱 Status WhatsApp
        </button>
      </div>

      {/* 1. ABA MENSAGEM */}
      {abaAtiva === "mensagem" && (
        <div className="card">
          <h2>Envio de Mensagens via WhatsApp</h2>
          <p className="subtitle" style={{ fontSize: "0.85rem", marginTop: "-5px", marginBottom: "20px" }}>Use as sessões dos funcionários para enviar mensagens. Certifique-se de que a sessão do vendedor selecionado está conectada.</p>

          {resultadoMsg && (
            <div className={`alert ${statusMsg === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "20px" }}>
              {resultadoMsg}
            </div>
          )}

          <form onSubmit={enviarTeste}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "15px" }}>
              <div className="form-group">
                <label>Vendedor para Disparo (Sessão)</label>
                <select value={vendedorId} onChange={e => setVendedorId(e.target.value)} required>
                  <option value="">Selecione um vendedor</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.nome} ({v.ativo ? "Ativo" : "Inativo"})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Modo de Envio</label>
                <select value={modoEnvio} onChange={e => setModoEnvio(e.target.value)}>
                  <option value="unico">Número Único</option>
                  <option value="lote">Lote de Números (Múltiplos)</option>
                </select>
              </div>
            </div>

            {modoEnvio === "unico" ? (
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <label>Número de WhatsApp (DDD + Número)</label>
                <input 
                  type="text" 
                  value={telefone} 
                  onChange={e => setTelefone(e.target.value)} 
                  placeholder="Ex: 11999999999"
                  disabled={enviando}
                />
                <small style={{ color: "var(--text-tertiary)" }}>Evite formatações, insira apenas os números.</small>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "20px", marginBottom: "15px" }}>
                <div className="form-group">
                  <label>Lista de Números (Um por linha ou separados por vírgula)</label>
                  <textarea 
                    value={telefonesLote} 
                    onChange={e => setTelefonesLote(e.target.value)} 
                    placeholder="Ex:&#10;11999999999&#10;11988888888&#10;11977777777"
                    rows="4"
                    disabled={enviando}
                  />
                </div>
                <div className="form-group">
                  <label>Delay entre Envios (Segundos)</label>
                  <input 
                    type="number" 
                    value={delayLote} 
                    onChange={e => setDelayLote(Number(e.target.value))} 
                    min="2"
                    max="60"
                    disabled={enviando}
                  />
                  <small style={{ color: "var(--text-tertiary)" }}>Recomendado: 5s+</small>
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label>Conteúdo da Mensagem</label>
              <textarea 
                value={mensagemTexto} 
                onChange={e => setMensagemTexto(e.target.value)} 
                placeholder="Escreva a mensagem aqui..."
                rows="4"
                required
                disabled={enviando}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={enviando} style={{ padding: "12px 24px" }}>
              {enviando ? "Enviando Disparos..." : "🚀 Enviar Mensagem de Teste"}
            </button>
          </form>
        </div>
      )}

      {/* 2. ABA SCRAPER */}
      {abaAtiva === "scraper" && (
        <div className="card">
          <h2>Testar Captura do Google Maps (Simulação)</h2>
          <p className="subtitle" style={{ fontSize: "0.85rem", marginTop: "-5px", marginBottom: "20px" }}>Teste a busca do robô em tempo real. Os leads capturados serão apenas exibidos na tela, sem salvar no banco de dados e sem enviar mensagens.</p>

          {scraperErro && (
            <div className="alert alert-error" style={{ marginBottom: "20px" }}>
              {scraperErro}
            </div>
          )}

          <form onSubmit={testarScraper} style={{ display: "flex", gap: "15px", alignItems: "flex-end", marginBottom: "25px", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: "250px", margin: 0 }}>
              <label>Termo de Busca (Ex: Pizzarias em Osasco - SP)</label>
              <input 
                type="text" 
                value={queryScraper} 
                onChange={e => setQueryScraper(e.target.value)} 
                placeholder="Digite a busca do Google Maps"
                disabled={scraping}
                required
              />
            </div>
            <div className="form-group" style={{ width: "120px", margin: 0 }}>
              <label>Limite (Máx 10)</label>
              <input 
                type="number" 
                value={limitScraper} 
                onChange={e => setLimitScraper(Math.min(10, Math.max(1, Number(e.target.value))))} 
                min="1" 
                max="10"
                disabled={scraping}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={scraping} style={{ height: "42px", padding: "0 24px" }}>
              {scraping ? "🔍 Buscando..." : "🔍 Iniciar Teste de Captura"}
            </button>
          </form>

          {scraping && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <div className="spinner" style={{ margin: "0 auto 15px auto" }}></div>
              <p>O robô do Playwright está abrindo o Google Maps e extraindo os dados em tempo real...</p>
              <small style={{ color: "var(--text-tertiary)" }}>Isso pode levar entre 30 e 60 segundos.</small>
            </div>
          )}

          {leadsScrapados.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ marginBottom: "12px", color: "var(--primary)" }}>Leads Encontrados no Teste ({leadsScrapados.length})</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Telefone</th>
                      <th>Cidade/UF</th>
                      <th>Endereço</th>
                      <th>Site</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsScrapados.map((l, idx) => (
                      <tr key={idx}>
                        <td><strong>{l.empresa}</strong></td>
                        <td>{l.telefone}</td>
                        <td>{l.cidade} / {l.estado}</td>
                        <td><small>{l.endereco}</small></td>
                        <td>{l.site ? <a href={l.site} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>🌐 Website</a> : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ABA WHATSAPP */}
      {abaAtiva === "whatsapp" && (
        <div className="card">
          <h2>Checar Conexão do WhatsApp</h2>
          <p className="subtitle" style={{ fontSize: "0.85rem", marginTop: "-5px", marginBottom: "20px" }}>Verifique a conexão em tempo real da sessão do WhatsApp Web de qualquer funcionário cadastrado no sistema.</p>

          <div style={{ display: "flex", gap: "15px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "20px" }}>
            <div className="form-group" style={{ minWidth: "250px", margin: 0 }}>
              <label>Escolher Funcionário / Vendedor</label>
              <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                <option value="">Selecione um vendedor</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={verificarStatusWhatsApp} 
              disabled={waChecking || !vendedorId}
              style={{ height: "42px", padding: "0 20px" }}
            >
              {waChecking ? "Consultando..." : "📡 Verificar Conexão"}
            </button>
          </div>

          {waStatus && (
            <div style={{ marginTop: "20px", padding: "20px", background: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "15px" }}>
              <div style={{ fontSize: "2rem" }}>
                {waStatus === "connected" ? "🟢" : waStatus === "disconnected" ? "🔴" : "🟡"}
              </div>
              <div>
                <h4 style={{ margin: "0 0 5px 0" }}>Status da Sessão:</h4>
                <div style={{ textTransform: "uppercase", fontWeight: "800", letterSpacing: "1px", color: waStatus === "connected" ? "var(--success)" : waStatus === "disconnected" ? "#ef4444" : "var(--primary)" }}>
                  {waStatus === "connected" ? "Conectado (Ativo)" : waStatus === "disconnected" ? "Desconectado" : waStatus}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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
  const [novaChavePix, setNovaChavePix] = useState(usuarioLogado.pix || "");
  const [salvandoPix, setSalvandoPix] = useState(false);

  useEffect(() => {
    if (usuarioLogado.link_kiwify) {
      setNovoLinkKiwify(usuarioLogado.link_kiwify);
    }
  }, [usuarioLogado.link_kiwify]);

  useEffect(() => {
    if (usuarioLogado.pix) {
      setNovaChavePix(usuarioLogado.pix);
    }
  }, [usuarioLogado.pix]);

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

  async function salvarChavePix() {
    if (!novaChavePix.trim()) {
      setMensagemErro("Por favor, informe uma chave PIX válida.");
      return;
    }
    setSalvandoPix(true);
    setMensagemSucesso("");
    setMensagemErro("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pix: novaChavePix.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...usuarioLogado, pix: novaChavePix.trim() };
        localStorage.setItem("usuarioLogado", JSON.stringify(updatedUser));
        setUsuarioLogado(updatedUser);
        setMensagemSucesso("Chave PIX cadastrada com sucesso!");
      } else {
        setMensagemErro(data.error || "Erro ao atualizar chave PIX.");
      }
    } catch (e) {
      setMensagemErro("Erro de comunicação com o servidor.");
    } finally {
      setSalvandoPix(false);
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
    const interval = setInterval(carregarStats, 30000);
    return () => clearInterval(interval);
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

        <div className="stat-card info" style={{ borderLeft: "4px solid var(--success)" }}>
          <span className="stat-label" style={{ color: "var(--success)" }}>Cliques no Link</span>
          <span className="stat-number" style={{ color: "var(--success)" }}>{stats.total_cliques || 0} 🖱️</span>
          <span className="stat-desc" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Cliques nos links de vendas enviados por você
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
      {(stats.eh_gerente === 1 || stats.eh_gerente === 2) && (
        <div style={{ marginTop: "24px" }}>
          {/* Link de Convite de Gerente */}
          <div className="card" style={{ background: "linear-gradient(135deg, rgba(217, 119, 6, 0.05) 0%, rgba(251, 191, 36, 0.05) 100%)", border: "1px solid rgba(251, 191, 36, 0.25)" }}>
            <h2 style={{ margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              💼 Meu Link de Indicação (Recrutar Vendedores)
              <span className="badge" style={{ backgroundColor: "rgba(217, 119, 6, 0.15)", color: "var(--primary)", fontSize: "0.8rem", padding: "4px 8px" }}>
                {stats.eh_gerente === 2 ? "Modo Gerente Pro Ativo" : "Modo Gerente Base Ativo"}
              </span>
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "15px" }}>
              Compartilhe o link abaixo para cadastrar vendedores na sua equipe. Toda vez que um indicado fizer uma venda que for aprovada pelo administrador, você ganha <strong>{stats.eh_gerente === 2 ? "R$ 300,00" : "R$ 100,00"}</strong> na hora.
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

          {/* Configuração de PIX do Gerente */}
          <div className="card" style={{ marginTop: "24px", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(52, 211, 153, 0.04) 100%)", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
            <h2 style={{ margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              💸 Minha Chave PIX (Para Recebimento de Comissões)
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "15px" }}>
              Cadastre sua chave PIX para que o administrador possa transferir suas comissões passivas de equipe acumuladas.
            </p>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input 
                type="text" 
                placeholder="Insira sua chave PIX (CPF, Celular, E-mail ou Chave Aleatória)" 
                value={novaChavePix}
                onChange={(e) => setNovaChavePix(e.target.value)}
                style={{ 
                  flexGrow: 1, 
                  padding: "12px", 
                  borderRadius: "8px", 
                  border: "1px solid var(--border-color)", 
                  background: "var(--bg-secondary)", 
                  color: "#fff",
                  fontSize: "0.95rem"
                }}
              />
              <button 
                className="btn btn-primary" 
                style={{ margin: 0, padding: "12px 24px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)" }}
                disabled={salvandoPix}
                onClick={salvarChavePix}
              >
                {salvandoPix ? "Salvando..." : "Salvar Chave PIX"}
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
                Ganhos de comissão passiva ({stats.eh_gerente === 2 ? "R$ 300" : "R$ 100"}/venda)
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
                          {(ind.vendas_aprovadas * (stats.eh_gerente === 2 ? 300 : 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label style={{ margin: 0 }}>Senha de Acesso</label>
            <button 
              type="button" 
              onClick={() => setPagina("recuperar-senha")} 
              style={{ 
                background: "transparent", 
                border: "none", 
                color: "var(--primary)", 
                fontSize: "0.85rem", 
                cursor: "pointer",
                padding: 0,
                margin: 0,
                width: "auto",
                fontWeight: "600",
                textDecoration: "underline"
              }}
            >
              Esqueci minha senha
            </button>
          </div>
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
  
  const [limiteDesejado, setLimiteDesejado] = useState(usuarioLogado.limite_diario || 10);

  useEffect(() => {
    if (usuarioLogado.limite_diario) {
      setLimiteDesejado(usuarioLogado.limite_diario);
    }
  }, [usuarioLogado.limite_diario]);

  async function alterarLimiteDesejado(e) {
    const val = Math.max(1, Number(e.target.value));
    setLimiteDesejado(val);
    
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limite_diario: val })
      });
      if (res.ok) {
        const updatedUser = { ...usuarioLogado, limite_diario: val };
        localStorage.setItem("usuarioLogado", JSON.stringify(updatedUser));
        setUsuarioLogado(updatedUser);
        setStats(s => ({ ...s, limite_diario: val }));
      }
    } catch (err) {
      console.error("Erro ao salvar limite diário:", err);
    }
  }
  
  // Pre-sale Modal State
  const [modalLead, setModalLead] = useState(null);
  const [obsPreVenda, setObsPreVenda] = useState("");





  // Lote/batch dispatch states
  const [loteStatus, setLoteStatus] = useState("idle"); // 'idle', 'sending', 'paused', 'completed'
  const [loteIndex, setLoteIndex] = useState(0);
  const [loteIntervalo, setLoteIntervalo] = useState(30); // in seconds
  const [tempoRestante, setTempoRestante] = useState(0);
  const [loteLog, setLoteLog] = useState("");
  const [modeloSelecionado, setModeloSelecionado] = useState("aleatorio");
  const [modelosPrimarios, setModelosPrimarios] = useState([]);
  const [loadingDisparo, setLoadingDisparo] = useState({});

  async function carregarModelosPrimarios() {
    try {
      const res = await fetch(`${API_URL}/mensagens?vendedorId=${usuarioLogado.id}&tipo=primaria`);
      const data = await res.json();
      if (data.ok) {
        setModelosPrimarios((data.mensagens || []).filter(m => m.ativa === 1));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function devolverLeads() {
    if (!window.confirm("Deseja realmente devolver todos os leads não enviados (Reservados) de volta ao banco de leads?")) return;
    setErro("");
    setSucesso("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}/devolver-leads`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSucesso(data.message);
        carregarLeads();
        carregarStats();
      } else {
        setErro(data.error || "Erro ao devolver leads.");
      }
    } catch (e) {
      setErro("Erro de rede ao devolver leads.");
    }
  }

  async function dispararLeadIndividual(leadId) {
    setLoadingDisparo(prev => ({ ...prev, [leadId]: true }));
    setErro("");
    setSucesso("");
    try {
      const res = await fetch(`${API_URL}/whatsapp/disparar-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendedorId: usuarioLogado.id,
          leadId,
          mensagemId: modeloSelecionado
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSucesso("Mensagem enviada com sucesso!");
        carregarLeads();
        carregarStats();
      } else {
        setErro(data.error || "Erro ao disparar.");
      }
    } catch (e) {
      setErro("Falha ao se conectar com o servidor.");
    } finally {
      setLoadingDisparo(prev => ({ ...prev, [leadId]: false }));
    }
  }

  function iniciarLote() {
    if (whatsappStatus !== "connected") {
      setErro("WhatsApp precisa estar conectado para iniciar os disparos.");
      return;
    }
    setLoteIndex(0);
    setTempoRestante(0);
    setLoteStatus("sending");
    setLoteLog("Iniciando disparos em lote...");
  }

  function pausarLote() {
    setLoteStatus("paused");
    setLoteLog("Disparos em lote pausados pelo usuário.");
  }

  function retomarLote() {
    setTempoRestante(0);
    setLoteStatus("sending");
    setLoteLog("Retomando disparos em lote...");
  }

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
    carregarModelosPrimarios();
    
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

  // Lote dispatch runner loop
  useEffect(() => {
    let timer;
    if (loteStatus === "sending") {
      const leadsPendentes = leads.filter(l => l.status === "reservado");
      
      if (leadsPendentes.length === 0) {
        setLoteStatus("completed");
        setLoteLog("Todos os leads da lista receberam mensagens!");
        return;
      }

      if (loteIndex >= leadsPendentes.length) {
        setLoteStatus("completed");
        setLoteLog("Disparo em lote finalizado!");
        return;
      }

      if (tempoRestante <= 0) {
        const leadAtual = leadsPendentes[loteIndex];
        
        const executarDisparo = async () => {
          setLoteLog(`Disparando para ${leadAtual.empresa}...`);
          try {
            const res = await fetch(`${API_URL}/whatsapp/disparar-lead`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vendedorId: usuarioLogado.id,
                leadId: leadAtual.id,
                mensagemId: modeloSelecionado
              })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
              setLoteLog(`Mensagem enviada com sucesso para ${leadAtual.empresa}!`);
              carregarLeads();
              carregarStats();
              setLoteIndex(prev => prev + 1);
              setTempoRestante(loteIntervalo);
            } else {
              setLoteLog(`Erro ao disparar para ${leadAtual.empresa}: ${data.error || 'Erro desconhecido'}`);
              setLoteIndex(prev => prev + 1);
              setTempoRestante(loteIntervalo);
            }
          } catch (err) {
            setLoteLog(`Erro de rede ao disparar para ${leadAtual.empresa}.`);
            setLoteStatus("paused");
          }
        };

        executarDisparo();
      } else {
        timer = setTimeout(() => {
          setTempoRestante(prev => prev - 1);
        }, 1000);
      }
    }
    return () => clearTimeout(timer);
  }, [loteStatus, loteIndex, tempoRestante, leads, loteIntervalo, modeloSelecionado]);

  async function dispararMensagensAutomaticas() {
    setErro("");
    setSucesso("");
    
    if (whatsappStatus !== "connected") {
      setErro("Seu WhatsApp não está conectado. Acesse o menu 'Conectar WhatsApp' antes de disparar.");
      return;
    }

    try {
      // O servidor vai raspar os leads em tempo real e disparar mensagem para cada um.
      // Não é mais necessário coletar leads manualmente antes.
      const res = await fetch(`${API_URL}/whatsapp/disparar/${usuarioLogado.id}`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();

      if (res.ok) {
        setSucesso(data.message);
        setIsSending(true);
        // Recarregar leads depois de um tempo para refletir os novos
        setTimeout(() => {
          carregarLeads();
          carregarStats();
        }, 5000);
      } else {
        setErro(data.error);
      }
    } catch (e) {
      setErro("Falha de conexão com o servidor.");
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
  const temVendasIniciadas = leads.length > 0;

  // Show all leads (pending ones are in 'reservado')
  const leadsVisiveis = leads;
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



  return (
    <section>
      <h1>Minha Carteira de Leads</h1>
      <p className="subtitle">Gerencie contatos, dispare mensagens automatizadas via WhatsApp Web e qualifique suas negociações.</p>

      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success">{sucesso}</div>}

      {/* Aviso de Limite Diário e Risco de Bloqueio se for maior que 10 */}
      {limiteDesejado > 10 && (
        <div className="card" style={{ 
          background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)", 
          border: "1px solid rgba(245, 158, 11, 0.3)", 
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 8px 32px rgba(245, 158, 11, 0.05)",
          textAlign: "left"
        }}>
          <h3 style={{ color: "#d97706", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px 0", fontSize: "1.15rem", fontWeight: "700" }}>
            ⚠️ Atenção: Alto Risco de Bloqueio no WhatsApp
          </h3>
          <p style={{ fontSize: "0.95rem", color: "var(--text-primary)", lineHeight: "1.6", margin: 0 }}>
            Você configurou o robô para enviar <strong>{limiteDesejado} leads por dia</strong>. 
            Como este valor é superior a 10, o WhatsApp pode perceber um padrão de envio em massa e bloquear ou banir o seu número. 
            Recomendamos fortemente manter a <strong>sugestão de 10 leads por dia</strong> para sua segurança.
          </p>
        </div>
      )}

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
          <div className="form-group" style={{ minWidth: "180px", margin: 0 }}>
            <label style={{ fontSize: "0.8rem", marginBottom: "4px", display: "block" }}>Filtrar Status</label>
            <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={{ margin: 0 }}>
              <option value="">Todos os status</option>
              {statusUnicos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: "0.8rem", marginBottom: "4px", display: "block" }}>Disparos Diários do Robô</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input 
                type="number" 
                min="1" 
                max="500" 
                value={limiteDesejado} 
                onChange={alterarLimiteDesejado}
                style={{ width: "70px", padding: "8px", margin: 0, textAlign: "center" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>leads/dia</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Conexão WhatsApp: <strong style={{ color: whatsappStatus === "connected" ? "var(--success)" : "var(--danger)" }}>
              {whatsappStatus === "connected" ? "🟢 Conectado" : "🔴 Desconectado"}
            </strong>
          </span>

          <button 
            className="btn btn-primary" 
            onClick={coletarLeads} 
            disabled={loteStatus === "sending"}
          >
            📥 Capturar 25 Leads
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={devolverLeads} 
            disabled={loteStatus === "sending" || leads.filter(l => l.status === "reservado").length === 0}
          >
            🔄 Devolver Leads
          </button>
        </div>
      </div>

      {leads.filter(l => l.status === "reservado").length > 0 && (
        <div className="card" style={{ 
          marginBottom: "24px", 
          borderLeft: loteStatus === "sending" ? "4px solid #f59e0b" : "4px solid var(--border-color)",
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
          padding: "24px"
        }}>
          <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px", color: "white" }}>
            ⚡ Painel de Disparo em Lote
            {loteStatus === "sending" && <span className="badge badge-warning pulse" style={{ background: "#f59e0b", color: "black", borderRadius: "4px" }}>Enviando...</span>}
          </h3>

          <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
            <div className="form-group" style={{ margin: 0, minWidth: "150px" }}>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px", display: "block" }}>Intervalo entre envios</label>
              <select 
                value={loteIntervalo} 
                onChange={e => setLoteIntervalo(Number(e.target.value))}
                disabled={loteStatus === "sending"}
                style={{ margin: 0, background: "#1e293b", color: "white", border: "1px solid #475569" }}
              >
                <option value={10}>10 segundos (teste)</option>
                <option value={15}>15 segundos (teste rápido)</option>
                <option value={30}>30 segundos</option>
                <option value={60}>1 minuto</option>
                <option value={120}>2 minutos</option>
                <option value={300}>5 minutos</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0, minWidth: "220px", flex: 1 }}>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px", display: "block" }}>Modelo de Mensagem Primária</label>
              <select 
                value={modeloSelecionado} 
                onChange={e => setModeloSelecionado(e.target.value)}
                disabled={loteStatus === "sending"}
                style={{ margin: 0, background: "#1e293b", color: "white", border: "1px solid #475569" }}
              >
                <option value="aleatorio">Aleatório (Mensagens ativas)</option>
                {modelosPrimarios.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              {loteStatus === "sending" ? (
                <button className="btn btn-danger" onClick={pausarLote} style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}>
                  ⏸️ Pausar Lote
                </button>
              ) : loteStatus === "paused" ? (
                <button className="btn btn-success" onClick={retomarLote} style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px", background: "#10b981", borderColor: "#10b981" }}>
                  ▶️ Retomar Lote
                </button>
              ) : (
                <button className="btn btn-primary" onClick={iniciarLote} disabled={whatsappStatus !== "connected"} style={{ height: "42px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🚀 Iniciar Lote
                </button>
              )}
            </div>
          </div>

          {/* Lote Progress Info */}
          {loteStatus !== "idle" && (
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: "8px", border: "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#cbd5e1", marginBottom: "8px" }}>
                <span>
                  Progresso: <strong>{loteIndex}</strong> de <strong>{leads.filter(l => l.status === "reservado").length + loteIndex}</strong> leads
                </span>
                {loteStatus === "sending" && (
                  <span style={{ color: "#f59e0b" }}>
                    Próximo envio em: <strong>{tempoRestante}s</strong>
                  </span>
                )}
              </div>
              <div style={{ 
                width: "100%", 
                height: "6px", 
                background: "#1e293b", 
                borderRadius: "3px", 
                overflow: "hidden",
                marginBottom: "12px"
              }}>
                <div style={{ 
                  height: "100%", 
                  background: "#f59e0b", 
                  width: `${((loteIndex) / (leads.filter(l => l.status === "reservado").length + loteIndex)) * 100}%`,
                  transition: "width 0.4s ease"
                }} />
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#38bdf8" }}>
                📢 Status: {loteLog}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Registro de Envios Recentes */}
      <div className="card" style={{ marginBottom: "20px", borderLeft: loteStatus === "sending" ? "4px solid #f59e0b" : "4px solid var(--border-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            📤 Registro de Envios Recentes
            {loteStatus === "sending" && <span className="badge badge-warning pulse" style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", background: "#f59e0b", color: "black" }}>⚡ Disparando</span>}
          </h3>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {loteStatus === "sending" ? "Disparador em lote ativo..." : "Disparador em lote inativo"}
          </span>
        </div>
        
        {leadsEnviados.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.9rem", margin: "10px 0 0 0" }}>
            {loteStatus === "sending" ? "🤖 O disparador em lote está ativo. Aguarde o envio das mensagens." : "Nenhuma mensagem enviada hoje. Use o painel de lote ou envie individualmente."}
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
                <th>Cliques</th>
                <th>Última Mensagem</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "30px", color: "var(--text-secondary)" }}>
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
                      <span className="badge" style={{ background: l.cliques_link > 0 ? "var(--success)" : "rgba(255,255,255,0.05)", color: l.cliques_link > 0 ? "black" : "var(--text-secondary)" }}>
                        {l.cliques_link || 0} 🖱️
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
                        
                        {l.status === "reservado" && (
                          <button 
                            className="btn btn-warning" 
                            style={{ padding: "6px 12px", fontSize: "0.85rem", background: "#f59e0b", color: "#000", border: "1px solid #f59e0b", fontWeight: "600" }} 
                            onClick={() => dispararLeadIndividual(l.id)}
                            disabled={loadingDisparo[l.id] || whatsappStatus !== "connected"}
                          >
                            {loadingDisparo[l.id] ? "⏳ Enviando..." : "⚡ Disparar"}
                          </button>
                        )}

                        {l.status !== "Pré-venda feita" && l.status !== "Comprou" && (
                          <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => setModalLead(l)}>
                            💰 Pré-Venda
                          </button>
                        )}
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

// 10. SELLER CUSTOM MESSAGES MANAGEMENT
function VendedorMensagens({ usuarioLogado }) {
  const [abaAtiva, setAbaAtiva] = useState("prospeccao"); // 'prospeccao', 'secundaria', 'auto-reply'
  const [mensagens, setMensagens] = useState([]);
  const [form, setForm] = useState({ nome: "", texto: "", condicao_site: "qualquer" });
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Auto-reply state
  const [msgRobo, setMsgRobo] = useState("");
  const [msgHumano, setMsgHumano] = useState("");
  const [autoReplySucesso, setAutoReplySucesso] = useState("");
  const [autoReplyErro, setAutoReplyErro] = useState("");

  async function carregarDados() {
    setErro("");
    setSucesso("");
    setAutoReplyErro("");
    setAutoReplySucesso("");
    try {
      if (abaAtiva === "auto-reply") {
        const res = await fetch(`${API_URL}/vendedores/fila/${usuarioLogado.id}`);
        const data = await res.json();
        if (data.ok && data.vendedor) {
          setMsgRobo(data.vendedor.mensagem_resposta_robo || "");
          setMsgHumano(data.vendedor.mensagem_resposta_humano || "");
        }
        return;
      }

      const tipo = abaAtiva === "prospeccao" ? "primaria" : "secundaria";
      const res = await fetch(`${API_URL}/mensagens?vendedorId=${usuarioLogado.id}&tipo=${tipo}`);
      const data = await res.json();
      if (data.ok) {
        setMensagens(data.mensagens || []);
      }
    } catch (e) {
      console.error(e);
      setErro("Erro de comunicação com o servidor.");
    }
  }

  useEffect(() => {
    carregarDados();
  }, [abaAtiva]);

  async function salvarAutoReply(e) {
    e.preventDefault();
    setAutoReplyErro("");
    setAutoReplySucesso("");
    try {
      const res = await fetch(`${API_URL}/vendedores/${usuarioLogado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem_resposta_robo: msgRobo, mensagem_resposta_humano: msgHumano })
      });
      const data = await res.json();
      if (res.ok) {
        setAutoReplySucesso("Mensagens de resposta automática salvas com sucesso!");
        const saved = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");
        saved.mensagem_resposta_robo = msgRobo;
        saved.mensagem_resposta_humano = msgHumano;
        localStorage.setItem("usuarioLogado", JSON.stringify(saved));
      } else {
        setAutoReplyErro(data.error || "Erro ao salvar.");
      }
    } catch (e) {
      setAutoReplyErro("Erro de comunicação com o servidor.");
    }
  }

  async function salvarMensagem(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    
    if (!form.nome || !form.texto) {
      setErro("Nome e Texto do modelo são obrigatórios.");
      return;
    }

    const payload = {
      ...form,
      tipo: abaAtiva === "prospeccao" ? "primaria" : "secundaria",
      vendedor_id: usuarioLogado.id
    };

    try {
      let res;
      if (editingId) {
        res = await fetch(`${API_URL}/mensagens/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/mensagens`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && data.ok) {
        setSucesso(editingId ? "Modelo atualizado com sucesso!" : "Modelo criado com sucesso!");
        setForm({ nome: "", texto: "", condicao_site: "qualquer" });
        setEditingId(null);
        carregarDados();
      } else {
        setErro(data.error || "Erro ao salvar o modelo.");
      }
    } catch (e) {
      setErro("Erro de comunicação com o servidor.");
    }
  }

  function iniciarEdicao(m) {
    setEditingId(m.id);
    setForm({
      nome: m.nome,
      texto: m.texto,
      condicao_site: m.condicao_site || "qualquer"
    });
  }

  async function deletarMensagem(id) {
    if (!window.confirm("Deseja realmente excluir este modelo de mensagem?")) return;
    setErro("");
    setSucesso("");
    try {
      const res = await fetch(`${API_URL}/mensagens/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSucesso("Modelo excluído com sucesso!");
        carregarDados();
      } else {
        setErro(data.error || "Erro ao excluir.");
      }
    } catch (e) {
      setErro("Erro de comunicação com o servidor.");
    }
  }

  async function alternarStatusMensagem(id) {
    try {
      const res = await fetch(`${API_URL}/mensagens/${id}/ativar`, {
        method: "PUT"
      });
      if (res.ok) {
        carregarDados();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section>
      <h1>Modelos de Mensagem Customizados</h1>
      <p className="subtitle">Crie e gerencie suas mensagens de abordagem, acompanhamento e respostas automáticas para o robô.</p>

      <div className="tab-container" style={{ marginBottom: "24px" }}>
        <button 
          className={`tab-btn ${abaAtiva === "prospeccao" ? "active" : ""}`} 
          onClick={() => setAbaAtiva("prospeccao")}
        >
          Abordagem Primária (Prospecção)
        </button>
        <button 
          className={`tab-btn ${abaAtiva === "secundaria" ? "active" : ""}`} 
          onClick={() => setAbaAtiva("secundaria")}
        >
          Acompanhamento Secundário (5 Minutos)
        </button>
        <button 
          className={`tab-btn ${abaAtiva === "auto-reply" ? "active" : ""}`} 
          onClick={() => setAbaAtiva("auto-reply")}
        >
          Auto-Respostas (Robô vs Humano)
        </button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}
      {sucesso && <div className="alert alert-success">{sucesso}</div>}

      {abaAtiva !== "auto-reply" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
          <div className="card" style={{ margin: 0 }}>
            <h3>{editingId ? "📝 Editar Modelo" : "✨ Criar Novo Modelo"}</h3>
            <form onSubmit={salvarMensagem} style={{ marginTop: "16px" }}>
              <div className="form-group">
                <label>Nome identificador (ex: Abordagem Pizza)</label>
                <input 
                  type="text" 
                  value={form.nome} 
                  onChange={e => setForm({ ...form, nome: e.target.value })} 
                  placeholder="Nome identificador"
                  required
                />
              </div>

              {abaAtiva === "secundaria" && (
                <div className="form-group">
                  <label>Condição de Site</label>
                  <select 
                    value={form.condicao_site} 
                    onChange={e => setForm({ ...form, condicao_site: e.target.value })}
                  >
                    <option value="qualquer">Sempre enviar (Independe se tem site ou não)</option>
                    <option value="com_site">Enviar apenas se o Lead POSSUI website cadastrado</option>
                    <option value="sem_site">Enviar apenas se o Lead NÃO possui website cadastrado</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Texto da Mensagem</label>
                <textarea 
                  value={form.texto} 
                  onChange={e => setForm({ ...form, texto: e.target.value })} 
                  rows="8" 
                  placeholder="Texto da mensagem..."
                  required
                />
                <small style={{ color: "var(--text-tertiary)", marginTop: "6px", display: "block" }}>
                  Variáveis permitidas: <strong>{"{saudacao}"}</strong> (Bom dia / Boa tarde / Boa noite), <strong>{"{empresa}"}</strong> (Nome do estabelecimento) e <strong>{"{nicho}"}</strong> (ex: pizzaria).
                </small>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Salvar Alterações" : "Salvar Modelo"}
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setEditingId(null);
                      setForm({ nome: "", texto: "", condicao_site: "qualquer" });
                    }}
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Lista de Modelos ({mensagens.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              {mensagens.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "20px" }}>
                  Nenhum modelo customizado cadastrado. O sistema usará as mensagens globais do admin como padrão.
                </p>
              ) : (
                mensagens.map(m => (
                  <div 
                    key={m.id} 
                    style={{ 
                      padding: "16px", 
                      background: "var(--bg-secondary)", 
                      borderRadius: "10px", 
                      border: "1px solid var(--border-color)",
                      position: "relative"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "1.05rem" }}>{m.nome}</strong>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                        {m.vendedor_id ? "👤 Customizado" : "🌐 Padrão Geral"}
                      </span>
                    </div>

                    {abaAtiva === "secundaria" && (
                      <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginBottom: "8px" }}>
                        Condição: {m.condicao_site === "com_site" ? "Apenas com site" : m.condicao_site === "sem_site" ? "Apenas sem site" : "Qualquer"}
                      </div>
                    )}

                    <p style={{ 
                      fontSize: "0.9rem", 
                      whiteSpace: "pre-wrap", 
                      background: "rgba(0,0,0,0.1)", 
                      padding: "12px", 
                      borderRadius: "6px",
                      margin: "0 0 16px 0",
                      maxHeight: "150px",
                      overflowY: "auto",
                      color: "var(--text-secondary)"
                    }}>
                      {m.texto}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        {m.vendedor_id && (
                          <button 
                            className={`btn ${m.ativa ? "btn-success" : "btn-secondary"}`} 
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            onClick={() => alternarStatusMensagem(m.id)}
                          >
                            {m.ativa ? "🟢 Ativa" : "🔴 Inativa"}
                          </button>
                        )}
                        {!m.vendedor_id && (
                          <span className="badge badge-success" style={{ background: "var(--primary)", color: "white" }}>Ativo Geral</span>
                        )}
                      </div>
                      
                      {m.vendedor_id && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            onClick={() => iniciarEdicao(m)}
                          >
                            ✏️ Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: "6px 12px", fontSize: "0.8rem", background: "#f44336" }}
                            onClick={() => deletarMensagem(m.id)}
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h3>Auto-Respostas (Robô vs Humano)</h3>
          <p className="subtitle" style={{ marginBottom: "20px" }}>
            Configure as respostas automáticas disparadas pelo monitor quando o cliente responder. O robô classifica se a resposta veio de um robô automático do cliente ou de um humano de verdade.
          </p>

          {autoReplyErro && <div className="alert alert-error">{autoReplyErro}</div>}
          {autoReplySucesso && <div className="alert alert-success">{autoReplySucesso}</div>}

          <form onSubmit={salvarAutoReply}>
            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>🤖 Resposta quando detectado ROBÔ do cliente</label>
              <textarea 
                value={msgRobo} 
                onChange={e => setMsgRobo(e.target.value)} 
                rows="5" 
                placeholder="Ex: Obrigado pelo retorno! Percebi que vocês têm um atendimento automático..."
                required
              />
              <small style={{ color: "var(--text-tertiary)" }}>
                Enviada imediatamente quando detectado que a resposta do lead é uma auto-resposta de bot de atendimento.
              </small>
            </div>

            <div className="form-group" style={{ marginBottom: "24px" }}>
              <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>👤 Resposta quando detectado HUMANO (Responsável)</label>
              <textarea 
                value={msgHumano} 
                onChange={e => setMsgHumano(e.target.value)} 
                rows="5" 
                placeholder="Ex: Olá! Que ótimo que você viu nossa mensagem! 😊 Tenho uma proposta especial..."
                required
              />
              <small style={{ color: "var(--text-tertiary)" }}>
                Enviada quando a resposta do lead parece ser de um humano. Permite usar a variável <strong>{"{link_kiwify}"}</strong> (Seu link de afiliado) e <strong>{"{empresa}"}</strong>.
              </small>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "12px" }}>
              💾 Salvar Respostas Automáticas
            </button>
          </form>
        </div>
      )}
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
          nome: form.nome.toUpperCase().trim(),
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
          <input name="nome" type="text" value={form.nome} onChange={alterarCampo} required placeholder="Ex: João da Silva" />
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

function ChatDrawer({ lead, vendedorId, onClose, onMessageSent, readOnly = false }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [templates, setTemplates] = useState([]);
  const messagesContainerRef = useRef(null);

  const isOpen = !!lead;

  useEffect(() => {
    if (!lead || readOnly) {
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
    if (readOnly) return;
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

        {!readOnly && templates.length > 0 && (
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

        {!readOnly && (
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
        )}
      </div>
    </>
  );
}

// 22. PASSWORD RECOVERY COMPONENT
function RecuperarSenha({ setPagina, urlToken, setUrlToken }) {
  const [step, setStep] = useState(urlToken ? 2 : 1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [token, setToken] = useState(urlToken || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [devInfo, setDevInfo] = useState("");

  useEffect(() => {
    if (urlToken) {
      setStep(2);
      setToken(urlToken);
    }
  }, [urlToken]);

  async function solicitarRecuperacao(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setDevInfo("");
    setCarregando(true);

    try {
      const res = await fetch(`${API_URL}/recuperar-senha/solicitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao solicitar recuperação.");
        setCarregando(false);
        return;
      }

      setSucesso(data.message);
      if (data.token) {
        setToken(data.token);
      }
      
      if (data.simulated && data.codigo) {
        setDevInfo(`[MODO DE TESTES] Código gerado no servidor: ${data.codigo}`);
        setCodigo(data.codigo);
      }

      setStep(2);
    } catch (err) {
      setErro("Erro ao comunicar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  async function resetarSenha(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setCarregando(true);

    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      setCarregando(false);
      return;
    }

    if (novaSenha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      setCarregando(false);
      return;
    }

    try {
      const payload = { novaSenha };
      if (token) {
        payload.token = token;
      } else {
        payload.codigo = codigo;
        payload.email = email;
      }

      const res = await fetch(`${API_URL}/recuperar-senha/resetar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao redefinir a senha.");
        setCarregando(false);
        return;
      }

      setSucesso("Senha redefinida com sucesso! Redirecionando para o login...");
      setUrlToken("");
      setTimeout(() => {
        setPagina("login");
      }, 3000);
    } catch (err) {
      setErro("Erro ao comunicar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  function voltar() {
    setUrlToken("");
    setPagina("login");
  }

  return (
    <div className="login-container">
      <div className="card login-card" style={{ maxWidth: "450px", width: "100%" }}>
        <h2>Recuperação de Senha</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
          {step === 1 
            ? "Informe seu e-mail cadastrado para enviarmos as instruções." 
            : "Preencha a nova senha de acesso."
          }
        </p>

        {erro && <div className="alert alert-error" style={{ padding: "10px", fontSize: "0.85rem", marginBottom: "15px" }}>{erro}</div>}
        {sucesso && <div className="alert alert-success" style={{ padding: "10px", fontSize: "0.85rem", marginBottom: "15px" }}>{sucesso}</div>}
        {devInfo && <div className="alert alert-info" style={{ padding: "10px", fontSize: "0.85rem", marginBottom: "15px", background: "rgba(251, 191, 36, 0.1)", border: "1px dashed var(--primary)", color: "var(--primary)" }}>{devInfo}</div>}

        {step === 1 ? (
          <form onSubmit={solicitarRecuperacao}>
            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label>Endereço de E-mail</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="vendedor@email.com" 
                disabled={carregando}
              />
            </div>

            <button className="btn btn-primary" style={{ width: "100%" }} type="submit" disabled={carregando}>
              {carregando ? "Enviando..." : "Enviar Código de Recuperação"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetarSenha}>
            {!token && (
              <>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label>E-mail Confirmado</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    placeholder="vendedor@email.com" 
                    disabled={!!email || carregando}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label>Código de 6 dígitos enviado por e-mail</label>
                  <input 
                    type="text" 
                    maxLength="6"
                    value={codigo} 
                    onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))} 
                    required 
                    placeholder="Ex: 123456" 
                    disabled={carregando}
                    style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "4px", fontWeight: "bold" }}
                  />
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: "15px" }}>
              <label>Nova Senha de Acesso</label>
              <input 
                type="password" 
                value={novaSenha} 
                onChange={e => setNovaSenha(e.target.value)} 
                required 
                placeholder="No mínimo 6 caracteres" 
                disabled={carregando}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "20px" }}>
              <label>Confirmar Nova Senha</label>
              <input 
                type="password" 
                value={confirmarSenha} 
                onChange={e => setConfirmarSenha(e.target.value)} 
                required 
                placeholder="Repita a nova senha" 
                disabled={carregando}
              />
            </div>

            <button className="btn btn-primary" style={{ width: "100%" }} type="submit" disabled={carregando}>
              {carregando ? "Processando..." : "Redefinir Minha Senha"}
            </button>
          </form>
        )}

        <button 
          className="btn btn-secondary" 
          style={{ width: "100%", marginTop: "10px" }} 
          type="button" 
          onClick={voltar}
          disabled={carregando}
        >
          Voltar ao Login
        </button>
      </div>
    </div>
  );
}

