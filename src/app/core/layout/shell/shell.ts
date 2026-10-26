import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  /**
   * Whether the application is currently in dark mode.
   *
   * Stored as a signal so the template can reactively swap the
   * toolbar icon between 'dark_mode' and 'light_mode' without an
   * explicit change-detection trigger. The actual theme is applied by
   * setting data-theme on the root element; see toggleTheme().
   */
  readonly darkMode = signal(false);

  /** Navigation items rendered in the sidebar main section. */
  readonly navItems: NavItem[] = [
    { label: 'Categories', icon: 'category', route: '/categories' },
    { label: 'Products', icon: 'inventory_2', route: '/products' },
    { label: 'Customers', icon: 'people', route: '/customers' },
    { label: 'Orders', icon: 'shopping_cart', route: '/orders' },
  ];

  /**
   * Toggles between light and dark themes.
   *
   * Sets data-theme on the root element so that the :root[data-theme="dark"]
   * CSS block overrides the prefers-color-scheme media query in both
   * directions. This approach means that once the user explicitly picks a
   * theme it stays until toggled again, regardless of the OS setting.
   *
   * @returns void
   */
  toggleTheme(): void {
    this.darkMode.update((v) => !v);
    document.documentElement.dataset['theme'] = this.darkMode() ? 'dark' : 'light';
  }
}
