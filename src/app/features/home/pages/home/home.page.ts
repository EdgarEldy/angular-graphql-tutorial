import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/**
 * Home page -- the application landing screen (route: /).
 *
 * Acts as a hub that surfaces the most useful information at a glance:
 * - Four KPI cards (Categories, Products, Customers, Orders) whose values
 *   are placeholder strings on this branch; downstream feature branches
 *   will swap them for live totals once their respective services are wired.
 * - Quick-access tiles that navigate to each section of the application,
 *   including the RBAC administration screens (Users, Roles).
 *
 * No HTTP calls are made in this component. The session-info panel
 * (displaying the signed-in user's name, roles and token expiry) is added
 * on the feature/auth branch once AuthService is available.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {

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
