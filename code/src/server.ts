/*
  Run the Express backend for this project.
*/
import "dotenv/config";
import express from "express";

// Return the service status for health checks.
export function getHealthStatus() {
  return { ok: true };
}

export const app = express();
const port = Number(process.env.PORT ?? 3001);

// Respond to a simple health-check request.
app.get("/api/health", (_request, response) => {
  response.json(getHealthStatus());
});

// Start the server outside the unit-test process.
if (!process.env.VITEST) {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}
