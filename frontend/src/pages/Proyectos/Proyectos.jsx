import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
    listarProyectos,
    crearProyecto,
    actualizarProyecto,
    eliminarProyecto,
} from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import styles from './Proyectos.module.css';
import { Link } from 'react-router-dom';

const ESTADOS = ['activo', 'pausado', 'completado', 'cancelado'];

const FORM_VACIO = {
    nombre: '',
    descripcion: '',
    estado: 'activo',
    fecha_vencimiento: '',
    cliente_id: '',
};

const Proyectos = () => {
    const { user } = useAuth();
    const [proyectos, setProyectos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [guardando, setGuardando] = useState(false);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [dataProyectos, dataClientes] = await Promise.all([
                listarProyectos(),
                listarClientes(),
            ]);
            setProyectos(dataProyectos);
            setClientes(dataClientes);
            setError(null);
        } catch (err) {
            setError('No se pudieron cargar los proyectos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const nombreCliente = (clienteId) => {
        const cliente = clientes.find((c) => c.id === clienteId);
        return cliente ? cliente.nombre : '-';
    };

    const abrirModalCrear = () => {
        setEditandoId(null);
        setForm(FORM_VACIO);
        setModalAbierto(true);
    };

    const abrirModalEditar = (proyecto) => {
        setEditandoId(proyecto.id);
        setForm({
            nombre: proyecto.nombre || '',
            descripcion: proyecto.descripcion || '',
            estado: proyecto.estado || 'activo',
            fecha_vencimiento: proyecto.fecha_vencimiento
                ? proyecto.fecha_vencimiento.slice(0, 10)
                : '',
            cliente_id: proyecto.cliente_id || '',
        });
        setModalAbierto(true);
    };

    const cerrarModal = () => {
        setModalAbierto(false);
        setEditandoId(null);
        setForm(FORM_VACIO);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const payload = {
                ...form,
                cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
                fecha_vencimiento: form.fecha_vencimiento
                    ? `${form.fecha_vencimiento}T00:00:00Z`
                    : null,
                usuario_id: user?.id || null,
            };
            if (editandoId) {
                await actualizarProyecto(editandoId, payload);
            } else {
                await crearProyecto(payload);
            }
            cerrarModal();
            cargarDatos();
        } catch (err) {
            setError('No se pudo guardar el proyecto');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('Seguro que quieres eliminar este proyecto?')) return;
        try {
            await eliminarProyecto(id);
            cargarDatos();
        } catch (err) {
            setError('No se pudo eliminar el proyecto');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Proyectos</h1>
                <button className={styles.buttonPrimary} onClick={abrirModalCrear}>
                    + Nuevo proyecto
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {loading ? (
                <p className={styles.loadingText}>Cargando...</p>
            ) : proyectos.length === 0 ? (
                <p className={styles.emptyText}>No hay proyectos registrados todavia.</p>
            ) : (
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Cliente</th>
                            <th>Estado</th>
                            <th>Vencimiento</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {proyectos.map((proyecto) => (
                            <tr key={proyecto.id}>
                                <td>
                                    <Link to={`/proyectos/${proyecto.id}`} className={styles.nombreLink}>
                                        {proyecto.nombre}
                                    </Link>
                                </td>
                                <td>{nombreCliente(proyecto.cliente_id)}</td>
                                <td>
                                    <span className={`${styles.badge} ${styles[`badge_${proyecto.estado}`]}`}>
                                        {proyecto.estado}
                                    </span>
                                </td>
                                <td>
                                    {proyecto.fecha_vencimiento
                                        ? proyecto.fecha_vencimiento.slice(0, 10)
                                        : '-'}
                                </td>
                                <td className={styles.actions}>
                                    <button className={styles.linkButton} onClick={() => abrirModalEditar(proyecto)}>
                                        Editar
                                    </button>
                                    <button
                                        className={`${styles.linkButton} ${styles.linkButtonDanger}`}
                                        onClick={() => handleEliminar(proyecto.id)}
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
                            {editandoId ? 'Editar proyecto' : 'Nuevo proyecto'}
                        </h2>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <label>Nombre</label>
                                <input
                                    type="text"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Descripcion</label>
                                <textarea
                                    value={form.descripcion}
                                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Cliente</label>
                                <select
                                    value={form.cliente_id}
                                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                                >
                                    <option value="">Sin cliente</option>
                                    {clientes.map((cliente) => (
                                        <option key={cliente.id} value={cliente.id}>
                                            {cliente.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Estado</label>
                                <select
                                    value={form.estado}
                                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                                >
                                    {ESTADOS.map((estado) => (
                                        <option key={estado} value={estado}>
                                            {estado}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Fecha de vencimiento</label>
                                <input
                                    type="date"
                                    value={form.fecha_vencimiento}
                                    onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
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

export default Proyectos;