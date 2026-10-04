import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pickFeatured as web} from '../../web/src/lib/distance.ts';
import {pickFeatured as shopper} from '../../shopper/src/distance.ts';

const shop=(id,lat=null,lng=null)=>({id,lat,lng});
const visit=(business_id,visit_count,last_activity_at=null)=>({business_id,visit_count,last_activity_at});
// Manchester Piccadilly Gardens
const here={lat:53.4808,lng:-2.2374};
const near=shop('near',53.482,-2.236);
const far=shop('far',53.6,-2.5);
const nopin=shop('nopin');

for (const [name,pickFeatured] of [['website',web],['phone app',shopper]]) {
 test(`${name}: the most visited shop wins, even when it is far away`,()=>{
  const picked=pickFeatured([near,far],[visit('near',2),visit('far',9)],here);
  assert.deepEqual([picked.shop.id,picked.reason],['far','visited']);
 });
 test(`${name}: shops with no visits are not "most visited"`,()=>{
  const picked=pickFeatured([near,far],[visit('far',0)],here);
  assert.deepEqual([picked.shop.id,picked.reason],['near','closest']);
 });
 test(`${name}: with no visits it is the closest shop that has a pin`,()=>{
  const picked=pickFeatured([nopin,far,near],[],here);
  assert.deepEqual([picked.shop.id,picked.reason],['near','closest']);
 });
 test(`${name}: equal visits go to the closer shop, then the more recent one`,()=>{
  assert.equal(pickFeatured([far,near],[visit('far',4),visit('near',4)],here).shop.id,'near');
  const a=shop('a'),b=shop('b');
  assert.equal(pickFeatured([a,b],[visit('a',4,'2026-09-01T00:00:00Z'),visit('b',4,'2026-10-01T00:00:00Z')],null).shop.id,'b');
 });
 test(`${name}: visit history works without a location`,()=>{
  const picked=pickFeatured([near,far],[visit('near',3)],null);
  assert.deepEqual([picked.shop.id,picked.reason],['near','visited']);
 });
 test(`${name}: nothing to go on returns null so Trending can take over`,()=>{
  assert.equal(pickFeatured([near,far],[],null),null);
  assert.equal(pickFeatured([nopin],[],here),null);
  assert.equal(pickFeatured([],[visit('x',5)],here),null);
 });
 test(`${name}: it does not change the list it is given`,()=>{
  const shops=[far,near];
  pickFeatured(shops,[visit('far',1)],here);
  assert.deepEqual(shops.map(s=>s.id),['far','near']);
 });
}
