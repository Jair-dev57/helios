import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { listarComentarios, crearComentario, editarComentario, eliminarComentario } from '../api/comentarios';
import { listarUsuarios } from '../api/usuarios';
import { useAuth } from '../hooks/useAuth';
import { fechaRelativa, fechaCompleta } from '../pages/Proyectos/formato';
import Avatar from './Avatar';
import styles from './ComentariosDocumento.module.css';

// Mencion guardada en el texto: @[Nombre](usuario_id)
const MENCION = /@\[([^\]\n]{1,100})\]\((\d+)\)/g;
const MAX_SUGERENCIAS = 6;

/** Texto del comentario con las menciones resaltadas */
function TextoComentario({ texto }) {
  const partes = [];
  let ultimo = 0;
  for (const m of texto.matchAll(MENCION)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(<span key={m.index} className={styles.mencion}>@{m[1]}</span>);
    ultimo = m.index + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return <p className={styles.texto}>{partes}</p>;
}

// "@[Ana](3)" -> "@Ana" para poder editar el texto
const aEditable = (texto) => texto.replace(MENCION, (_, nombre) => `@${nombre}`);

/**
 * Caja de texto con autocompletado de @menciones. Guarda las menciones elegidas y, al enviar,
 * convierte cada "@Nombre" que siga en el texto en @[Nombre](id).
 */
function Redactor({ usuarios, inicial = '', menciones: mencionesIniciales = [], textoBoton, onEnviar, onCancelar, autoFocus }) {
  const [texto, setTexto] = useState(inicial);
  const [menciones, setMenciones] = useState(mencionesIniciales);
  const [consulta, setConsulta] = useState(null);
  const [activa, setActiva] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const area = useRef(null);

  const sugerencias = useMemo(() => {
    if (consulta === null) return [];
    const q = consulta.toLowerCase();
    return usuarios.filter((u) => u.nombre.toLowerCase().includes(q)).slice(0, MAX_SUGERENCIAS);
  }, [consulta, usuarios]);

  // "@algo" justo antes del cursor abre las sugerencias
  const detectar = (valor, cursor) => {
    const m = valor.slice(0, cursor).match(/(?:^|\s)@([\p{L}\p{N}._-]{0,30})$/u);
    setConsulta(m ? m[1] : null);
    setActiva(0);
  };

  const elegir = (usuario) => {
    const cursor = area.current.selectionStart;
    const antes = texto.slice(0, cursor).replace(/@[\p{L}\p{N}._-]{0,30}$/u, `@${usuario.nombre} `);
    const nuevo = antes + texto.slice(cursor);
    setTexto(nuevo);
    setMenciones((prev) => (prev.some((m) => m.id === usuario.id) ? prev : [...prev, { id: usuario.id, nombre: usuario.nombre }]));
    setConsulta(null);
    requestAnimationFrame(() => {
      area.current.focus();
      area.current.setSelectionRange(antes.length, antes.length);
    });
  };

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    // Los nombres mas largos primero: "@Ana Maria" no debe quedar como "@Ana" + " Maria"
    const final = [...menciones]
      .sort((a, b) => b.nombre.length - a.nombre.length)
      .reduce((t, m) => t.split(`@${m.nombre}`).join(`@[${m.nombre}](${m.id})`), limpio);
    setEnviando(true);
    try {
      await onEnviar(final);
      setTexto('');
      setMenciones([]);
    } finally {
      setEnviando(false);
    }
  };

  const alTeclear = (e) => {
    if (sugerencias.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiva((i) => (i + 1) % sugerencias.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiva((i) => (i - 1 + sugerencias.length) % sugerencias.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegir(sugerencias[activa]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setConsulta(null); return; }
    }
    if (e.key === 'Escape' && onCancelar) { e.stopPropagation(); onCancelar(); return; }
    // Enter envia; Shift+Enter hace un salto de linea
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <div className={styles.redactor}>
      {sugerencias.length > 0 && (
        <ul className={styles.sugerencias} role="listbox" aria-label="Mencionar a">
          {sugerencias.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === activa}>
              <button
                type="button"
                className={i === activa ? styles.sugerenciaActiva : ''}
                onMouseDown={(e) => { e.preventDefault(); elegir(u); }}
              >
                <Avatar usuario={u} size={22} />
                <span>{u.nombre}</span>
                {u.cargo && <small>{u.cargo}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={area}
        value={texto}
        onChange={(e) => { setTexto(e.target.value); detectar(e.target.value, e.target.selectionStart); }}
        onKeyDown={alTeclear}
        onClick={(e) => detectar(e.target.value, e.target.selectionStart)}
        onBlur={() => setConsulta(null)}
        placeholder="Escribe un comentario… usa @ para mencionar"
        aria-label="Comentario"
        rows={2}
        maxLength={4000}
        autoFocus={autoFocus}
      />
      <div className={styles.redactorPie}>
        <small>Enter para enviar · Shift+Enter para otra línea</small>
        <span className={styles.redactorBotones}>
          {onCancelar && <button type="button" className={styles.secundario} onClick={onCancelar}>Cancelar</button>}
          <button type="button" className={styles.enviar} onClick={enviar} disabled={!texto.trim() || enviando}>
            <Send size={14} /> {textoBoton}
          </button>
        </span>
      </div>
    </div>
  );
}

/** Comentarios de un documento. onCambio: cambio la cantidad (para el contador del listado) */
export default function ComentariosDocumento({ documentoId, onCambio }) {
  const { user, esAdministrador } = useAuth();
  const [comentarios, setComentarios] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [editando, setEditando] = useState(null);
  const lista = useRef(null);

  useEffect(() => {
    let cancelado = false;
    setComentarios(null);
    listarComentarios(documentoId)
      .then((c) => { if (!cancelado) setComentarios(c); })
      .catch(() => { if (!cancelado) setComentarios([]); });
    return () => { cancelado = true; };
  }, [documentoId]);

  useEffect(() => {
    listarUsuarios()
      .then((u) => setUsuarios(u.filter((x) => x.activo && x.id !== user?.id)))
      .catch(() => setUsuarios([]));
  }, [user?.id]);

  // Al llegar o publicar comentarios, mostrar el ultimo
  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [comentarios?.length]);

  const publicar = async (texto) => {
    try {
      const nuevo = await crearComentario(documentoId, texto);
      setComentarios((prev) => [...(prev || []), nuevo]);
      onCambio?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo publicar el comentario.');
      throw err;
    }
  };

  const guardarEdicion = async (id, texto) => {
    try {
      const editado = await editarComentario(id, texto);
      setComentarios((prev) => prev.map((c) => (c.id === id ? editado : c)));
      setEditando(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo editar el comentario.');
      throw err;
    }
  };

  const borrar = async (id) => {
    if (!confirm('¿Eliminar este comentario?')) return;
    try {
      await eliminarComentario(id);
      setComentarios((prev) => prev.filter((c) => c.id !== id));
      onCambio?.();
    } catch (err) {
      toast.error('No se pudo eliminar el comentario.');
    }
  };

  const mencionesDe = (texto) => [...texto.matchAll(MENCION)].map((m) => ({ nombre: m[1], id: Number(m[2]) }));

  return (
    <section className={styles.panel} aria-label="Comentarios">
      <div className={styles.lista} ref={lista}>
        {comentarios === null && <p className={styles.estado}>Cargando comentarios…</p>}
        {comentarios?.length === 0 && (
          <p className={styles.estado}>Nadie ha comentado este archivo. Sé el primero, y usa @ para avisarle a alguien.</p>
        )}
        {comentarios?.map((c) => {
          const propio = c.usuario_id === user?.id;
          return (
            <article key={c.id} className={styles.comentario}>
              <Avatar usuario={{ nombre: c.autor || '?', avatar_url: c.autor_avatar_url }} size={30} />
              <div className={styles.cuerpo}>
                <header className={styles.cabecera}>
                  <strong>{c.autor || 'Usuario eliminado'}</strong>
                  <span title={fechaCompleta(c.created_at)}>{fechaRelativa(c.created_at)}</span>
                  {c.editado_at && <span title={fechaCompleta(c.editado_at)}>· editado</span>}
                  {(propio || esAdministrador) && editando !== c.id && (
                    <span className={styles.acciones}>
                      {propio && (
                        <button onClick={() => setEditando(c.id)} aria-label="Editar comentario" title="Editar"><Pencil size={13} /></button>
                      )}
                      <button onClick={() => borrar(c.id)} aria-label="Eliminar comentario" title="Eliminar"><Trash2 size={13} /></button>
                    </span>
                  )}
                </header>
                {editando === c.id ? (
                  <Redactor
                    usuarios={usuarios}
                    inicial={aEditable(c.texto)}
                    menciones={mencionesDe(c.texto)}
                    textoBoton="Guardar"
                    onEnviar={(texto) => guardarEdicion(c.id, texto)}
                    onCancelar={() => setEditando(null)}
                    autoFocus
                  />
                ) : (
                  <TextoComentario texto={c.texto} />
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Redactor usuarios={usuarios} textoBoton="Comentar" onEnviar={publicar} />
    </section>
  );
}
