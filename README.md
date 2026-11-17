# PediaControl Pro

Aplicación para administrar una consulta pediátrica: expedientes, consultas, evaluación nutricional, agenda y contacto por WhatsApp.

> ⚠️ **Versión de desarrollo.** Use solo pacientes ficticios. Los datos se guardan únicamente en el teléfono, todavía sin cifrado ni respaldo. No se debe usar en consulta real hasta completar la revisión de seguridad descrita en [docs/ROADMAP.md](docs/ROADMAP.md).

## Qué hace esta versión (fases 1 a 4, respaldos, versión de computadora y sincronización)

- Lista de pacientes con búsqueda por nombre, apellidos, número de expediente, responsable o teléfono.
- Expediente con datos personales, responsable, contacto de emergencia y consentimientos.
- Edad calculada automáticamente y edad corregida para prematuros (menores de 24 meses nacidos antes de las 37 semanas).
- Historia clínica: alergias (resaltadas en rojo), medicamentos, antecedentes, vacunas, hospitalizaciones y diagnósticos previos.
- Registro de consultas: motivo, padecimiento, antropometría, signos vitales, exploración, diagnósticos, estudios, tratamiento, indicaciones y seguimiento.
- Las consultas guardadas **no se pueden modificar**; las correcciones se agregan como notas aclaratorias con fecha.
- Alertas informativas de datos improbables: unidades equivocadas (metros, gramos, °F), valores fuera de rango, cambios bruscos de peso y tipo de medición que no corresponde a la edad.
- Bitácora interna de creaciones y modificaciones.
- Pacientes de demostración ficticios para practicar.
- **Evaluación nutricional OMS** en cada consulta: puntaje Z, percentil e interpretación de peso/edad, talla/edad, peso/talla, IMC/edad y perímetro cefálico, con las tablas oficiales de la OMS 2006 (0–5 años) y 2007 (5–19 años). Se actualiza en vivo al escribir las medidas. Validada contra el software de la OMS ([docs/VALIDACION.md](docs/VALIDACION.md)).
- **Gráficas de crecimiento** con curvas OMS en puntajes Z o percentiles y las mediciones del paciente.
- **Panel principal:** citas de hoy, próxima cita, sala de espera, pendientes de confirmación, canceladas, resumen del día y búsqueda rápida de expedientes.
- **Agenda** diaria, semanal y mensual: horarios libres, reprogramación, estados de la cita, bloqueo de horarios y prevención de citas duplicadas. El horario del consultorio y la duración de las consultas se ajustan en **Horario y ajustes**.
- **Controles y recordatorios:** lista diaria de pacientes a quienes les toca control (seguimiento indicado, niño sano según la edad o sin consulta hace tiempo). La app les aparta un horario "por confirmar" y prepara el mensaje de WhatsApp; con un toque por paciente se abre cada chat con el mensaje listo. También prepara los recordatorios de las citas del día siguiente.
- **WhatsApp:** botón en el expediente y en cada cita, con mensajes editables y solo para responsables que lo autorizaron.
- **Síndrome de Down:** al marcarlo en el expediente, la evaluación y las gráficas usan las curvas del CDC para niños con síndrome de Down (Zemel et al., Pediatrics 2015).
- Alertas de caída del puntaje Z entre consultas.
- **Funciona en iPhone y en computadora:** la misma app se abre en el navegador (Google Chrome o Microsoft Edge), con pantallas centradas para monitor, ventanas de confirmación propias y WhatsApp Web.
- **Sincronización entre teléfono y computadora** (plan gratuito de Supabase): cifrada de extremo a extremo, funciona sin internet y envía los cambios al volver la conexión; si un dato cambia en dos equipos gana el más reciente. Pasos en [docs/SINCRONIZACION.md](docs/SINCRONIZACION.md).
- **Respaldo cifrado:** un archivo con todos los expedientes, consultas, citas y ajustes, protegido con contraseña (AES-256-GCM). Se guarda en iCloud Drive, Google Drive o en la computadora (AirDrop a la Mac), y se puede restaurar en otro teléfono. El panel avisa si el último respaldo tiene más de 7 días.

---

## Cómo probarla en su iPhone (paso a paso, en Mac)

Solo necesita hacer los pasos 1 a 3 una vez.

### 1. Instalar las herramientas

1. **Node.js**: entre a <https://nodejs.org>, descargue la versión **LTS** para macOS y ábrala como cualquier instalador.
2. **Git**: abra la app **Terminal** (Cmd + Espacio, escriba "Terminal") y pegue:
   ```bash
   xcode-select --install
   ```
   Acepte la ventana que aparece. Si dice que ya está instalado, siga adelante.
3. **Visual Studio Code** (para ver y editar el código): descárguelo de <https://code.visualstudio.com>.
4. **Expo Go** en su iPhone: búsquelo en el App Store e instálelo.

Para comprobar que todo quedó bien, en Terminal escriba:
```bash
node -v
git --version
```
Ambos deben mostrar un número de versión.

### 2. Descargar el proyecto

En Terminal:
```bash
cd ~/Documents
git clone https://github.com/drdaviddz11/APP-Pediatria.git
cd APP-Pediatria
```
Si GitHub le pide usuario y contraseña, use su usuario de GitHub y un *token* en lugar de la contraseña (GitHub → Settings → Developer settings → Personal access tokens).

### 3. Instalar las dependencias

Dentro de la carpeta del proyecto:
```bash
npm install
npx expo install --fix
```
El segundo comando ajusta automáticamente las versiones exactas de cada pieza a la versión de Expo del proyecto. Puede tardar unos minutos.

### 4. Abrir la app en el teléfono

```bash
npx expo start
```
Aparecerá un código QR en la Terminal.

1. Conecte el iPhone a **la misma red Wi-Fi** que la Mac.
2. Abra la **Cámara** del iPhone, apunte al código QR y toque el aviso que aparece. Se abrirá en Expo Go.
3. En la app, toque **Cargar pacientes de demostración** para practicar.

Mientras la Terminal siga abierta, cada cambio en el código se ve en el teléfono al instante. Para detenerla, presione `Ctrl + C`.

Si el teléfono no se conecta, pruebe:
```bash
npx expo start --tunnel
```

### 5. Abrir la app en la computadora

Con la Terminal ya mostrando el código QR (paso 4), presione la tecla **w**. Se abre la app en el navegador, en la dirección **http://localhost:8081**.

- Use **Google Chrome** o **Microsoft Edge**. Safari todavía no permite guardar la base de datos de la app.
- Use siempre la misma dirección (`localhost:8081`): el navegador guarda los datos por dirección, y con otra la app aparecerá vacía.
- Si borra los "datos de navegación" o "datos de sitios" del navegador, se borran también los datos de la app. Haga respaldos.
- WhatsApp se abre en **WhatsApp Web**, siempre en la misma pestaña. La primera vez hay que vincularlo escaneando el código con el teléfono.

**Teléfono y computadora:** cada uno guarda sus datos. Para que se mantengan iguales, active la **Sincronización** en los dos con la misma cuenta ([docs/SINCRONIZACION.md](docs/SINCRONIZACION.md)).

### Para actualizar a la última versión del código

```bash
cd ~/Documents/APP-Pediatria
git checkout -- . && git pull
npm install
npx expo install --fix
npx expo start
```

---

## Notas técnicas

- **Tecnología:** React Native + Expo SDK 58 + TypeScript + Expo Router + SQLite (`expo-sqlite`).
- **Versión de Expo:** debe coincidir con la que admite la app Expo Go del App Store (hoy SDK 58). Si Expo Go muestra "Project is incompatible", hay que actualizar el SDK del proyecto.
- **Estructura:**
  ```
  app/                 Pantallas (cada archivo es una ruta)
    index.tsx          Panel principal
    pacientes/         Lista, nuevo, expediente, editar, historia clínica, nueva consulta, gráficas
    agenda/            Agenda (día/semana/mes), nueva cita, detalle de cita, bloquear horario
    configuracion.tsx  Horario de atención y duración de las consultas
    controles.tsx      Controles por agendar y recordatorios, con envío por WhatsApp
    whatsapp.tsx       Mensaje individual de WhatsApp
    configuracion-mensajes.tsx  Textos de los mensajes y criterios de control
    respaldo.tsx       Crear, guardar y restaurar respaldos cifrados
    sincronizacion.tsx Activar la sincronización entre equipos, estado y avisos
    _layout.tsx        Navegación, base de datos, ventanas de confirmación y aviso de navegador no compatible
    consultas/[id].tsx Detalle de consulta y notas aclaratorias
  src/domain/          Reglas clínicas y de negocio (edad, validaciones). Sin dependencias de la interfaz.
  src/crecimiento/     Evaluación OMS: tablas LMS, puntajes Z, interpretación y curvas
  src/agenda/          Reglas de la agenda: horarios libres, traslapes, estados de las citas
  src/seguimiento/     A quién le toca control; plantillas y enlaces de WhatsApp
  src/sincronizacion/  Sincronización cifrada: registro de cambios, motor (último cambio gana), conexión con Supabase
  src/respaldo/        Formato del archivo de respaldo y cifrado (PBKDF2 + AES-256-GCM); archivos.ts (teléfono) y archivos.web.ts (computadora)
  scripts/             Generadores de las tablas OMS y CDC (síndrome de Down) a partir de las fuentes oficiales
  src/db/              Base de datos local: esquema, migraciones y consultas SQL
  src/ui/              Componentes visuales y colores; dialogo.tsx (avisos en teléfono y computadora), plataforma.ts
  docs/                Prompt maestro del proyecto y hoja de ruta
  ```
- La interfaz solo usa las funciones de `src/db/`, para poder cambiar a un servidor (por ejemplo Supabase) más adelante sin reescribir las pantallas.
- **Sincronización:** triggers de SQLite anotan cada cambio en `sync_pendientes`; el motor envía la fila cifrada como registro nuevo (tabla `cambios` en Supabase, ver `docs/supabase.sql`) y aplica los de otros equipos con «último cambio gana». El servidor solo ve datos cifrados, una etiqueta anónima por fila y la hora del cambio.
- La base de datos impide modificar consultas y notas guardadas, y borrar expedientes que no sean de demostración.
- Comprobar tipos: `npm run typecheck`.
- **Versión web:** `public/aislamiento-sw.js` (service worker) agrega en el navegador los encabezados COOP/COEP que necesita `expo-sqlite`, así funciona con cualquier servidor; `metro.config.js` también los agrega y el formato `.wasm` que necesita `expo-sqlite` en el navegador (documentación de Expo SDK 58). Los archivos `*.web.ts` reemplazan a los `*.ts` solo en el navegador. Para publicarla en internet, el servidor debe enviar los mismos encabezados y usar https (fase 8, después de la revisión de seguridad).
