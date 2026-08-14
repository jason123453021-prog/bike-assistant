import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.4;

function clampScale(value: number) {
  "worklet";
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

interface ZoomableActivityPhotoProps {
  uri: string;
  resetKey: string;
}

/**
 * 全螢幕活動照片的純手勢縮放容器。
 * 僅使用專案既有的 Gesture Handler 與 Reanimated，避免新增原生模組；
 * 以雙指縮放與雙擊切換 1× / 2.4×，並在切換照片時自動還原。
 */
export function ZoomableActivityPhoto({ uri, resetKey }: ZoomableActivityPhotoProps) {
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);

  useEffect(() => {
    scale.value = withTiming(MIN_SCALE, { duration: 160 });
    savedScale.value = MIN_SCALE;
  }, [resetKey, savedScale, scale]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clampScale(savedScale.value * event.scale);
    })
    .onEnd(() => {
      const settledScale = scale.value < 1.05 ? MIN_SCALE : scale.value;
      scale.value = withTiming(settledScale, { duration: 160 });
      savedScale.value = settledScale;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(240)
    .onEnd((_event, success) => {
      if (!success) return;
      const nextScale = savedScale.value > 1.05 ? MIN_SCALE : DOUBLE_TAP_SCALE;
      scale.value = withTiming(nextScale, { duration: 180 });
      savedScale.value = nextScale;
    });

  const imageAnimationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container} accessible accessibilityLabel="活動照片；雙擊可放大或還原，雙指可縮放">
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, doubleTapGesture)}>
        <Animated.View style={[styles.imageContainer, imageAnimationStyle]}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "82%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
