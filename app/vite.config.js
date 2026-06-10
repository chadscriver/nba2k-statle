import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the same build works on
// Vercel/Netlify (served at root) and GitHub Pages (served under a subpath).
export default defineConfig({
  plugins: [react()],
  base: './',
});
