# save as auto_patch.py and run: python auto_patch.py
import os

files = {
    "app.json": '''{
  "expo": {
    "name": "單車助手",
    "android": {
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "WAKE_LOCK"
      ]
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "需要背景定位權限以記錄您的騎乘軌跡。"
        }
      ]
    ]
  }
}''',

    "Database.ts": '''import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('bike_assistant.db');

export const initDatabase = async () => {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS track_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        speed REAL,
        timestamp INTEGER NOT NULL
      );
    `);
  } catch (error) { console.error('DB Init Error:', error); }
};

export const insertTrackPoint = async (rideId: string, lat: number, lng: number, alt: number | null, speed: number | null, timestamp: number) => {
  try {
    await db.runAsync(
      `INSERT INTO track_points (ride_id, latitude, longitude, altitude, speed, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [rideId, lat, lng, alt, speed, timestamp]
    );
  } catch (error) { console.error('Insert Point Error:', error); }
};

export const getTrackPointsByRideId = async (rideId: string) => {
  try {
    return await db.getAllAsync(
      `SELECT latitude, longitude FROM track_points WHERE ride_id = ? ORDER BY timestamp ASC`,
      [rideId]
    ) as { latitude: number; longitude: number }[];
  } catch (error) { return []; }
};''',

    "RideMetrics.ts": '''const POWER_LIMIT = 1500;
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
};''',

    "LocationTaskManager.ts": '''import * as TaskManager from 'expo-task-manager';
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
};''',

    "RideScreen.tsx": '''import React, { useState, useEffect, useRef } from 'react';
import { View, AppState, AppStateStatus, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Brightness from 'expo-brightness';
import * as Location from 'expo-location';
import uuid from 'react-native-uuid';
import { startBackgroundTracking, stopBackgroundTracking } from './LocationTaskManager';
import { initDatabase, getTrackPointsByRideId } from './Database';

const mapCustomStyle = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] }
];

export const RideScreen = () => {
  const [isRiding, setIsRiding] = useState<boolean>(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const syncInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initDatabase();
    
    const requestPermissions = async () => {
      await Location.requestForegroundPermissionsAsync();
      await Location.requestBackgroundPermissionsAsync();
    };
    requestPermissions();

    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') await Brightness.useSystemBrightnessAsync();
        
        if (isRiding && currentRideId) {
          syncRouteFromDB(currentRideId);
        }
      }
    });

    return () => {
      subscription.remove();
      if (syncInterval.current) clearInterval(syncInterval.current);
    };
  }, [isRiding, currentRideId]);

  const syncRouteFromDB = async (rideId: string) => {
    const points = await getTrackPointsByRideId(rideId);
    if (points.length > 0) setRouteCoordinates(points);
  };

  const handleToggleRide = async () => {
    if (isRiding) {
      await stopBackgroundTracking();
      setIsRiding(false);
      if (syncInterval.current) clearInterval(syncInterval.current);
    } else {
      const newRideId = uuid.v4().toString();
      setCurrentRideId(newRideId);
      setRouteCoordinates([]);
      
      await startBackgroundTracking(newRideId);
      setIsRiding(true);

      syncInterval.current = setInterval(() => {
        syncRouteFromDB(newRideId);
      }, 3000);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        customMapStyle={mapCustomStyle}
        showsUserLocation={true}
        followsUserLocation={isRiding}
      >
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FF3B30"
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        )}
        <Marker
          coordinate={{ latitude: 25.0330, longitude: 121.5654 }}
          title="補水點"
          image={require('./assets/icons/water-station.png')}
          style={{ width: 36, height: 36, transform: [{ scale: 1.5 }] }} 
        />
        <Marker
          coordinate={{ latitude: 25.0340, longitude: 121.5664 }}
          title="拍照打卡點"
          image={require('./assets/icons/photo-spot.png')}
          style={{ width: 40, height: 40, transform: [{ scale: 1.5 }] }} 
        />
      </MapView>

      <TouchableOpacity 
        onPress={handleToggleRide}
        style={{
          position: 'absolute', bottom: 40, alignSelf: 'center',
          backgroundColor: isRiding ? 'red' : 'green',
          padding: 20, borderRadius: 50
        }}
      >
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          {isRiding ? '結束騎乘' : '開始騎乘'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};'''
}

for path, content in files.items():
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')
    print(f"✅ 成功覆寫: {path}")

print("\n🎉 5 個核心檔案已全部寫入完成！")