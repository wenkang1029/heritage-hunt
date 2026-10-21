import L from 'leaflet';

/**
 * Creates an animated golden Rally Flag marker icon for gathering points.
 */
export function createRallyFlagIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-rally-marker',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(245, 158, 11, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="width: 38px; height: 38px; border-radius: 50%; background: #F59E0B; border: 3px solid #FFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(245,158,11,0.6); position: relative; z-index: 2;">
          <span style="font-size: 18px; line-height: 1;">🚩</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}
