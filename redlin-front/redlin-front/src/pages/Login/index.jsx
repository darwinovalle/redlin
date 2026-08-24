import React, { useState, useEffect, useRef } from 'react';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useNeuralNetworkAnimation } from '../../hooks/useNeuralNetworkAnimation';
import dinoRedlin from '../../assets/redlin_logo/dino_redlin.png';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TimerOffIcon from '@mui/icons-material/TimerOff';
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
  const [sessionExpired, setSessionExpired] = useState(false);
  const networkRef = useRef(null);

  useNeuralNetworkAnimation(networkRef);

  // Prefill remembered user
  useEffect(() => {
    const remembered = localStorage.getItem('rememberUser');
    if (remembered) {
      setIdentifier(remembered);
      setRemember(true);
    }
  }, []);

  // The idle watchdog sets this flag before redirecting here after a 30-min
  // inactive session; show a clear "please log in again" popup.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('redlin_session_expired')) {
        sessionStorage.removeItem('redlin_session_expired');
        setSessionExpired(true);
      }
    } catch {}
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

  return (
    <div className="login-page-root">
      <div className="left-section">
        <div className="bg-pattern" />
        <div className="neural-network" ref={networkRef} />
        <div className="left-content">
          <div className="illustration">
            <svg width="500" height="300" viewBox="0 0 500 300" role="img" aria-label="Brain network illustration">
              <path d="M250,50 C350,50 400,150 400,200 C400,250 350,280 300,280 C270,280 260,260 250,260 C240,260 230,280 200,280 C150,280 100,250 100,200 C100,150 150,50 250,50" fill="none" stroke="var(--color-blue)" strokeWidth="2" />
              <circle cx="150" cy="120" r="10" fill="var(--color-teal)" />
              <circle cx="200" cy="80" r="10" fill="var(--color-teal)" />
              <circle cx="250" cy="100" r="10" fill="var(--color-teal)" />
              <circle cx="300" cy="90" r="10" fill="var(--color-teal)" />
              <circle cx="350" cy="130" r="10" fill="var(--color-teal)" />
              <circle cx="180" cy="170" r="10" fill="var(--color-blue)" />
              <circle cx="250" cy="160" r="10" fill="var(--color-blue)" />
              <circle cx="320" cy="180" r="10" fill="var(--color-blue)" />
              <circle cx="220" cy="230" r="10" fill="var(--color-white)" />
              <circle cx="280" cy="240" r="10" fill="var(--color-white)" />
            </svg>
          </div>
          <div className="platform-tagline">AI-Powered Learning Platform</div>
          <p className="platform-description">Unlock your potential with our advanced AI learning system. Personalized education paths, real-time feedback, and adaptive learning technology to accelerate your growth.</p>
        </div>
      </div>
      <div className="right-section">
        <div className="login-form-container">
          <div className="logo-container">
            <img src={dinoRedlin} alt="Redlin" style={{ width: 50, height: 50, objectFit: 'contain', display: 'block', marginRight: 12 }} />
            <div className="platform-name">Redlin</div>
          </div>
          <h1 className="login-title">Login</h1>
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
            {/* TODO(deploy): Social OAuth (Google / Facebook / Apple) is disabled for the open project.
                To enable at deployment, configure it server-side first:
                  1. Create provider app credentials and set client IDs / secrets in the backend env
                     (Google Cloud Console, Facebook for Developers, Apple Developer).
                  2. Add backend OAuth endpoints (django-allauth or a custom OAuth2 flow) that exchange
                     the provider code for a Redlin JWT.
                  3. Point these buttons at those endpoints, then uncomment the block below. */}
            {/* <div className="divider">
              <span className="divider-text">or continue with</span>
            </div>
            <div className="social-buttons">
              <button type="button" className="social-btn google-btn" aria-label="Continue with Google"><i className="ri-google-fill" /></button>
              <button type="button" className="social-btn facebook-btn" aria-label="Continue with Facebook"><i className="ri-facebook-fill" /></button>
              <button type="button" className="social-btn apple-btn" aria-label="Continue with Apple"><i className="ri-apple-fill" /></button>
            </div> */}
          </form>
        </div>
      </div>
      <Dialog open={sessionExpired} onClose={() => setSessionExpired(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 700 }}>
          <TimerOffIcon sx={{ color: 'var(--color-teal)' }} /> Session expired
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your session ended because you were inactive for a while. Please log in again to continue.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSessionExpired(false)}
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: 'var(--color-teal)', '&:hover': { backgroundColor: 'var(--color-teal-deep)' } }}
          >
            Log in again
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Login;