import type { TNumberingService } from '../../contexts/phone/domain/numbering/gen/numbering-codes';

export const EN_SERVICES: Readonly<Record<TNumberingService, string>> = {
  'disaster-relief': 'Disaster relief (UN OCHA)',
  'global-mobile-satellite': 'Global Mobile Satellite System',
  inmarsat: 'Inmarsat',
  'international-freephone': 'International Freephone',
  'international-networks': 'International Networks',
  itpcs: 'International Telecommunications Public Correspondence Service',
  'premium-rate': 'International Premium Rate Service',
  'shared-cost': 'International Shared Cost Service',
  'universal-personal': 'Universal Personal Telecommunications',
};
