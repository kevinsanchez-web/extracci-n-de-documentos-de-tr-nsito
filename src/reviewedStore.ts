/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Marca de "revisado manualmente" por documento.
 * El servidor solo guarda los datos del documento (no admite una marca de revisión), así que
 * esta marca se guarda en este navegador (localStorage). Es una ayuda visual, no un dato del trámite.
 */

const KEY = "reviewedDocs";
const MAX_IDS = 500;

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isReviewed(id: string): boolean {
  return read().includes(id);
}

export function markReviewed(id: string): void {
  try {
    const ids = read().filter((x) => x !== id);
    ids.push(id);
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX_IDS)));
  } catch {
    // sin almacenamiento disponible: la marca solo dura mientras la pantalla esté abierta
  }
}
