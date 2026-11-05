// Skutečná viditelnost záložky a čitelný důvod odpojení.
//
// Původní getter `document.hidden` se uloží hned při načtení modulu – keepalive
// ho pak přepíše na `false`, ale pro diagnostiku chceme znát pravdu.

const docProto = Object.getPrototypeOf(document) as Document;
const origHidden = Object.getOwnPropertyDescriptor(docProto, "hidden");

export const realHidden = (): boolean | null => {
  try { return origHidden?.get ? (origHidden.get.call(document) as boolean) : document.hidden; } catch { return null; }
};

export function closeReason(ev: CloseEvent | undefined): string {
  const code = ev?.code, reason = String(ev?.reason || "");
  let txt;
  if (/heartbeat/i.test(reason)) txt = "hra přestala dostávat signál (záložka uspaná?)";
  else if (/superseded|newer user session/i.test(reason)) txt = "hra otevřená v jiném okně";
  else if (code === 4710 || /version/i.test(reason)) txt = "nová verze hry – obnov stránku";
  else if (realHidden()) txt = "záložka byla na pozadí";
  else txt = "neznámý důvod";
  return `${txt} (kód ${code ?? "?"}${reason ? ", " + reason : ""})`;
}
