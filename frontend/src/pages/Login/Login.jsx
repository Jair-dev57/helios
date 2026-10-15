import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Bell, Eye, EyeOff, FileDown, Folder, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import SolEngranado from './SolEngranado';
import styles from './Login.module.css';

const FUNCIONES = [
  { icono: Folder, texto: 'Proyectos centralizados' },
  { icono: Users, texto: 'Gestion de clientes' },
  { icono: FileDown, texto: 'Documentos con historial' },
  { icono: Bell, texto: 'Alertas de entregas y tareas' },
];

const Login = () => {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(identificador.trim(), password);
      navigate('/');
    } catch {
      // error ya esta en el contexto
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <SolEngranado className={styles.sol} />

        <div className={styles.contentWrapper}>
          <h2 className={styles.tagline}>
            Gestion de proyectos<br />
            <span>en la nube</span>
          </h2>
          <p className={styles.description}>
            Centraliza tus proyectos, clientes y documentos de forma remota, segura y escalable.
          </p>
          <ul className={styles.featuresList}>
            {FUNCIONES.map(({ icono: Icono, texto }) => (
              <li key={texto}>
                <span className={styles.featureIcon}><Icono size={16} /></span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.footer}>
          <p>© 2026 — UNAD</p>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.card}>
          <h1 className={styles.cardTitle}>Inicia sesion</h1>
          <p className={styles.cardSubtitle}>Bienvenido de nuevo. Accede a tu cuenta.</p>

          {error && (
            <div className={styles.error} role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

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
              <div className={styles.passwordWrap}>
                <input
                  type={verPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.verPassword}
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Cargando...' : <>Entrar <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className={styles.registerLink}>
            ¿No tienes cuenta? Contacta a tu administrador para obtener acceso.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
