/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DocumentRecord, ExternalRecord } from "./types";
import DocumentDropzone from "./components/DocumentDropzone";
import ActiveDocumentDetail from "./components/ActiveDocumentDetail";
import DocumentList from "./components/DocumentList";
import ExternalDatabaseView from "./components/ExternalDatabaseView";
import NetworkLogModal from "./components/NetworkLogModal";
import {
  Cpu, Settings, BookOpen, Clock, Info, ExternalLink,
  RefreshCw, Moon, Sun, ChevronDown, ChevronUp
} from "lucide-react";

export default function App() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [externalRecords, setExternalRecords] = useState<ExternalRecord[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [activeTramiteId, setActiveTramiteId] = useState<string | null>(null);
  
  // Estados de carga (loaders)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingExtDb, setIsLoadingExtDb] = useState(false);
  
  // Modales
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [showHistory, setShowHistory] = useState(() => localStorage.getItem("showHistory") !== "false");

  // Motor de IA seleccionado: Gemini (nube) o Jetson (OCR local)
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
  const [savedSettingsMsg, setSavedSettingsMsg] = useState("");

  const activeDoc = documents.find((d) => d.id === activeDocId) || null;

  // Al cambiar el filtro de tipo, auto-seleccionar el primer documento que coincida
  useEffect(() => {
    if (filterType) {
      const firstMatch = documents.find((d) => d.documentType === filterType);
      if (firstMatch) setActiveDocId(firstMatch.id);
    }
  }, [filterType]);

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
    const engineLabel = isGemini ? "Gemini" : "Jetson (OCR local)";

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
      const newRecords = Array.isArray(result) ? result : [result];
      setDocuments((prev) => [...newRecords, ...prev]);
      setActiveDocId(newRecords[0].id);
      setActiveTramiteId(newRecords[0].tramiteId || null);
    } catch (error: any) {
      alert(`Error al analizar el documento:\n\n${error.message}`);
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
        alert(`Fallo en el envío por API: Servidor retornó status ${syncResult.status}`);
      }

    } catch (e: any) {
      alert(`Error de sincronización: ${e.message}`);
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
    setActiveTramiteId(null);
    setFilterType(null);
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

  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavedSettingsMsg("¡Configuración de API guardada!");
    setTimeout(() => setSavedSettingsMsg(""), 3000);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased transition-colors duration-200 ${isDark ? "dark bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-800"}`}>
      
      {/* HEADER DE LA APLICACIÓN */}
      <header className={`sticky top-0 z-40 px-6 py-3 shadow-md ${isDark ? "bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700" : "bg-gradient-to-r from-blue-700 to-blue-600"}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDark ? "bg-blue-600" : "bg-white/20"}`}>
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white" id="app-title-main">
                Scanner & Sincronizador · Trámites de Tránsito
              </h1>
              <p className="text-[11px] text-blue-200 font-medium">
                Cédulas · Facturas · RUNT · Gases · Poderes — REST API v1.0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* SWITCH DE MOTOR DE IA: GEMINI (NUBE) O JETSON (OCR LOCAL) */}
            <div className="flex items-center bg-white/15 border border-white/20 rounded-xl p-1 gap-1" id="ai-engine-switch" title="Motor de análisis de documentos">
              <button
                onClick={() => changeAiEngine("gemini")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  aiEngine === "gemini"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-blue-100 hover:text-white"
                }`}
              >
                Usar Gemini
              </button>
              <button
                onClick={() => changeAiEngine("jetson")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  aiEngine === "jetson"
                    ? "bg-white text-green-700 shadow-sm"
                    : "text-blue-100 hover:text-white"
                }`}
              >
                Usar Jetson
              </button>
            </div>

            <a
              href="/api-docs"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all border border-white/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              API Docs
            </a>

            <button
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-white/20"
              id="btn-case-guide"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Guía del Caso
            </button>

            <button
              onClick={() => { const next = !isDark; setIsDark(next); localStorage.setItem("theme", next ? "dark" : "light"); }}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all cursor-pointer"
              title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              id="btn-toggle-theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border border-white/20 transition-all cursor-pointer ${
                showSettings ? "bg-white/30 text-white" : "bg-white/15 hover:bg-white/25 text-white"
              }`}
              title="Configuración de la API destino"
              id="btn-toggle-settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* LOADER DEL PROCESAMIENTO CON INTELIGENCIA ARTIFICIAL (GEMINI) */}
      {isAnalyzing && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-blue-950 px-6 py-4 text-center select-none shadow-sm flex items-center justify-center gap-3 animate-pulse">
          <RefreshCw className="w-4 animate-spin text-blue-400" />
          <span className="text-xs font-semibold tracking-wider uppercase font-mono">
            Procesando Trámite: <span className="text-blue-200 font-normal normal-case inline">{analyzeMsg}</span>
          </span>
        </div>
      )}

      {/* CUERPO PRINCIPAL DEL DASHBOARD */}
      <main className="flex-1 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: CONFIGURADOR API, SUBIDA Y HISTORIAL (5 de 12 columnas) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          
          {/* PANEL DE CONFIGURACIÓN DE LA API DESTINO */}
          {showSettings && (
            <div className="bg-white rounded-2xl border border-dashed border-blue-200 p-5 shadow-xs animate-slideDown">
              <div className="flex items-center gap-2 mb-3 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <Settings className="w-4 h-4 text-blue-600" />
                Configurar API de Destino (Otra Aplicación)
              </div>
              <form onSubmit={handleSaveSettings} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-bold text-slate-400 mb-1">
                    URL Endpoint Destino (HTTP POST)
                  </label>
                  <input
                    type="url"
                    value={targetApiUrl}
                    onChange={(e) => setTargetApiUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:border-blue-400 focus:bg-white"
                    placeholder="https://otra-aplicacion.com/api/transito/v1"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Por defecto apunta al mock local integrado para ver los registros insertados en tiempo real.
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-green-600 font-semibold">{savedSettingsMsg}</span>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 text-white font-semibold text-[11px] rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Guardar Parámetros
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DRAG & DROP E IMÁGENES DE MUESTRA PARA OCR */}
          <DocumentDropzone
            onAnalyze={handleAnalyzeDocument}
            isAnalyzing={isAnalyzing}
            onShowHelp={() => setShowHelpModal(true)}
            onFilterType={setFilterType}
            activeFilter={filterType}
            documentCounts={documents
              .filter((d) => activeTramiteId ? d.tramiteId === activeTramiteId : false)
              .reduce((acc, d) => {
                acc[d.documentType] = (acc[d.documentType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)}
          />

          {/* HISTORIAL LOCAL EN LA DB DE ESTE SISTEMA */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm">
            <div className="flex items-center justify-between px-5 py-3">
              <button
                onClick={() => { const next = !showHistory; setShowHistory(next); localStorage.setItem("showHistory", next ? "true" : "false"); }}
                className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700 dark:text-slate-200 hover:text-blue-600 transition-colors"
              >
                Historial de Documentos
                <span className="text-xs font-medium text-slate-400 normal-case">({documents.length})</span>
                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              <button
                onClick={handleNuevoTramite}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Limpiar selección y preparar para nuevo cliente"
              >
                + Nuevo Trámite
              </button>
            </div>
            {showHistory && (
              <div className="border-t border-slate-100 dark:border-slate-700">
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
            )}
          </div>
        </div>

        {/* COLUMNA CENTRAL-DERECHA (7 de 12 columnas): VISOR DE EXTRACCIÓN Y API DESTINO */}
        <div className="lg:col-span-7 space-y-6 flex flex-col h-full [content-visibility:auto]">
          
          {/* DETALLES Y VALIDACIÓN DEL DOCUMENTO ACTIVO */}
          <div className="flex-1">
            <ActiveDocumentDetail
              document={activeDoc}
              onUpdateDocumentData={handleUpdateDocumentData}
              onSyncDocument={handleSyncDocument}
              onDeleteDocument={(id) => handleDeleteDocument(id, { stopPropagation: () => {} } as React.MouseEvent)}
              isSyncing={isSyncing}
              apiUrl={targetApiUrl}
            />
          </div>

          {/* MONITOREO DE BASE DE DATOS EXTERNA SIMULADA */}
          <div>
            <ExternalDatabaseView
              records={externalRecords}
              onClear={handleClearExternalDb}
              isLoading={isLoadingExtDb}
              onRefresh={refreshExternalDb}
            />
          </div>
        </div>

      </main>

      {/* INSPECTOR DE LOGS DE RED (MODAL) */}
      {showLogModal && activeDoc && (
        <NetworkLogModal
          document={activeDoc}
          onClose={() => setShowLogModal(false)}
        />
      )}

      {/* GUÍA DE USO (MODAL) */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="help-modal-overlay">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[85vh] text-slate-800 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  Guía de Uso — Scanner de Documentos de Tránsito
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                id="btn-close-help"
              >
                Cerrar
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed custom-scrollbar">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 mb-0.5">¿Qué hace esta aplicación?</p>
                  <p className="text-[11px] text-blue-950">
                    Escanea un PDF con los documentos de un trámite de tránsito colombiano, extrae automáticamente los datos de cada documento usando <strong>Gemini AI</strong>, permite revisarlos y corregirlos, y los sincroniza con el sistema de registro externo.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-tight text-[11px] mb-2 flex items-center gap-1.5 border-b border-slate-50 pb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Documentos soportados
                </h4>
                <ul className="space-y-2.5 pl-1 text-[11px]">
                  <li>
                    <strong className="text-slate-800">Cédula de Ciudadanía</strong>: nombre completo, número de documento, fecha de nacimiento, sexo, RH, estatura y datos de contacto (celular, correo, dirección), incluyendo datos manuscritos.
                  </li>
                  <li>
                    <strong className="text-slate-800">Factura de Compraventa de Vehículo</strong>: número de factura, fecha, datos del comprador, marca, línea, modelo, motor, chasis, cilindrada, color y valor total.
                  </li>
                  <li>
                    <strong className="text-slate-800">Formulario RUNT</strong>: trámite solicitado, datos del propietario, y datos técnicos del vehículo (marca, línea, motor, chasis, modelo, cilindrada, color).
                  </li>
                  <li>
                    <strong className="text-slate-800">Certificado de Gases / Empadronamiento</strong>: tipo de certificado, fecha, datos del vehículo (marca, línea, chasis, motor, cilindrada, modelo).
                  </li>
                  <li>
                    <strong className="text-slate-800">Poder Especial de Tránsito</strong>: nombre e identificación del otorgante, nombre del apoderado y lista de trámites autorizados.
                  </li>
                </ul>
              </div>

              <div className="pt-1">
                <h4 className="font-bold text-slate-800 uppercase tracking-tight text-[11px] mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Flujo de trabajo paso a paso
                </h4>
                <ol className="list-decimal list-inside space-y-2.5 pl-1.5 text-[11px]">
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

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between text-[10px] text-slate-500">
              <span>DivergencyAI • API Rest v1.0</span>
              <a href="https://runt.com.co" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium">
                Sistemas RUNT Colombia <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-1.5 text-center">
          <span className="text-sm font-black tracking-tight text-slate-500 dark:text-slate-200 uppercase">
            DivergencyAI
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Todos los derechos reservados © 2026
          </span>
        </div>
      </footer>

    </div>
  );
}
