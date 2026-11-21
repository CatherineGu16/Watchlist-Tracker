/**
 * Group names this app used before it followed Marvel's and Disney+'s own: titles you added and
 * filters you saved may still carry them, so they're read as the name that replaced them.
 */
const RENAMED: Record<string, string> = {
  'X-Men': 'Fox X-Men',
  'Spider-Man': 'Sony Spider-Man',
  'Classic Marvel': 'Classic films',
}

export const currentSagaName = (saga: string) => RENAMED[saga] ?? saga
