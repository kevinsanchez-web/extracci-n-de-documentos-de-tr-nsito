/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, HelpCircle, Loader2, Plus, TriangleAlert } from "lucide-react";

interface DocumentDropzoneProps {
  onAnalyze: (base64: string, mimeType: string, fileName: string) => void;
  isAnalyzing: boolean;
  onShowHelp: () => void;
  onNewTramite: () => void;
}

export default function DocumentDropzone({ onAnalyze, isAnalyzing, onShowHelp, onNewTramite }: DocumentDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragActive(true);
    else if (e.type === "dragleave") setIsDragActive(false);
  };

  const processFile = (file: File) => {
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setFileError("Formato no admitido. Suba una imagen (JPEG, PNG, WEBP) o un archivo PDF.");
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onAnalyze(reader.result.split(",")[1], file.type, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) processFile(e.target.files[0]);
    e.target.value = "";
  };

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Zona de arrastre / clic: una sola fila compacta */}
        <div
          role="button"
          tabIndex={isAnalyzing ? -1 : 0}
          aria-busy={isAnalyzing}
          aria-disabled={isAnalyzing}
          aria-label="Subir documento: arrastre un archivo o presione Enter para buscar en su equipo"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`flex-1 min-w-0 flex items-center gap-3 border border-dashed rounded-2xl px-4 py-3 cursor-pointer transition-colors duration-200 ${
            isDragActive ? "tone-sky pastel-soft" : "border-line"
          } ${isAnalyzing ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={handleChange}
            disabled={isAnalyzing}
          />
          <div className="tone-powder pastel-edge w-9 h-9 shrink-0 rounded-full flex items-center justify-center">
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="t-body font-medium text-ink truncate" role={isAnalyzing ? "status" : undefined}>
              {isAnalyzing ? (
                "Analizando documento…"
              ) : (
                <>
                  Arrastre aquí su documento ó{" "}
                  <span className="underline font-semibold">busque en su equipo</span>
                </>
              )}
            </p>
            <p className="t-caption truncate">Imágenes (JPG, PNG, WEBP) o PDF de trámites</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onShowHelp} className="btn btn-ghost flex-1 md:flex-none">
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
            Guía de Archivos
          </button>
          <button
            onClick={() => {
              onNewTramite();
              setFileError(null);
              fileInputRef.current?.click();
            }}
            disabled={isAnalyzing}
            className="btn btn-primary flex-1 md:flex-none"
            title="Limpiar la selección y elegir los documentos del nuevo cliente"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nuevo Trámite
          </button>
        </div>
      </div>

      {fileError && (
        <p className="field-error-msg pastel-soft tone-coral p-3 mt-3" role="alert">
          <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
          {fileError}
        </p>
      )}
    </div>
  );
}
