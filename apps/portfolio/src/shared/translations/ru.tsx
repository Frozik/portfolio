import type { SharedTranslation } from './en';

export const sharedTranslationsRu: SharedTranslation = {
  webGpuGuard: {
    title: 'WebGPU недоступен',
    description:
      'Для этой функции требуется WebGPU — современный GPU API для веба. Ваш браузер его не поддерживает или он отключён.',
    safariIOSTitle: 'Safari на iOS (17.4 – 18.x)',
    safariIOSSteps: [
      <>
        Откройте приложение <strong className="text-text">Настройки</strong>
      </>,
      <>
        Прокрутите до <strong className="text-text">Safari</strong>
      </>,
      <>
        Нажмите <strong className="text-text">Дополнения</strong> (внизу)
      </>,
      <>
        Нажмите <strong className="text-text">Feature Flags</strong>
      </>,
      <>
        Найдите <strong className="text-text">WebGPU</strong> и включите{' '}
        <strong className="text-success">ON</strong>
      </>,
      'Перезагрузите страницу',
    ],
    safariMacOSTitle: 'Safari на macOS (17.4 – 18.x)',
    safariMacOSSteps: [
      <>
        Откройте <strong className="text-text">Safari → Настройки → Feature Flags</strong>
      </>,
      <>
        Найдите <strong className="text-text">WebGPU</strong> и включите его
      </>,
      'Перезагрузите страницу',
    ],
    safariMacOSNote: 'Safari 26+ (macOS Tahoe, осень 2026) будет поддерживать WebGPU по умолчанию.',
    otherBrowsersTitle: 'Другие браузеры',
    otherBrowsersDescription:
      'Chrome 113+, Edge 113+ и Samsung Internet 24+ поддерживают WebGPU из коробки. Firefox 141+ поддерживает на Windows и macOS (Apple Silicon).',
    linkSupport: 'Таблица поддержки браузерами',
    linkWebKit: 'Блог WebKit: WebGPU в Safari',
  },
  signInGate: {
    title: 'Войдите, чтобы продолжить',
    description:
      'Сервер коммуникаций подтверждает личность через Google или Яндекс для сквозного сигналинга. Токен хранится только в этой вкладке и забывается при её закрытии.',
    missingClientId:
      'Ни один OAuth-провайдер не настроен. Войти невозможно, пока деплой не предоставит хотя бы один client id (Google или Яндекс).',
    yandexButton: 'Войти через Яндекс',
  },
  accountChip: {
    signOutAriaLabel: 'Выйти из сервера коммуникаций',
    noEmailFallback: 'Email не указан',
    providerLabels: {
      google: 'Вход через Google',
      yandex: 'Вход через Яндекс',
    },
  },
};
