import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
}

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|\[[^\]]*\]\([^)]+\))/g;

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    let seg: InlineSegment;
    if (token.startsWith('**')) {
      seg = { text: token.slice(2, -2), bold: true };
    } else if (token.startsWith('*')) {
      seg = { text: token.slice(1, -1), italic: true };
    } else if (token.startsWith('~~')) {
      seg = { text: token.slice(2, -2), strike: true };
    } else if (token.startsWith('`')) {
      seg = { text: token.slice(1, -1), code: true };
    } else {
      const inner = token.slice(1, -1);
      const open = inner.indexOf('](');
      const label = inner.slice(0, open);
      const href = inner.slice(open + 2);
      seg = { text: label, link: href };
    }
    segments.push(seg);
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }
  return segments;
}

function InlineText({ text }: { text: string }): React.ReactElement {
  const segments = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {segments.map((seg, i) => {
        const base: Record<string, unknown> = { key: `${i}:${seg.text}` };
        let inner: React.ReactNode = seg.text;
        if (seg.code) {
          inner = (
            <Text key={`${i}:c`} style={styles.inlineCode}>
              {inner}
            </Text>
          );
        } else if (seg.link) {
          inner = (
            <Text
              key={`${i}:l`}
              style={styles.link}
              onPress={() => Linking.openURL(seg.link as string).catch(() => undefined)}>
              {inner}
            </Text>
          );
        }
        return (
          <Text
            key={base.key as string}
            style={[
              seg.bold && styles.bold,
              seg.italic && styles.italic,
              seg.strike && styles.strike,
            ]}>
            {inner}
          </Text>
        );
      })}
    </>
  );
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'ul'; items: { text: string; checked: boolean | null }[] }
  | { kind: 'ol'; items: { text: string; checked: boolean | null }[] }
  | { kind: 'code'; code: string }
  | { kind: 'hr' };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  const headingRe = /^(#{1,6})\s+(.*)$/;
  const taskRe = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
  const ulRe = /^\s*[-*+]\s+(.*)$/;
  const olRe = /^\s*\d+[.)]\s+(.*)$/;
  const quoteRe = /^\s*>\s?(.*)$/;
  const hrRe = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
  const fenceRe = /^\s*```/;

  while (i < lines.length) {
    const line = lines[i];

    if (fenceRe.test(line)) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !fenceRe.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: 'code', code: codeLines.join('\n') });
      continue;
    }

    if (hrRe.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    const heading = headingRe.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (quoteRe.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const m = quoteRe.exec(lines[i]);
        if (!m) {
          break;
        }
        quoteLines.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    const task = taskRe.exec(line);
    if (task) {
      const items: { text: string; checked: boolean | null }[] = [
        { text: task[2], checked: task[1].toLowerCase() === 'x' },
      ];
      i += 1;
      let m: RegExpExecArray | null;
      while (i < lines.length && (m = taskRe.exec(lines[i])) !== null) {
        items.push({ text: m[2], checked: m[1].toLowerCase() === 'x' });
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    const ul = ulRe.exec(line);
    if (ul) {
      const items: { text: string; checked: boolean | null }[] = [{ text: ul[1], checked: null }];
      i += 1;
      let m: RegExpExecArray | null;
      while (i < lines.length && lines[i].trim() !== '' && (m = ulRe.exec(lines[i])) !== null) {
        items.push({ text: m[1], checked: null });
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    const ol = olRe.exec(line);
    if (ol) {
      const items: { text: string; checked: boolean | null }[] = [{ text: ol[1], checked: null }];
      i += 1;
      let m: RegExpExecArray | null;
      while (i < lines.length && lines[i].trim() !== '' && (m = olRe.exec(lines[i])) !== null) {
        items.push({ text: m[1], checked: null });
        i += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const paraLines = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !headingRe.test(lines[i]) &&
      !quoteRe.test(lines[i]) &&
      !ulRe.test(lines[i]) &&
      !olRe.test(lines[i]) &&
      !hrRe.test(lines[i]) &&
      !fenceRe.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}

function Checkbox({ checked }: { checked: boolean }): React.ReactElement {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && (
        <Svg width={9} height={9} viewBox="0 0 9 9" fill="none">
          <Path d="M1.5 4.5 L3.5 6.5 L7.5 2.5" stroke={colors.onPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

export function MarkdownPreview({ source }: { source: string }): React.ReactElement {
  const blocks = useMemo(() => parseBlocks(source), [source]);

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text key={idx} style={headingStyles[block.level - 1]}>
                <InlineText text={block.text} />
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={idx} style={styles.paragraph}>
                <InlineText text={block.text} />
              </Text>
            );
          case 'quote':
            return (
              <View key={idx} style={styles.quote}>
                <Text style={styles.quoteText}>
                  <InlineText text={block.text} />
                </Text>
              </View>
            );
          case 'code':
            return (
              <View key={idx} style={styles.codeBlock}>
                <Text style={styles.codeBlockText}>{block.code}</Text>
              </View>
            );
          case 'hr':
            return <View key={idx} style={styles.hr} />;
          case 'ul':
          case 'ol':
            return (
              <View key={idx} style={styles.list}>
                {block.items.map((item, itemIdx) => (
                  <View key={itemIdx} style={styles.listRow}>
                    <View style={styles.listMarker}>
                      {item.checked !== null ? (
                        <Checkbox checked={item.checked} />
                      ) : block.kind === 'ul' ? (
                        <Text style={styles.bullet}>•</Text>
                      ) : (
                        <Text style={styles.bullet}>{itemIdx + 1}.</Text>
                      )}
                    </View>
                    <Text style={[styles.listText, item.checked ? styles.taskChecked : null]}>
                      <InlineText text={item.text} />
                    </Text>
                  </View>
                ))}
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xxs + 1,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.inkSecondary,
    fontFamily: fonts.sans,
  },
  bold: {
    fontWeight: '700',
    color: colors.ink,
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
    color: colors.inkFaint,
  },
  inlineCode: {
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
    color: colors.primaryActive,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  h1: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.75,
    marginTop: spacing.md,
    marginBottom: spacing.xxs,
    color: colors.ink,
    fontFamily: fonts.sans,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xxs,
    color: colors.ink,
    fontFamily: fonts.sans,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.sm,
    color: colors.ink,
    fontFamily: fonts.sans,
  },
  h4: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: spacing.sm,
    color: colors.ink,
    fontFamily: fonts.sans,
  },
  h5: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.sm,
    color: colors.inkSecondary,
    fontFamily: fonts.sans,
  },
  h6: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
    color: colors.inkMuted,
    fontFamily: fonts.sans,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
  },
  quoteText: {
    fontSize: 15,
    color: colors.inkSecondary,
    fontFamily: fonts.sans,
    lineHeight: 22,
  },
  codeBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  codeBlockText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
  },
  hr: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
    marginVertical: spacing.sm,
  },
  list: {
    gap: spacing.xxs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listMarker: {
    width: 24,
    alignItems: 'center',
    paddingTop: 5,
  },
  bullet: {
    fontSize: 15,
    color: colors.inkMuted,
    fontFamily: fonts.sans,
  },
  listText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    color: colors.inkSecondary,
    fontFamily: fonts.sans,
  },
  taskChecked: {
    color: colors.inkFaint,
    textDecorationLine: 'line-through',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});

const headingStyles = [
  styles.h1,
  styles.h2,
  styles.h3,
  styles.h4,
  styles.h5,
  styles.h6,
];
