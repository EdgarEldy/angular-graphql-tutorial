import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth-interceptor';
import { Auth } from './auth';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let authService: Auth;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(Auth);
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  it('adds Authorization header when a token is present', () => {
    authService.setToken('my-jwt-token');
    http.get('/graphql').subscribe();
    const req = controller.expectOne('/graphql');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
    req.flush({});
  });

  it('does not add Authorization header when no token is present', () => {
    http.get('/graphql').subscribe();
    const req = controller.expectOne('/graphql');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('passes the request through unchanged when no token', () => {
    http.get('/api/public').subscribe();
    const req = controller.expectOne('/api/public');
    expect(req.request.url).toBe('/api/public');
    req.flush({});
  });
});
