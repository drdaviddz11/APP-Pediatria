# Sincronización entre el teléfono y la computadora

La app guarda todos los datos en cada equipo y funciona sin internet. Con la sincronización activa, los expedientes, consultas, citas y ajustes se copian entre todos los equipos que usen la misma cuenta.

## Cómo protege los datos

- **Cifrado de extremo a extremo.** Cada registro se cifra en el teléfono o la computadora (AES-256-GCM) antes de salir. Supabase solo guarda datos ilegibles. Tampoco recibe la contraseña: de ella se derivan dos llaves distintas (PBKDF2-SHA256, 310 000 iteraciones), una para entrar y otra para cifrar. La de cifrar nunca sale del equipo.
- **Seguridad por fila en el servidor.** Cada cuenta solo puede leer y agregar sus propios registros. Nadie puede modificarlos. Los registros alterados no se pueden descifrar y la app los ignora.
- **La contraseña no se puede recuperar.** Si se olvida, los datos del servidor no se pueden abrir. Los equipos conservan sus datos, así que se puede crear una cuenta nueva desde uno de ellos.

## Costo

Se usa el **plan gratuito de Supabase**, que cuesta $0 y no pide tarjeta:

- **Espacio:** 500 MB. Cada día la app borra en el servidor las versiones viejas de cada dato y deja solo la más reciente, así que alcanza para miles de expedientes.
- **Pausa por inactividad:** si nadie usa el proyecto en 1 semana, Supabase lo pausa. Usándolo a diario no pasa. Si pasa, se reactiva gratis en supabase.com con "Restore project". Mientras tanto, la app sigue funcionando y guarda los cambios para enviarlos después.
- **Sin copias automáticas:** el plan gratuito no hace copias del servidor, así que siga haciendo los respaldos de la app. Para tener copias diarias en el servidor existe el plan Pro, desde US$25 al mes. No hace falta por ahora.

## Pasos (una sola vez)

### 1. Crear el proyecto gratuito en Supabase

1. Entre a <https://supabase.com> y toque **Start your project**. Regístrese con su cuenta de GitHub o con su correo.
2. Toque **New project** y llene los datos:
   - **Name:** `pediacontrol`
   - **Database Password:** toque **Generate a password** y guárdela en un lugar seguro. No es la contraseña de la app, y casi nunca se necesita.
   - **Region:** **East US (North Virginia)**, la más cercana a Honduras.
   - **Plan:** Free.
3. Toque **Create new project** y espere 1 o 2 minutos.

### 2. Preparar la tabla de sincronización

1. En la Terminal de la Mac, escriba lo siguiente para copiar el texto ya preparado:
   ```bash
   cd ~/Documents/APP-Pediatria
   pbcopy < docs/supabase.sql
   ```
2. En Supabase, abra **SQL Editor** en el menú de la izquierda y toque **New query**.
3. Pegue con Cmd + V y toque **Run**. Debe aparecer "Success. No rows returned".

### 3. Copiar la dirección y la clave pública

En Supabase, abra **Project Settings** (el engrane) y luego **API Keys**. Ahí están:

- La **dirección del proyecto** (Project URL), del tipo `https://abcd1234.supabase.co`.
- La **clave pública** (Publishable key, `sb_publishable_…`), o en proyectos antiguos la *anon public*.

La clave pública no es secreta. La seguridad la dan la contraseña y las reglas por fila.

### 4. Activar en el primer equipo (el que tiene los datos)

1. Abra la app y toque **Sincronización** (☁️) en el inicio.
2. Pegue la dirección y la clave pública.
3. Elija **No, crear cuenta** y escriba su correo y una contraseña. Use una distinta a la de su correo y anótela en un lugar seguro.
4. Toque **Crear cuenta y activar**.
5. Supabase le enviará un correo de confirmación. Toque el enlace. Si la página que se abre muestra un error, no importa: la cuenta queda confirmada.
6. Vuelva a la app, elija **Sí, entrar** y toque **Entrar y activar**. Los datos de este equipo se envían cifrados.

### 5. Activar en los demás equipos

En el otro equipo:

1. Abra **Sincronización**.
2. Pegue la misma dirección y la misma clave pública. En el iPhone puede copiarlas en la Mac y pegarlas en el teléfono, si usan el mismo Apple ID.
3. Elija **Sí, entrar** y escriba el mismo correo y la misma contraseña.
4. Si ese equipo también tenía datos, la app pregunta qué hacer:
   - **Usar los datos del servidor:** es lo recomendado si solo tenía pacientes de demostración.
   - **Combinar los datos de los dos.**

Desde entonces, mientras la app esté abierta, los cambios se envían en pocos segundos y los de los demás equipos llegan cada minuto. El inicio muestra el estado: "Sincronizado hace 1 min", "Sin conexión", etc.

## Qué pasa si…

- **Se edita el mismo expediente en dos equipos:** queda el cambio más reciente.
- **Las consultas:** como no se modifican, nunca se pierden.
- **Se crean dos pacientes con el mismo número de expediente en dos equipos:** uno conserva el número y el otro recibe `-2`, por ejemplo `EXP-0100-2`. La app avisa.
- **Se agenda la misma hora en dos equipos sin conexión:** se conservan las dos citas y la app avisa para reprogramar una. En un mismo equipo sigue sin permitirse encimar citas.
- **No hay internet:** todo sigue funcionando y los cambios se envían al volver la conexión.
- **Quiere restaurar un respaldo:** primero desactive la sincronización en ese equipo.

## Pendiente antes de usar datos reales

- Revisión de seguridad, privacidad y confiabilidad clínica.
- Revisión de las obligaciones legales en Honduras.
- Bloqueo de la app con código o Face ID en cada equipo.
- Definir si se contrata el plan Pro para tener copias diarias en el servidor.
