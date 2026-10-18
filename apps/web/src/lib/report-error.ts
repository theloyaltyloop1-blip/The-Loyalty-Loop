/** Central sink for errors from fire-and-forget async work. */
export function reportError(error: unknown) {
  console.error(error)
}
