export function normalizeResolutionTime(resolutionTime: string | undefined): string | undefined {
  if (!resolutionTime) return undefined;
  
  if (!isNaN(Number(resolutionTime))) {
    return new Date(Number(resolutionTime)).toISOString();
  }
  
  return resolutionTime;
} 