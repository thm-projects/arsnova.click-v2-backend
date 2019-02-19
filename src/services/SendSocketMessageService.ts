import * as WebSocket from 'ws';

export class SendSocketMessageService {
  public static sendMessage(socket: WebSocket, message): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(JSON.stringify(message));
    } catch (e) {
      console.error('Cannot send message to socket', e);
    }
  }
}
