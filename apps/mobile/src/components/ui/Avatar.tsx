import { Image, StyleSheet, View } from 'react-native';
import { getInitials } from '@shark/utils';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';

export interface AvatarProps {
  readonly name: string;
  readonly imageUrl?: string | null;
  readonly size?: number;
  readonly shape?: 'circle' | 'rounded-square';
}

export function Avatar({ name, imageUrl, size = 48, shape = 'circle' }: AvatarProps) {
  const borderRadius = shape === 'circle' ? mobileTheme.radii.pill : mobileTheme.radii.sm;

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: mobileTheme.colors.interactive.primaryTint,
          borderColor: mobileTheme.colors.border.subtle,
        },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius }}
          accessibilityLabel={name}
        />
      ) : (
        <AppText
          variant={size >= 56 ? 'h3' : 'bodyBase'}
          weight="700"
          color={mobileTheme.colors.text.brand}
          align="center"
        >
          {getInitials(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
