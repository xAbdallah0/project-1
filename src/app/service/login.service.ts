import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, Observable, tap, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
import { Router } from '@angular/router';
import {
  User,
  LoginCredentials,
  LoginResponse,
  DecodedToken,
} from '../model/user';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private readonly userKey = 'userData';
  private readonly tokenKey = 'token';
  private readonly roleKey = 'userRole';
  private readonly apiUrl = 'http://localhost:3000/api';

  private userBehaviorSubject = new BehaviorSubject<User | null>(
    this.getUserFromLocalStorage()
  );
  user$ = this.userBehaviorSubject.asObservable();

  private loggedIn = new BehaviorSubject<boolean>(
    !!localStorage.getItem(this.tokenKey)
  );
  isLoggedIn$ = this.loggedIn.asObservable();

  private userRole = new BehaviorSubject<string | null>(
    this.getUserRoleFromStorage()
  );
  userRole$ = this.userRole.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const savedUser = this.getUserFromLocalStorage();
    if (savedUser) {
      this.userBehaviorSubject.next(savedUser);
      this.loggedIn.next(true);
      this.userRole.next(savedUser.role);
    }
  }

  hasPermission(permission: string): boolean {
    const userRole = this.getUserRole();

    const permissions: { [key: string]: string[] } = {
      admin: [
        'manage_users',
        'manage_criteria',
        'view_archive',
        'view_dashboard',
        'access_admin_dashboard',
      ],
      user: ['view_dashboard', 'access_user_dashboard'],
    };

    return permissions[userRole!]?.includes(permission) || false;
  }

  canManageUsers(): boolean {
    return this.hasPermission('manage_users');
  }

  canManageCriteria(): boolean {
    return this.hasPermission('manage_criteria');
  }

  canViewArchive(): boolean {
    return this.hasPermission('view_archive');
  }

  canViewDashboard(): boolean {
    return this.hasPermission('view_dashboard');
  }

  isAdmin(): boolean {
    return this.getUserRole() === 'admin';
  }

  isUser(): boolean {
    return this.getUserRole() === 'user';
  }

  redirectBasedOnRole(): void {
    const userRole = this.getUserRole();

    if (userRole === 'admin') {
      this.router.navigate(['/dashboard-admin']);
    } else if (userRole === 'user') {
      this.router.navigate(['/dashboard-admin']);
    } else {
      this.router.navigate(['/']);
    }
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response: LoginResponse) => {
          if (response.token) {
            localStorage.setItem(this.tokenKey, response.token);

            if (response.user) {
              this.setUser(response.user);
              localStorage.setItem(this.roleKey, response.user.role);
              this.userRole.next(response.user.role);
            }

            this.loggedIn.next(true);

            this.redirectBasedOnRole();
          }
        }),
        catchError((error: unknown) => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.roleKey);
    this.userBehaviorSubject.next(null);
    this.loggedIn.next(false);
    this.userRole.next(null);
    this.router.navigate(['/login']);
  }

  getUserRole(): string | null {
    return this.userRole.value;
  }

  getUserRoleFromStorage(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  getCurrentUser(): User | null {
    return this.userBehaviorSubject.value;
  }

  decodeToken(): DecodedToken | null {
    const token = this.getTokenFromLocalStorage();
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        return decoded;
      } catch (error) {
        console.error('Invalid token:', error);
        return null;
      }
    }
    return null;
  }

  getUserFromLocalStorage(): User | null {
    const userDataStr = localStorage.getItem(this.userKey);
    if (!userDataStr || userDataStr === 'undefined') return null;

    try {
      return JSON.parse(userDataStr) as User;
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error);
      return null;
    }
  }

  setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    localStorage.setItem(this.roleKey, user.role);
    this.userBehaviorSubject.next(user);
    this.userRole.next(user.role);
    this.loggedIn.next(true);
  }

  getTokenFromLocalStorage(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      if (!decoded.exp) {
        return true;
      }
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }
}
