import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/service/notification.service';
import { Notification } from 'src/app/model/notification';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/app/environments/environments';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css'],
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  isLoading = false;
  showNotificationsModal = false;
  activeFilter: string = 'all';
  unreadCount = 0;

  private notificationsSubscription!: Subscription;
  private socket!: Socket;

  constructor(
    private notificationService: NotificationService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.notificationService.fetchNotificationsFromServer();
    this.connectSocket();
  }

  ngOnDestroy(): void {
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  connectSocket(): void {
    // ✅ socketUrl مش apiUrl — ده كان سبب Invalid namespace
    this.socket = io(environment.socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);

      // ✅ registerUser جوه connect عشان الـ socket يكون جاهز
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
    });

    this.socket.on('newNotification', (notification: Notification) => {
      console.log('🔔 New notification received:', notification);
      const exists = this.notifications.some((n) => n._id === notification._id);
      if (!exists) {
        this.notifications = [notification, ...this.notifications];
        this.updateFilteredNotifications();
        this.updateUnreadCount();
        this.toastr.info(notification.message, 'إشعار جديد', {
          timeOut: 4000,
          positionClass: 'toast-top-right',
        });
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('Socket connection error:', err.message);
    });
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.notificationsSubscription = this.notificationService.notifications$.subscribe({
      next: (data) => {
        this.notifications = data;
        this.updateFilteredNotifications();
        this.updateUnreadCount();
        this.isLoading = false;
        console.log('Notifications loaded:', this.notifications);
      },
      error: (err) => {
        console.error('خطأ أثناء تحميل الإشعارات:', err);
        this.toastr.error('حدث خطأ أثناء تحميل الإشعارات', 'خطأ');
        this.isLoading = false;
      },
    });
  }

  updateUnreadCount(): void {
    this.unreadCount = this.notifications.filter((n) => !n.read).length;
  }

  openNotificationsModal(): void {
    this.showNotificationsModal = true;
    this.notificationService.fetchNotificationsFromServer();
  }

  closeNotificationsModal(): void {
    this.showNotificationsModal = false;
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.updateFilteredNotifications();
  }

  updateFilteredNotifications(): void {
    if (this.activeFilter === 'all') {
      this.filteredNotifications = this.notifications;
    } else if (this.activeFilter === 'unread') {
      this.filteredNotifications = this.notifications.filter((n) => !n.read);
    } else {
      this.filteredNotifications = this.notifications.filter(
        (n) => n.type === this.activeFilter
      );
    }
  }

  markAsReadAndDelete(_id: string): void {
    this.notificationService.markAsRead(_id).subscribe({
      next: (updatedNotif: Notification) => {
        const index = this.notifications.findIndex((n) => n._id === _id);
        if (index !== -1) {
          this.notifications[index] = updatedNotif;
        }
        this.notificationService.deleteNotification(_id).subscribe({
          next: () => {
            this.notifications = this.notifications.filter((n) => n._id !== _id);
            this.updateUnreadCount();
            this.updateFilteredNotifications();
            this.toastr.success('تم تعليم الإشعار كمقروء وحذفه بنجاح', 'تم بنجاح');
          },
          error: (err) => {
            console.error('خطأ أثناء حذف الإشعار:', err);
            this.toastr.error('حدث خطأ أثناء حذف الإشعار', 'خطأ');
          },
        });
      },
      error: (err) => {
        console.error('خطأ أثناء التعليم كمقروء:', err);
        this.toastr.error('حدث خطأ أثناء تعليم الإشعار كمقروء', 'خطأ');
      },
    });
  }

  markAllAsReadAndDelete(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notificationService.clearAllNotifications().subscribe({
          next: () => {
            this.notifications = [];
            this.updateUnreadCount();
            this.updateFilteredNotifications();
            this.toastr.success('تم تعليم جميع الإشعارات كمقروءة وحذفها جميعاً', 'تم بنجاح');
          },
          error: (err) => {
            console.error('خطأ أثناء حذف جميع الإشعارات:', err);
            this.toastr.error('حدث خطأ أثناء حذف جميع الإشعارات', 'خطأ');
          },
        });
      },
      error: (err) => {
        console.error('خطأ أثناء تعليم الكل كمقروء:', err);
        this.toastr.error('حدث خطأ أثناء تعليم جميع الإشعارات كمقروءة', 'خطأ');
      },
    });
  }

  hasUnreadNotifications(): boolean {
    return this.notifications.some((n) => !n.read);
  }

  isRead(notification: Notification): boolean {
    return !!notification.read;
  }

  getTypeLabel(type: string): string {
    const map: any = {
      info: 'معلومة',
      warning: 'تحذير',
      success: 'نجاح',
      error: 'خطأ',
    };
    return map[type] || 'أخرى';
  }

  getNotificationIcon(type: string): string {
    const icons: any = {};
    return icons[type] || '🔔';
  }

  formatTimeAgo(timestamp?: string): string {
    if (!timestamp) return '';
    const now = new Date().getTime();
    const time = new Date(timestamp).getTime();
    const diff = Math.floor((now - time) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `${Math.floor(diff / 60)} د`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
    return `${Math.floor(diff / 86400)} يوم`;
  }

  refreshNotifications(): void {
    this.isLoading = true;
    this.notificationService.fetchNotificationsFromServer();
  }
}