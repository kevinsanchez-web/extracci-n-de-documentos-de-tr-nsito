/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { DocumentRecord } from "../types";
import PillSelect from "./PillSelect";
import { Clock, CheckCircle2, AlertCircle, Trash, Search, User, ChevronDown, ChevronUp, FileText, Check } from "lucide-react";

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
  cedula: "CC",
  factura: "FAC",
  runt: "RUNT",
  gases: "GAS",
  poder: "POD",
  desconocido: "???",
};

export default function DocumentList({ documents, activeId, onSelect, onDelete, onDeleteTramite }: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const hasActiveFilters = searchTerm || selectedType || selectedStatus;

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

  // Filtered flat list (used when filters are active)
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

  // Grouped view (used when no filters active)
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

  const getSyncBadge = (status: string, _small = false) => {
    if (status === "success")
      return <span className="chip tone-azure"><CheckCircle2 className="w-4 h-4" aria-hidden="true" />Sincronizado</span>;
    if (status === "failed")
      return <span className="chip tone-coral"><AlertCircle className="w-4 h-4" aria-hidden="true" />Fallo</span>;
    if (status === "mixed")
      return <span className="chip tone-butter"><AlertCircle className="w-4 h-4" aria-hidden="true" />Parcial</span>;
    return <span className="chip tone-butter"><Clock className="w-4 h-4" aria-hidden="true" />Pendiente</span>;
  };

  return (
    <div className="p-4">
      {/* Buscador y Filtros */}
      <div className="space-y-2 mb-2 sticky top-0 z-10 bg-card -mx-4 -mt-4 px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nombre, tipo o resumen..."
            aria-label="Buscar documentos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field field-with-icon"
          />
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
          <PillSelect
            value={selectedType}
            onChange={setSelectedType}
            ariaLabel="Filtrar por tipo"
            options={[
              { value: "", label: "Tipo: Todos" },
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
            ariaLabel="Filtrar por sincronización"
            align="right"
            options={[
              { value: "", label: "Sincronización: Todas" },
              { value: "pending", label: "Pendientes" },
              { value: "success", label: "Sincronizados" },
              { value: "failed", label: "Fallo API" },
            ]}
          />
        </div>
        {hasActiveFilters && (
          <div className="card-compact flex items-center justify-between gap-2 px-4 py-2 t-caption">
            <span>{filteredDocs.length} resultado(s)</span>
            <button onClick={() => { setSearchTerm(""); setSelectedType(""); setSelectedStatus(""); }}
              className="btn btn-ghost">
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Vista con filtros activos — lista plana */}
      {hasActiveFilters ? (
        filteredDocs.length === 0 ? (
          <div className="text-center p-5 bg-app rounded-2xl">
            <p className="t-caption">Ningún documento coincide con los filtros.</p>
            <button onClick={() => { setSearchTerm(""); setSelectedType(""); setSelectedStatus(""); }}
              className="btn btn-ghost mt-2">
              Restablecer filtros
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar p-1">
            {filteredDocs.map((doc) => (
              <FlatDocRow key={doc.id} doc={doc} isActive={doc.id === activeId} onSelect={onSelect} onDelete={onDelete} getSyncBadge={getSyncBadge} />
            ))}
          </div>
        )
      ) : (
        /* Vista agrupada por trámite */
        groups.length === 0 ? (
          <div className="text-center p-5 bg-app rounded-2xl">
            <p className="t-caption">No hay documentos registrados en esta sesión.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar p-1">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.tramiteId);
              const hasActive = group.docs.some((d) => d.id === activeId);
              return (
                <div key={group.tramiteId} className={`card-compact ${hasActive ? "tone-sky pastel-soft" : ""}`}>
                  {/* Cabecera del grupo */}
                  <div className="flex items-center gap-2 p-2">
                    <button
                      onClick={() => { toggleGroup(group.tramiteId); if (!isExpanded) onSelect(group.docs[0].id); }}
                      aria-expanded={isExpanded}
                      className="row-interactive flex-1 min-w-0 min-h-9 pointer-coarse:min-h-8 pointer-coarse:min-h-11 flex flex-wrap items-center justify-between gap-2 px-2 py-2 rounded-2xl text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {hasActive && <Check className="w-4 h-4 shrink-0" aria-label="Seleccionado" />}
                        <div className="tone-powder pastel-edge p-1.5 rounded-xl shrink-0">
                          <User className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="t-body font-semibold text-ink truncate">{group.clientName}</p>
                          <p className="t-caption flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" /><span className="nums">{formatDate(group.scannedAt)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getSyncBadge(group.syncSummary, true)}
                        <span className="chip chip-neutral nums">
                          {group.docs.length}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-muted" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-ink-muted" aria-hidden="true" />}
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteTramite(group.tramiteId); }}
                      className="btn btn-ghost btn-icon shrink-0"
                      title="Eliminar trámite completo"
                      aria-label="Eliminar trámite completo"
                    >
                      <Trash className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Documentos del grupo (expandidos) */}
                  {isExpanded && (
                    <div className="border-t divider p-2 space-y-2">
                      {group.docs.map((doc) => (
                        <FlatDocRow key={doc.id} doc={doc} isActive={doc.id === activeId} onSelect={onSelect} onDelete={onDelete} getSyncBadge={getSyncBadge} compact />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function FlatDocRow({ doc, isActive, onSelect, onDelete, getSyncBadge }: {
  doc: DocumentRecord; isActive: boolean; onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  getSyncBadge: (status: string, small?: boolean) => React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
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
      className={`card-compact row-interactive flex flex-wrap items-center justify-between gap-2 p-4 ${
        isActive ? "tone-sky pastel-soft" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 basis-40">
        {isActive && <Check className="w-4 h-4 shrink-0" aria-label="Seleccionado" />}
        <span className="chip tone-powder shrink-0">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          {TYPE_LABELS[doc.documentType] || "???"}
        </span>
        <p className="t-body text-ink truncate">{doc.summary || doc.fileName}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {getSyncBadge(doc.syncStatus, true)}
        <button
          onClick={(e) => onDelete(doc.id, e)}
          className="btn btn-ghost btn-icon"
          title="Eliminar"
          aria-label="Eliminar documento"
        >
          <Trash className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
