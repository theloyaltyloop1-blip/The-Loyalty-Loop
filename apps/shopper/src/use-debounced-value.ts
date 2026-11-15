import * as React from 'react'

/** Value that follows `value` after it has been still for `ms` (stops filtering on every keystroke). */
export function useDebouncedValue<T>(value: T, ms = 150): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}
