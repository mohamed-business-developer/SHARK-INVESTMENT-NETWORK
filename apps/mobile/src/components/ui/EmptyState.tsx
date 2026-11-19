import { StyleSheet, View } from 'react-native';
import type { EmptyStateVariant } from '@shark/shared-types';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { AppIcon, type SharkIconName } from './Icon';

export interface EmptyStateProps {
  readonly variant: EmptyStateVariant;
  readonly icon?: SharkIconName;
  readonly title: string;
  readonly description: string;
  readonly primaryAction?: { readonly label: string; readonly onPress: () => void };
  readonly secondaryAction?: { readonly label: string; readonly onPress: () => void };
}

function resolveDefaultIcon(variant: EmptyStateVariant): SharkIconName {
  switch (variant) {
    case 'no_search_results':
      return 'search';
    case 'restricted':
      return 'lock';
    case 'error':
      return 'wifiOff';
    default:
      return 'inbox';
  }
}

export function EmptyState({
  variant,
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  const { direction } = useLocale();
  const isError = variant === 'error';
  const resolvedIcon = icon ?? resolveDefaultIcon(variant);

  return (
    <View style={[styles.container, { direction }]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isError
              ? mobileTheme.colors.status.error.tint
              : mobileTheme.colors.interactive.primaryTint,
          },
        ]}
      >
        <AppIcon
          name={resolvedIcon}
          size={28}
          color={isError ? mobileTheme.colors.status.error.text : mobileTheme.colors.text.brand}
        />
      </View>

      <AppText variant="h3" align="center" color={mobileTheme.colors.text.primary}>
        {title}
      </AppText>

      <AppText
        variant="bodyBase"
        align="center"
        color={mobileTheme.colors.text.secondary}
        style={styles.description}
      >
        {description}
      </AppText>

      {primaryAction || secondaryAction ? (
        <View style={[styles.actionsRow, { direction }]}>
          {primaryAction ? (
            <Button variant="primary" label={primaryAction.label} onPress={primaryAction.onPress} />
          ) : null}
          {secondaryAction ? (
            <Button
              variant="secondary"
              label={secondaryAction.label}
              onPress={secondaryAction.onPress}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: mobileTheme.space[8],
    backgroundColor: mobileTheme.colors.bg.surface,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border.subtle,
    gap: mobileTheme.space[3],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: mobileTheme.radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: mobileTheme.space[1],
  },
  description: {
    maxWidth: 360,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: mobileTheme.space[2],
    marginTop: mobileTheme.space[2],
  },
});
