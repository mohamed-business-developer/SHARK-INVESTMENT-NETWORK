import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { AppIcon } from './Icon';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly errorMessage?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  errorMessage,
  required = false,
  disabled = false,
  testID,
}: SelectProps) {
  const { direction, t } = useLocale();
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label ?? placeholder ?? t.common.selectOption;
  const hasError = Boolean(errorMessage && errorMessage.trim().length > 0);

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

      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        testID={testID}
        style={({ pressed }) => [
          styles.trigger,
          {
            direction,
            backgroundColor: disabled
              ? mobileTheme.colors.bg.surfaceSubtle
              : pressed
                ? mobileTheme.colors.bg.surfaceHover
                : mobileTheme.colors.bg.surface,
            borderColor: hasError
              ? mobileTheme.colors.status.error.fill
              : open
                ? mobileTheme.colors.border.focus
                : mobileTheme.colors.border.interactive,
          },
        ]}
      >
        <AppText
          variant="bodyBase"
          color={
            selectedOption
              ? disabled
                ? mobileTheme.colors.text.secondaryOnSubtle
                : mobileTheme.colors.text.primary
              : mobileTheme.colors.text.secondary
          }
          numberOfLines={1}
          style={styles.flex}
        >
          {displayLabel}
        </AppText>
        <AppIcon name="chevronDown" size={18} color={mobileTheme.colors.text.secondary} />
      </Pressable>

      {hasError ? (
        <View style={[styles.feedbackRow, { direction }]}>
          <AppIcon name="alertCircle" size={14} color={mobileTheme.colors.status.error.text} />
          <AppText variant="caption" color={mobileTheme.colors.status.error.text}>
            {errorMessage}
          </AppText>
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { direction }]} onPress={() => undefined}>
            <View style={[styles.sheetHeader, { direction }]}>
              <AppText variant="h4" style={styles.flex}>
                {label}
              </AppText>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t.common.close}
                style={styles.closeBtn}
              >
                <AppIcon name="x" size={20} color={mobileTheme.colors.text.primary} />
              </Pressable>
            </View>
            <ScrollView style={styles.optionsScroll}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      {
                        direction,
                        backgroundColor: isSelected
                          ? mobileTheme.colors.interactive.primaryTint
                          : pressed
                            ? mobileTheme.colors.bg.surfaceHover
                            : mobileTheme.colors.bg.surface,
                      },
                    ]}
                  >
                    <AppText
                      variant="bodyBase"
                      weight={isSelected ? '600' : '400'}
                      color={
                        isSelected ? mobileTheme.colors.text.brand : mobileTheme.colors.text.primary
                      }
                      style={styles.flex}
                    >
                      {option.label}
                    </AppText>
                    {isSelected ? (
                      <AppIcon name="check" size={18} color={mobileTheme.colors.text.brand} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  trigger: {
    minHeight: mobileTheme.layout.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: mobileTheme.radii.sm,
    borderWidth: 1,
    paddingHorizontal: mobileTheme.space[3],
    gap: mobileTheme.space[2],
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileTheme.space[1],
  },
  backdrop: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: mobileTheme.colors.bg.surface,
    borderTopStartRadius: mobileTheme.radii.lg,
    borderTopEndRadius: mobileTheme.radii.lg,
    maxHeight: '65%',
    paddingBottom: mobileTheme.space[6],
    ...mobileTheme.shadows.modal.native,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: mobileTheme.space[5],
    paddingVertical: mobileTheme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: mobileTheme.colors.border.subtle,
  },
  closeBtn: {
    minWidth: mobileTheme.layout.touchTargetMin,
    minHeight: mobileTheme.layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsScroll: {
    paddingHorizontal: mobileTheme.space[3],
    paddingTop: mobileTheme.space[2],
  },
  optionRow: {
    minHeight: mobileTheme.layout.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: mobileTheme.space[3],
    borderRadius: mobileTheme.radii.sm,
    marginBottom: mobileTheme.space[1],
  },
  flex: {
    flex: 1,
  },
});
