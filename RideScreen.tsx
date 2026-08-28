import React, { useState, useEffect, useRef } from 'react';
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
};
