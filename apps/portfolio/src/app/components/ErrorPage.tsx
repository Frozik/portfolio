import { useFunction } from '@frozik/components';
import { Home } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Link, useRouteError } from 'react-router-dom';

import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui';
import { appT } from '../translations';

const TEAPOT_STATUS = 418;
const FIRST_STATUS = 404;

const STAR_COUNT = 50;
const STEAM_PARTICLE_COUNT = 3;

interface Star {
  top: string;
  left: string;
  delay: string;
  size: string;
}

function generateStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 3}s`,
    size: `${1 + Math.random() * 2}px`,
  }));
}

export const ErrorPage = memo(() => {
  const error = useRouteError() as { status?: number } | undefined;
  const initialStatus = error?.status ?? FIRST_STATUS;

  const [statusCode, setStatusCode] = useState(
    initialStatus >= FIRST_STATUS && initialStatus <= TEAPOT_STATUS ? initialStatus : FIRST_STATUS
  );
  const [glitchKey, setGlitchKey] = useState(0);

  const isTeapot = statusCode === TEAPOT_STATUS;
  const statusInfo = appT.errorPage.statusMap[statusCode] ?? appT.errorPage.statusMap[FIRST_STATUS];

  const stars = useMemo(generateStars, []);

  const handleStatusClick = useFunction(() => {
    setStatusCode(previous => (previous >= TEAPOT_STATUS ? FIRST_STATUS : previous + 1));
    setGlitchKey(previous => previous + 1);
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {stars.map(star => (
          <div
            key={`${star.top}-${star.left}`}
            className="absolute animate-twinkle rounded-full bg-brand-300"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <button
          type="button"
          onClick={handleStatusClick}
          className={cn(
            'relative cursor-pointer select-none font-mono text-[10rem] leading-none',
            'font-bold tracking-tighter transition-colors duration-300',
            isTeapot ? 'text-warning' : 'text-brand-400 hover:text-brand-300'
          )}
        >
          <span key={glitchKey} className="inline-block animate-glitch">
            {statusCode}
          </span>

          {isTeapot && (
            <div
              className="pointer-events-none absolute -top-8 left-1/2 flex -translate-x-1/2 gap-3"
              aria-hidden="true"
            >
              {Array.from({ length: STEAM_PARTICLE_COUNT }, (_, index) => {
                const delay = `${index * 0.4}s`;
                return (
                  <span
                    key={delay}
                    className="animate-steam text-3xl opacity-60"
                    style={{ animationDelay: delay }}
                  >
                    ~
                  </span>
                );
              })}
            </div>
          )}
        </button>

        <h1
          className={cn(
            'animate-float font-sans text-3xl font-semibold',
            isTeapot ? 'text-warning' : 'text-text'
          )}
        >
          {statusInfo.text}
          {isTeapot && <span className="ml-3 inline-block animate-wiggle text-4xl">🫖</span>}
        </h1>

        <p className="max-w-md text-lg text-text-secondary">{statusInfo.message}</p>

        <p className="text-sm text-text-muted">
          {isTeapot ? appT.errorPage.teapotHint : appT.errorPage.clickHint}
        </p>

        <Button asChild variant="secondary" size="lg" className="mt-4 gap-2">
          <Link to="/">
            <Home className="size-4" />
            {appT.errorPage.takeMeHome}
          </Link>
        </Button>
      </div>
    </div>
  );
});
