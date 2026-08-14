import { useEffect, useState } from "react";
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.4;
const { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT } = Dimensions.get("window");
type PhotoOrientation = "portrait" | "landscape" | "square";

function resolvePhotoOrientation(width: number, height: number): PhotoOrientation {
  if (height > width * 1.08) return "portrait";
  if (width > height * 1.08) return "landscape";
  return "square";
}

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
  fillContainer?: boolean;
}

interface PhotoDimensions {
  width: number;
  height: number;
}

/**
 * 全螢幕活動照片的純手勢縮放容器。
 * 僅使用專案既有的 Gesture Handler 與 Reanimated，避免新增原生模組；
 * 以雙指縮放與雙擊切換 1× / 2.4×，並在切換照片時自動還原。
 */
export function ZoomableActivityPhoto({ uri, resetKey, fillContainer = false }: ZoomableActivityPhotoProps) {
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const savedTranslationX = useSharedValue(0);
  const savedTranslationY = useSharedValue(0);
  const focusAdjusting = useSharedValue(false);
  const [orientation, setOrientation] = useState<PhotoOrientation>("landscape");
  const [photoSize, setPhotoSize] = useState<PhotoDimensions | null>(null);
  const [containerSize, setContainerSize] = useState<PhotoDimensions>({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });
  const [manualFocusY, setManualFocusY] = useState<number | null>(null);
  const [isFocusAdjusting, setIsFocusAdjusting] = useState(false);
  const [isFullPhotoMode, setIsFullPhotoMode] = useState(false);

  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (active) {
          setPhotoSize({ width, height });
          setOrientation(resolvePhotoOrientation(width, height));
        }
      },
      () => {
        if (active) {
          setPhotoSize(null);
          setOrientation("landscape");
        }
      },
    );
    return () => { active = false; };
  }, [uri]);

  useEffect(() => {
    scale.value = withTiming(MIN_SCALE, { duration: 160 });
    savedScale.value = MIN_SCALE;
    translationX.value = withTiming(0, { duration: 160 });
    translationY.value = withTiming(0, { duration: 160 });
    savedTranslationX.value = 0;
    savedTranslationY.value = 0;
    focusAdjusting.value = false;
    setManualFocusY(null);
    setIsFocusAdjusting(false);
    setIsFullPhotoMode(false);
  }, [focusAdjusting, resetKey, savedScale, savedTranslationX, savedTranslationY, scale, translationX, translationY]);

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
      if (focusAdjusting.value || savedScale.value > 1.05) stateManager.activate();
      else stateManager.fail();
    })
    .onUpdate((event) => {
      if (focusAdjusting.value) {
        translationX.value = 0;
        translationY.value = event.translationY;
        return;
      }
      const currentScale = Math.max(MIN_SCALE, scale.value);
      translationX.value = clampTranslation(savedTranslationX.value + event.translationX, maxHorizontalTranslation(currentScale));
      translationY.value = clampTranslation(savedTranslationY.value + event.translationY, maxVerticalTranslation(currentScale));
    })
    .onEnd((event) => {
      if (focusAdjusting.value) {
        runOnJS(commitManualFocus)(event.translationY);
        focusAdjusting.value = false;
        runOnJS(setIsFocusAdjusting)(false);
        translationX.value = withTiming(0, { duration: 160 });
        translationY.value = withTiming(0, { duration: 160 });
        savedTranslationX.value = 0;
        savedTranslationY.value = 0;
        return;
      }
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

  const defaultFocusY = orientation === "portrait" ? 0.28 : orientation === "square" ? 0.42 : 0.5;
  const usingCoverCrop = fillContainer && !isFullPhotoMode;

  const commitManualFocus = (dragY: number) => {
    if (!photoSize || !usingCoverCrop) return;
    const scaleToFill = Math.max(containerSize.width / photoSize.width, containerSize.height / photoSize.height);
    const verticalExcess = Math.max(0, photoSize.height * scaleToFill - containerSize.height);
    if (verticalExcess <= 0) return;
    setManualFocusY((current) => Math.min(0.94, Math.max(0.06, (current ?? defaultFocusY) - dragY / verticalExcess)));
  };

  const coverImageStyle = (() => {
    if (!usingCoverCrop || !photoSize || photoSize.width <= 0 || photoSize.height <= 0) return null;
    const scaleToFill = Math.max(containerSize.width / photoSize.width, containerSize.height / photoSize.height);
    const width = photoSize.width * scaleToFill;
    const height = photoSize.height * scaleToFill;
    const verticalExcess = Math.max(0, height - containerSize.height);
    const horizontalExcess = Math.max(0, width - containerSize.width);
    const verticalFocus = manualFocusY ?? defaultFocusY;
    return {
      position: "absolute" as const,
      width,
      height,
      left: -horizontalExcess / 2,
      top: -verticalExcess * verticalFocus,
    };
  })();

  const longPressGesture = Gesture.LongPress()
    .minDuration(420)
    .onStart(() => {
      if (!usingCoverCrop) return;
      focusAdjusting.value = true;
      runOnJS(setIsFocusAdjusting)(true);
    });

  return (
    <View
      style={[styles.container, fillContainer && styles.containerFill]}
      accessible
      accessibilityLabel="活動照片；雙擊可放大或還原，雙指可縮放，放大後可單指拖曳平移"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setContainerSize({ width, height });
      }}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, doubleTapGesture, panGesture, longPressGesture)}>
        <Animated.View style={[styles.imageContainer, imageAnimationStyle]}>
          <Image
            source={{ uri }}
            style={[
              styles.image,
              fillContainer && styles.imageFill,
              coverImageStyle,
            ]}
            resizeMode={usingCoverCrop ? "cover" : "contain"}
          />
        </Animated.View>
      </GestureDetector>
      {fillContainer ? (
        <View style={styles.photoControls} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [styles.photoModeButton, { opacity: pressed ? 0.72 : 1 }]}
            onPress={() => {
              setIsFullPhotoMode((value) => !value);
              setIsFocusAdjusting(false);
              focusAdjusting.value = false;
              translationX.value = withTiming(0, { duration: 140 });
              translationY.value = withTiming(0, { duration: 140 });
              savedTranslationX.value = 0;
              savedTranslationY.value = 0;
            }}
          >
            <Text style={styles.photoModeButtonText}>{isFullPhotoMode ? "裁切滿版" : "完整照片"}</Text>
          </Pressable>
          {usingCoverCrop ? <Text style={styles.photoFocusHint}>{isFocusAdjusting ? "拖曳調整焦點" : "長按後上下拖曳調整焦點"}</Text> : null}
        </View>
      ) : null}
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
  containerFill: { height: "100%" },
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
  imageFill: { width: "100%", height: "100%" },
  photoControls: { position: "absolute", right: 16, bottom: 16, alignItems: "flex-end", gap: 8 },
  photoModeButton: { backgroundColor: "rgba(0,0,0,0.68)", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
  photoModeButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  photoFocusHint: { color: "rgba(255,255,255,0.92)", fontSize: 10, fontWeight: "700", backgroundColor: "rgba(0,0,0,0.56)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
});
