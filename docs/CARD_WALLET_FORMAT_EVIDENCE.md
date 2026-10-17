# Typed-entry barcode defaults

Checked 18 October 2026. Defaults are suggestions for the supported representation;
they do not transform membership numbers or guarantee every card variant works.
No real customer card number was collected or saved for this research.

| Brand | Default | Evidence / limit |
|---|---|---|
| Nectar | code128; picker initially collapsed | [James White's firsthand scan](https://www.jmwhite.co.uk/blog/the-awkward-lack-of-security-with-the-nectar-loyalty-card) describes decoding his own physical card using zbarimg, reporting CODE-128. This supports a Code128 baseline, not universal compatibility. |
| Tesco, Boots, Morrisons, Superdrug, Waitrose, IKEA, Other | code128 fallback; picker initially shown | No sufficiently specific supported-format/payload evidence confirmed in this pass. Retailer pages saying only “barcode” or “QR code” do not establish that encoding a typed membership number works. |

Nectar's encoded barcode data can differ from the full membership number printed
elsewhere on the card. Enter the actual barcode data; the app does not invent a
prefix or convert a membership number. A [firsthand GS1-128 variant report](https://github.com/brarcher/loyalty-card-locker/issues/299)
also exists. GS1-128/FNC1 is not reproduced by the current plain Code128 encoder;
that variant remains unverified/unsupported, not silently claimed equivalent.
[Nectar's own help](https://help.nectar.com/help/faqs/qr-code) describes both QR and
barcode versions in its app, so the default is not a claim about all digital cards.

“Change format” remains available for confirmed defaults. Choosing an unconfirmed
brand shows the picker automatically. Existing saved cards retain their format.
Physical-phone scanner acceptance is still required before release. No provider
account, login, card-number lookup or points-balance API was used.
