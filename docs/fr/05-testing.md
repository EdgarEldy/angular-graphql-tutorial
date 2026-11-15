# Tests

Le projet utilise [Vitest](https://vitest.dev/) comme exécuteur de tests, configuré via
`ng test`. Les tests sont co-localisés avec leurs fichiers sources (`*.spec.ts`) et
utilisent le `TestBed` d'Angular pour configurer le contexte d'injection de dépendances.

---

## Pourquoi ApolloTestingModule (et pas HttpTestingController) ?

Dans un projet REST, les services Angular qui utilisent `HttpClient` sont testés avec
`provideHttpClientTesting()` et `HttpTestingController`. Dans ce projet, les services
utilisent Apollo, qui dispose de son propre module de test : `ApolloTestingModule` depuis
`apollo-angular/testing`.

`ApolloTestingModule` remplace le vrai client Apollo par un contrôleur qui permet aux
tests de définir exactement ce que le serveur aurait retourné, sans faire de vraie requête
HTTP.

```typescript
// Configuration du test
TestBed.configureTestingModule({
  providers: [
    CategoriesService,
    provideApolloTesting(), // remplace le vrai client Apollo
  ],
});

const controller = TestBed.inject(ApolloTestingController);
const service    = TestBed.inject(CategoriesService);
```

```typescript
// Dans un test
it('should return the category list', (done) => {
  service.getCategories({ page: 0, size: 10 }).subscribe(result => {
    expect(result.categories.content).toHaveLength(2);
    done();
  });

  // Répondre à l'opération en attente avec des données mock
  const op = controller.expectOne('GetCategories');
  op.flush({
    data: {
      categories: {
        content: [
          { id: '1', categoryName: 'Boissons' },
          { id: '2', categoryName: 'Nourriture' },
        ],
        totalElements: 2,
        totalPages: 1,
      },
    },
  });

  controller.verify(); // vérifier qu'aucune opération inattendue n'a été envoyée
});
```

Les types pour `op.flush()` viennent du fichier `graphql.ts` généré. N'utilisez jamais de
littéraux de chaîne écrits à la main pour les noms de champs ; utilisez les interfaces
générées pour qu'un changement de schéma provoque une erreur TypeScript dans le test, pas
une divergence silencieuse.

---

## Tester les services

Un fichier de test de service a cette structure :

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

Couvrez ces cas pour chaque méthode de service :

1. **Happy path** : le serveur retourne les données attendues, l'observable émet le résultat
   mappé.
2. **Error path** : le serveur retourne une erreur, l'observable émet une erreur avec le bon
   `AppError.kind`.

---

## Tester le mappeur d'erreurs

`error-mapper.ts` a des tests unitaires qui couvrent chaque `ErrorKind` sans impliquer de
vraie requête HTTP. Ce sont des tests simples de style Jest (pas de `TestBed` nécessaire) :

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

Écrivez un test par code de statut. Ces tests s'exécutent en quelques millisecondes et
détectent les régressions quand le backend change son format d'erreur.

---

## Tester les guards

Les guards sont des fonctions, donc ils sont faciles à tester avec `TestBed` et un mock
d'`AuthService` :

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

## Tester les composants

Les tests de composants utilisent `TestBed` avec les harnais de test d'Angular Material,
qui interagissent avec les composants via leur API publique (libellés, boutons) plutôt que
des sélecteurs DOM qui se cassent lors des refactorisations.

```typescript
it('should disable submit while loading', async () => {
  const fixture  = TestBed.createComponent(CategoryFormDialog);
  const harness  = await TestbedHarnessEnvironment.harnessForFixture(
    fixture, MatDialogHarness
  );

  fixture.componentInstance.loading.set(true);
  fixture.detectChanges();

  const button = await harness.getButtonWithText('Enregistrer');
  expect(await button.isDisabled()).toBe(true);
});
```

Pour les dialogs, fournissez `MAT_DIALOG_DATA` avec des données mock pour simuler le cas
"modification" :

```typescript
providers: [
  { provide: MAT_DIALOG_DATA, useValue: { id: '1', categoryName: 'Boissons' } },
  { provide: MatDialogRef, useValue: { close: jest.fn() } },
]
```

---

## Tester les subscriptions

Les tests de subscriptions envoient des événements via `ApolloTestingController` et vérifient
que le signal d'état du composant se met à jour correctement :

```typescript
it('should increment newOrderCount when a subscription event arrives', () => {
  const op = controller.expectOne('OrderCreated');
  op.flush({ data: { orderCreated: { id: '99', /* ... */ } } });

  expect(component.newOrderCount()).toBe(1);
});
```

---

## Lancer les tests

```bash
npm test          # lancer tous les tests une fois
npm test -- --watch  # mode veille (relance à chaque sauvegarde)
```

Une exécution propre ne doit montrer aucun échec. Corrigez chaque test en échec avant
d'ouvrir une pull request.
