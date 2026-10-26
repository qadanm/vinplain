import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'expo-modules-core': path.resolve(__dirname, 'tests/mocks/expo-modules-core.ts'),
      'vinplain': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
