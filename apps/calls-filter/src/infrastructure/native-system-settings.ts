import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { TOpenSystemSettings } from '../contexts/device/domain/ports/system-settings';

export const NATIVE_SYSTEM_SETTINGS: TOpenSystemSettings = place =>
  CALL_SCREENING.openSettings(place);
