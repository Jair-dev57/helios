import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, ListTodo, FileText, Users, Loader2 } from 'lucide-react';
import { buscarGlobal } from '../api/busqueda';
import styles from './BusquedaGlobal.module.css';

const SECCIONES = [
  { key: 'proyectos', label: 'Proyectos', icon: Folder },
  { key: 'tareas', label: 'Tareas', icon: ListTodo },
  { key: 'documentos', label: 'Documentos', icon: FileText },
  { key: 'clientes', label: 'Clientes', icon: Users },
];

const BusquedaGlobal = () => {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const manejarClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, []);

  const ejecutarBusqueda = useCallback(async (texto) => {
    if (texto.trim().length < 2) {
      setResultados(null);
      return;
    }
    setCargando(true);
    try {
      const data = await buscarGlobal(texto.trim());
      setResultados(data);
    } catch (err) {
      console.error('Error en busqueda:', err);
      setResultados(null);
    } finally {
      setCargando(false);
    }
  }, []);

  const manejarCambio = (e) => {
    const valor = e.target.value;
    setQuery(valor);
    setAbierto(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => ejecutarBusqueda(valor), 400);
  };

  const irAResultado = (item) => {
    setAbierto(false);
    setQuery('');
    setResultados(null);
    if (item.entidad_tipo === 'proyecto') {
      navigate(`/proyectos/${item.entidad_id}`);
    } else if (item.entidad_tipo === 'tarea' && item.proyecto_id) {
      navigate(`/proyectos/${item.proyecto_id}/tareas`);
    } else if (item.entidad_tipo === 'documento' && item.proyecto_id) {
      navigate(`/proyectos/${item.proyecto_id}/documentos`);
    } else if (item.entidad_tipo === 'cliente') {
      navigate('/clientes');
    }
  };

  const hayResultados =
    resultados &&
    SECCIONES.some((s) => resultados[s.key]?.length > 0);

  return (
    <div className={styles.contenedor} ref={contenedorRef}>
      <div className={styles.inputWrapper}>
        <Search size={16} className={styles.iconoBusqueda} />
        <input
          type="text"
          placeholder="Buscar proyectos, tareas, documentos, clientes..."
          value={query}
          onChange={manejarCambio}
          onFocus={() => query.trim().length >= 2 && setAbierto(true)}
          className={styles.input}
        />
        {cargando && <Loader2 size={15} className={styles.spinner} />}
      </div>

      {abierto && query.trim().length >= 2 && (
        <div className={styles.dropdown}>
          {!cargando && !hayResultados && (
            <div className={styles.sinResultados}>Sin resultados para "{query}"</div>
          )}
          {SECCIONES.map(({ key, label, icon: Icon }) => {
            const items = resultados?.[key] || [];
            if (items.length === 0) return null;
            return (
              <div key={key} className={styles.seccion}>
                <div className={styles.seccionTitulo}>{label}</div>
                {items.map((item) => (
                  <button
                    key={`${item.entidad_tipo}-${item.entidad_id}`}
                    className={styles.resultado}
                    onClick={() => irAResultado(item)}
                  >
                    <Icon size={15} className={styles.resultadoIcono} />
                    <span className={styles.resultadoTitulo}>{item.titulo}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BusquedaGlobal;
