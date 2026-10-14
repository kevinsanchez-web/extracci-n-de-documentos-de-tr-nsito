/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { DocumentRecord } from "../types";
import { X, Globe, CornerDownRight, Check, ShieldAlert, Code, AlertCircle, CheckCircle2 } from "lucide-react";

interface NetworkLogModalProps {
  document: DocumentRecord | null;
  onClose: () => void;
}

export default function NetworkLogModal({
  document,
  onClose,
}: NetworkLogModalProps) {
  const isOpen = !!document;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!document) return null;

  const logs = document.logs || [];

  return (
    <div
      className="modal-scrim [content-visibility:auto]"
      id="network-log-modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-panel modal-panel-xl"
        onClick={(e) => e.stopPropagation()}
        id="network-log-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Inspector de tráfico de red (API Log)"
      >
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b divider flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="pastel-edge tone-sky p-2.5 rounded-2xl shrink-0">
              <Globe className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="t-h2 text-ink">Inspector de Tráfico de Red (API Log)</h3>
              <p className="t-caption">
                Peticiones HTTP reales emitidas por el servidor con destino a la base de datos externa.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon shrink-0"
            id="btn-close-log-modal"
            aria-label="Cerrar inspector de red"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido de los Logs */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="text-center py-12 bg-app rounded-2xl">
              <Globe className="w-8 h-8 text-ink-muted mx-auto mb-2" aria-hidden="true" />
              <p className="t-body font-semibold text-ink mb-1">Ninguna petición emitida todavía</p>
              <p className="t-caption">
                Presione el botón "Sincronizar vía API" del documento para disparar el flujo de red.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={index} className="card-compact overflow-hidden text-[0.75rem]">
                  {/* Status Bar */}
                  <div className="bg-app px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b divider">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className={`chip nums ${log.success ? "tone-azure" : "tone-coral"}`}>
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="w-4 h-4" aria-hidden="true" />
                        )}
                        {log.responseStatus} {log.success ? "OK" : "ERROR"}
                      </span>
                      <span className="chip chip-neutral font-mono">{log.method}</span>
                      <span className="text-ink-muted font-mono text-[0.6875rem] truncate max-w-[200px] sm:max-w-[320px]" title={log.url}>
                        {log.url}
                      </span>
                    </div>
                    <span className="t-caption font-mono nums">
                      {new Date(log.timestamp).toLocaleTimeString("es-CO")}
                    </span>
                  </div>

                  {/* Cuerpo del Detalle */}
                  <div className="p-4 space-y-4">
                    {/* Comando curl equivalente */}
                    <div className="space-y-1">
                      <span className="t-caption uppercase flex items-center gap-1.5">
                        <CornerDownRight className="w-4 h-4" aria-hidden="true" /> Comando cURL Equivalente
                      </span>
                      <div className="card-compact bg-app text-ink font-mono text-[0.6875rem] p-4 overflow-x-auto whitespace-pre select-all">
                        curl -X POST "{log.url}" \<br />
                        &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                        &nbsp;&nbsp;-d '{JSON.stringify({ ...log.requestPayload, extractedData: "..." })}'
                      </div>
                    </div>

                    {/* Request Payload */}
                    <div className="space-y-1">
                      <span className="t-caption uppercase flex items-center gap-1.5">
                        <Code className="w-4 h-4" aria-hidden="true" /> Petición Saliente (Request Body)
                      </span>
                      <pre className="card-compact bg-app text-ink font-mono text-[0.6875rem] leading-snug p-4 overflow-x-auto">
                        {JSON.stringify(log.requestPayload, null, 2)}
                      </pre>
                    </div>

                    {/* Response Payload */}
                    <div className="space-y-1">
                      <span className="t-caption uppercase flex items-center gap-1.5">
                        {log.success ? (
                          <Check className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                        )}
                        Respuesta del Servidor Externo (Response)
                      </span>
                      <pre
                        className={`font-mono text-[0.6875rem] leading-snug p-4 overflow-x-auto text-ink ${
                          log.success ? "card-compact bg-app" : "pastel-soft tone-coral"
                        }`}
                      >
                        {JSON.stringify(log.responseBody, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t divider text-center">
          <p className="t-caption font-mono">
            Proceso de Integración Transaccional de Tránsito Colombiano (REST API over TLS)
          </p>
        </div>
      </div>
    </div>
  );
}
