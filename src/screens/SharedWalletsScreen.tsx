// Shared Wallets screen — manage wallet members for family/shared expense tracking
// Allows inviting members, assigning roles, and viewing contribution breakdown

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectWallets } from '../store';
import { SharedWalletMember } from '../types';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';

// Avatar color palette for member visual identity
const AVATAR_COLORS = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

const SharedWalletsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const wallets = useAppStore(selectWallets);

  // Local member list (future: sync with backend or local DB)
  const [members, setMembers] = useState<SharedWalletMember[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member' | 'viewer'>('member');

  // Add a new member to the shared wallet with a unique ID and random avatar color
  const handleAddMember = () => {
    if (!memberName.trim()) return;
    const newMember: SharedWalletMember = {
      id: Date.now().toString(),
      name: memberName.trim(),
      role: memberRole,
      avatar: AVATAR_COLORS[members.length % AVATAR_COLORS.length],
    };
    setMembers([...members, newMember]);
    setMemberName('');
    setShowAddModal(false);
  };

  // Remove a member with confirmation dialog
  const handleRemoveMember = (id: string, name: string) => {
    Alert.alert(t.sharedWallets.removeMember, `${t.sharedWallets.removeConfirm} ${name}?`, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => setMembers(members.filter(m => m.id !== id)) },
    ]);
  };

  // Generate initials from member name for avatar display
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  };

  // Map role to translated display label
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return t.sharedWallets.admin;
      case 'member': return t.sharedWallets.member;
      case 'viewer': return t.sharedWallets.viewer;
      default: return role;
    }
  };

  // Available role options for the picker
  const ROLES: ('admin' | 'member' | 'viewer')[] = ['admin', 'member', 'viewer'];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Wallet info header */}
        <Card style={styles.headerCard}>
          <MaterialCommunityIcons name="account-group" size={36} color={theme.colors.primary} />
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t.sharedWallets.title}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {members.length} {t.sharedWallets.members}
          </Text>
        </Card>

        {members.length === 0 ? (
          // Empty state when no members have been added
          <EmptyState
            icon="account-plus"
            title={t.sharedWallets.noMembers}
            subtitle={t.sharedWallets.noMembersHint}
            actionLabel={t.sharedWallets.addMember}
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          // Member list with avatars and role badges
          <>
            {members.map((member) => (
              <TouchableOpacity key={member.id} onLongPress={() => handleRemoveMember(member.id, member.name)}>
                <Card style={styles.memberCard}>
                  <View style={styles.memberRow}>
                    {/* Avatar circle with initials */}
                    <View style={[styles.avatar, { backgroundColor: member.avatar || AVATAR_COLORS[0] }]}>
                      <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: theme.colors.text }]}>{member.name}</Text>
                      {/* Role badge */}
                      <View style={[styles.roleBadge, { backgroundColor: theme.colors.inputBackground }]}>
                        <Text style={[styles.roleText, { color: theme.colors.textSecondary }]}>
                          {getRoleLabel(member.role)}
                        </Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.colors.textTertiary} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB for adding new members */}
      {members.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowAddModal(true)}
          accessibilityLabel={t.sharedWallets.addMember}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="account-plus" size={26} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Add Member Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t.sharedWallets.addMember}</Text>

            {/* Member name input */}
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={memberName}
              onChangeText={setMemberName}
              placeholder={t.sharedWallets.memberName}
              placeholderTextColor={theme.colors.textTertiary}
              autoFocus
            />

            {/* Role selection chips */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t.sharedWallets.role}</Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChip,
                    { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border },
                    memberRole === role && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setMemberRole(role)}
                >
                  <Text style={[styles.roleChipText, { color: memberRole === role ? theme.colors.primary : theme.colors.text }]}>
                    {getRoleLabel(role)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <Button title={t.common.cancel} variant="outline" onPress={() => setShowAddModal(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title={t.sharedWallets.addMember} onPress={handleAddMember} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  headerCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  memberCard: { marginBottom: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600' },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  roleText: { fontSize: 11, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  roleChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  roleChipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', marginTop: 8 },
});

export default SharedWalletsScreen;
