import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import MarcaEmpresa from '../../components/MarcaEmpresa';
import styles from './Login.module.css';

const Login = () => {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(identificador.trim(), password);
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
        <div className={styles.contentWrapper}>
          <MarcaEmpresa tamanoLogo={48} className={styles.brand} classNameNombre={styles.appName} />
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
          <p>© 2026 — UNAD</p>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Inicia sesion</h2>
          <p className={styles.cardSubtitle}>Accede a tu cuenta</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="usuario">Correo o nombre de usuario</label>
              <input
                type="text"
                id="usuario"
                autoComplete="username"
                placeholder="ejemplo@correo.com"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
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
            ¿No tienes cuenta? Contacta a tu administrador para obtener acceso.
          </p>
          <p className={styles.footerMovil}>© 2026 — UNAD</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
