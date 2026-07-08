import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './Login.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // error ya esta en el contexto
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <svg className={styles.sunrise} viewBox="0 0 600 260" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="arcGrad" x1="0" y1="0" x2="600" y2="0">
              <stop offset="0%" stopColor="#f2a93c" stopOpacity="0" />
              <stop offset="50%" stopColor="#f2a93c" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#f2a93c" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde3b0" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#f2a93c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f2a93c" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 40 200 Q 300 20 560 200" stroke="url(#arcGrad)" strokeWidth="1.5" strokeDasharray="2 6" />
          <circle className={styles.sunGlow} cx="300" cy="118" r="70" fill="url(#sunGlow)" />
          <circle cx="300" cy="118" r="26" fill="#f7bb5c" />
        </svg>

        <div className={styles.contentWrapper}>
          <div className={styles.brand}>
            <span className={styles.logo}>🌞</span>
            <h1 className={styles.appName}>Helios</h1>
          </div>
          <h2 className={styles.tagline}>Gestion de proyectos en la nube</h2>
          <p className={styles.description}>
            Centraliza tus proyectos, clientes y documentos de forma remota, segura y escalable.
          </p>
          <ul className={styles.featuresList}>
            <li>Proyectos centralizados</li>
            <li>Gestion de clientes</li>
            <li>Documentos con historial</li>
            <li>Dashboard inteligente</li>
          </ul>
        </div>

        <div className={styles.footer}>
          <p>© 2026 Helios — UNAD</p>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Inicia sesion</h2>
          <p className={styles.cardSubtitle}>Accede a tu cuenta de Helios</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email">Correo electronico</label>
              <input
                type="email"
                id="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Cargando...' : 'Entrar'}
            </button>
          </form>

          <p className={styles.registerLink}>
            ¿No tienes cuenta? <a href="/registro">Registrate</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;