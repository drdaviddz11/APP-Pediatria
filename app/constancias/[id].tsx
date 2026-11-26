// Constancia guardada: ver, imprimir o crear el PDF de nuevo. No se modifica (para corregir, se hace una nueva).

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { htmlConstancia, HOJA_CARTA, nombreArchivoConstancia } from '../../src/constancia/hoja';
import { folioConstancia, tituloTipo } from '../../src/constancia/plantillas';
import { Constancia, leerFirma, obtenerConstancia } from '../../src/db/constancias';
import { obtenerPaciente } from '../../src/db/pacientes';
import type { Paciente } from '../../src/domain/types';
import { usePlan } from '../../src/plan/PlanProvider';
import { FONDO_RECETA } from '../../src/receta/fondo';
import { fechaReceta, nombreEnReceta } from '../../src/receta/hoja';
import { AYUDA_PDF, compartirPdf, imprimirHtml, PDF_CON_DIALOGO_DE_IMPRESION } from '../../src/receta/imprimir';
import { Boton, Cargando, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { AvisoPro } from '../../src/ui/pro';
import { espacio, texto } from '../../src/ui/tema';

export default function VerConstancia() {
  const { esPro } = usePlan();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<{ constancia: Constancia; paciente: Paciente } | null>(null);

  useEffect(() => {
    void (async () => {
      const constancia = await obtenerConstancia(db, id);
      const paciente = constancia ? await obtenerPaciente(db, constancia.pacienteId) : null;
      if (constancia && paciente) setDatos({ constancia, paciente });
    })();
  }, [db, id]);

  if (!datos) return <Cargando />;
  const { constancia, paciente } = datos;
  const fecha = new Date(constancia.fecha);
  const nombreArchivo = nombreArchivoConstancia(nombreEnReceta(paciente), fecha);

  async function hoja(): Promise<string> {
    return htmlConstancia({
      id: constancia.id,
      titulo: nombreArchivo.replace(/\.pdf$/, ''),
      nombre: nombreEnReceta(paciente),
      fecha,
      texto: constancia.texto,
      diagnosticos: constancia.diagnosticos,
      fondo: FONDO_RECETA,
      firma: await leerFirma(db),
    });
  }

  async function hacer(accion: 'imprimir' | 'pdf') {
    try {
      const html = await hoja();
      if (accion === 'pdf') await compartirPdf(html, nombreArchivo, HOJA_CARTA);
      else await imprimirHtml(html, HOJA_CARTA);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(m)) Alert.alert('No se pudo preparar la constancia', m);
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo={`Constancia · ${tituloTipo(constancia.tipo)}`}>
        <Text style={estilos.normal}>
          <Text style={{ fontWeight: '700' }}>Nombre: </Text>
          {nombreEnReceta(paciente)}
        </Text>
        <Text style={estilos.normal}>
          <Text style={{ fontWeight: '700' }}>Fecha: </Text>
          {fechaReceta(fecha)}
        </Text>
        <Text style={[estilos.suave, { marginBottom: espacio.m }]}>Folio {folioConstancia(constancia.id)}</Text>
        {constancia.texto.split(/\n{2,}/).map((p, i) => (
          <Text key={i} style={[estilos.normal, { marginBottom: espacio.s, lineHeight: 22 }]}>
            {p}
          </Text>
        ))}
      </Seccion>
      <Seccion titulo="Diagnósticos">
        {constancia.diagnosticos.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: espacio.s, marginBottom: espacio.xs }}>
            <Text style={[estilos.normal, { fontWeight: '700', width: 22 }]}>{i + 1}.</Text>
            <Text style={[estilos.normal, { flex: 1 }]}>{d}</Text>
          </View>
        ))}
      </Seccion>

      {!esPro && <AvisoPro funcion="constancia" compacto />}
      {esPro && (
        <>
          <Boton texto="Imprimir" onPress={() => void hacer('imprimir')} />
          <Boton texto={PDF_CON_DIALOGO_DE_IMPRESION ? 'Guardar como PDF' : 'Enviar o guardar PDF'} variante="secundario" onPress={() => void hacer('pdf')} />
          <Boton
            texto="Hacer otra igual (para corregir o repetir)"
            variante="secundario"
            onPress={() => router.push({ pathname: '/constancias/nueva', params: { pacienteId: constancia.pacienteId, base: constancia.id } })}
          />
          <Text style={[estilos.suave, { fontSize: texto.mini, marginTop: espacio.s }]}>
            {AYUDA_PDF}
            Las constancias emitidas no se modifican; quedan en el expediente con su folio.
          </Text>
        </>
      )}
    </PantallaFormulario>
  );
}
