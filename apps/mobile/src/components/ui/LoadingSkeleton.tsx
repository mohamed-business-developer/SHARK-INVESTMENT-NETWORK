import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import type { LoadingSkeletonPreset } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';

export interface LoadingSkeletonProps {
  readonly preset: LoadingSkeletonPreset;
  readonly count?: number;
}

function SkeletonBone({
  width,
  height,
  borderRadius = mobileTheme.radii.sm,
  opacity,
}: {
  readonly width: number | `${number}%`;
  readonly height: number;
  readonly borderRadius?: number;
  readonly opacity: Animated.Value | number;
}) {
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: mobileTheme.colors.bg.surfaceSubtle,
        opacity,
      }}
    />
  );
}

export function LoadingSkeleton({ preset, count = 3 }: LoadingSkeletonProps) {
  const { direction, t } = useLocale();
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse, reduceMotion]);

  const opacityValue = reduceMotion ? 1 : pulse;
  const items = Array.from({ length: count }, (_, idx) => idx);

  return (
    <View
      accessible
      accessibilityLabel={t.common.loading}
      accessibilityState={{ busy: true }}
      style={[styles.stack, { direction }]}
    >
      {items.map((idx) => (
        <View key={`${preset}-${idx}`} style={[styles.cardBone, { direction }]}>
          <View style={[styles.row, { direction }]}>
            <SkeletonBone
              width={48}
              height={48}
              borderRadius={
                preset === 'company_card' ? mobileTheme.radii.sm : mobileTheme.radii.pill
              }
              opacity={opacityValue}
            />
            <View style={styles.col}>
              <SkeletonBone width="65%" height={16} opacity={opacityValue} />
              <SkeletonBone width="45%" height={12} opacity={opacityValue} />
            </View>
          </View>
          <SkeletonBone width="100%" height={44} opacity={opacityValue} />
          <View style={[styles.chipsRow, { direction }]}>
            <SkeletonBone
              width={84}
              height={24}
              borderRadius={mobileTheme.radii.pill}
              opacity={opacityValue}
            />
            <SkeletonBone
              width={96}
              height={24}
              borderRadius={mobileTheme.radii.pill}
              opacity={opacityValue}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileTheme.space[3],
  },
  cardBone: {
    backgroundColor: mobileTheme.colors.bg.surface,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border.subtle,
    padding: mobileTheme.space[4],
    gap: mobileTheme.space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[3],
  },
  col: {
    flex: 1,
    gap: mobileTheme.space[2],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: mobileTheme.space[2],
  },
});
