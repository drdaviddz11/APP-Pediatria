// Expediente del paciente: datos, historia clínica y consultas en orden cronológico.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffectConSync } from '../../../src/sincronizacion/eventos';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ahoraMomento } from '../../../src/agenda/tiempo';
import { Cita, esActiva } from '../../../src/agenda/tipos';
import { citasDePaciente } from '../../../src/db/agenda';
import { listarConsultas } from '../../../src/db/consultas';
import { Receta, recetasDePaciente } from '../../../src/db/recetas';
import { fechaReceta } from '../../../src/receta/hoja';
import { FilaCita } from '../../../src/ui/agenda';
import { obtenerHistoria, obtenerPaciente } from '../../../src/db/pacientes';
import { edadDesdeISO, isoATextoCorto, leerFechaISO, textoEdadCorregida, textoFechaHora } from '../../../src/domain/fechas';
import type { Consulta, HistoriaClinica, Paciente } from '../../../src/domain/types';
import { Aviso, Boton, Cargando, Dato, EnlaceTexto, PantallaSimple, Seccion, estilos } from '../../../src/ui/componentes';
import { colores, espacio, radio, texto } from '../../../src/ui/tema';
import { usePlan } from '../../../src/plan/PlanProvider';
import { irAPlanes } from '../../../src/ui/pro';

function medidas(c: Consulta): string {
  const partes: string[] = [];
  if (c.pesoKg != null) partes.push(`${c.pesoKg} kg`);
  if (c.tallaCm != null) partes.push(`${c.tallaCm} cm`);
  if (c.perimetroCefalicoCm != null) partes.push(`PC ${c.perimetroCefalicoCm} cm`);
  return partes.join(' · ');
}

export default function Expediente() {
  const { esPro } = usePlan();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [historia, setHistoria] = useState<HistoriaClinica | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [noExiste, setNoExiste] = useState(false);

  useFocusEffectConSync(
    useCallback(() => {
      let activo = true;
      void (async () => {
        const p = await obtenerPaciente(db, id);
        if (!activo) return;
        if (!p) {
          setNoExiste(true);
          return;
        }
        const [h, c, ci, r] = await Promise.all([
          obtenerHistoria(db, id),
          listarConsultas(db, id),
          citasDePaciente(db, id, ahoraMomento().slice(0, 10)),
          recetasDePaciente(db, id, 10),
        ]);
        if (!activo) return;
        setPaciente(p);
        setHistoria(h);
        setConsultas(c);
        setRecetas(r);
        setCitas(ci.filter((x) => esActiva(x.estado) && x.estado !== 'completada'));
      })();
      return () => {
        activo = false;
      };
    }, [db, id]),
  );

  if (noExiste) {
    return (
      <PantallaSimple>
        <Text style={estilos.normal}>Este expediente ya no existe.</Text>
      </PantallaSimple>
    );
  }
  if (!paciente || !historia) return <Cargando />;

  const nacimiento = leerFechaISO(paciente.fechaNacimiento);
  const edadCorregida = nacimiento ? textoEdadCorregida(nacimiento, paciente.semanasGestacion) : null;
  const alergias = historia.alergias.trim();
  const sinAlergias = alergias === '' || /^(ninguna|niega|no conocid|sin alergi|negad)/i.test(alergias);

  return (
    <PantallaSimple>
      <Stack.Screen options={{ title: paciente.numeroExpediente }} />

      <View style={s.cabecera}>
        <Text style={s.nombre}>
          {paciente.nombres} {paciente.apellidos}
        </Text>
        <Text style={estilos.suave}>
          {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'} · {edadDesdeISO(paciente.fechaNacimiento)} · Nació el{' '}
          {isoATextoCorto(paciente.fechaNacimiento)}
        </Text>
        {paciente.semanasGestacion != null && (
          <Text style={estilos.suave}>
            Nacido a las {paciente.semanasGestacion} semanas
            {edadCorregida ? ` · Edad corregida: ${edadCorregida}` : ''}
          </Text>
        )}
        {paciente.sindromeDown && <Text style={s.etiquetaDown}>Síndrome de Down · curvas de crecimiento CDC para SD</Text>}
        {paciente.esDemo && <Text style={s.etiquetaDemo}>PACIENTE FICTICIO (DEMO)</Text>}
      </View>

      {!sinAlergias && (
        <View style={s.alergias}>
          <Text style={s.alergiasTitulo}>Alergias</Text>
          <Text style={estilos.normal}>{alergias}</Text>
        </View>
      )}

      {!paciente.consentimientoDatos && (
        <Aviso>Falta registrar la autorización del responsable para el manejo de datos clínicos.</Aviso>
      )}

      <Boton
        texto="＋ Nueva consulta"
        onPress={() => router.push({ pathname: '/pacientes/[id]/consulta-nueva', params: { id } })}
      />
      <Boton
        texto="Gráficas de crecimiento"
        variante="secundario"
        onPress={() => router.push({ pathname: '/pacientes/[id]/crecimiento', params: { id } })}
      />
      <Boton
        texto={esPro ? 'Enviar WhatsApp' : 'Enviar WhatsApp 🔒 Pro'}
        variante="secundario"
        onPress={() => (esPro ? router.push({ pathname: '/whatsapp', params: { pacienteId: id } }) : irAPlanes('whatsapp'))}
      />

      <View style={{ height: espacio.l }} />

      <Seccion
        titulo={`Próximas citas (${citas.length})`}
        accion={
          <EnlaceTexto texto="＋ Agendar" onPress={() => router.push({ pathname: '/agenda/nueva', params: { pacienteId: id } })} />
        }
      >
        {citas.length === 0 ? (
          <Text style={estilos.suave}>Sin citas programadas.</Text>
        ) : (
          citas.map((c) => (
            <FilaCita key={c.id} cita={c} conFecha onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: c.id } })} />
          ))
        )}
      </Seccion>

      <Seccion titulo={`Consultas (${consultas.length})`}>
        {consultas.length === 0 ? (
          <Text style={estilos.suave}>Sin consultas registradas.</Text>
        ) : (
          consultas.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [s.consulta, pressed && { opacity: 0.7 }]}
              onPress={() => router.push({ pathname: '/consultas/[id]', params: { id: c.id } })}
            >
              <Text style={s.consultaFecha}>{textoFechaHora(c.fechaHora)}</Text>
              <Text style={estilos.normal} numberOfLines={1}>
                {c.motivo || 'Sin motivo registrado'}
              </Text>
              {c.diagnosticos ? (
                <Text style={estilos.suave} numberOfLines={1}>
                  Dx: {c.diagnosticos}
                </Text>
              ) : null}
              {medidas(c) ? <Text style={estilos.suave}>{medidas(c)}</Text> : null}
            </Pressable>
          ))
        )}
      </Seccion>

      <Seccion
        titulo={`Recetas${recetas.length ? ` (últimas ${recetas.length})` : ''}`}
        accion={
          esPro ? (
            <EnlaceTexto texto="+ Nueva receta" onPress={() => router.push({ pathname: '/recetas/nueva', params: { pacienteId: id } })} />
          ) : (
            <EnlaceTexto texto="🔒 Nueva receta (Pro)" onPress={() => irAPlanes('receta')} />
          )
        }
      >
        {recetas.length === 0 ? (
          <Text style={estilos.suave}>Sin recetas.</Text>
        ) : (
          recetas.map((r) => (
            <Pressable
              key={r.id}
              style={({ pressed }) => [s.consulta, pressed && { opacity: 0.7 }]}
              onPress={() => router.push({ pathname: '/recetas/[id]', params: { id: r.id } })}
            >
              <Text style={s.consultaFecha}>{fechaReceta(new Date(r.fecha))}</Text>
              <Text style={estilos.suave} numberOfLines={1}>
                {r.indicaciones.map((t) => t.split('\n')[0]).join(' · ')}
              </Text>
            </Pressable>
          ))
        )}
      </Seccion>

      <Seccion
        titulo="Historia clínica"
        accion={<EnlaceTexto texto="Editar" onPress={() => router.push({ pathname: '/pacientes/[id]/historia', params: { id } })} />}
      >
        <Dato etiqueta="Alergias" valor={historia.alergias} />
        <Dato etiqueta="Antecedentes personales" valor={historia.antecedentesPersonales} />
        <Dato etiqueta="Antecedentes familiares" valor={historia.antecedentesFamiliares} />
        <Dato etiqueta="Antecedentes perinatales" valor={historia.antecedentesPerinatales} />
        <Dato etiqueta="Antecedentes quirúrgicos" valor={historia.antecedentesQuirurgicos} />
        <Dato etiqueta="Medicamentos actuales" valor={historia.medicamentosActuales} />
        <Dato etiqueta="Vacunas" valor={historia.vacunas} />
        <Dato etiqueta="Hospitalizaciones" valor={historia.hospitalizaciones} />
        <Dato etiqueta="Diagnósticos previos" valor={historia.diagnosticosPrevios} />
      </Seccion>

      <Seccion
        titulo="Responsable y contacto"
        accion={<EnlaceTexto texto="Editar" onPress={() => router.push({ pathname: '/pacientes/[id]/editar', params: { id } })} />}
      >
        <Dato
          etiqueta="Responsable"
          valor={[paciente.responsableNombre, paciente.responsableParentesco && `(${paciente.responsableParentesco})`].filter(Boolean).join(' ')}
        />
        <Dato etiqueta="Teléfono principal" valor={paciente.telefonoPrincipal} />
        <Dato etiqueta="Teléfono secundario" valor={paciente.telefonoSecundario} />
        <Dato etiqueta="WhatsApp" valor={paciente.whatsapp} />
        <Dato etiqueta="Correo" valor={paciente.correo} />
        <Dato etiqueta="Dirección" valor={paciente.direccion} />
        <Dato
          etiqueta="Contacto de emergencia"
          valor={[paciente.emergenciaNombre, paciente.emergenciaTelefono].filter(Boolean).join(' · ')}
        />
        <Dato etiqueta="Autoriza manejo de datos" valor={paciente.consentimientoDatos ? 'Sí' : 'No registrado'} />
        <Dato etiqueta="Autoriza mensajes por WhatsApp" valor={paciente.consentimientoWhatsapp ? 'Sí' : 'No registrado'} />
      </Seccion>
    </PantallaSimple>
  );
}

const s = StyleSheet.create({
  cabecera: { marginBottom: espacio.l, gap: 2 },
  nombre: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  etiquetaDown: { marginTop: espacio.xs, fontSize: texto.mini, fontWeight: '700', color: colores.primario },
  etiquetaDemo: { marginTop: espacio.xs, fontSize: texto.mini, fontWeight: '700', color: colores.aviso },
  alergias: {
    backgroundColor: colores.peligroSuave,
    borderColor: colores.peligro,
    borderWidth: 1,
    borderRadius: radio.m,
    padding: espacio.m,
    marginBottom: espacio.m,
  },
  alergiasTitulo: { color: colores.peligro, fontWeight: '800', fontSize: texto.pequeno, marginBottom: 2 },
  consulta: {
    paddingVertical: espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
    gap: 2,
  },
  consultaFecha: { fontSize: texto.mini, fontWeight: '700', color: colores.primario },
});
