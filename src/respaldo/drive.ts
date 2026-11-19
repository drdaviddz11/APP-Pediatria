// Respaldo en el Google Drive del propio médico.
// Permiso mínimo (drive.file): la app solo ve los archivos que ella misma creó, nunca el resto del Drive.
// El archivo sube YA CIFRADO con la contraseña del respaldo: Google guarda el archivo pero no puede leerlo.
// No pasa por ningún servidor nuestro: la app habla directo con Google.

export const ALCANCE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
export const NOMBRE_CARPETA = 'PediaControl Pro - Respaldos';
/** Se guardan los últimos 30 respaldos; los más viejos se mandan a la papelera del Drive (se pueden recuperar 30 días). */
export const RESPALDOS_A_GUARDAR = 30;

const API = 'https://www.googleapis.com/drive/v3';
const SUBIR = 'https://www.googleapis.com/upload/drive/v3';
const TIPO_CARPETA = 'application/vnd.google-apps.folder';

/** Dirección para pedirle permiso a Google (la página vuelve a `redireccion` con el permiso en la dirección). */
export function urlAutorizacion(o: { clientId: string; redireccion: string; estado: string; correo?: string | null }): string {
  const p: Record<string, string> = {
    client_id: o.clientId,
    redirect_uri: o.redireccion,
    response_type: 'token',
    scope: ALCANCE_DRIVE,
    include_granted_scopes: 'true',
    state: o.estado,
  };
  if (o.correo) p.login_hint = o.correo;
  else p.prompt = 'select_account';
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(p).toString()}`;
}

export type RespuestaGoogle =
  | { tipo: 'permiso'; token: string; segundos: number; estado: string; alcances: string[] }
  | { tipo: 'error'; error: string; estado: string };

/** Lee lo que Google devuelve después del "#" de la dirección. null si no es una respuesta de Google. */
export function leerRespuesta(hash: string): RespuestaGoogle | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const estado = p.get('state') ?? '';
  const error = p.get('error');
  if (error) return { tipo: 'error', error, estado };
  const token = p.get('access_token');
  if (!token) return null;
  const segundos = Number(p.get('expires_in') ?? 3600);
  return {
    tipo: 'permiso',
    token,
    segundos: Number.isFinite(segundos) && segundos > 0 ? segundos : 3600,
    estado,
    alcances: (p.get('scope') ?? '').split(/\s+/).filter(Boolean),
  };
}

/** Mensaje claro para cada error que devuelve Google al pedir permiso. */
export function textoErrorPermiso(error: string): string {
  if (error === 'access_denied') return 'No se dio permiso para usar Google Drive.';
  return `Google no dio el permiso (${error}). Intente de nuevo.`;
}

export class ErrorDrive extends Error {
  constructor(
    mensaje: string,
    /** La conexión con Google venció (dura una hora en la computadora): hay que volver a conectar. */
    readonly sesionVencida = false,
  ) {
    super(mensaje);
    this.name = 'ErrorDrive';
  }
}

export interface ArchivoDrive {
  id: string;
  nombre: string;
  bytes: number;
  creado: string;
}

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}>;

/** Comillas para las búsquedas de Drive. */
function citar(t: string): string {
  return `'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export class Drive {
  private carpetaId: string | null = null;

  constructor(
    private readonly token: string,
    private readonly fetchFn: Fetch = (globalThis as unknown as { fetch: Fetch }).fetch.bind(globalThis),
  ) {}

  private async pedir(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
    let r;
    try {
      r = await this.fetchFn(url, { ...init, headers: { Authorization: `Bearer ${this.token}`, ...(init.headers ?? {}) } });
    } catch {
      throw new ErrorDrive('No hay conexión a internet o Google no respondió. Intente de nuevo.');
    }
    if (r.ok) return r;
    let razon = '';
    try {
      const cuerpo = await r.json();
      razon = cuerpo?.error?.errors?.[0]?.reason ?? cuerpo?.error?.status ?? '';
    } catch {
      razon = '';
    }
    if (r.status === 401) throw new ErrorDrive('La conexión con Google venció. Toque "Conectar" otra vez.', true);
    if (razon === 'storageQuotaExceeded') throw new ErrorDrive('Su Google Drive está lleno. Libere espacio en drive.google.com y vuelva a intentar.');
    if (r.status === 403 && /rate|limit/i.test(razon)) throw new ErrorDrive('Google está ocupado. Espere un minuto y vuelva a intentar.');
    if (r.status === 404) throw new ErrorDrive('No se encontró el archivo en Google Drive.');
    throw new ErrorDrive(`Google Drive respondió con un error (${r.status}${razon ? `, ${razon}` : ''}).`);
  }

  /** Correo de la cuenta conectada. */
  async correo(): Promise<string> {
    const r = await this.pedir(`${API}/about?fields=user(emailAddress)`);
    const d = await r.json();
    return String(d?.user?.emailAddress ?? '');
  }

  /** Carpeta de respaldos (la crea la primera vez). */
  async carpeta(): Promise<string> {
    if (this.carpetaId) return this.carpetaId;
    const q = `mimeType=${citar(TIPO_CARPETA)} and name=${citar(NOMBRE_CARPETA)} and trashed=false`;
    const r = await this.pedir(`${API}/files?${new URLSearchParams({ q, spaces: 'drive', fields: 'files(id)', orderBy: 'createdTime' })}`);
    const encontradas = (await r.json())?.files ?? [];
    if (encontradas.length > 0) {
      this.carpetaId = String(encontradas[0].id);
      return this.carpetaId;
    }
    const nueva = await this.pedir(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name: NOMBRE_CARPETA, mimeType: TIPO_CARPETA }),
    });
    this.carpetaId = String((await nueva.json()).id);
    return this.carpetaId;
  }

  /** Sube un respaldo (ya cifrado) a la carpeta. */
  async subir(nombre: string, texto: string): Promise<ArchivoDrive> {
    const carpeta = await this.carpeta();
    const limite = `pediacontrol${Math.random().toString(36).slice(2)}${Date.now()}`;
    const meta = JSON.stringify({
      name: nombre,
      parents: [carpeta],
      mimeType: 'application/octet-stream',
      appProperties: { formato: 'pediacontrol-respaldo' },
    });
    const cuerpo =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${limite}\r\nContent-Type: application/octet-stream\r\n\r\n${texto}\r\n--${limite}--`;
    const r = await this.pedir(`${SUBIR}/files?uploadType=multipart&fields=id,name,size,createdTime`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    });
    return aArchivo(await r.json());
  }

  /** Respaldos guardados, del más nuevo al más viejo. */
  async listar(): Promise<ArchivoDrive[]> {
    const carpeta = await this.carpeta();
    const q = `${citar(carpeta)} in parents and trashed=false`;
    const r = await this.pedir(
      `${API}/files?${new URLSearchParams({ q, spaces: 'drive', orderBy: 'createdTime desc', pageSize: '100', fields: 'files(id,name,size,createdTime)' })}`,
    );
    return ((await r.json())?.files ?? []).map(aArchivo);
  }

  async descargar(id: string): Promise<string> {
    const r = await this.pedir(`${API}/files/${encodeURIComponent(id)}?alt=media`);
    return r.text();
  }

  /** Manda a la papelera los respaldos que pasan del límite. Devuelve cuántos. */
  async limpiar(guardar = RESPALDOS_A_GUARDAR): Promise<number> {
    const sobran = (await this.listar()).slice(guardar);
    for (const a of sobran) {
      await this.pedir(`${API}/files/${encodeURIComponent(a.id)}?fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ trashed: true }),
      });
    }
    return sobran.length;
  }
}

function aArchivo(f: any): ArchivoDrive {
  return { id: String(f.id), nombre: String(f.name ?? ''), bytes: Number(f.size ?? 0), creado: String(f.createdTime ?? '') };
}

/** 1536000 → "1.5 MB" */
export function textoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
