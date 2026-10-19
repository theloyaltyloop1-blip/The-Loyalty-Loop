import { useEffect, useState } from 'react'
import * as Updates from 'expo-updates'

// Give up and open the current version if the check is slow or offline.
const LAUNCH_UPDATE_TIMEOUT_MS = 6000

// On a cold start, fetch any newer published update and reload into it, so a
// fresh store install opens on the latest version instead of the embedded one.
// Returns true while the check is running.
export function useLaunchUpdate(): boolean {
  const [checking, setChecking] = useState(!__DEV__ && Updates.isEnabled)

  useEffect(() => {
    if (!checking) return
    let done = false
    const finish = () => { if (!done) { done = true; setChecking(false) } }
    const timer = setTimeout(finish, LAUNCH_UPDATE_TIMEOUT_MS)

    ;(async () => {
      try {
        const check = await Updates.checkForUpdateAsync()
        if (!check.isAvailable) return
        const fetched = await Updates.fetchUpdateAsync()
        // Past the timeout the user is already in the app; the new update
        // applies on the next launch instead of yanking the screen away.
        if (fetched.isNew && !done) {
          done = true
          await Updates.reloadAsync()
        }
      } catch {
        // Offline or server error: carry on with the current version.
      } finally {
        clearTimeout(timer)
        done = true
        setChecking(false)
      }
    })()

    return () => clearTimeout(timer)
  }, [])

  return checking
}
