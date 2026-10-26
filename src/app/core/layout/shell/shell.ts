import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
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
 * Renders the sidebar navigation, the sticky toolbar, and the
 * router-outlet for page content. The shell is the parent route
 * component and is always visible after the user has authenticated.
 *
 * Admin navigation items (Users, Roles, Permissions) are shown
 * conditionally based on AuthService.isAdmin(), a computed signal
 * derived from the current user's roles. This is a display-only
 * guard -- route access is also protected by adminGuard.
 *
 * The logout button calls AuthService.logout(); navigation to /login
 * is done here (not in the service) because services must not contain
 * UI or navigation logic.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatMenuModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  // inject() replaces constructor injection in Angular 21
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Whether the application is currently in dark mode.
   *
   * Initialised from the OS preference via matchMedia so the toolbar
   * icon already reflects the active theme on first render, before the
   * user has toggled anything. The signal is then kept in sync by
   * toggleTheme(). Using window.matchMedia is safe here because the
   * Shell only runs in a browser context (no SSR in this project).
   */
  readonly darkMode = signal(window.matchMedia('(prefers-color-scheme: dark)').matches);

  /** Exposes isAdmin as a signal for the template @if block. */
  readonly isAdmin = this.authService.isAdmin;

  /**
   * The currently authenticated user, forwarded from AuthService.
   *
   * Exposed directly so the template can read user.firstName / user.email
   * without going through the service reference, keeping the template
   * independent of the service's public API shape.
   */
  readonly currentUser = this.authService.currentUser;

  /**
   * One or two upper-case initials derived from the current user's name.
   *
   * Used in the profile avatar button when no photo is available. Falls
   * back to '?' if the user signal has not yet been populated (e.g. while
   * the me query is in-flight on startup).
   *
   * @returns A one- or two-character string, always upper-case.
   */
  readonly userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '?';
    const first = u.firstName?.charAt(0) ?? '';
    const last = u.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase() || '?';
  });

  /** Navigation items rendered in the sidebar main section. */
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
   * Toggles between light and dark themes.
   *
   * Sets data-theme on the root element so that :root[data-theme="dark"]
   * overrides the prefers-color-scheme media query. Once the user picks
   * a theme explicitly it stays until toggled again, regardless of OS.
   *
   * @returns void
   */
  toggleTheme(): void {
    this.darkMode.update((v) => !v);
    document.documentElement.dataset['theme'] = this.darkMode() ? 'dark' : 'light';
  }

  /**
   * Signs the current user out.
   *
   * Calls AuthService.logout() which invalidates the token server-side
   * and clears local state. Navigation to /login is done here in the
   * component because service code must not trigger navigation.
   *
   * @returns void
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}
