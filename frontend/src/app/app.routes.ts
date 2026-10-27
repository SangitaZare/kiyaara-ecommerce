import { Routes } from '@angular/router';
import { adminGuard, adminLoginGuard, authGuard, guestGuard } from './auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    title: 'Kiyaara | Fashion for every day',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'shop',
    title: 'Shop | Kiyaara',
    loadComponent: () => import('./pages/shop/shop.component').then(m => m.ShopComponent)
  },
  {
    path: 'shop/:gender',
    title: 'Shop | Kiyaara',
    loadComponent: () => import('./pages/shop/shop.component').then(m => m.ShopComponent)
  },
  {
    path: 'product/:id',
    title: 'Kiyaara',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
  },
  {
    path: 'bag',
    title: 'Bag | Kiyaara',
    loadComponent: () => import('./pages/bag/bag.component').then(m => m.BagComponent)
  },
  {
    path: 'checkout',
    title: 'Checkout | Kiyaara',
    canActivate: [authGuard],          // NEW: log in first, then come back here
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  {
    path: 'order/:id',
    title: 'Your order | Kiyaara',
    loadComponent: () => import('./pages/order-confirmed/order-confirmed.component').then(m => m.OrderConfirmedComponent)
  },
  {
    path: 'wishlist',
    title: 'Wishlist | Kiyaara',
    loadComponent: () => import('./pages/wishlist/wishlist.component').then(m => m.WishlistComponent)
  },

  // NEW (4B): customer accounts
  {
    path: 'login',
    title: 'Log in | Kiyaara',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    title: 'Create account | Kiyaara',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'forgot-password',
    title: 'Forgot password | Kiyaara',
    loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    title: 'Choose a new password | Kiyaara',
    loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'account/orders',
    title: 'My orders | Kiyaara',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/my-orders/my-orders.component').then(m => m.MyOrdersComponent)
  },
    {
    path: 'account/profile',
    title: 'My account | Kiyaara',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/profile/profile.component').then(m => m.ProfileComponent)
  },

  // NEW (4C): the admin sign-in page, and the "not staff" page the adminGuard sends shoppers to
  {
    path: 'admin/login',
    title: 'Sign in | Kiyaara Admin',
    canActivate: [adminLoginGuard],
    loadComponent: () => import('./admin/admin-login/admin-login.components').then(m => m.AdminLoginComponent)
  },
  {
    path: 'staff-only',
    title: 'Staff only | Kiyaara',
    loadComponent: () => import('./pages/staff-only/staff-only.component').then(m => m.StaffOnlyComponent)
  },

  // The admin panel. AdminLayout draws the sidebar; the child page appears in its <router-outlet>
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        title: 'Dashboard | Kiyaara Admin',
        loadComponent: () => import('./admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'orders',
        title: 'Orders | Kiyaara Admin',
        loadComponent: () => import('./admin/orders/orders.component').then(m => m.OrdersComponent)
      },
      {
        path: 'orders/:id',
        title: 'Order | Kiyaara Admin',
        loadComponent: () => import('./admin/order-detail/order-detail.component').then(m => m.OrderDetailComponent)
      },
      {
        path: 'products',
        title: 'Products | Kiyaara Admin',
        loadComponent: () => import('./admin/product-list/product-list.component').then(m => m.ProductListComponent)
      },
      {
        path: 'products/:id',      // /admin/products/new adds, /admin/products/3 edits product 3
        title: 'Product | Kiyaara Admin',
        loadComponent: () => import('./admin/product-form/product-form.component').then(m => m.ProductFormComponent)
      }
    ]
  },

  { path: '**', redirectTo: '' }
];