import type { ReactNode } from "react";
import "./krew-note-concept.css";

type ConceptVariant = "paper" | "torn-strip" | "photo" | "ticket";
type ConceptTone = "cream" | "sage" | "plum";

type KrewNoteConceptProps = {
  variant: ConceptVariant;
  tone?: ConceptTone;
  children: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function KrewNoteConcept({
  variant,
  tone = "cream",
  children,
  eyebrow,
  className = "",
}: KrewNoteConceptProps) {
  const note = (
    <span
      className={["krew-note-concept", `krew-note-concept--${variant}`, `krew-note-concept--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {variant !== "torn-strip" && <span className="krew-note-concept__tape" aria-hidden="true" />}
      {eyebrow && <span className="krew-note-concept__eyebrow">{eyebrow}</span>}
      <span className="krew-note-concept__copy">{children}</span>
    </span>
  );

  if (variant !== "photo") return note;

  return (
    <span className="krew-note-concept-photo">
      <span className="krew-note-concept-photo__image" aria-hidden="true" />
      {note}
    </span>
  );
}
