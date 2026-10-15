/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Check } from "lucide-react";
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
    <div role="tablist" aria-label="Documentos del trámite" className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible no-scrollbar -mx-5 px-5 md:mx-0 md:px-0 pb-1">
      {TABS.map((t) => {
        const count = counts[t.type] ?? 0;
        const selected = activeType === t.type;
        return (
          <button
            key={t.type}
            role="tab"
            aria-selected={selected}
            disabled={count === 0}
            onClick={() => onSelect(t.type)}
            className="btn btn-ghost shrink-0"
          >
            {selected && <Check className="w-4 h-4" aria-hidden="true" />}
            {t.label}
            {count > 0 && <span className="t-caption nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
