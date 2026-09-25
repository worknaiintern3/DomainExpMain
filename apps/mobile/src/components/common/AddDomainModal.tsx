import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { mobileApiClient } from '../../services/api-client';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';
import { DatePickerModal } from './DatePickerModal';

export interface DomainFormRecord {
  id?: string | undefined;
  domainName?: string | undefined;
  name?: string | undefined;
  expiresAt?: string | null | undefined;
  autoRenew?: boolean | null | undefined;
  registrarProviderAccountId?: string | null | undefined;
  dnsProviderAccountId?: string | null | undefined;
  registeredAt?: string | null | undefined;
  notes?: string | null | undefined;
}

interface AddDomainModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: ((savedRecord: any) => void) | undefined;
  initialDomain?: DomainFormRecord | null | undefined;
}

interface FieldErrors {
  domainName?: string | undefined;
  expiresAt?: string | undefined;
  registeredAt?: string | undefined;
  registrarProviderAccountId?: string | undefined;
  dnsProviderAccountId?: string | undefined;
  notes?: string | undefined;
}

const DOMAIN_FORMAT_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AddDomainModal: React.FC<AddDomainModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialDomain,
}) => {
  const isEditing = Boolean(initialDomain?.id && initialDomain.id.trim() !== '');

  const [domainName, setDomainName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [autoRenew, setAutoRenew] = useState<'not_recorded' | 'enabled' | 'disabled'>('not_recorded');
  const [registrarProviderAccountId, setRegistrarProviderAccountId] = useState('');
  const [dnsProviderAccountId, setDnsProviderAccountId] = useState('');
  const [registeredAt, setRegisteredAt] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Active Date Picker modal: 'expiresAt' | 'registeredAt' | null
  const [activeDatePicker, setActiveDatePicker] = useState<'expiresAt' | 'registeredAt' | null>(null);

  useEffect(() => {
    if (visible) {
      setErrorMessage(null);
      setFieldErrors({});
      if (initialDomain) {
        setDomainName(initialDomain.domainName || initialDomain.name || '');
        setExpiresAt(initialDomain.expiresAt || '');
        if (initialDomain.autoRenew === true) {
          setAutoRenew('enabled');
        } else if (initialDomain.autoRenew === false) {
          setAutoRenew('disabled');
        } else {
          setAutoRenew('not_recorded');
        }
        setRegistrarProviderAccountId(initialDomain.registrarProviderAccountId || '');
        setDnsProviderAccountId(initialDomain.dnsProviderAccountId || '');
        setRegisteredAt(initialDomain.registeredAt || '');
        setNotes(initialDomain.notes || '');
      } else {
        setDomainName('');
        setExpiresAt('');
        setAutoRenew('not_recorded');
        setRegistrarProviderAccountId('');
        setDnsProviderAccountId('');
        setRegisteredAt('');
        setNotes('');
      }
    }
  }, [visible, initialDomain]);

  const handleSetRelativeExpiry = (yearsToAdd: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + yearsToAdd);
    setExpiresAt(d.toISOString());
    setFieldErrors((prev) => ({ ...prev, expiresAt: undefined }));
  };

  const handleSetTodayRegistered = () => {
    setRegisteredAt(new Date().toISOString());
    setFieldErrors((prev) => ({ ...prev, registeredAt: undefined }));
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    const errors: FieldErrors = {};

    // 1. Domain name validation
    const trimmedDomain = domainName.trim().toLowerCase();
    if (!trimmedDomain) {
      errors.domainName = 'Domain name is required.';
    } else if (trimmedDomain.startsWith('http://') || trimmedDomain.startsWith('https://') || trimmedDomain.includes('/')) {
      errors.domainName = 'Domain name must not include http://, https:// or path slashes.';
    } else if (/\s/.test(trimmedDomain)) {
      errors.domainName = 'Domain name cannot contain spaces.';
    } else if (trimmedDomain.length > 253) {
      errors.domainName = 'Domain name cannot exceed 253 characters.';
    } else if (!DOMAIN_FORMAT_REGEX.test(trimmedDomain)) {
      errors.domainName = 'Please enter a valid domain name (e.g. example.com).';
    }

    // 2. Dates validation & ISO normalization
    let normalizedExpiresAt: string | null = null;
    let expiresAtTime: number | null = null;
    if (expiresAt.trim()) {
      const expDate = new Date(expiresAt.trim());
      if (isNaN(expDate.getTime())) {
        errors.expiresAt = 'Please enter or select a valid expiration date.';
      } else {
        expiresAtTime = expDate.getTime();
        normalizedExpiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt.trim())
          ? `${expiresAt.trim()}T00:00:00.000Z`
          : expDate.toISOString();
      }
    }

    let normalizedRegisteredAt: string | null = null;
    let registeredAtTime: number | null = null;
    if (registeredAt.trim()) {
      const regDate = new Date(registeredAt.trim());
      if (isNaN(regDate.getTime())) {
        errors.registeredAt = 'Please enter or select a valid registration date.';
      } else {
        registeredAtTime = regDate.getTime();
        normalizedRegisteredAt = /^\d{4}-\d{2}-\d{2}$/.test(registeredAt.trim())
          ? `${registeredAt.trim()}T00:00:00.000Z`
          : regDate.toISOString();
      }
    }

    // Chronological order validation
    if (expiresAtTime !== null && registeredAtTime !== null) {
      if (expiresAtTime <= registeredAtTime) {
        errors.expiresAt = 'Expiration date must be after registration date.';
        errors.registeredAt = 'Registration date must be before expiration date.';
      }
    }

    // 3. Provider Account IDs validation (UUID)
    const trimmedRegAccountId = registrarProviderAccountId.trim();
    if (trimmedRegAccountId && !UUID_FORMAT_REGEX.test(trimmedRegAccountId)) {
      errors.registrarProviderAccountId =
        'Must be a valid UUID format (e.g. 550e8400-e29b-41d4-a716-446655440000) or leave blank.';
    }

    const trimmedDnsAccountId = dnsProviderAccountId.trim();
    if (trimmedDnsAccountId && !UUID_FORMAT_REGEX.test(trimmedDnsAccountId)) {
      errors.dnsProviderAccountId =
        'Must be a valid UUID format (e.g. 550e8400-e29b-41d4-a716-446655440000) or leave blank.';
    }

    // 4. Notes validation
    if (notes.length > 10000) {
      errors.notes = 'Notes cannot exceed 10,000 characters.';
    }

    // If any validation errors exist, halt submission
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError =
        errors.domainName ||
        errors.expiresAt ||
        errors.registeredAt ||
        errors.registrarProviderAccountId ||
        errors.dnsProviderAccountId ||
        errors.notes;
      setErrorMessage(firstError || 'Please correct the invalid fields.');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    const autoRenewValue =
      autoRenew === 'enabled' ? true : autoRenew === 'disabled' ? false : null;

    const payload: Record<string, any> = {
      domainName: trimmedDomain,
    };

    if (normalizedExpiresAt) {
      payload.expiresAt = normalizedExpiresAt;
    } else if (isEditing) {
      payload.expiresAt = null;
    }

    if (normalizedRegisteredAt) {
      payload.registeredAt = normalizedRegisteredAt;
    } else if (isEditing) {
      payload.registeredAt = null;
    }

    payload.autoRenew = autoRenewValue;

    if (trimmedRegAccountId) {
      payload.registrarProviderAccountId = trimmedRegAccountId;
    } else if (isEditing) {
      payload.registrarProviderAccountId = null;
    }

    if (trimmedDnsAccountId) {
      payload.dnsProviderAccountId = trimmedDnsAccountId;
    } else if (isEditing) {
      payload.dnsProviderAccountId = null;
    }

    if (notes.trim()) {
      payload.notes = notes.trim();
    } else if (isEditing) {
      payload.notes = null;
    }

    try {
      let savedRecord: any;
      if (isEditing && initialDomain?.id && initialDomain.id.trim() !== '') {
        savedRecord = await mobileApiClient.request(`/domains/${initialDomain.id.trim()}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        savedRecord = await mobileApiClient.request('/domains', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (onSuccess) {
        onSuccess(savedRecord);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save domain. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                {/* Modal Header */}
                <View style={styles.header}>
                  <View>
                    <Text style={styles.title}>
                      {isEditing ? 'Edit domain' : 'Add domain'}
                    </Text>
                    <Text style={styles.subtitle}>
                      {isEditing
                        ? 'Update stored domain metadata and provider links'
                        : 'Record workspace domain identity and registration records'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="x" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <Icon name="alert-triangle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <ScrollView
                  contentContainerStyle={styles.formContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Field 1: Domain */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Domain *</Text>
                      <Text style={styles.fieldHelp}>Required</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        fieldErrors.domainName && styles.inputContainerError,
                      ]}
                    >
                      <Icon
                        name="globe"
                        size={16}
                        color={fieldErrors.domainName ? colors.danger : colors.neonCyan}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="example.com"
                        placeholderTextColor={colors.textDim}
                        value={domainName}
                        onChangeText={(val) => {
                          setDomainName(val);
                          setFieldErrors((prev) => ({ ...prev, domainName: undefined }));
                          setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {fieldErrors.domainName ? (
                      <Text style={styles.fieldErrorText}>{fieldErrors.domainName}</Text>
                    ) : null}
                  </View>

                  {/* Field 2: Expires at (ISO / Date Calendar) */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Expires at</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        fieldErrors.expiresAt && styles.inputContainerError,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setActiveDatePicker('expiresAt')}
                        style={styles.datePickerTrigger}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name="calendar"
                          size={16}
                          color={fieldErrors.expiresAt ? colors.danger : colors.sky}
                          style={styles.inputIcon}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD or tap calendar"
                        placeholderTextColor={colors.textDim}
                        value={expiresAt}
                        onChangeText={(val) => {
                          setExpiresAt(val);
                          setFieldErrors((prev) => ({ ...prev, expiresAt: undefined }));
                          setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.calendarInlineBtn}
                        onPress={() => setActiveDatePicker('expiresAt')}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.calendarInlineBtnText}>📅 Calendar</Text>
                      </TouchableOpacity>
                    </View>
                    {fieldErrors.expiresAt ? (
                      <Text style={styles.fieldErrorText}>{fieldErrors.expiresAt}</Text>
                    ) : null}
                    <View style={styles.quickFillRow}>
                      <TouchableOpacity
                        style={styles.quickFillBtn}
                        onPress={() => handleSetRelativeExpiry(1)}
                      >
                        <Text style={styles.quickFillText}>+1 Year</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickFillBtn}
                        onPress={() => handleSetRelativeExpiry(2)}
                      >
                        <Text style={styles.quickFillText}>+2 Years</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickFillBtn}
                        onPress={() => handleSetRelativeExpiry(5)}
                      >
                        <Text style={styles.quickFillText}>+5 Years</Text>
                      </TouchableOpacity>
                      {expiresAt ? (
                        <TouchableOpacity
                          style={styles.quickFillBtn}
                          onPress={() => {
                            setExpiresAt('');
                            setFieldErrors((prev) => ({ ...prev, expiresAt: undefined }));
                          }}
                        >
                          <Text style={[styles.quickFillText, { color: colors.danger }]}>Clear</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Field 3: Auto-renew */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Auto-renew</Text>
                    </View>
                    <View style={styles.segmentedRow}>
                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          autoRenew === 'not_recorded' && styles.segmentBtnActive,
                        ]}
                        onPress={() => setAutoRenew('not_recorded')}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            autoRenew === 'not_recorded' && styles.segmentTextActive,
                          ]}
                        >
                          Not recorded
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          autoRenew === 'enabled' && styles.segmentBtnActiveSuccess,
                        ]}
                        onPress={() => setAutoRenew('enabled')}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            autoRenew === 'enabled' && styles.segmentTextActiveSuccess,
                          ]}
                        >
                          Enabled
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          autoRenew === 'disabled' && styles.segmentBtnActiveWarning,
                        ]}
                        onPress={() => setAutoRenew('disabled')}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            autoRenew === 'disabled' && styles.segmentTextActiveWarning,
                          ]}
                        >
                          Disabled
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Field 4: Registrar account ID */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Registrar account ID</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        fieldErrors.registrarProviderAccountId && styles.inputContainerError,
                      ]}
                    >
                      <Icon
                        name="server"
                        size={16}
                        color={fieldErrors.registrarProviderAccountId ? colors.danger : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="UUID format (e.g. 550e8400-...)"
                        placeholderTextColor={colors.textDim}
                        value={registrarProviderAccountId}
                        onChangeText={(val) => {
                          setRegistrarProviderAccountId(val);
                          setFieldErrors((prev) => ({
                            ...prev,
                            registrarProviderAccountId: undefined,
                          }));
                          setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {fieldErrors.registrarProviderAccountId ? (
                      <Text style={styles.fieldErrorText}>
                        {fieldErrors.registrarProviderAccountId}
                      </Text>
                    ) : null}
                  </View>

                  {/* Field 5: DNS provider account ID */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>DNS provider account ID</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        fieldErrors.dnsProviderAccountId && styles.inputContainerError,
                      ]}
                    >
                      <Icon
                        name="activity"
                        size={16}
                        color={fieldErrors.dnsProviderAccountId ? colors.danger : colors.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="UUID format (e.g. 550e8400-...)"
                        placeholderTextColor={colors.textDim}
                        value={dnsProviderAccountId}
                        onChangeText={(val) => {
                          setDnsProviderAccountId(val);
                          setFieldErrors((prev) => ({
                            ...prev,
                            dnsProviderAccountId: undefined,
                          }));
                          setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {fieldErrors.dnsProviderAccountId ? (
                      <Text style={styles.fieldErrorText}>{fieldErrors.dnsProviderAccountId}</Text>
                    ) : null}
                  </View>

                  {/* Field 6: Registered at (ISO / Date Calendar) */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Registered at</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        fieldErrors.registeredAt && styles.inputContainerError,
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setActiveDatePicker('registeredAt')}
                        style={styles.datePickerTrigger}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name="clock"
                          size={16}
                          color={fieldErrors.registeredAt ? colors.danger : colors.neonGreen}
                          style={styles.inputIcon}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD or tap calendar"
                        placeholderTextColor={colors.textDim}
                        value={registeredAt}
                        onChangeText={(val) => {
                          setRegisteredAt(val);
                          setFieldErrors((prev) => ({ ...prev, registeredAt: undefined }));
                          setErrorMessage(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.calendarInlineBtn}
                        onPress={() => setActiveDatePicker('registeredAt')}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.calendarInlineBtnText}>📅 Calendar</Text>
                      </TouchableOpacity>
                    </View>
                    {fieldErrors.registeredAt ? (
                      <Text style={styles.fieldErrorText}>{fieldErrors.registeredAt}</Text>
                    ) : null}
                    <View style={styles.quickFillRow}>
                      <TouchableOpacity
                        style={styles.quickFillBtn}
                        onPress={handleSetTodayRegistered}
                      >
                        <Text style={styles.quickFillText}>Today</Text>
                      </TouchableOpacity>
                      {registeredAt ? (
                        <TouchableOpacity
                          style={styles.quickFillBtn}
                          onPress={() => {
                            setRegisteredAt('');
                            setFieldErrors((prev) => ({ ...prev, registeredAt: undefined }));
                          }}
                        >
                          <Text style={[styles.quickFillText, { color: colors.danger }]}>Clear</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Field 7: Notes */}
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.fieldLabel}>Notes</Text>
                      <Text style={styles.fieldHelp}>Optional; max 10,000 chars</Text>
                    </View>
                    <View
                      style={[
                        styles.inputContainer,
                        styles.textAreaContainer,
                        fieldErrors.notes && styles.inputContainerError,
                      ]}
                    >
                      <TextInput
                        style={[styles.input, styles.textAreaInput]}
                        placeholder="Add administrative notes, registration details, or DNS directives..."
                        placeholderTextColor={colors.textDim}
                        value={notes}
                        onChangeText={(val) => {
                          setNotes(val);
                          setFieldErrors((prev) => ({ ...prev, notes: undefined }));
                          setErrorMessage(null);
                        }}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                    {fieldErrors.notes ? (
                      <Text style={styles.fieldErrorText}>{fieldErrors.notes}</Text>
                    ) : null}
                  </View>
                </ScrollView>

                {/* Modal Actions Footer */}
                <View style={styles.actionsFooter}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={onClose}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.bgPrimary} />
                    ) : (
                      <Text style={styles.saveText}>
                        {isEditing ? 'Save Changes' : 'Save'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Interactive Date Picker Modal for Expires at & Registered at */}
      <DatePickerModal
        visible={activeDatePicker !== null}
        onClose={() => setActiveDatePicker(null)}
        title={
          activeDatePicker === 'expiresAt'
            ? 'Select Expiration Date'
            : 'Select Registration Date'
        }
        value={activeDatePicker === 'expiresAt' ? expiresAt : registeredAt}
        minDate={activeDatePicker === 'expiresAt' ? registeredAt : undefined}
        maxDate={activeDatePicker === 'registeredAt' ? expiresAt : undefined}
        onSelect={(isoDate) => {
          if (activeDatePicker === 'expiresAt') {
            setExpiresAt(isoDate || '');
            setFieldErrors((prev) => ({ ...prev, expiresAt: undefined }));
          } else if (activeDatePicker === 'registeredAt') {
            setRegisteredAt(isoDate || '');
            setFieldErrors((prev) => ({ ...prev, registeredAt: undefined }));
          }
          setActiveDatePicker(null);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 11, 16, 0.82)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bgCardElevated,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderActive,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 30 : spacing.lg,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
    maxWidth: 280,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.borderCritical,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    flex: 1,
  },
  formContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  formGroup: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  fieldHelp: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  inputContainerError: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  fieldErrorText: {
    color: colors.danger,
    fontSize: typography.sizes.tiny,
    marginTop: 2,
    marginLeft: 2,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
  datePickerTrigger: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarInlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    marginLeft: spacing.xs,
  },
  calendarInlineBtnText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.semibold,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    paddingVertical: spacing.sm,
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  quickFillBtn: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  quickFillText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.medium,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderActive,
  },
  segmentBtnActiveSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  segmentBtnActiveWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  segmentTextActiveSuccess: {
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  segmentTextActiveWarning: {
    color: colors.warning,
    fontWeight: typography.weights.bold,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  textAreaInput: {
    minHeight: 70,
  },
  actionsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  saveBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.bgPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
