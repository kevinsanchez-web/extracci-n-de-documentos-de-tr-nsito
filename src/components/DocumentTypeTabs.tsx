/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentRecord } from "../types";

interface DocumentTypeTabsProps {
  /** Documentos del trámite activo */
  documents: DocumentRecord[];
  activeType?: string;
  onSelect: (type: string) => void;
}

const TABS = [
  { type: "cedula", label: "Cédula" },
  { type: "factura", label: "Factura" },
  { type: "runt", label: "RUNT" },
  { type: "gases", label: "Emisiones" },
  { type: "poder", label: "Poder" },
];

/** Pestañas por tipo de documento del trámite activo; las que no tienen documento quedan atenuadas. */
export default function DocumentTypeTabs({ documents, activeType, onSelect }: DocumentTypeTabsProps) {
  const counts = documents.reduce((acc, d) => {
    acc[d.documentType] = (acc[d.documentType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div role="tablist" aria-label="Documentos del trámite" className="tabs no-scrollbar">
      {TABS.map((t) => {
        const count = counts[t.type] ?? 0;
        return (
          <button
            key={t.type}
            role="tab"
            aria-selected={activeType === t.type}
            disabled={count === 0}
            onClick={() => onSelect(t.type)}
            className="tab"
          >
            {t.label}
            {count > 1 && <span className="t-caption nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
