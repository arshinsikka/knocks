import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // WebSocket only — skip polling entirely to avoid upgrade-related
      // brief disconnects and to reduce server load.
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      forceNew: false,
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
