import { useFunction } from '@frozik/components/hooks/useFunction';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isNil, round } from 'lodash-es';
import { memo, useEffect, useMemo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import type { SiteLocationChanges } from '../../domain/model/site-plan-edits';
import { lookupTimeZoneId } from '../../infrastructure/timezone-lookup';
import { COORDINATE_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import styles from './LocationMapDialog.module.scss';

/** A village and its fields — close enough to recognise a plot, wide enough to pan from. */
const INITIAL_ZOOM = 13;
const MIN_ZOOM = 2;
const MAX_ZOOM = 19;

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Required by the OpenStreetMap tile usage policy: it must stay on screen and legible. */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MARKER_WIDTH_PX = 24;
const MARKER_HEIGHT_PX = 30;

/** Geometry only — the pin is coloured from the stylesheet beside this file. */
const MARKER_PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARKER_WIDTH_PX} ${MARKER_HEIGHT_PX}" ` +
  `width="${MARKER_WIDTH_PX}" height="${MARKER_HEIGHT_PX}" aria-hidden="true">` +
  '<path d="M12 1C6.2 1 1.5 5.7 1.5 11.5c0 7.3 8.8 16.7 9.2 17.1a1.8 1.8 0 0 0 2.6 0' +
  'c.4-.4 9.2-9.8 9.2-17.1C22.5 5.7 17.8 1 12 1Z"/>' +
  '<circle cx="12" cy="11.5" r="3.8"/></svg>';

/**
 * Leaflet's default pin is a PNG it resolves by URL at runtime, which a bundler
 * relocates and the map then draws as a broken image — the well-known first
 * stumble of using Leaflet outside a script tag. A `divIcon` sidesteps the whole
 * question: the pin is inline SVG, so it costs no request and takes the dark
 * theme's accent from CSS.
 */
const MARKER_ICON = L.divIcon({
  html: MARKER_PIN_SVG,
  className: styles.marker,
  iconSize: [MARKER_WIDTH_PX, MARKER_HEIGHT_PX],
  iconAnchor: [MARKER_WIDTH_PX / 2, MARKER_HEIGHT_PX],
});

const TIME_ZONE_SEPARATOR = ' · ';

/**
 * Panning past a meridian keeps counting, and a longitude can be typed into the
 * settings just as freely, so every reading the map hands over is folded back
 * into [-180, 180] before it is shown or applied.
 */
function toWrappedPoint(latitudeDegrees: number, longitudeDegrees: number): L.LatLng {
  return L.latLng(latitudeDegrees, longitudeDegrees).wrap();
}

/**
 * Picks the plot's place on Earth by pointing at it. Typing a latitude is exact
 * but blind — a map is how one recognises the plot — and the point answers with
 * both halves of the reading the sun study needs: the coordinates and, from the
 * offline boundary table, the time zone they fall in.
 *
 * Leaflet is driven imperatively from one effect that owns the whole map: React
 * renders the empty container and nothing inside it, so a strict-mode remount is
 * a dispose and a rebuild, nothing subtler.
 */
export const LocationMapDialog = memo(
  ({
    initialLatitudeDegrees,
    initialLongitudeDegrees,
    onApply,
    onClose,
  }: {
    readonly initialLatitudeDegrees: number;
    readonly initialLongitudeDegrees: number;
    readonly onApply: (location: SiteLocationChanges) => void;
    readonly onClose: VoidFunction;
  }) => {
    // A state-backed ref, not `useRef`: Radix's Portal mounts its subtree one
    // commit late (an SSR guard), so on this component's first effect pass the
    // container does not exist yet — the state change is what re-runs the
    // effect once it does.
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [point, setPoint] = useState(() =>
      toWrappedPoint(initialLatitudeDegrees, initialLongitudeDegrees)
    );
    const timeZoneId = useMemo(() => lookupTimeZoneId(point.lat, point.lng), [point]);

    useEffect(() => {
      if (isNil(container)) {
        return undefined;
      }

      const center = toWrappedPoint(initialLatitudeDegrees, initialLongitudeDegrees);
      const map = L.map(container, { center, zoom: INITIAL_ZOOM });

      // The OSM credit is required by the tile policy; the library's own
      // "Leaflet" prefix is not, and the strip reads cleaner without it.
      map.attributionControl.setPrefix(false);
      const marker = L.marker(center, {
        icon: MARKER_ICON,
        draggable: true,
        title: sitePlannerT.settings.location.map.marker,
        alt: sitePlannerT.settings.location.map.marker,
      });

      L.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      }).addTo(map);
      marker.addTo(map);

      const placeMarker = (latLng: L.LatLng): void => {
        const wrapped = toWrappedPoint(latLng.lat, latLng.lng);

        marker.setLatLng(wrapped);
        setPoint(wrapped);
      };

      map.on('click', (event: L.LeafletMouseEvent) => placeMarker(event.latlng));
      marker.on('dragend', () => placeMarker(marker.getLatLng()));

      // The dialog is measured only once portalled in, so the map would otherwise
      // lay its tiles out against a container that has no size yet.
      const resizeObserver = new ResizeObserver(() => map.invalidateSize());

      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        map.remove();
      };
    }, [container, initialLatitudeDegrees, initialLongitudeDegrees]);

    /**
     * The plan takes exactly the reading the dialog showed. A pixel on a map is
     * worth metres, so the digits past the fourth are the pointer's noise, and
     * carrying them into the plan would leave the settings field and the file
     * disagreeing about the same place.
     */
    const handleApply = useFunction(() => {
      onApply({
        latitudeDegrees: round(point.lat, COORDINATE_DECIMALS),
        longitudeDegrees: round(point.lng, COORDINATE_DECIMALS),
        ...(isNil(timeZoneId) ? {} : { timeZoneId }),
      });
      onClose();
    });

    const footer = (
      <>
        <p
          aria-live="polite"
          className="mr-auto self-center font-mono text-[11px] text-landing-fg-dim"
        >
          {point.lat.toFixed(COORDINATE_DECIMALS)}, {point.lng.toFixed(COORDINATE_DECIMALS)}
          {isNil(timeZoneId) ? undefined : `${TIME_ZONE_SEPARATOR}${timeZoneId}`}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {sitePlannerT.settings.location.map.cancel}
        </Button>
        <Button size="sm" onClick={handleApply}>
          {sitePlannerT.settings.location.map.apply}
        </Button>
      </>
    );

    return (
      <DialogShell
        open
        onClose={onClose}
        className="w-[min(94vw,760px)]"
        kicker={sitePlannerT.settings.location.map.kicker}
        title={sitePlannerT.settings.location.map.title}
        description={sitePlannerT.settings.location.map.description}
        closeLabel={sitePlannerT.settings.location.map.cancel}
        footer={footer}
      >
        <div
          ref={setContainer}
          role="application"
          aria-label={sitePlannerT.settings.location.map.title}
          className={styles.map}
        />
      </DialogShell>
    );
  }
);
