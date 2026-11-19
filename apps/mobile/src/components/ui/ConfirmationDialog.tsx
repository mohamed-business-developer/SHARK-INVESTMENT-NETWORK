import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { interpolate } from '@shark/utils';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { TextInput } from './TextInput';

export interface ConfirmationDialogProps {
  readonly open: boolean;
  readonly variant?: 'standard' | 'destructive';
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly requireReasonInput?: boolean;
  readonly reasonLabel?: string;
  readonly reasonPlaceholder?: string;
  readonly loading?: boolean;
  readonly onConfirm: (reason?: string) => void;
  readonly onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  variant = 'standard',
  title,
  description,
  confirmLabel,
  cancelLabel,
  requireReasonInput = false,
  reasonLabel,
  reasonPlaceholder,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { direction, t } = useLocale();
  const [reason, setReason] = useState('');

  const trimmedLength = reason.trim().length;
  const reasonInvalid = requireReasonInput && trimmedLength < 10;

  const handleClose = () => {
    if (!loading) {
      setReason('');
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (reasonInvalid || loading) {
      return;
    }
    const finalReason = requireReasonInput ? reason.trim() : undefined;
    setReason('');
    onConfirm(finalReason);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.dialog, { direction }]} onPress={() => undefined}>
          <AppText variant="h3" color={mobileTheme.colors.text.primary}>
            {title}
          </AppText>
          <AppText variant="bodyBase" color={mobileTheme.colors.text.secondary}>
            {description}
          </AppText>

          {requireReasonInput ? (
            <TextInput
              label={reasonLabel ?? t.dialogs.reasonLabel}
              value={reason}
              onChangeText={setReason}
              placeholder={reasonPlaceholder ?? t.dialogs.reasonPlaceholder}
              helperText={interpolate(t.dialogs.reasonHint, { count: trimmedLength })}
              multiline
              required
              disabled={loading}
            />
          ) : null}

          <View style={[styles.footer, { direction }]}>
            <View style={styles.btnCell}>
              <Button
                variant="secondary"
                label={cancelLabel}
                onPress={handleClose}
                disabled={loading}
                fullWidth
              />
            </View>
            <View style={styles.btnCell}>
              <Button
                variant={variant === 'destructive' ? 'danger' : 'primary'}
                label={confirmLabel}
                onPress={handleConfirm}
                disabled={reasonInvalid}
                loading={loading}
                fullWidth
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bg.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: mobileTheme.space[4],
  },
  dialog: {
    width: '92%',
    maxWidth: mobileTheme.layout.dialogMaxWidth,
    backgroundColor: mobileTheme.colors.bg.surface,
    borderRadius: mobileTheme.radii.lg,
    padding: mobileTheme.space[6],
    gap: mobileTheme.space[4],
    ...mobileTheme.shadows.modal.native,
  },
  footer: {
    flexDirection: 'row',
    gap: mobileTheme.space[3],
    marginTop: mobileTheme.space[1],
  },
  btnCell: {
    flex: 1,
  },
});
