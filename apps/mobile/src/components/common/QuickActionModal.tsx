import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
}

interface QuickActionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAction: (actionId: string) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  visible,
  onClose,
  onSelectAction,
}) => {
  const actions: ActionItem[] = [
    {
      id: 'add-domain',
      title: 'Add Domain',
      subtitle: 'Track expiry, DNS, and SSL health',
      icon: 'globe',
      color: colors.neonCyan,
    },
    {
      id: 'domain-finder',
      title: 'Find Next Domain',
      subtitle: 'AI naming & registrar availability lookup',
      icon: 'search',
      color: colors.neonGreen,
    },
    {
      id: 'add-server',
      title: 'Monitor Server',
      subtitle: 'Add VPS / cloud resource by IP',
      icon: 'server',
      color: colors.sky,
    },
    {
      id: 'scan-ssl',
      title: 'Scan SSL / Health',
      subtitle: 'Perform instant certificate diagnostics',
      icon: 'shield',
      color: colors.warning,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.handleBar} />
              <View style={styles.header}>
                <Text style={styles.title}>Quick Actions</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="x-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.actionsList}>
                {actions.map((act) => (
                  <TouchableOpacity
                    key={act.id}
                    style={styles.actionRow}
                    onPress={() => {
                      onClose();
                      onSelectAction(act.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.iconWrapper, { borderColor: act.color }]}>
                      <Icon name={act.icon} size={22} color={act.color} />
                    </View>
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>{act.title}</Text>
                      <Text style={styles.actionSubtitle}>{act.subtitle}</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textDim} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 11, 16, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCardElevated,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderActive,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + 10,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDim,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  actionsList: {
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
});
