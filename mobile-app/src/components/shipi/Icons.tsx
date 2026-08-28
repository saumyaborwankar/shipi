import React, { useEffect } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface IconProps {
  color?: string;
  size?: number;
}

function baseSvg(props: IconProps & { children: React.ReactNode }): React.ReactElement {
  const { color = 'currentColor', size = 20, children } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function ChevronIcon(props: IconProps & { open: boolean }): React.ReactElement {
  const { color = 'currentColor', size = 12, open } = props;
  const rotation = useSharedValue(open ? 90 : 0);

  useEffect(() => {
    rotation.value = withTiming(open ? 90 : 0, { duration: 180 });
  }, [open, rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <AnimatedSvg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={animStyle}>
      <Path d="M3 1.5 L7 5 L3 8.5" />
    </AnimatedSvg>
  );
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export function FileIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <Path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />,
  });
}

export function FolderIcon(props: IconProps & { open: boolean }): React.ReactElement {
  const { open, ...rest } = props;
  if (open) {
    return baseSvg({
      ...rest,
      children: <Path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />,
    });
  }
  return baseSvg({
    ...rest,
    children: <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  });
}

export function PlusIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <Path d="M12 5v14M5 12h14" />,
  });
}

export function PencilIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <Path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
  });
}

export function TrashIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </>
    ),
  });
}

export function SyncIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <Path d="M21 12a9 9 0 1 1-2.6-6.3" />
        <Path d="M21 3v6h-6" />
      </>
    ),
  });
}

export function LockIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <Rect x={4} y={11} width={16} height={10} rx={2} />
        <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
  });
}

export function EyeIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <Circle cx={12} cy={12} r={3} />
      </>
    ),
  });
}

export function EditIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  });
}

export function MarkdownIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <Path d="M21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM4 12h3l1.5-2 1.5 2h3M14 12V9.5M16 9.5l2 2.5 2-2.5" />,
  });
}

export function SignOutIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <Path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
  });
}

export function VaultIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <Path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <Path d="M2 10h20M9 4v6M15 4v6" />
      </>
    ),
  });
}

export function GoogleIcon(props: IconProps): React.ReactElement {
  const { size = 18 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

function Rect(props: { x: number; y: number; width: number; height: number; rx: number }): React.ReactElement {
  const { x, y, width, height, rx } = props;
  return <Path d={`M${x} ${y + rx} a${rx} ${rx} 0 0 1 ${rx} -${rx} h${width - 2 * rx} a${rx} ${rx} 0 0 1 ${rx} ${rx} v${height - 2 * rx} a${rx} ${rx} 0 0 1 -${rx} ${rx} h-${width - 2 * rx} a${rx} ${rx} 0 0 1 -${rx} -${rx} z`} />;
}
