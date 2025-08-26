import React, { useState } from 'react';
import { authService } from '../../services/api';
import { useNavigate, Link } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  const togglePassword = () => setShowPassword(p => !p);

  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
    return score; // 0..4
  })();
  const strengthLabels = ['Weak password', 'Weak password', 'Fair password', 'Good password', 'Strong password'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agree) { setError('You must accept the terms'); return; }
    setError('');
    setLoading(true);
    try {
      await authService.register(fullName, email, password);
      navigate('/');
    } catch (err) {
      setError(err?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reg-container">
      {/* Illustration Section */}
      <div className="illustration-section">
        <div className="illustration-overlay" />
        <div className="neural-network">
          {/* Static nodes, mimic provided HTML */}
          {[{t:'20%',l:'30%'},{t:'40%',l:'15%'},{t:'65%',l:'25%'},{t:'75%',l:'60%'},{t:'30%',l:'70%'},{t:'50%',l:'80%'},{t:'15%',l:'55%'},{t:'85%',l:'40%'},{t:'60%',l:'10%'},{t:'25%',l:'85%'},{t:'45%',l:'65%'},{t:'70%',l:'75%'}].map((n,i)=> (
            <div key={i} className="node" style={{ top:n.t, left:n.l }} />
          ))}
        </div>
        <div className="floating-element" style={{top:'15%', left:'20%', width:60, height:60, borderRadius:12, background:'rgba(32,201,151,0.1)', animationDelay:'0.5s'}} />
        <div className="floating-element" style={{top:'70%', left:'75%', width:80, height:40, borderRadius:20, background:'rgba(74,144,226,0.1)', animationDelay:'1.2s'}} />
        <div className="floating-element" style={{top:'40%', left:'80%', width:50, height:50, borderRadius:25, background:'rgba(127,99,244,0.1)', animationDelay:'0.8s'}} />
        <div className="brain-illustration">
          <div className="brain-circle">
            <div className="brain-inner">
              <div className="connection-line" style={{ width:80, top:50, left:60, transform:'rotate(45deg)' }} />
              <div className="connection-line" style={{ width:60, top:100, left:30, transform:'rotate(-30deg)' }} />
              <div className="connection-line" style={{ width:70, top:150, left:70, transform:'rotate(60deg)' }} />
              <div className="connection-line" style={{ width:90, top:80, left:100, transform:'rotate(-60deg)' }} />
              <div className="connection-line" style={{ width:50, top:130, left:120, transform:'rotate(20deg)' }} />
            </div>
          </div>
        </div>
        <div className="illustration-content">
          <h2>Accelerate Your Learning with AI</h2>
          <p>Join our advanced learning platform that adapts to your unique learning style. Personalized curriculum, real-time feedback, and AI-powered insights to help you master new skills faster than ever before.</p>
        </div>
      </div>
      {/* Form Section */}
      <div className="form-section">
        <div className="form-container">
          <div className="logo-container">
            <div className="logo"><i className="ri-brain-line" /></div>
            <div className="platform-name">LearnSphere</div>
          </div>
          <h1>Create Your Account</h1>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="form-group">
              <label htmlFor="fullname">User Name</label>
              <div className="input-group no-left-icon">
                <input id="fullname" type="text" placeholder="Enter your user name" value={fullName} onChange={e=>setFullName(e.target.value)} required autoComplete="name" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-group no-left-icon">
                <input id="email" type="email" placeholder="Enter your email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-group no-left-icon with-toggle">
                <input id="password" type={showPassword ? 'text':'password'} placeholder="Create a password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password" />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                </button>
              </div>
              <div className="password-strength">
                {[0,1,2,3].map(i => <div key={i} className={`strength-segment ${passwordStrength>i ? 'active-'+(i+1):''}`} />)}
              </div>
              <div className="strength-text">{strengthLabels[passwordStrength]}</div>
            </div>
            <div className="terms-group">
              <label className="custom-checkbox">
                <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
                <span className="checkmark" />
              </label>
              <div className="terms-text">I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></div>
            </div>
            <button type="submit" className="register-btn" disabled={loading}>{loading ? 'Creating Account...' : 'Create Account'}</button>
            <div className="login-link">Already have an account? <Link to="/login">Sign in</Link></div>
            <div className="divider"><span>or register with</span></div>
            <div className="social-buttons">
              <button type="button" className="social-btn google-btn" aria-label="Register with Google"><i className="ri-google-fill" /></button>
              <button type="button" className="social-btn facebook-btn" aria-label="Register with Facebook"><i className="ri-facebook-fill" /></button>
              <button type="button" className="social-btn apple-btn" aria-label="Register with Apple"><i className="ri-apple-fill" /></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;