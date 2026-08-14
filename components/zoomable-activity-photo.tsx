import { useEffect } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.4;
const { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT } = Dimensions.get("window");

function clampScale(value: number) {
  "worklet";
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function clampTranslation(value: number, limit: number) {
  "worklet";
  return Math.min(limit, Math.max(-limit, value));
}

function maxHorizontalTranslation(scale: number) {
  "worklet";
  return Math.max(0, ((scale - MIN_SCALE) * VIEWPORT_WIDTH) / 2);
}

function maxVerticalTranslation(scale: number) {
  "worklet";
  return Math.max(0, ((scale - MIN_SCALE) * VIEWPORT_HEIGHT * 0.82) / 2);
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
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(MIN_SCALE, { duration: 160 });
    savedScale.value = MIN_SCALE;
    translationX.value = withTiming(0, { duration: 160 });
    translationY.value = withTiming(0, { duration: 160 });
    savedTranslationX.value = 0;
    savedTranslationY.value = 0;
  }, [resetKey, savedScale, savedTranslationX, savedTranslationY, scale, translationX, translationY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clampScale(savedScale.value * event.scale);
    })
    .onEnd(() => {
      const settledScale = scale.value < 1.05 ? MIN_SCALE : scale.value;
      scale.value = withTiming(settledScale, { duration: 160 });
      savedScale.value = settledScale;
      const nextTranslationX = settledScale === MIN_SCALE ? 0 : clampTranslation(translationX.value, maxHorizontalTranslation(settledScale));
      const nextTranslationY = settledScale === MIN_SCALE ? 0 : clampTranslation(translationY.value, maxVerticalTranslation(settledScale));
      translationX.value = withTiming(nextTranslationX, { duration: 160 });
      translationY.value = withTiming(nextTranslationY, { duration: 160 });
      savedTranslationX.value = nextTranslationX;
      savedTranslationY.value = nextTranslationY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(240)
    .onEnd((_event, success) => {
      if (!success) return;
      const nextScale = savedScale.value > 1.05 ? MIN_SCALE : DOUBLE_TAP_SCALE;
      scale.value = withTiming(nextScale, { duration: 180 });
      savedScale.value = nextScale;
      translationX.value = withTiming(0, { duration: 180 });
      translationY.value = withTiming(0, { duration: 180 });
      savedTranslationX.value = 0;
      savedTranslationY.value = 0;
    });

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesMove((_event, stateManager) => {
      if (savedScale.value > 1.05) stateManager.activate();
      else stateManager.fail();
    })
    .onUpdate((event) => {
      const currentScale = Math.max(MIN_SCALE, scale.value);
      translationX.value = clampTranslation(savedTranslationX.value + event.translationX, maxHorizontalTranslation(currentScale));
      translationY.value = clampTranslation(savedTranslationY.value + event.translationY, maxVerticalTranslation(currentScale));
    })
    .onEnd(() => {
      const currentScale = Math.max(MIN_SCALE, scale.value);
      const nextTranslationX = clampTranslation(translationX.value, maxHorizontalTranslation(currentScale));
      const nextTranslationY = clampTranslation(translationY.value, maxVerticalTranslation(currentScale));
      translationX.value = withTiming(nextTranslationX, { duration: 140 });
      translationY.value = withTiming(nextTranslationY, { duration: 140 });
      savedTranslationX.value = nextTranslationX;
      savedTranslationY.value = nextTranslationY;
    });

  const imageAnimationStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translationX.value },
      { translateY: translationY.value },
    ],
  }));

  return (
    <View style={styles.container} accessible accessibilityLabel="活動照片；雙擊可放大或還原，雙指可縮放，放大後可單指拖曳平移">
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, doubleTapGesture, panGesture)}>
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
