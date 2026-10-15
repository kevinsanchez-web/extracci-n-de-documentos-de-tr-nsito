/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, Loader2, Plus, TriangleAlert } from "lucide-react";

/** Tamaño máximo de archivo en MB (base64 + 33 % debe caber en los 32 MB de la Cloud Function de 2.ª generación). */
const MAX_FILE_MB = 15;

interface DocumentDropzoneProps {
  onAnalyze: (base64: string, mimeType: string, fileName: string) => void;
  isAnalyzing: boolean;
  /** Paso actual del análisis, que se muestra aquí mismo (así no aparece un aviso aparte que mueva la pantalla) */
  statusMessage?: string;
  onShowHelp?: () => void;
  onNewTramite: () => void;
}

export default function DocumentDropzone({ onAnalyze, isAnalyzing, statusMessage, onNewTramite }: DocumentDropzoneProps) {
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
    // El archivo viaja en base64 (+33 %) y la Cloud Function acepta hasta 32 MB por petición
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_FILE_MB} MB. Comprímalo o divídalo en varios archivos.`);
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
      {/* Una sola zona: se puede arrastrar un archivo aquí o pulsar el botón. */}
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
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 border border-dashed rounded-2xl px-4 py-3 cursor-pointer transition-colors duration-200 ${
          isDragActive ? "tone-sky pastel-soft" : "border-line"
        } ${isAnalyzing ? "pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={handleChange}
          disabled={isAnalyzing}
        />
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="pastel-edge w-10 h-10 shrink-0 rounded-full flex items-center justify-center">
            {isAnalyzing ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isAnalyzing ? (
              <>
                <p className="t-body font-medium text-ink truncate" role="status" aria-live="polite">
                  {statusMessage || "Analizando documento…"}
                </p>
                <div className="progress-line mt-2" aria-hidden="true" />
              </>
            ) : (
              <>
                <p className="t-body font-medium text-ink leading-snug">Arrastre aquí un PDF o una imagen del trámite</p>
                <p className="t-caption leading-snug">También puede elegirlo desde su equipo · JPG, PNG, WEBP o PDF · hasta {MAX_FILE_MB} MB</p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onNewTramite();
            setFileError(null);
            fileInputRef.current?.click();
          }}
          disabled={isAnalyzing}
          className="btn btn-primary w-full sm:w-auto shrink-0"
          title="Empezar un trámite nuevo: elija los documentos del cliente"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nuevo trámite
        </button>
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
