// Formulario de datos personales del paciente (se usa para crear y para editar).

import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { aISO, calcularEdad, hoy, isoATextoUsuario, leerFechaUsuario, textoEdad } from '../domain/fechas';
import type { Paciente, PacienteEntrada } from '../domain/types';
import { leerNumero, Problema, validarPaciente } from '../domain/validacion';
import { Boton, Campo, Interruptor, ListaProblemas, PantallaFormulario, Seccion, Selector, estilos } from './componentes';

interface Estado {
  numeroExpediente: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: '' | 'F' | 'M';
  semanasGestacion: string;
  sindromeDown: boolean;
  responsableNombre: string;
  responsableParentesco: string;
  telefonoPrincipal: string;
  telefonoSecundario: string;
  whatsapp: string;
  correo: string;
  direccion: string;
  emergenciaNombre: string;
  emergenciaTelefono: string;
  consentimientoDatos: boolean;
  consentimientoWhatsapp: boolean;
}

function estadoInicial(p?: Paciente, numeroSugerido = ''): Estado {
  return {
    numeroExpediente: p?.numeroExpediente ?? numeroSugerido,
    nombres: p?.nombres ?? '',
    apellidos: p?.apellidos ?? '',
    fechaNacimiento: p ? isoATextoUsuario(p.fechaNacimiento) : '',
    sexo: p?.sexo ?? '',
    semanasGestacion: p?.semanasGestacion != null ? String(p.semanasGestacion) : '',
    sindromeDown: p?.sindromeDown ?? false,
    responsableNombre: p?.responsableNombre ?? '',
    responsableParentesco: p?.responsableParentesco ?? '',
    telefonoPrincipal: p?.telefonoPrincipal ?? '',
    telefonoSecundario: p?.telefonoSecundario ?? '',
    whatsapp: p?.whatsapp ?? '',
    correo: p?.correo ?? '',
    direccion: p?.direccion ?? '',
    emergenciaNombre: p?.emergenciaNombre ?? '',
    emergenciaTelefono: p?.emergenciaTelefono ?? '',
    consentimientoDatos: p?.consentimientoDatos ?? false,
    consentimientoWhatsapp: p?.consentimientoWhatsapp ?? false,
  };
}

export function FormularioPaciente({
  paciente,
  numeroSugerido,
  textoGuardar,
  alGuardar,
}: {
  paciente?: Paciente;
  numeroSugerido?: string;
  textoGuardar: string;
  alGuardar: (datos: PacienteEntrada) => Promise<void>;
}) {
  const [e, setE] = useState<Estado>(() => estadoInicial(paciente, numeroSugerido));
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cambiar = <K extends keyof Estado>(campo: K) => (valor: Estado[K]) => setE((prev) => ({ ...prev, [campo]: valor }));
  const problemaDe = (campo: string) => problemas.find((p) => p.campo === campo);

  const nacimiento = leerFechaUsuario(e.fechaNacimiento);
  const edad = nacimiento ? calcularEdad(nacimiento, hoy()) : null;

  async function guardarDefinitivo() {
    const nac = leerFechaUsuario(e.fechaNacimiento);
    if (!nac || !e.sexo) return;
    setGuardando(true);
    try {
      await alGuardar({
        numeroExpediente: e.numeroExpediente,
        nombres: e.nombres,
        apellidos: e.apellidos,
        fechaNacimiento: aISO(nac),
        sexo: e.sexo,
        semanasGestacion: leerNumero(e.semanasGestacion),
        sindromeDown: e.sindromeDown,
        responsableNombre: e.responsableNombre,
        responsableParentesco: e.responsableParentesco,
        telefonoPrincipal: e.telefonoPrincipal,
        telefonoSecundario: e.telefonoSecundario,
        whatsapp: e.whatsapp,
        correo: e.correo,
        direccion: e.direccion,
        emergenciaNombre: e.emergenciaNombre,
        emergenciaTelefono: e.emergenciaTelefono,
        consentimientoDatos: e.consentimientoDatos,
        consentimientoWhatsapp: e.consentimientoWhatsapp,
      });
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : String(error));
    } finally {
      setGuardando(false);
    }
  }

  function guardar() {
    const encontrados = validarPaciente(e);
    setProblemas(encontrados);
    if (encontrados.some((p) => p.nivel === 'error')) {
      Alert.alert('Faltan datos', 'Revise los campos marcados en rojo.');
      return;
    }
    if (encontrados.length > 0) {
      Alert.alert('Revise los avisos', encontrados.map((p) => `• ${p.mensaje}`).join('\n'), [
        { text: 'Corregir', style: 'cancel' },
        { text: 'Guardar de todos modos', onPress: guardarDefinitivo },
      ]);
      return;
    }
    void guardarDefinitivo();
  }

  return (
    <PantallaFormulario>
      <ListaProblemas problemas={problemas} />

      <Seccion titulo="Identificación">
        <Campo etiqueta="Número de expediente" value={e.numeroExpediente} onChangeText={cambiar('numeroExpediente')} autoCapitalize="characters" problema={problemaDe('numeroExpediente')} />
        <Campo etiqueta="Nombres" value={e.nombres} onChangeText={cambiar('nombres')} autoCapitalize="words" problema={problemaDe('nombres')} />
        <Campo etiqueta="Apellidos" value={e.apellidos} onChangeText={cambiar('apellidos')} autoCapitalize="words" problema={problemaDe('apellidos')} />
        <Campo
          etiqueta="Fecha de nacimiento"
          value={e.fechaNacimiento}
          onChangeText={cambiar('fechaNacimiento')}
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
          problema={problemaDe('fechaNacimiento')}
          ayuda={edad ? `Edad: ${textoEdad(edad)}` : 'Ejemplo: 05/03/2024'}
        />
        <Selector
          etiqueta="Sexo (para las referencias de crecimiento)"
          opciones={[
            { valor: 'F', texto: 'Femenino' },
            { valor: 'M', texto: 'Masculino' },
          ]}
          valor={e.sexo}
          alCambiar={cambiar('sexo')}
          problema={problemaDe('sexo')}
        />
        <Campo
          etiqueta="Semanas de gestación al nacer (opcional)"
          value={e.semanasGestacion}
          onChangeText={cambiar('semanasGestacion')}
          keyboardType="number-pad"
          unidad="sem"
          problema={problemaDe('semanasGestacion')}
          ayuda="Si nació antes de las 37 semanas se usará para la edad corregida."
        />
        <Interruptor
          etiqueta="Síndrome de Down (usar curvas de crecimiento específicas del CDC)"
          valor={e.sindromeDown}
          alCambiar={cambiar('sindromeDown')}
        />
      </Seccion>

      <Seccion titulo="Responsable y contacto">
        <Campo etiqueta="Nombre del padre, madre o responsable" value={e.responsableNombre} onChangeText={cambiar('responsableNombre')} autoCapitalize="words" />
        <Campo etiqueta="Parentesco" value={e.responsableParentesco} onChangeText={cambiar('responsableParentesco')} placeholder="Madre, padre, abuela…" autoCapitalize="sentences" />
        <Campo etiqueta="Teléfono principal" value={e.telefonoPrincipal} onChangeText={cambiar('telefonoPrincipal')} keyboardType="phone-pad" problema={problemaDe('telefonoPrincipal')} />
        <Campo etiqueta="Teléfono secundario" value={e.telefonoSecundario} onChangeText={cambiar('telefonoSecundario')} keyboardType="phone-pad" />
        <Campo
          etiqueta="WhatsApp del responsable"
          value={e.whatsapp}
          onChangeText={cambiar('whatsapp')}
          keyboardType="phone-pad"
          placeholder="504 9999-9999"
          ayuda="Incluya el código de país."
          problema={problemaDe('whatsapp')}
        />
        <Campo etiqueta="Correo electrónico" value={e.correo} onChangeText={cambiar('correo')} keyboardType="email-address" autoCapitalize="none" problema={problemaDe('correo')} />
        <Campo etiqueta="Dirección" value={e.direccion} onChangeText={cambiar('direccion')} multiline />
      </Seccion>

      <Seccion titulo="Contacto de emergencia">
        <Campo etiqueta="Nombre" value={e.emergenciaNombre} onChangeText={cambiar('emergenciaNombre')} autoCapitalize="words" />
        <Campo etiqueta="Teléfono" value={e.emergenciaTelefono} onChangeText={cambiar('emergenciaTelefono')} keyboardType="phone-pad" />
      </Seccion>

      <Seccion titulo="Consentimientos">
        <Interruptor etiqueta="El responsable autorizó el registro y manejo de los datos clínicos" valor={e.consentimientoDatos} alCambiar={cambiar('consentimientoDatos')} />
        <Interruptor etiqueta="El responsable autorizó recibir mensajes administrativos por WhatsApp" valor={e.consentimientoWhatsapp} alCambiar={cambiar('consentimientoWhatsapp')} />
        <Text style={[estilos.suave, { marginTop: 8 }]}>
          Registre aquí solo autorizaciones que el responsable haya dado de forma explícita.
        </Text>
      </Seccion>

      <Boton texto={guardando ? 'Guardando…' : textoGuardar} onPress={guardar} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}
