import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { Auth } from '../../../../core/auth/auth';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Dashboard page -- the authenticated landing screen (route: /dashboard).
 *
 * Acts as a hub that surfaces the most useful information at a glance:
 * - A personalised welcome derived from the signed-in user's first name.
 * - Four KPI cards (Categories, Products, Customers, Orders) whose values
 *   are placeholders on this branch; downstream feature branches will swap
 *   them for live totals once their respective services are wired.
 * - Quick-access tiles that navigate to each section of the application.
 * - A session-info panel showing user details and token expiry.
 *
 * Both Auth (for token expiry) and AuthService (for the full user object)
 * are injected here. Auth provides the exp claim directly from the JWT, which
 * avoids a redundant query just to display token lifetime. AuthService
 * provides the loaded user fields (name, email, roles).
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly auth = inject(Auth);
  protected readonly authService = inject(AuthService);

  /**
   * Greeting name shown in the page title.
   *
   * Prefers firstName from the loaded session user. Falls back to the email
   * local-part if first name is missing, then 'there' while the user is not
   * yet loaded (e.g. the me query is still in-flight on first render).
   *
   * @returns display name string.
   */
  protected readonly displayName = computed(() => {
    const u = this.authService.currentUser();
    if (!u) return 'there';
    return u.firstName ?? u.email.split('@')[0];
  });

  /**
   * Two-character uppercase initials for the session panel avatar.
   *
   * Built from firstName + lastName initials when both are present, otherwise
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
   * Full name shown in the session panel (first + last).
   *
   * @returns full name string or '--' when no user is loaded.
   */
  protected readonly sessionUsername = computed(() => {
    const u = this.authService.currentUser();
    if (!u) return '--';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  });

  /**
   * Email shown in the session panel.
   *
   * @returns email string or '--' when no user is loaded.
   */
  protected readonly sessionEmail = computed(
    () => this.authService.currentUser()?.email ?? '--',
  );

  /**
   * Role name strings shown as tags in the session panel.
   *
   * @returns array of role name strings, e.g. ["ADMIN", "USER"].
   */
  protected readonly sessionRoles = computed(
    () => this.authService.currentUser()?.roles.map((r) => r.roleName) ?? [],
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
   * Values are placeholder strings until each feature branch wires
   * a real total from its resource service.
   *
   * `trend` is a placeholder for a future trend indicator.
   * `mod` drives the color modifier class (.kpi-accent, .kpi-violet, etc.)
   * applied to both the icon container and the KPI value.
   */
  protected readonly kpis = [
    { label: 'Categories', icon: 'category',     value: '--', trend: '', mod: 'accent' },
    { label: 'Products',   icon: 'inventory_2',  value: '--', trend: '', mod: 'violet' },
    { label: 'Customers',  icon: 'people',        value: '--', trend: '', mod: 'green'  },
    { label: 'Orders',     icon: 'receipt_long', value: '--', trend: '', mod: 'amber'  },
  ] as const;

  /**
   * Quick-access tiles that navigate to each feature section.
   *
   * `mod` drives the same color modifier class as the KPI cards,
   * keeping both areas visually consistent.
   */
  protected readonly tiles = [
    { label: 'Categories', desc: 'Manage product categories and hierarchy',  icon: 'category',     route: '/categories', mod: 'accent' },
    { label: 'Products',   desc: 'Browse, filter and edit product listings',  icon: 'inventory_2', route: '/products',   mod: 'violet' },
    { label: 'Customers',  desc: 'View customer profiles and order history',  icon: 'people',       route: '/customers',  mod: 'green'  },
    { label: 'Orders',     desc: 'Track and process incoming orders',          icon: 'receipt_long', route: '/orders',     mod: 'amber'  },
  ] as const;
}
