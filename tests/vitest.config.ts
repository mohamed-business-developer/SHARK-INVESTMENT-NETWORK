import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: {
    noExternal: ['server-only'],
    resolve: {
      conditions: ['react-server', 'node', 'import', 'default'],
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    server: {
      deps: {
        inline: ['server-only'],
      },
    },
  },
});
