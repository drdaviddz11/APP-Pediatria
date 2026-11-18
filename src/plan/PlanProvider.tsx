// Estado del plan (Gratis o Pro) disponible en todas las pantallas.

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { OrigenPlan, origenInicial, tienePro } from './plan';

interface EstadoPlan {
  origen: OrigenPlan;
  esPro: boolean;
  /** Solo en la edición del desarrollador: ver la app como la ve quien no paga (no se guarda; al recargar vuelve a Pro). */
  verComoGratis: boolean;
  setVerComoGratis: (v: boolean) => void;
}

const ContextoPlan = createContext<EstadoPlan | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  // process.env.EXPO_PUBLIC_* se escribe tal cual: Expo lo reemplaza al compilar.
  const [origen] = useState<OrigenPlan>(() =>
    origenInicial(process.env.EXPO_PUBLIC_EDICION, typeof __DEV__ !== 'undefined' && __DEV__),
  );
  const [verComoGratis, setVerComoGratis] = useState(false);
  const valor = useMemo(
    () => ({ origen, esPro: tienePro(origen, verComoGratis), verComoGratis, setVerComoGratis }),
    [origen, verComoGratis],
  );
  return <ContextoPlan.Provider value={valor}>{children}</ContextoPlan.Provider>;
}

export function usePlan(): EstadoPlan {
  const v = useContext(ContextoPlan);
  if (!v) throw new Error('usePlan fuera de PlanProvider');
  return v;
}
