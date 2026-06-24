import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Notification } from '../model/notification';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private socket!: Socket;
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private API_URL = environment.apiUrl + '/notifications';

  constructor(private http: HttpClient) {
    this.initializeNotifications();
  }

  private initializeNotifications(): void {
    this.requestNotificationPermission();
    this.fetchNotificationsFromServer();
    this.initializeSocketConnection();
  }

  private initializeSocketConnection(): void {
    this.socket = io(environment.socketUrl, {
      transports: ['websocket', 'polling'],
    });

    // ✅ registerUser بعد الـ connect مباشرة عشان نضمن إن الـ socket جاهز
    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server:', this.socket.id);

      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user._id) {
            this.socket.emit('registerUser', user._id);
            console.log('✅ Registered user room:', user._id);
          }
        } catch (e) {
          console.error('خطأ في قراءة بيانات المستخدم:', e);
        }
      }

      this.fetchNotificationsFromServer();
    });

    // ✅ المشكلة الأساسية كانت هنا — الباك بيبعت 'newNotification' مش 'notification'
    this.socket.on('newNotification', (notification: Notification) => {
      console.log('🔔 newNotification received:', notification);
      this.addNotification(notification);
      this.showBrowserNotification('إشعار جديد', notification.message);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('Socket connection error:', err.message);
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${token}`,
    });
  }

  fetchNotificationsFromServer(): void {
    this.http
      .get<Notification[]>(this.API_URL, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (data: any) => {
          // ✅ الباك ممكن يرجع { notifications: [...] } أو array مباشرة
          const notifications = Array.isArray(data)
            ? data
            : data.notifications ?? [];
          console.log('Fetched notifications:', notifications);
          this.notificationsSubject.next(notifications);
        },
        error: (err) => console.error('Error fetching notifications:', err),
      });
  }

  requestNotificationPermission(): void {
    if ('Notification' in window) {
      window.Notification.requestPermission();
    }
  }

  private showBrowserNotification(title: string, message: string): void {
    if (
      'Notification' in window &&
      window.Notification.permission === 'granted'
    ) {
      new window.Notification(title, { body: message });
    }
  }

  addNotification(notification: Notification): void {
    const current = this.notificationsSubject.value;
    // ✅ تجنب التكرار
    const exists = current.some((n) => n._id === notification._id);
    if (!exists) {
      this.notificationsSubject.next([notification, ...current]);
    }
  }

  markAsRead(notificationId: string) {
    return this.http.post<Notification>(
      `${this.API_URL}/${notificationId}`,
      { seen: true },
      { headers: this.getAuthHeaders() }
    );
  }

  markAllAsRead() {
    return this.http.put(
      `${this.API_URL}/markAllRead`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  deleteNotification(notificationId: string) {
    return this.http.delete(`${this.API_URL}/${notificationId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  clearAllNotifications() {
    return this.http.delete(`${this.API_URL}/clearAll`, {
      headers: this.getAuthHeaders(),
    });
  }

  sendTestNotification() {
    return this.http.post<Notification>(
      `${this.API_URL}/test`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}