import { useEffect, useState } from "react";
import {
  Text,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type TextProps,
  type TextStyle,
} from "react-native";

export interface AdaptiveFormTextProps extends TextProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  /** Preferred size before an overflow causes a reduction. */
  baseFontSize: number;
  /** Smallest readable scale. Remaining content wraps instead of truncating. */
  minFontScale?: number;
  /** Number of rendered lines allowed before reducing the font size. */
  maxLinesBeforeShrink?: number;
}

/**
 * Preserves complete form labels across locales. It measures the rendered line
 * count, lowers the font in small increments when necessary, and intentionally
 * keeps wrapping enabled at the minimum scale rather than ellipsizing content.
 */
export function AdaptiveFormText({
  children,
  style,
  baseFontSize,
  minFontScale = 0.78,
  maxLinesBeforeShrink = 2,
  onTextLayout,
  ...props
}: AdaptiveFormTextProps) {
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    setFontScale(1);
  }, [children, baseFontSize, minFontScale, maxLinesBeforeShrink]);

  const handleTextLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const hasTooManyLines = event.nativeEvent.lines.length > maxLinesBeforeShrink;
    if (hasTooManyLines && fontScale > minFontScale) {
      setFontScale((current) => Math.max(minFontScale, Number((current - 0.06).toFixed(2))));
    }
    onTextLayout?.(event);
  };

  return (
    <Text
      {...props}
      onTextLayout={handleTextLayout}
      style={[style, { fontSize: baseFontSize * fontScale, flexShrink: 1, flexWrap: "wrap" }]}
    >
      {children}
    </Text>
  );
}
