import type { ColumnId, ITemplateConfig } from './types';

const SCRUM_TEMPLATE_EN: ITemplateConfig = {
  id: 'scrum-en',
  name: 'Scrum (EN)',
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

const SCRUM_TEMPLATE_RU: ITemplateConfig = {
  id: 'scrum-ru',
  name: 'Scrum (RU)',
  description:
    'Классический ретро из трёх колонок: отмечаем успехи, вскрываем проблемы, фиксируем шаги.',
  columns: [
    {
      id: 'scrum-went-well' as ColumnId,
      title: 'Что прошло хорошо',
      emoji: '🟢',
      color: '#22c55e',
      prompt: 'Что сработало, чем вы гордитесь?',
    },
    {
      id: 'scrum-to-improve' as ColumnId,
      title: 'Что улучшить',
      emoji: '🟡',
      color: '#eab308',
      prompt: 'Что тормозило или шло не так?',
    },
    {
      id: 'scrum-action-items' as ColumnId,
      title: 'План действий',
      emoji: '🎯',
      color: '#3b82f6',
      prompt: 'Какие конкретные шаги попробуем в следующем спринте.',
    },
  ],
};

export const RETRO_TEMPLATES: readonly ITemplateConfig[] = [SCRUM_TEMPLATE_EN, SCRUM_TEMPLATE_RU];

export function getTemplateById(templateId: string): ITemplateConfig {
  const template = RETRO_TEMPLATES.find(candidate => candidate.id === templateId);

  if (template === undefined) {
    throw new Error(`Unknown retro template: ${templateId}`);
  }

  return template;
}
