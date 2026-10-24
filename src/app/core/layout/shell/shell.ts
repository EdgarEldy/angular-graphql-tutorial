import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

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
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly sidenavOpen = signal(true);

  readonly navItems: NavItem[] = [
    { label: 'Categories', icon: 'category', route: '/categories' },
    { label: 'Products', icon: 'inventory_2', route: '/products' },
    { label: 'Customers', icon: 'people', route: '/customers' },
    { label: 'Orders', icon: 'shopping_cart', route: '/orders' },
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
}
