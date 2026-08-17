import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const KEY = 'loyalty_loop_business_biometric_lock'

export async function biometricLockEnabled() { return (await SecureStore.getItemAsync(KEY)) === 'true' }

export async function setBiometricLock(enabled: boolean) {
  if (!enabled) { await SecureStore.deleteItemAsync(KEY); return { success: true } }
  if (Platform.OS === 'web' || !(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) {
    return { success: false, error: 'Set up Face ID, Touch ID or a fingerprint in your device settings first.' }
  }
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on business app lock', promptDescription: 'Confirm to protect The Loyalty Loop for Business.', biometricsSecurityLevel: 'strong' })
  if (!result.success) return { success: false, error: 'Biometric confirmation was not completed.' }
  await SecureStore.setItemAsync(KEY, 'true')
  return { success: true }
}

export async function unlockWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock The Loyalty Loop for Business', promptDescription: 'Use Face ID, Touch ID or your fingerprint.', biometricsSecurityLevel: 'strong' })
  return result.success
}
