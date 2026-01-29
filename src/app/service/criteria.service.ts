import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginService } from './login.service';

export interface MainCriteria {
  _id: string;
  name: string;
  level: 'ALL' | 'SECTOR' | 'DEPARTMENT';
  sector?: {
    _id: string;
    name: string;
  };
  departmentUser?: {
    _id: string;
    fullname: string;
    username: string;
  };
  subCriteria?: SubCriteria[];
  createdAt?: string;
  
}

export interface SubCriteria {
  _id: string;
  name: string;
  mainCriteria: string | MainCriteria;
  userId?: {
    _id: string;
    fullname: string;
    username: string;
    role: string;
  };
  createdAt?: string;
}

export interface AddMainCriteriaRequest {
  name: string;
  level: 'ALL' | 'SECTOR' | 'DEPARTMENT';
  sector?: string;
  departmentUser?: string;
}

export interface Department {
  _id: string;
  fullname: string;
  username: string;
  sector?: string; 
  sectorId?: string; 
  sectorInfo?: {
    _id: string;
    name: string;
  };
}

export interface Sector {
  _id: string;
  name: string;
}

export interface AddSubCriteriaRequest {
  name: string;
  mainCriteria: string;
}

@Injectable({
  providedIn: 'root',
})
export class CriteriaService {
  private apiUrl = 'http://localhost:3000/api/criteria';
  private usersUrl = 'http://localhost:3000/api/users';

  constructor(private http: HttpClient, private loginService: LoginService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${token}`,
    });
  }

  addMainCriteria(
    criteriaData: AddMainCriteriaRequest
  ): Observable<MainCriteria> {
    return this.http.post<MainCriteria>(
      `${this.apiUrl}/add-main-criteria`,
      criteriaData,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getAllMainCriteria(): Observable<MainCriteria[]> {
    return this.http.get<MainCriteria[]>(`${this.apiUrl}/all-main-criteria`, {
      headers: this.getAuthHeaders(),
    });
  }

  updateMainCriteriaPartial(updateData: any): Observable<MainCriteria> {
    const id = updateData.id;

    return this.http.put<MainCriteria>(
      `${this.apiUrl}/update-main-criteria/${id}`,
      updateData,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  deleteMainCriteria(id: string): Observable<MainCriteria> {
    return this.http.delete<MainCriteria>(
      `${this.apiUrl}/delete-main-criteria/${id}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  addSubCriteria(
    subCriteriaData: AddSubCriteriaRequest
  ): Observable<SubCriteria> {
    return this.http.post<SubCriteria>(
      `${this.apiUrl}/add-sub-criteria`,
      subCriteriaData,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getAllSubCriteria(): Observable<SubCriteria[]> {
    return this.http.get<SubCriteria[]>(`${this.apiUrl}/all-sub-criteria`, {
      headers: this.getAuthHeaders(),
    });
  }

  updateSubCriteria(id: string, name: string): Observable<SubCriteria> {
    return this.http.put<SubCriteria>(
      `${this.apiUrl}/update-sub-criteria/${id}`,
      { name },
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  deleteSubCriteria(id: string): Observable<SubCriteria> {
    return this.http.delete<SubCriteria>(
      `${this.apiUrl}/delete-sub-criteria/${id}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getAllDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.usersUrl}/all-users`, {
      headers: this.getAuthHeaders(),
    });
  }

  getAllSectors(): Observable<{ success: boolean; data: Sector[] }> {
    return this.http.get<{ success: boolean; data: Sector[] }>(
      `${this.usersUrl}/all-sectors`,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getDepartmentsBySector(sectorId: string): Observable<Department[]> {
    return this.http.get<Department[]>(
      `${this.usersUrl}/departments-by-sector/${sectorId}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }
}
