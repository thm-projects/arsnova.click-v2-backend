import * as WebSocket from 'ws';

export class SendSocketMessageService {
  public static sendMessage(socket: WebSocket, message): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  }
}
