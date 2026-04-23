import { Mail, MessageCircle } from 'lucide-react';
import { memo } from 'react';

import { SvgGitHub } from '../../../../../icons/SvgGitHub';
import { SvgLinkedIn } from '../../../../../icons/SvgLinkedIn';
import { SvgTelegram } from '../../../../../icons/SvgTelegram';

export type TContactIconKey = 'telegram' | 'whatsapp' | 'email' | 'github' | 'linkedin';

type ContactIconProps = {
  readonly iconKey: TContactIconKey;
  readonly size?: number;
};

const DEFAULT_SIZE = 16;

const ContactIconComponent = ({ iconKey, size = DEFAULT_SIZE }: ContactIconProps) => {
  switch (iconKey) {
    case 'telegram':
      return <SvgTelegram width={size} height={size} />;
    case 'whatsapp':
      return <MessageCircle size={size} strokeWidth={1.6} />;
    case 'email':
      return <Mail size={size} strokeWidth={1.6} />;
    case 'github':
      return <SvgGitHub width={size} height={size} />;
    case 'linkedin':
      return <SvgLinkedIn width={size} height={size} />;
  }
};

export const ContactIcon = memo(ContactIconComponent);
