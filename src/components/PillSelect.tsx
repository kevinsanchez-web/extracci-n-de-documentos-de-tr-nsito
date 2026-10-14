/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface PillOption {
  value: string;
  label: string;
}

interface PillSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: PillOption[];
  ariaLabel: string;
  /** Lado por el que se alinea el menú respecto al botón */
  align?: "left" | "right";
  className?: string;
}

/**
 * Lista desplegable con botón y opciones en forma de píldora (el menú nativo de <select>
 * tiene esquinas cuadradas que el navegador no deja estilizar).
 */
export default function PillSelect({ value, onChange, options, ariaLabel, align = "left", className = "" }: PillSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIndex];

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Al abrir, el foco pasa a la opción seleccionada
  useEffect(() => {
    if (open) optionRefs.current[selectedIndex]?.focus();
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (v: string) => {
    onChange(v);
    close(true);
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const idx = optionRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); optionRefs.current[Math.min(options.length - 1, idx + 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); optionRefs.current[Math.max(0, idx - 1)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); optionRefs.current[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); optionRefs.current[options.length - 1]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); }
        }}
        className="field field-pill cursor-pointer flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
          className={`popover absolute z-30 mt-2 min-w-full w-max max-w-[18rem] flex flex-col gap-1 animate-screen-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value || "__empty"}
                ref={(el) => { optionRefs.current[i] = el; }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(o.value)}
                className="pill-option"
              >
                <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                  {selected && <Check className="w-4 h-4" aria-hidden="true" />}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
