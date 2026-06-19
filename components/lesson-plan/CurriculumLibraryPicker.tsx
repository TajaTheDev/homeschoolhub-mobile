import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  getCategoryLabel,
  LIBRARY_CATEGORIES,
  type LibraryCategoryKey,
} from '@/lib/lessonPlanUtils';
import type { CurriculumWithItems } from '@/store/lessonPlanStore';
import { BookOpen, Search } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type CurriculumLibraryPickerProps = {
  curricula: CurriculumWithItems[];
  loading: boolean;
  onSelect: (curriculum: CurriculumWithItems) => void;
};

export default function CurriculumLibraryPicker({
  curricula,
  loading,
  onSelect,
}: CurriculumLibraryPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredByCategory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return LIBRARY_CATEGORIES.map((category) => {
      const entries = curricula
        .filter((entry) => entry.category === category.key)
        .filter((entry) => {
          if (!query) return true;
          const haystack = [
            entry.name,
            entry.publisher ?? '',
            entry.edition ?? '',
            entry.level ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        });

      return {
        key: category.key as LibraryCategoryKey,
        label: category.label,
        entries,
      };
    }).filter((group) => group.entries.length > 0 || !query);
  }, [curricula, searchQuery]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.brand[500]} />
        <Text style={styles.loadingText}>Loading library…</Text>
      </View>
    );
  }

  if (curricula.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <BookOpen size={28} color={Colors.ui.textLight} />
        <Text style={styles.emptyText}>
          No curricula in the library yet — check back soon.
        </Text>
      </View>
    );
  }

  const hasVisibleResults = filteredByCategory.some((group) => group.entries.length > 0);

  return (
    <View>
      <View style={styles.searchRow}>
        <Search size={18} color={Colors.ui.textLight} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search curricula"
          placeholderTextColor={Colors.ui.textLight}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {!hasVisibleResults ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No curricula match your search.</Text>
        </View>
      ) : (
        filteredByCategory.map((group) => {
          if (group.entries.length === 0) return null;

          return (
            <View key={group.key} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{group.label}</Text>
              {group.entries.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.entryCard}
                  onPress={() => onSelect(entry)}
                  activeOpacity={0.7}
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    {entry.verified ? (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.entryMeta}>
                    {[entry.publisher, entry.edition, entry.level]
                      .filter(Boolean)
                      .join(' · ') || getCategoryLabel(entry.category)}
                  </Text>
                  <Text style={styles.entryCount}>
                    {entry.itemCount ?? entry.items.length} lesson
                    {(entry.itemCount ?? entry.items.length) === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  emptyContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.ui.text,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    ...Typography.label,
    color: Colors.brand[700],
    marginBottom: 8,
  },
  entryCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    padding: 14,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  entryName: {
    flex: 1,
    ...Typography.label,
    fontSize: 15,
    color: Colors.ui.text,
  },
  verifiedBadge: {
    backgroundColor: Colors.accent[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedText: {
    ...Typography.label,
    fontSize: 11,
    color: Colors.accent[600],
  },
  entryMeta: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  entryCount: {
    ...Typography.bodySmall,
    color: Colors.brand[600],
  },
});
