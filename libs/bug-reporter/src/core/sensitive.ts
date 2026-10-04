/** Set on the document root while a capture runs; `theme/bug-reporter.css` keys the masking rules on it. */
export const CAPTURE_ATTRIBUTE = 'data-bug-capture';
/** Text under this class is drawn transparent during a capture and never quoted in breadcrumbs. */
const MASK_CLASS = 'bug-mask';
/** A subtree under this class is hidden whole during a capture. */
const BLOCK_CLASS = 'bug-block';
export const SENSITIVE_SELECTOR = `.${MASK_CLASS}, .${BLOCK_CLASS}`;
