# PediaControl Pro

Aplicación para administrar una consulta pediátrica: expedientes, consultas, evaluación nutricional, agenda y contacto por WhatsApp.

> ⚠️ **Versión de desarrollo.** Use solo pacientes ficticios. Los datos se guardan únicamente en el teléfono, todavía sin cifrado ni respaldo. No se debe usar en consulta real hasta completar la revisión de seguridad descrita en [docs/ROADMAP.md](docs/ROADMAP.md).

## Qué hace esta versión (fase 1: expedientes)

- Lista de pacientes con búsqueda por nombre, apellidos, número de expediente, responsable o teléfono.
- Expediente con datos personales, responsable, contacto de emergencia y consentimientos.
- Edad calculada automáticamente y edad corregida para prematuros (menores de 24 meses nacidos antes de las 37 semanas).
- Historia clínica: alergias (resaltadas en rojo), medicamentos, antecedentes, vacunas, hospitalizaciones y diagnósticos previos.
- Registro de consultas: motivo, padecimiento, antropometría, signos vitales, exploración, diagnósticos, estudios, tratamiento, indicaciones y seguimiento.
- Las consultas guardadas **no se pueden modificar**; las correcciones se agregan como notas aclaratorias con fecha.
- Alertas informativas de datos improbables: unidades equivocadas (metros, gramos, °F), valores fuera de rango, cambios bruscos de peso y tipo de medición que no corresponde a la edad.
- Bitácora interna de creaciones y modificaciones.
- Pacientes de demostración ficticios para practicar.

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
El segundo comando ajusta automáticamente las versiones para que coincidan con Expo Go. Puede tardar unos minutos.

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

### Para actualizar a la última versión del código

```bash
cd ~/Documents/APP-Pediatria
git pull
npm install
npx expo start
```

---

## Notas técnicas

- **Tecnología:** React Native + Expo SDK 54 + TypeScript + Expo Router + SQLite (`expo-sqlite`).
- **Por qué SDK 54:** es la versión que admite la app Expo Go del App Store. Las versiones más nuevas requieren una cuenta de Apple Developer para probar en iPhone. Se actualizará cuando se haga la compilación propia de la app.
- **Estructura:**
  ```
  app/                 Pantallas (cada archivo es una ruta)
    index.tsx          Lista y búsqueda de pacientes
    pacientes/         Nuevo, expediente, editar, historia clínica, nueva consulta
    consultas/[id].tsx Detalle de consulta y notas aclaratorias
  src/domain/          Reglas clínicas y de negocio (edad, validaciones). Sin dependencias de la interfaz.
  src/db/              Base de datos local: esquema, migraciones y consultas SQL
  src/ui/              Componentes visuales y colores
  docs/                Prompt maestro del proyecto y hoja de ruta
  ```
- La interfaz solo usa las funciones de `src/db/`, para poder cambiar a un servidor (por ejemplo Supabase) más adelante sin reescribir las pantallas.
- La base de datos impide modificar consultas y notas guardadas, y borrar expedientes que no sean de demostración.
- Comprobar tipos: `npm run typecheck`.
