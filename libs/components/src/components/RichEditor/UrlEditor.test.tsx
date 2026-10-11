import { render } from '@testing-library/react';

import { editorOf } from './editor-test-helpers.test-helper';
import { UrlEditor } from './UrlEditor';

describe('UrlEditor', () => {
  it('renders the host apart from the rest of the address, as text', () => {
    const { container } = render(<UrlEditor value="https://bank.example@evil.example/login" />);
    const editor = editorOf(container);

    expect(editor.textContent).toBe('https://bank.example@evil.example/login');
    expect([...editor.querySelectorAll('span')].map(span => span.textContent)).toEqual([
      'https://bank.example@',
      'evil.example',
      '/login',
    ]);
  });

  it('shows the ASCII name an internationalised host really resolves to, and nothing for a plain one', () => {
    const { container, rerender } = render(<UrlEditor value="https://аpple.com/login" />);
    expect(container.textContent).toContain('xn--pple-43d.com');

    rerender(<UrlEditor value="https://apple.com/login" />);
    expect(container.textContent).not.toContain('xn--');
  });
});
