import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import * as ioClient from 'socket.io-client'; 

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: Date;
  read?: boolean; 
  userId?: string;
  actionUrl?: string;
}
@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: any;
  private readonly apiUrl = 'http://localhost:3000/api'; 

  constructor() {
    this.socket = ioClient.connect(this.apiUrl, {
      transports: ['websocket', 'polling'],
    });
  }

  connect(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  joinUserRoom(userId: string): void {
    this.socket.emit('join_user_room', userId);
  }

  onNotification(): Observable<Notification> {
    return new Observable<Notification>((observer) => {
      this.socket.on('notification', (data: Notification) => {
        observer.next(data);
      });
      return () => this.socket.off('notification');
    });
  }

  onConnect(): Observable<void> {
    return new Observable<void>((observer) => {
      this.socket.on('connect', () => observer.next());
    });
  }

  onDisconnect(): Observable<void> {
    return new Observable<void>((observer) => {
      this.socket.on('disconnect', () => observer.next());
    });
  }

  emitEvent(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }

  onEvent(eventName: string): Observable<any> {
    return new Observable<any>((observer) => {
      this.socket.on(eventName, (data: any) => observer.next(data));
      return () => this.socket.off(eventName);
    });
  }
}
