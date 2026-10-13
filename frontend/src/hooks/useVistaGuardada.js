import { useState } from 'react';

// Vista elegida (tarjetas, lista...) recordada en el navegador; sin almacenamiento solo dura la sesion
export const useVistaGuardada = (clave, opciones, defecto) => {
  const [vista, setVista] = useState(() => {
    try {
      const guardada = localStorage.getItem(clave);
      return opciones.includes(guardada) ? guardada : defecto;
    } catch {
      return defecto;
    }
  });

  const cambiarVista = (nueva) => {
    setVista(nueva);
    try {
      localStorage.setItem(clave, nueva);
    } catch {
      // Sin almacenamiento la vista simplemente no se recuerda
    }
  };

  return [vista, cambiarVista];
};
