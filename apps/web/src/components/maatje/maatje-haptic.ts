let iosSwitch: HTMLLabelElement | null = null;

/**
 * Eén licht tikje in je hand. Android kent `navigator.vibrate`; iPhone-Safari
 * niet, maar geeft wél een tikje als een schakelaar (`<input switch>`) omgaat.
 * Werkt het allebei niet, dan gebeurt er gewoon niets.
 */
export function hapticTick(): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function" && navigator.vibrate(12)) return;
    if (!iosSwitch) {
      iosSwitch = document.createElement("label");
      iosSwitch.setAttribute("aria-hidden", "true");
      iosSwitch.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:0";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      iosSwitch.append(input);
      document.body.append(iosSwitch);
    }
    iosSwitch.click();
  } catch {
    // Geen trilling beschikbaar: niet erg.
  }
}
