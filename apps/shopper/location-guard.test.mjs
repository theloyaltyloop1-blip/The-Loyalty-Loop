import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// A try/catch around require('expo-location') cannot stop a missing native module
// crashing the app: Metro reports the failed load as fatal. The loader must check
// that the native module exists before it ever requires the package.
test('expo-location is only required after its native module is confirmed present', () => {
  const source = readFileSync(new URL('./src/use-user-location.ts', import.meta.url), 'utf8')
  const check = source.indexOf("requireOptionalNativeModule('ExpoLocation')")
  const load = source.indexOf("require('expo-location')")
  assert.ok(check !== -1, 'the native module check is missing')
  assert.ok(load !== -1, 'the package require is missing')
  assert.ok(check < load, 'the native module check must come before the require')
})
