import type { DrillExercise, DrillOutcome } from '@/lib/session/engine';
import type { VocabCard } from '@/types';
import { ClozeExerciseView } from './ClozeExerciseView';
import { FoilExerciseView } from './FoilExerciseView';
import { MenuExerciseView } from './MenuExerciseView';

export interface DrillStepProps {
  exercise: DrillExercise;
  getCard: (id: string) => VocabCard | undefined;
  onComplete: (outcomes: DrillOutcome[]) => void;
  onSkip: () => void;
}

/** Renders whichever drill modality the engine scheduled. */
export function DrillStep({ exercise, getCard, onComplete, onSkip }: DrillStepProps) {
  switch (exercise.type) {
    case 'cloze': {
      const card = getCard(exercise.cardId);
      if (!card) {
        onSkip();
        return null;
      }
      return (
        <ClozeExerciseView
          key={exercise.cardId}
          exercise={exercise}
          card={card}
          onComplete={onComplete}
        />
      );
    }
    case 'foil_discrimination':
      return <FoilExerciseView key={exercise.cardId} exercise={exercise} onComplete={onComplete} />;
    case 'realia_menu':
      return (
        <MenuExerciseView
          key={exercise.cardIds.join('-')}
          exercise={exercise}
          onComplete={onComplete}
        />
      );
    default:
      return null;
  }
}
