// Componentes visuales reutilizables.

import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Problema } from '../domain/validacion';
import { colores, espacio, radio, texto } from './tema';

/** Pantalla con desplazamiento que no queda tapada por el teclado. */
export function PantallaFormulario({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function PantallaSimple({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      {children}
    </ScrollView>
  );
}

export function Cargando() {
  return (
    <SafeAreaView style={[estilos.pantalla, estilos.centro]}>
      <ActivityIndicator size="large" color={colores.primario} />
    </SafeAreaView>
  );
}

export function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <View style={estilos.seccion}>
      <View style={estilos.seccionCabecera}>
        <Text style={estilos.seccionTitulo}>{titulo}</Text>
        {accion}
      </View>
      {children}
    </View>
  );
}

interface CampoProps extends TextInputProps {
  etiqueta: string;
  ayuda?: string;
  problema?: Problema;
  unidad?: string;
}

export function Campo({ etiqueta, ayuda, problema, unidad, multiline, style, ...resto }: CampoProps) {
  const colorBorde = problema ? (problema.nivel === 'error' ? colores.peligro : colores.aviso) : colores.borde;
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={[estilos.entradaFila, { borderColor: colorBorde }]}>
        <TextInput
          style={[estilos.entrada, multiline && estilos.entradaMultilinea, style]}
          placeholderTextColor="#98A6B0"
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...resto}
        />
        {unidad ? <Text style={estilos.unidad}>{unidad}</Text> : null}
      </View>
      {problema ? (
        <Text style={[estilos.mensajeCampo, { color: problema.nivel === 'error' ? colores.peligro : colores.aviso }]}>
          {problema.mensaje}
        </Text>
      ) : ayuda ? (
        <Text style={estilos.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

export function Selector<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  problema,
}: {
  etiqueta: string;
  opciones: { valor: T; texto: string }[];
  valor: T | '';
  alCambiar: (v: T) => void;
  problema?: Problema;
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={estilos.selector}>
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              onPress={() => alCambiar(o.valor)}
              style={[estilos.opcion, activo && estilos.opcionActiva]}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
            >
              <Text style={[estilos.opcionTexto, activo && estilos.opcionTextoActivo]}>{o.texto}</Text>
            </Pressable>
          );
        })}
      </View>
      {problema ? (
        <Text style={[estilos.mensajeCampo, { color: problema.nivel === 'error' ? colores.peligro : colores.aviso }]}>
          {problema.mensaje}
        </Text>
      ) : null}
    </View>
  );
}

export function Interruptor({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <View style={estilos.interruptor}>
      <Text style={[estilos.normal, { flex: 1 }]}>{etiqueta}</Text>
      <Switch value={valor} onValueChange={alCambiar} trackColor={{ true: colores.primario, false: colores.borde }} />
    </View>
  );
}

export function Boton({
  texto: t,
  onPress,
  variante = 'primario',
  deshabilitado,
}: {
  texto: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.boton,
        variante === 'primario' && estilos.botonPrimario,
        variante === 'secundario' && estilos.botonSecundario,
        variante === 'peligro' && estilos.botonPeligro,
        (pressed || deshabilitado) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          estilos.botonTexto,
          variante === 'secundario' && { color: colores.primario },
          variante === 'peligro' && { color: colores.peligro },
        ]}
      >
        {t}
      </Text>
    </Pressable>
  );
}

export function EnlaceTexto({ texto: t, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <Text style={estilos.enlace}>{t}</Text>
    </Pressable>
  );
}

export function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | number | null }) {
  const vacio = valor === null || valor === undefined || valor === '';
  return (
    <View style={estilos.dato}>
      <Text style={estilos.datoEtiqueta}>{etiqueta}</Text>
      <Text style={[estilos.datoValor, vacio && { color: colores.textoSuave }]}>{vacio ? '—' : String(valor)}</Text>
    </View>
  );
}

/** Lista de errores y avisos de validación. */
export function ListaProblemas({ problemas }: { problemas: Problema[] }) {
  if (problemas.length === 0) return null;
  const errores = problemas.filter((p) => p.nivel === 'error');
  const avisos = problemas.filter((p) => p.nivel === 'aviso');
  return (
    <View style={{ gap: espacio.s, marginBottom: espacio.m }}>
      {errores.length > 0 && (
        <View style={[estilos.caja, { backgroundColor: colores.peligroSuave, borderColor: colores.peligro }]}>
          <Text style={[estilos.cajaTitulo, { color: colores.peligro }]}>Corrija antes de guardar</Text>
          {errores.map((p, i) => (
            <Text key={i} style={estilos.pequeno}>• {p.mensaje}</Text>
          ))}
        </View>
      )}
      {avisos.length > 0 && (
        <View style={[estilos.caja, { backgroundColor: colores.avisoSuave, borderColor: colores.aviso }]}>
          <Text style={[estilos.cajaTitulo, { color: colores.aviso }]}>Revise estos datos</Text>
          {avisos.map((p, i) => (
            <Text key={i} style={estilos.pequeno}>• {p.mensaje}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function Aviso({ children, tono = 'aviso' }: { children: ReactNode; tono?: 'aviso' | 'info' }) {
  const fondo = tono === 'aviso' ? colores.avisoSuave : colores.primarioSuave;
  const borde = tono === 'aviso' ? colores.aviso : colores.primario;
  return (
    <View style={[estilos.caja, { backgroundColor: fondo, borderColor: borde, marginBottom: espacio.m }]}>
      <Text style={estilos.pequeno}>{children}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: espacio.l, paddingBottom: 48 },
  centro: { alignItems: 'center', justifyContent: 'center' },
  normal: { fontSize: texto.normal, color: colores.texto },
  pequeno: { fontSize: texto.pequeno, color: colores.texto, lineHeight: 20 },
  suave: { fontSize: texto.pequeno, color: colores.textoSuave },
  seccion: {
    backgroundColor: colores.superficie,
    borderRadius: radio.l,
    padding: espacio.l,
    marginBottom: espacio.l,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  seccionCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espacio.m },
  seccionTitulo: { fontSize: texto.subtitulo, fontWeight: '700', color: colores.texto },
  campo: { marginBottom: espacio.m },
  etiqueta: { fontSize: texto.pequeno, fontWeight: '600', color: colores.textoSuave, marginBottom: espacio.xs },
  entradaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radio.s,
    backgroundColor: colores.superficie,
  },
  entrada: { flex: 1, fontSize: texto.normal, color: colores.texto, paddingHorizontal: espacio.m, paddingVertical: 10, minHeight: 44 },
  entradaMultilinea: { minHeight: 88 },
  unidad: { paddingRight: espacio.m, color: colores.textoSuave, fontSize: texto.pequeno },
  ayuda: { fontSize: texto.mini, color: colores.textoSuave, marginTop: espacio.xs },
  mensajeCampo: { fontSize: texto.mini, marginTop: espacio.xs, fontWeight: '600' },
  selector: { flexDirection: 'row', gap: espacio.s },
  opcion: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radio.s,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  opcionActiva: { backgroundColor: colores.primario, borderColor: colores.primario },
  opcionTexto: { fontSize: texto.normal, color: colores.texto },
  opcionTextoActivo: { color: '#FFFFFF', fontWeight: '600' },
  interruptor: { flexDirection: 'row', alignItems: 'center', paddingVertical: espacio.s, gap: espacio.m },
  boton: { borderRadius: radio.m, paddingVertical: 14, alignItems: 'center', marginTop: espacio.s },
  botonPrimario: { backgroundColor: colores.primario },
  botonSecundario: { backgroundColor: colores.primarioSuave },
  botonPeligro: { backgroundColor: colores.peligroSuave },
  botonTexto: { color: '#FFFFFF', fontSize: texto.normal, fontWeight: '700' },
  enlace: { color: colores.primario, fontSize: texto.pequeno, fontWeight: '700' },
  dato: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.borde },
  datoEtiqueta: { fontSize: texto.mini, color: colores.textoSuave, fontWeight: '600' },
  datoValor: { fontSize: texto.normal, color: colores.texto, marginTop: 2 },
  caja: { borderWidth: 1, borderRadius: radio.m, padding: espacio.m, gap: 2 },
  cajaTitulo: { fontSize: texto.pequeno, fontWeight: '700', marginBottom: 2 },
});
