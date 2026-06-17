import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Navigation tabs
  "house.fill":                          "directions-bike",
  "map.fill":                            "map",
  "clock.fill":                          "history",
  "gearshape.fill":                      "settings",
  // Ride screen
  "play.fill":                           "play-arrow",
  "pause.fill":                          "pause",
  "stop.fill":                           "stop",
  "bolt.fill":                           "flash-on",
  "wind":                                "air",
  "thermometer":                         "thermostat",
  "drop.fill":                           "water-drop",
  "flame.fill":                          "local-fire-department",
  "arrow.up":                            "arrow-upward",
  "arrow.down":                          "arrow-downward",
  "arrow.left":                          "arrow-back",
  "arrow.right":                         "arrow-forward",
  // Navigation
  "location.fill":                       "my-location",
  "doc.fill":                            "description",
  "square.and.arrow.up":                 "share",
  // Settings
  "bicycle":                             "directions-bike",
  "person.fill":                         "person",
  "bell.fill":                           "notifications",
  "speaker.wave.2.fill":                 "volume-up",
  "iphone.radiowaves.left.and.right":    "vibration",
  "moon.fill":                           "dark-mode",
  "chevron.right":                       "chevron-right",
  "chevron.left.forwardslash.chevron.right": "code",
  "paperplane.fill":                     "send",
  "checkmark.circle.fill":               "check-circle",
  "xmark.circle.fill":                   "cancel",
  "plus.circle.fill":                    "add-circle",
  "minus.circle.fill":                   "remove-circle",
  "info.circle.fill":                    "info",
  "exclamationmark.triangle.fill":       "warning",
  "speedometer":                         "speed",
  "waveform.path.ecg":                   "monitor-heart",
  "music.note":                          "music-note",
  "pencil":                               "edit",
  "magnifyingglass":                       "search",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name as string] ?? "help-outline";
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
