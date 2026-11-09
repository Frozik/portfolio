'use dom';

import 'leaflet/dist/leaflet.css';

import * as L from 'leaflet';
import { useEffect, useRef } from 'react';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** Required by the OpenStreetMap tile usage policy: it must stay on screen and legible. */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MIN_ZOOM = 2;
const MAX_ZOOM = 19;
const PIN_WIDTH = 24;
const PIN_HEIGHT = 30;
/** Leaflet's own pin is a PNG fetched by URL, which a bundle breaks; an inline SVG pin costs nothing. */
const PIN = L.divIcon({
  html:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIN_WIDTH} ${PIN_HEIGHT}" width="${PIN_WIDTH}" height="${PIN_HEIGHT}">` +
    '<path fill="#1f6feb" stroke="#ffffff" stroke-width="1.5" d="M12 1C6.2 1 1.5 5.7 1.5 11.5c0 7.3 8.8 16.7 9.2 17.1a1.8 1.8 0 0 0 2.6 0c.4-.4 9.2-9.8 9.2-17.1C22.5 5.7 17.8 1 12 1Z"/>' +
    '<circle cx="12" cy="11.5" r="3.8" fill="#ffffff"/></svg>',
  className: '',
  iconSize: [PIN_WIDTH, PIN_HEIGHT],
  iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
});

/**
 * The place on an OpenStreetMap map, as site-planner picks a point: a tap puts the pin, the
 * pin can be dragged, the circle shows the radius. Runs as a DOM component in a web view.
 */
export default function PlaceMap({
  latitude,
  longitude,
  radius,
  zoom,
  onPick,
}: {
  readonly latitude: number;
  readonly longitude: number;
  readonly radius: number;
  readonly zoom: number;
  readonly onPick: (latitude: number, longitude: number) => void;
  readonly dom?: import('expo/dom').DOMProps;
}) {
  const container = useRef<HTMLDivElement>(null);
  const parts = useRef<{ map: L.Map; pin: L.Marker; circle: L.Circle } | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (container.current === null) {
      return undefined;
    }
    const map = L.map(container.current, { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }).setView(
      [latitude, longitude],
      zoom
    );
    L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map);
    const pin = L.marker([latitude, longitude], { icon: PIN, draggable: true }).addTo(map);
    const circle = L.circle([latitude, longitude], {
      radius,
      color: '#1f6feb',
      weight: 2,
      fillOpacity: 0.12,
    }).addTo(map);
    const place = (point: L.LatLng) => {
      const wrapped = point.wrap();
      pin.setLatLng(wrapped);
      circle.setLatLng(wrapped);
      pick.current(wrapped.lat, wrapped.lng);
    };
    map.on('click', (event: L.LeafletMouseEvent) => place(event.latlng));
    pin.on('dragend', () => place(pin.getLatLng()));
    parts.current = { map, pin, circle };
    return () => {
      map.remove();
      parts.current = null;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- rebuilding Leaflet on every prop would reset the user's pan and zoom
  }, []);

  useEffect(() => {
    const current = parts.current;
    if (current === null) {
      return;
    }
    const here = L.latLng(latitude, longitude);
    if (!current.pin.getLatLng().equals(here)) {
      current.pin.setLatLng(here);
      current.circle.setLatLng(here);
      current.map.setView(here, Math.max(current.map.getZoom(), zoom));
    }
    current.circle.setRadius(radius);
  }, [latitude, longitude, radius, zoom]);

  return <div ref={container} style={{ width: '100%', height: '100%', minHeight: 320 }} />;
}
