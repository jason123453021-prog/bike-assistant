import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge, useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
  /**
   * Override default bottom padding. If not provided, uses insets.bottom.
   * Useful for pages that need custom bottom spacing.
   * See: docs/UI_SAFE_AREA_KNOWLEDGE_POINT.md
   */
  bottomPaddingOverride?: number;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 *
 * **IMPORTANT**: This component automatically handles system navigation bar (insets.bottom)
 * to prevent UI elements from being hidden behind the system navigation bar on Android.
 * This follows the global UI safe area knowledge point.
 *
 * See: docs/UI_SAFE_AREA_KNOWLEDGE_POINT.md for detailed guidelines.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 *
 * With custom bottom padding:
 * ```tsx
 * <ScreenContainer className="p-4" bottomPaddingOverride={16}>
 *   Content here
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  bottomPaddingOverride,
  style,
  ...props
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  // Dynamic bottom padding calculation to prevent UI from being hidden behind system navigation bar
  // Uses Math.max to ensure minimum spacing is maintained
  // If system has navigation bar (insets.bottom > 0), uses that height
  // Otherwise uses override value or defaults to 0
  const bottomPadding = bottomPaddingOverride
    ? Math.max(insets.bottom, bottomPaddingOverride)
    : insets.bottom;

  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      style={{ backgroundColor: colors.background }}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={[style, { paddingBottom: bottomPadding }]}
      >
        <View className={cn("flex-1", className)}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
