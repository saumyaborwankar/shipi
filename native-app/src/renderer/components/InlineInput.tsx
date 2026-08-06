import { useEffect, useRef, useState } from 'react';

interface InlineInputProps {
  initial: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function InlineInput({ initial, placeholder, onCommit, onCancel }: InlineInputProps): React.ReactElement {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = (): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    const trimmed = value.trim();
    if (trimmed) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  };

  const cancel = (): void => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={ref}
      className="inline-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
        } else if (e.key === 'Escape') {
          cancel();
        }
      }}
      onBlur={commit}
    />
  );
}
