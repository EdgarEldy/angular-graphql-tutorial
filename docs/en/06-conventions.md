# Code conventions

The conventions below apply to every file in the project. They exist to keep the codebase
consistent so a student can read any feature and immediately recognise the patterns. When
in doubt, look at an existing feature (e.g. `categories`) as the reference implementation.

---

## Angular 21 idioms

Angular 21 introduced features that replace older APIs. This project uses them exclusively.
Never use the older alternatives even if they technically still work.

| New (use this) | Old (do not use) | Why it changed |
|---|---|---|
| Standalone components (`standalone: true` default) | `@NgModule` declarations | Modules added indirection with no benefit for small apps |
| `input()`, `output()`, `model()` signals | `@Input()`, `@Output()` decorators | Signals are synchronous, type-safe and composable |
| `@if`, `@for`, `@switch` control flow | `*ngIf`, `*ngFor`, `*ngSwitch` | Built-in control flow has better performance and simpler syntax |
| `inject()` | Constructor injection | Works in factories, interceptors and guards that have no constructor |
| `ChangeDetectionStrategy.OnPush` | Default | OnPush skips checks when inputs have not changed, improving performance |
| `takeUntilDestroyed()` | Manual `ngOnDestroy` + `Subject` | Less boilerplate; works with `DestroyRef` injection |

---

## TypeScript

**Strict mode is non-negotiable.** The `tsconfig.json` enables `strict: true`. Every type
error is a real error; fix it instead of suppressing it.

**No `any`.**  
When you receive an `unknown` value (e.g. from a catch block), narrow it with a type guard:
```typescript
// Wrong
} catch (e: any) { console.log(e.message); }

// Right
} catch (e) {
  const message = e instanceof Error ? e.message : 'Unknown error';
}
```

**No non-null assertions (`!`).**  
Use optional chaining or a conditional instead:
```typescript
// Wrong
const name = user!.firstName;

// Right
const name = user?.firstName ?? 'Unknown';
```

**IDs are strings.**  
GraphQL IDs come as strings from the server. Never parse them to numbers. Never compare
them with `==` (use `===`).

---

## Angular CLI

Generate every file type that has a schematic. The CLI creates the spec file and registers
the file consistently. Never create Angular files by hand.

| File to create | Command |
|---|---|
| Routed page component | `ng g component features/<name>/pages/<slug> --type=page` |
| Dialog component | `ng g component features/<name>/dialogs/<slug> --type=dialog` |
| Presentational component | `ng g component features/<name>/components/<slug>` |
| Feature service | `ng g service features/<name>/data/<name>` |
| Core service | `ng g service core/<folder>/<name>` |
| Guard | `ng g guard core/auth/<name> --functional` |
| Interceptor | `ng g interceptor core/<folder>/<name>` |

> **Angular 21 naming:** the CLI no longer appends `.component.ts` or `.service.ts` to new
> files. A service generated as `categories` produces `categories.ts` with class `Categories`.
> Guards keep their `.guard.ts` suffix.

---

## Reactive forms

Always use **typed reactive forms** (`FormGroup<{ field: FormControl<T> }>`). Never use the
untyped `FormGroup` without generics.

```typescript
// Wrong
form = new FormGroup({ name: new FormControl('') });

// Right
form = new FormGroup({
  categoryName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
});
```

Put validators on the control, not in the template. The template only reads error state:

```html
<mat-error @if="form.controls.categoryName.hasError('required')">
  Category name is required.
</mat-error>
```

Disable the submit button while the form is submitting:

```html
<button mat-flat-button [disabled]="loading()" type="submit">Save</button>
```

---

## Templates

**All form fields use `mat-form-field appearance="outline"`.**  
This is the visual standard for the whole application. Never use a different appearance.

**Dialog form fields get `.full-width`.**  
Add this class to every `mat-form-field` inside a dialog so it spans the full dialog width:

```scss
// In the dialog SCSS file
.full-width {
  width: 100%;
  display: block;
}
```

```html
<mat-form-field appearance="outline" class="full-width">
  <mat-label>Category name</mat-label>
  <input matInput formControlName="categoryName" />
</mat-form-field>
```

**No logic in templates.**  
Template expressions only read signals and call helper methods. They do not compute values:

```html
<!-- Wrong: computation in template -->
{{ items().filter(i => i.active).length }}

<!-- Right: computed signal in the class -->
{{ activeCount() }}
```

---

## Services

A feature service (`categories.ts`, `products.ts`, etc.) is a pure Apollo wrapper:

- One method per GraphQL operation (`getCategories()`, `createCategory()`, etc.).
- Returns a typed `Observable`.
- Never injects `MatSnackBar`, `Router`, `MatDialog`, or any UI service.
- Never throws manually; lets Apollo errors propagate.

---

## Dialogs

Every create/edit form is a `MatDialog` dialog:

1. Inject `MAT_DIALOG_DATA` and `MatDialogRef` with `inject()`.
2. Pre-fill the form from the data (empty for create, the entity for edit).
3. Call the feature service on submit.
4. On success: `this.dialogRef.close(savedEntity)`.
5. On `BUSINESS_RULE` or `CONFLICT` error: show `appError.message` inline, keep dialog open.
6. On `FORBIDDEN` error: show snackbar, close dialog.

---

## Commits

Every commit follows the Conventional Commits format:

```
type(scope): short summary in imperative mood

Body paragraph one: why this change was needed (the constraint or decision).

Body paragraph two: the technical approach or tradeoff.
```

Rules (see `docs/commit-convention` for the full list):

- One file per commit.
- Body is required (2-3 paragraphs).
- No em dashes. English only. No AI attribution.
- Commit immediately after finishing a file, not in a batch at the end.
