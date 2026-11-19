import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  View,
} from 'react-native';
import { getLogicalTextAlign, getWritingDirection } from '@shark/utils';
import { useLocale } from '@/i18n';
import { getMobileTextStyle, mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { AppIcon } from './Icon';

export interface SearchInputProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly onSubmit?: () => void;
  readonly onClear?: () => void;
  readonly filterCount?: number;
  readonly onFilterPress?: () => void;
  readonly loading?: boolean;
  readonly testID?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  onClear,
  filterCount = 0,
  onFilterPress,
  loading = false,
  testID,
}: SearchInputProps) {
  const { locale, direction, t } = useLocale();
  const [focused, setFocused] = useState(false);
  const inputTypography = getMobileTextStyle('bodyBase', locale);

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          direction,
          borderColor: focused
            ? mobileTheme.colors.border.focus
            : mobileTheme.colors.border.interactive,
          borderWidth: focused ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.searchIconBox}>
        {loading ? (
          <ActivityIndicator size="small" color={mobileTheme.colors.text.brand} />
        ) : (
          <AppIcon name="search" size={20} color={mobileTheme.colors.text.secondary} />
        )}
      </View>

      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mobileTheme.colors.text.secondary}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        testID={testID}
        style={[
          inputTypography,
          styles.input,
          {
            color: mobileTheme.colors.text.primary,
            writingDirection: getWritingDirection(locale),
            textAlign: getLogicalTextAlign(locale, 'start'),
          },
        ]}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel={t.common.clearSearch}
          style={styles.iconButton}
          hitSlop={6}
        >
          <AppIcon name="x" size={18} color={mobileTheme.colors.text.secondary} />
        </Pressable>
      ) : null}

      {onFilterPress ? (
        <Pressable
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel={t.common.filter}
          style={styles.iconButton}
          hitSlop={6}
        >
          <AppIcon name="slidersHorizontal" size={18} color={mobileTheme.colors.text.brand} />
          {filterCount > 0 ? (
            <View style={styles.filterBadge}>
              <AppText variant="caption" color={mobileTheme.colors.text.inverse} tabularNums>
                {String(filterCount)}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: mobileTheme.layout.searchHeight,
    backgroundColor: mobileTheme.colors.bg.surface,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: mobileTheme.space[3],
    gap: mobileTheme.space[1],
  },
  searchIconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingEnd: mobileTheme.space[1],
  },
  input: {
    flex: 1,
    minHeight: mobileTheme.layout.searchHeight,
    paddingVertical: mobileTheme.space[2],
  },
  iconButton: {
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: mobileTheme.space[1],
    end: mobileTheme.space[1],
    minWidth: 18,
    height: 18,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.interactive.primary,
    paddingHorizontal: mobileTheme.space[1],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
