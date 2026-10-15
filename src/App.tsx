/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DocumentRecord, ExternalRecord } from "./types";
import DocumentDropzone from "./components/DocumentDropzone";
import ActiveDocumentDetail from "./components/ActiveDocumentDetail";
import DocumentList from "./components/DocumentList";
import DocumentTypeTabs from "./components/DocumentTypeTabs";
import ExternalDatabaseView from "./components/ExternalDatabaseView";
import NetworkLogModal from "./components/NetworkLogModal";
import { analyzeWithJetson } from "./lib/jetsonClient";
import {
  Cpu, BookOpen, Clock, Info, ExternalLink,
  RefreshCw, Moon, Sun,
  TriangleAlert, Check, X
} from "lucide-react";

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [externalRecords, setExternalRecords] = useState<ExternalRecord[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | undefined>(undefined);
  
  // Estados de carga (loaders)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingExtDb, setIsLoadingExtDb] = useState(false);
  
  // Modales
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark");

  // Motor de IA seleccionado: Gemini (nube) o Local (OCR en el equipo; internamente "jetson")
  const [aiEngine, setAiEngine] = useState<"gemini" | "jetson">(
    () => localStorage.getItem("aiEngine") === "jetson" ? "jetson" : "gemini"
  );
  const changeAiEngine = (engine: "gemini" | "jetson") => {
    setAiEngine(engine);
    localStorage.setItem("aiEngine", engine);
  };

  // Endpoint configurable de API
  const [targetApiUrl, setTargetApiUrl] = useState(() => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    return isLocal
      ? "http://localhost:3000/api/external-system-mock"
      : `${window.location.origin}/api/external-system-mock`;
  });

  // Aviso de error en pantalla (reemplaza a alert(), ver reglas de diseño 5.7)
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const activeDoc = documents.find((d) => d.id === activeDocId) || null;

  // Documentos del trámite activo (para las pestañas por tipo)
  const activeTramiteKey = activeDoc ? (activeDoc.tramiteId || activeDoc.id) : null;
  const tramiteDocs = activeTramiteKey
    ? documents.filter((d) => (d.tramiteId || d.id) === activeTramiteKey)
    : [];
  const selectDocumentType = (type: string) => {
    const match = tramiteDocs.find((d) => d.documentType === type);
    if (match) setActiveDocId(match.id);
  };

  // El tema oscuro se aplica a <html> para que las variables CSS y el fondo del body cambien juntos
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Esc cierra la guía de uso
  useEffect(() => {
    if (!showHelpModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowHelpModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelpModal]);


  // Cargar datos iniciales al arrancar la app
  useEffect(() => {
    fetchDocumentsAndExternalDb();
  }, []);

  const fetchDocumentsAndExternalDb = async () => {
    try {
      const docsRes = await fetch("/api/documents");
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
        if (docsData.length > 0 && !activeDocId) {
          setActiveDocId(docsData[0].id);
        }
      }

      const extRes = await fetch("/api/external-system-db");
      if (extRes.ok) {
        const extData = await extRes.json();
        setExternalRecords(extData);
      }
    } catch (e) {
      console.error("Error al refrescar bases de datos:", e);
    }
  };

  // 1. Analizar archivo subido (MimeType / Base64)
  const handleAnalyzeDocument = async (base64: string, mimeType: string, fileName: string) => {
    setIsAnalyzing(true);

    const isGemini = aiEngine === "gemini";
    const endpoint = isGemini ? "/api/documents/analyze" : "/api/documents/analyze-jetson";
    const engineLabel = isGemini ? "Gemini" : "Local (OCR)";

    // Simular pequeños pasos de progreso visuales para una experiencia excelente de usuario
    const steps = isGemini
      ? [
          "Subiendo archivo encryptado de tránsito y lanzando IA de Gemini...",
          "Ejecutando OCR inteligente y descifrando firmas manuscritas...",
          "Clasificando formulario y aplicando mapeo de propiedades...",
          "Formateando esquema JSON listo para sincronizar vía API...",
        ]
      : [
          `Subiendo archivo y enviándolo a ${engineLabel}...`,
          "Ejecutando OCR local y detectando maquetación...",
          "Clasificando formulario y extrayendo campos...",
          "Formateando esquema JSON listo para sincronizar vía API...",
        ];
    setAnalyzeMsg(steps[0]);

    let stepIndex = 0;
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setAnalyzeMsg(steps[stepIndex]);
      }
    }, 1500);

    try {
      let newRecords: any[];
      if (isGemini) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType, fileName }),
        });

        clearInterval(interval);

        if (!res.ok) {
          const errData = await res.json();
          const msg = [errData.error, errData.details].filter(Boolean).join(" — ");
          throw new Error(msg || "Fallo en la comunicación con la IA");
        }

        const result = await res.json();
        newRecords = Array.isArray(result) ? result : [result];
      } else {
        // OCR local: trabajo asíncrono con el avance real de la lectura (en vez de los mensajes simulados)
        clearInterval(interval);
        newRecords = await analyzeWithJetson(base64, mimeType, fileName, setAnalyzeMsg);
      }
      setDocuments((prev) => [...newRecords, ...prev]);
      setActiveDocId(newRecords[0].id);
    } catch (error: any) {
      setErrorNotice(`Error al analizar el documento:\n${error.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalyzeMsg("");
    }
  };

  // 2. Guardar cambios de datos — actualiza estado local Y persiste en el servidor
  const handleUpdateDocumentData = async (id: string, updatedData: any) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, extractedData: updatedData } : doc))
    );
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedData: updatedData }),
      });
    } catch (e) {
      console.error("Error guardando en servidor:", e);
    }
  };

  // 4. Sincronizar vía API al sistema externo
  const handleSyncDocument = async (id: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/documents/sync/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: targetApiUrl }),
      });

      const syncResult = await res.json();
      
      // Actualizar listado local de documentos
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id === id) {
            const success = syncResult.success;
            return {
              ...doc,
              syncStatus: success ? "success" : "failed",
              syncUrlUsed: targetApiUrl,
              logs: [syncResult.logEntry, ...(doc.logs || [])],
            };
          }
          return doc;
        })
      );

      // Refrescar DB externa del otro sistema visible
      await refreshExternalDb();

      if (syncResult.success) {
        // Mostrar pequeña confirmación opcional o abrir inspector
        setTimeout(() => {
          setShowLogModal(true);
        }, 500);
      } else {
        setErrorNotice(`Fallo en el envío por API: el servidor retornó status ${syncResult.status}.`);
      }

    } catch (e: any) {
      setErrorNotice(`Error de sincronización: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 5. Vaciar DB externa simulada de tránsito
  const handleClearExternalDb = async () => {
    setIsLoadingExtDb(true);
    try {
      await fetch("/api/external-system-db/clear", { method: "DELETE" });
      await refreshExternalDb();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingExtDb(false);
    }
  };

  // 6. Eliminar un documento del historial
  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocId === id) setActiveDocId(undefined);
    } catch (e) {
      console.error(e);
    }
  };

  // 7. Eliminar todos los documentos de un trámite completo
  const handleDeleteTramite = async (tramiteId: string) => {
    const toDelete = documents.filter((d) => (d.tramiteId || d.id) === tramiteId);
    await Promise.all(toDelete.map((d) => fetch(`/api/documents/${d.id}`, { method: "DELETE" })));
    setDocuments((prev) => prev.filter((d) => (d.tramiteId || d.id) !== tramiteId));
    if (toDelete.some((d) => d.id === activeDocId)) setActiveDocId(undefined);
  };

  // 8. Nuevo trámite — limpia la sesión activa sin borrar el historial
  const handleNuevoTramite = () => {
    setActiveDocId(undefined);
  };

  const refreshExternalDb = async () => {
    setIsLoadingExtDb(true);
    try {
      const res = await fetch("/api/external-system-db");
      if (res.ok) {
        const extData = await res.json();
        setExternalRecords(extData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingExtDb(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased bg-app text-ink transition-colors duration-200">

      {/* HEADER (fijo arriba): una sola fila en móvil con el selector de proveedor incluido */}
      <header className="sticky top-0 z-40 safe-top px-3 sm:px-5 py-2.5 md:py-3">
        <div className="glass-layer" aria-hidden="true" />
        <div className="max-w-7xl mx-auto flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-3 min-w-0 md:shrink">
            <div className="tone-powder pastel-edge w-9 h-9 shrink-0 rounded-2xl flex items-center justify-center">
              <Cpu className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="sr-only md:not-sr-only min-w-0">
              <h1 className="t-h2 truncate" id="app-title-main">
                Scanner & Sincronizador · Trámites de Tránsito
              </h1>
              <p className="t-caption header-sub hidden lg:block truncate">
                Cédulas · Facturas · RUNT · Gases · Poderes — REST API v1.0
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-1 min-w-0 flex-wrap md:flex-nowrap items-center gap-2 md:justify-end">
            {/* SWITCH DE PROVEEDOR: GEMINI (NUBE) O LOCAL (OCR EN EL EQUIPO) */}
            <div
              className="card-compact flex flex-1 basis-32 md:basis-auto md:flex-none items-center gap-1 p-1 min-w-fit"
              id="ai-engine-switch"
              role="group"
              aria-label="Proveedor de análisis de documentos"
            >
              <button
                onClick={() => changeAiEngine("gemini")}
                aria-pressed={aiEngine === "gemini"}
                className="btn btn-ghost !rounded-xl !px-2.5 md:!px-3 flex-1 md:flex-none"
              >
                {aiEngine === "gemini" && <Check className="w-4 h-4" aria-hidden="true" />}
                Gemini
              </button>
              <button
                onClick={() => changeAiEngine("jetson")}
                aria-pressed={aiEngine === "jetson"}
                className="btn btn-ghost !rounded-xl !px-2.5 md:!px-3 flex-1 md:flex-none"
              >
                {aiEngine === "jetson" && <Check className="w-4 h-4" aria-hidden="true" />}
                Local
              </button>
            </div>

            <a
              href="/api-docs"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-on-header min-w-8 pointer-coarse:min-w-11 shrink-0 !px-3 md:!px-5"
              aria-label="API Docs"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="hidden md:inline">API Docs</span>
            </a>

            <button
              onClick={() => setShowHelpModal(true)}
              className="btn btn-secondary min-w-8 pointer-coarse:min-w-11 shrink-0 !px-3 md:!px-5"
              id="btn-case-guide"
              aria-label="Guía del Caso"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span className="hidden md:inline">Guía del Caso</span>
            </button>

            <button
              onClick={() => { const next = !isDark; setIsDark(next); localStorage.setItem("theme", next ? "dark" : "light"); }}
              className="btn btn-ghost btn-icon btn-on-header shrink-0"
              title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              id="btn-toggle-theme"
            >
              {isDark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* PROCESAMIENTO EN CURSO (Gemini / Local) */}
      {isAnalyzing && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-5 lg:px-8 pt-4 animate-screen-in" role="status" aria-live="polite" aria-busy="true">
          <div className="pastel-soft tone-sky p-4 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
            <p className="t-body">
              <span className="font-bold">Procesando trámite:</span>{" "}
              <span>{analyzeMsg}</span>
            </p>
          </div>
        </div>
      )}

      {/* ERROR (reemplaza a alert()) */}
      {errorNotice && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-5 lg:px-8 pt-4 animate-screen-in" role="alert">
          <div className="pastel-soft tone-coral p-4 flex items-start gap-3">
            <TriangleAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="t-body flex-1 whitespace-pre-line break-words">{errorNotice}</p>
            <button
              onClick={() => setErrorNotice(null)}
              className="btn btn-ghost btn-icon shrink-0"
              aria-label="Cerrar aviso de error"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* CUERPO PRINCIPAL. Orden de trabajo: subir → revisar el documento → historial → verificar destino.
          Móvil: carga, detalle, historial (plegado), destino (plegado). Escritorio: carga arriba, historial y detalle lado a lado. */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-5 lg:p-8 pb-8 flex flex-col gap-4 md:gap-5">

        {/* 1. CARGA: barra compacta con "Nuevo Trámite" */}
        <DocumentDropzone
          onAnalyze={handleAnalyzeDocument}
          isAnalyzing={isAnalyzing}
          onShowHelp={() => setShowHelpModal(true)}
          onNewTramite={handleNuevoTramite}
        />

        {/* 2. HISTORIAL (izquierda en escritorio, después del detalle en móvil) Y DETALLE (derecha) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 items-start">

          <div className="order-2 md:order-1 md:col-span-5 lg:col-span-4 min-w-0">
            <div className="card overflow-hidden flex flex-col h-[26rem] md:h-[var(--panel-h)]">
              <div className="px-5 py-4 shrink-0">
                <h2 className="t-h2 flex items-center gap-2">
                  Historial de Documentos
                  <span className="t-caption nums">({documents.length})</span>
                </h2>
              </div>
              <div className="border-t divider flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <DocumentList
                  documents={documents}
                  activeId={activeDocId}
                  onSelect={(id) => {
                    setActiveDocId(id);
                    setShowLogModal(false);
                  }}
                  onDelete={handleDeleteDocument}
                  onDeleteTramite={handleDeleteTramite}
                />
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2 md:col-span-7 lg:col-span-8 min-w-0 md:h-[var(--panel-h)]">
            <ActiveDocumentDetail
              document={activeDoc}
              onUpdateDocumentData={handleUpdateDocumentData}
              onSyncDocument={handleSyncDocument}
              onDeleteDocument={(id) => handleDeleteDocument(id, { stopPropagation: () => {} } as React.MouseEvent)}
              isSyncing={isSyncing}
              apiUrl={targetApiUrl}
              tabs={
                activeDoc ? (
                  <DocumentTypeTabs
                    documents={tramiteDocs}
                    activeType={activeDoc.documentType}
                    onSelect={selectDocumentType}
                  />
                ) : undefined
              }
            />
          </div>

        </div>

        {/* 3. VERIFICACIÓN: sistema destino (plegado por defecto) */}
        <ExternalDatabaseView
          records={externalRecords}
          onClear={handleClearExternalDb}
          isLoading={isLoadingExtDb}
          onRefresh={refreshExternalDb}
        />

      </main>

      {/* INSPECTOR DE LOGS DE RED (MODAL) */}
      {showLogModal && activeDoc && (
        <NetworkLogModal
          document={activeDoc}
          onClose={() => setShowLogModal(false)}
        />
      )}

      {/* GUÍA DE USO (MODAL: bottom sheet en móvil) */}
      {showHelpModal && (
        <div className="modal-scrim" id="help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div
            className="modal-panel modal-panel-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b divider flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="tone-powder pastel-edge w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 shrink-0 rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="t-h2" id="help-modal-title">
                  Guía de Uso — Scanner de Documentos de Tránsito
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="btn btn-ghost shrink-0"
                id="btn-close-help"
                autoFocus
              >
                Cerrar
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-6 t-body custom-scrollbar">
              <div className="pastel-soft tone-sky p-4 flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold mb-1">¿Qué hace esta aplicación?</p>
                  <p>
                    Escanea un PDF con los documentos de un trámite de tránsito colombiano, extrae automáticamente los datos de cada documento usando <strong>Gemini AI</strong>, permite revisarlos y corregirlos, y los sincroniza con el sistema de registro externo.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="t-h2 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pastel-powder border border-line" aria-hidden="true"></span> Documentos soportados
                </h4>
                <ul className="space-y-3 pl-1">
                  <li>
                    <strong>Cédula de Ciudadanía</strong>: nombre completo, número de documento, fecha de nacimiento, sexo, RH, estatura y datos de contacto (celular, correo, dirección), incluyendo datos manuscritos.
                  </li>
                  <li>
                    <strong>Factura de Compraventa de Vehículo</strong>: número de factura, fecha, datos del comprador, marca, línea, modelo, motor, chasis, cilindrada, color y valor total.
                  </li>
                  <li>
                    <strong>Formulario RUNT</strong>: trámite solicitado, datos del propietario, y datos técnicos del vehículo (marca, línea, motor, chasis, modelo, cilindrada, color).
                  </li>
                  <li>
                    <strong>Certificado de Gases / Empadronamiento</strong>: tipo de certificado, fecha, datos del vehículo (marca, línea, chasis, motor, cilindrada, modelo).
                  </li>
                  <li>
                    <strong>Poder Especial de Tránsito</strong>: nombre e identificación del otorgante, nombre del apoderado y lista de trámites autorizados.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="t-h2 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" aria-hidden="true" /> Flujo de trabajo paso a paso
                </h4>
                <ol className="list-decimal list-inside space-y-3 pl-1.5">
                  <li>
                    Arrastre o seleccione el PDF del trámite en la zona de carga. El sistema acepta un PDF con todos los documentos del cliente en un solo archivo.
                  </li>
                  <li>
                    Gemini AI analiza el archivo en paralelo y detecta automáticamente los documentos presentes (hasta 5 tipos). Los resultados aparecen agrupados en el historial bajo el nombre del cliente.
                  </li>
                  <li>
                    Revise cada documento en el panel central. Si algún dato fue extraído incorrectamente, corríjalo y presione <strong>"Guardar"</strong> para persistir los cambios en Firestore.
                  </li>
                  <li>
                    Haga clic en <strong>"Sincronizar"</strong> para enviar el documento al sistema externo de registro. El estado cambiará a <em>Sincronizado</em> y podrá ver el log completo del request/response HTTP.
                  </li>
                  <li>
                    Use <strong>"+ Nuevo Trámite"</strong> en el historial para limpiar la sesión activa y procesar el siguiente cliente sin borrar los registros guardados.
                  </li>
                </ol>
              </div>
            </div>

            <div className="p-4 border-t divider flex flex-wrap items-center justify-between gap-2 t-caption">
              <span>DivergencyAI • API Rest v1.0</span>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-card border-t divider py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-5 flex flex-col items-center gap-1 text-center">
          <span className="t-h2 uppercase tracking-tight">DivergencyAI</span>
          <span className="t-caption">Todos los derechos reservados © 2026</span>
        </div>
      </footer>

    </div>
  );
}
