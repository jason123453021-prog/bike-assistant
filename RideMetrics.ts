const POWER_LIMIT = 1500;
let speedQueue: number[] = [];
let elevationQueue: { alt: number; dist: number }[] = [];

export const calculateDistance = (loc1: any, loc2: any): number => {
  if (!loc1 || !loc2) return 0;
  const R = 6371e3;
  const φ1 = loc1.coords.latitude * Math.PI/180;
  const φ2 = loc2.coords.latitude * Math.PI/180;
  const Δφ = (loc2.coords.latitude-loc1.coords.latitude) * Math.PI/180;
  const Δλ = (loc2.coords.longitude-loc1.coords.longitude) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculatePower = (currentSpeedMs: number, gradient: number, riderWeight: number = 75): number => {
  speedQueue.push(currentSpeedMs);
  if (speedQueue.length > 3) speedQueue.shift();

  const avgSpeed = speedQueue.reduce((a, b) => a + b, 0) / speedQueue.length;
  
  const gravityForce = riderWeight * 9.81 * Math.sin(Math.atan(gradient / 100));
  const rollingResistance = riderWeight * 9.81 * Math.cos(Math.atan(gradient / 100)) * 0.004;
  const airResistance = 0.5 * 1.225 * 0.4 * Math.pow(avgSpeed, 2);
  
  let totalPower = (gravityForce + rollingResistance + airResistance) * avgSpeed;
  totalPower = Math.max(0, totalPower);
  return Math.min(totalPower, POWER_LIMIT);
};

export const calculateSustainedGradient = (currentAlt: number, accumulatedDist: number): number => {
  elevationQueue.push({ alt: currentAlt, dist: accumulatedDist });

  const referencePoint = elevationQueue.find(
    point => (accumulatedDist - point.dist) >= 40
  );

  if (referencePoint) {
    const deltaAlt = currentAlt - referencePoint.alt;
    const deltaDist = accumulatedDist - referencePoint.dist;
    elevationQueue = elevationQueue.filter(point => (accumulatedDist - point.dist) <= 100);
    return (deltaAlt / deltaDist) * 100;
  }
  return 0;
};
