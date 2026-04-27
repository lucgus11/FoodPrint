import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-layout">
      <div className="page-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (p) => (p === '/' ? path === '/' : path.startsWith(p));

  return (
    <nav className="bottom-nav">
      <NavItem icon="🏠" label="Accueil" to="/" active={isActive('/')} onClick={() => navigate('/')} />
      <NavItem icon="🍽" label="Restos" to="/restaurants" active={isActive('/restaurants')} onClick={() => navigate('/restaurants')} />

      <button className="nav-item scanner-btn" onClick={() => navigate('/scanner')} aria-label="Scanner un plat">
        <div className="scanner-fab">
          <ScanIcon />
        </div>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Scanner</span>
      </button>

      <NavItem icon="🔍" label="Chercher" to="/search" active={isActive('/search')} onClick={() => navigate('/search')} />
      <NavItem icon="📊" label="Stats" to="/stats" active={isActive('/stats')} onClick={() => navigate('/stats')} />
    </nav>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} aria-label={label}>
      <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ScanIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}
