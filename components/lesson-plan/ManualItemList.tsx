import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import type { WorkingItem } from '@/lib/lessonPlanUtils';
import { createWorkingItem } from '@/lib/lessonPlanUtils';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ManualItemListProps = {
  items: WorkingItem[];
  onChange: (items: WorkingItem[]) => void;
};

export default function ManualItemList({ items, onChange }: ManualItemListProps) {
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onChange([...items, createWorkingItem(trimmed)]);
    setNewTitle('');
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  const handleStartEdit = (item: WorkingItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveEdit = () => {
    const trimmed = editingTitle.trim();
    if (!editingId || !trimmed) return;

    onChange(
      items.map((item) =>
        item.id === editingId ? { ...item, title: trimmed } : item
      )
    );
    setEditingId(null);
    setEditingTitle('');
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const nextItems = [...items];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, moved);
    onChange(nextItems);
  };

  const confirmDelete = (item: WorkingItem) => {
    Alert.alert('Remove lesson', `Remove "${item.title}" from the sequence?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDelete(item.id) },
    ]);
  };

  return (
    <View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Add a lesson title"
          placeholderTextColor={Colors.ui.textLight}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addButton, !newTitle.trim() && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!newTitle.trim()}
          activeOpacity={0.7}
        >
          <Plus size={18} color="white" />
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No lessons in your sequence yet.</Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.itemRow, index < items.length - 1 && styles.itemRowBorder]}
            >
              <Text style={styles.orderBadge}>{index + 1}</Text>

              {editingId === item.id ? (
                <TextInput
                  style={styles.editInput}
                  value={editingTitle}
                  onChangeText={setEditingTitle}
                  autoFocus
                  onSubmitEditing={handleSaveEdit}
                  returnKeyType="done"
                />
              ) : (
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              )}

              <View style={styles.actions}>
                {editingId === item.id ? (
                  <TouchableOpacity onPress={handleSaveEdit} style={styles.iconButton}>
                    <Text style={styles.saveEditText}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => moveItem(index, -1)}
                      disabled={index === 0}
                      style={styles.iconButton}
                    >
                      <ChevronUp
                        size={18}
                        color={index === 0 ? Colors.ui.border : Colors.ui.textLight}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      style={styles.iconButton}
                    >
                      <ChevronDown
                        size={18}
                        color={
                          index === items.length - 1 ? Colors.ui.border : Colors.ui.textLight
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleStartEdit(item)}
                      style={styles.iconButton}
                    >
                      <Pencil size={16} color={Colors.brand[600]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(item)}
                      style={styles.iconButton}
                    >
                      <Trash2 size={16} color={Colors.ui.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.ui.text,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  orderBadge: {
    width: 24,
    textAlign: 'center',
    ...Typography.label,
    color: Colors.brand[600],
  },
  itemTitle: {
    flex: 1,
    ...Typography.body,
    color: Colors.ui.text,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    borderWidth: 1,
    borderColor: Colors.brand[300],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...Typography.body,
    color: Colors.ui.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
  },
  saveEditText: {
    ...Typography.label,
    color: Colors.brand[600],
    fontSize: 13,
  },
});
