import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../auth/auth.service';

/** A single item in the navigation sidebar. */
interface NavItem {
  /** Human-readable label shown next to the icon. */
  label: string;
  /** Material icon ligature name (outlined variant). */
  icon: string;
  /** Angular router path, e.g. '/categories'. */
  route: string;
}

/**
 * Application shell: dark sidebar + sticky toolbar + router-outlet.
 *
 * Responsibilities:
 * - Renders the persistent two-column layout (248 px sidebar + fluid main area).
 * - Provides dark/light theme toggling: the active theme is written as a
 *   data-theme attribute on html so that CSS custom properties in styles.scss
 *   react without any JavaScript color math.
 * - Manages the profile dropdown: opened by clicking the avatar button,
 *   dismissed by clicking anywhere else via a document:click HostListener.
 * - Derives the toolbar page title reactively from the current URL signal.
 * - Reads AuthService signals to display the signed-in user's name and role,
 *   and exposes a logout() method for the sign-out button.
 * - Hides the Administration sidebar section from non-admin users via isAdmin().
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ── Theme ──────────────────────────────────────────────────────────────────

  /**
   * Tracks whether dark mode is currently active.
   *
   * Seeded from the OS preference so the first render already matches
   * the user's system theme without waiting for a manual toggle.
   */
  protected readonly darkMode = signal(
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  /**
   * Reflects the darkMode signal onto html[data-theme] as a side effect.
   *
   * Using effect() rather than an imperative write inside toggleTheme()
   * keeps the DOM attribute in sync even if darkMode were mutated elsewhere.
   */
  constructor() {
    effect(() => {
      document.documentElement.setAttribute(
        'data-theme',
        this.darkMode() ? 'dark' : 'light',
      );
    });
  }

  /**
   * Toggle between dark and light mode.
   *
   * The DOM mutation happens in the effect() above; this method only flips
   * the signal value, keeping the template handler minimal.
   */
  protected toggleTheme(): void {
    this.darkMode.update((v) => !v);
  }

  // ── Profile dropdown ───────────────────────────────────────────────────────

  /** Whether the profile dropdown menu is currently visible. */
  protected readonly profileOpen = signal(false);

  /**
   * Toggle the profile dropdown open or closed.
   *
   * event.stopPropagation() prevents the click from bubbling to the
   * document-level listener that would immediately close the dropdown.
   *
   * @param event - Native click event from the profile button.
   */
  protected toggleProfile(event: MouseEvent): void {
    event.stopPropagation();
    this.profileOpen.update((v) => !v);
  }

  /**
   * Close the profile dropdown when the user clicks anywhere outside it.
   *
   * Registered on document so it fires for every click on the page.
   * Clicks on the profile button itself are stopped from bubbling by
   * toggleProfile(), so they never reach this handler.
   */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.profileOpen.set(false);
  }

  // ── Auth integration ───────────────────────────────────────────────────────

  /**
   * Display name shown in the toolbar profile button.
   *
   * Prefers first_name, falls back to username, then 'User' while the
   * me query is still in-flight on startup.
   *
   * @returns display name string.
   */
  protected readonly displayName = computed(() => {
    const u = this.authService.currentUser();
    if (!u) return 'User';
    return u.firstName ?? u.email.split('@')[0];
  });

  /**
   * Two uppercase characters for the avatar circle in the toolbar.
   *
   * Built from firstName + lastName initials when available, otherwise
   * the first two characters of the email local-part.
   *
   * @returns e.g. "JD" for John Doe, or "JO" for john@example.com.
   */
  protected readonly initials = computed(() => {
    const u = this.authService.currentUser();
    if (!u) return 'U';
    const first = u.firstName?.charAt(0) ?? '';
    const last = u.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase() || u.email.slice(0, 2).toUpperCase();
  });

  /**
   * Primary role label shown below the display name in the toolbar.
   *
   * @returns the first role name, e.g. "ADMIN" or "USER", or 'User' when empty.
   */
  protected readonly userRole = computed(
    () => this.authService.currentUser()?.roles?.[0]?.roleName ?? 'User',
  );

  /**
   * Email shown in the profile dropdown header.
   *
   * @returns email string or '--' when not yet loaded.
   */
  protected readonly sessionEmail = computed(
    () => this.authService.currentUser()?.email ?? '--',
  );

  /**
   * Whether the authenticated user holds the ADMIN role.
   *
   * Forwarded from AuthService which derives it from the session's role list.
   */
  protected readonly isAdmin = this.authService.isAdmin;

  /**
   * Logs out the current user and navigates to /auth/login.
   *
   * AuthService.logout() calls the GraphQL mutation to invalidate the token
   * server-side, then clears the local session unconditionally. Navigation
   * happens in the subscribe callback so guards re-evaluate only after the
   * session has been cleared.
   */
  protected logout(): void {
    this.authService.logout().subscribe(() => {
      void this.router.navigate(['/auth/login']);
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  /** Main navigation items shown in the "Menu" section of the sidebar. */
  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard',  icon: 'dashboard',   route: '/dashboard' },
    { label: 'Categories', icon: 'category',     route: '/categories' },
    { label: 'Products',   icon: 'inventory_2',  route: '/products' },
    { label: 'Customers',  icon: 'people',       route: '/customers' },
    { label: 'Orders',     icon: 'receipt_long', route: '/orders' },
  ];

  /** Admin-only items: rendered only when isAdmin() is true. */
  protected readonly adminItems: NavItem[] = [
    { label: 'Users', icon: 'manage_accounts', route: '/users' },
    { label: 'Roles', icon: 'shield',          route: '/roles' },
  ];

  // ── Page title ─────────────────────────────────────────────────────────────

  /**
   * Current URL as a signal, refreshed on every NavigationEnd event.
   *
   * startWith seeds the signal with the router's current URL on first
   * render, before any NavigationEnd event has fired.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Toolbar title derived from the active route.
   *
   * Searches both nav sections for a route that is a prefix of the active
   * URL. Falls back to 'Dashboard' for unrecognised or root paths.
   *
   * @returns The human-readable page name to display in the toolbar.
   */
  protected readonly pageTitle = computed(() => {
    const url = this.currentUrl() ?? '/';
    const all = [...this.navItems, ...this.adminItems];
    return (
      all.find(
        (item) => url === item.route || url.startsWith(item.route + '/'),
      )?.label ?? 'Dashboard'
    );
  });
}
