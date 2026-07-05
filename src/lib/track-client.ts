export function sendTrackBeacon(path: string, data: object): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  return navigator.sendBeacon(path, blob);
}
