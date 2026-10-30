import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverlayTitleRow } from './overlay-title-row';
import { PetAvatar, UnknownPetAvatar } from './pet-avatar';
import { SettingsSection } from './settings-section';

describe('OverlayTitleRow', () => {
  it('puts a Close button beside the title that calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <OverlayTitleRow onClose={onClose}>
        <h2>Edit meal</h2>
      </OverlayTitleRow>,
    );
    expect(screen.getByRole('heading', { name: 'Edit meal' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Close disabled while the overlay is busy', () => {
    render(
      <OverlayTitleRow onClose={() => undefined} closeDisabled>
        <h2>Change cat</h2>
      </OverlayTitleRow>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  });
});

describe('PetAvatar', () => {
  it('is decorative: an empty alt on a photo, hidden when there is none', () => {
    const { container } = render(
      <>
        <PetAvatar photoUrl="api/pets/1/faces/2/photo" size={36} />
        <PetAvatar photoUrl={null} />
        <UnknownPetAvatar />
      </>,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(container).toHaveTextContent('?');
  });
});

describe('SettingsSection', () => {
  it('names the section by its title and shows the slot on the title row', () => {
    render(
      <SettingsSection title="Cloud guards" end={<span>All on</span>} description="Three guards.">
        <p>rows</p>
      </SettingsSection>,
    );
    const section = screen.getByRole('region', { name: 'Cloud guards' });
    expect(section).toHaveTextContent('All on');
    expect(section).toHaveTextContent('Three guards.');
  });
});
