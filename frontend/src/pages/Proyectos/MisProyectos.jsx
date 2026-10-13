import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarEspacios } from '../../api/espacios';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import Proyectos from './Proyectos';
import Clientes from '../Clientes/Clientes';
import listado from '../../styles/listado.module.css';
import styles from './MisProyectos.module.css';

// Cada pestaña aparece solo si el rol tiene su seccion
const PESTANAS = [
  { id: 'proyectos', texto: 'Proyectos', seccion: 'proyectos', Vista: Proyectos },
  { id: 'clientes', texto: 'Clientes', seccion: 'clientes', Vista: Clientes },
];

/**
 * Proyectos y clientes en un solo lugar; ?ver=clientes elige la pestaña.
 * ?area=ID (un equipo del menu): solo los proyectos de ese equipo, con su nombre de titulo y sin pestañas.
 */
export default function MisProyectos() {
  const { tieneSeccion } = useAuth();
  const [params, setParams] = useSearchParams();
  const areaId = Number(params.get('area')) || null;
  const [equipo, setEquipo] = useState(null);

  useEffect(() => {
    if (!areaId) return;
    setEquipo(null);
    listarEspacios()
      .then((d) => setEquipo(d.equipo.find((e) => e.id === areaId) || { nombre: 'Equipo' }))
      .catch(() => setEquipo({ nombre: 'Equipo' }));
  }, [areaId]);

  if (areaId) {
    return (
      <PageContainer wide>
        <header className={styles.cabeceraEquipo}>
          <span className={styles.marcaEquipo} style={{ background: equipo?.color || 'var(--accent)' }} aria-hidden="true" />
          <h1 className={listado.title}>{equipo?.nombre || '…'}</h1>
        </header>
        <Proyectos />
      </PageContainer>
    );
  }

  const pestanas = PESTANAS.filter((p) => tieneSeccion(p.seccion));
  const actual = pestanas.find((p) => p.id === params.get('ver')) || pestanas[0];

  const elegir = (id) => setParams(id === pestanas[0]?.id ? {} : { ver: id }, { replace: true });

  return (
    <PageContainer wide>
      <header className={styles.cabecera}>
        <h1 className={listado.title}>Mis proyectos</h1>
        {pestanas.length > 1 && (
          <nav className={styles.pestanas} aria-label="Secciones de Mis proyectos">
            {pestanas.map((p) => (
              <button key={p.id} type="button" aria-current={p.id === actual.id ? 'page' : undefined} onClick={() => elegir(p.id)}>
                {p.texto}
              </button>
            ))}
          </nav>
        )}
      </header>
      {actual ? <actual.Vista /> : <p>Tu rol no tiene acceso a proyectos ni a clientes.</p>}
    </PageContainer>
  );
}
