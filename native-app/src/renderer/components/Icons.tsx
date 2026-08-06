interface IconProps {
  className?: string;
}

function baseSvg(props: IconProps & { children: React.ReactNode; viewBox?: string }): React.ReactElement {
  const { className, children, viewBox = '0 0 24 24' } = props;
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ChevronIcon(props: IconProps & { open: boolean }): React.ReactElement {
  return (
    <svg
      className={props.className}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: props.open ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}
    >
      <path d="M3 1.5 L7 5 L3 8.5" />
    </svg>
  );
}

export function FileIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />,
  });
}

export function FolderIcon(props: IconProps & { open: boolean }): React.ReactElement {
  const { open, className } = props;
  if (open) {
    return baseSvg({
      className,
      children: <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />,
    });
  }
  return baseSvg({
    className,
    children: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  });
}

export function PlusIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <path d="M12 5v14M5 12h14" />,
  });
}

export function PencilIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
  });
}

export function TrashIcon(props: IconProps): React.ReactElement {
  return baseSvg({
    ...props,
    children: (
      <>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </>
    ),
  });
}
