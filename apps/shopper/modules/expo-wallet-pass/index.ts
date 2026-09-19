import { Platform } from 'react-native'

/** Presents iOS's native full-screen "Add to Apple Wallet" screen (PKAddPassesViewController)
 * for a .pkpass file, given as base64. iOS-only — throws if called on another platform. */
export async function addPassFromBase64(base64: string): Promise<void> {
  if (Platform.OS !== 'ios') throw new Error('Apple Wallet is only available on iOS')
  const { requireNativeModule } = await import('expo-modules-core')
  const ExpoWalletPassModule = requireNativeModule('ExpoWalletPass')
  await ExpoWalletPassModule.addPass(base64)
}
