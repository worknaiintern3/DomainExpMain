import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';

export interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (isoDateString: string | null) => void;
  value?: string | null | undefined;
  title?: string | undefined;
  minDate?: string | Date | null | undefined;
  maxDate?: string | Date | null | undefined;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const padZero = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  value,
  title = 'Select Date',
  minDate,
  maxDate,
}) => {
  const today = useMemo(() => new Date(), []);

  // Parse initial date from value or fallback to today
  const initialParsedDate = useMemo(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
    return today;
  }, [value, today]);

  const [currentYear, setCurrentYear] = useState<number>(initialParsedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialParsedDate.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (value) {
      const d = new Date(value);
      return !isNaN(d.getTime()) ? d : null;
    }
    return null;
  });
  const [viewMode, setViewMode] = useState<'calendar' | 'year' | 'month'>('calendar');

  useEffect(() => {
    if (visible) {
      if (value) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          setSelectedDate(d);
          setCurrentYear(d.getFullYear());
          setCurrentMonth(d.getMonth());
        } else {
          setSelectedDate(null);
          setCurrentYear(today.getFullYear());
          setCurrentMonth(today.getMonth());
        }
      } else {
        setSelectedDate(null);
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
      }
      setViewMode('calendar');
    }
  }, [visible, value, today]);

  // Generate Year Range (e.g. Current Year - 5 to Current Year + 15)
  const availableYears = useMemo(() => {
    const startYear = today.getFullYear() - 5;
    const endYear = today.getFullYear() + 20;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [today]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateString: string;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${padZero(prevMonth + 1)}-${padZero(d)}`;
      days.push({
        day: d,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        dateString: dateStr,
        isDisabled: true,
        isToday: false,
        isSelected: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${currentYear}-${padZero(currentMonth + 1)}-${padZero(d)}`;

      const isToday =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonth &&
        today.getDate() === d;

      const isSelected =
        Boolean(selectedDate) &&
        selectedDate?.getFullYear() === currentYear &&
        selectedDate?.getMonth() === currentMonth &&
        selectedDate?.getDate() === d;

      let isDisabled = false;
      if (minDate) {
        const min = new Date(minDate);
        if (!isNaN(min.getTime())) {
          const checkDate = new Date(currentYear, currentMonth, d, 23, 59, 59);
          if (checkDate.getTime() < min.getTime()) {
            isDisabled = true;
          }
        }
      }
      if (maxDate) {
        const max = new Date(maxDate);
        if (!isNaN(max.getTime())) {
          const checkDate = new Date(currentYear, currentMonth, d, 0, 0, 0);
          if (checkDate.getTime() > max.getTime()) {
            isDisabled = true;
          }
        }
      }

      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        dateString: dateStr,
        isDisabled,
        isToday,
        isSelected: Boolean(isSelected),
      });
    }

    // Trailing days to fill 7 columns
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${padZero(nextMonth + 1)}-${padZero(d)}`;
      days.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        dateString: dateStr,
        isDisabled: true,
        isToday: false,
        isSelected: false,
      });
    }

    return days;
  }, [currentYear, currentMonth, selectedDate, today, minDate, maxDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (year: number, month: number, day: number) => {
    // Construct UTC ISO timestamp
    const dateObj = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    setSelectedDate(dateObj);
  };

  const handleApply = () => {
    if (selectedDate) {
      // Return ISO 8601 string
      onSelect(selectedDate.toISOString());
    } else {
      onSelect(null);
    }
    onClose();
  };

  const handlePresetYears = (yearsToAdd: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + yearsToAdd);
    const dateObj = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
    setSelectedDate(dateObj);
    setCurrentYear(dateObj.getUTCFullYear());
    setCurrentMonth(dateObj.getUTCMonth());
  };

  const handlePresetToday = () => {
    const dateObj = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
    setSelectedDate(dateObj);
    setCurrentYear(dateObj.getUTCFullYear());
    setCurrentMonth(dateObj.getUTCMonth());
  };

  const handleClear = () => {
    setSelectedDate(null);
  };

  const formattedSelectedText = useMemo(() => {
    if (!selectedDate) return 'No date selected';
    return selectedDate.toISOString().slice(0, 10);
  }, [selectedDate]);

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
            <View style={styles.cardContainer}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleCol}>
                  <Text style={styles.modalTitle}>{title}</Text>
                  <Text style={styles.selectedDateBadge}>
                    {formattedSelectedText}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Month / Year Navigator */}
              <View style={styles.navBar}>
                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={() => setCurrentYear((y) => y - 1)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.doubleArrowText}>«</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handlePrevMonth}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon name="chevron-left" size={18} color={colors.neonCyan} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navMonthYearBtn}
                  onPress={() => setViewMode(viewMode === 'calendar' ? 'month' : 'calendar')}
                >
                  <Text style={styles.navMonthYearText}>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </Text>
                  <Icon
                    name={viewMode === 'calendar' ? 'chevron-right' : 'chevron-left'}
                    size={14}
                    color={colors.neonCyan}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handleNextMonth}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon name="chevron-right" size={18} color={colors.neonCyan} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={() => setCurrentYear((y) => y + 1)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.doubleArrowText}>»</Text>
                </TouchableOpacity>
              </View>

              {/* View Mode: Month / Year Selectors or Calendar Grid */}
              {viewMode === 'month' ? (
                <View style={styles.selectorContainer}>
                  <Text style={styles.selectorHeading}>Select Month & Year</Text>
                  {/* Month Buttons */}
                  <View style={styles.monthGrid}>
                    {MONTH_NAMES.map((mName, mIdx) => (
                      <TouchableOpacity
                        key={mName}
                        style={[
                          styles.monthChip,
                          currentMonth === mIdx && styles.monthChipActive,
                        ]}
                        onPress={() => {
                          setCurrentMonth(mIdx);
                          setViewMode('calendar');
                        }}
                      >
                        <Text
                          style={[
                            styles.monthChipText,
                            currentMonth === mIdx && styles.monthChipTextActive,
                          ]}
                        >
                          {mName.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Year Scroll */}
                  <Text style={[styles.selectorHeading, { marginTop: spacing.sm }]}>
                    Select Year
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.yearScrollContent}
                  >
                    {availableYears.map((yr) => (
                      <TouchableOpacity
                        key={yr}
                        style={[
                          styles.yearChip,
                          currentYear === yr && styles.yearChipActive,
                        ]}
                        onPress={() => {
                          setCurrentYear(yr);
                          setViewMode('calendar');
                        }}
                      >
                        <Text
                          style={[
                            styles.yearChipText,
                            currentYear === yr && styles.yearChipTextActive,
                          ]}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.calendarContainer}>
                  {/* Days of week header */}
                  <View style={styles.dayOfWeekHeaderRow}>
                    {SHORT_DAY_NAMES.map((dn, idx) => (
                      <View key={idx} style={styles.dayOfWeekHeaderCell}>
                        <Text style={styles.dayOfWeekHeaderText}>{dn}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Calendar Grid */}
                  <View style={styles.gridDays}>
                    {calendarDays.map((item, idx) => {
                      if (!item.isCurrentMonth) {
                        return (
                          <View key={idx} style={styles.dayCellContainer}>
                            <Text style={styles.otherMonthDayText}>{item.day}</Text>
                          </View>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={idx}
                          disabled={item.isDisabled}
                          style={[
                            styles.dayCellContainer,
                            item.isSelected && styles.dayCellSelected,
                            item.isToday && !item.isSelected && styles.dayCellToday,
                            item.isDisabled && styles.dayCellDisabled,
                          ]}
                          onPress={() => handleSelectDay(item.year, item.month, item.day)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              item.isSelected && styles.dayCellTextSelected,
                              item.isToday && !item.isSelected && styles.dayCellTextToday,
                              item.isDisabled && styles.dayCellTextDisabled,
                            ]}
                          >
                            {item.day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Quick Presets Row */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={handlePresetToday}
                >
                  <Text style={styles.presetChipText}>Today</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetYears(1)}
                >
                  <Text style={styles.presetChipText}>+1 Year</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetYears(2)}
                >
                  <Text style={styles.presetChipText}>+2 Years</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetYears(5)}
                >
                  <Text style={styles.presetChipText}>+5 Years</Text>
                </TouchableOpacity>

                {selectedDate ? (
                  <TouchableOpacity
                    style={[styles.presetChip, styles.clearChip]}
                    onPress={handleClear}
                  >
                    <Text style={styles.clearChipText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Footer Actions */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={handleApply}
                >
                  <Text style={styles.applyButtonText}>
                    {selectedDate ? 'Apply Date' : 'Set Blank'}
                  </Text>
                </TouchableOpacity>
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
    backgroundColor: 'rgba(2, 11, 16, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgCardElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderActive,
    padding: spacing.md,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitleCol: {
    flex: 1,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  selectedDateBadge: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  navArrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubleArrowText: {
    color: colors.neonCyan,
    fontSize: 14,
    fontWeight: typography.weights.bold,
    lineHeight: 16,
  },
  navMonthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  navMonthYearText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  calendarContainer: {
    marginVertical: 4,
  },
  dayOfWeekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  dayOfWeekHeaderCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  dayOfWeekHeaderText: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
  },
  gridDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellContainer: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: radius.md,
  },
  dayCellSelected: {
    backgroundColor: colors.neonCyan,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.neonCyan,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayCellText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  dayCellTextSelected: {
    color: colors.bgPrimary,
    fontWeight: typography.weights.bold,
  },
  dayCellTextToday: {
    color: colors.neonCyan,
    fontWeight: typography.weights.bold,
  },
  dayCellTextDisabled: {
    color: colors.textDim,
  },
  otherMonthDayText: {
    color: colors.textDim,
    fontSize: typography.sizes.xs,
    opacity: 0.35,
  },
  selectorContainer: {
    paddingVertical: spacing.sm,
    minHeight: 220,
  },
  selectorHeading: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthChip: {
    width: '31%',
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  monthChipActive: {
    backgroundColor: colors.neonCyan,
    borderColor: colors.neonCyan,
  },
  monthChipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  monthChipTextActive: {
    color: colors.bgPrimary,
    fontWeight: typography.weights.bold,
  },
  yearScrollContent: {
    gap: 6,
    paddingVertical: 4,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  yearChipActive: {
    backgroundColor: colors.neonCyan,
    borderColor: colors.neonCyan,
  },
  yearChipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  yearChipTextActive: {
    color: colors.bgPrimary,
    fontWeight: typography.weights.bold,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  presetChipText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.medium,
  },
  clearChip: {
    marginLeft: 'auto',
    borderColor: colors.borderCritical,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  clearChipText: {
    color: colors.danger,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  applyButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.neonCyan,
  },
  applyButtonText: {
    color: colors.bgPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
