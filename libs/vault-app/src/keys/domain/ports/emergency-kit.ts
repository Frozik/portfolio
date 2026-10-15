import type { IFileToSave } from '../../../interchange/domain/ports/file-saver';

/**
 * The printable page for a recovery key just
 * made: the vault, where it lives, the key as text and as a QR code.
 */
export type TRenderEmergencyKit = (recoveryKey: string) => Promise<IFileToSave>;
