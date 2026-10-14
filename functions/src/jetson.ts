/**
 * Cliente de la API de lectura OCR (Jetson) por TRABAJOS ASÍNCRONOS, compartido por el servidor local
 * (`server.ts`) y la Cloud Function (`functions/src/index.ts`) para que se comporten igual.
 *
 * Por qué asíncrono: Firebase Hosting corta a los 60 s y Cloudflare a ~100 s, y un PDF puede tardar minutos.
 * Así ninguna llamada dura más de unos segundos: se crea el trabajo (`POST /api/v1/jobs`) y se consulta
 * (`GET /api/v1/jobs/{id}`) hasta que termine.
 *
 * Sin dependencias de Express ni de Firebase: solo `fetch`, `FormData` y `Blob` de Node 18+.
 */

export interface JetsonConfig {
  /** Dirección de la API. Acepta la base ("https://api.midominio.com") o cualquier ruta de la API (se usa su origen). */
  url: string;
  apiKey: string;
  /** Credenciales de Cloudflare Access (service token), opcionales: solo si el túnel está protegido con Access. */
  accessClientId?: string;
  accessClientSecret?: string;
}

export interface JetsonJob {
  jobId: string;
  status: "queued" | "processing" | "done" | "error";
  progress?: { page: number; total: number } | null;
  cached?: boolean;
  result?: any;
  error?: { status: number; detail: string } | null;
}

/** Error ya explicado para mostrarse al usuario. */
export class JetsonError extends Error {
  constructor(public status: number, message: string, public details?: string) {
    super(message);
  }
}

export function jetsonBase(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

function headers(cfg: JetsonConfig): Record<string, string> {
  const h: Record<string, string> = { "X-API-Key": cfg.apiKey };
  const id = (cfg.accessClientId || "").trim();
  const secret = (cfg.accessClientSecret || "").trim();
  if (id && secret && id !== "-" && secret !== "-") {
    h["CF-Access-Client-Id"] = id;
    h["CF-Access-Client-Secret"] = secret;
  }
  return h;
}

/** Convierte cualquier fallo en un error con mensaje claro (la causa real de undici viene en `error.cause`). */
function explain(e: any, cfg: JetsonConfig): JetsonError {
  if (e instanceof JetsonError) return e;
  const code: string = e?.cause?.code || "";
  const base = jetsonBase(cfg.url);
  if (code.includes("TIMEOUT") || e?.name === "TimeoutError") {
    return new JetsonError(504, "El servidor de lectura tardó demasiado en responder.", `${e?.message || ""} [${code}]`.trim());
  }
  return new JetsonError(
    502,
    `No se pudo conectar con el servidor de lectura (${base}). Verifique que la API esté encendida y, si usa un túnel, que esté activo.`,
    `${e?.message || "Error desconocido"}${code ? ` [${code}]` : ""}`,
  );
}

/** Traduce una respuesta HTTP de error de la API a un mensaje para el usuario. */
async function fromResponse(res: Response): Promise<JetsonError> {
  let detail = "";
  try {
    const body: any = await res.json();
    detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? "");
  } catch {
    detail = await res.text().catch(() => "");
  }
  switch (res.status) {
    case 401:
    case 403:
      return new JetsonError(502, "El servidor de lectura rechazó la clave de acceso. Revise JETSON_API_KEY.", `HTTP ${res.status}: ${detail}`);
    case 413:
      return new JetsonError(413, "El archivo es demasiado grande para el servidor de lectura.", detail);
    case 415:
    case 400:
      return new JetsonError(422, detail || "El archivo no es un PDF ni una imagen válida.", `HTTP ${res.status}`);
    case 422:
      return new JetsonError(422, detail || "No se pudo leer el documento.", `HTTP ${res.status}`);
    case 429:
      return new JetsonError(429, "Hay demasiados documentos en proceso. Espere un momento e inténtelo de nuevo.", detail);
    case 503:
      return new JetsonError(503, "El servidor de lectura está ocupado. Inténtelo de nuevo en unos segundos.", detail);
    case 404:
      return new JetsonError(404, "El trabajo ya no existe en el servidor de lectura (expiró o se reinició).", detail);
    default:
      return new JetsonError(502, `El servidor de lectura respondió con el estado ${res.status}.`, detail);
  }
}

/** Crea el trabajo en la Jetson y devuelve su identificador en unos segundos. */
export async function createJob(cfg: JetsonConfig, base64: string, mimeType: string, fileName: string): Promise<string> {
  try {
    const blob = new Blob([Buffer.from(base64, "base64")], { type: mimeType || "application/octet-stream" });
    const form = new FormData();
    form.append("file", blob, fileName || "documento");
    const res = await fetch(`${jetsonBase(cfg.url)}/api/v1/jobs?mode=transit`, {
      method: "POST",
      headers: headers(cfg),
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw await fromResponse(res);
    return ((await res.json()) as JetsonJob).jobId;
  } catch (e) {
    throw explain(e, cfg);
  }
}

export async function getJob(cfg: JetsonConfig, jobId: string): Promise<JetsonJob> {
  try {
    const res = await fetch(`${jetsonBase(cfg.url)}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      headers: headers(cfg),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw await fromResponse(res);
    return (await res.json()) as JetsonJob;
  } catch (e) {
    throw explain(e, cfg);
  }
}

/**
 * Registros de documentos a partir del resultado de la API. Los identificadores salen del `jobId`, así que si
 * se consulta el mismo trabajo dos veces se obtienen los mismos registros (no se duplican al guardarlos).
 */
export function mapRecords(result: any, jobId: string, fileName: string, scannedAt: string): any[] {
  const docs: any[] = Array.isArray(result?.documents) ? result.documents : [];
  return docs
    .filter((d) => d?.found)
    .map((d, i) => ({
      id: `doc_${jobId}_${i}`,
      tramiteId: `tramite_${jobId}`,
      fileName: fileName || "documento",
      documentType: d.documentType || "desconocido",
      extractedData: d.extractedData || {},
      confidence: d.confidence ?? 0.8,
      summary: d.summary || "Documento procesado con OCR local.",
      scannedAt,
      syncStatus: "pending" as const,
      logs: [],
      // datos extra útiles para quien revise el documento (la interfaz puede ignorarlos)
      page: d.page ?? null,
      needsReview: !!d.needsReview,
      inheritedFields: d.inheritedFields || [],
    }));
}
