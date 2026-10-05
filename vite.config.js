import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O build gera um único dist/index.html com JS, CSS e dados embutidos.
// Assim o mesmo artefato roda na Vercel e também abrindo o arquivo
// localmente (file://), sem servidor.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 5000,
  },
});
