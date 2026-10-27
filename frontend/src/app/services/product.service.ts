import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
   import { PhotoUpload, Product, ProductSave } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/products`;

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

   create(product: ProductSave): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  update(id: number, product: ProductSave): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, product);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // NEW (4D): send one photo to the API (admins only; the interceptor adds the token).
  // FormData = the same format a browser uses to upload a file. The field name 'photo'
  // must match the C# parameter name: UploadPhoto(IFormFile? photo).
  // observe: 'events' + reportProgress: true give "uploaded so far" events while it travels,
  // then a final Response event that carries { url }.
  uploadPhoto(file: File): Observable<HttpEvent<PhotoUpload>> {
    const body = new FormData();
    body.append('photo', file);
    return this.http.post<PhotoUpload>(`${this.apiUrl}/photo`, body, {
      reportProgress: true,
      observe: 'events'
    });
  }
}
