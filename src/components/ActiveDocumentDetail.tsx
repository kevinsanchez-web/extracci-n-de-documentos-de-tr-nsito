/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DocumentRecord } from "../types";
import PillSelect from "./PillSelect";
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
    <div className="flex items-center gap-2 mb-4">
      <div className="text-ink-muted">{icon}</div>
      <h4 className="t-caption uppercase tracking-wider font-bold">{title}</h4>
      <div className="flex-1 h-px border-t divider" />
    </div>
  );
}

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
        <h3 className="t-h2 text-ink mb-1">Sin documento activo</h3>
        <p className="t-caption max-w-[260px]">
          Suba un archivo con "Nuevo Trámite" o seleccione un documento del historial para ver y editar sus datos.
        </p>
      </div>
    );
  }

  const meta = DOC_META[document.documentType] || {
    label: document.documentType,
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
    <div className="card flex flex-col h-full overflow-clip">

      {/* PESTAÑAS POR TIPO (dentro de la tarjeta) */}
      {tabs && <div className="px-5 pt-4 shrink-0">{tabs}</div>}

      {/* BANNER SUPERIOR */}
      <div className="px-5 py-4 border-b divider">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="chip tone-powder">
                {meta.label}
              </span>
              {document.syncStatus === "success" && (
                <span className="chip tone-azure">
                  <Check className="w-4 h-4" /> Sincronizado
                </span>
              )}
            </div>
            <p className="t-body font-semibold text-ink truncate" title={document.fileName}>
              {document.fileName}
            </p>
            <p className="t-caption italic line-clamp-1">"{document.summary}"</p>
          </div>

          {/* Confianza IA */}
          <div className="shrink-0 sm:text-right">
            <div className="t-caption uppercase tracking-wider mb-1">
              Confianza IA
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <div className="w-20 h-2 bg-app rounded-full overflow-hidden">
                <div className="h-full bg-pastel-sky" style={{ width: `${confidence}%` }} />
              </div>
              <span className="t-h2 text-ink nums">
                {confidence}%
              </span>
            </div>
            <div className="t-caption mt-0.5">{confLabel} precisión</div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex flex-wrap items-center gap-4 mt-3 t-caption">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(document.scannedAt).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-4 h-4" />
            ID: <code className="font-mono">{document.id.slice(0, 16)}…</code>
          </span>
        </div>
      </div>

      {/* FORMULARIO DE DATOS */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-6">
        {editedData && (
          <>
            {/* CÉDULA */}
            {document.documentType === "cedula" && (
              <>
                <div>
                  <SectionHeader icon={<User className="w-4 h-4" />} title="Información de Identidad" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nombre Completo">
                      <input type="text" value={editedData.nombreCompleto || ""} onChange={e => set("nombreCompleto", e.target.value)} className={`${inputCls} uppercase font-semibold`} />
                    </Field>
                    <Field label="Número de Cédula">
                      <input type="text" value={editedData.numeroDocumento || ""} onChange={e => set("numeroDocumento", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <Field label="Nacimiento">
                      <input type="text" value={editedData.fechaNacimiento || ""} onChange={e => set("fechaNacimiento", e.target.value)} className={`${inputCls} nums text-center`} />
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
                      <input type="text" value={editedData.rh || ""} onChange={e => set("rh", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                    <Field label="Estatura">
                      <input type="text" value={editedData.estatura || ""} onChange={e => set("estatura", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<PenTool className="w-4 h-4" />} title="Contacto (Manuscrito / Extraído)" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Teléfono Celular">
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" value={editedData.contacto?.celular || ""} onChange={e => setNested("contacto", "celular", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                    <Field label="Correo Electrónico">
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" value={editedData.contacto?.correo || ""} onChange={e => setNested("contacto", "correo", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Dirección de Residencia">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" value={editedData.contacto?.direccion || ""} onChange={e => setNested("contacto", "direccion", e.target.value)} className={`${inputCls}`} style={{ paddingLeft: "2.5rem" }} />
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
                      <input type="text" value={editedData.numeroFactura || ""} onChange={e => set("numeroFactura", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Fecha Emisión">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" value={editedData.fecha || ""} onChange={e => set("fecha", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                    <Field label="Comprador">
                      <input type="text" value={editedData.compradorNombre || ""} onChange={e => set("compradorNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. / NIT Comprador">
                      <input type="text" value={editedData.compradorIdentificacion || ""} onChange={e => set("compradorIdentificacion", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Vehículo" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Marca">
                      <input type="text" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea / Referencia">
                      <input type="text" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Modelo (Año)">
                      <input type="text" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} nums text-center`} />
                    </Field>
                    <Field label="No. Motor">
                      <input type="text" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="No. Chasis / VIN">
                      <input type="text" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Color">
                      <input type="text" value={editedData.vehiculoColor || ""} onChange={e => set("vehiculoColor", e.target.value)} className={inputCls} />
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
                    <input type="text" value={editedData.tramiteSolicitado || ""} onChange={e => set("tramiteSolicitado", e.target.value)} className={`${inputCls} uppercase font-bold`} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="Propietario / Comprador">
                      <input type="text" value={editedData.propietarioNombre || ""} onChange={e => set("propietarioNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. / NIT">
                      <input type="text" value={editedData.propietarioIdentificacion || ""} onChange={e => set("propietarioIdentificacion", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Especificaciones del Vehículo" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Marca">
                      <input type="text" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea">
                      <input type="text" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                    <Field label="Modelo">
                      <input type="text" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="Serial Chasis">
                      <input type="text" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="Serial Motor">
                      <input type="text" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} nums uppercase`} />
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
                      <input type="text" value={editedData.tipoCertificado || ""} onChange={e => set("tipoCertificado", e.target.value)} className={`${inputCls} font-semibold`} />
                    </Field>
                    <Field label="Fecha Certificación">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                        <input type="text" value={editedData.fechaCertificado || ""} onChange={e => set("fechaCertificado", e.target.value)} className={`${inputCls} nums`} style={{ paddingLeft: "2.5rem" }} />
                      </div>
                    </Field>
                  </div>
                </div>

                <div>
                  <SectionHeader icon={<Award className="w-4 h-4" />} title="Datos del Vehículo" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Marca">
                      <input type="text" value={editedData.vehiculoMarca || ""} onChange={e => set("vehiculoMarca", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Línea">
                      <input type="text" value={editedData.vehiculoLinea || ""} onChange={e => set("vehiculoLinea", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                    <Field label="Cilindrada">
                      <input type="text" value={editedData.vehiculoCilindrada || ""} onChange={e => set("vehiculoCilindrada", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                    <Field label="Modelo">
                      <input type="text" value={editedData.vehiculoModelo || ""} onChange={e => set("vehiculoModelo", e.target.value)} className={`${inputCls} text-center nums`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="No. Motor">
                      <input type="text" value={editedData.vehiculoMotor || ""} onChange={e => set("vehiculoMotor", e.target.value)} className={`${inputCls} nums uppercase`} />
                    </Field>
                    <Field label="No. Chasis / VIN">
                      <input type="text" value={editedData.vehiculoChasis || ""} onChange={e => set("vehiculoChasis", e.target.value)} className={`${inputCls} nums uppercase`} />
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
                      <input type="text" value={editedData.otorganteNombre || ""} onChange={e => set("otorganteNombre", e.target.value)} className={`${inputCls} uppercase`} />
                    </Field>
                    <Field label="C.C. Otorgante">
                      <input type="text" value={editedData.otorganteIdentificacion || ""} onChange={e => set("otorganteIdentificacion", e.target.value)} className={`${inputCls} nums`} />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Apoderado Designado">
                      <input type="text" value={editedData.apoderadoNombre || ""} onChange={e => set("apoderadoNombre", e.target.value)} className={`${inputCls} font-semibold uppercase`} />
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
      <div className="shrink-0 bg-card border-t divider p-5">
        {successMsg && (
          <div className="flex items-center gap-2 pastel-soft tone-azure t-caption text-ink px-3 py-2 mb-4" role="status">
            <Check className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-2 pastel-soft tone-coral p-2" role="alert">
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
              className="btn btn-danger"
              title="Eliminar documento permanentemente"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-ghost"
            id="btn-save-extracted"
          >
            <Save className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
            {isSaving ? "Guardando..." : "Guardar"}
          </button>

          <button
            onClick={() => onSyncDocument(document.id)}
            disabled={isSyncing}
            className={`btn flex-1 ${document.syncStatus === "success" ? "btn-info" : "btn-primary"}`}
            id="btn-sync-document"
          >
            {isSyncing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Sincronizando…</>
            ) : document.syncStatus === "success" ? (
              <><Check className="w-4 h-4" /> Sincronizado — Re-enviar</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Sincronizar vía API</>
            )}
          </button>
        </div>

        <p className="t-caption text-center mt-2">
          Destino: <code className="font-mono text-ink">{apiUrl.length > 40 ? apiUrl.slice(0, 40) + "…" : apiUrl}</code>
        </p>
      </div>
    </div>
  );
}
