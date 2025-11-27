let g_numberOfBeQuietRequests = 0;

export function beQuiet(action: () => any): void {
  g_numberOfBeQuietRequests++;
  try {
    action();
  } finally {
    g_numberOfBeQuietRequests--;
  }
}

export function isQuiet(): boolean {
  return g_numberOfBeQuietRequests > 0;
}

export function getBeQuietCount(): number {
  return g_numberOfBeQuietRequests;
}

export function clearBeQuiet(): void {
  g_numberOfBeQuietRequests = 0;
}

export function restoreBeQuiet(count: number): void {
  g_numberOfBeQuietRequests = count;
}
