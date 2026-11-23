import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../api.config';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    // Logged in, with a token
    const auth = TestBed.inject(AuthService);
    (auth as unknown as { session: { set(v: unknown): void } }).session.set({
      token: 'abc.def.ghi', expiresAt: new Date(Date.now() + 60_000).toISOString(),
      customer: { id: 1, fullName: 'Priya Nair', email: 'priya@example.com', mobile: '', role: 'Customer' }
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function authorizationFor(url: string): string | null {
    http.post(url, {}).subscribe();
    const req = backend.expectOne(url);
    const header = req.request.headers.get('Authorization');
    req.flush({});
    return header;
  }

  it.each(['change-password', 'me'])('sends the token to /auth/%s', path => {
    expect(authorizationFor(`${API_BASE_URL}/auth/${path}`)).toBe('Bearer abc.def.ghi');
  });

  it.each(['login', 'register', 'forgot-password', 'reset-password'])('never sends it to the sign-in call /auth/%s', path => {
    expect(authorizationFor(`${API_BASE_URL}/auth/${path}`)).toBeNull();
  });

  it('sends it to other API calls but never to other websites', () => {
    expect(authorizationFor(`${API_BASE_URL}/orders/mine`)).toBe('Bearer abc.def.ghi');
    expect(authorizationFor('https://example.com/api/thing')).toBeNull();
  });
});
