"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JetsonError = void 0;
exports.jetsonBase = jetsonBase;
exports.createJob = createJob;
exports.getJob = getJob;
exports.mapRecords = mapRecords;
/** Error ya explicado para mostrarse al usuario. */
class JetsonError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.JetsonError = JetsonError;
function jetsonBase(url) {
    try {
        return new URL(url).origin;
    }
    catch (_a) {
        return url.replace(/\/+$/, "");
    }
}
function headers(cfg) {
    const h = { "X-API-Key": cfg.apiKey };
    const id = (cfg.accessClientId || "").trim();
    const secret = (cfg.accessClientSecret || "").trim();
    if (id && secret && id !== "-" && secret !== "-") {
        h["CF-Access-Client-Id"] = id;
        h["CF-Access-Client-Secret"] = secret;
    }
    return h;
}
/** Convierte cualquier fallo en un error con mensaje claro (la causa real de undici viene en `error.cause`). */
function explain(e, cfg) {
    var _a;
    if (e instanceof JetsonError)
        return e;
    const code = ((_a = e === null || e === void 0 ? void 0 : e.cause) === null || _a === void 0 ? void 0 : _a.code) || "";
    const base = jetsonBase(cfg.url);
    if (code.includes("TIMEOUT") || (e === null || e === void 0 ? void 0 : e.name) === "TimeoutError") {
        return new JetsonError(504, "El servidor de lectura tardó demasiado en responder.", `${(e === null || e === void 0 ? void 0 : e.message) || ""} [${code}]`.trim());
    }
    return new JetsonError(502, `No se pudo conectar con el servidor de lectura (${base}). Verifique que la API esté encendida y, si usa un túnel, que esté activo.`, `${(e === null || e === void 0 ? void 0 : e.message) || "Error desconocido"}${code ? ` [${code}]` : ""}`);
}
/** Traduce una respuesta HTTP de error de la API a un mensaje para el usuario. */
async function fromResponse(res) {
    var _a;
    let detail = "";
    try {
        const body = await res.json();
        detail = typeof (body === null || body === void 0 ? void 0 : body.detail) === "string" ? body.detail : JSON.stringify((_a = body === null || body === void 0 ? void 0 : body.detail) !== null && _a !== void 0 ? _a : "");
    }
    catch (_b) {
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
async function createJob(cfg, base64, mimeType, fileName) {
    try {
        const blob = new Blob([Buffer.from(base64, "base64")], { type: mimeType || "application/octet-stream" });
        const form = new FormData();
        form.append("file", blob, fileName || "documento");
        const res = await fetch(`${jetsonBase(cfg.url)}/api/v1/jobs?mode=transit`, {
            method: "POST",
            headers: headers(cfg),
            body: form,
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok)
            throw await fromResponse(res);
        return (await res.json()).jobId;
    }
    catch (e) {
        throw explain(e, cfg);
    }
}
async function getJob(cfg, jobId) {
    try {
        const res = await fetch(`${jetsonBase(cfg.url)}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
            headers: headers(cfg),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok)
            throw await fromResponse(res);
        return (await res.json());
    }
    catch (e) {
        throw explain(e, cfg);
    }
}
/**
 * Registros de documentos a partir del resultado de la API. Los identificadores salen del `jobId`, así que si
 * se consulta el mismo trabajo dos veces se obtienen los mismos registros (no se duplican al guardarlos).
 */
function mapRecords(result, jobId, fileName, scannedAt) {
    const docs = Array.isArray(result === null || result === void 0 ? void 0 : result.documents) ? result.documents : [];
    return docs
        .filter((d) => d === null || d === void 0 ? void 0 : d.found)
        .map((d, i) => {
        var _a, _b;
        return ({
            id: `doc_${jobId}_${i}`,
            tramiteId: `tramite_${jobId}`,
            fileName: fileName || "documento",
            documentType: d.documentType || "desconocido",
            extractedData: d.extractedData || {},
            confidence: (_a = d.confidence) !== null && _a !== void 0 ? _a : 0.8,
            summary: d.summary || "Documento procesado con OCR local.",
            scannedAt,
            syncStatus: "pending",
            logs: [],
            // datos extra útiles para quien revise el documento (la interfaz puede ignorarlos)
            page: (_b = d.page) !== null && _b !== void 0 ? _b : null,
            needsReview: !!d.needsReview,
            inheritedFields: d.inheritedFields || [],
        });
    });
}
//# sourceMappingURL=jetson.js.map