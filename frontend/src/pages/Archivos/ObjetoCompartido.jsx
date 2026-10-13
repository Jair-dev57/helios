import { Link } from 'react-router-dom';
import { rutaObjeto, nombreLugar } from '../../api/espacios';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from '../Proyectos/IconoCarpeta';
import { nombreArchivo } from '../Proyectos/formato';
import styles from './Archivos.module.css';

/** Documento o carpeta compartida con el lugar donde esta; abre el archivo o la carpeta en su espacio o proyecto */
export default function ObjetoCompartido({ objeto, detalle }) {
  const nombre = objeto.tipo === 'documento' ? nombreArchivo(objeto.nombre, objeto.extension) : objeto.nombre;
  return (
    <Link to={rutaObjeto(objeto)} className={styles.objeto}>
      {objeto.tipo === 'documento' ? <IconoArchivo tipo={objeto.extension} size={30} /> : <IconoCarpeta color={objeto.color} size={30} />}
      <span className={styles.objetoTexto}>
        <b title={nombre}>{nombre}</b>
        <small>{nombreLugar(objeto)}{detalle && <> · {detalle}</>}</small>
      </span>
    </Link>
  );
}
