import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getApiBaseUrl, useAuth } from '../../core/hooks/useAuth';

interface StaffUser {
  id: string;
  email: string;
  role: string;
}

interface PermissionEntry {
  id: string;
  name: string;
  description: string;
  source: 'role' | 'grant' | 'deny' | string;
  is_effective: boolean;
}

interface UserDetail extends StaffUser {
  permissions: PermissionEntry[];
}

interface RoleRecord {
  name: string;
  permissions: string[];
}

interface CatalogPermission {
  id: string;
  name: string;
  description: string;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `${fallback} (${res.status})`;
}

function sourceLabel(entry: PermissionEntry): string {
  switch (entry.source) {
    case 'grant':
      return 'Directly Assigned';
    case 'deny':
      return 'Directly Denied';
    case 'role':
      return entry.is_effective ? 'Inherited from Role' : 'Not in Role';
    default:
      return entry.source;
  }
}

export default function AdminTeamScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogPermission[]>([]);
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('sales');
  const [roleName, setRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }),
    [accessToken]
  );

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('You are not signed in.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/admin/users`, { headers: headers() }),
        fetch(`${getApiBaseUrl()}/api/admin/roles`, { headers: headers() }),
        fetch(`${getApiBaseUrl()}/api/admin/permissions`, { headers: headers() }),
      ]);
      if (!usersRes.ok) throw new Error(await parseError(usersRes, 'Failed to load users'));
      if (!rolesRes.ok) throw new Error(await parseError(rolesRes, 'Failed to load roles'));
      if (!permsRes.ok) throw new Error(await parseError(permsRes, 'Failed to load permissions'));
      const nextUsers: StaffUser[] = await usersRes.json();
      const nextRoles: RoleRecord[] = await rolesRes.json();
      const nextCatalog: CatalogPermission[] = await permsRes.json();
      setUsers(nextUsers);
      setRoles(nextRoles);
      setCatalog(nextCatalog);
      if (nextRoles.length > 0) {
        setInviteRole((current) =>
          nextRoles.some((role) => role.name === current) ? current : nextRoles[0].name
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const selectUser = async (id: string) => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/users/${id}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to load user'));
      setSelected(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setBusy(false);
    }
  };

  const inviteUser = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/users`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          role: inviteRole,
        }),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to invite user'));
      const created: StaffUser = await res.json();
      setInviteEmail('');
      setInvitePassword('');
      await load();
      await selectUser(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setBusy(false);
    }
  };

  const createRole = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/roles`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: roleName, permissions: rolePerms }),
      });
      if (!res.ok) throw new Error(await parseError(res, 'Failed to create role'));
      setRoleName('');
      setRolePerms([]);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setBusy(false);
    }
  };

  const toggleUserPermission = async (entry: PermissionEntry, nextValue: boolean) => {
    if (!accessToken || !selected) return;
    const inherited = roles
      .find((r) => r.name === selected.role)
      ?.permissions.includes(entry.name);
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (nextValue === Boolean(inherited)) {
        res = await fetch(
          `${getApiBaseUrl()}/api/admin/users/${selected.id}/permissions/${encodeURIComponent(entry.name)}`,
          { method: 'DELETE', headers: headers() }
        );
      } else {
        res = await fetch(`${getApiBaseUrl()}/api/admin/users/${selected.id}/permissions`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ permission: entry.name, is_granted: nextValue }),
        });
      }
      if (!res.ok) throw new Error(await parseError(res, 'Failed to update permission'));
      setSelected(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update permission');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Back Office</Text>
            <Text style={styles.title}>Team</Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(admin)');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to Admin Dashboard"
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator testID="team-loading" size="large" color="#000000" />
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox} testID="team-error">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Invite Staff</Text>
              <TextInput
                style={styles.input}
                placeholder="staff@kwatapos.com"
                placeholderTextColor="#8E8E93"
                autoCapitalize="none"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                testID="invite-email"
              />
              <TextInput
                style={styles.input}
                placeholder="Temporary password"
                placeholderTextColor="#8E8E93"
                secureTextEntry
                value={invitePassword}
                onChangeText={setInvitePassword}
                testID="invite-password"
              />
              <View style={styles.roleRow}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.name}
                    style={[styles.chip, inviteRole === role.name && styles.chipActive]}
                    onPress={() => setInviteRole(role.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Role ${role.name}`}
                  >
                    <Text style={[styles.chipText, inviteRole === role.name && styles.chipTextActive]}>
                      {role.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={inviteUser}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Invite Staff"
                testID="invite-staff-btn"
              >
                <Text style={styles.primaryButtonText}>Invite Staff</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>New Role</Text>
              <TextInput
                style={styles.input}
                placeholder="Weekend Staff"
                placeholderTextColor="#8E8E93"
                value={roleName}
                onChangeText={setRoleName}
                testID="role-name"
              />
              {catalog.map((perm) => {
                const on = rolePerms.includes(perm.name);
                return (
                  <View key={perm.id} style={styles.permRow}>
                    <View style={styles.permCopy}>
                      <Text style={styles.permName}>{perm.name}</Text>
                      <Text style={styles.permMeta}>{perm.description}</Text>
                    </View>
                    <Switch
                      value={on}
                      onValueChange={(value) => {
                        setRolePerms((current) =>
                          value
                            ? [...current, perm.name]
                            : current.filter((name) => name !== perm.name)
                        );
                      }}
                      trackColor={{ false: '#E5E5EA', true: '#000000' }}
                      thumbColor="#FFFFFF"
                      testID={`role-perm-${perm.name}`}
                    />
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={createRole}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Create Role"
                testID="create-role-btn"
              >
                <Text style={styles.primaryButtonText}>Create Role</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Staff</Text>
            {users.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={[styles.userRow, selected?.id === user.id && styles.userRowActive]}
                onPress={() => selectUser(user.id)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${user.email}`}
                testID={`user-row-${user.email}`}
              >
                <View>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <Text style={styles.userRole}>{user.role}</Text>
                </View>
                <Text style={styles.userAction}>Edit</Text>
              </TouchableOpacity>
            ))}

            {selected ? (
              <View style={styles.card} testID="user-permissions-card">
                <Text style={styles.sectionTitle}>{selected.email}</Text>
                <Text style={styles.permMeta}>Role {selected.role}</Text>
                {selected.permissions.map((entry) => (
                  <View key={entry.id} style={styles.permRow} testID={`user-perm-${entry.name}`}>
                    <View style={styles.permCopy}>
                      <Text style={styles.permName}>{entry.name}</Text>
                      <Text style={styles.permMeta}>{sourceLabel(entry)}</Text>
                    </View>
                    <Switch
                      value={entry.is_effective}
                      onValueChange={(value) => toggleUserPermission(entry, value)}
                      trackColor={{ false: '#E5E5EA', true: '#000000' }}
                      thumbColor="#FFFFFF"
                      disabled={busy}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    marginTop: 4,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  chipText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userRowActive: {
    borderColor: '#000000',
  },
  userEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  userRole: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  userAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  permCopy: {
    flex: 1,
    paddingRight: 12,
  },
  permName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  permMeta: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
});
