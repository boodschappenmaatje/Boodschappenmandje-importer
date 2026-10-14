/** sessionStorage key: the intro plays once per app session. */
export const MAATJE_INTRO_STORAGE_KEY = "maatje-intro-seen";

/**
 * Runs before the page is painted. When the intro was already shown in this
 * session it marks <html data-maatje-intro="done">, which hides the overlay
 * via CSS so there is no flash of the intro on reloads.
 */
export const MAATJE_INTRO_BOOT_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(
  MAATJE_INTRO_STORAGE_KEY,
)})){document.documentElement.dataset.maatjeIntro="done"}}catch(e){}`;
