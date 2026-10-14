import { iniciales } from '../Proyectos/formato';
import styles from './Clientes.module.css';

/** Iniciales del cliente en un circulo dorado con letra blanca; inactivo, apagado */
export default function LogoCliente({ cliente, size = 26 }) {
  return (
    <span
      className={`${styles.logo} ${cliente.activo === false ? styles.logoInactivo : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {iniciales(cliente.nombre)}
    </span>
  );
}
