"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";

type Challenge = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

const challenges: Challenge[] = [
  {
    question: "A dashboard shows $500 in revenue and $100 in profit. What is the profit margin?",
    choices: ["5%", "20%", "25%", "40%"],
    answer: "20%",
    explanation: "Profit margin = profit / revenue x 100 = 100 / 500 x 100 = 20%.",
  },
  {
    question: "A $150 item gets a 10% discount. What is the sale price?",
    choices: ["$135", "$140", "$145", "$125"],
    answer: "$135",
    explanation: "Ten percent of $150 is $15. Subtract the discount: $150 - $15 = $135.",
  },
  {
    question: "You set a monthly savings target of $250. How much will you save in 3 months?",
    choices: ["$500", "$650", "$750", "$1,000"],
    answer: "$750",
    explanation: "$250 per month x 3 months = $750, assuming you meet the target every month.",
  },
  {
    question: "Revenue rises from $80,000 to $100,000. What is the percentage increase?",
    choices: ["20%", "25%", "30%", "15%"],
    answer: "25%",
    explanation: "The increase is $20,000. Divide by the original $80,000: 20,000 / 80,000 = 25%.",
  },
  {
    question: "A project costs $60 and sells for $80. What is the gross profit per item?",
    choices: ["$10", "$15", "$20", "$25"],
    answer: "$20",
    explanation: "Gross profit per item = selling price - cost = $80 - $60 = $20.",
  },
  {
    question: "Your monthly income is $2,000 and expenses are $1,500. What remains before other adjustments?",
    choices: ["$250", "$400", "$500", "$750"],
    answer: "$500",
    explanation: "Remaining cash = income - expenses = $2,000 - $1,500 = $500.",
  },
  {
    question: "A portfolio value moves from $1,000 to $1,080. Ignoring fees and cash flows, what is the return?",
    choices: ["4%", "6%", "8%", "10%"],
    answer: "8%",
    explanation: "Return = (ending value - starting value) / starting value = 80 / 1,000 = 8%.",
  },
];

export function Finance404Game() {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const challenge = challenges[round];

  function choose(choice: string) {
    if (finished) return;

    setSelected((current) => {
      if (current !== null) return current;
      if (choice === challenge.answer) {
        setScore((currentScore) => currentScore + 1);
      }
      return choice;
    });
  }

  function next() {
    if (selected === null) return;
    if (round === challenges.length - 1) {
      setFinished(true);
      return;
    }
    setRound((current) => current + 1);
    setSelected(null);
  }

  function restart() {
    setRound(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
  }

  return (
    <section
      className="finance-404-game"
      data-game-ready="true"
      aria-labelledby="finance-game-title"
    >
      <div className="finance-game-topline">
        <span className="finance-game-icon">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <span>THE FINANCE TIMEOUT</span>
      </div>

      <h2 id="finance-game-title">A quick finance brain break</h2>
      <p className="finance-game-intro">Seven bite-size questions. No spreadsheet needed.</p>

      {!finished ? (
        <>
          <div className="finance-game-progress">
            <span>Question {round + 1} of {challenges.length}</span>
            <span>Score: {score}</span>
          </div>
          <div className="finance-game-track" aria-hidden="true">
            <span style={{ width: `${((round + 1) / challenges.length) * 100}%` }} />
          </div>
          <h3 className="finance-game-question">{challenge.question}</h3>
          <div className="finance-game-choices">
            {challenge.choices.map((choice) => {
              const isAnswer = selected !== null && choice === challenge.answer;
              const isWrongSelection = selected === choice && choice !== challenge.answer;

              return (
                <button
                  type="button"
                  key={choice}
                  className={`finance-game-choice${isAnswer ? " is-correct" : ""}${isWrongSelection ? " is-wrong" : ""}`}
                  onClick={() => choose(choice)}
                  disabled={selected !== null}
                  aria-pressed={selected === choice}
                >
                  <span>{choice}</span>
                  <span className="finance-choice-mark" aria-hidden="true">
                    {isAnswer ? "Correct" : isWrongSelection ? "Try again" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div
              className={`finance-game-feedback${selected === challenge.answer ? " is-correct" : " is-wrong"}`}
              role="status"
              aria-live="polite"
            >
              <strong>
                {selected === challenge.answer
                  ? "Correct! Nice calculation."
                  : `Not quite - the answer is ${challenge.answer}.`}
              </strong>
              <p>{challenge.explanation}</p>
            </div>
          )}

          <button className="finance-game-next" type="button" onClick={next} disabled={selected === null}>
            {round === challenges.length - 1 ? "See my score" : "Next question"}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </>
      ) : (
        <div className="finance-game-finished" role="status" aria-live="polite">
          <div className="finance-game-score">
            {score}<span> / {challenges.length}</span>
          </div>
          <h3>
            {score === challenges.length
              ? "Perfect balance!"
              : score >= 5
                ? "Strong financial instincts."
                : score >= 3
                  ? "A solid start."
                  : "Every analyst keeps learning."}
          </h3>
          <p>You completed the mini challenge. Ready for a fresh run?</p>
          <button className="finance-game-next" type="button" onClick={restart}>
            <RotateCcw size={15} aria-hidden="true" />
            Play again
          </button>
        </div>
      )}

      <p className="finance-game-disclaimer">For fun and learning only - not financial advice.</p>
    </section>
  );
}