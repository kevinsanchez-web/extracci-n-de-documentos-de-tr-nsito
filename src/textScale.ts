/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hace que el texto de la app siga el tamaño de letra que el usuario eligió en el sistema
 * (Dynamic Type en iOS/Safari). La tipografía de la app está en rem, así que basta con
 * escalar el tamaño base del <html> mediante la variable --text-scale.
 *
 * En navegadores sin `font: -apple-system-body` (Chrome, Firefox, Android) no hace nada y
 * el tamaño queda como está definido en el diseño.
 */

// Tamaño del cuerpo de texto de iOS con el ajuste por defecto ("Large"), en puntos
const IOS_DEFAULT_BODY = 17;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.5;

function readScale(): number {
  if (typeof CSS === "undefined" || !CSS.supports("font", "-apple-system-body")) return 1;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
  document.body.appendChild(probe);
  const size = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  if (!Number.isFinite(size) || size <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, size / IOS_DEFAULT_BODY));
}

function apply() {
  document.documentElement.style.setProperty("--text-scale", String(readScale()));
}

export function initTextScale() {
  apply();
  // Si el usuario cambia el tamaño en Ajustes y vuelve a la app, se vuelve a leer
  document.addEventListener("visibilitychange", () => { if (!document.hidden) apply(); });
  window.addEventListener("focus", apply);
}
