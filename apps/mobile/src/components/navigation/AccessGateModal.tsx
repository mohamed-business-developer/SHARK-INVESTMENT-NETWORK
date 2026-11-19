import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useLocale } from '@/i18n';
import { mobileTheme } from '@/theme';
import { AppText, Button, FeedbackBanner } from '@/components/ui';
import { AppIcon } from '@/components/ui/Icon';

export interface AccessGateModalProps {
  readonly open: boolean;
  readonly mode: 'guest' | 'pending';
  readonly onPrimaryAction: () => void;
  readonly onSecondaryAction?: () => void;
  readonly onDismiss: () => void;
}

export function AccessGateModal({
  open,
  mode,
  onPrimaryAction,
  onSecondaryAction,
  onDismiss,
}: AccessGateModalProps) {
  const { direction, t } = useLocale();
  const isGuest = mode === 'guest';

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { direction }]} onPress={() => undefined}>
          <View style={styles.iconCircle}>
            <AppIcon
              name={isGuest ? 'lock' : 'clock'}
              size={24}
              color={mobileTheme.colors.text.brand}
            />
          </View>

          <AppText variant="h2" align="center">
            {isGuest ? t.navigation.gate.guestTitle : t.navigation.gate.pendingTitle}
          </AppText>

          {!isGuest ? (
            <FeedbackBanner variant="warning" message={t.navigation.gate.pendingDescription} />
          ) : (
            <AppText variant="bodyBase" align="center" color={mobileTheme.colors.text.secondary}>
              {t.navigation.gate.guestDescription}
            </AppText>
          )}

          <View style={styles.actionsCol}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              label={isGuest ? t.navigation.gate.createAccount : t.navigation.gate.viewStatus}
              onPress={onPrimaryAction}
            />
            {isGuest && onSecondaryAction ? (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                label={t.navigation.gate.signIn}
                onPress={onSecondaryAction}
              />
            ) : null}
            <Button
              variant="ghost"
              fullWidth
              label={isGuest ? t.navigation.gate.continueBrowsing : t.common.dismiss}
              onPress={onDismiss}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: mobileTheme.colors.bg.surface,
    borderTopStartRadius: mobileTheme.radii.lg,
    borderTopEndRadius: mobileTheme.radii.lg,
    padding: mobileTheme.space[6],
    gap: mobileTheme.space[4],
    ...mobileTheme.shadows.modal.native,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: mobileTheme.radii.pill,
    backgroundColor: mobileTheme.colors.interactive.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  actionsCol: {
    gap: mobileTheme.space[2],
    marginTop: mobileTheme.space[2],
  },
});
