import assert from 'node:assert/strict';
import {test} from 'node:test';
import {trendingShops as web} from '../../web/src/lib/trending.ts';
import {trendingShops as shopper} from '../../shopper/src/trending.ts';

const shop=(id,trending=false,trending_position=null,category='Café')=>({id,trending,trending_position,category});
const ids=list=>list.map(s=>s.id);

for (const [name,trendingShops] of [['website',web],['phone app',shopper]]) {
 test(`${name}: no admin picks keeps the first shops`,()=>{
  const all=[shop('a'),shop('b'),shop('c'),shop('d'),shop('e')];
  assert.deepEqual(ids(trendingShops(all,all,{fallback:2})),['a','b']);
  assert.deepEqual(ids(trendingShops(all,all,{fallback:4,limit:4})),['a','b','c','d']);
 });
 test(`${name}: admin picks show in the admin's order`,()=>{
  const all=[shop('a'),shop('b',true,3),shop('c',true,1),shop('d'),shop('e',true,2)];
  assert.deepEqual(ids(trendingShops(all,all,{fallback:2})),['c','e','b']);
  assert.deepEqual(ids(trendingShops(all,all,{fallback:4,limit:2})),['c','e']);
 });
 test(`${name}: trending without an admin position is ignored (owner self-promotion)`,()=>{
  const all=[shop('a'),shop('b'),shop('owner',true,null)];
  assert.deepEqual(ids(trendingShops(all,all,{fallback:2})),['a','b']);
  const mixed=[shop('a'),shop('owner',true,null),shop('pick',true,1)];
  assert.deepEqual(ids(trendingShops(mixed,mixed,{fallback:2})),['pick']);
 });
 test(`${name}: filters apply to picks, and no matching picks hides Trending`,()=>{
  const all=[shop('a'),shop('b',true,1,'Barber'),shop('c',true,2)];
  const cafes=all.filter(s=>s.category==='Café');
  assert.deepEqual(ids(trendingShops(all,cafes,{fallback:2})),['c']);
  const barbersWithoutPicks=[shop('x',false,null,'Barber')];
  assert.deepEqual(trendingShops(all,barbersWithoutPicks,{fallback:2}),[]);
 });
}
