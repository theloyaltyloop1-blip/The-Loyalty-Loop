import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as web from '../../web/src/lib/reward-qr.ts';
import * as shopper from '../../shopper/src/reward-qr.ts';
import * as retailer from '../../retailer/src/reward-qr.ts';

const token='0123456789abcdef0123456789abcdef';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('the three copies are identical',()=>{
 const w=src('../../web/src/lib/reward-qr.ts');
 assert.equal(src('../../shopper/src/reward-qr.ts'),w);
 assert.equal(src('../../retailer/src/reward-qr.ts'),w);
});

for (const [name,m] of [['website',web],['shopper',shopper],['retailer',retailer]]) {
 test(`${name}: generated code round-trips through the scanner`,()=>{
  assert.equal(m.encodeRewardQr(token),`loyaltyloop:reward:${token}`);
  assert.equal(m.parseRewardQr(m.encodeRewardQr(token)),token);
 });
 test(`${name}: legacy raw token is still accepted`,()=>{
  assert.equal(m.parseRewardQr(token),token);
  assert.equal(m.parseRewardQr(`  ${token.toUpperCase()}\n`),token);
 });
 test(`${name}: non-reward codes are rejected`,()=>{
  assert.equal(m.parseRewardQr('loyaltyloop:customer:abc'),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:reward:loyaltyloop:reward:${token}`),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:reward:loyaltyloop:customer:${token}`),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:customer:${token}`),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:reward:${token}extra`),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:reward:${token.slice(1)}`),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:reward:${token}:${token}`),null);
  assert.equal(m.parseRewardQr(`loyaltyloop:reward:${'z'.repeat(32)}`),null);
  assert.equal(m.parseRewardQr(`${token}${token}`),null);
  assert.equal(m.parseRewardQr(`LOYALTYLOOP:REWARD:${token}`),null);
  assert.equal(m.parseRewardQr('loyaltyloop:reward:'),null);
  assert.equal(m.parseRewardQr('https://example.com'),null);
  assert.equal(m.parseRewardQr('abc123'),null);
  assert.equal(m.parseRewardQr(''),null);
 });
}

test('every surface uses the helper (no hand-built prefix or raw token QR)',()=>{
 assert.match(src('../../web/src/pages/Rewards.tsx'),/encodeRewardQr\(reward\.qr_token\)/);
 assert.match(src('../../web/src/pages/owner/Scan.tsx'),/parseRewardQr\(/);
 assert.match(src('../../shopper/App.tsx'),/encodeRewardQr\(reward\.qr_token\)/);
 assert.match(src('../../retailer/App.tsx'),/parseRewardQr\(/);
});
