// Sincronización entre el teléfono y la computadora: activar con la cuenta del médico, ver el estado y los avisos.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { textoFechaHora } from '../src/domain/fechas';
import { validarContrasena } from '../src/respaldo/formato';
import { escuchar } from '../src/sincronizacion/eventos';
import { Aviso as AvisoSync, borrarAvisos, desactivarSincronizacion, leerAvisos, ModoActivacion } from '../src/sincronizacion/motor';
import {
  activarYSincronizar,
  CuentaPreparada,
  EstadoSync,
  leerEstadoSync,
  leerServidorGuardado,
  modoAutomatico,
  prepararCuenta,
  sincronizarAhora,
} from '../src/sincronizacion/servicio';
import { ConfigServidor, validarConfigServidor } from '../src/sincronizacion/supabase';
import { Aviso, Boton, Campo, Cargando, EnlaceTexto, PantallaFormulario, Seccion, Selector, estilos } from '../src/ui/componentes';
import { Alert } from '../src/ui/dialogo';
import { ESTE_EQUIPO } from '../src/ui/plataforma';
import { colores, espacio, texto } from '../src/ui/tema';

function haceCuanto(iso: string | null): string {
  if (!iso) return 'todavía no';
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'hace menos de un minuto';
  if (min < 60) return `hace ${min} min`;
  return textoFechaHora(iso);
}

export default function Sincronizacion() {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<EstadoSync | null>(null);
  const [avisos, setAvisos] = useState<AvisoSync[]>([]);
  const [servidor, setServidor] = useState<ConfigServidor>({ url: '', clavePublica: '' });
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [progreso, setProgreso] = useState<string | null>(null);
  const [preparada, setPreparada] = useState<CuentaPreparada | null>(null);

  const cargar = useCallback(async () => {
    setEstado(await leerEstadoSync(db));
    setAvisos(await leerAvisos(db));
  }, [db]);

  useEffect(() => {
    void cargar();
    void leerServidorGuardado(db).then(setServidor);
    const quitar = escuchar('estado', () => void cargar());
    // Para que "hace X min" se mantenga al día.
    const intervalo = setInterval(() => void cargar(), 30_000);
    return () => {
      quitar();
      clearInterval(intervalo);
    };
  }, [db, cargar]);

  if (!estado) return <Cargando />;
  const ocupado = progreso !== null;

  async function continuar() {
    const errorServidor = validarConfigServidor(servidor);
    if (errorServidor) return Alert.alert('Servidor', errorServidor);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return Alert.alert('Correo', 'Escriba un correo válido.');
    if (modo === 'crear') {
      const e = validarContrasena(contrasena, confirmacion);
      if (e) return Alert.alert('Contraseña', e);
    } else if (!contrasena) {
      return Alert.alert('Contraseña', 'Escriba la contraseña de la cuenta.');
    }
    try {
      setProgreso('Protegiendo la contraseña… 0 %');
      const p = await prepararCuenta(db, { servidor, correo, contrasena, crear: modo === 'crear' }, (f) =>
        setProgreso(`Protegiendo la contraseña… ${Math.round(f * 100)} %`),
      );
      setProgreso(null);
      if (!p) {
        setModo('entrar');
        setConfirmacion('');
        Alert.alert(
          'Confirme su correo',
          'Supabase le envió un correo. Ábralo y toque el enlace de confirmación (si la página que se abre muestra un error, no importa). Luego vuelva aquí y toque "Entrar".',
        );
        return;
      }
      const automatico = modoAutomatico(p);
      if (automatico) await activar(p, automatico);
      else setPreparada(p);
    } catch (e) {
      setProgreso(null);
      Alert.alert('No se pudo conectar', e instanceof Error ? e.message : String(e));
    }
  }

  async function activar(p: CuentaPreparada, m: ModoActivacion) {
    try {
      setProgreso(m === 'reemplazar' ? 'Recibiendo los datos del servidor…' : 'Enviando los datos de este equipo…');
      await activarYSincronizar(db, p, m);
      setProgreso(null);
      setPreparada(null);
      setContrasena('');
      setConfirmacion('');
      await cargar();
      const e = await leerEstadoSync(db);
      if (e.error) Alert.alert('Sincronización activada', `Quedó activada, pero la primera sincronización no terminó: ${e.error}`);
      else Alert.alert('Sincronización activada', 'Los cambios de este equipo y de los demás se compartirán automáticamente mientras la app esté abierta.');
    } catch (e) {
      setProgreso(null);
      Alert.alert('No se pudo activar', e instanceof Error ? e.message : String(e));
    }
  }

  function elegirReemplazar(p: CuentaPreparada) {
    Alert.alert(
      'Borrar los datos de este equipo',
      `Se borrarán los expedientes, consultas y citas de ${ESTE_EQUIPO.toLowerCase()} y se reemplazarán por los del servidor. Si tienen algo que no está en el otro equipo, haga primero un respaldo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar y recibir', style: 'destructive', onPress: () => void activar(p, 'reemplazar') },
      ],
    );
  }

  function desactivar() {
    Alert.alert(
      'Desactivar en este equipo',
      'Este equipo dejará de enviar y recibir cambios. Sus datos se quedan en este equipo y los del servidor no se borran. Para volver a activarla necesitará la contraseña.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            await desactivarSincronizacion(db);
            await cargar();
          },
        },
      ],
    );
  }

  // ---------- Activa ----------
  if (estado.activo) {
    return (
      <PantallaFormulario>
        <Seccion titulo="Sincronización activa">
          <Text style={estilos.normal}>Cuenta: {estado.correo}</Text>
          <Text style={estilos.normal}>
            Última sincronización: {estado.sincronizando ? 'sincronizando…' : haceCuanto(estado.ultimo)}
          </Text>
          <Text style={[estilos.normal, estado.pendientes > 0 && { color: colores.aviso, fontWeight: '700' }]}>
            {estado.pendientes === 0
              ? 'Todos los cambios de este equipo están enviados.'
              : `${estado.pendientes} ${estado.pendientes === 1 ? 'cambio espera' : 'cambios esperan'} para enviarse.`}
          </Text>
          {estado.error && (
            <View style={{ marginTop: espacio.m }}>
              <Aviso>{estado.error}</Aviso>
            </View>
          )}
          <Boton texto={estado.sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'} onPress={() => void sincronizarAhora(db).then(cargar)} deshabilitado={estado.sincronizando} />
        </Seccion>

        {avisos.length > 0 && (
          <Seccion titulo="Avisos de la sincronización" accion={<EnlaceTexto texto="Marcar como leídos" onPress={() => void borrarAvisos(db).then(cargar)} />}>
            <View style={{ gap: espacio.s }}>
              {avisos.map((a) => (
                <View key={a.id}>
                  <Text style={estilos.pequeno}>{a.mensaje}</Text>
                  <Text style={[estilos.suave, { fontSize: texto.mini }]}>{textoFechaHora(a.momento)}</Text>
                </View>
              ))}
            </View>
          </Seccion>
        )}

        <Seccion titulo="Cómo funciona">
          <View style={{ gap: espacio.s }}>
            <Text style={estilos.pequeno}>
              Cada equipo guarda todos los datos y funciona sin internet. Mientras la app está abierta, los cambios se envían en pocos segundos y se reciben los de los
              demás equipos cada minuto.
            </Text>
            <Text style={estilos.pequeno}>
              Los datos viajan y se guardan cifrados con su contraseña (cifrado de extremo a extremo): el servidor no puede leerlos.
            </Text>
            <Text style={estilos.pequeno}>
              Si el mismo expediente se cambia en dos equipos, se conserva el cambio más reciente. Las consultas nunca se pierden porque no se modifican.
            </Text>
          </View>
        </Seccion>

        <Boton texto="Desactivar en este equipo" variante="peligro" onPress={desactivar} />
      </PantallaFormulario>
    );
  }

  // ---------- Elegir qué hacer cuando hay datos en los dos lados ----------
  if (preparada) {
    return (
      <PantallaFormulario>
        <Seccion titulo="Hay datos en los dos lados">
          <Text style={[estilos.pequeno, { marginBottom: espacio.m }]}>
            Su cuenta ya tiene datos de otro equipo, y {ESTE_EQUIPO.toLowerCase()} también tiene datos. Elija qué hacer:
          </Text>
          <Boton texto="Usar los datos del servidor (recomendado)" onPress={() => elegirReemplazar(preparada)} deshabilitado={ocupado} />
          <Text style={[estilos.suave, { marginBottom: espacio.m }]}>
            Borra los datos de este equipo y recibe los del otro. Úselo si este equipo solo tiene pacientes de demostración o datos viejos.
          </Text>
          <Boton texto="Combinar los datos de los dos" variante="secundario" onPress={() => void activar(preparada, 'combinar')} deshabilitado={ocupado} />
          <Text style={[estilos.suave, { marginBottom: espacio.m }]}>
            Junta ambos. Si un mismo expediente está en los dos, queda la versión más reciente. Si los dos tienen pacientes de demostración, quedarán repetidos.
          </Text>
          <EnlaceTexto texto="Cancelar" onPress={() => setPreparada(null)} />
        </Seccion>
        {progreso && <Aviso tono="info">{progreso}</Aviso>}
      </PantallaFormulario>
    );
  }

  // ---------- Sin activar ----------
  return (
    <PantallaFormulario>
      <Seccion titulo="Compartir los datos entre equipos">
        <Text style={estilos.pequeno}>
          Active la sincronización en el teléfono y en la computadora con la misma cuenta. Los expedientes, consultas, citas y ajustes se mantienen iguales en
          todos los equipos. Usa el plan gratuito de Supabase.
        </Text>
      </Seccion>

      <Seccion titulo="Servidor (Supabase)">
        <Campo
          etiqueta="Dirección del proyecto (Project URL)"
          value={servidor.url}
          onChangeText={(v) => setServidor((s) => ({ ...s, url: v }))}
          placeholder="https://abcd1234.supabase.co"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Campo
          etiqueta="Clave pública (publishable key)"
          value={servidor.clavePublica}
          onChangeText={(v) => setServidor((s) => ({ ...s, clavePublica: v }))}
          placeholder="sb_publishable_…"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[estilos.suave, { fontSize: texto.mini }]}>
          Están en supabase.com → su proyecto → Project Settings → API Keys. La clave pública no es secreta. En el iPhone puede pegarlas copiándolas en la Mac.
        </Text>
      </Seccion>

      <Seccion titulo="Su cuenta">
        <Selector<'entrar' | 'crear'>
          etiqueta="¿Ya creó su cuenta en otro equipo?"
          opciones={[
            { valor: 'entrar', texto: 'Sí, entrar' },
            { valor: 'crear', texto: 'No, crear cuenta' },
          ]}
          valor={modo}
          alCambiar={setModo}
        />
        <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <Campo etiqueta="Contraseña" value={contrasena} onChangeText={setContrasena} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        {modo === 'crear' && (
          <Campo etiqueta="Repita la contraseña" value={confirmacion} onChangeText={setConfirmacion} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        )}
        <Aviso>
          Esta contraseña también cifra los datos: si se olvida, nadie puede recuperarla y habría que crear una cuenta nueva desde un equipo que tenga los datos.
          Anótela en un lugar seguro. Use la misma en todos sus equipos.
        </Aviso>
        {progreso && <Aviso tono="info">{progreso}</Aviso>}
        <Boton texto={modo === 'crear' ? 'Crear cuenta y activar' : 'Entrar y activar'} onPress={() => void continuar()} deshabilitado={ocupado} />
      </Seccion>

      <EnlaceTexto texto="Ver respaldos" onPress={() => router.push('/respaldo')} />
    </PantallaFormulario>
  );
}
