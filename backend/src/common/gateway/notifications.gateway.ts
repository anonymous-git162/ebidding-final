import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok-free.dev')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/ws',
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      const userId = payload.sub;
      client.data.userId = userId;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      console.log(`Client connected: ${client.id} (user: ${userId})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    client.join(data.room);
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { room: string }) {
    client.leave(data.room);
  }

  sendToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  sendToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  sendNotification(userId: string, notification: { id: string; title: string; message: string; link?: string }) {
    this.sendToUser(userId, 'notification', notification);
  }

  sendProcurementUpdate(procurementId: string, data: { status: string; title: string; updatedBy: string }) {
    this.server.to(`procurement:${procurementId}`).emit('procurement:update', data);
  }

  sendBulkNotification(userIds: string[], notification: { id: string; title: string; message: string; link?: string }) {
    userIds.forEach(userId => this.sendNotification(userId, notification));
  }
}
