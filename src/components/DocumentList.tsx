/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { DocumentRecord } from "../types";
import PillSelect from "./PillSelect";
import { Trash, Search, ChevronDown, SlidersHorizontal } from "lucide-react";

interface DocumentListProps {
  documents: DocumentRecord[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDeleteTramite: (tramiteId: string) => void;
}

interface TramiteGroup {
  tramiteId: string;
  clientName: string;
  docs: DocumentRecord[];
  scannedAt: string;
  syncSummary: "success" | "pending" | "failed" | "mixed";
}

function getClientName(docs: DocumentRecord[]): string {
  const cedula = docs.find((d) => d.documentType === "cedula");
  if (cedula?.extractedData?.nombreCompleto) return cedula.extractedData.nombreCompleto;
  const factura = docs.find((d) => d.documentType === "factura");
  if (factura?.extractedData?.compradorNombre) return factura.extractedData.compradorNombre;
  const poder = docs.find((d) => d.documentType === "poder");
  if (poder?.extractedData?.otorganteNombre) return poder.extractedData.otorganteNombre;
  const runt = docs.find((d) => d.documentType === "runt");
  if (runt?.extractedData?.propietarioNombre) return runt.extractedData.propietarioNombre;
  return docs[0]?.fileName || "Trámite sin nombre";
}

function getSyncSummary(docs: DocumentRecord[]): TramiteGroup["syncSummary"] {
  const statuses = docs.map((d) => d.syncStatus);
  if (statuses.every((s) => s === "success")) return "success";
  if (statuses.every((s) => s === "pending")) return "pending";
  if (statuses.some((s) => s === "failed")) return "failed";
  return "mixed";
}

const TYPE_LABELS: Record<string, string> = {
  cedula: "Cédula",
  factura: "Factura",
  runt: "RUNT",
  gases: "Gases",
  poder: "Poder",
  desconocido: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Sincronizado",
  failed: "Fallo",
  mixed: "Parcial",
  pending: "Pendiente",
};

/** Estado de sincronización: punto de color y una palabra. */
function Status({ status }: { status: string }) {
  const known = status in STATUS_LABELS ? status : "pending";
  return <span className="status" data-s={known}>{STATUS_LABELS[known]}</span>;
}

/** Borde izquierdo y tono suave para lo que está abierto en el panel de detalle. */
const activeCls = (active: boolean) =>
  active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent";

export default function DocumentList({ documents, activeId, onSelect, onDelete, onDeleteTramite }: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const hasActiveFilters = Boolean(searchTerm || selectedType || selectedStatus);
  const clearFilters = () => { setSearchTerm(""); setSelectedType(""); setSelectedStatus(""); };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return (
        date.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) +
        " · " +
        date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })
      );
    } catch {
      return "Fecha desconocida";
    }
  };

  const toggleGroup = (tramiteId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(tramiteId) ? next.delete(tramiteId) : next.add(tramiteId);
      return next;
    });
  };

  // Lista plana (cuando hay filtros)
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        doc.fileName.toLowerCase().includes(searchLower) ||
        (doc.summary && doc.summary.toLowerCase().includes(searchLower)) ||
        doc.documentType.toLowerCase().includes(searchLower);
      const matchesType = !selectedType || doc.documentType === selectedType;
      const matchesStatus = !selectedStatus || doc.syncStatus === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documents, searchTerm, selectedType, selectedStatus]);

  // Vista agrupada por trámite (sin filtros)
  const groups = useMemo<TramiteGroup[]>(() => {
    const map = new Map<string, DocumentRecord[]>();
    documents.forEach((doc) => {
      const key = doc.tramiteId || doc.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    });
    return Array.from(map.entries())
      .map(([tramiteId, docs]) => ({
        tramiteId,
        clientName: getClientName(docs),
        docs,
        scannedAt: docs[0].scannedAt,
        syncSummary: getSyncSummary(docs),
      }))
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [documents]);

  return (
    <div>
      {/* Búsqueda; los filtros quedan detrás de un botón para no recargar la lista */}
      <div className="sticky top-0 z-10 bg-card px-4 pt-3 pb-3 space-y-2 border-b divider">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar trámite o documento"
              aria-label="Buscar documentos"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field field-with-icon field-plain"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters || Boolean(selectedType || selectedStatus)}
            aria-label="Filtrar por tipo o estado"
            title="Filtros"
            className={`btn btn-icon shrink-0 ${showFilters || selectedType || selectedStatus ? "btn-info" : "btn-ghost"}`}
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {(showFilters || selectedType || selectedStatus) && (
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            <PillSelect
              value={selectedType}
              onChange={setSelectedType}
              ariaLabel="Filtrar por tipo"
              options={[
                { value: "", label: "Todos los tipos" },
                { value: "cedula", label: "Cédula" },
                { value: "factura", label: "Factura" },
                { value: "runt", label: "RUNT" },
                { value: "gases", label: "Gases" },
                { value: "poder", label: "Poder" },
              ]}
            />
            <PillSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              ariaLabel="Filtrar por estado de sincronización"
              align="right"
              options={[
                { value: "", label: "Todos los estados" },
                { value: "pending", label: "Pendientes" },
                { value: "success", label: "Sincronizados" },
                { value: "failed", label: "Con fallo" },
              ]}
            />
          </div>
        )}
        {hasActiveFilters && (
          <div className="flex items-center justify-between t-caption">
            <span>{filteredDocs.length} resultado(s)</span>
            <button onClick={clearFilters} className="underline font-semibold text-ink">Limpiar filtros</button>
          </div>
        )}
      </div>

      {hasActiveFilters ? (
        filteredDocs.length === 0 ? (
          <p className="t-caption text-center px-4 py-8">Ningún documento coincide con la búsqueda.</p>
        ) : (
          <ul>
            {filteredDocs.map((doc) => (
              <DocRow key={doc.id} doc={doc} isActive={doc.id === activeId} onSelect={onSelect} onDelete={onDelete} />
            ))}
          </ul>
        )
      ) : groups.length === 0 ? (
        <p className="t-caption text-center px-4 py-8">Aún no hay trámites. Suba un PDF para empezar.</p>
      ) : (
        <ul>
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.tramiteId);
            const hasActive = group.docs.some((d) => d.id === activeId);
            return (
              <li key={group.tramiteId} className="border-b divider last:border-b-0">
                <div className={`group/head flex items-center border-l-2 ${activeCls(hasActive && !isExpanded)}`}>
                  <button
                    onClick={() => { toggleGroup(group.tramiteId); if (!isExpanded) onSelect(group.docs[0].id); }}
                    aria-expanded={isExpanded}
                    className="row-interactive flex-1 min-w-0 min-h-14 flex items-center gap-3 pl-4 pr-2 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="t-body font-semibold text-ink truncate">{group.clientName}</p>
                      <p className="t-caption flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="nums">{formatDate(group.scannedAt)}</span>
                        <span>{group.docs.length} {group.docs.length === 1 ? "documento" : "documentos"}</span>
                        <Status status={group.syncSummary} />
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-ink-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTramite(group.tramiteId); }}
                    className="btn btn-ghost btn-icon shrink-0 mr-2 md:opacity-0 md:group-hover/head:opacity-100 md:group-focus-within/head:opacity-100 transition-opacity"
                    title="Eliminar trámite completo"
                    aria-label="Eliminar trámite completo"
                  >
                    <Trash className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {isExpanded && (
                  <ul className="pb-2">
                    {group.docs.map((doc) => (
                      <DocRow key={doc.id} doc={doc} isActive={doc.id === activeId} onSelect={onSelect} onDelete={onDelete} nested />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DocRow({ doc, isActive, onSelect, onDelete, nested = false }: {
  doc: DocumentRecord; isActive: boolean; onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  nested?: boolean;
}) {
  return (
    <li
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={() => onSelect(doc.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(doc.id);
        }
      }}
      className={`group/row row-interactive flex items-center gap-3 border-l-2 min-h-11 py-2 pr-2 ${nested ? "pl-8" : "pl-4"} ${activeCls(isActive)}`}
    >
      <span className="t-body font-medium text-ink w-16 shrink-0">{TYPE_LABELS[doc.documentType] || "Otro"}</span>
      <span className="t-caption truncate flex-1 min-w-0">{doc.summary || doc.fileName}</span>
      <Status status={doc.syncStatus} />
      <button
        onClick={(e) => onDelete(doc.id, e)}
        className="btn btn-ghost btn-icon shrink-0 md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100 transition-opacity"
        title="Eliminar documento"
        aria-label="Eliminar documento"
      >
        <Trash className="w-4 h-4" aria-hidden="true" />
      </button>
    </li>
  );
}
