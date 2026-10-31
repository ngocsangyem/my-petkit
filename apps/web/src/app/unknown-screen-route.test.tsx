import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { unknownScreenRoute } from './unknown-screen-route';

describe('unknown screen route', () => {
  it('sends an unknown URL Home once instead of nesting redirects forever', async () => {
    const router = createMemoryRouter(
      [{ path: '/', children: [{ path: 'devices', element: <p>home</p> }, unknownScreenRoute] }],
      { initialEntries: ['/settings'] },
    );
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/devices');
  });
});
