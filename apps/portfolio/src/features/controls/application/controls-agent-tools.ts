import {
  defineDateTimePickerTools,
  defineNumericEditorTools,
} from '@frozik/components/components/RichEditor/editor-agent-tools';
import { EDateTimeStep, ETimeResolution } from '@frozik/utils/date/constants';
import { getNowInstant } from '@frozik/utils/date/now';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import type { ControlsDemoStore } from './ControlsDemoStore';

const DECIMALS_MIN = 0;
const DECIMALS_MAX = 10;
const PIP_MIN = -2;
const PIP_MAX = 6;

function readSettings(store: ControlsDemoStore) {
  return {
    number: { decimals: store.decimals, pip: store.pip ?? null },
    date: {
      arrowStep: store.step,
      timeResolution: store.timeResolution,
      direction: store.direction,
      timeZone: store.timeZone,
    },
  };
}

/** The two demo fields through the component library's own tools, plus the knobs that shape them. */
export function createControlsAgentTools(store: ControlsDemoStore): readonly IAgentTool[] {
  return [
    ...defineNumericEditorTools({
      name: 'controls_number',
      label: 'Rate / Amount / Number',
      getValue: () => store.numericValue,
      setValue: store.setNumericValue,
      getFormat: () => store.numericFormat,
    }),
    ...defineDateTimePickerTools({
      name: 'controls_date',
      label: 'Date / Time',
      getValue: () => store.dateValue,
      setValue: store.setDateValue,
      parse: store.parseDate,
      getNow: getNowInstant,
      getRange: () => ({ timeZone: store.timeZone }),
    }),
    defineAgentTool({
      name: 'controls_read_settings',
      title: 'Read the field settings',
      description:
        "Reads how the fields are set up: the number field's decimals and highlighted pip " +
        "digits, and the date field's arrow-key step, time precision and how it resolves an " +
        'ambiguous day ("future" picks the next one, "nearest" the closest).',
      input: z.object({}),
      readOnly: true,
      execute: () => readSettings(store),
    }),
    defineAgentTool({
      name: 'controls_set_number_format',
      title: 'Set the number format',
      description:
        'Sets the decimals the number field rounds to and the digits it highlights as pips, ' +
        'from one decimal position to another (negative positions are left of the point; ' +
        'equal positions turn the highlight off). Leave out what should not change.',
      input: z.object({
        decimals: z.int().min(DECIMALS_MIN).max(DECIMALS_MAX).optional(),
        pipFrom: z.int().min(PIP_MIN).max(PIP_MAX).optional(),
        pipTo: z.int().min(PIP_MIN).max(PIP_MAX).optional(),
      }),
      execute: ({ decimals, pipFrom, pipTo }) => {
        if (!isNil(decimals)) {
          store.setDecimals(decimals);
        }
        if (!isNil(pipFrom) || !isNil(pipTo)) {
          const [currentFrom, currentTo] = store.pipRange;
          store.setPipRange([pipFrom ?? currentFrom, pipTo ?? currentTo]);
        }
        return readSettings(store);
      },
    }),
    defineAgentTool({
      name: 'controls_set_date_options',
      title: 'Set the date field options',
      description:
        "Sets the date field's arrow-key step, its time precision and how it resolves an " +
        'ambiguous day. Leave out what should not change.',
      input: z.object({
        arrowStep: z.enum(EDateTimeStep).optional(),
        timeResolution: z.enum(ETimeResolution).optional(),
        direction: z.enum(['future', 'nearest']).optional(),
      }),
      execute: ({ arrowStep, timeResolution, direction }) => {
        if (!isNil(arrowStep)) {
          store.setStep(arrowStep);
        }
        if (!isNil(timeResolution)) {
          store.setTimeResolution(timeResolution);
        }
        if (!isNil(direction)) {
          store.setDirection(direction);
        }
        return readSettings(store);
      },
    }),
  ];
}
