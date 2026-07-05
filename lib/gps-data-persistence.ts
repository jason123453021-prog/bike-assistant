import { MMKVBridge } from './mmkv-bridge';

interface GPSDataPoint {
  lat: number;
  lon: number;
  speed: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
}

interface RideSession {
  id: string;
  startTime: number;
  endTime?: number;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  maxSpeed: number;
  totalElevation: number;
  gpsDataKey: string;
  status: 'active' | 'paused' | 'completed';
}

/**
 * GPS Data Persistence Manager
 * Handles real-time GPS data writes to MMKV for crash recovery
 * Writes every 5-10 seconds to balance performance and data safety
 */
export class GPSDataPersistence {
  private static readonly RIDE_SESSION_KEY = 'ride_session_current';
  private static readonly GPS_DATA_KEY_PREFIX = 'gps_data_';
  private static readonly RIDE_STATS_KEY_PREFIX = 'ride_stats_';
  private static writeInterval: ReturnType<typeof setInterval> | null = null;
  private static pendingGPSData: GPSDataPoint[] = [];

  /**
   * Initialize a new ride session
   */
  static async initializeRideSession(rideId: string): Promise<void> {
    try {
      const session: RideSession = {
        id: rideId,
        startTime: Date.now(),
        totalDistance: 0,
        totalTime: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        totalElevation: 0,
        gpsDataKey: `${GPSDataPersistence.GPS_DATA_KEY_PREFIX}${rideId}`,
        status: 'active',
      };

      await MMKVBridge.setObject(GPSDataPersistence.RIDE_SESSION_KEY, session);
      console.log('GPSDataPersistence: Ride session initialized -', rideId);
    } catch (error) {
      console.error('GPSDataPersistence: Failed to initialize ride session -', error);
    }
  }

  /**
   * Add GPS data point to pending queue
   * Data is written to MMKV in batches every 5-10 seconds
   */
  static async addGPSDataPoint(point: GPSDataPoint): Promise<void> {
    GPSDataPersistence.pendingGPSData.push(point);

    // Start batch write interval if not already running
    if (!GPSDataPersistence.writeInterval) {
      GPSDataPersistence.startBatchWrite();
    }
  }

  /**
   * Start batch write interval (every 5-10 seconds)
   */
  private static startBatchWrite(): void {
    GPSDataPersistence.writeInterval = setInterval(async () => {
      if (GPSDataPersistence.pendingGPSData.length === 0) {
        return;
      }

      try {
        const session = await MMKVBridge.getObject(GPSDataPersistence.RIDE_SESSION_KEY) as RideSession;
        if (!session) {
          console.warn('GPSDataPersistence: No active ride session');
          return;
        }

        // Write all pending GPS data points
        for (const point of GPSDataPersistence.pendingGPSData) {
          await MMKVBridge.appendGPSData(
            session.gpsDataKey,
            point.lat,
            point.lon,
            point.speed,
            point.timestamp
          );
        }

        console.log(`GPSDataPersistence: Wrote ${GPSDataPersistence.pendingGPSData.length} GPS points`);
        GPSDataPersistence.pendingGPSData = [];
      } catch (error) {
        console.error('GPSDataPersistence: Failed to write GPS data -', error);
      }
    }, 5000); // Write every 5 seconds
  }

  /**
   * Stop batch write interval
   */
  private static stopBatchWrite(): void {
    if (GPSDataPersistence.writeInterval) {
      clearInterval(GPSDataPersistence.writeInterval);
      GPSDataPersistence.writeInterval = null;
    }
  }

  /**
   * Update ride statistics
   */
  static async updateRideStats(stats: Partial<RideSession>): Promise<void> {
    try {
      const session = await MMKVBridge.getObject(GPSDataPersistence.RIDE_SESSION_KEY) as RideSession;
      if (!session) {
        console.warn('GPSDataPersistence: No active ride session');
        return;
      }

      const updatedSession = { ...session, ...stats };
      await MMKVBridge.setObject(GPSDataPersistence.RIDE_SESSION_KEY, updatedSession);
    } catch (error) {
      console.error('GPSDataPersistence: Failed to update ride stats -', error);
    }
  }

  /**
   * Get current ride session
   */
  static async getCurrentRideSession(): Promise<RideSession | null> {
    try {
      return await MMKVBridge.getObject(GPSDataPersistence.RIDE_SESSION_KEY) as RideSession | null;
    } catch (error) {
      console.error('GPSDataPersistence: Failed to get ride session -', error);
      return null;
    }
  }

  /**
   * Get GPS data for current ride
   */
  static async getCurrentGPSData(): Promise<GPSDataPoint[]> {
    try {
      const session = await GPSDataPersistence.getCurrentRideSession();
      if (!session) {
        return [];
      }

      const data = await MMKVBridge.getGPSData(session.gpsDataKey);
      return data || [];
    } catch (error) {
      console.error('GPSDataPersistence: Failed to get GPS data -', error);
      return [];
    }
  }

  /**
   * Pause ride session
   */
  static async pauseRideSession(): Promise<void> {
    try {
      GPSDataPersistence.stopBatchWrite();
      const session = await MMKVBridge.getObject(GPSDataPersistence.RIDE_SESSION_KEY) as RideSession;
      if (session) {
        await MMKVBridge.setObject(GPSDataPersistence.RIDE_SESSION_KEY, {
          ...session,
          status: 'paused',
        });
      }
    } catch (error) {
      console.error('GPSDataPersistence: Failed to pause ride session -', error);
    }
  }

  /**
   * Resume ride session
   */
  static async resumeRideSession(): Promise<void> {
    try {
      const session = await MMKVBridge.getObject(GPSDataPersistence.RIDE_SESSION_KEY) as RideSession;
      if (session) {
        await MMKVBridge.setObject(GPSDataPersistence.RIDE_SESSION_KEY, {
          ...session,
          status: 'active',
        });
        GPSDataPersistence.startBatchWrite();
      }
    } catch (error) {
      console.error('GPSDataPersistence: Failed to resume ride session -', error);
    }
  }

  /**
   * Complete ride session
   */
  static async completeRideSession(): Promise<void> {
    try {
      GPSDataPersistence.stopBatchWrite();

      // Flush any remaining pending GPS data
      const session = await MMKVBridge.getObject(GPSDataPersistence.RIDE_SESSION_KEY) as RideSession;
      if (session && GPSDataPersistence.pendingGPSData.length > 0) {
        for (const point of GPSDataPersistence.pendingGPSData) {
          await MMKVBridge.appendGPSData(
            session.gpsDataKey,
            point.lat,
            point.lon,
            point.speed,
            point.timestamp
          );
        }
        GPSDataPersistence.pendingGPSData = [];
      }

      // Mark session as completed
      if (session) {
        await MMKVBridge.setObject(GPSDataPersistence.RIDE_SESSION_KEY, {
          ...session,
          endTime: Date.now(),
          status: 'completed',
        });
      }

      console.log('GPSDataPersistence: Ride session completed');
    } catch (error) {
      console.error('GPSDataPersistence: Failed to complete ride session -', error);
    }
  }

  /**
   * Check if there's an incomplete ride session (for crash recovery)
   */
  static async hasIncompleteRideSession(): Promise<boolean> {
    try {
      const session = await GPSDataPersistence.getCurrentRideSession();
      return session != null && session.status !== 'completed';
    } catch (error) {
      console.error('GPSDataPersistence: Failed to check incomplete ride session -', error);
      return false;
    }
  }

  /**
   * Recover incomplete ride session
   */
  static async recoverIncompleteRideSession(): Promise<RideSession | null> {
    try {
      const session = await GPSDataPersistence.getCurrentRideSession();
      if (session && session.status !== 'completed') {
        // Resume the session
        await GPSDataPersistence.resumeRideSession();
        return session;
      }
      return null;
    } catch (error) {
      console.error('GPSDataPersistence: Failed to recover incomplete ride session -', error);
      return null;
    }
  }

  /**
   * Clear ride session
   */
  static async clearRideSession(): Promise<void> {
    try {
      GPSDataPersistence.stopBatchWrite();
      GPSDataPersistence.pendingGPSData = [];
      await MMKVBridge.removeKey(GPSDataPersistence.RIDE_SESSION_KEY);
    } catch (error) {
      console.error('GPSDataPersistence: Failed to clear ride session -', error);
    }
  }
}


