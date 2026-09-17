import type { DrillExercise, DrillOutcome } from '@/lib/session/engine';
import type { VocabCard } from '@/types';
import { ClozeExerciseView } from './ClozeExerciseView';
import { FindInTextView } from './FindInTextView';
import { FoilExerciseView } from './FoilExerciseView';
import { MeaningExerciseView } from './MeaningExerciseView';
import { MenuExerciseView } from './MenuExerciseView';
import { SoundFamilyView } from './SoundFamilyView';
import { TypedReadingView } from './TypedReadingView';

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
      return (
        <FoilExerciseView
          key={exercise.cardId}
          exercise={exercise}
          card={getCard(exercise.cardId)}
          onComplete={onComplete}
        />
      );
    case 'meaning_to_form':
      return (
        <MeaningExerciseView
          key={exercise.cardId}
          exercise={exercise}
          card={getCard(exercise.cardId)}
          onComplete={onComplete}
        />
      );
    case 'typed_reading':
      return (
        <TypedReadingView
          key={exercise.cardId}
          exercise={exercise}
          card={getCard(exercise.cardId)}
          onComplete={onComplete}
        />
      );
    case 'find_in_text':
      return (
        <FindInTextView
          key={exercise.cardId}
          exercise={exercise}
          card={getCard(exercise.cardId)}
          onComplete={onComplete}
        />
      );
    case 'sound_family':
      return (
        <SoundFamilyView
          key={exercise.cardId}
          exercise={exercise}
          card={getCard(exercise.cardId)}
          onComplete={onComplete}
        />
      );
    case 'realia_menu':
      return (
        <MenuExerciseView
          key={exercise.cardIds.join('-')}
          exercise={exercise}
          getCard={getCard}
          onComplete={onComplete}
        />
      );
    default:
      return null;
  }
}
