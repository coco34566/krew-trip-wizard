import { KrewAwards } from "@/components/krew/KrewAwards";
import { KrewIcon, KrewMark, KrewNote, KrewOrganicBlob } from "@/components/krew/visual-language";
import type { TripRecap } from "@/lib/krew/trip-recap";

type RecapPhoto = {
  id: string;
  url: string;
  alt: string;
};

type Props = {
  recap: TripRecap;
  tripName?: string | null;
  photos?: RecapPhoto[];
};

export function KrewRecapCard({ recap, tripName, photos = [] }: Props) {
  if (!recap.eligible || !recap.destinationName) return null;

  const headline = recap.durationDays
    ? `${recap.durationDays} jour${recap.durationDays > 1 ? "s" : ""} à ${recap.destinationName}`
    : `Notre voyage à ${recap.destinationName}`;
  const visiblePhotos = photos.filter((photo) => photo.url).slice(0, 3);

  return (
    <section aria-labelledby="krew-recap-title" className="relative overflow-hidden rounded-[30px_24px_34px_26px] border border-primary/15 bg-[#fffefa] px-5 py-6 shadow-[0_18px_45px_-34px_rgba(42,25,37,.42)] sm:px-8 sm:py-8">
      <KrewOrganicBlob
        tone="sage"
        variant="soft"
        className="pointer-events-none absolute -right-16 -top-12 h-[190px] w-[300px] opacity-45"
      />
      <KrewOrganicBlob
        tone="plum"
        variant="soft"
        className="pointer-events-none absolute -bottom-20 -left-20 h-[180px] w-[270px] opacity-[.08]"
      />

      <div className="relative z-10 grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)] md:items-center md:gap-10">
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <KrewIcon name="favorite" tone="plum" size="sm" className="size-4" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-primary">
              Krew Recap
            </span>
          </div>

          <KrewNote variant="margin" rotation={-2} className="mb-2 text-sage">
            C&apos;était notre voyage
          </KrewNote>

          <div className="relative inline-block max-w-full pb-3">
            <h1 id="krew-recap-title" className="font-display text-[38px] font-normal leading-[.95] tracking-tight text-foreground sm:text-[48px]">
              {headline}
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="lg"
              className="pointer-events-none absolute -bottom-1 left-0 h-4 w-[150px] opacity-75 sm:w-[190px]"
            />
          </div>

          <div className="mt-5 space-y-1.5 text-sm text-muted-foreground">
            {tripName ? <p className="font-handwriting text-[19px] leading-none text-primary">{tripName}</p> : null}
            {recap.dateLabel ? <p>{recap.dateLabel}</p> : null}
            {recap.country ? <p>{recap.country}</p> : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-dashed border-sage/35 pt-4 text-[13px] text-foreground sm:text-sm">
            {recap.participantsCount ? (
              <span className="inline-flex items-center gap-1.5">
                <KrewIcon name="group" tone="plum" size="sm" className="size-4" />
                <strong className="font-semibold">{recap.participantsCount}</strong> dans la Krew
              </span>
            ) : null}
            {recap.activitiesCount ? (
              <span className="inline-flex items-center gap-1.5">
                <KrewIcon name="planning" tone="sage" size="sm" className="size-4" />
                <strong className="font-semibold">{recap.activitiesCount}</strong> activité{recap.activitiesCount > 1 ? "s" : ""} retenue{recap.activitiesCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          {recap.accommodationName ? (
            <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
              <KrewIcon name="accommodation" tone="muted" size="sm" className="mt-0.5 size-4 shrink-0" />
              <span>Notre camp de base : <strong className="font-medium text-foreground">{recap.accommodationName}</strong></span>
            </p>
          ) : null}
        </div>

        {visiblePhotos.length ? (
          <div className="relative mx-auto w-full max-w-[390px] pb-3 pt-2 md:mx-0">
            <div className="grid grid-cols-2 gap-3">
              {visiblePhotos.map((photo, index) => (
                <figure
                  key={photo.id}
                  className={`relative bg-white p-2 pb-5 shadow-[0_10px_25px_-16px_rgba(42,25,37,.45)] ring-1 ring-black/[.06] ${
                    index === 0
                      ? "col-span-2 rotate-[-1deg]"
                      : index === 1
                        ? "rotate-[1.5deg]"
                        : "rotate-[-1.2deg] translate-y-1"
                  }`}
                >
                  <div className={index === 0 ? "aspect-[16/9] overflow-hidden bg-muted" : "aspect-square overflow-hidden bg-muted"}>
                    <img src={photo.url} alt={photo.alt} className="size-full object-cover" loading="lazy" />
                  </div>
                </figure>
              ))}
            </div>
            <KrewNote variant="tape-strip" tone="cream" rotation={2} className="absolute -top-1 right-[12%]">
              Tape
            </KrewNote>
          </div>
        ) : (
          <div className="relative mx-auto flex min-h-[230px] w-full max-w-[360px] items-center justify-center rounded-[28px_34px_24px_38px] border border-dashed border-sage/45 bg-sage/[.07] px-8 text-center md:min-h-[280px]">
            <KrewMark type="sparkle" tone="sage" size="lg" className="absolute right-7 top-6 h-8 w-8 opacity-60" />
            <div className="max-w-[220px]">
              <img src="/brand/otter-states/trip-progress.png" alt="" className="mx-auto mb-3 h-auto w-[72px] object-contain opacity-90" />
              <p className="font-display text-[24px] font-normal leading-tight text-foreground">Un souvenir qui tient aussi sans photo</p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Les moments du groupe restent juste en dessous si des photos sont ajoutées.</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <KrewAwards />
      </div>
    </section>
  );
}
