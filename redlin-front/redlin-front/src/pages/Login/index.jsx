import React, { useState, useEffect, useRef } from 'react';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const networkRef = useRef(null);

  // Prefill remembered user
  useEffect(() => {
    const remembered = localStorage.getItem('rememberUser');
    if (remembered) {
      setIdentifier(remembered);
      setRemember(true);
    }
  }, []);

  const togglePassword = () => setShowPassword(p => !p);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await authService.login(identifier, password);
      login(userData);
      if (remember) localStorage.setItem('rememberUser', identifier); else localStorage.removeItem('rememberUser');
      navigate('/home');
    } catch (err) {
      setError(err?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Build animated neural network (simplified)
  useEffect(() => {
    const container = networkRef.current;
    if (!container) return;
    container.innerHTML = '';
    const nodeCount = 20;
    const connectionCount = 30;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const node = document.createElement('div');
      node.className = 'node';
      node.style.left = `${Math.random() * 100}%`;
      node.style.top = `${Math.random() * 100}%`;
      container.appendChild(node);
      nodes.push(node);
    }
    for (let i = 0; i < connectionCount; i++) {
      const start = nodes[Math.floor(Math.random() * nodes.length)];
      const end = nodes[Math.floor(Math.random() * nodes.length)];
      const rectA = start.getBoundingClientRect();
      const rectB = end.getBoundingClientRect();
      const conn = document.createElement('div');
      conn.className = 'connection';
      const startX = start.offsetLeft + 4;
      const startY = start.offsetTop + 4;
      const endX = end.offsetLeft + 4;
      const endY = end.offsetTop + 4;
      const length = Math.hypot(endX - startX, endY - startY);
      const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
      conn.style.width = length + 'px';
      conn.style.left = startX + 'px';
      conn.style.top = startY + 'px';
      conn.style.transform = `rotate(${angle}deg)`;
      container.appendChild(conn);
    }
  }, []);

  return (
    <div className="login-page-root">
      <div className="left-section">
        <div className="bg-pattern" />
        <div className="neural-network" ref={networkRef} />
        <div className="left-content">
          <div className="illustration">
            <svg width="500" height="300" viewBox="0 0 500 300" role="img" aria-label="Brain network illustration">
              <path d="M250,50 C350,50 400,150 400,200 C400,250 350,280 300,280 C270,280 260,260 250,260 C240,260 230,280 200,280 C150,280 100,250 100,200 C100,150 150,50 250,50" fill="none" stroke="#4A90E2" strokeWidth="2" />
              <circle cx="150" cy="120" r="10" fill="#20C997" />
              <circle cx="200" cy="80" r="10" fill="#20C997" />
              <circle cx="250" cy="100" r="10" fill="#20C997" />
              <circle cx="300" cy="90" r="10" fill="#20C997" />
              <circle cx="350" cy="130" r="10" fill="#20C997" />
              <circle cx="180" cy="170" r="10" fill="#4A90E2" />
              <circle cx="250" cy="160" r="10" fill="#4A90E2" />
              <circle cx="320" cy="180" r="10" fill="#4A90E2" />
              <circle cx="220" cy="230" r="10" fill="#FFFFFF" />
              <circle cx="280" cy="240" r="10" fill="#FFFFFF" />
            </svg>
          </div>
          <h1 className="platform-tagline">AI-Powered Learning Platform</h1>
          <p className="platform-description">Unlock your potential with our advanced AI learning system. Personalized education paths, real-time feedback, and adaptive learning technology to accelerate your growth.</p>
        </div>
      </div>
      <div className="right-section">
        <div className="login-form-container">
          <div className="logo-container">
            <div className="logo"><i className="ri-brain-line" /></div>
            <div className="platform-name">Redlin</div>
          </div>
          <h3 className="login-title">Login</h3>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form onSubmit={handleLogin} autoComplete="on">
            <div className="form-group">
              <label htmlFor="identifier">Username</label>
              <div className="input-with-icon no-left-icon">
                <input
                  id="identifier"
                  type="text"
                  placeholder="Enter your username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon no-left-icon">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={togglePassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                </button>
              </div>
            </div>
            <div className="remember-forgot">
              <div className="remember-me">
                <input id="remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                <label htmlFor="remember">Remember me</label>
              </div>
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>
            <button type="submit" className="login-button" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
            <div className="signup-link">
              <span>Don't have an account? </span>
              <Link to="/register">Sign up</Link>
            </div>
            <div className="divider">
              <span className="divider-text">or continue with</span>
            </div>
            <div className="social-buttons">
              <button type="button" className="social-btn google-btn" aria-label="Continue with Google"><i className="ri-google-fill" /></button>
              <button type="button" className="social-btn facebook-btn" aria-label="Continue with Facebook"><i className="ri-facebook-fill" /></button>
              <button type="button" className="social-btn apple-btn" aria-label="Continue with Apple"><i className="ri-apple-fill" /></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;