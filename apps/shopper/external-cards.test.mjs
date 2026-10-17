import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkedNumber, barcodeSvg, FORMATS, BRANDS, BRAND_DEFAULT_FORMATS, brandFormatChoice } from './src/external-card-barcode.ts';
import { createCardCache } from './src/external-card-cache.ts';

test('only evidenced brand defaults hide the picker; other and unconfirmed brands remain editable', () => {
 assert.deepEqual(brandFormatChoice('nectar'),{format:'code128',showPicker:false});
 for(const [brand] of BRANDS) {
  const choice=brandFormatChoice(brand);
  assert.ok(FORMATS.includes(choice.format));
  if(!BRAND_DEFAULT_FORMATS[brand]) assert.deepEqual(choice,{format:'code128',showPicker:true});
 }
 assert.deepEqual(brandFormatChoice('unknown'),{format:'code128',showPicker:true});
 // A selection/new-card reset must discard a previous manual override.
 assert.deepEqual(brandFormatChoice('nectar'),{format:'code128',showPicker:false});
});

test('validates full checksums, strips whitespace and never exposes encoder input', () => {
 assert.equal(checkedNumber('4006 3813 33931','ean13'),'4006381333931');
 for(const format of ['ean13','ean8','upc_a','itf14']) assert.throws(()=>checkedNumber('12345678',format));
 assert.throws(()=>checkedNumber('4006381333932','ean13'),/check digit/);
 assert.throws(()=>checkedNumber('SECRET-INVALID*','code39'),error=>!error.message.includes('SECRET'));
 assert.throws(()=>checkedNumber('ab\u0000cd','code128'));
});
test('all supported formats produce SVG locally', () => {
 const inputs={ean13:'4006381333931',ean8:'96385074',upc_a:'036000291452',itf14:'10012345000017',code128:'1234567890',code39:'ABC123',qr:'ABCD1234',pdf417:'ABCD1234'};
 for(const format of FORMATS) assert.match(barcodeSvg(inputs[format],format),/<svg/);
});
test('cache isolates owners, serializes writes and clears all slots after sign-out', async () => {
 const values=new Map();
 const store={getItemAsync:async k=>values.get(k)??null,setItemAsync:async(k,v)=>{values.set(k,v)},deleteItemAsync:async k=>{values.delete(k)}};
 const cache=createCardCache(store);
 const a={id:'a',user_id:'a',card_number:'1234'};
 await cache.write('a',[a]);
 assert.deepEqual(await cache.read('b'),[]);
 assert.deepEqual(await cache.read('a'),[a]);
 const pending=cache.write('a',[a]);const clear=cache.clear('a');
 await Promise.all([pending,clear]);
 assert.deepEqual(await cache.read('a'),[]);
  await cache.write('a',[a]); // Late network response after sign-out is discarded.
  assert.deepEqual(await cache.read('a'),[]);
  cache.activate('a');
 await cache.write('a',[a]); await cache.write('a',[]);
 assert.equal(values.size,0);
});
