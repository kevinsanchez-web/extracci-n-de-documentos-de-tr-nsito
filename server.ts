/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Configurar parser con límite de 50mb para recibir imágenes en base64 grandes sin error
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Inicialización diferida y segura de Gemini API para que no falle al iniciar si la clave falta
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY no configurada. Por favor, agregue su API Key en el panel Settings > Secrets.");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        apiVersion: "v1alpha",
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Base de datos en memoria para documentos analizados
interface DocumentRecord {
  id: string;
  fileName: string;
  documentType: string;
  extractedData: any;
  confidence: number;
  summary: string;
  scannedAt: string;
  syncStatus: "pending" | "success" | "failed";
  syncUrlUsed?: string;
  logs: any[];
}

// Base de datos en memoria para Simular la OTRA aplicación externa
interface ExternalRecord {
  id: string;
  receivedAt: string;
  originDocumentId: string;
  documentType: string;
  clientName: string;
  clientDocId: string;
  vehicleChasis: string;
  vehicleMotor: string;
  details: any;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DOCS_FILE = path.join(DATA_DIR, "documents-db.json");
const EXT_FILE  = path.join(DATA_DIR, "external-db.json");

function loadFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (_) {}
  return fallback;
}
function saveFile(filePath: string, data: unknown) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (_) {}
}

let documentsDB: DocumentRecord[] = loadFile(DOCS_FILE, []);
let externalSystemDB: ExternalRecord[] = loadFile(EXT_FILE, []);


// Si no existe el archivo en disco aún, guardar el estado inicial vacío
if (!fs.existsSync(DOCS_FILE)) saveFile(DOCS_FILE, documentsDB);
if (!fs.existsSync(EXT_FILE))  saveFile(EXT_FILE,  externalSystemDB);



/* ==================== API ENDPOINTS ==================== */

// 1. Obtener todos los documentos parseados
app.get("/api/documents", (_req, res) => {
  res.json(documentsDB);
});

// 2. Obtener la base de datos externa simulada
app.get("/api/external-system-db", (_req, res) => {
  res.json(externalSystemDB);
});

// 3. Endpoint para Limpiar DB externa simulada
app.delete("/api/external-system-db/clear", (_req, res) => {
  externalSystemDB = [];
  saveFile(EXT_FILE, externalSystemDB);
  res.json({ message: "Base de datos externa simulada vaciada con éxito." });
});

// 4. Eliminar un documento específico
app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  documentsDB = documentsDB.filter(d => d.id !== id);
  saveFile(DOCS_FILE, documentsDB);
  res.json({ success: true, message: "Documento eliminado." });
});

// 4b. Actualizar datos extraídos de un documento (Guardar cambios)
app.patch("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const { extractedData } = req.body;
  const doc = documentsDB.find(d => d.id === id);
  if (!doc) return res.status(404).json({ error: "Documento no encontrado." });
  doc.extractedData = extractedData;
  saveFile(DOCS_FILE, documentsDB);
  res.json({ success: true });
});

// Tipos de documentos a detectar — una llamada paralela por tipo
const DOC_TYPES = [
  { type: "cedula",  name: "Cédula de Ciudadanía colombiana",                   fields: "nombreCompleto, numeroDocumento, fechaNacimiento, sexo, rh, estatura, contacto:{celular,correo,direccion}" },
  { type: "factura", name: "Factura de compraventa de vehículo",                fields: "numeroFactura, fecha, compradorNombre, compradorIdentificacion, vehiculoMarca, vehiculoLinea, vehiculoModelo, vehiculoMotor, vehiculoChasis, vehiculoCilindrada, vehiculoColor, valorTotal(entero)" },
  { type: "runt",    name: "Formulario de solicitud de trámites RUNT",          fields: "tramiteSolicitado, propietarioNombre, propietarioIdentificacion, vehiculoMarca, vehiculoLinea, vehiculoMotor, vehiculoChasis, vehiculoModelo, vehiculoCilindrada, vehiculoColor" },
  { type: "gases",   name: "Certificado de emisiones de gases o empadronamiento", fields: "tipoCertificado, fechaCertificado, vehiculoMarca, vehiculoLinea, vehiculoChasis, vehiculoMotor, vehiculoCilindrada, vehiculoModelo" },
  { type: "poder",   name: "Poder especial para trámites de tránsito",          fields: "otorganteNombre, otorganteIdentificacion, apoderadoNombre, tramitesAutorizados(array de strings)" },
];

// 5. Analizar documento subido (usando Gemini — 5 llamadas paralelas, una por tipo)
app.post("/api/documents/analyze", async (req, res) => {
  const { fileName, mimeType, base64 } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "No se proporcionó data de imagen o archivo en base64" });
  }

  try {
    const ai = getGeminiClient();
    const imagePart = { inlineData: { data: base64, mimeType: mimeType || "image/png" } };
    const scannedAt = new Date().toISOString();
    const baseTime = Date.now();

    console.log(">>> LLAMANDO A GEMINI x5 (paralelo) con archivo:", fileName, mimeType);

    const tramiteId = "tramite_" + baseTime;

    const calls = DOC_TYPES.map(({ type, name, fields }, i) => {
      const prompt = `This file is a Colombian transit document package. It may contain multiple different documents.

Look ONLY for a "${name}" (documentType: "${type}") in this file.

If this document type IS present: extract its data and respond with this exact JSON:
{"found": true, "documentType": "${type}", "extractedData": {${fields}}, "confidence": 0.0-1.0, "summary": "una oración en español describiendo este documento"}

If this document type is NOT present in the file: respond with exactly:
{"found": false}

Rules:
- Respond ONLY with the JSON object, no markdown, no extra text.
- Pay attention to handwritten data in margins or corners.`;

      return ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [imagePart, { text: prompt }] }]
      }).then(response => {
        const raw = (response.text || '{"found":false}').replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.found) return null;
          return {
            id: "doc_" + (baseTime + i),
            tramiteId,
            fileName: fileName || "documento_escaneado.png",
            documentType: type,
            extractedData: parsed.extractedData || {},
            confidence: parsed.confidence || 0.8,
            summary: parsed.summary || `Documento ${name} procesado.`,
            scannedAt,
            syncStatus: "pending" as const,
            logs: []
          };
        } catch { return null; }
      }).catch(() => null);
    });

    const results = await Promise.all(calls);
    const newRecords = results.filter((r): r is NonNullable<typeof r> => r !== null);

    if (newRecords.length === 0) {
      return res.status(422).json({ error: "No se encontraron documentos de tránsito reconocibles en el archivo." });
    }

    console.log(`[Gemini] Documentos encontrados: ${newRecords.length}/${DOC_TYPES.length}`);
    newRecords.forEach(r => documentsDB.unshift(r));
    saveFile(DOCS_FILE, documentsDB);
    return res.status(201).json(newRecords);

  } catch (error: any) {
    console.error("Error procesando imagen con Gemini:", error);
    const isKeyError = error.message?.includes("API_KEY") || error.message?.includes("PERMISSION") || error.message?.includes("key");
    return res.status(500).json({
      error: isKeyError
        ? "API Key de Gemini inválida o sin permisos. Verifique la clave en el archivo .env"
        : "Error en el reconocimiento automático del documento",
      details: error.message || "Error desconocido"
    });
  }
});

// 5b. Analizar documento usando la API local de Jetson (OCR + Layout, sin GPU)
const JETSON_API_URL = process.env.JETSON_API_URL || "http://127.0.0.1:8000/api/v1/analyze-vision";

app.post("/api/documents/analyze-jetson", async (req, res) => {
  const { fileName, mimeType, base64 } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "No se proporcionó data de imagen o archivo en base64" });
  }

  try {
    const scannedAt = new Date().toISOString();
    const baseTime = Date.now();
    const tramiteId = "tramite_" + baseTime;

    console.log(">>> LLAMANDO A JETSON (OCR local) con archivo:", fileName, mimeType);

    // Convertir base64 a Blob y enviar como multipart/form-data al FastAPI
    const binary = Buffer.from(base64, "base64");
    const ext = (fileName || "").split(".").pop()?.toLowerCase() || "png";
    const safeName = fileName || `documento.${ext}`;
    const blob = new Blob([binary], { type: mimeType || "image/png" });
    const formData = new FormData();
    formData.append("file", blob, safeName);

    const jetsonApiKey = process.env.JETSON_API_KEY;
    if (!jetsonApiKey) {
      return res.status(500).json({
        error: "JETSON_API_KEY no configurada. Agréguela en el archivo .env (debe coincidir con una de las API_KEYS de la API FastAPI).",
      });
    }

    const jetsonRes = await fetch(JETSON_API_URL, {
      method: "POST",
      headers: { "X-API-Key": jetsonApiKey },
      body: formData,
    });

    if (!jetsonRes.ok) {
      const detail = await jetsonRes.text().catch(() => "");
      return res.status(502).json({
        error: `La API de Jetson respondió con status ${jetsonRes.status}`,
        details: detail,
      });
    }

    const jetsonData = await jetsonRes.json();
    const newRecords: any[] = [];

    // Formato 1: la API ya devuelve documentos estructurados (found/documentType/extractedData)
    const structuredDocs = Array.isArray(jetsonData?.documents)
      ? jetsonData.documents
      : jetsonData?.found !== undefined
        ? [jetsonData]
        : null;

    if (structuredDocs) {
      structuredDocs.forEach((parsed: any, i: number) => {
        if (!parsed.found) return;
        newRecords.push({
          id: "doc_" + (baseTime + i),
          tramiteId,
          fileName: safeName,
          documentType: parsed.documentType || "desconocido",
          extractedData: parsed.extractedData || {},
          confidence: parsed.confidence ?? 0.8,
          summary: parsed.summary || "Documento procesado con OCR local (Jetson).",
          scannedAt,
          syncStatus: "pending" as const,
          logs: []
        });
      });
    } else {
      // Formato 2: respuesta cruda de visión (pages/layout_elements) — guardar texto extraído
      const fullText = (jetsonData?.pages || [])
        .flatMap((p: any) => p.layout_elements || [])
        .map((el: any) => el.extracted_text || "")
        .join(" ")
        .trim();

      newRecords.push({
        id: "doc_" + baseTime,
        tramiteId,
        fileName: safeName,
        documentType: "desconocido",
        extractedData: {},
        confidence: 0,
        summary: `OCR local completado (${jetsonData?.total_pages || 1} página(s)). Complete los campos manualmente.`,
        scannedAt,
        syncStatus: "pending" as const,
        logs: [],
        rawText: fullText
      });
    }

    if (newRecords.length === 0) {
      return res.status(422).json({ error: "No se encontraron documentos reconocibles en el archivo." });
    }

    console.log(`[Jetson] Documentos procesados: ${newRecords.length}`);
    newRecords.forEach(r => documentsDB.unshift(r));
    saveFile(DOCS_FILE, documentsDB);
    return res.status(201).json(newRecords);

  } catch (error: any) {
    console.error("Error conectando con la API de Jetson:", error);
    const isConnError = error.message?.includes("fetch failed") || error.message?.includes("ECONNREFUSED");
    return res.status(500).json({
      error: isConnError
        ? `No se pudo conectar con la API de Jetson en ${JETSON_API_URL}. Verifique que el servidor FastAPI esté corriendo.`
        : "Error en el reconocimiento OCR local del documento",
      details: error.message || "Error desconocido"
    });
  }
});

// 6. Endpoint de Sincronización (Viajar por una API a otro sistema)
app.post("/api/documents/sync/:id", async (req, res) => {
  const { id } = req.params;
  const { targetUrl } = req.body; // URL configurable dada por el usuario

  const doc = documentsDB.find(d => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: "Documento no encontrado." });
  }

  const destinationUrl = targetUrl || "http://localhost:3000/api/external-system-mock";

  // Preparar el cuerpo que viajará por la API según las mejores prácticas full-stack
  // Un payload estándar que consolida la información organizada del trámite
  const apiPayload = {
    eventType: "DOCUMENT_REGISTRATION",
    sourceApp: "Registro de Tránsito Sincronizador",
    payloadId: "pay_" + Date.now(),
    documentId: doc.id,
    documentType: doc.documentType,
    scannedAt: doc.scannedAt,
    syncedAt: new Date().toISOString(),
    extractedData: doc.extractedData,
    confidence: doc.confidence,
    summary: doc.summary
  };

  const syncLog: any = {
    timestamp: new Date().toISOString(),
    url: destinationUrl,
    method: "POST",
    requestPayload: apiPayload,
  };

  try {
    // Usar fetch nativo (disponible en Node 18+) para hacer la llamada real de API
    const response = await fetch(destinationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "http://localhost:3000"
      },
      body: JSON.stringify(apiPayload)
    });

    const status = response.status;
    let responseBody: any = null;

    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = await response.text();
    }

    syncLog.responseStatus = status;
    syncLog.responseBody = responseBody;
    syncLog.success = status >= 200 && status < 300;

    // Actualizar base de datos de origen con estado e historial
    doc.syncStatus = syncLog.success ? "success" : "failed";
    doc.syncUrlUsed = destinationUrl;
    doc.logs.unshift(syncLog);
    saveFile(DOCS_FILE, documentsDB);

    return res.json({
      success: syncLog.success,
      status,
      responseBody,
      logEntry: syncLog
    });

  } catch (err: any) {
    console.error("Error conectando con la API externa:", err);
    syncLog.responseStatus = 500;
    syncLog.responseBody = { error: "Fallo de conexión de red", details: err.message };
    syncLog.success = false;

    doc.syncStatus = "failed";
    doc.syncUrlUsed = destinationUrl;
    doc.logs.unshift(syncLog);
    saveFile(DOCS_FILE, documentsDB);

    return res.status(500).json({
      success: false,
      error: "Ocurrió un error al enviar por API al otro sistema.",
      details: err.message,
      logEntry: syncLog
    });
  }
});


/* ==================== VALIDACIÓN DE CAMPOS POR TIPO DE DOCUMENTO ==================== */

const REQUIRED_FIELDS: Record<string, { field: string; label: string }[]> = {
  cedula: [
    { field: "nombreCompleto",    label: "Nombre completo" },
    { field: "numeroDocumento",   label: "Número de documento" },
    { field: "fechaNacimiento",   label: "Fecha de nacimiento" },
    { field: "sexo",              label: "Sexo" },
  ],
  factura: [
    { field: "numeroFactura",           label: "Número de factura" },
    { field: "fecha",                   label: "Fecha de la factura" },
    { field: "compradorNombre",         label: "Nombre del comprador" },
    { field: "compradorIdentificacion", label: "Identificación del comprador" },
    { field: "vehiculoMarca",           label: "Marca del vehículo" },
    { field: "vehiculoLinea",           label: "Línea del vehículo" },
    { field: "vehiculoModelo",          label: "Modelo del vehículo" },
    { field: "vehiculoMotor",           label: "Número de motor" },
    { field: "vehiculoChasis",          label: "Número de chasis" },
    { field: "valorTotal",              label: "Valor total de venta" },
  ],
  runt: [
    { field: "tramiteSolicitado",          label: "Trámite solicitado" },
    { field: "propietarioNombre",          label: "Nombre del propietario" },
    { field: "propietarioIdentificacion",  label: "Identificación del propietario" },
    { field: "vehiculoMarca",              label: "Marca del vehículo" },
    { field: "vehiculoLinea",              label: "Línea del vehículo" },
    { field: "vehiculoMotor",              label: "Número de motor" },
    { field: "vehiculoChasis",             label: "Número de chasis" },
  ],
  gases: [
    { field: "tipoCertificado",   label: "Tipo de certificado" },
    { field: "fechaCertificado",  label: "Fecha del certificado" },
    { field: "vehiculoMarca",     label: "Marca del vehículo" },
    { field: "vehiculoChasis",    label: "Número de chasis" },
    { field: "vehiculoMotor",     label: "Número de motor" },
    { field: "vehiculoCilindrada", label: "Cilindrada" },
  ],
  poder: [
    { field: "otorganteNombre",          label: "Nombre del otorgante" },
    { field: "otorganteIdentificacion",  label: "Identificación del otorgante" },
    { field: "tramitesAutorizados",      label: "Trámites autorizados" },
  ],
};

function validateDocumentPayload(documentType: string, extractedData: any): { valid: boolean; missingFields: { field: string; label: string }[] } {
  const rules = REQUIRED_FIELDS[documentType];
  if (!rules) {
    return { valid: false, missingFields: [{ field: "documentType", label: `Tipo de documento desconocido: "${documentType}"` }] };
  }

  const missingFields = rules.filter(({ field }) => {
    const value = extractedData[field];
    if (value === undefined || value === null || value === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  });

  return { valid: missingFields.length === 0, missingFields };
}


// 7. Endpoint de validación standalone (útil para Postman / integración externa)
app.post("/api/validate", (req, res) => {
  const { documentType, extractedData } = req.body;

  if (!documentType || !extractedData) {
    return res.status(400).json({
      status: "error",
      message: "Se requieren los campos 'documentType' y 'extractedData'.",
    });
  }

  const { valid, missingFields } = validateDocumentPayload(documentType, extractedData);

  if (!valid) {
    return res.status(422).json({
      status: "validation_error",
      documentType,
      valid: false,
      missingCount: missingFields.length,
      missingFields: missingFields.map(f => ({ field: f.field, label: f.label })),
      message: `Faltan ${missingFields.length} campo(s) obligatorio(s): ${missingFields.map(f => f.label).join(", ")}.`,
    });
  }

  return res.status(200).json({
    status: "ok",
    documentType,
    valid: true,
    message: "El payload es válido. Todos los campos obligatorios están presentes.",
  });
});


// 8. API interna Mock para simular "la base de datos de otra aplicación" que recibe el registro
app.post("/api/external-system-mock", (req, res) => {
  const { documentId, documentType, extractedData } = req.body;

  // Validación básica de estructura
  if (!documentType || !extractedData) {
    return res.status(400).json({
      status: "error",
      message: "Payload inválido. Se requieren 'documentType' y 'extractedData'.",
    });
  }

  // Validación de campos obligatorios según tipo de documento
  const { valid, missingFields } = validateDocumentPayload(documentType, extractedData);
  if (!valid) {
    return res.status(422).json({
      status: "validation_error",
      documentType,
      valid: false,
      missingCount: missingFields.length,
      missingFields: missingFields.map(f => ({ field: f.field, label: f.label })),
      message: `No se puede registrar el documento. Faltan ${missingFields.length} campo(s) obligatorio(s): ${missingFields.map(f => f.label).join(", ")}.`,
    });
  }

  // Mapeo de campos clave para la tabla del sistema destino
  let clientName = "Desconocido";
  let clientDocId = "N/A";
  let vehicleChasis = "N/A";
  let vehicleMotor = "N/A";

  if (documentType === "cedula") {
    clientName = extractedData.nombreCompleto || clientName;
    clientDocId = extractedData.numeroDocumento || clientDocId;
  } else if (documentType === "factura") {
    clientName = extractedData.compradorNombre || clientName;
    clientDocId = extractedData.compradorIdentificacion || clientDocId;
    vehicleChasis = extractedData.vehiculoChasis || vehicleChasis;
    vehicleMotor = extractedData.vehiculoMotor || vehicleMotor;
  } else if (documentType === "runt") {
    clientName = extractedData.propietarioNombre || clientName;
    clientDocId = extractedData.propietarioIdentificacion || clientDocId;
    vehicleChasis = extractedData.vehiculoChasis || vehicleChasis;
    vehicleMotor = extractedData.vehiculoMotor || vehicleMotor;
  } else if (documentType === "gases") {
    vehicleChasis = extractedData.vehiculoChasis || vehicleChasis;
    vehicleMotor = extractedData.vehiculoMotor || vehicleMotor;
    // Certificados de gases no tienen nombre de persona — usar marca+línea como identificador
    const marca = extractedData.vehiculoMarca || "";
    const linea = extractedData.vehiculoLinea || "";
    if (marca || linea) clientName = `Vehículo ${marca} ${linea}`.trim();
  } else if (documentType === "poder") {
    clientName = extractedData.otorganteNombre || clientName;
    clientDocId = extractedData.otorganteIdentificacion || clientDocId;
  }

  const mockRecord: ExternalRecord = {
    id: "ext_" + Math.random().toString(36).slice(2, 11),
    receivedAt: new Date().toISOString(),
    originDocumentId: documentId || "doc_unknown",
    documentType,
    clientName,
    clientDocId,
    vehicleChasis,
    vehicleMotor,
    details: extractedData
  };

  externalSystemDB.unshift(mockRecord);
  saveFile(EXT_FILE, externalSystemDB);

  return res.status(201).json({
    status: "success",
    recordId: mockRecord.id,
    receivedAt: mockRecord.receivedAt,
    documentType,
    clientName,
    message: "Documento recibido y registrado correctamente en la base de datos del sistema destino.",
  });
});



// API Docs — sirve la página de documentación
app.use("/public", express.static(path.join(process.cwd(), "public")));
app.get("/api-docs", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "api-docs.html"));
});

/* ==================== VITE MIDDLEWARE CONFIGURATION ==================== */

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Monta el middleware de desarrollo de Vite
    app.use(vite.middlewares);
  } else {
    // Sirve archivos estáticos compilados en producción
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
console.log("=== SERVIDOR v3 INICIADO - GEMINI 2.5 FLASH SIN JSON FORZADO ===");
