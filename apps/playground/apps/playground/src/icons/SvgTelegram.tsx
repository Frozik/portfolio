import type { SVGProps } from 'react';
import { memo } from 'react';

export const SvgTelegram = memo((props: SVGProps<SVGSVGElement>) => (
  <span role="img" aria-label="mail" className="anticon">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fillRule="evenodd"
      clipRule="evenodd"
      imageRendering="optimizeQuality"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      viewBox="0 0 333334 333334"
      width="1em"
      height="1em"
      {...props}
    >
      <path d="M166667 0c92048 0 166667 74619 166667 166667s-74619 166667-166667 166667S0 258715 0 166667 74619 0 166667 0m80219 91205-29735 149919s-4158 10396-15594 5404l-68410-53854s76104-68409 79222-71320c3119-2911 2079-3534 2079-3534 207-3535-5614 0-5614 0l-100846 64043-42002-14140s-6446-2288-7069-7277c-624-4992 7277-7694 7277-7694l166970-65498s13722-6030 13722 3951m-87637 122889-27141 24745s-2122 1609-4443 601l5197-45965z" />
    </svg>
  </span>
));
