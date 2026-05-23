'use client';

import { DeckLayout } from '@/components/deck/DeckLayout';
import {
  InvestorCover, InvestorMarket, InvestorProblem, InvestorSolution,
  InvestorArchitecture, InvestorWhyNow, InvestorBusinessModel, InvestorTraction,
  InvestorCompetitive, InvestorMoat, InvestorGTM, InvestorFinancials,
  InvestorTeam, InvestorAsk,
} from '@/components/deck/slides/InvestorDeckSlides';

const SLIDES = [
  <InvestorCover />,
  <InvestorMarket />,
  <InvestorProblem />,
  <InvestorSolution />,
  <InvestorArchitecture />,
  <InvestorWhyNow />,
  <InvestorBusinessModel />,
  <InvestorTraction />,
  <InvestorCompetitive />,
  <InvestorMoat />,
  <InvestorGTM />,
  <InvestorFinancials />,
  <InvestorTeam />,
  <InvestorAsk />,
];

export default function InvestorDeckPage() {
  return (
    <DeckLayout
      slides={SLIDES}
      title="ILOL — Investor Deck"
      accentColor="blue"
      backHref="/"
    />
  );
}
