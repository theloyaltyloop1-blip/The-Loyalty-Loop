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

// Walk-past alerts need expo-task-manager, which store builds before 1.0.3 lack.
test('walk-past only requires location and task manager after both native modules are confirmed', () => {
  const source = readFileSync(new URL('./src/walk-past.ts', import.meta.url), 'utf8')
  const checkLocation = source.indexOf("requireOptionalNativeModule('ExpoLocation')")
  const checkTasks = source.indexOf("requireOptionalNativeModule('ExpoTaskManager')")
  const firstRequire = Math.min(source.indexOf("require('expo-location')"), source.indexOf("require('expo-task-manager')"))
  assert.ok(checkLocation !== -1 && checkTasks !== -1, 'a native module check is missing')
  assert.ok(Math.max(checkLocation, checkTasks) < firstRequire, 'both checks must come before any require')
  assert.ok(!/^import .* from 'expo-(location|task-manager)'/m.test(source), 'no static import of the optional packages')
})
