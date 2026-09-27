import { createContext, useState, useEffect, useCallback } from 'react';
import { obtenerEmpresaPublica } from '../api/empresa';

export const EmpresaContext = createContext();

const EMPRESA_POR_DEFECTO = { nombre: '', logo_url: null };

export const EmpresaProvider = ({ children }) => {
  const [empresa, setEmpresa] = useState(EMPRESA_POR_DEFECTO);

  const recargarEmpresa = useCallback(async () => {
    try {
      setEmpresa(await obtenerEmpresaPublica());
    } catch {
      // Sin conexion al backend se deja la marca por defecto
    }
  }, []);

  useEffect(() => {
    recargarEmpresa();
  }, [recargarEmpresa]);

  useEffect(() => {
    if (empresa.nombre) document.title = empresa.nombre;
  }, [empresa.nombre]);

  return (
    <EmpresaContext.Provider value={{ empresa, setEmpresa, recargarEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  );
};
