import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { FileDrop } from './FileDrop';

const WAIT = { timeout: 5000 };

function aFile(name: string, type: string, text: string): File {
  return new File([text], name, { type });
}

describe('FileDrop', () => {
  it('hands the bytes of a dropped file to the owner', async () => {
    const onFiles = vi.fn();
    render(<FileDrop aria-label="Scan" accept="image/*" onFiles={onFiles} />);

    fireEvent.drop(screen.getByRole('button', { name: 'Scan' }), {
      dataTransfer: { files: [aFile('scan.png', 'image/png', 'PNG')] },
    });

    await waitFor(() => expect(onFiles).toHaveBeenCalledTimes(1), WAIT);
    const [[files]] = onFiles.mock.calls;
    expect(files).toMatchObject([{ name: 'scan.png', type: 'image/png' }]);
    expect(new TextDecoder().decode(files[0].bytes)).toBe('PNG');
  });

  it('takes a pasted file through the same filter and says when one was turned away', async () => {
    const onFiles = vi.fn();
    render(<FileDrop aria-label="Scan" accept="image/*" onFiles={onFiles} />);

    fireEvent.paste(screen.getByRole('button', { name: 'Scan' }), {
      clipboardData: {
        files: [aFile('notes.txt', 'text/plain', 'x'), aFile('a.png', 'image/png', 'y')],
      },
    });

    await waitFor(() => expect(onFiles).toHaveBeenCalledTimes(1), WAIT);
    expect(onFiles.mock.calls[0]?.[0]).toMatchObject([{ name: 'a.png' }]);
    expect(screen.getByRole('alert').textContent).toBe('Some files are not of an accepted type');
  });
});
