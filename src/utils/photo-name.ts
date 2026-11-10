export function photoName(takenAt: Date) {
  return `${takenAt.toISOString().replace(/:/g, '-')}.png`;
}
