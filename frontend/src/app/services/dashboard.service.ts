import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { DashboardSummary } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  // GET api/dashboard/summary (not /api/admin: the Day 17 middleware blocks that path)
  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${API_BASE_URL}/dashboard/summary`);
  }
}