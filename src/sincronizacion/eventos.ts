// Avisos internos: "llegaron datos de otro equipo" (las pantallas se recargan) y "cambió el estado de la sincronización".

import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

type Oyente = () => void;
const oyentes = { datos: new Set<Oyente>(), estado: new Set<Oyente>() };

export function emitir(tipo: keyof typeof oyentes): void {
  for (const o of [...oyentes[tipo]]) {
    try {
      o();
    } catch {
      // Un oyente con error no debe frenar a los demás.
    }
  }
}

export function escuchar(tipo: keyof typeof oyentes, o: Oyente): () => void {
  oyentes[tipo].add(o);
  return () => {
    oyentes[tipo].delete(o);
  };
}

/**
 * Igual que useFocusEffect, pero además vuelve a ejecutar el efecto (recargar la pantalla)
 * cuando llegan datos de otro equipo mientras la pantalla está a la vista.
 */
export function useFocusEffectConSync(efecto: () => void | (() => void)): void {
  useFocusEffect(
    useCallback(() => {
      const limpiar = efecto();
      const quitar = escuchar('datos', () => {
        efecto();
      });
      return () => {
        quitar();
        if (typeof limpiar === 'function') limpiar();
      };
    }, [efecto]),
  );
}
