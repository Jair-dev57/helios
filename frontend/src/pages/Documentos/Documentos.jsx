import { useState, useEffect } from 'react';
import {
    listarDocumentos,
    actualizarDocumento,
    eliminarDocumento,
    subirDocumento,
    subirVersionDocumento,
} from '../../api/documentos';
import { listarProyectos } from '../../api/proyectos';
import styles from './Documentos.module.css';

const FORM_VACIO = { nombre: '', tipo: '' };
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ICONOS_TIPO = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📙',
    pptx: '📙',
    txt: '📃',
    csv: '📃',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
};

const Documentos = () => {
    const [documentos, setDocumentos] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [proyectoId, setProyectoId] = useState('');
    const [archivo, setArchivo] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [dataDocumentos, dataProyectos] = await Promise.all([
                listarDocumentos(),
                listarProyectos(),
            ]);
            setDocumentos(dataDocumentos);
            setProyectos(dataProyectos);
            setError(null);
        } catch (err) {
            setError('No se pudieron cargar los documentos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const nombreProyecto = (proyectoId) => {
        const proyecto = proyectos.find((p) => p.id === proyectoId);
        return proyecto ? proyecto.nombre : '-';
    };

    const abrirModalCrear = () => {
        setEditandoId(null);
        setForm(FORM_VACIO);
        setProyectoId('');
        setArchivo(null);
        setModalAbierto(true);
    };

    const abrirModalEditar = (documento) => {
        setEditandoId(documento.id);
        setForm({ nombre: documento.nombre || '', tipo: documento.tipo || '' });
        setArchivo(null);
        setModalAbierto(true);
    };

    const cerrarModal = () => {
        setModalAbierto(false);
        setEditandoId(null);
        setForm(FORM_VACIO);
        setProyectoId('');
        setArchivo(null);
    };

    const handleArchivoChange = (e) => {
        const file = e.target.files[0];
        setArchivo(file);
        if (file && !form.nombre) {
            const nombreSinExtension = file.name.replace(/\.[^/.]+$/, '');
            setForm((prev) => ({ ...prev, nombre: nombreSinExtension }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            if (editandoId) {
                if (archivo) {
                    const formData = new FormData();
                    formData.append('archivo', archivo);
                    formData.append('nombre', form.nombre);
                    if (form.tipo) formData.append('tipo', form.tipo);
                    await subirVersionDocumento(editandoId, formData);
                } else {
                    await actualizarDocumento(editandoId, {
                        nombre: form.nombre,
                        tipo: form.tipo || null,
                    });
                }
            } else {
                if (!archivo) {
                    setError('Selecciona un archivo para subir');
                    setGuardando(false);
                    return;
                }
                const formData = new FormData();
                formData.append('archivo', archivo);
                formData.append('nombre', form.nombre);
                formData.append('proyecto_id', proyectoId);
                await subirDocumento(formData);
            }
            cerrarModal();
            cargarDatos();
        } catch (err) {
            setError('No se pudo guardar el documento');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('Seguro que quieres eliminar este documento?')) return;
        try {
            await eliminarDocumento(id);
            cargarDatos();
        } catch (err) {
            setError('No se pudo eliminar el documento');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Documentos</h1>
                <button className={styles.buttonPrimary} onClick={abrirModalCrear}>
                    + Nuevo documento
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {loading ? (
                <p className={styles.loadingText}>Cargando...</p>
            ) : documentos.length === 0 ? (
                <p className={styles.emptyText}>No hay documentos registrados todavia.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Proyecto</th>
                            <th>Tipo</th>
                            <th>Version</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {documentos.map((documento) => (
                            <tr key={documento.id}>
                                <td>
                                    <button
                                        type="button"
                                        className={styles.fileLink}
                                        onClick={() => window.open(`${API_URL}${documento.ruta}`, '_blank')}
                                    >
                                        <span className={styles.fileIcon}>
                                            {ICONOS_TIPO[documento.tipo] || '📎'}
                                        </span>
                                        {documento.nombre}
                                    </button>
                                </td>
                                <td>{nombreProyecto(documento.proyecto_id)}</td>
                                <td>{documento.tipo || '-'}</td>
                                <td>
                                    <span className={styles.versionBadge}>v{documento.version_actual}</span>
                                </td>
                                <td className={styles.actions}>
                                    <button className={styles.linkButton} onClick={() => abrirModalEditar(documento)}>
                                        Editar
                                    </button>
                                    <button
                                        className={`${styles.linkButton} ${styles.linkButtonDanger}`}
                                        onClick={() => handleEliminar(documento.id)}
                                    >
                                        Eliminar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {modalAbierto && (
                <div className={styles.overlay} onClick={cerrarModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>
                            {editandoId ? 'Editar documento' : 'Nuevo documento'}
                        </h2>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            {!editandoId && (
                                <div className={styles.field}>
                                    <label>Proyecto</label>
                                    <select
                                        value={proyectoId}
                                        onChange={(e) => setProyectoId(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecciona un proyecto</option>
                                        {proyectos.map((proyecto) => (
                                            <option key={proyecto.id} value={proyecto.id}>
                                                {proyecto.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className={styles.field}>
                                <label>{editandoId ? 'Reemplazar archivo (nueva version)' : 'Archivo'}</label>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                                    onChange={handleArchivoChange}
                                    required={!editandoId}
                                />
                                {editandoId && (
                                    <span className={styles.hint}>
                                        Dejalo vacio si solo quieres cambiar el nombre.
                                    </span>
                                )}
                            </div>

                            <div className={styles.field}>
                                <label>Nombre</label>
                                <input
                                    type="text"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.buttonSecondary} onClick={cerrarModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className={styles.buttonPrimary} disabled={guardando}>
                                    {guardando ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Documentos;