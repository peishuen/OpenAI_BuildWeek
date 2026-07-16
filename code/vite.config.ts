/*
  Configure Vite, the tool that runs and builds the React frontend.
  Forward future /api requests to the local Express server instead of treating them as frontend routes.
*/
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
