import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';

import type { SunStore } from '../../application/SunStore';
import type { GpuCapabilities } from '../../domain/gpu-capabilities';
import { accelerationOf, featureSupportOf, keyLimitsOf } from '../../domain/gpu-capabilities';
import { formatCount } from '../report-text';
import { sunT } from '../translations';
import { PanelRow } from './PanelRow';

const { panel: t } = sunT;

/** What is known of the graphics card: who it is, whether it accelerates, and what it can do. */
export const GpuDetails = observer(({ store }: { readonly store: SunStore }) => {
  const { gpu, webgl } = store;
  return (
    <>
      <section>
        <h3 className="mb-1 text-neutral-400 uppercase">{t.card}</h3>
        {gpu.kind === 'pending' && <p>{t.gpuPending}</p>}
        {gpu.kind === 'unavailable' && (
          <p role="alert" className="text-amber-300">
            {t.failure[gpu.failure.reason]}
            {gpu.failure.detail !== undefined && ` — ${gpu.failure.detail}`}
          </p>
        )}
        <dl>
          {gpu.kind === 'ready' && (
            <PanelRow label="WebGPU" value={adapterName(gpu.capabilities)} />
          )}
          {webgl !== undefined && <PanelRow label="WebGL" value={webgl.renderer} />}
          <PanelRow label={t.acceleration} value={t.accelerationKind[accelerationOf(gpu, webgl)]} />
        </dl>
      </section>
      {gpu.kind === 'ready' && <Capabilities capabilities={gpu.capabilities} />}
    </>
  );
});

const Capabilities = ({ capabilities }: { readonly capabilities: GpuCapabilities }) => {
  const features = featureSupportOf(capabilities);
  const supported = features.filter(feature => feature.isSupported).length;
  return (
    <>
      <section>
        <h3 className="mb-1 text-neutral-400 uppercase">{t.limits}</h3>
        <dl>
          {keyLimitsOf(capabilities).map(limit => (
            <PanelRow key={limit.name} label={limit.name} value={formatCount(limit.value)} />
          ))}
        </dl>
      </section>
      <section>
        <h3 className="mb-1 text-neutral-400 uppercase">
          {t.features(supported, features.length)}
        </h3>
        <ul className="flex flex-wrap gap-1">
          {features.map(feature => (
            <li
              key={feature.name}
              className={cn(
                'rounded px-1',
                feature.isSupported
                  ? 'bg-emerald-400/20 text-emerald-200'
                  : 'text-neutral-500 line-through'
              )}
            >
              {feature.name}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};

function adapterName(capabilities: GpuCapabilities): string {
  const parts = [
    capabilities.vendor,
    capabilities.architecture,
    capabilities.device,
    capabilities.description,
  ].filter(part => part !== '');
  return parts.length > 0 ? parts.join(' · ') : '—';
}
