// Componentes visuales de la agenda.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLOR_ESTADO } from '../agenda/estados';
import { fechaDeMomento, horaDeMomento, textoDiaRelativo } from '../agenda/tiempo';
import { Bloqueo, Cita, EstadoCita, esActiva, NOMBRE_ESTADO, NOMBRE_TIPO, nombreCita } from '../agenda/tipos';
import { colores, espacio, radio, texto } from './tema';

export function ChipEstado({ estado }: { estado: EstadoCita }) {
  const c = COLOR_ESTADO[estado];
  return (
    <View style={[s.chip, { backgroundColor: c.fondo }]}>
      <Text style={[s.chipTexto, { color: c.texto }]}>{NOMBRE_ESTADO[estado]}</Text>
    </View>
  );
}

/** Fila de una cita. `conFecha` muestra el día además de la hora. */
export function FilaCita({ cita, onPress, conFecha = false }: { cita: Cita; onPress: () => void; conFecha?: boolean }) {
  const inactiva = !esActiva(cita.estado);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.fila, inactiva && { opacity: 0.55 }, pressed && { opacity: 0.7 }]}
    >
      <View style={s.hora}>
        {conFecha && <Text style={s.fecha}>{textoDiaRelativo(fechaDeMomento(cita.inicio))}</Text>}
        <Text style={s.horaTexto}>{horaDeMomento(cita.inicio)}</Text>
        <Text style={s.horaFin}>{horaDeMomento(cita.fin)}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[s.nombre, inactiva && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
          {nombreCita(cita)}
        </Text>
        <Text style={s.detalle} numberOfLines={1}>
          {NOMBRE_TIPO[cita.tipo]}
          {cita.motivo ? ` · ${cita.motivo}` : ''}
          {!cita.pacienteId ? ' · sin expediente' : ''}
        </Text>
        <ChipEstado estado={cita.estado} />
      </View>
    </Pressable>
  );
}

export function FilaBloqueo({ bloqueo, onPress }: { bloqueo: Bloqueo; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.fila, s.bloqueo, pressed && { opacity: 0.7 }]}>
      <View style={s.hora}>
        <Text style={s.horaTexto}>{horaDeMomento(bloqueo.inicio)}</Text>
        <Text style={s.horaFin}>{horaDeMomento(bloqueo.fin)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.nombre, { color: colores.textoSuave }]}>Horario bloqueado</Text>
        {bloqueo.motivo ? <Text style={s.detalle}>{bloqueo.motivo}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Botón pequeño de navegación (‹ ›). */
export function BotonFlecha({ texto: t, onPress, etiqueta }: { texto: string; onPress: () => void; etiqueta: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} hitSlop={8} style={({ pressed }) => [s.flecha, pressed && { opacity: 0.6 }]}>
      <Text style={s.flechaTexto}>{t}</Text>
    </Pressable>
  );
}

/** Opción seleccionable en forma de pastilla (horarios, filtros). */
export function Pastilla({ texto: t, activa, onPress }: { texto: string; activa: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      style={({ pressed }) => [s.pastilla, activa && s.pastillaActiva, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.pastillaTexto, activa && { color: '#FFFFFF' }]}>{t}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: radio.s, paddingHorizontal: 8, paddingVertical: 2 },
  chipTexto: { fontSize: texto.mini, fontWeight: '700' },
  fila: {
    flexDirection: 'row',
    gap: espacio.m,
    paddingVertical: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  bloqueo: { backgroundColor: '#F1F3F5', borderRadius: radio.s, paddingHorizontal: espacio.s, borderBottomWidth: 0, marginVertical: 2 },
  hora: { width: 58, alignItems: 'flex-start' },
  fecha: { fontSize: texto.mini, fontWeight: '700', color: colores.primario },
  horaTexto: { fontSize: texto.normal, fontWeight: '800', color: colores.texto, fontVariant: ['tabular-nums'] },
  horaFin: { fontSize: texto.mini, color: colores.textoSuave, fontVariant: ['tabular-nums'] },
  nombre: { fontSize: texto.normal, fontWeight: '700', color: colores.texto },
  detalle: { fontSize: texto.pequeno, color: colores.textoSuave },
  flecha: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  flechaTexto: { fontSize: 22, color: colores.primario, fontWeight: '700', marginTop: -2 },
  pastilla: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    minWidth: 64,
    alignItems: 'center',
  },
  pastillaActiva: { backgroundColor: colores.primario, borderColor: colores.primario },
  pastillaTexto: { fontSize: texto.pequeno, fontWeight: '700', color: colores.texto, fontVariant: ['tabular-nums'] },
});
