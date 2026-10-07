import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { SignupPage } from './SignupPage';
import './login.css';

const ROLES: Record<UserRole, { label: string; placeholder: string; autocomplete: string; pattern: RegExp; error: string }> = {
  admin: { label: 'Username / Email :', placeholder: 'Enter username or email', autocomplete: 'username', pattern: /^[a-zA-Z0-9._@+-]{3,60}$/, error: 'Enter a valid username or email (3-60 characters).' },
  hod: { label: 'Employee ID / Email :', placeholder: 'Enter employee ID or email', autocomplete: 'username', pattern: /^[a-zA-Z0-9._@+-]{3,60}$/, error: 'Enter a valid employee ID or email.' },
  faculty: { label: 'Employee ID / Email :', placeholder: 'Enter employee ID or email', autocomplete: 'username', pattern: /^[a-zA-Z0-9._@+-]{3,60}$/, error: 'Enter a valid employee ID or email.' },
  student: { label: 'Register No / Email :', placeholder: 'Enter register number or email', autocomplete: 'username', pattern: /^[a-zA-Z0-9._@+-]{3,60}$/, error: 'Enter a valid register number or email.' },
};

const REMEMBER_KEY = 'college-login-remember';

export const LoginPage: React.FC = () => {
  const { login, language, setLanguage, t } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
      if (saved && ROLES[saved.role as UserRole]) {
        setSelectedRole(saved.role);
        setIdentifier(saved.id || '');
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setIdentifierError('');
    setPasswordError('');
    setErrorMessage('');
    setStatus('');
  };

  if (isSignup) {
    return <SignupPage onNavigateToLogin={() => setIsSignup(false)} />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = ROLES[selectedRole];
    let ok = true;

    setIdentifierError('');
    setPasswordError('');
    setErrorMessage('');
    setStatus('');

    const cleanId = identifier.trim();
    if (!role.pattern.test(cleanId)) {
      setIdentifierError(role.error);
      ok = false;
    }
    if (!password) {
      setPasswordError('Password is required.');
      ok = false;
    }
    if (!ok) return;

    try {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ role: selectedRole, id: cleanId }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      /* storage unavailable */
    }

    try {
      setLoading(true);
      setStatus('Logging in...');
      await login(cleanId, password, selectedRole);
    } catch (err: any) {
      const msg = err?.message || 'Invalid role or credentials.';
      setErrorMessage(msg);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const role = ROLES[selectedRole];

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 50 }}>
        <div
          id="login-language-switcher"
          className="flex items-center bg-white/90 dark:bg-zinc-800/90 backdrop-blur p-0.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-bold shadow-sm select-none"
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              language === 'en'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="English"
          >
            ABC
          </button>
          <span className="px-0.5 text-gray-300 font-light pointer-events-none">|</span>
          <button
            type="button"
            onClick={() => setLanguage('ta')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              language === 'ta'
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="தமிழ் (Tamil)"
          >
            அ
          </button>
        </div>
      </div>

      <section className="card" aria-labelledby="login-title">
        <header className="card__head">
          <img className="logo" src="/assets/tn-emblem.png" alt="Tamil Nadu Government emblem" />
          <p className="college-name">{language === 'ta' ? 'அரசு கலை & அறிவியல் கல்லூரி' : 'Government Arts & Science College'}</p>
          <p className="college-sub">{language === 'ta' ? 'பல்கலைக்கழகத்துடன் இணைக்கப்பட்டது · நிறுவப்பட்டது 1965' : 'Affiliated to the University · Estd. 1965'}</p>
          <h1 className="card__title" id="login-title">
            {language === 'ta' ? 'உங்கள் கணக்கில் உள்நுழைக' : 'Login to your account'}
          </h1>
        </header>

        <form className="form" onSubmit={handleLogin} noValidate>
          {/* Login As */}
          <div className="field">
            <label className="label" htmlFor="loginAs">
              {language === 'ta' ? 'உள்நுழையும் பங்கு :' : 'Login As :'}
            </label>
            <div className="select-wrap">
              <select
                className="control select"
                id="loginAs"
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                required
              >
                <option value="admin">{language === 'ta' ? 'நிர்வாகி (Admin)' : 'Admin'}</option>
                <option value="faculty">{language === 'ta' ? 'பணியாளர் (Faculty)' : 'Faculty'}</option>
                <option value="hod">{language === 'ta' ? 'துறைத்தலைவர் (HOD)' : 'HOD'}</option>
                <option value="student">{language === 'ta' ? 'மாணவர் (Student)' : 'Student'}</option>
              </select>
              <svg className="icon icon--chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Dynamic identifier field */}
          <div className="field">
            <label className="label" htmlFor="identifier">{role.label}</label>
            <input
              className="control"
              type="text"
              id="identifier"
              placeholder={role.placeholder}
              autoComplete={role.autocomplete}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrorMessage('');
              }}
              required
            />
            {identifierError && <p className="error" role="alert">{identifierError}</p>}
          </div>

          {/* Password */}
          <div className="field">
            <label className="label" htmlFor="password">
              {language === 'ta' ? 'கடவுச்சொல் :' : 'Password :'}
            </label>
            <div className="input-wrap">
              <input
                className="control"
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder={language === 'ta' ? 'உங்கள் கடவுச்சொல்லை உள்ளிடவும்' : 'Enter your password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
                required
              />
              <button
                className="toggle"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="2.9" fill="none" stroke="currentColor" strokeWidth="1.9" />
                </svg>
              </button>
            </div>
            {passwordError && <p className="error" role="alert">{passwordError}</p>}
          </div>

          <div className="row">
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>{language === 'ta' ? 'என்னை நினைவில் கொள்' : 'Remember Me'}</span>
            </label>
            <button type="button" className="link" onClick={() => setForgotOpen(true)}>
              {language === 'ta' ? 'கடவுச்சொல் மறந்துவிட்டதா?' : 'Forgot Password?'}
            </button>
          </div>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? (language === 'ta' ? 'உள்நுழைகிறது...' : 'Logging in...') : (language === 'ta' ? 'உள்நுழை' : 'Login')}
          </button>
          {errorMessage && (
            <p className="error" role="alert" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              {errorMessage}
            </p>
          )}
          {status && !errorMessage && (
            <p className="status" role="status" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              {status}
            </p>
          )}
        </form>

        <footer className="card__foot">
          <span className="pill">Don't have an account? <button type="button" className="link" onClick={() => setIsSignup(true)}>Sign Up now</button></span>
        </footer>
      </section>

      <ForgotPasswordModal isOpen={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
};
