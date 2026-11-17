// Conexión con Supabase usando solo sus direcciones web oficiales (Auth y la API REST de la base de datos).
// Sin librerías extra. El servidor solo recibe registros ya cifrados en el equipo.

export interface ConfigServidor {
  /** Dirección del proyecto, por ejemplo https://abcd1234.supabase.co */
  url: string;
  /** Clave pública del proyecto (publishable / anon). Es pública por diseño: la seguridad la da el inicio de sesión y las reglas por fila. */
  clavePublica: string;
}

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  /** Milisegundos desde 1970 en que vence el accessToken. */
  vence: number;
  usuarioId: string;
}

export interface RegistroRemoto {
  seq: number;
  dispositivo: string;
  datos: string;
}

/** Lo que el motor de sincronización necesita del servidor (en las pruebas se usa uno simulado). */
export interface RegistroNuevo {
  dispositivo: string;
  /** Etiqueta anónima de la fila (ver ClaveSync.etiqueta). */
  fila: string;
  /** Hora del cambio (sin contenido): permite al servidor saber cuál versión de cada fila es la más reciente. */
  momento: string;
  datos: string;
}

export interface Servidor {
  subir(registros: RegistroNuevo[]): Promise<void>;
  bajar(desde: number, limite: number): Promise<RegistroRemoto[]>;
  /** Borra en el servidor las versiones viejas de cada fila (se queda la de momento más reciente). Devuelve cuántas borró. */
  compactar?(): Promise<number>;
}

export class ErrorSync extends Error {
  constructor(
    mensaje: string,
    readonly tipo: 'sin_conexion' | 'credenciales' | 'confirmar_correo' | 'sin_preparar' | 'servidor' | 'otro' = 'otro',
  ) {
    super(mensaje);
  }
}

export function validarConfigServidor(c: ConfigServidor): string | null {
  const url = c.url.trim();
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(url)) return 'La dirección del servidor debe ser como https://abcd1234.supabase.co';
  if (c.clavePublica.trim().length < 20) return 'Pegue la clave pública completa del proyecto (Project API key).';
  return null;
}

function limpiarUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

type Pedido = { method: 'GET' | 'POST'; ruta: string; cuerpo?: unknown; token?: string; encabezados?: Record<string, string> };

async function pedir(cfg: ConfigServidor, p: Pedido): Promise<{ estado: number; datos: any }> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 30_000);
  let r: Response;
  try {
    r = await fetch(limpiarUrl(cfg.url) + p.ruta, {
      method: p.method,
      headers: {
        apikey: cfg.clavePublica.trim(),
        'Content-Type': 'application/json',
        ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}),
        ...p.encabezados,
      },
      body: p.cuerpo === undefined ? undefined : JSON.stringify(p.cuerpo),
      signal: controlador.signal,
    });
  } catch {
    throw new ErrorSync('Sin conexión con el servidor. Los cambios quedan guardados en este equipo y se enviarán al volver la conexión.', 'sin_conexion');
  } finally {
    clearTimeout(limite);
  }
  const texto = await r.text();
  let datos: any = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  return { estado: r.status, datos };
}

/** Traduce los errores de Supabase a mensajes claros. */
function errorDe(estado: number, datos: any): ErrorSync {
  const codigo = String(datos?.error_code ?? datos?.code ?? datos?.error ?? '');
  const mensaje = String(datos?.msg ?? datos?.message ?? datos?.error_description ?? '');
  if (codigo === 'email_not_confirmed' || /not confirmed/i.test(mensaje))
    return new ErrorSync('Falta confirmar el correo: abra el mensaje que le envió Supabase y toque el enlace. Luego vuelva a tocar "Entrar".', 'confirmar_correo');
  if (codigo === 'invalid_credentials' || codigo === 'invalid_grant' || /invalid login/i.test(mensaje))
    return new ErrorSync('Correo o contraseña incorrectos.', 'credenciales');
  if (codigo === 'user_already_exists' || /already registered/i.test(mensaje))
    return new ErrorSync('Ya existe una cuenta con ese correo. Use "Entrar".', 'credenciales');
  if (codigo === 'weak_password') return new ErrorSync('El servidor pide una contraseña más segura.', 'credenciales');
  if (estado === 429) return new ErrorSync('Demasiados intentos seguidos. Espere unos minutos e intente de nuevo.', 'servidor');
  if (estado === 404 || codigo === 'PGRST205' || codigo === '42P01')
    return new ErrorSync('El servidor todavía no está preparado (falta crear la tabla de sincronización). Siga los pasos de docs/SINCRONIZACION.md.', 'sin_preparar');
  if (estado === 401 && /api key/i.test(mensaje)) return new ErrorSync('La clave pública del proyecto no es correcta.', 'credenciales');
  if (estado >= 500 || estado === 0 || estado === 540)
    return new ErrorSync(
      'El servidor no responde. Si el proyecto gratuito no se usó en una semana, Supabase lo pausa: entre a supabase.com y toque "Restore project".',
      'servidor',
    );
  return new ErrorSync(`El servidor respondió con un error (${estado}${mensaje ? `: ${mensaje}` : ''}).`, 'otro');
}

function sesionDe(datos: any): Sesion {
  return {
    accessToken: datos.access_token,
    refreshToken: datos.refresh_token,
    vence: datos.expires_at ? datos.expires_at * 1000 : Date.now() + (datos.expires_in ?? 3600) * 1000,
    usuarioId: datos.user?.id ?? '',
  };
}

/** Crea la cuenta. Devuelve la sesión, o null si Supabase pide confirmar el correo primero. */
export async function registrarCuenta(cfg: ConfigServidor, correo: string, secretoAcceso: string): Promise<Sesion | null> {
  const r = await pedir(cfg, { method: 'POST', ruta: '/auth/v1/signup', cuerpo: { email: correo, password: secretoAcceso } });
  if (r.estado >= 400) throw errorDe(r.estado, r.datos);
  return r.datos?.access_token ? sesionDe(r.datos) : null;
}

export async function iniciarSesion(cfg: ConfigServidor, correo: string, secretoAcceso: string): Promise<Sesion> {
  const r = await pedir(cfg, { method: 'POST', ruta: '/auth/v1/token?grant_type=password', cuerpo: { email: correo, password: secretoAcceso } });
  if (r.estado >= 400) throw errorDe(r.estado, r.datos);
  return sesionDe(r.datos);
}

async function renovarSesion(cfg: ConfigServidor, refreshToken: string): Promise<Sesion> {
  const r = await pedir(cfg, { method: 'POST', ruta: '/auth/v1/token?grant_type=refresh_token', cuerpo: { refresh_token: refreshToken } });
  if (r.estado >= 400) throw errorDe(r.estado, r.datos);
  return sesionDe(r.datos);
}

/**
 * Servidor real. Renueva la sesión sola (y si ya no sirve, vuelve a entrar con el secreto guardado en el equipo).
 * Cada vez que la sesión cambia, llama a alCambiarSesion para guardarla.
 */
export class ServidorSupabase implements Servidor {
  constructor(
    private readonly cfg: ConfigServidor,
    private sesion: Sesion,
    private readonly credenciales: { correo: string; secretoAcceso: string },
    private readonly alCambiarSesion: (s: Sesion) => Promise<void>,
  ) {}

  private async token(forzar = false): Promise<string> {
    if (!forzar && this.sesion.vence - Date.now() > 60_000) return this.sesion.accessToken;
    let nueva: Sesion;
    try {
      nueva = await renovarSesion(this.cfg, this.sesion.refreshToken);
    } catch (e) {
      if (e instanceof ErrorSync && (e.tipo === 'sin_conexion' || e.tipo === 'servidor')) throw e;
      nueva = await iniciarSesion(this.cfg, this.credenciales.correo, this.credenciales.secretoAcceso);
    }
    if (!nueva.usuarioId) nueva.usuarioId = this.sesion.usuarioId;
    this.sesion = nueva;
    await this.alCambiarSesion(nueva);
    return nueva.accessToken;
  }

  private async pedirConSesion(p: Omit<Pedido, 'token'>): Promise<any> {
    let r = await pedir(this.cfg, { ...p, token: await this.token() });
    if (r.estado === 401) r = await pedir(this.cfg, { ...p, token: await this.token(true) });
    if (r.estado >= 400) throw errorDe(r.estado, r.datos);
    return r.datos;
  }

  async subir(registros: RegistroNuevo[]): Promise<void> {
    if (registros.length === 0) return;
    await this.pedirConSesion({ method: 'POST', ruta: '/rest/v1/cambios', cuerpo: registros, encabezados: { Prefer: 'return=minimal' } });
  }

  async bajar(desde: number, limite: number): Promise<RegistroRemoto[]> {
    const datos = await this.pedirConSesion({
      method: 'GET',
      ruta: `/rest/v1/cambios?select=seq,dispositivo,datos&seq=gt.${Math.max(0, Math.floor(desde))}&order=seq.asc&limit=${Math.floor(limite)}`,
    });
    return (Array.isArray(datos) ? datos : []).map((d: any) => ({ seq: Number(d.seq), dispositivo: String(d.dispositivo), datos: String(d.datos) }));
  }

  async compactar(): Promise<number> {
    const r = await this.pedirConSesion({ method: 'POST', ruta: '/rest/v1/rpc/compactar_cambios', cuerpo: {} });
    return Number(r) || 0;
  }
}
