import { toast } from 'sonner'

/** Run an event/effect task with a visible fallback for unexpected failures. */
export function runTask(task: unknown, message = 'That action could not be completed. Please try again.'): void {
  void Promise.resolve(task).catch(() => { toast.error(message) })
}

/** Preserve event arguments while keeping React callbacks synchronous. */
export function handleTask<Args extends unknown[]>(task: (...args: Args) => unknown): (...args: Args) => void {
  return (...args) => { runTask(task(...args)) }
}
