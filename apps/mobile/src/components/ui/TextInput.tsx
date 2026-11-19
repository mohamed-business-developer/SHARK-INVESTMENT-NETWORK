import { useState } from 'react';
import {
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { getLogicalTextAlign, getWritingDirection } from '@shark/utils';
import { useLocale } from '@/i18n';
import { getMobileTextStyle, mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { AppIcon, type SharkIconName } from './Icon';

export interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly errorMessage?: string;
  readonly required?: boolean;
  readonly secureTextEntry?: boolean;
  readonly multiline?: boolean;
  readonly numberOfLines?: number;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly forceLtrValue?: boolean;
  readonly leadingIcon?: SharkIconName;
  readonly trailingAction?: {
    readonly icon: SharkIconName;
    readonly label: string;
    readonly onPress: () => void;
  };
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly testID?: string;
}

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  errorMessage,
  required = false,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 4,
  keyboardType = 'default',
  forceLtrValue = false,
  leadingIcon,
  trailingAction,
  disabled = false,
  maxLength,
  testID,
}: TextInputProps) {
  const { locale, direction, t } = useLocale();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const hasError = Boolean(errorMessage && errorMessage.trim().length > 0);
  const inputTypography = getMobileTextStyle('bodyBase', locale);

  const borderColor = hasError
    ? mobileTheme.colors.status.error.fill
    : focused
      ? mobileTheme.colors.border.focus
      : disabled
        ? mobileTheme.colors.border.hover
        : mobileTheme.colors.border.interactive;

  const borderWidth = focused || hasError ? 1.5 : 1;
  const containerBg = disabled
    ? mobileTheme.colors.bg.surfaceSubtle
    : mobileTheme.colors.bg.surface;

  const effectiveSecure = secureTextEntry && !passwordVisible;

  return (
    <View style={[styles.wrapper, { direction }]}>
      <View style={[styles.labelRow, { direction }]}>
        <AppText variant="bodySm" weight="600" color={mobileTheme.colors.text.primary}>
          {label}
        </AppText>
        {required ? (
          <AppText variant="bodySm" weight="600" color={mobileTheme.colors.status.error.text}>
            {t.common.requiredMark}
          </AppText>
        ) : null}
      </View>

      <View
        style={[
          styles.fieldContainer,
          {
            direction,
            borderColor,
            borderWidth,
            backgroundColor: containerBg,
            minHeight: multiline
              ? mobileTheme.space[12] + mobileTheme.space[10]
              : mobileTheme.layout.inputHeight,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? mobileTheme.space[3] : 0,
          },
        ]}
      >
        {leadingIcon ? (
          <View style={styles.leadingIconSlot}>
            <AppIcon
              name={leadingIcon}
              size={18}
              color={
                disabled
                  ? mobileTheme.colors.text.secondaryOnSubtle
                  : mobileTheme.colors.text.secondary
              }
            />
          </View>
        ) : null}

        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={mobileTheme.colors.text.secondary}
          editable={!disabled}
          secureTextEntry={effectiveSecure}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          testID={testID}
          style={[
            inputTypography,
            styles.input,
            {
              color: disabled
                ? mobileTheme.colors.text.secondaryOnSubtle
                : mobileTheme.colors.text.primary,
              writingDirection: getWritingDirection(locale, forceLtrValue),
              textAlign: forceLtrValue ? 'left' : getLogicalTextAlign(locale, 'start'),
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setPasswordVisible((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? t.common.hidePassword : t.common.showPassword}
            style={styles.trailingButton}
            hitSlop={8}
          >
            <AppIcon
              name={passwordVisible ? 'eyeOff' : 'eye'}
              size={20}
              color={mobileTheme.colors.text.secondary}
            />
          </Pressable>
        ) : trailingAction ? (
          <Pressable
            onPress={trailingAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={trailingAction.label}
            style={styles.trailingButton}
            hitSlop={8}
          >
            <AppIcon
              name={trailingAction.icon}
              size={20}
              color={mobileTheme.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <View style={[styles.feedbackRow, { direction }]}>
          <AppIcon name="alertCircle" size={14} color={mobileTheme.colors.status.error.text} />
          <AppText
            variant="caption"
            color={mobileTheme.colors.status.error.text}
            style={styles.flex}
          >
            {errorMessage}
          </AppText>
        </View>
      ) : helperText ? (
        <AppText variant="caption" color={mobileTheme.colors.text.secondary}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: mobileTheme.space[2],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[1],
  },
  fieldContainer: {
    flexDirection: 'row',
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: mobileTheme.space[3],
    gap: mobileTheme.space[2],
  },
  leadingIconSlot: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: mobileTheme.layout.touchTargetMin,
    paddingVertical: mobileTheme.space[2],
  },
  trailingButton: {
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[1],
  },
  flex: {
    flex: 1,
  },
});
