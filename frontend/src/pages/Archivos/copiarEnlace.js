import toast from 'react-hot-toast';
import { urlEnlace } from '../../api/enlaces';

// Copia la direccion publica del enlace; sin permiso de portapapeles la muestra para copiarla a mano
export async function copiarEnlace(token) {
  try {
    await navigator.clipboard.writeText(urlEnlace(token));
    toast.success('Enlace copiado');
  } catch {
    toast(urlEnlace(token), { duration: 8000, icon: '🔗' });
  }
}
