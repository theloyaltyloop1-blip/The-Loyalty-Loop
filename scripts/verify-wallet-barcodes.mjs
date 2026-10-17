// Local independent decoder check. Runtime packages are tooling, not app deps.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { barcodeSvg } from '../apps/shopper/src/external-card-barcode.ts';
const runtime = createRequire(`${process.argv[2]}/package.json`);
const sharp = runtime('sharp');
const web = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { RGBLuminanceSource, BinaryBitmap, HybridBinarizer, MultiFormatReader } = web('@zxing/library');
for (const [format, number] of [['ean13','4006381333931'], ['code128','1234567890123456']]) {
 const svg = barcodeSvg(number, format);
 const { data, info } = await sharp(Buffer.from(svg)).resize(320,170,{fit:'contain',background:'#ffffff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pixels = new Int32Array(info.width * info.height);
 for(let i=0;i<pixels.length;i++) pixels[i]=(data[i*3]<<16)|(data[i*3+1]<<8)|data[i*3+2];
 const source=new RGBLuminanceSource(pixels, info.width, info.height);
 const reader=new MultiFormatReader(); reader.setHints(new Map()); const result=reader.decode(new BinaryBitmap(new HybridBinarizer(source)));
 assert.equal(result.getText(),number);
 console.log(`${format}: independent decode passed at 320 x 170`);
}
