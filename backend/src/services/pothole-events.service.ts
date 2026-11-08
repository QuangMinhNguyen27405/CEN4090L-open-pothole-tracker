import type { Response } from "express";

const clients = new Set<Response>();
const KEEPALIVE_INTERVAL_MS = 15_000;

export function subscribeToPotholeUpdates(response: Response) {
  clients.add(response);
  response.write(": connected\n\n");

  const keepalive = setInterval(() => {
    response.write(": keep-alive\n\n");
  }, KEEPALIVE_INTERVAL_MS);

  const unsubscribe = () => {
    clearInterval(keepalive);
    clients.delete(response);
  };
  response.on("close", unsubscribe);
  response.on("error", unsubscribe);

  return unsubscribe;
}

export function publishPotholeUpdate() {
  const event = `data: ${JSON.stringify({ type: "potholes.updated" })}\n\n`;
  for (const client of clients) {
    if (client.writableEnded || client.destroyed) {
      clients.delete(client);
    } else {
      client.write(event);
    }
  }
}
