import type { TNumberingService } from '../../contexts/phone/domain/numbering/gen/numbering-codes';

export const RU_SERVICES: Readonly<Record<TNumberingService, string>> = {
  'disaster-relief': 'Помощь при бедствиях (УКГВ ООН)',
  'global-mobile-satellite': 'Глобальная спутниковая связь',
  inmarsat: 'Inmarsat',
  'international-freephone': 'Международный бесплатный вызов',
  'international-networks': 'Международные сети',
  itpcs: 'Международная служба публичной корреспонденции',
  'premium-rate': 'Международная платная услуга',
  'shared-cost': 'Международная услуга с разделением оплаты',
  'universal-personal': 'Универсальная персональная связь',
};
