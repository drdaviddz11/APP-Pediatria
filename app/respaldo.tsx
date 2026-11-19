// Respaldo cifrado de todos los datos: crear y guardar (Drive, iCloud, computadora) o restaurar.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Alert } from '../src/ui/dialogo';
import {
  diasDesde,
  exportarDatos,
  InfoRespaldo,
  leerInfoRespaldo,
  registrarRespaldoHecho,
  restaurarDatos,
  resumenActual,
} from '../src/db/respaldo';
import { textoFechaHora } from '../src/domain/fechas';
import { elegirArchivoRespaldo, guardarArchivoRespaldo, INSTRUCCIONES_GUARDAR } from '../src/respaldo/archivos';
import { cifrarRespaldo, descifrarRespaldo } from '../src/respaldo/cifrado';
import { ArchivoDrive, Drive, ErrorDrive, NOMBRE_CARPETA, RESPALDOS_A_GUARDAR, textoTamano } from '../src/respaldo/drive';
import { conectarGoogle, cuentaRecordada, desconectarGoogle, driveActual, driveDisponible } from '../src/respaldo/google';
import { ArchivoRespaldo, leerArchivo, nombreArchivo, ResumenRespaldo, validarContrasena } from '../src/respaldo/formato';
import { Aviso, Boton, Campo, Cargando, EnlaceTexto, PantallaFormulario, Seccion, estilos } from '../src/ui/componentes';
import { EN_COMPUTADORA, ESTE_EQUIPO } from '../src/ui/plataforma';
import { colores, espacio, texto } from '../src/ui/tema';

function textoResumen(r: ResumenRespaldo): string {
  return `${r.pacientes} pacientes · ${r.consultas} consultas · ${r.citas} citas`;
}

export default function Respaldo() {
  const db = useSQLiteContext();
  const [info, setInfo] = useState<InfoRespaldo | null>(null);
  const [actual, setActual] = useState<ResumenRespaldo | null>(null);
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [progreso, setProgreso] = useState<string | null>(null);
  const [elegido, setElegido] = useState<{ nombre: string; archivo: ArchivoRespaldo } | null>(null);
  const [contrasenaRestaurar, setContrasenaRestaurar] = useState('');
  // Google Drive (solo en la computadora por ahora)
  const params = useLocalSearchParams<{ google?: string }>();
  const [avisoGoogle] = useState(params.google ?? null);
  const [drive, setDrive] = useState<Drive | null>(null);
  const [cuenta, setCuenta] = useState<string | null>(null);
  const [enDrive, setEnDrive] = useState<ArchivoDrive[] | null>(null);

  const cargar = useCallback(async () => {
    const [i, r] = await Promise.all([leerInfoRespaldo(db), resumenActual(db)]);
    setInfo(i);
    setActual(r);
    if (driveDisponible()) {
      const d = driveActual();
      setDrive(d);
      setCuenta(cuentaRecordada());
      if (d) {
        try {
          setEnDrive(await d.listar());
        } catch (e) {
          if (e instanceof ErrorDrive && e.sesionVencida) setDrive(null);
          setEnDrive(null);
        }
      }
    }
  }, [db]);

  useEffect(() => {
    // El aviso de Google se muestra una vez; se quita de la dirección para que no vuelva a salir al recargar.
    if (params.google) router.setParams({ google: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  if (!info || !actual) return <Cargando />;
  const ocupado = progreso !== null;
  const dias = diasDesde(info.ultimo);

  async function crearRespaldo() {
    const error = validarContrasena(contrasena, confirmacion);
    if (error) {
      Alert.alert('Contraseña', error);
      return;
    }
    let borrarTemporal: (() => void) | null = null;
    try {
      setProgreso('Preparando datos…');
      const { contenido, resumen } = await exportarDatos(db);
      const cifrado = await cifrarRespaldo(contenido, resumen, contrasena, (f) => setProgreso(`Protegiendo con la contraseña… ${Math.round(f * 100)} %`));
      setProgreso('Guardando archivo…');
      borrarTemporal = await guardarArchivoRespaldo(nombreArchivo(new Date()), JSON.stringify(cifrado));
      setProgreso(null);
      const limpiar = borrarTemporal;
      Alert.alert('¿Se guardó el respaldo?', INSTRUCCIONES_GUARDAR.confirmar, [
        { text: 'No', style: 'cancel', onPress: limpiar },
        {
          text: 'Sí, se guardó',
          onPress: async () => {
            limpiar();
            await registrarRespaldoHecho(db, resumen);
            setContrasena('');
            setConfirmacion('');
            await cargar();
          },
        },
      ]);
    } catch (e) {
      setProgreso(null);
      borrarTemporal?.();
      Alert.alert('No se pudo crear el respaldo', e instanceof Error ? e.message : String(e));
    }
  }

  function errorDrive(titulo: string, e: unknown) {
    setProgreso(null);
    if (e instanceof ErrorDrive && e.sesionVencida) {
      setDrive(null);
      Alert.alert(titulo, 'Por seguridad, la conexión con Google dura una hora en la computadora. Conecte otra vez y repita el paso.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Conectar', onPress: conectarGoogle },
      ]);
      return;
    }
    Alert.alert(titulo, e instanceof Error ? e.message : String(e));
  }

  async function subirADrive() {
    if (!drive) return;
    const error = validarContrasena(contrasena, confirmacion);
    if (error) {
      Alert.alert('Contraseña', error);
      return;
    }
    try {
      setProgreso('Preparando datos…');
      const { contenido, resumen } = await exportarDatos(db);
      const cifrado = await cifrarRespaldo(contenido, resumen, contrasena, (f) => setProgreso(`Protegiendo con la contraseña… ${Math.round(f * 100)} %`));
      setProgreso('Subiendo a Google Drive…');
      const subido = await drive.subir(nombreArchivo(new Date()), JSON.stringify(cifrado));
      await registrarRespaldoHecho(db, resumen);
      try {
        await drive.limpiar();
      } catch {
        // Si no se pudieron quitar los viejos, el respaldo nuevo igual quedó guardado.
      }
      setProgreso(null);
      setContrasena('');
      setConfirmacion('');
      await cargar();
      Alert.alert('Respaldo guardado en Google Drive', `${subido.nombre}
Carpeta: ${NOMBRE_CARPETA}
${textoResumen(resumen)}`);
    } catch (e) {
      errorDrive('No se pudo subir el respaldo', e);
    }
  }

  async function elegirDeDrive(a: ArchivoDrive) {
    if (!drive) return;
    try {
      setProgreso('Descargando de Google Drive…');
      const archivo = leerArchivo(await drive.descargar(a.id));
      setProgreso(null);
      setElegido({ nombre: a.nombre, archivo });
      setContrasenaRestaurar('');
    } catch (e) {
      errorDrive('No se pudo abrir el respaldo', e);
    }
  }

  function desconectar() {
    Alert.alert(
      'Desconectar Google Drive',
      'La app deja de tener permiso en esta computadora. Los respaldos que ya están en su Drive no se borran.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await desconectarGoogle();
            setDrive(null);
            setCuenta(null);
            setEnDrive(null);
          },
        },
      ],
    );
  }

  async function elegirArchivo() {
    try {
      const elegidoArchivo = await elegirArchivoRespaldo();
      if (!elegidoArchivo) return;
      const archivo = leerArchivo(elegidoArchivo.texto);
      setElegido({ nombre: elegidoArchivo.nombre, archivo });
      setContrasenaRestaurar('');
    } catch (e) {
      Alert.alert('No se pudo abrir el archivo', e instanceof Error ? e.message : String(e));
    }
  }

  function confirmarRestaurar() {
    if (!elegido || !actual) return;
    if (!contrasenaRestaurar) {
      Alert.alert('Contraseña', 'Escriba la contraseña con la que se creó el respaldo.');
      return;
    }
    Alert.alert(
      'Reemplazar todos los datos',
      `Los datos de ${ESTE_EQUIPO.toLowerCase()} (${textoResumen(actual)}) se reemplazarán por los del respaldo del ${textoFechaHora(
        elegido.archivo.creado,
      )} (${textoResumen(elegido.archivo.resumen)}).\n\nSi ${ESTE_EQUIPO.toLowerCase()} tiene datos recientes, haga primero un respaldo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', style: 'destructive', onPress: () => void restaurar() },
      ],
    );
  }

  async function restaurar() {
    if (!elegido) return;
    try {
      const contenido = await descifrarRespaldo(elegido.archivo, contrasenaRestaurar, (f) =>
        setProgreso(`Comprobando la contraseña… ${Math.round(f * 100)} %`),
      );
      setProgreso('Restaurando datos…');
      const r = await restaurarDatos(db, contenido);
      setProgreso(null);
      setElegido(null);
      Alert.alert('Respaldo restaurado', textoResumen(r), [{ text: 'Ir al inicio', onPress: () => router.replace('/') }]);
    } catch (e) {
      setProgreso(null);
      Alert.alert('No se pudo restaurar', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Estado">
        <Text style={estilos.normal}>{ESTE_EQUIPO}: {textoResumen(actual)}</Text>
        {info.ultimo ? (
          <Text style={[estilos.normal, dias != null && dias > 7 && { color: colores.peligro, fontWeight: '700' }]}>
            Último respaldo: {textoFechaHora(info.ultimo)} ({dias === 0 ? 'hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`})
          </Text>
        ) : (
          <Text style={[estilos.normal, { color: colores.peligro, fontWeight: '700' }]}>Todavía no se ha hecho ningún respaldo.</Text>
        )}
      </Seccion>

      {progreso && <Aviso tono="info">{progreso}</Aviso>}

      {driveDisponible() && (
        <Seccion titulo="Google Drive">
          {avisoGoogle === 'ok' && drive && <Aviso tono="info">Google Drive conectado.</Aviso>}
          {avisoGoogle && avisoGoogle !== 'ok' && <Aviso>{avisoGoogle}</Aviso>}
          {drive ? (
            <>
              <Text style={[estilos.normal, { fontWeight: '700' }]}>✓ Conectado{cuenta ? `: ${cuenta}` : ''}</Text>
              <Text style={[estilos.pequeno, { marginTop: espacio.xs }]}>
                Los respaldos se guardan en la carpeta “{NOMBRE_CARPETA}” de su Drive (los últimos {RESPALDOS_A_GUARDAR}). La app solo puede ver esa carpeta.
              </Text>
              <EnlaceTexto texto="Desconectar" onPress={desconectar} />
            </>
          ) : (
            <>
              <Text style={[estilos.pequeno, { marginBottom: espacio.m }]}>
                {cuenta
                  ? `Cuenta: ${cuenta}. Por seguridad, en la computadora Google pide confirmar la conexión cada hora.`
                  : 'Guarde los respaldos directo en su Google Drive, sin descargar archivos. El respaldo sube cifrado con su contraseña: Google lo guarda pero no puede leerlo. La app solo puede ver su propia carpeta, no el resto de su Drive.'}
              </Text>
              <Boton texto={cuenta ? 'Conectar de nuevo' : 'Conectar Google Drive'} onPress={conectarGoogle} deshabilitado={ocupado} />
            </>
          )}
        </Seccion>
      )}

      <Seccion titulo="Hacer un respaldo">
        <Text style={[estilos.pequeno, { marginBottom: espacio.m }]}>
          Se crea un archivo con todos los expedientes, consultas, citas y ajustes, protegido con una contraseña (cifrado AES-256).
          Sin la contraseña nadie puede leerlo, ni siquiera quien tenga el archivo.
        </Text>
        <Campo etiqueta="Contraseña del respaldo" value={contrasena} onChangeText={setContrasena} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Campo etiqueta="Repita la contraseña" value={confirmacion} onChangeText={setConfirmacion} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Aviso>
          Anote la contraseña en un lugar seguro. Si se olvida, el respaldo no se podrá abrir. Use siempre la misma para no confundirse.
        </Aviso>
        {drive ? (
          <>
            <Boton texto="Crear respaldo y subir a Google Drive" onPress={() => void subirADrive()} deshabilitado={ocupado} />
            <Boton texto="Crear respaldo y descargar archivo" variante="secundario" onPress={() => void crearRespaldo()} deshabilitado={ocupado} />
          </>
        ) : (
          <Boton texto="Crear respaldo y guardar" onPress={() => void crearRespaldo()} deshabilitado={ocupado} />
        )}
      </Seccion>

      <Seccion titulo="¿Dónde guardarlo?">
        {EN_COMPUTADORA ? (
          <View style={{ gap: espacio.s }}>
            <Text style={estilos.pequeno}>
              <Text style={{ fontWeight: '700' }}>En la computadora: </Text>
              el archivo se descarga en la carpeta Descargas. Muévalo a una carpeta fija, por ejemplo Documentos › Respaldos PediaControl.
            </Text>
            <Text style={estilos.pequeno}>
              <Text style={{ fontWeight: '700' }}>Drive en internet: </Text>
              arrastre el archivo a drive.google.com, o a la carpeta iCloud Drive (Mac) o Google Drive de la computadora si las tiene
              instaladas.
            </Text>
            <Text style={[estilos.suave, { fontSize: texto.mini }]}>
              Recomendación: guarde cada respaldo en dos lugares (por ejemplo, Drive y la computadora).
            </Text>
          </View>
        ) : (
          <View style={{ gap: espacio.s }}>
            <Text style={estilos.pequeno}>
              <Text style={{ fontWeight: '700' }}>Drive en internet: </Text>
              en la ventana que aparece, elija "Guardar en Archivos" y luego iCloud Drive o Google Drive. También puede tocar el ícono de
              Google Drive si tiene esa app.
            </Text>
            <Text style={estilos.pequeno}>
              <Text style={{ fontWeight: '700' }}>Computadora Mac: </Text>
              elija AirDrop y su Mac; el archivo llega a la carpeta Descargas. Si lo guardó en iCloud Drive, también aparece en el
              Finder de la Mac.
            </Text>
            <Text style={estilos.pequeno}>
              <Text style={{ fontWeight: '700' }}>Computadora Windows: </Text>
              guárdelo en Google Drive o envíeselo por correo y descárguelo en la computadora.
            </Text>
            <Text style={[estilos.suave, { fontSize: texto.mini }]}>
              Recomendación: guarde cada respaldo en dos lugares (por ejemplo, Drive y la computadora).
            </Text>
          </View>
        )}
      </Seccion>

      <Seccion titulo="Restaurar un respaldo">
        <Text style={[estilos.pequeno, { marginBottom: espacio.m }]}>
          Úselo en un equipo nuevo, para pasar los datos del teléfono a la computadora (o al revés), o si se perdieron los datos. Reemplaza todos los datos de {ESTE_EQUIPO.toLowerCase()} por los del respaldo.
        </Text>
        {elegido ? (
          <>
            <Text style={[estilos.normal, { fontWeight: '700' }]}>{elegido.nombre}</Text>
            <Text style={estilos.suave}>
              Creado el {textoFechaHora(elegido.archivo.creado)} · {textoResumen(elegido.archivo.resumen)}
            </Text>
            <View style={{ height: espacio.m }} />
            <Campo
              etiqueta="Contraseña del respaldo"
              value={contrasenaRestaurar}
              onChangeText={setContrasenaRestaurar}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Boton texto="Restaurar este respaldo" variante="peligro" onPress={confirmarRestaurar} deshabilitado={ocupado} />
            <Boton texto="Elegir otro archivo" variante="secundario" onPress={() => void elegirArchivo()} deshabilitado={ocupado} />
          </>
        ) : (
          <>
            {drive && enDrive && enDrive.length > 0 && (
              <View style={{ marginBottom: espacio.m }}>
                <Text style={[estilos.normal, { fontWeight: '700', marginBottom: espacio.xs }]}>En Google Drive</Text>
                {enDrive.slice(0, 10).map((a) => (
                  <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: espacio.xs }}>
                    <Text style={estilos.pequeno}>
                      {a.creado ? textoFechaHora(a.creado) : a.nombre} · {textoTamano(a.bytes)}
                    </Text>
                    <EnlaceTexto texto="Usar este" onPress={() => void elegirDeDrive(a)} />
                  </View>
                ))}
              </View>
            )}
            <Boton texto="Elegir archivo de respaldo" variante="secundario" onPress={() => void elegirArchivo()} deshabilitado={ocupado} />
          </>
        )}
      </Seccion>
    </PantallaFormulario>
  );
}
