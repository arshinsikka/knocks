import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // Try WebSocket first — avoids the polling→WS upgrade disconnect that
      // would otherwise flash the reconnect banner on every page load.
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      randomizationFactor: 0.5,
    });
  }
  console.log(`Socket: ${socket.connected ? 'reusing existing' : 'creating new'}`);
  return socket;
}

/** Fully tears down the socket — call when intentionally leaving all rooms. */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
