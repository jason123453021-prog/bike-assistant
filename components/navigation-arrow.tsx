import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { useColors } from '@/hooks/use-colors';

interface NavigationArrowProps {
  heading?: number; // GPS heading (0-360 degrees)
  size?: number; // Arrow size (default: 48)
}

/**
 * Navigation Arrow Component
 * Displays a blue triangle arrow that rotates based on device heading (gyroscope + GPS)
 * Mimics Google Maps navigation arrow
 */
export function NavigationArrow({
  heading = 0,
  size = 48,
}: NavigationArrowProps) {
  const colors = useColors();
  const [rotation] = useState(new Animated.Value(0));
  const [gyroHeading, setGyroHeading] = useState(0);

  // Subscribe to gyroscope data
  useEffect(() => {
    let subscription: any;

    const subscribe = async () => {
      // Request permission if needed (iOS 13+)
      const { status } = await DeviceMotion.requestPermissionsAsync?.() || { status: 'granted' };
      
      if (status === 'granted') {
        DeviceMotion.setUpdateInterval(100); // Update every 100ms

        subscription = DeviceMotion.addListener((data) => {
          // Calculate heading from device motion data (alpha, beta, gamma)
          // alpha: rotation around z-axis (0-360)
          // beta: rotation around x-axis (-180 to 180)
          // gamma: rotation around y-axis (-90 to 90)
          const alpha = data.rotation.alpha || 0;
          const beta = data.rotation.beta || 0;
          const gamma = data.rotation.gamma || 0;

          // Use alpha as the primary heading indicator
          setGyroHeading((alpha + 360) % 360);
        });
      }
    };

    subscribe();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Combine GPS heading and gyro heading for final rotation
  const finalHeading = heading + gyroHeading;

  // Animate rotation
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: finalHeading,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [finalHeading, rotation]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.arrow,
          {
            width: size,
            height: size,
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      >
        {/* Blue Triangle Arrow */}
        <View
          style={[
            styles.arrowShape,
            {
              width: size,
              height: size,
              borderLeftWidth: size / 2,
              borderRightWidth: size / 2,
              borderBottomWidth: size,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.primary,
            },
          ]}
        />

        {/* Center dot for reference */}
        <View
          style={[
            styles.centerDot,
            {
              width: size * 0.3,
              height: size * 0.3,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowShape: {
    position: 'absolute',
  },
  centerDot: {
    borderRadius: 100,
    position: 'absolute',
  },
});
