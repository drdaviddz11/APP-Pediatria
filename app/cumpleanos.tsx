// Cumpleaños: quién cumple hoy (para felicitar por WhatsApp, uno tras otro) y quién cumple en los próximos 7 días.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hoyISO, textoFechaCorta } from '../src/agenda/tiempo';
import { CumpleanosPaciente, cumpleanosProximos, registrarFelicitacion } from '../src/db/cumpleanos';
import { leerConfigMensajes } from '../src/db/seguimiento';
import { textoFechaHora } from '../src/domain/fechas';
import { usePlan } from '../src/plan/PlanProvider';
import { textoEdadCumple } from '../src/seguimiento/cumpleanos';
import { ConfigMensajes, normalizarTelefono, primerNombre, rellenarPlantilla } from '../src/seguimiento/mensajes';
import { useFocusEffectConSync } from '../src/sincronizacion/eventos';
import { Aviso, Boton, Cargando, EnlaceTexto, PantallaFormulario, PantallaSimple, Seccion, estilos } from '../src/ui/componentes';
import { irAPlanes } from '../src/ui/pro';
import { colores, espacio } from '../src/ui/tema';
import { Casilla, EnvioEnLote, MensajeEnCola } from '../src/ui/whatsapp';

function numero(c: CumpleanosPaciente, cfg: ConfigMensajes): string | null {
  return normalizarTelefono(c.whatsapp || c.telefonoPrincipal, cfg.codigoPais);
}

/** Por qué no se le puede escribir (null si sí se puede). */
function impedimento(c: CumpleanosPaciente, cfg: ConfigMensajes): string | null {
  if (!c.consentimientoWhatsapp) return 'Sin autorización para WhatsApp';
  if (!numero(c, cfg)) return 'Sin número de WhatsApp válido';
  return null;
}

export default function Cumpleanos() {
  const { esPro } = usePlan();
  const db = useSQLiteContext();
  const hoy = hoyISO();
  const [cfg, setCfg] = useState<ConfigMensajes | null>(null);
  const [lista, setLista] = useState<CumpleanosPaciente[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [cola, setCola] = useState<MensajeEnCola[] | null>(null);

  const cargar = useCallback(() => {
    if (cola) return;
    let vigente = true;
    void (async () => {
      const [c, l] = await Promise.all([leerConfigMensajes(db), cumpleanosProximos(db, hoyISO(), 7)]);
      if (!vigente) return;
      setCfg(c);
      setLista(l);
      // Marcados de inicio: los de hoy que se pueden felicitar y todavía no se felicitaron.
      setMarcados(new Set(l.filter((x) => x.enDias === 0 && !x.felicitado && !impedimento(x, c)).map((x) => x.pacienteId)));
    })();
    return () => {
      vigente = false;
    };
  }, [db, cola]);
  useFocusEffectConSync(cargar);

  if (!cfg) return <Cargando />;
  const config = cfg;
  const deHoy = lista.filter((c) => c.enDias === 0);
  const proximos = lista.filter((c) => c.enDias > 0);
  const elegidos = deHoy.filter((c) => marcados.has(c.pacienteId) && !impedimento(c, config));

  function preparar() {
    if (!esPro) return irAPlanes('whatsapp');
    const horaActual = new Date().getHours();
    const mensajes: MensajeEnCola[] = elegidos.map((c) => ({
      clave: c.pacienteId,
      nombre: `${c.nombres} ${c.apellidos}`,
      detalle: `Cumple ${textoEdadCumple(c.edad)}`,
      numero: numero(c, config) as string,
      texto: rellenarPlantilla(config.plantillas.cumpleanos, {
        nombre: primerNombre(c.nombres),
        edad: textoEdadCumple(c.edad),
        consultorio: config.nombreConsultorio,
        horaActual,
      }),
      tipo: 'cumpleanos',
      pacienteId: c.pacienteId,
      citaId: null,
    }));
    if (mensajes.length > 0) setCola(mensajes);
  }

  async function alAbrir(m: MensajeEnCola) {
    if (m.pacienteId) await registrarFelicitacion(db, m.pacienteId, Number(hoy.slice(0, 4)), m.numero);
  }

  if (cola && esPro) {
    return (
      <PantallaSimple>
        <EnvioEnLote mensajes={cola} alAbrir={alAbrir} alTerminar={() => setCola(null)} />
      </PantallaSimple>
    );
  }

  function alternar(id: string) {
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  return (
    <PantallaFormulario>
      <Seccion titulo={`🎂 Cumplen años hoy (${deHoy.length})`}>
        {deHoy.length === 0 ? (
          <Text style={estilos.suave}>Hoy no cumple años ningún paciente.</Text>
        ) : (
          deHoy.map((c) => {
            const motivo = impedimento(c, config);
            return (
              <View key={c.pacienteId} style={s.fila}>
                <Casilla marcada={marcados.has(c.pacienteId) && !motivo} onPress={() => alternar(c.pacienteId)} deshabilitada={!!motivo} />
                <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/pacientes/[id]', params: { id: c.pacienteId } })}>
                  <Text style={[estilos.normal, { fontWeight: '700' }]}>
                    {c.nombres} {c.apellidos}
                  </Text>
                  <Text style={estilos.suave}>
                    Cumple {textoEdadCumple(c.edad)}
                    {c.felicitado ? ` · ✓ Felicitado (${textoFechaHora(c.felicitado)})` : ''}
                    {motivo ? ` · ${motivo}` : ''}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
        {deHoy.length > 0 && (
          <Boton
            texto={`Felicitar por WhatsApp (${elegidos.length})${esPro ? '' : ' 🔒 Pro'}`}
            onPress={preparar}
            deshabilitado={esPro && elegidos.length === 0}
          />
        )}
      </Seccion>

      <Seccion titulo="Próximos 7 días">
        {proximos.length === 0 ? (
          <Text style={estilos.suave}>Nadie cumple años en los próximos 7 días.</Text>
        ) : (
          proximos.map((c) => (
            <Pressable key={c.pacienteId} style={s.fila} onPress={() => router.push({ pathname: '/pacientes/[id]', params: { id: c.pacienteId } })}>
              <Text style={[estilos.normal, s.fecha]}>{c.enDias === 1 ? 'Mañana' : textoFechaCorta(c.fecha)}</Text>
              <Text style={[estilos.normal, { flex: 1 }]}>
                {c.nombres} {c.apellidos} · {textoEdadCumple(c.edad)}
              </Text>
            </Pressable>
          ))
        )}
      </Seccion>

      <Aviso tono="info">
        Se felicita a los pacientes de 1 a 18 años que autorizaron mensajes por WhatsApp. El mensaje se puede cambiar en Horario
        y ajustes → Mensajes y controles.
      </Aviso>
      <EnlaceTexto texto="Cambiar el mensaje de felicitación" onPress={() => router.push('/configuracion-mensajes')} />
      <View style={{ height: espacio.l }} />
      <Text style={[estilos.suave, { color: colores.textoSuave }]}>Las felicitaciones enviadas quedan anotadas para no repetirlas.</Text>
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s },
  fecha: { width: 96, fontWeight: '700' },
});
