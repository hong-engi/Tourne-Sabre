// Resolves the backend origin automatically:
// - Explicit REACT_APP_API_URL wins when configured.
// - On local dev/preview ports (:3000, :3001), connect to :8080 on the same host.
// - On unified production/single-port deploys, use the current page origin.
const DEV_PORTS = new Set(['3000', '3001']);

export function getServerOrigin() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    if (DEV_PORTS.has(window.location.port)) {
      return `${window.location.protocol}//${window.location.hostname}:8080`;
    }
    if (window.location.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
  }
  return 'http://localhost:8080';
}

export const API_ORIGIN = getServerOrigin();
