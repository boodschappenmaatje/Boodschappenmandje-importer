import { MAATJE_INTRO_BOOT_SCRIPT } from "./intro-storage";
import { MaatjeIntroOverlay } from "./MaatjeIntroOverlay";

/**
 * Opening animation: Maatje pops up, winks, gives two thumbs up and then
 * "Boodschappen Maatje" appears at the top. Plays once per session; a tap skips it.
 */
export function MaatjeIntro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MAATJE_INTRO_BOOT_SCRIPT }} />
      <MaatjeIntroOverlay />
    </>
  );
}
