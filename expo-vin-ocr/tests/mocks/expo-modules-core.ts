let lines: string[] = [];
let calls: string[] = [];

export function requireNativeModule<T>(_name: string): T {
  return {
    async recognizeText(uri: string) {
      calls.push(uri);
      return lines;
    },
  } as T;
}

export function __setLines(next: string[]) {
  lines = next;
}

export function __calls() {
  return calls;
}
