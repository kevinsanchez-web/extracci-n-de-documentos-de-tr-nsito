/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ExternalRecord } from "../types";
import { Database, Trash2, Check, RefreshCw, Code, ChevronDown, Loader2 } from "lucide-react";

interface ExternalDatabaseViewProps {
  records: ExternalRecord[];
  onClear: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function ExternalDatabaseView({
  records,
  onClear,
  isLoading,
  onRefresh,
}: ExternalDatabaseViewProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  // Plegado por defecto: es el paso de verificación, no el de trabajo
  const [open, setOpen] = useState(false);

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit" });
    } catch (e) {
      return "Hace poco";
    }
  };

  const typeTone = (t: string) =>
    ["cedula", "factura", "runt", "gases", "poder"].includes(t) ? "chip tone-powder" : "chip chip-neutral";

  return (
    <div className="card p-5 [content-visibility:auto]">
      <div className={`flex flex-wrap items-center justify-between gap-4 ${open ? "mb-4 border-b divider pb-4" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex items-center gap-3 min-w-0 text-left rounded-2xl"
        >
          <div className="pastel-edge tone-sky p-2.5 rounded-2xl shrink-0">
            <Database className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="t-h2 text-ink flex items-center gap-2">
              SISTEMA DESTINO (PRODUCCIÓN)
              <span className="chip chip-neutral nums">{records.length}</span>
            </h3>
            <p className="t-caption flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Base de Datos Conectada vía REST API
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        <div className={`flex items-center gap-2 ${open ? "" : "hidden"}`}>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-busy={isLoading}
            className="btn btn-ghost"
            id="btn-refresh-ext-db"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Actualizar
          </button>

          {records.length > 0 && (
            <button onClick={onClear} className="btn btn-danger" id="btn-clear-ext-db">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Vaciar
            </button>
          )}
        </div>
      </div>

      {open && (
      <div className="animate-screen-in">
      <div className="mb-4">
        <p className="t-body text-ink-muted">
          Esta vista simula las tablas SQL del <span className="text-ink font-semibold">sistema de destino o base de datos externa</span>.
          Al presionar "Sincronizar", los datos viajan mediante un HTTP POST real al endpoint del servidor y se ingresan en estas tablas estructuradas.
        </p>
      </div>

      {isLoading && records.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-ink-muted" role="status">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span className="t-body">Cargando registros...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-app rounded-2xl p-8 text-center my-4">
          <Database className="w-8 h-8 text-ink-muted mx-auto mb-2" aria-hidden="true" />
          <p className="t-body font-semibold text-ink mb-1">Sin registros sincronizados</p>
          <p className="t-caption">Sincronice un documento arriba para verlo reflejado aquí.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-ink-muted" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span className="t-caption">Actualizando...</span>
            </div>
          )}

          {/* Encabezado de tabla (solo md+) */}
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            <div
              className="hidden md:grid grid-cols-[1.4fr_1fr_1.6fr_1.2fr_1.2fr_auto] gap-4 px-4 py-3 sticky top-0 z-10 bg-card border-b divider t-caption"
              aria-hidden="true"
            >
              <span>ID</span>
              <span>Tipo</span>
              <span>Cliente</span>
              <span>C.C./Ident</span>
              <span>Chasis</span>
              <span>Estado</span>
            </div>

            <div className="space-y-2 md:space-y-0 mt-2 md:mt-0">
              {records.map((rec) => {
                const isSelected = selectedRecordId === rec.id;
                const toggle = () => setSelectedRecordId(isSelected ? null : rec.id);
                return (
                  <div
                    key={rec.id}
                    className={`card-compact overflow-hidden md:rounded-none md:border-0 md:border-b md:border-b-[var(--border-subtle)] ${
                      isSelected ? "pastel-soft tone-sky md:rounded-none" : ""
                    }`}
                    id={`external-record-${rec.id}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isSelected}
                      onClick={toggle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle();
                        }
                      }}
                      className="row-interactive p-4 min-h-12 flex flex-col gap-2 md:grid md:grid-cols-[1.4fr_1fr_1.6fr_1.2fr_1.2fr_auto] md:items-center md:gap-4 md:py-2"
                    >
                      <div className="flex items-center gap-2 md:contents">
                        <span className="chip chip-neutral font-mono nums md:border-0 md:p-0 md:bg-transparent md:text-ink md:text-[0.75rem] truncate">
                          ID: {rec.id}
                        </span>
                        <span className={`${typeTone(rec.documentType)} uppercase md:justify-self-start`}>
                          {rec.documentType}
                        </span>
                        <span className="chip tone-azure ml-auto md:hidden">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> API Ok
                        </span>
                      </div>

                      <div className="text-[0.75rem] font-semibold text-ink truncate">
                        <span className="md:hidden">Cliente: </span>
                        {rec.clientName}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[0.75rem] text-ink md:contents font-mono nums">
                        <div className="truncate">
                          <span className="text-ink-muted md:hidden">C.C./Ident: </span>
                          {rec.clientDocId}
                        </div>
                        <div className="truncate">
                          <span className="text-ink-muted md:hidden">Chasis: </span>
                          {rec.vehicleChasis || "N/A"}
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-2">
                        <span className="chip tone-azure">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> API Ok
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-ink-muted transition-transform ${isSelected ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {isSelected && (
                      <div className="bg-card border-t divider p-4 text-[0.75rem] space-y-3 animate-fadeIn max-h-[260px] overflow-y-auto custom-scrollbar">
                        <div className="flex flex-wrap items-center justify-between gap-2 t-caption pb-2 border-b divider">
                          <span className="nums">Recibido: {new Date(rec.receivedAt).toLocaleString("es-CO")}</span>
                          <span className="chip tone-powder">
                            <Code className="w-3.5 h-3.5" aria-hidden="true" /> mapper_schema.v1
                          </span>
                        </div>
                        <pre className="card-compact bg-app text-ink font-mono text-[0.6875rem] overflow-x-auto whitespace-pre-wrap break-words leading-snug p-4">
                          {JSON.stringify(rec.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="t-caption text-center nums">
            Mostrando {records.length} registro(s) persistido(s) en la DB del otro sistema.
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
