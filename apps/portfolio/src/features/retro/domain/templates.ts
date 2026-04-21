import type { ColumnId, ITemplateConfig } from './types';
import { ERetroTemplate } from './types';

const SCRUM_TEMPLATE: ITemplateConfig = {
  id: ERetroTemplate.Scrum,
  name: 'Scrum',
  description: 'Classic three-column retro: celebrate wins, surface issues, commit to actions.',
  columns: [
    {
      id: 'scrum-went-well' as ColumnId,
      title: 'Went Well',
      emoji: '🟢',
      color: '#22c55e',
      prompt: 'What worked, what made you proud?',
    },
    {
      id: 'scrum-to-improve' as ColumnId,
      title: 'To Improve',
      emoji: '🟡',
      color: '#eab308',
      prompt: 'What slowed us down or felt off?',
    },
    {
      id: 'scrum-action-items' as ColumnId,
      title: 'Action Items',
      emoji: '🎯',
      color: '#3b82f6',
      prompt: 'Concrete things we will try next sprint.',
    },
  ],
};

const MAD_SAD_GLAD_TEMPLATE: ITemplateConfig = {
  id: ERetroTemplate.MadSadGlad,
  name: 'Mad Sad Glad',
  description: 'Emotional retro — useful after a rough sprint when feelings matter.',
  columns: [
    {
      id: 'msg-mad' as ColumnId,
      title: 'Mad',
      emoji: '😠',
      color: '#ef4444',
      prompt: 'What frustrated you?',
    },
    {
      id: 'msg-sad' as ColumnId,
      title: 'Sad',
      emoji: '😢',
      color: '#6366f1',
      prompt: 'What disappointed you?',
    },
    {
      id: 'msg-glad' as ColumnId,
      title: 'Glad',
      emoji: '😊',
      color: '#22c55e',
      prompt: 'What made you happy?',
    },
  ],
};

const START_STOP_CONTINUE_TEMPLATE: ITemplateConfig = {
  id: ERetroTemplate.StartStopContinue,
  name: 'Start Stop Continue',
  description: 'Action-oriented retro focused on behavioural change.',
  columns: [
    {
      id: 'ssc-start' as ColumnId,
      title: 'Start doing',
      emoji: '▶️',
      color: '#22c55e',
      prompt: 'What should we begin doing?',
    },
    {
      id: 'ssc-stop' as ColumnId,
      title: 'Stop doing',
      emoji: '⏹️',
      color: '#ef4444',
      prompt: 'What should we stop doing?',
    },
    {
      id: 'ssc-continue' as ColumnId,
      title: 'Continue doing',
      emoji: '🔁',
      color: '#3b82f6',
      prompt: 'What should we keep doing?',
    },
  ],
};

export const RETRO_TEMPLATES: readonly ITemplateConfig[] = [
  SCRUM_TEMPLATE,
  MAD_SAD_GLAD_TEMPLATE,
  START_STOP_CONTINUE_TEMPLATE,
];

export function getTemplateById(templateId: ERetroTemplate): ITemplateConfig {
  const template = RETRO_TEMPLATES.find(candidate => candidate.id === templateId);

  if (template === undefined) {
    throw new Error(`Unknown retro template: ${templateId}`);
  }

  return template;
}

export function getDefaultTemplate(): ITemplateConfig {
  return SCRUM_TEMPLATE;
}
