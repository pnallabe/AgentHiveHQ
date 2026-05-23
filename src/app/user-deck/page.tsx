'use client';

import { DeckLayout } from '@/components/deck/DeckLayout';
import {
  UserCover, UserProblem, UserPain, UserSolution, UserProductDemo,
  UserModules, UserDifferentiators, UserUseCases, UserValueProp, UserCTA,
} from '@/components/deck/slides/UserDeckSlides';

const SLIDES = [
  <UserCover />,
  <UserProblem />,
  <UserPain />,
  <UserSolution />,
  <UserProductDemo />,
  <UserModules />,
  <UserDifferentiators />,
  <UserUseCases />,
  <UserValueProp />,
  <UserCTA />,
];

export default function UserDeckPage() {
  return (
    <DeckLayout
      slides={SLIDES}
      title="ILOL — Customer Deck"
      accentColor="blue"
      backHref="/"
    />
  );
}
