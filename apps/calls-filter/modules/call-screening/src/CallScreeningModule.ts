import { requireNativeModule } from 'expo';

import type { ICallScreeningModule } from './CallScreening.types';

/** The native module, typed: only the app's infrastructure adapters import it. */
export const CALL_SCREENING = requireNativeModule<ICallScreeningModule>('CallScreening');
