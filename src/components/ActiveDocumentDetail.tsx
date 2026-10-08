/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DocumentRecord } from "../types";
import {
  FileText, Check, Save, RefreshCw, Smartphone,
  Mail, MapPin, User, Hash, Calendar, DollarSign,
  PenTool, Award, ShieldAlert, Zap, Clock, ChevronRight, Trash2
} from "lucide-react";

interface ActiveDocumentDetailProps {
  document: DocumentRecord | null;
  onUpdateDocumentData: (id: string, updatedData: any) => Promise<void>;
  onSyncDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  isSyncing: boolean;
  apiUrl: string;
}

const DOC_META: Record<string, { label: string; bannerBg: string; badgeBg: string; badgeText: string; accent: string }> = {
  cedula:  { label: "Cédula de Ciudadanía", bannerBg: "bg-gradient-to-r from-indigo-600 to-blue-700",    badgeBg: "bg-indigo-700",  badgeText: "text-white", accent: "text-indigo-200" },
  factura: { label: "Factura de Venta",     bannerBg: "bg-gradient-to-r from-emerald-600 to-teal-600",   badgeBg: "bg-emerald-700", badgeText: "text-white", accent: "text-emerald-200" },
  runt:    { label: "Formulario RUNT",      bannerBg: "bg-gradient-to-r from-blue-600 to-indigo-600",    badgeBg: "bg-blue-700",    badgeText: "text-white", accent: "text-blue-200" },
  gases:   { label: "Certificado de Gases", bannerBg: "bg-gradient-to-r from-teal-600 to-cyan-600",      badgeBg: "bg-teal-700",    badgeText: "text-white", accent: "text-teal-200" },
  poder:   { label: "Poder Notarial",       bannerBg: "bg-gradient-to-r from-purple-600 to-violet-600",  badgeBg: "bg-purple-700",  badgeText: "text-white", accent: "text-purple-200" },
};

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-slate-400">{icon}</div>
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{title}</span>
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder-slate-300";

export default function ActiveDocumentDetail({
  document,
  onUpdateDocumentData,
  onSyncDocument,
  onDeleteDocument,
  isSyncing,
  apiUrl,
}: ActiveDocumentDetailProps) {
  const [editedData, setEditedData] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (document) {
      setEditedData(JSON.parse(JSON.stringify(document.extractedData)));
    } else {
      setEditedData(null);
      setSuccessMsg("");
    }
  }, [document?.id]);

  if (!document) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col items-center justify-center min-h-[420px] text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Sin documento activo</h3>
        <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
          Suba un archivo o seleccione una muestra de la izquierda para extraer y visualizar los datos.
        </p>
        <div className="mt-5 flex items-center gap-1.5 text-xs text-slate-400">
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Use las muestras rápidas para probar</span>
        </div>
      </div>
    );
  }

  const meta = DOC_META[document.documentType] || {
    label: document.documentType,
    bannerBg: "bg-gradient-to-r from-slate-600 to-slate-700",
    badgeBg: "bg-slate-700",
    badgeText: "text-white",
    accent: "text-slate-200"
  };

  const confidence = Math.round(document.confidence * 100);
  const confLabel = confidence >= 90 ? "Alta" : confidence >= 75 ? "Media" : "Baja";

  const set = (key: string, val: any) => setEditedData((p: any) => ({ ...p, [key]: val }));
  const setNested = (parent: string, child: string, val: any) =>
    setEditedData((p: any) => ({ ...p, [parent]: { ...(p[parent] || {}), [child]: val } }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateDocumentData(document.id, editedData);
      setSuccessMsg("Cambios guardados en Firestore");
    } catch {
      setSuccessMsg("Error al guardar");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-full overflow-hidden">

      {/* BANNER SUPERIOR */}
      <div className={`${meta.bannerBg} px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${meta.badgeBg} ${meta.badgeText} bg-white/20`}>
                {meta.label}
              </span>
              {document.syncStatus === "success" && (
                <span className="text-[10px] font-bold text-white bg-white/20 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Check className="w-3 h-3" /> Sincronizado
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white truncate" title={document.fileName}>
              {document.fileName}
            </p>
            <p className={`text-[11px] mt-0.5 italic line-clamp-1 ${meta.accent}`}>"{document.summary}"</p>
          </div>

          {/* Confianza IA */}
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">
              Confianza IA
            </div>
            <div className="flex items-center gap-2 justify-end">
              <div className="w-20 h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-white" style={{ width: `${confidence}%` }} />
              </div>
              <span className="text-lg font-black text-white">
                {confidence}%
              </span>
            </div>
            <div className={`text-[10px] mt-0.5 ${meta.accent}`}>{confLabel} precisión</div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-3 mt-3 text-[10px] text-white/60">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(document.scannedAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            ID: <code className="font-mono">{document.id.slice(0, 16)}…</code>
          </span>
        </div>
      </div>

      {/* FORMULARIO DE DATOS */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {editedData && (
          <>
            {/* CÉDULA */}
            {document.documentType === "cedula" && (
              <>
                <div>
                  <SectionHeader icon={<User className="w-3.5 h-3.5" />} title="Información de Identidad" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nombre Completo">
                      <input type="text" value={editedData.nombreCompleto || ""} onChange={e => set("nombreCompleto", e.target.value)} className={`${inputCls} uppercase font-semibold`} />
                    </Field>
                    <Field label="Número de Cédula">
                      <input type="text" value={editedData.numeroDocumento || ""} onChange={e => set("numeroDocumento", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <Field label="Nacimiento">
                      <input type="text" value={editedData.fechaNacimiento || ""} onChange={e => set("fechaNacimiento", e.target.value)} className={`${inputCls} font-mono text-center`} />
                    </Field>
                    <Field label="Sexo">
                      <select value={editedData.sexo || ""} onChange={e => set("sexo", e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </Field>
                    <Field label="RH">
                      <input type="text" value={editedData.rh || ""} onChange={e => set("rh", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                    <Field label="Estatura">
                      <input type="text" value={editedData.estatura || ""} onChange={e => set("estatura", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<PenTool className="w-3.5 h-3.5" />} title="Contacto (Manuscrito / Extraído)" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Teléfono Celular">
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <input type="text" value={editedData.contacto?.celular || ""} onChange={e => setNested("contacto", "celular", e.target.value)} className={`${inputCls} pl-8 font-mono`} />
                      </div>
                    </Field>
                    <Field label="Correo Electrónico">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <input type="text" value={editedData.contacto?.correo || ""} onChange={e => setNested("contacto", "correo", e.target.value)} className={`${inputCls} pl-8 font-mono text-blue-600`} />
                      </div>
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Dirección de Residencia">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <input type="text" value={editedData.contacto?.direccion || ""} onChange={e => setNested("contacto", "direccion", e.target.value)} className={`${inputCls} pl-8`} />
                      </div>
                    </Field>
                  </div>
                </div>
              </>
            )}

            {/* FACTURA */}
            {document.documentType === "factura" && (
              <>
                <div>
                  <SectionHeader icon={<Hash className="w-3.5 h-3.5" />} title="Datos de Facturación" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="No. Factura">
                      <input type="text" value={editedData.numeroFactura || ""} onChange={e => set("numeroFactura", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                    <Field label="Fecha Emisión">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <input type="text" value={editedData.fecha || ""} onChange={e => set("fecha", e.target.value)} className={`${inputCls} pl-8 font-mono`} />
                      </div>
                    </Field>
                    <Field label="Comprador">
                      <input type="text" value={editedData.compradorNombre || ""} onChange={e => set("compradorNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. / NIT Comprador">
                      <input type="text" value={editedData.compradorIdentificacion || ""} onChange={e => set("compradorIdentificacion", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-3.5 h-3.5" />} title="Vehículo" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="Marca">
                      <input type="text" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea / Referencia">
                      <input type="text" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                    <Field label="Modelo (Año)">
                      <input type="text" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} font-mono text-center`} />
                    </Field>
                    <Field label="No. Motor">
                      <input type="text" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </Field>
                    <Field label="No. Chasis / VIN">
                      <input type="text" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Color">
                      <input type="text" value={editedData.vehiculoColor || ""} onChange={e => set("vehiculoColor", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Total Transacción</span>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <input
                      type="number"
                      value={editedData.valorTotal || 0}
                      onChange={e => set("valorTotal", parseFloat(e.target.value) || 0)}
                      className="w-32 text-right text-base font-black font-mono text-slate-800 dark:text-slate-100 bg-transparent border-b-2 border-emerald-300 focus:outline-none focus:border-emerald-500 pb-0.5"
                    />
                  </div>
                </div>
              </>
            )}

            {/* RUNT */}
            {document.documentType === "runt" && (
              <>
                <div>
                  <SectionHeader icon={<FileText className="w-3.5 h-3.5" />} title="Solicitud RUNT" />
                  <Field label="Trámite Solicitado">
                    <input type="text" value={editedData.tramiteSolicitado || ""} onChange={e => set("tramiteSolicitado", e.target.value)} className={`${inputCls} uppercase font-bold`} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <Field label="Propietario / Comprador">
                      <input type="text" value={editedData.propietarioNombre || ""} onChange={e => set("propietarioNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. / NIT">
                      <input type="text" value={editedData.propietarioIdentificacion || ""} onChange={e => set("propietarioIdentificacion", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-3.5 h-3.5" />} title="Especificaciones del Vehículo" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Marca">
                      <input type="text" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea">
                      <input type="text" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                    <Field label="Modelo">
                      <input type="text" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <Field label="Serial Chasis">
                      <input type="text" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </Field>
                    <Field label="Serial Motor">
                      <input type="text" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {/* GASES */}
            {document.documentType === "gases" && (
              <>
                <div>
                  <SectionHeader icon={<Award className="w-3.5 h-3.5" />} title="Certificado Técnico" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Tipo de Certificado">
                      <input type="text" value={editedData.tipoCertificado || ""} onChange={e => set("tipoCertificado", e.target.value)} className={`${inputCls} font-semibold`} />
                    </Field>
                    <Field label="Fecha Certificación">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <input type="text" value={editedData.fechaCertificado || ""} onChange={e => set("fechaCertificado", e.target.value)} className={`${inputCls} pl-8 font-mono`} />
                      </div>
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-3.5 h-3.5" />} title="Datos del Vehículo" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Marca">
                      <input type="text" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea">
                      <input type="text" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                    <Field label="Modelo">
                      <input type="text" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} text-center font-mono`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <Field label="No. Motor">
                      <input type="text" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </Field>
                    <Field label="No. Chasis / VIN">
                      <input type="text" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} font-mono uppercase`} />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {/* PODER */}
            {document.documentType === "poder" && (
              <>
                <div>
                  <SectionHeader icon={<PenTool className="w-3.5 h-3.5" />} title="Poder Especial Otorgado" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Otorgante">
                      <input type="text" value={editedData.otorganteNombre || ""} onChange={e => set("otorganteNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. Otorgante">
                      <input type="text" value={editedData.otorganteIdentificacion || ""} onChange={e => set("otorganteIdentificacion", e.target.value)} className={`${inputCls} font-mono`} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Apoderado Designado">
                      <input type="text" value={editedData.apoderadoNombre || ""} onChange={e => set("apoderadoNombre", e.target.value)} className={`${inputCls} font-semibold uppercase`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<FileText className="w-3.5 h-3.5" />} title="Trámites Autorizados" />
                  <div className="flex flex-wrap gap-2">
                    {(editedData.tramitesAutorizados || []).length > 0
                      ? (editedData.tramitesAutorizados || []).map((t: string, i: number) => (
                          <span key={i} className="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg font-medium">
                            {t}
                          </span>
                        ))
                      : <span className="text-xs text-slate-400 italic">Ninguno detectado</span>
                    }
                  </div>
                </div>
              </>
            )}

            {/* DESCONOCIDO */}
            {!["cedula", "factura", "runt", "gases", "poder"].includes(document.documentType) && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Tipo de documento no reconocido. Puede editar los datos en formato JSON.</span>
                </div>
                <textarea
                  rows={7}
                  value={JSON.stringify(editedData, null, 2)}
                  onChange={e => { try { setEditedData(JSON.parse(e.target.value)); } catch {} }}
                  className="w-full font-mono text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-400"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* BARRA DE ACCIONES */}
      <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-4">
        {successMsg && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg mb-3">
            <Check className="w-3.5 h-3.5 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm("¿Eliminar este documento permanentemente de Firestore?")) {
                onDeleteDocument(document.id);
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            title="Eliminar documento permanentemente"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-60"
            id="btn-save-extracted"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? "animate-spin" : ""}`} />
            {isSaving ? "Guardando..." : "Guardar"}
          </button>

          <button
            onClick={() => onSyncDocument(document.id)}
            disabled={isSyncing}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
              document.syncStatus === "success"
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-200"
            }`}
            id="btn-sync-document"
          >
            {isSyncing ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sincronizando…</>
            ) : document.syncStatus === "success" ? (
              <><Check className="w-3.5 h-3.5" /> Sincronizado — Re-enviar</>
            ) : (
              <><RefreshCw className="w-3.5 h-3.5" /> Sincronizar vía API</>
            )}
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400 mt-2">
          Destino: <code className="font-mono text-blue-500">{apiUrl.length > 40 ? apiUrl.slice(0, 40) + "…" : apiUrl}</code>
        </p>
      </div>
    </div>
  );
}
