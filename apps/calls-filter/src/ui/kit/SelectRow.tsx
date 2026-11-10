import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';

import { usePalette } from '../theme/AppTheme';
import { ICON_SIZE } from './metrics';
import { Row } from './Row';
import { Sheet } from './Sheet';

interface IOption<TValue> {
  readonly value: TValue;
  readonly label: string;
  readonly testID: string;
}

/**
 * A choice of one from a list as a dropdown on a phone: the row shows the chosen option, a tap
 * opens the whole list in a sheet — as long as the list needs to be.
 */
export function SelectRow<TValue>({
  title,
  options,
  value,
  onChange,
  testID,
}: {
  readonly title: string;
  readonly options: readonly IOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const chosen = options.find(option => option.value === value);
  return (
    <>
      <Row
        testID={testID}
        title={title}
        subtitle={chosen?.label}
        trailing={<ChevronDown color={palette.fgDim} size={ICON_SIZE} />}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <Sheet visible title={title} onClose={() => setOpen(false)} testID={`${testID}-sheet`}>
          {options.map(option => (
            <Row
              key={option.testID}
              testID={option.testID}
              title={option.label}
              selected={option.value === value}
              trailing={
                option.value === value ? <Check color={palette.accent} size={ICON_SIZE} /> : null
              }
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
            />
          ))}
        </Sheet>
      ) : null}
    </>
  );
}
