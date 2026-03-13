import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import OrgChart from './pages/OrgChart';
import Calendar from './pages/Calendar';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <div className="logo">
            <span className="logo-icon">🐾</span>
            <div>
              <h1>OpenClaw</h1>
              <span className="logo-sub">Command Center</span>
            </div>
          </div>
          <div className="nav-links">
            <NavLink to="/" end>
              <span className="nav-icon">📊</span>
              Org Chart
            </NavLink>
            <NavLink to="/calendar">
              <span className="nav-icon">📅</span>
              Calendar
            </NavLink>
          </div>
          <div className="nav-footer">
            <span>v1.0.0</span>
          </div>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<OrgChart />} />
            <Route path="/calendar" element={<Calendar />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
