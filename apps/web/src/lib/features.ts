// WhatsApp is paused while Meta's account review is open. Flip to true to bring
// back the owner toggle, the poster QR to WhatsApp and the /whatsapp pages.
// Server side, pause sending with whatsapp_dispatch_settings.daily_cap = 0.
export const WHATSAPP_VISIBLE = false
