import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage, { getCentralSiteUrl, isExplicitPlatformContext } from './home_page';

const mockUseFrappeGetCall = vi.fn(() => ({
  data: null,
  error: null,
  mutate: vi.fn(),
}));

// Mock useRouter
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => mockPathname,
}));

// Mock useFrappeAuth variables
let mockCurrentUser: string | null = null;
let mockIsLoading = false;
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('frappe-react-sdk', () => ({
  useFrappeAuth: () => ({
    currentUser: mockCurrentUser,
    login: mockLogin,
    logout: mockLogout,
    isLoading: mockIsLoading,
    error: null,
  }),
  useFrappeGetCall: (...args: unknown[]) => mockUseFrappeGetCall(...args),
}));

// Mock useSaaSConfig variables
interface MockSaasConfig {
  client_name: string;
  colors: { primary: string };
  features: { pos: boolean; production: boolean };
}

const mockSaasConfig: MockSaasConfig = {
  client_name: 'La Paletixa Test',
  colors: { primary: '#3498db' },
  features: { pos: true, production: true }
};
const mockConfigLoading = false;

vi.mock('./providers', () => ({
  useSaaSConfig: () => ({
    saasConfig: mockSaasConfig,
    configLoading: mockConfigLoading,
    refreshConfig: vi.fn(),
  }),
}));

// Mock fetch for brand features config
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      message: {
        client_name: 'La Paletixa Test',
        colors: { primary: '#3498db' },
        features: { pos: true, production: true }
      }
    }),
  })
);

describe('HomePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFrappeGetCall.mockClear();
    mockCurrentUser = null;
    mockIsLoading = false;
    mockPathname = '/';
    document.cookie = 'tenant_name=; Max-Age=0; path=/';
  });

  it('treats /c routes as tenant context and keeps the central URL on the current origin', () => {
    expect(isExplicitPlatformContext('frontend', 'admin@jegdev.com')).toBe(true);
    expect(isExplicitPlatformContext('acme', 'admin@jegdev.com')).toBe(true);
    expect(isExplicitPlatformContext('acme', 'tenant@example.com')).toBe(false);
    expect(getCentralSiteUrl('http:', 'mytenant.localhost:3000')).toBe('http://mytenant.localhost:3000');
  });

  it('renders loader when auth is loading', () => {
    mockCurrentUser = null;
    mockIsLoading = true;
    // Mock fetch to remain pending to avoid state updates after unmount
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

    render(<HomePage />);

    expect(screen.getByText('Cargando plataforma SaaS...')).toBeInTheDocument();
  });

  it('renders login screen when user is not logged in', async () => {
    mockCurrentUser = null;
    mockIsLoading = false;
    
    // Mock fetch to resolve correctly for the login render
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: {
            client_name: 'La Paletixa Test',
            colors: { primary: '#3498db' },
            features: { pos: true, production: true }
          }
        }),
      })
    );

    render(<HomePage />);

    // Wait for brand config loader to resolve
    const loginButton = await screen.findByRole('button', { name: 'Entrar a la Plataforma' });
    expect(loginButton).toBeInTheDocument();
    expect(screen.getByText('Correo Electrónico')).toBeInTheDocument();
    expect(screen.getByText('Contraseña')).toBeInTheDocument();
  });

  it('does not request platform admin dashboard on a tenant route even for admin users', async () => {
    mockCurrentUser = 'admin@example.com';
    mockIsLoading = false;
    document.cookie = 'tenant_name=acme; path=/';

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: {
            client_name: 'La Paletixa Test',
            colors: { primary: '#3498db' },
            features: { pos: true, production: true }
          }
        }),
      })
    );

    render(<HomePage />);

    const platformDashboardCall = mockUseFrappeGetCall.mock.calls.find(
      ([method]) => method === 'paletixa_saas.paletixa_saas.api.get_platform_admin_dashboard'
    );

    expect(platformDashboardCall?.[2]).toBeNull();
  });

  it('requests platform admin dashboard for the superadmin account', async () => {
    mockCurrentUser = 'admin@jegdev.com';
    mockIsLoading = false;
    document.cookie = 'tenant_name=master; path=/';

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: {
            client_name: 'La Paletixa Test',
            colors: { primary: '#3498db' },
            features: { pos: true, production: true }
          }
        }),
      })
    );

    render(<HomePage />);

    const platformDashboardCall = mockUseFrappeGetCall.mock.calls.find(
      ([method]) => method === 'paletixa_saas.paletixa_saas.api.get_platform_admin_dashboard'
    );

    expect(platformDashboardCall?.[2]).toBe('platform_admin_dashboard');
  });

  it('prefers platform context for the superadmin account even if a tenant cookie is stale', async () => {
    mockCurrentUser = 'admin@jegdev.com';
    mockIsLoading = false;
    document.cookie = 'tenant_name=acme; path=/';

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: {
            client_name: 'La Paletixa Test',
            colors: { primary: '#3498db' },
            features: { pos: true, production: true }
          }
        }),
      })
    );

    render(<HomePage />);

    const platformDashboardCall = mockUseFrappeGetCall.mock.calls.find(
      ([method]) => method === 'paletixa_saas.paletixa_saas.api.get_platform_admin_dashboard'
    );

    expect(platformDashboardCall?.[2]).toBe('platform_admin_dashboard');
  });
});
