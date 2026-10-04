import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as webLib from '../../web/src/lib/distance.ts';
import * as shopperLib from '../../shopper/src/distance.ts';
import {readFileSync} from 'node:fs';

const shop=(id,lat,lng)=>({id,lat,lng});
const ids=list=>list.map(r=>r.shop.id);
// Manchester Piccadilly Gardens
const here={lat:53.4808,lng:-2.2374};

test('the website and phone app copies are identical',()=>{
 assert.equal(readFileSync(new URL('../../web/src/lib/distance.ts',import.meta.url),'utf8'),readFileSync(new URL('../../shopper/src/distance.ts',import.meta.url),'utf8'));
});

for (const [name,{nearestFirst,milesBetween,formatMiles}] of [['website',webLib],['phone app',shopperLib]]) {
 test(`${name}: distances are about right`,()=>{
  assert.equal(milesBetween(here,here),0);
  const london=milesBetween(here,{lat:51.5074,lng:-0.1278});
  assert.ok(london>160&&london<170,`Manchester to London was ${london}`);
 });
 test(`${name}: nearest shop comes first`,()=>{
  const shops=[shop('far',53.6,-2.5),shop('near',53.482,-2.236),shop('mid',53.52,-2.3)];
  assert.deepEqual(ids(nearestFirst(shops,here)),['near','mid','far']);
 });
 test(`${name}: shops without a usable pin go last, in their original order`,()=>{
  const shops=[shop('nopin',null,null),shop('far',53.6,-2.5),shop('zero',0,0),shop('near',53.482,-2.236),shop('bad',NaN,1),shop('undef',undefined,undefined)];
  const ranked=nearestFirst(shops,here);
  assert.deepEqual(ids(ranked),['near','far','nopin','zero','bad','undef']);
  assert.equal(ranked[2].miles,null);
 });
 test(`${name}: equal distances keep their original order`,()=>{
  const shops=[shop('b',53.49,-2.24),shop('a',53.49,-2.24)];
  assert.deepEqual(ids(nearestFirst(shops,here)),['b','a']);
 });
 test(`${name}: it does not change the list it is given`,()=>{
  const shops=[shop('far',53.6,-2.5),shop('near',53.482,-2.236)];
  nearestFirst(shops,here);
  assert.deepEqual(shops.map(s=>s.id),['far','near']);
 });
 test(`${name}: miles read naturally`,()=>{
  assert.equal(formatMiles(0.03),'Under 0.1 mi');
  assert.equal(formatMiles(0.4),'0.4 mi');
  assert.equal(formatMiles(9.96),'10 mi');
  assert.equal(formatMiles(12.4),'12 mi');
 });
}
