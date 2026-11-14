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

import { Auth } from '../../auth/auth';

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
 * - Reads Auth signals to display the signed-in username and token sub.
 * - Exposes a logout() method for the sign-out button.
 *
 * displayName, initials, userRole and isAdmin are derived from Auth.claims()
 * on this branch. They are enriched on feature/auth once AuthService is
 * available to provide the full user profile and role list.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(Auth);
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
   * Reads the sub claim (username) from the decoded JWT. Falls back to
   * 'User' while the token is absent. Replaced on feature/auth with the
   * user's first name from AuthService.
   *
   * @returns username string, or 'User' when unauthenticated.
   */
  protected readonly displayName = computed(
    () => this.auth.claims()?.sub ?? 'User',
  );

  /**
   * Two uppercase characters for the avatar circle in the toolbar.
   *
   * @returns e.g. "AL" for sub "alice", or "U" before load.
   */
  protected readonly initials = computed(
    () => this.auth.claims()?.sub?.slice(0, 2).toUpperCase() ?? 'U',
  );

  /**
   * Primary role label shown below the display name in the toolbar.
   *
   * Always 'User' on this branch; replaced with the first JWT role on
   * feature/auth once AuthService exposes the roles signal.
   *
   * @returns role name string.
   */
  protected readonly userRole = computed(() => 'User');

  /**
   * Email shown in the profile dropdown header.
   *
   * Always '--' on this branch; replaced with currentUser.email on
   * feature/auth once AuthService is available.
   *
   * @returns email string.
   */
  protected readonly sessionEmail = computed(() => '--');

  /**
   * Whether the authenticated user holds the ADMIN role.
   *
   * Always false on this branch; replaced with authService.isAdmin() on
   * feature/auth once AuthService is wired.
   *
   * @returns boolean.
   */
  protected readonly isAdmin = computed(() => false);

  /**
   * Clears the local session and navigates to the login page.
   *
   * On this branch, logout is implemented directly by clearing the tokens
   * via Auth.setTokens(). On feature/auth this is replaced with a full
   * GraphQL mutation through AuthService that also invalidates the server
   * session before clearing local state.
   */
  protected logout(): void {
    this.auth.setTokens(null, null);
    void this.router.navigate(['/auth/login']);
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
    { label: 'Users',       icon: 'manage_accounts', route: '/users' },
    { label: 'Roles',       icon: 'shield',          route: '/roles' },
    { label: 'Permissions', icon: 'lock_open',       route: '/permissions' },
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
