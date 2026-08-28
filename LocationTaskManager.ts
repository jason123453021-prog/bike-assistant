import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertTrackPoint } from './Database';
import { calculateDistance } from './RideMetrics';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
let accumulatedDistance = 0;
let lastLapDistance = 0;
let lastLocation: Location.LocationObject | null = null;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const latestLocation = locations[locations.length - 1];
  const currentRideId = await AsyncStorage.getItem('currentRideId');
  
  if (currentRideId) {
    await insertTrackPoint(
      currentRideId, latestLocation.coords.latitude, latestLocation.coords.longitude,
      latestLocation.coords.altitude, latestLocation.coords.speed, latestLocation.timestamp
    );
  }

  if (lastLocation) {
    accumulatedDistance += calculateDistance(lastLocation, latestLocation);
    if (accumulatedDistance - lastLapDistance >= 5000) {
      lastLapDistance = accumulatedDistance;
      console.log(`自動分圈觸發：已達 ${accumulatedDistance} 公尺`);
    }
  }
  lastLocation = latestLocation;
});

export const startBackgroundTracking = async (rideId: string) => {
  await AsyncStorage.setItem('currentRideId', rideId);
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Highest, distanceInterval: 2,
    deferredUpdatesInterval: 1000, pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: '單車助手', notificationBody: '正在背景精準紀錄您的騎乘軌跡', notificationColor: '#007AFF',
    },
  });
};

export const stopBackgroundTracking = async () => {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await AsyncStorage.removeItem('currentRideId');
  accumulatedDistance = 0; lastLapDistance = 0; lastLocation = null;
};
