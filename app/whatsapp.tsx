// Mensaje de WhatsApp a un responsable. ?pacienteId=… y/o ?citaId=…
// El mensaje se puede revisar y cambiar antes de abrir WhatsApp.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { fechaDeMomento, horaDeMomento } from '../src/agenda/tiempo';
import { Cita } from '../src/agenda/tipos';
import { obtenerCita } from '../src/db/agenda';
import { obtenerPaciente } from '../src/db/pacientes';
import { leerConfigMensajes, registrarMensaje } from '../src/db/seguimiento';
import type { Paciente } from '../src/domain/types';
import {
  ConfigMensajes,
  NOMBRE_TIPO_MENSAJE,
  normalizarTelefono,
  primerNombre,
  rellenarPlantilla,
  TipoMensaje,
} from '../src/seguimiento/mensajes';
import { Aviso, Boton, Campo, Cargando, Dato, PantallaFormulario, Seccion, Selector, estilos } from '../src/ui/componentes';
import { abrirWhatsApp } from '../src/ui/whatsapp';

export default function MensajeWhatsApp() {
  const params = useLocalSearchParams<{ pacienteId?: string; citaId?: string }>();
  const db = useSQLiteContext();
  const [cfg, setCfg] = useState<ConfigMensajes | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [cita, setCita] = useState<Cita | null>(null);
  const [tipo, setTipo] = useState<TipoMensaje>(params.citaId ? 'recordatorio' : 'general');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    void (async () => {
      const config = await leerConfigMensajes(db);
      const c = params.citaId ? await obtenerCita(db, params.citaId) : null;
      const pid = params.pacienteId ?? c?.pacienteId ?? null;
      const p = pid ? await obtenerPaciente(db, pid) : null;
      setCfg(config);
      setCita(c);
      setPaciente(p);
    })();
  }, [db, params.citaId, params.pacienteId]);

  const nombre = paciente ? primerNombre(paciente.nombres) : primerNombre(cita?.nombreContacto ?? '');

  // Rellenar la plantilla al cargar y al cambiar el tipo de mensaje.
  useEffect(() => {
    if (!cfg) return;
    setTexto(
      rellenarPlantilla(cfg.plantillas[tipo], {
        nombre,
        fecha: cita ? fechaDeMomento(cita.inicio) : null,
        hora: cita ? horaDeMomento(cita.inicio) : null,
        consultorio: cfg.nombreConsultorio,
        horaActual: new Date().getHours(),
      }),
    );
  }, [cfg, tipo, cita, nombre]);

  if (!cfg) return <Cargando />;

  const telefono = paciente ? paciente.whatsapp || paciente.telefonoPrincipal : cita?.telefonoContacto ?? '';
  const numero = normalizarTelefono(telefono, cfg.codigoPais);
  // Sin expediente: es la persona que pidió la cita y dejó su número.
  const autorizado = paciente ? paciente.consentimientoWhatsapp : true;
  const tipos: TipoMensaje[] = cita ? ['recordatorio', 'propuesta', 'general'] : ['general'];

  async function abrir() {
    if (!numero) return;
    if (await abrirWhatsApp(numero, texto)) {
      await registrarMensaje(db, { pacienteId: paciente?.id ?? null, citaId: cita?.id ?? null, tipo, telefono: numero });
      router.back();
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Para">
        <Dato
          etiqueta="Paciente"
          valor={paciente ? `${paciente.nombres} ${paciente.apellidos}` : cita?.nombreContacto ?? ''}
        />
        {paciente && <Dato etiqueta="Responsable" valor={paciente.responsableNombre} />}
        <Dato etiqueta="WhatsApp" valor={numero ? `+${numero}` : telefono || 'Sin número'} />
      </Seccion>

      {!autorizado && paciente && (
        <>
          <Aviso>
            El responsable no ha autorizado mensajes por WhatsApp. Registre la autorización en el expediente antes de escribirle.
          </Aviso>
          <Boton
            texto="Registrar autorización"
            variante="secundario"
            onPress={() => router.push({ pathname: '/pacientes/[id]/editar', params: { id: paciente.id } })}
          />
        </>
      )}
      {!numero && <Aviso>No hay un número válido. Incluya el número de WhatsApp en el expediente.</Aviso>}

      <Seccion titulo="Mensaje">
        {tipos.length > 1 && (
          <Selector<TipoMensaje>
            etiqueta="Tipo"
            opciones={tipos.map((t) => ({ valor: t, texto: t === 'recordatorio' ? 'Recordatorio' : t === 'propuesta' ? 'Propuesta' : 'General' }))}
            valor={tipo}
            alCambiar={setTipo}
          />
        )}
        <Campo etiqueta={NOMBRE_TIPO_MENSAJE[tipo]} value={texto} onChangeText={setTexto} multiline autoCapitalize="sentences" />
        <Text style={estilos.suave}>
          Solo mensajes administrativos: no incluya diagnósticos, resultados ni información clínica.
        </Text>
      </Seccion>

      <Boton texto="Abrir WhatsApp" onPress={() => void abrir()} deshabilitado={!numero || !autorizado || !texto.trim()} />
    </PantallaFormulario>
  );
}
