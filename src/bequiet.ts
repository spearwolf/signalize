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
