/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DocumentRecord } from "../types";
import PillSelect from "./PillSelect";
import { isReviewed, markReviewed } from "../reviewedStore";
import {
  FileText, Check, Save, RefreshCw, Smartphone,
  Mail, MapPin, User, Hash, Calendar, DollarSign,
  PenTool, Award, ShieldAlert, Zap, Clock, ChevronRight, Trash2
} from "lucide-react";

interface ActiveDocumentDetailProps {
  /** Pestañas por tipo de documento; se muestran en la parte superior de la tarjeta */
  tabs?: React.ReactNode;
  document: DocumentRecord | null;
  onUpdateDocumentData: (id: string, updatedData: any) => Promise<void>;
  onSyncDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  isSyncing: boolean;
  apiUrl: string;
}

const DOC_META: Record<string, { label: string }> = {
  cedula:  { label: "Cédula de Ciudadanía" },
  factura: { label: "Factura de Venta" },
  runt:    { label: "Formulario RUNT" },
  gases:   { label: "Certificado de Gases" },
  poder:   { label: "Poder Notarial" },
};

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h4 className="t-h2 text-ink mb-3 flex items-center gap-2">
      <span className="text-ink-muted" aria-hidden="true">{icon}</span>
      {title}
    </h4>
  );
}

/** Campos de cada tipo, para contar cuáles quedaron vacíos y avisar que faltan por revisar. */
const FIELD_KEYS: Record<string, string[]> = {
  cedula: ["nombreCompleto", "numeroDocumento", "fechaNacimiento", "sexo", "rh", "estatura", "contacto.celular", "contacto.correo", "contacto.direccion"],
  factura: ["numeroFactura", "fecha", "compradorNombre", "compradorIdentificacion", "vehiculoMarca", "vehiculoLinea", "vehiculoModelo", "vehiculoMotor", "vehiculoChasis", "vehiculoCilindrada", "vehiculoColor"],
  runt: ["tramiteSolicitado", "propietarioNombre", "propietarioIdentificacion", "vehiculoMarca", "vehiculoLinea", "vehiculoCilindrada", "vehiculoModelo", "vehiculoChasis", "vehiculoMotor"],
  gases: ["tipoCertificado", "fechaCertificado", "vehiculoMarca", "vehiculoLinea", "vehiculoCilindrada", "vehiculoModelo", "vehiculoMotor", "vehiculoChasis"],
  poder: ["otorganteNombre", "otorganteIdentificacion", "apoderadoNombre"],
};
const valueAt = (obj: any, path: string) => path.split(".").reduce((acc: any, k) => (acc == null ? acc : acc[k]), obj);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "field";

export default function ActiveDocumentDetail({
  document,
  onUpdateDocumentData,
  onSyncDocument,
  onDeleteDocument,
  isSyncing,
  apiUrl,
  tabs,
}: ActiveDocumentDetailProps) {
  const [editedData, setEditedData] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => { setConfirmingDelete(false); }, [document?.id]);
  // Marca visual de "revisado manualmente" (se guarda en este navegador)
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => { setReviewed(document ? isReviewed(document.id) : false); }, [document?.id]);

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
      <div className="card animate-screen-in h-full flex flex-col items-center justify-center min-h-[18rem] text-center p-5">
        <div className="w-16 h-16 card-compact flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-ink-muted" />
        </div>
        <h3 className="t-h2 text-ink mb-1">Ningún documento abierto</h3>
        <p className="t-caption max-w-[280px]">
          Suba un trámite con «Nuevo trámite» o elija uno de la lista para revisar y corregir sus datos.
        </p>
      </div>
    );
  }

  const meta = DOC_META[document.documentType] || {
    label: document.documentType,
  };

  // Nunca se muestra 100%: ningún modelo es infalible y un 100% puede llevar a omitir la revisión.
  const MAX_CONFIDENCE = 99;
  const rawConfidence = Math.round(document.confidence * 100);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(MAX_CONFIDENCE, rawConfidence)) : 0;
  const confLabel = confidence >= 90 ? "Alta" : confidence >= 75 ? "Media" : "Baja";

  // Campos vacíos y cambios sin guardar
  const emptyCount = editedData
    ? (FIELD_KEYS[document.documentType] || []).filter((k) => {
        const v = valueAt(editedData, k);
        return v === undefined || v === null || String(v).trim() === "";
      }).length
    : 0;
  const isDirty = Boolean(editedData) && JSON.stringify(editedData) !== JSON.stringify(document.extractedData);

  const set = (key: string, val: any) => setEditedData((p: any) => ({ ...p, [key]: val }));
  const setNested = (parent: string, child: string, val: any) =>
    setEditedData((p: any) => ({ ...p, [parent]: { ...(p[parent] || {}), [child]: val } }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changed = JSON.stringify(editedData) !== JSON.stringify(document.extractedData);
      await onUpdateDocumentData(document.id, editedData);
      if (changed) {
        markReviewed(document.id);
        setReviewed(true);
      }
      setSuccessMsg("Cambios guardados en Firestore");
    } catch {
      setSuccessMsg("Error al guardar");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  return (
    <div className="card flex flex-col h-full overflow-clip">

      {/* PESTAÑAS POR TIPO (dentro de la tarjeta) */}
      {tabs && <div className="px-5 pt-3 shrink-0">{tabs}</div>}

      {/* ENCABEZADO: qué documento es, cuánto se confía en la lectura y qué falta revisar */}
      <div className="px-5 pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="t-h1 text-ink truncate">{meta.label}</h3>
            <p className="t-caption truncate" title={`${document.fileName} · ID ${document.id}`}>
              {document.fileName} · <span className="nums">{new Date(document.scannedAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </p>
          </div>

          <div
            className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end"
            title="Porcentaje del análisis automático: mide cuántos campos clave se encontraron y qué tan bien se leyó, no que los datos sean correctos."
          >
            <div className="flex items-center gap-2">
              <div className="w-14 h-1.5 bg-app rounded-full overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${confidence >= 90 ? "bg-[var(--accent)]" : confidence >= 75 ? "bg-pastel-butter" : "bg-pastel-coral"}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="t-h2 text-ink nums">{confidence}%</span>
              <span className="t-caption">{confLabel}</span>
            </div>
            {emptyCount > 0 && (
              <span className="chip tone-butter" title="Campos de este documento que no se pudieron leer: complételos antes de sincronizar">
                {emptyCount} {emptyCount === 1 ? "campo vacío" : "campos vacíos"}
              </span>
            )}
            {reviewed && (
              <span className="chip tone-azure" title="Un usuario corrigió o completó estos datos después del análisis automático">
                <Check className="w-3.5 h-3.5" aria-hidden="true" /> Revisado
              </span>
            )}
            {document.syncStatus === "success" && (
              <span className="chip tone-azure">
                <Check className="w-3.5 h-3.5" aria-hidden="true" /> Enviado a destino
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FORMULARIO DE DATOS */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 pb-6 pt-1 space-y-8 border-t divider">
        {editedData && (
          <>
            {/* CÉDULA */}
            {document.documentType === "cedula" && (
              <>
                <div>
                  <SectionHeader icon={<User className="w-4 h-4" />} title="Información de Identidad" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nombre Completo">
                      <input type="text" placeholder="Sin dato" value={editedData.nombreCompleto || ""} onChange={e => set("nombreCompleto", e.target.value)} className={`${inputCls} uppercase font-semibold`} />
                    </Field>
                    <Field label="Número de Cédula">
                      <input type="text" placeholder="Sin dato" value={editedData.numeroDocumento || ""} onChange={e => set("numeroDocumento", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <Field label="Nacimiento">
                      <input type="text" placeholder="Sin dato" value={editedData.fechaNacimiento || ""} onChange={e => set("fechaNacimiento", e.target.value)} className={`${inputCls} nums text-center`} />
                    </Field>
                    <Field label="Sexo">
                      <PillSelect
                        value={editedData.sexo || ""}
                        onChange={(v) => set("sexo", v)}
                        ariaLabel="Sexo"
                        options={[
                          { value: "", label: "—" },
                          { value: "M", label: "Masculino" },
                          { value: "F", label: "Femenino" },
                        ]}
                      />
                    </Field>
                    <Field label="RH">
                      <input type="text" placeholder="Sin dato" value={editedData.rh || ""} onChange={e => set("rh", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                    <Field label="Estatura">
                      <input type="text" placeholder="Sin dato" value={editedData.estatura || ""} onChange={e => set("estatura", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<PenTool className="w-4 h-4" />} title="Contacto (Manuscrito / Extraído)" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Teléfono Celular">
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" placeholder="Sin dato" value={editedData.contacto?.celular || ""} onChange={e => setNested("contacto", "celular", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                    <Field label="Correo Electrónico">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" placeholder="Sin dato" value={editedData.contacto?.correo || ""} onChange={e => setNested("contacto", "correo", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Dirección de Residencia">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" placeholder="Sin dato" value={editedData.contacto?.direccion || ""} onChange={e => setNested("contacto", "direccion", e.target.value)} className={`${inputCls}`} style={{ paddingLeft: "2.5rem" }} />
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
                  <SectionHeader icon={<Hash className="w-4 h-4" />} title="Datos de Facturación" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="No. Factura">
                      <input type="text" placeholder="Sin dato" value={editedData.numeroFactura || ""} onChange={e => set("numeroFactura", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Fecha Emisión">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" placeholder="Sin dato" value={editedData.fecha || ""} onChange={e => set("fecha", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                    <Field label="Comprador">
                      <input type="text" placeholder="Sin dato" value={editedData.compradorNombre || ""} onChange={e => set("compradorNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. / NIT Comprador">
                      <input type="text" placeholder="Sin dato" value={editedData.compradorIdentificacion || ""} onChange={e => set("compradorIdentificacion", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Vehículo" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Marca">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea / Referencia">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Modelo (Año)">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} nums text-center`} />
                    </Field>
                    <Field label="No. Motor">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="No. Chasis / VIN">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Color">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoColor || ""} onChange={e => set("vehiculoColor", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>

                <div className="pastel-soft tone-azure px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="t-caption text-ink uppercase tracking-wide font-bold">Total Transacción</span>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-ink" />
                    <input
                      type="number"
                      value={editedData.valorTotal || 0}
                      onChange={e => set("valorTotal", parseFloat(e.target.value) || 0)}
                      aria-label="Total Transacción" className="field w-40 text-right font-bold nums"
                    />
                  </div>
                </div>
              </>
            )}

            {/* RUNT */}
            {document.documentType === "runt" && (
              <>
                <div>
                  <SectionHeader icon={<FileText className="w-4 h-4" />} title="Solicitud RUNT" />
                  <Field label="Trámite Solicitado">
                    <input type="text" placeholder="Sin dato" value={editedData.tramiteSolicitado || ""} onChange={e => set("tramiteSolicitado", e.target.value)} className={`${inputCls} uppercase font-bold`} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="Propietario / Comprador">
                      <input type="text" placeholder="Sin dato" value={editedData.propietarioNombre || ""} onChange={e => set("propietarioNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. / NIT">
                      <input type="text" placeholder="Sin dato" value={editedData.propietarioIdentificacion || ""} onChange={e => set("propietarioIdentificacion", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Especificaciones del Vehículo" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Marca">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                    <Field label="Modelo">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="Serial Chasis">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="Serial Motor">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {/* GASES */}
            {document.documentType === "gases" && (
              <>
                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Certificado Técnico" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Tipo de Certificado">
                      <input type="text" placeholder="Sin dato" value={editedData.tipoCertificado || ""} onChange={e => set("tipoCertificado", e.target.value)} className={`${inputCls} font-semibold`} />
                    </Field>
                    <Field label="Fecha Certificación">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" placeholder="Sin dato" value={editedData.fechaCertificado || ""} onChange={e => set("fechaCertificado", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Datos del Vehículo" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Marca">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                    <Field label="Modelo">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="No. Motor">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="No. Chasis / VIN">
                      <input type="text" placeholder="Sin dato" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {/* PODER */}
            {document.documentType === "poder" && (
              <>
                <div>
                  <SectionHeader icon={<PenTool className="w-4 h-4" />} title="Poder Especial Otorgado" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Otorgante">
                      <input type="text" placeholder="Sin dato" value={editedData.otorganteNombre || ""} onChange={e => set("otorganteNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. Otorgante">
                      <input type="text" placeholder="Sin dato" value={editedData.otorganteIdentificacion || ""} onChange={e => set("otorganteIdentificacion", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Apoderado Designado">
                      <input type="text" placeholder="Sin dato" value={editedData.apoderadoNombre || ""} onChange={e => set("apoderadoNombre", e.target.value)} className={`${inputCls} font-semibold uppercase`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<FileText className="w-4 h-4" />} title="Trámites Autorizados" />
                  <div className="flex flex-wrap gap-2">
                    {(editedData.tramitesAutorizados || []).length > 0
                      ? (editedData.tramitesAutorizados || []).map((t: string, i: number) => (
                          <span key={i} className="chip tone-powder">
                            {t}
                          </span>
                        ))
                      : <span className="t-caption italic">Ninguno detectado</span>
                    }
                  </div>
                </div>
              </>
            )}

            {/* DESCONOCIDO */}
            {!["cedula", "factura", "runt", "gases", "poder"].includes(document.documentType) && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 pastel-soft tone-coral p-4 t-caption text-ink">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Tipo de documento no reconocido. Puede editar los datos en formato JSON.</span>
                </div>
                <textarea
                  rows={7}
                  value={JSON.stringify(editedData, null, 2)}
                  onChange={e => { try { setEditedData(JSON.parse(e.target.value)); } catch {} }}
                  aria-label="Datos en JSON" className="field" style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* BARRA DE ACCIONES */}
      <div className="shrink-0 bg-card border-t divider p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-4 sticky bottom-0 sm:static z-10">
        {successMsg && (
          <div className="flex items-center gap-2 pastel-soft tone-azure t-caption text-ink px-3 py-2 mb-4" role="status">
            <Check className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          {confirmingDelete ? (
            <div className="order-first sm:order-none basis-full sm:basis-auto flex flex-wrap items-center gap-2 pastel-soft tone-coral p-2" role="alert">
              <span className="t-caption text-ink px-2">¿Eliminar este documento de forma permanente?</span>
              <button
                onClick={() => { setConfirmingDelete(false); onDeleteDocument(document.id); }}
                className="btn btn-danger"
                autoFocus
              >
                <Trash2 className="w-4 h-4" />
                Sí, eliminar
              </button>
              <button onClick={() => setConfirmingDelete(false)} className="btn btn-ghost">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="btn btn-ghost shrink-0 min-w-11 sm:min-w-0 !px-0 sm:!px-4 text-[var(--danger-ink)]"
              title="Eliminar documento permanentemente"
              aria-label="Eliminar documento"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            title={isDirty ? "Guardar los cambios de este documento" : "No hay cambios por guardar"}
            className={`btn shrink-0 min-w-11 sm:min-w-0 !px-0 sm:!px-5 ${isDirty ? "btn-secondary" : "btn-ghost"}`}
            id="btn-save-extracted"
            aria-label={isSaving ? "Guardando" : "Guardar cambios"}
          >
            <Save className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isSaving ? "Guardando..." : "Guardar"}</span>
          </button>

          <button
            onClick={() => onSyncDocument(document.id)}
            disabled={isSyncing}
            title={`Enviar los datos a ${apiUrl}`}
            className={`btn flex-1 min-w-0 ${document.syncStatus === "success" ? "btn-info" : "btn-primary"}`}
            id="btn-sync-document"
          >
            {isSyncing ? (
              <><RefreshCw className="w-4 h-4 animate-spin shrink-0" /> <span className="truncate">Sincronizando…</span></>
            ) : document.syncStatus === "success" ? (
              <><Check className="w-4 h-4 shrink-0" /> <span className="truncate"><span className="sm:hidden">Re-enviar</span><span className="hidden sm:inline">Sincronizado — Re-enviar</span></span></>
            ) : (
              <><RefreshCw className="w-4 h-4 shrink-0" /> <span className="truncate"><span className="sm:hidden">Sincronizar</span><span className="hidden sm:inline">Sincronizar vía API</span></span></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
