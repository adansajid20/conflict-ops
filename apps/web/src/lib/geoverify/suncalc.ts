export type SunPosition = { azimuth: number; elevation: number }

const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545
const E = RAD * 23.4397

function toJulian(date: Date) { return date.getTime() / DAY_MS - 0.5 + J1970 }
function toDays(date: Date) { return toJulian(date) - J2000 }
function rightAscension(l: number, b: number) { return Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l)) }
function declination(l: number, b: number) { return Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l)) }
function solarMeanAnomaly(d: number) { return RAD * (357.5291 + 0.98560028 * d) }
function eclipticLongitude(m: number) {
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m))
  const p = RAD * 102.9372
  return m + c + p + Math.PI
}
function siderealTime(d: number, lw: number) { return RAD * (280.16 + 360.9856235 * d) - lw }
function altitude(h: number, phi: number, dec: number) { return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)) }
function azimuth(h: number, phi: number, dec: number) { return Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) }
export function getSunPosition(dateInput: string | Date, lat: number, lng: number): SunPosition {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(date)
  const m = solarMeanAnomaly(d)
  const l = eclipticLongitude(m)
  const dec = declination(l, 0)
  const ra = rightAscension(l, 0)
  const h = siderealTime(d, lw) - ra
  return {
    azimuth: (azimuth(h, phi, dec) / RAD + 180 + 360) % 360,
    elevation: altitude(h, phi, dec) / RAD,
  }
}
