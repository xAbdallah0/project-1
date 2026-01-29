import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, Sector } from '../model/user';

@Injectable({
  providedIn: 'root',
})
export class AdministrationService {
  private baseUrl = 'http://localhost:3000/api/users';

  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `${token}` });
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/all-users`, {
      headers: this.getAuthHeaders(),
    });
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/user/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  addUser(user: User): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/add-user`, user, {
      headers: this.getAuthHeaders(),
    });
  }

  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/update-user/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  updateUserStatus(
    id: string,
    status: 'active' | 'inactive'
  ): Observable<User> {
    return this.http.put<User>(
      `${this.baseUrl}/update-status/${id}`,
      { status },
      { headers: this.getAuthHeaders() }
    );
  }

  deleteUser(id: string): Observable<User> {
    return this.http.delete<User>(`${this.baseUrl}/delete-user/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getStats(): Observable<{
    success: boolean;
    data: { totalUsers: number; activeUsers: number; inactiveUsers: number };
  }> {
    return this.http.get<{
      success: boolean;
      data: { totalUsers: number; activeUsers: number; inactiveUsers: number };
    }>(`${this.baseUrl}/stats`, { headers: this.getAuthHeaders() });
  }

  addSector(sector: Sector): Observable<Sector> {
    return this.http.post<Sector>(
      `${this.baseUrl}/add-sector`,
      { sector: sector.sector },
      { headers: this.getAuthHeaders() }
    );
  }

  getAllSectors(): Observable<{ success: boolean; data: Sector[] }> {
    return this.http.get<{ success: boolean; data: Sector[] }>(
      `${this.baseUrl}/all-sectors`,
      { headers: this.getAuthHeaders() }
    );
  }

  updateSector(
    id: string,
    updateData: Partial<Sector>
  ): Observable<{ success: boolean; data: Sector }> {
    return this.http.put<{ success: boolean; data: Sector }>(
      `${this.baseUrl}/update-sector/${id}`,
      updateData,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteSector(id: string): Observable<{ success: boolean; data: Sector }> {
    return this.http.delete<{ success: boolean; data: Sector }>(
      `${this.baseUrl}/delete-sector/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  filterBySector(
    sector: string
  ): Observable<{ success: boolean; data: User[] }> {
    return this.http.get<{ success: boolean; data: User[] }>(
      `${this.baseUrl}/filter?sector=${sector}`,
      { headers: this.getAuthHeaders() }
    );
  }

  searchUsers(q: string): Observable<{ success: boolean; data: User[] }> {
    return this.http.get<{ success: boolean; data: User[] }>(
      `${this.baseUrl}/search?q=${q}`,
      { headers: this.getAuthHeaders() }
    );
  }

  sortUsers(
    sortBy: keyof User,
    sortOrder: 'asc' | 'desc'
  ): Observable<{ success: boolean; data: User[] }> {
    return this.http.get<{ success: boolean; data: User[] }>(
      `${this.baseUrl}/sort?sortBy=${sortBy}&sort=${sortOrder}`,
      { headers: this.getAuthHeaders() }
    );
  }
}
