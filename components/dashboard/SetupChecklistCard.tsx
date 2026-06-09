/**
 * First-run setup checklist shown on the dashboard for new users.
 */

import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  ChecklistItemId,
  ChecklistStatus,
  dismissSetupChecklist,
  fetchChecklistStatus,
  getIncompleteOptionalItems,
  persistAutoHiddenChecklist,
} from '@/lib/setupChecklist';
import { useAuthStore } from '@/store/authStore';
import type { Student } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { CheckCircle, Circle, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type SetupChecklistCardProps = {
  firstStudent: Student | null;
  onOpenSubjects: (student: Student) => void;
};

export default function SetupChecklistCard({
  firstStudent,
  onOpenSubjects,
}: SetupChecklistCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<ChecklistStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await fetchChecklistStatus(user.id);
      if (next.shouldPersistAutoHidden) {
        await persistAutoHiddenChecklist(user.id);
      }
      setStatus(next);
    } catch (error) {
      console.error('Failed to load setup checklist status:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshStatus();
    }, [refreshStatus])
  );

  const handleDismiss = useCallback(async () => {
    if (!user?.id || !status) return;

    const incompleteOptional = getIncompleteOptionalItems(status.items);
    await dismissSetupChecklist(user.id, incompleteOptional);
    setStatus({
      ...status,
      visible: false,
      shouldPersistAutoHidden: false,
    });
  }, [status, user?.id]);

  const handleItemPress = useCallback(
    (itemId: ChecklistItemId) => {
      switch (itemId) {
        case 'add_student':
          router.push('/add-student' as never);
          break;
        case 'create_subject':
        case 'pick_curriculum':
          if (firstStudent) {
            onOpenSubjects(firstStudent);
          } else {
            router.push('/add-student' as never);
          }
          break;
        case 'add_lesson':
          router.push('/add-lesson' as never);
          break;
        case 'log_book':
          if (firstStudent) {
            router.push(`/reading-log?studentId=${firstStudent.id}` as never);
          } else {
            router.push('/add-student' as never);
          }
          break;
        default:
          break;
      }
    },
    [firstStudent, onOpenSubjects, router]
  );

  if (!user?.id || loading) {
    return null;
  }

  if (!status?.visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.progress}>
            {status.completedCount} of {status.totalCount} done
          </Text>
        </View>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
          accessibilityLabel="Dismiss setup checklist"
          accessibilityRole="button"
        >
          <X size={20} color={Colors.ui.textLight} />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {status.items.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemRow,
              index < status.items.length - 1 && styles.itemRowBorder,
            ]}
            onPress={() => handleItemPress(item.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            {item.complete ? (
              <CheckCircle size={20} color={Colors.accent[500]} />
            ) : (
              <Circle size={20} color={Colors.ui.border} />
            )}
            <View style={styles.itemText}>
              <Text style={[styles.itemLabel, item.complete && styles.itemLabelComplete]}>
                {item.label}
              </Text>
              {item.optional && <Text style={styles.optionalLabel}>optional</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    ...Typography.h3,
    marginBottom: 4,
  },
  progress: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  dismissButton: {
    padding: 4,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    ...Typography.body,
  },
  itemLabelComplete: {
    color: Colors.ui.textLight,
  },
  optionalLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
});
