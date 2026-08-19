import type { SymbolWeight } from "expo-symbols";
import { Text, type OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

/**
 * Web 預覽不載入向量圖示字型，避免受限沙盒或弱網等待外部字型資源逾時。
 * Android/iOS 仍由 icon-symbol.tsx 使用原生 Material Icons/SF Symbols 對應。
 */
const WEB_GLYPHS: Record<string, string> = {
  "house.fill": "⌂", "map.fill": "⌖", "clock.fill": "◷", "gearshape.fill": "⚙",
  "battery.100": "▰", "play.fill": "▶", "pause.fill": "Ⅱ", "pause.circle.fill": "Ⅱ",
  "stop.fill": "■", "bolt.fill": "ϟ", "wind": "≋", "thermometer": "♨", "drop.fill": "●",
  "flame.fill": "♨", "arrow.up": "↑", "arrow.down": "↓", "arrow.left": "←", "arrow.right": "→",
  "location.fill": "⌖", "doc.fill": "▤", "square.and.arrow.up": "↗", "bicycle": "♧",
  "person.fill": "●", "bell.fill": "♩", "bell.badge.fill": "♩", "speaker.wave.2.fill": "⌁",
  "iphone.radiowaves.left.and.right": "≈", "moon.fill": "◐", "chevron.right": "›",
  "chevron.left.forwardslash.chevron.right": "‹›", "paperplane.fill": "➤", "checkmark.circle.fill": "✓",
  "xmark.circle.fill": "×", "plus.circle.fill": "+", "plus": "+", "minus.circle.fill": "−",
  "info.circle.fill": "i", "exclamationmark.triangle.fill": "!", "speedometer": "◴",
  "waveform.path.ecg": "⌁", "music.note": "♪", "pencil": "✎", "magnifyingglass": "⌕",
  "arrow.up.circle.fill": "↑", "arrow.down.circle.fill": "↓", "lock.fill": "▣", "location.north.fill": "⌖",
  "compass": "⌖", "person.2.fill": "♚", "person.badge.plus": "♚", "qrcode": "▦",
  "qrcode.viewfinder": "▦", "eye.slash.fill": "◉", "eye.fill": "◉", "wifi": "⌁", "wifi.slash": "⌁",
  "envelope.fill": "✉", "checkmark": "✓", "xmark": "×", "clock.badge.exclamationmark": "◷",
  "arrow.triangle.2.circlepath": "↻", "bolt.horizontal.fill": "ϟ", "chart.bar.fill": "▥",
  "moon.stars.fill": "◐", "sun.max.fill": "☼", "doc.text.fill": "▤", "trash.fill": "▣",
  "trash": "▣", "mappin.circle.fill": "⌖", "star.fill": "★", "heart": "♡", "heart.fill": "♥",
  "bag.fill": "▣", "arrow.counterclockwise": "↺", "arrow.down.doc": "↓", "chevron.left": "‹",
  "photo.fill": "▧", "arrow.up.left.and.arrow.down.right": "⤢",
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: keyof typeof WEB_GLYPHS;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[{ color, fontSize: size, lineHeight: Math.ceil(size * 1.1), textAlign: "center", includeFontPadding: false }, style]}
    >
      {WEB_GLYPHS[name] ?? "•"}
    </Text>
  );
}
