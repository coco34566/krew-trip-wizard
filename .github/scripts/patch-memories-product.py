from pathlib import Path
import re

path = Path("src/routes/_authenticated/trips.$tripId.memories.tsx")
text = path.read_text()

text = text.replace(
    '  const [showAlbum, setShowAlbum] = useState(false);\n',
    '  const [showAlbum, setShowAlbum] = useState(false);\n  const [editSelection, setEditSelection] = useState(false);\n',
    1,
)

text = text.replace(
    '{selection.length} souvenir{selection.length > 1 ? "s" : ""} dans ta sélection',
    '{selection.length} souvenir{selection.length > 1 ? "s" : ""} sélectionné\n                {selection.length > 1 ? "s" : ""}',
    1,
)

selection_info_pattern = re.compile(
    r'      \{photos\.length > 0 \? \(\n        <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 font-sans text-\[13px\] text-foreground/90 sm:text-sm" aria-label="Sélection KREW">.*?        </section>\n      \) : null\}',
    re.S,
)
selection_info_replacement = '''      {photos.length > 0 && (\n        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] sm:text-sm text-foreground/90 font-sans">\n          <strong>KREW a sélectionné {selection.length} photos</strong> parmi {photos.length} photos\n          du voyage. La sélection répartit les photos sur les différentes journées et tient compte\n          des appréciations du groupe.\n        </div>\n      )}'''
text, count = selection_info_pattern.subn(selection_info_replacement, text, count=1)
if count != 1:
    raise SystemExit("selection info block not found")

cards_pattern = re.compile(
    r'          \{photos\.map\(\(photo, index\) => \{.*?          \}\)\}\n',
    re.S,
)
cards_replacement = '''          {photos.map((photo, index) => {\n            const hasRotation =\n              index % 5 === 1 ? "rotate-[1deg]" : index % 5 === 3 ? "-rotate-[1deg]" : "";\n            return (\n              <article\n                key={photo.id}\n                className={cn(\n                  "group overflow-hidden rounded-[18px] border border-border/40 bg-background transition-transform duration-200 hover:-translate-y-0.5 shadow-2xs",\n                  hasRotation,\n                )}\n              >\n                <div className="aspect-[4/3] bg-muted relative overflow-hidden">\n                  <img\n                    src={photo.url}\n                    alt={photoAlt(photo)}\n                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"\n                    loading="lazy"\n                  />\n                  {photo.likes > 0 ? (\n                    <div className="absolute top-2.5 right-2.5 z-10">\n                      <KrewMark type="heart" tone="plum" size="sm" className="size-5" />\n                    </div>\n                  ) : null}\n                </div>\n                <div className="p-3.5 flex items-center justify-between text-[13px] sm:text-sm text-muted-foreground font-sans">\n                  <span>\n                    Par <strong className="text-foreground font-semibold">{photo.author}</strong>\n                  </span>\n                  <div className="flex items-center gap-1">\n                    <button\n                      type="button"\n                      onClick={() => like.mutate(photo.id)}\n                      disabled={like.isPending}\n                      aria-busy={like.isPending}\n                      className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 hover:text-primary transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"\n                      aria-label={photo.likedByMe ? "Retirer mon appréciation" : "J’aime cette photo"}\n                    >\n                      <KrewIcon\n                        name="favorite"\n                        tone={photo.likedByMe ? "plum" : "muted"}\n                        size="sm"\n                        className="size-3.5"\n                      />\n                      <span className="font-mono text-xs font-semibold">{photo.likes}</span>\n                    </button>\n                    {photo.owner_user_id === userId && (\n                      <button\n                        type="button"\n                        onClick={() => setPhotoToDelete(photo)}\n                        disabled={remove.isPending}\n                        aria-busy={remove.isPending}\n                        className="inline-flex size-10 items-center justify-center rounded-lg hover:text-destructive transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"\n                        aria-label="Supprimer la photo"\n                      >\n                        <Trash2 className="size-3.5" />\n                      </button>\n                    )}\n                  </div>\n                </div>\n              </article>\n            );\n          })}\n'''
text, count = cards_pattern.subn(cards_replacement, text, count=1)
if count != 1:
    raise SystemExit("photo cards block not found")

album_close = '<button type="button" onClick={() => setShowAlbum(false)} aria-label="Fermer" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"><X className="size-5" /></button>'
album_controls = '''<div className="flex items-center gap-2">\n                <Button\n                  variant="outline"\n                  size="sm"\n                  className="min-h-9 rounded-xl text-xs"\n                  onClick={() => setEditSelection((current) => !current)}\n                >\n                  {editSelection ? "Voir l’album" : "Personnaliser"}\n                </Button>\n                <button\n                  type="button"\n                  onClick={() => {\n                    setEditSelection(false);\n                    setShowAlbum(false);\n                  }}\n                  aria-label="Fermer"\n                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg"\n                >\n                  <X className="size-5" />\n                </button>\n              </div>'''
if album_close not in text:
    raise SystemExit("album close button not found")
text = text.replace(album_close, album_controls, 1)

album_anchor = '            <div className="space-y-12 p-5 sm:p-8">\n'
editor = '''            <div className="space-y-12 p-5 sm:p-8">\n              {editSelection ? (\n                <section className="space-y-4 rounded-[24px] border border-primary/20 bg-primary/5 p-4 sm:p-5" aria-label="Personnaliser la sélection KREW">\n                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">\n                    <div>\n                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">Ta sélection</p>\n                      <h3 className="font-display text-2xl font-normal text-foreground">Choisis les moments à garder</h3>\n                      <p className="mt-1 max-w-2xl font-sans text-[13px] leading-relaxed text-muted-foreground">\n                        KREW équilibre automatiquement les journées, les auteurs et les appréciations. Tes ajustements restent personnels sur cet appareil et ne changent pas la sélection des autres participants.\n                      </p>\n                    </div>\n                    {hasSelectionOverrides ? (\n                      <Button variant="ghost" size="sm" className="min-h-9 shrink-0 rounded-xl text-xs" onClick={resetSelection}>\n                        Revenir à la sélection KREW\n                      </Button>\n                    ) : null}\n                  </div>\n                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">\n                    {photos.map((photo) => {\n                      const isSelected = selectionIds.has(photo.id);\n                      return (\n                        <article key={photo.id} className={cn("overflow-hidden rounded-2xl border bg-background", isSelected ? "border-primary/40 ring-1 ring-primary/15" : "border-border/40")}>\n                          <div className="aspect-[4/3] overflow-hidden bg-muted">\n                            <img src={photo.url} alt={photoAlt(photo)} className="h-full w-full object-cover" loading="lazy" />\n                          </div>\n                          <div className="space-y-2 p-2.5">\n                            <p className="truncate font-sans text-xs font-medium text-foreground">{photo.original_filename || `Photo de ${photo.author}`}</p>\n                            <p className="min-h-8 font-sans text-[10px] leading-tight text-muted-foreground">\n                              {isSelected ? selectionReason(photo) : "Pas dans la sélection actuelle"}\n                            </p>\n                            <Button\n                              variant={isSelected ? "outline" : "default"}\n                              size="sm"\n                              className="min-h-8 w-full rounded-lg text-[11px]"\n                              onClick={() => toggleSelection(photo)}\n                            >\n                              {isSelected ? "Retirer" : "Ajouter"}\n                            </Button>\n                          </div>\n                        </article>\n                      );\n                    })}\n                  </div>\n                </section>\n              ) : null}\n'''
if album_anchor not in text:
    raise SystemExit("album content anchor not found")
text = text.replace(album_anchor, editor, 1)

text = text.replace(
    '<Button variant="outline" size="sm" className="min-h-10 rounded-xl" onClick={() => setShowAlbum(false)}>Fermer</Button>',
    '<Button variant="outline" size="sm" className="min-h-10 rounded-xl" onClick={() => { setEditSelection(false); setShowAlbum(false); }}>Fermer</Button>',
    1,
)

path.write_text(text)

# Update the characterization test so selection customization is exercised inside the album.
test_path = Path("src/routes/_authenticated/__tests__/trips.$tripId.memories.characterization.test.tsx")
test = test_path.read_text()
old = '''  it("lets the viewer remove an automatic photo from their personal KREW selection", async () => {\n    const user = userEvent.setup();\n    renderMemories();\n\n    expect(screen.getByText("1 souvenir dans ta sélection")).toBeInTheDocument();\n    await user.click(screen.getByRole("button", { name: "Retirer" }));\n\n    expect(screen.getByText("Pas dans la sélection actuelle")).toBeInTheDocument();\n    expect(JSON.parse(localStorage.getItem("krew_memories_selection:trip-123") || "{}"))\n      .toEqual({ included: [], excluded: ["photo-1"] });\n  });'''
new = '''  it("lets the viewer personalize their KREW selection from the album", async () => {\n    const user = userEvent.setup();\n    renderMemories();\n\n    expect(screen.getByText("1 souvenir sélectionné")).toBeInTheDocument();\n    await user.click(screen.getByRole("button", { name: "Album" }));\n    await user.click(screen.getByRole("button", { name: "Personnaliser" }));\n    expect(screen.getByLabelText("Personnaliser la sélection KREW")).toBeInTheDocument();\n\n    await user.click(screen.getByRole("button", { name: "Retirer" }));\n    expect(screen.getByText("Pas dans la sélection actuelle")).toBeInTheDocument();\n    expect(JSON.parse(localStorage.getItem("krew_memories_selection:trip-123") || "{}"))\n      .toEqual({ included: [], excluded: ["photo-1"] });\n  });'''
if old not in test:
    raise SystemExit("selection characterization test not found")
test = test.replace(old, new, 1)
test_path.write_text(test)
