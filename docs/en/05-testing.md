# Testing

The project uses [Vitest](https://vitest.dev/) as the test runner, configured via
`ng test`. Tests are co-located with their source files (`*.spec.ts`) and use Angular's
`TestBed` to set up the dependency injection context.

---

## Why ApolloTestingModule (not HttpTestingController)

In a REST project, Angular services that use `HttpClient` are tested with
`provideHttpClientTesting()` and `HttpTestingController`. In this project, services use
Apollo, which has its own testing module: `ApolloTestingModule` from
`apollo-angular/testing`.

`ApolloTestingModule` replaces the real Apollo client with a controller that lets tests
define exactly what the server would have returned, without making a real HTTP request.

```typescript
// test setup
TestBed.configureTestingModule({
  providers: [
    CategoriesService,
    provideApolloTesting(), // replaces the real Apollo client
  ],
});

const controller = TestBed.inject(ApolloTestingController);
const service    = TestBed.inject(CategoriesService);
```

```typescript
// in a test
it('should return the category list', (done) => {
  service.getCategories({ page: 0, size: 10 }).subscribe(result => {
    expect(result.categories.content).toHaveLength(2);
    done();
  });

  // flush the pending operation with mock data
  const op = controller.expectOne('GetCategories');
  op.flush({
    data: {
      categories: {
        content: [
          { id: '1', categoryName: 'Drinks' },
          { id: '2', categoryName: 'Food' },
        ],
        totalElements: 2,
        totalPages: 1,
      },
    },
  });

  controller.verify(); // assert no unexpected operations were sent
});
```

The types for `op.flush()` come from the generated `graphql.ts` file. Never use hand-typed
string literals for field names; use the generated interfaces so a schema change will cause
a TypeScript error in the test, not a silent mismatch.

---

## Testing services

A service test file has this structure:

```typescript
describe('CategoriesService', () => {
  let service: CategoriesService;
  let controller: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CategoriesService, provideApolloTesting()],
    });
    service    = TestBed.inject(CategoriesService);
    controller = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => controller.verify());

  it('should load paginated categories', /* ... */);
  it('should create a category and return it', /* ... */);
  it('should propagate AppError on BUSINESS_RULE response', /* ... */);
});
```

Cover these cases for every service method:

1. **Happy path**: the server returns expected data, the observable emits the mapped result.
2. **Error path**: the server returns an error, the observable errors with the correct
   `AppError.kind`.

---

## Testing error mapping

`error-mapper.ts` has unit tests that cover every `ErrorKind` without involving a real HTTP
request. These are plain Jest-style tests (no `TestBed` needed):

```typescript
describe('mapToAppError', () => {
  it('maps BAD_REQUEST to VALIDATION', () => {
    const error = new ApolloError({
      graphQLErrors: [{
        message: 'Validation failed',
        extensions: { classification: 'BAD_REQUEST', status: 400 },
      }],
    });
    expect(mapToAppError(error).kind).toBe('VALIDATION');
  });
});
```

Write one test per status code. These tests run in milliseconds and catch regressions when
the backend changes its error format.

---

## Testing guards

Guards are functions, so they are easy to test with `TestBed` and a mock `AuthService`:

```typescript
describe('authGuard', () => {
  it('redirects to /auth/login when not authenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardComponent }]),
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
      ],
    });
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() => {
      const result = authGuard(mockRoute, mockState('/dashboard'));
      expect(result).toEqual(router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: '/dashboard' },
      }));
    });
  });
});
```

---

## Testing components

Component tests use `TestBed` with Angular Material's testing harnesses, which interact
with components through their public API (labels, buttons) rather than DOM selectors that
break on refactoring.

```typescript
it('should disable submit while loading', async () => {
  // arrange: set up TestBed with the component
  const fixture  = TestBed.createComponent(CategoryFormDialog);
  const harness  = await TestbedHarnessEnvironment.harnessForFixture(
    fixture, MatDialogHarness
  );

  // act: simulate a submission in progress
  fixture.componentInstance.loading.set(true);
  fixture.detectChanges();

  // assert: the submit button is disabled
  const button = await harness.getButtonWithText('Save');
  expect(await button.isDisabled()).toBe(true);
});
```

For dialogs, provide `MAT_DIALOG_DATA` with mock data to simulate the "edit" case:

```typescript
providers: [
  { provide: MAT_DIALOG_DATA, useValue: { id: '1', categoryName: 'Drinks' } },
  { provide: MatDialogRef, useValue: { close: jest.fn() } },
]
```

---

## Testing subscriptions

Subscription tests flush events through the `ApolloTestingController` and assert that the
component's state signal updates correctly:

```typescript
it('should increment newOrderCount when a subscription event arrives', () => {
  const op = controller.expectOne('OrderCreated');
  op.flush({ data: { orderCreated: { id: '99', /* ... */ } } });

  expect(component.newOrderCount()).toBe(1);
});
```

---

## Running the tests

```bash
npm test          # run all tests once
npm test -- --watch  # watch mode (re-runs on file save)
```

A clean run should show no failures. Fix every failing test before opening a pull request.
