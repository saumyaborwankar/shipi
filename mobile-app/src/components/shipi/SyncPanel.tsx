import React, { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useStore } from '@/store';
import { Button, Card, Field, Pill, ShipiText } from './ui';
import { LockIcon, SyncIcon, SignOutIcon } from './Icons';
import { colors, radius, shadows, spacing } from '@/theme/tokens';

function formatTime(iso: string | null): string {
  if (!iso) {
    return 'never';
  }
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(email: string): string {
  const at = email.indexOf('@');
  const local = at > 0 ? email.slice(0, at) : email;
  return local.slice(0, 2).toUpperCase();
}

export function SyncPanel(): React.ReactElement {
  const sync = useStore((s) => s.sync);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      if (mode === 'signin') {
        await useStore.getState().signIn(email, password);
      } else {
        await useStore.getState().signUp(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sync.signedIn) {
    return (
      <View style={styles.wrap}>
        <Card style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <ShipiText type="bodySm" color="onPrimary" style={{ fontWeight: '700' }}>
                {initials(sync.email ?? '?')}
              </ShipiText>
            </View>
            <View style={styles.accountText}>
              <ShipiText type="bodySm" color="ink" style={{ fontWeight: '600' }} numberOfLines={1}>
                {sync.email}
              </ShipiText>
              <View style={styles.pillRow}>
                {sync.syncing ? (
                  <Pill color="warning">Syncing…</Pill>
                ) : (
                  <Pill color={sync.lastSyncedAt ? 'success' : 'inkMuted'}>
                    Last synced {formatTime(sync.lastSyncedAt)}
                  </Pill>
                )}
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              variant="primary"
              onPress={() => void useStore.getState().syncNow()}
              disabled={sync.syncing}
              style={styles.flex1}
              leading={<SyncIcon color={colors.onPrimary} size={16} />}>
              {sync.syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button
              onPress={() => void useStore.getState().signOut()}
              disabled={sync.syncing}
              leading={<SignOutIcon color={colors.ink} size={16} />}>
              Sign out
            </Button>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.formHeader}>
          <View style={styles.formIcon}>
            <LockIcon color={colors.primary} size={18} />
          </View>
          <View style={styles.formHeaderText}>
            <ShipiText type="bodySm" color="ink" style={{ fontWeight: '600' }}>
              {mode === 'signin' ? 'Sign in to sync' : 'Create your account'}
            </ShipiText>
            <ShipiText type="caption" color="inkFaint">
              End-to-end encrypted. Only you can read your notes.
            </ShipiText>
          </View>
        </View>
        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="min 8 characters"
            secureTextEntry
            onSubmitEditing={() => void submit()}
          />
          <Button
            variant="primary"
            onPress={() => void submit()}
            disabled={submitting}
            style={styles.submit}
            leading={<SyncIcon color={colors.onPrimary} size={16} />}>
            {submitting ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
          <Button variant="ghost" onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Button>
        </View>
        {sync.message && (
          <ShipiText type="caption" color="danger" style={styles.message}>
            {sync.message}
          </ShipiText>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  card: {
    ...shadows.soft,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  pillRow: {
    flexDirection: 'row',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeaderText: {
    flex: 1,
    gap: 1,
  },
  form: {
    gap: spacing.sm,
  },
  submit: {
    marginTop: spacing.xxs,
  },
  message: {
    marginTop: spacing.xs,
  },
});
