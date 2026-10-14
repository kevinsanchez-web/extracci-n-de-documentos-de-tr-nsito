/**
 * Cliente de la interfaz para el OCR local (Jetson) por trabajos asíncronos.
 *
 * 1. POST /api/documents/analyze-jetson crea el trabajo y responde en segundos con un `jobId`.
 * 2. GET  /api/documents/analyze-jetson/:jobId se consulta cada 1,5 s con el avance REAL ("página 2 de 6")
 *    hasta que termina y entrega los registros.
 *
 * Funciona igual con el servidor local (server.ts) y con la Cloud Function de Firebase, y no depende de
 * peticiones largas (Firebase Hosting corta a los 60 s).
 */

const POLL_MS = 1500;
const MAX_WAIT_MS = 20 * 60 * 1000; // 20 minutos
const MAX_FAILED_POLLS = 5; // fallos de red seguidos tolerados (conexiones móviles inestables)

async function readError(res: Response, fallback: string): Promise<Error> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* respuesta sin JSON */
  }
  const msg = [body?.error, body?.details].filter(Boolean).join(" — ");
  return new Error(msg || `${fallback} (HTTP ${res.status})`);
}

export async function analyzeWithJetson(
  base64: string,
  mimeType: string,
  fileName: string,
  onProgress: (message: string) => void,
): Promise<any[]> {
  onProgress("Subiendo archivo al servidor de lectura...");
  const created = await fetch("/api/documents/analyze-jetson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mimeType, fileName }),
  });
  if (!created.ok) throw await readError(created, "No se pudo enviar el archivo al servidor de lectura");
  const { jobId } = await created.json();

  const started = Date.now();
  let failed = 0;
  while (Date.now() - started < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    let res: Response;
    try {
      res = await fetch(`/api/documents/analyze-jetson/${encodeURIComponent(jobId)}?fileName=${encodeURIComponent(fileName)}`);
      failed = 0;
    } catch {
      if (++failed >= MAX_FAILED_POLLS) throw new Error("Se perdió la conexión mientras se leía el documento. Intente de nuevo.");
      continue;
    }
    if (!res.ok) throw await readError(res, "Fallo al consultar el análisis del documento");
    const job = await res.json();
    if (job.status === "done") return job.records as any[];
    if (job.status === "queued") onProgress("En cola en el servidor de lectura...");
    else if (job.progress?.total) onProgress(`Leyendo página ${Math.min(job.progress.page + 1, job.progress.total)} de ${job.progress.total}...`);
    else onProgress("Leyendo el documento y extrayendo campos...");
  }
  throw new Error("La lectura del documento tardó demasiado. Pruebe con un archivo más liviano o con menos páginas.");
}
