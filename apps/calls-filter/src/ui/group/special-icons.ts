import type { LucideIcon } from 'lucide-react-native';
import { Coins, EyeOff, Gift, Globe, Wifi } from 'lucide-react-native';

import type { TSpecialMask } from '../../contexts/grouping/domain/member';

export const SPECIAL_ICONS: Readonly<Record<TSpecialMask, LucideIcon>> = {
  hidden: EyeOff,
  foreign: Globe,
  'premium-rate': Coins,
  voip: Wifi,
  'toll-free': Gift,
};
