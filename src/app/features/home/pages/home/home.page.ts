import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../../../core/auth/auth';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Home page -- the application landing screen (route: /).
 *
 * Acts as a hub that surfaces the most useful information at a glance:
 * - Four KPI cards (Categories, Products, Customers, Orders) whose values
 *   are placeholder strings until downstream feature branches wire live totals.
 * - Quick-access tiles for every feature section including RBAC admin screens.
 * - A session-info panel driven by AuthService and Auth signals, requiring no
 *   extra API call beyond the restoreSession() call made by the app initialiser.
 *
 * AuthService owns the typed user object (currentUser, roles). Auth owns the
 * raw token and its decoded claims (exp for token expiry). The two are
 * injected separately to respect the layered responsibility split.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  // inject() replaces constructor injection in Angular 21
  protected readonly authService = inject(AuthService);
  private readonly auth = inject(Auth);

  /**
   * Greeting name shown in the page title.
   *
   * Prefers firstName when available (populated after the me query resolves),
   * falls back to 'there' while the signal is null.
   *
   * @returns Display name string.
   */
  protected readonly displayName = computed(() => {
    const u = this.authService.currentUser();
    return u?.firstName ?? 'there';
  });

  /**
   * Human-readable remaining lifetime of the JWT access token.
   *
   * Derives remaining seconds from the exp claim on each signal read.
   * Display-only: expiry enforcement is handled by authGuard.
   *
   * @returns e.g. "In 54 min", "In 1h 2 min", "Expired", or "Unknown".
   */
  protected readonly tokenExpiry = computed(() => {
    const exp = this.auth.claims()?.exp;
    if (!exp) return 'Unknown';
    const rem = exp - Math.floor(Date.now() / 1000);
    if (rem <= 0) return 'Expired';
    if (rem < 60) return `${rem}s`;
    if (rem < 3600) return `In ${Math.floor(rem / 60)} min`;
    return `In ${Math.floor(rem / 3600)}h ${Math.floor((rem % 3600) / 60)} min`;
  });

  /**
   * Role name strings extracted from the signed-in user's role list.
   *
   * Returns an empty array when the session is anonymous so the template
   * can branch on length without null-checking.
   *
   * @returns Array of role name strings, e.g. ['ADMIN', 'USER'].
   */
  protected readonly roles = computed(() =>
    this.authService.currentUser()?.roles.map((r) => r.roleName) ?? [],
  );

  /** Today's date formatted for the page subtitle. */
  protected readonly today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  /**
   * KPI summary cards displayed at the top of the dashboard.
   *
   * Values are '--' placeholders until each feature branch wires
   * a real total from its resource service.
   *
   * `mod` drives the color modifier class (.kpi-accent, .kpi-violet, etc.)
   * applied to both the icon container and the KPI value.
   */
  protected readonly kpis = [
    { label: 'Categories', icon: 'category',     value: '--', mod: 'accent' },
    { label: 'Products',   icon: 'inventory_2',  value: '--', mod: 'violet' },
    { label: 'Customers',  icon: 'people',        value: '--', mod: 'green'  },
    { label: 'Orders',     icon: 'receipt_long', value: '--', mod: 'amber'  },
  ] as const;

  /**
   * Quick-access tiles that navigate to each feature section.
   *
   * Six tiles cover both the business domain (Categories, Products, Customers,
   * Orders) and the RBAC administration screens (Users, Roles). `mod` drives
   * the same color modifier class as the KPI cards for visual consistency.
   */
  protected readonly tiles = [
    { label: 'Categories', desc: 'Manage product categories and hierarchy',  icon: 'category',       route: '/categories', mod: 'accent'  },
    { label: 'Products',   desc: 'Browse, filter and edit product listings',  icon: 'inventory_2',   route: '/products',   mod: 'violet'  },
    { label: 'Customers',  desc: 'View customer profiles and order history',  icon: 'people',         route: '/customers',  mod: 'green'   },
    { label: 'Orders',     desc: 'Track and process incoming orders',          icon: 'receipt_long',  route: '/orders',     mod: 'amber'   },
    { label: 'Users',      desc: 'Manage user accounts and access control',   icon: 'manage_accounts', route: '/users',    mod: 'blue'    },
    { label: 'Roles',      desc: 'Assign roles and permissions to users',      icon: 'shield',         route: '/roles',     mod: 'purple'  },
  ] as const;
}
