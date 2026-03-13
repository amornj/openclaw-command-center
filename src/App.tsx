import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import OrgChart from './pages/OrgChart';
import CronTracker from './pages/CronTracker';
import Usage from './pages/Usage';
import Projects from './pages/Projects';
import Monitor from './pages/Monitor';
import './App.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const closeSidebarOnMobile = () => {
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <BrowserRouter>
      <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <nav className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="logo">
            <span className="logo-icon">🐾</span>
            <div className="logo-text">
              <h1>OpenClaw</h1>
              <span className="logo-sub">Command Center</span>
            </div>
          </div>
          <div className="nav-links">
            <NavLink to="/" end onClick={closeSidebarOnMobile}>
              <span className="nav-icon">📊</span>
              <span className="nav-label">Org Chart</span>
            </NavLink>
            <NavLink to="/cron" onClick={closeSidebarOnMobile}>
              <span className="nav-icon">⏱</span>
              <span className="nav-label">Cron Tracker</span>
            </NavLink>
            <NavLink to="/usage" onClick={closeSidebarOnMobile}>
              <span className="nav-icon">📈</span>
              <span className="nav-label">Usage</span>
            </NavLink>
            <NavLink to="/projects" onClick={closeSidebarOnMobile}>
              <span className="nav-icon">📁</span>
              <span className="nav-label">Projects</span>
            </NavLink>
            <NavLink to="/monitor" onClick={closeSidebarOnMobile}>
              <span className="nav-icon">📡</span>
              <span className="nav-label">Monitor</span>
            </NavLink>
          </div>
          <div className="nav-footer">
            <span>v1.7.0</span>
          </div>
        </nav>

        <main className="content">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <Routes>
            <Route path="/" element={<OrgChart />} />
            <Route path="/calendar" element={<Navigate to="/cron" replace />} />
            <Route path="/cron" element={<CronTracker />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/monitor" element={<Monitor />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
