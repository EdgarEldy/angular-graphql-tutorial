import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../auth/auth.service';

/**
 * A single sidenav link definition.
 */
interface NavItem {
  label: string;
  icon: string;
  route: string;
}

/**
 * Application shell (persistent layout).
 *
 * Renders the top toolbar, side navigation, and the `<router-outlet>` for
 * page content. The shell is the parent route component in app.routes.ts and
 * is always visible after the user has authenticated.
 *
 * Admin navigation items (Users, Roles, Permissions) are shown conditionally
 * based on `AuthService.isAdmin()`, a computed signal derived from the current
 * user's roles. This is a display-only guard -- route access is also protected
 * by adminGuard in app.routes.ts.
 *
 * The logout button calls `AuthService.logout()`, which invalidates the token
 * server-side, clears local state, and then navigates to `/login`. Navigation
 * is handled here (not in the service) because services must not contain
 * UI or navigation logic.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  // inject() replaces constructor injection in Angular 21
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly sidenavOpen = signal(true);

  /** Exposes isAdmin as a signal for the template @if block. */
  readonly isAdmin = this.authService.isAdmin;

  readonly navItems: NavItem[] = [
    { label: 'Categories', icon: 'category', route: '/categories' },
    { label: 'Products', icon: 'inventory_2', route: '/products' },
    { label: 'Customers', icon: 'people', route: '/customers' },
    { label: 'Orders', icon: 'shopping_cart', route: '/orders' },
  ];

  /** Nav items shown only to admin users. */
  readonly adminNavItems: NavItem[] = [
    { label: 'Users', icon: 'manage_accounts', route: '/users' },
    { label: 'Roles', icon: 'admin_panel_settings', route: '/roles' },
    { label: 'Permissions', icon: 'security', route: '/roles/permissions' },
  ];

  /**
   * Toggles the sidenav between open and closed states.
   *
   * Uses signal.update() to derive the next state from the current value without reading
   * the signal outside the reactive context -- this is the idiomatic Signals pattern for
   * a boolean toggle (equivalent to setState(prev => !prev) in React).
   */
  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  /**
   * Signs the current user out.
   *
   * Calls AuthService.logout() which invalidates the token server-side and
   * clears local state. Navigation to /login is done here in the component
   * because service code must not trigger navigation -- that would couple the
   * service to the router and make it harder to test.
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}
