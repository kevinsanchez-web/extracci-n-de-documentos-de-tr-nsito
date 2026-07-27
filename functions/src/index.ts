/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada en Firebase secrets.");
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha", headers: { "User-Agent": "aistudio-build" } }
    });
  }
  return geminiClient;
}



const REQUIRED_FIELDS: Record<string, { field: string; label: string }[]> = {
  cedula: [
    { field: "nombreCompleto", label: "Nombre completo" },
    { field: "numeroDocumento", label: "Número de documento" },
    { field: "fechaNacimiento", label: "Fecha de nacimiento" },
    { field: "sexo", label: "Sexo" }
  ],
  factura: [
    { field: "numeroFactura", label: "Número de factura" },
    { field: "fecha", label: "Fecha de la factura" },
    { field: "compradorNombre", label: "Nombre del comprador" },
    { field: "compradorIdentificacion", label: "Identificación del comprador" },
    { field: "vehiculoMarca", label: "Marca del vehículo" },
    { field: "vehiculoLinea", label: "Línea del vehículo" },
    { field: "vehiculoModelo", label: "Modelo del vehículo" },
    { field: "vehiculoMotor", label: "Número de motor" },
    { field: "vehiculoChasis", label: "Número de chasis" },
    { field: "valorTotal", label: "Valor total de venta" }
  ],
  runt: [
    { field: "tramiteSolicitado", label: "Trámite solicitado" },
    { field: "propietarioNombre", label: "Nombre del propietario" },
    { field: "propietarioIdentificacion", label: "Identificación del propietario" },
    { field: "vehiculoMarca", label: "Marca del vehículo" },
    { field: "vehiculoLinea", label: "Línea del vehículo" },
    { field: "vehiculoMotor", label: "Número de motor" },
    { field: "vehiculoChasis", label: "Número de chasis" }
  ],
  gases: [
    { field: "tipoCertificado", label: "Tipo de certificado" },
    { field: "fechaCertificado", label: "Fecha del certificado" },
    { field: "vehiculoMarca", label: "Marca del vehículo" },
    { field: "vehiculoChasis", label: "Número de chasis" },
    { field: "vehiculoMotor", label: "Número de motor" },
    { field: "vehiculoCilindrada", label: "Cilindrada" }
  ],
  poder: [
    { field: "otorganteNombre", label: "Nombre del otorgante" },
    { field: "otorganteIdentificacion", label: "Identificación del otorgante" },
    { field: "tramitesAutorizados", label: "Trámites autorizados" }
  ]
};

function validateDocumentPayload(documentType: string, extractedData: any) {
  const rules = REQUIRED_FIELDS[documentType];
  if (!rules) return { valid: false, missingFields: [{ field: "documentType", label: `Tipo desconocido: "${documentType}"` }] };
  const missingFields = rules.filter(({ field }) => {
    const v = extractedData[field];
    if (v === undefined || v === null || v === "") return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  });
  return { valid: missingFields.length === 0, missingFields };
}

/* ==================== API ENDPOINTS ==================== */

// 1. Obtener todos los documentos
app.get("/api/documents", async (_req, res) => {
  try {
    const snapshot = await db.collection("documents").orderBy("scannedAt", "desc").get();
    res.json(snapshot.docs.map(d => d.data()));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Base de datos externa simulada
app.get("/api/external-system-db", async (_req, res) => {
  try {
    const snapshot = await db.collection("external-records").orderBy("receivedAt", "desc").get();
    res.json(snapshot.docs.map(d => d.data()));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Limpiar DB externa
app.delete("/api/external-system-db/clear", async (_req, res) => {
  try {
    const snapshot = await db.collection("external-records").get();
    const batch = db.batch();
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ message: "Base de datos externa vaciada." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Eliminar un documento
app.delete("/api/documents/:id", async (req, res) => {
  try {
    await db.collection("documents").doc(req.params.id).delete();
    res.json({ success: true, message: "Documento eliminado." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4b. Actualizar datos extraídos de un documento (Guardar cambios)
app.patch("/api/documents/:id", async (req, res) => {
  const { extractedData } = req.body;
  try {
    await db.collection("documents").doc(req.params.id).update({ extractedData });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Tipos de documentos de tránsito a detectar
const DOC_TYPES = [
  {
    type: "cedula",
    name: "Cédula de Ciudadanía colombiana",
    fields: "nombreCompleto, numeroDocumento, fechaNacimiento, sexo, rh, estatura, contacto:{celular,correo,direccion}"
  },
  {
    type: "factura",
    name: "Factura de compraventa de vehículo",
    fields: "numeroFactura, fecha, compradorNombre, compradorIdentificacion, vehiculoMarca, vehiculoLinea, vehiculoModelo, vehiculoMotor, vehiculoChasis, vehiculoCilindrada, vehiculoColor, valorTotal(entero)"
  },
  {
    type: "runt",
    name: "Formulario de solicitud de trámites RUNT",
    fields: "tramiteSolicitado, propietarioNombre, propietarioIdentificacion, vehiculoMarca, vehiculoLinea, vehiculoMotor, vehiculoChasis, vehiculoModelo, vehiculoCilindrada, vehiculoColor"
  },
  {
    type: "gases",
    name: "Certificado de emisiones de gases o empadronamiento de vehículo",
    fields: "tipoCertificado, fechaCertificado, vehiculoMarca, vehiculoLinea, vehiculoChasis, vehiculoMotor, vehiculoCilindrada, vehiculoModelo"
  },
  {
    type: "poder",
    name: "Poder especial para trámites de tránsito",
    fields: "otorganteNombre, otorganteIdentificacion, apoderadoNombre, tramitesAutorizados(array de strings)"
  },
];

// 5. Analizar documento con Gemini — 5 llamadas paralelas (una por tipo)
app.post("/api/documents/analyze", async (req, res) => {
  const { fileName, mimeType, base64 } = req.body;

  if (!base64) return res.status(400).json({ error: "No se proporcionó data en base64." });

  try {
    const ai = getGeminiClient();
    const imagePart = { inlineData: { data: base64, mimeType: mimeType || "image/png" } };
    const scannedAt = new Date().toISOString();
    const baseTime = Date.now();

    console.log(">>> LLAMANDO A GEMINI x5 (paralelo):", fileName, mimeType);

    // Una llamada por tipo de documento — cada una pregunta solo por su tipo específico
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
            syncStatus: "pending",
            logs: []
          };
        } catch {
          return null;
        }
      }).catch(() => null);
    });

    const results = await Promise.all(calls);
    const newRecords = results.filter((r): r is NonNullable<typeof r> => r !== null);

    if (newRecords.length === 0) {
      return res.status(422).json({ error: "No se encontraron documentos de tránsito reconocibles en el archivo." });
    }

    console.log(`[Gemini] Documentos encontrados: ${newRecords.length}/${DOC_TYPES.length}`);
    const batch = db.batch();
    newRecords.forEach(r => batch.set(db.collection("documents").doc(r.id), r));
    await batch.commit();
    return res.status(201).json(newRecords);

  } catch (error: any) {
    console.error("Error Gemini:", error);
    const isKeyError = error.message?.includes("API_KEY") || error.message?.includes("PERMISSION");
    return res.status(500).json({
      error: isKeyError ? "API Key inválida o sin permisos." : "Error en el reconocimiento del documento",
      details: error.message
    });
  }
});

// 6. Sincronización hacia sistema destino
app.post("/api/documents/sync/:id", async (req, res) => {
  const { id } = req.params;
  const { targetUrl } = req.body;

  const docRef = db.collection("documents").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return res.status(404).json({ error: "Documento no encontrado." });
  const doc: any = docSnap.data();

  const destinationUrl = targetUrl || "https://sincronizador-tramites-transito.web.app/api/external-system-mock";

  const apiPayload = {
    eventType: "DOCUMENT_REGISTRATION",
    sourceApp: "Registro de Tránsito Sincronizador",
    payloadId: "pay_" + Date.now(),
    documentId: doc.id, documentType: doc.documentType,
    scannedAt: doc.scannedAt, syncedAt: new Date().toISOString(),
    extractedData: doc.extractedData, confidence: doc.confidence, summary: doc.summary
  };

  const syncLog: any = { timestamp: new Date().toISOString(), url: destinationUrl, method: "POST", requestPayload: apiPayload };

  try {
    const response = await fetch(destinationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiPayload)
    });
    const status = response.status;
    let responseBody: any;
    try { responseBody = await response.json(); } catch (e) { responseBody = await response.text(); }
    syncLog.responseStatus = status;
    syncLog.responseBody = responseBody;
    syncLog.success = status >= 200 && status < 300;

    const logs = [syncLog, ...(doc.logs || [])];
    await docRef.update({ syncStatus: syncLog.success ? "success" : "failed", syncUrlUsed: destinationUrl, logs });

    return res.json({ success: syncLog.success, status, responseBody, logEntry: syncLog });
  } catch (err: any) {
    console.error("Error sync:", err);
    syncLog.responseStatus = 500;
    syncLog.responseBody = { error: err.message };
    syncLog.success = false;
    const logs = [syncLog, ...(doc.logs || [])];
    await docRef.update({ syncStatus: "failed", syncUrlUsed: destinationUrl, logs });
    return res.status(500).json({ success: false, error: "Error al sincronizar.", details: err.message, logEntry: syncLog });
  }
});

// 7. Validación standalone
app.post("/api/validate", (req, res) => {
  const { documentType, extractedData } = req.body;
  if (!documentType || !extractedData) return res.status(400).json({ status: "error", message: "Se requieren documentType y extractedData." });
  const { valid, missingFields } = validateDocumentPayload(documentType, extractedData);
  if (!valid) return res.status(422).json({ status: "validation_error", documentType, valid: false, missingCount: missingFields.length, missingFields });
  return res.status(200).json({ status: "ok", documentType, valid: true, message: "Payload válido." });
});

// 8. Sistema externo mock (receptor)
app.post("/api/external-system-mock", async (req, res) => {
  const { documentId, documentType, extractedData } = req.body;
  if (!documentType || !extractedData) return res.status(400).json({ status: "error", message: "Payload inválido." });

  const { valid, missingFields } = validateDocumentPayload(documentType, extractedData);
  if (!valid) return res.status(422).json({ status: "validation_error", documentType, valid: false, missingCount: missingFields.length, missingFields });

  let clientName = "Desconocido", clientDocId = "N/A", vehicleChasis = "N/A", vehicleMotor = "N/A";
  if (documentType === "cedula") { clientName = extractedData.nombreCompleto; clientDocId = extractedData.numeroDocumento; }
  else if (documentType === "factura") { clientName = extractedData.compradorNombre; clientDocId = extractedData.compradorIdentificacion; vehicleChasis = extractedData.vehiculoChasis; vehicleMotor = extractedData.vehiculoMotor; }
  else if (documentType === "runt") { clientName = extractedData.propietarioNombre; clientDocId = extractedData.propietarioIdentificacion; vehicleChasis = extractedData.vehiculoChasis; vehicleMotor = extractedData.vehiculoMotor; }
  else if (documentType === "gases") {
    vehicleChasis = extractedData.vehiculoChasis || "N/A";
    vehicleMotor = extractedData.vehiculoMotor || "N/A";
    const marca = extractedData.vehiculoMarca || "";
    const linea = extractedData.vehiculoLinea || "";
    if (marca || linea) clientName = `Vehículo ${marca} ${linea}`.trim();
  }
  else if (documentType === "poder") { clientName = extractedData.otorganteNombre; clientDocId = extractedData.otorganteIdentificacion; }

  const recordId = "ext_" + Math.random().toString(36).slice(2, 11);
  const mockRecord = {
    id: recordId, receivedAt: new Date().toISOString(),
    originDocumentId: documentId || "doc_unknown", documentType,
    clientName, clientDocId, vehicleChasis, vehicleMotor, details: extractedData
  };

  await db.collection("external-records").doc(recordId).set(mockRecord);
  return res.status(201).json({ status: "success", recordId, receivedAt: mockRecord.receivedAt, documentType, clientName, message: "Documento registrado en el sistema destino." });
});

export const tramitesApi = functions.https.onRequest(app);
