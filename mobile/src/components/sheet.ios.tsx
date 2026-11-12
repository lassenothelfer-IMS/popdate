import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import {
  interactiveDismissDisabled,
  presentationBackground,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { requireOptionalNativeModule } from 'expo';
import { StyleSheet, View } from 'react-native';

import { CustomSheet, type SheetProps } from '@/components/sheet-custom';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { SheetProps };

/** The system sheet lives in a native module; a build without it keeps the sheet the app draws. */
const nativeSheet = requireOptionalNativeModule('ExpoUI') !== null;

/**
 * A bottom sheet, as iOS presents one: the system's corners, grabber and dim,
 * as tall as what is in it, pulled down to close, and moved up by the keyboard.
 * The content is the app's own, on the app's sheet color.
 */
export function Sheet(props: SheetProps) {
  const theme = useTheme();
  if (!nativeSheet) return <CustomSheet {...props} />;

  const { visible, onClose, title, locked = false, children } = props;
  return (
    <Host style={styles.host} pointerEvents="none">
      <BottomSheet
        isPresented={visible}
        fitToContents
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}>
        <Group
          modifiers={[
            presentationDragIndicator('visible'),
            presentationBackground(theme.sheet),
            interactiveDismissDisabled(locked),
          ]}>
          {/* As wide as the sheet, as tall as the content. */}
          <RNHostView matchContents={{ vertical: true }}>
            <View accessibilityViewIsModal style={styles.content}>
              {title ? (
                <ThemedText type="task" accessibilityRole="header" style={styles.title}>
                  {title}
                </ThemedText>
              ) : null}
              {children}
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
  },
  content: {
    paddingHorizontal: Gutter,
    // Clear of the system's grabber.
    paddingTop: Space.xl,
    paddingBottom: Space.md,
    gap: Space.md,
  },
  title: {
    textAlign: 'center',
  },
});
