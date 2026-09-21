/**
 * Root error boundary.
 * Catches any unhandled render error in the tree and shows a
 * recovery screen instead of a blank white crash.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { colors, fontFamily, spacing, radius } from '@/theme';
import { Text } from '@/components/ui/Text';

interface Props   { children: React.ReactNode }
interface State   { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // In production, forward to your crash reporting service here.
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  handleRestart = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Gati hit an unexpected error. Tap below to try again. Your data is safe.
          </Text>
          {__DEV__ && (
            <Text style={styles.debug} numberOfLines={4}>
              {this.state.message}
            </Text>
          )}
          <Pressable style={styles.btn} onPress={this.handleRestart}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         spacing[6],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing[6],
    alignItems:      'center',
    width:           '100%',
  },
  emoji: {
    fontSize:     36,
    marginBottom: spacing[4],
  },
  title: {
    fontFamily:   fontFamily.bold,
    fontSize:     19,
    color:        colors.textPrimary,
    textAlign:    'center',
    marginBottom: spacing[2],
    letterSpacing: -0.3,
  },
  body: {
    fontFamily:   fontFamily.regular,
    fontSize:     13,
    color:        colors.textSecondary,
    textAlign:    'center',
    lineHeight:   19.5,
    marginBottom: spacing[5],
  },
  debug: {
    fontFamily:       fontFamily.regular,
    fontSize:         10.5,
    color:            colors.textMuted,
    backgroundColor:  colors.surface2,
    borderRadius:     radius.md,
    padding:          spacing[3],
    marginBottom:     spacing[4],
    width:            '100%',
  },
  btn: {
    backgroundColor: colors.green700,
    borderRadius:    radius.lg,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[6],
  },
  btnText: {
    fontFamily: fontFamily.semiBold,
    fontSize:   14,
    color:      colors.white,
  },
});
