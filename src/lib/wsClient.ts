type MessageHandler = (type: string, payload: any) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: MessageHandler;
  private onStatusChange: (connected: boolean) => void;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    token: string,
    onMessage: MessageHandler,
    onStatusChange: (connected: boolean) => void,
  ) {
    const wsBase = import.meta.env.DEV ? "ws://localhost:3001" : "wss://api.mistlauncher.com";
    this.url = `${wsBase}/ws?token=${token}`;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    if (this.destroyed) return;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.onStatusChange(true);
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type && msg.payload !== undefined) {
            this.onMessage(msg.type, msg.payload);
          }
        } catch {
          // ignore malformed messages
        }
      };
      this.ws.onclose = () => {
        this.onStatusChange(false);
        if (!this.destroyed) this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        // errors are followed by onclose, handled there
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  send(type: string, payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
