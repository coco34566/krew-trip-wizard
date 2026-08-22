import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, X, Settings, Loader2, Trash2, BookOpen, ExternalLink } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sha256File } from "@/lib/souvenirs-photo-upload";
import { createPhotosZip } from "@/lib/souvenirs-download";
import { KrewIcon, KrewMark, KrewOrganicBlob } from "@/components/krew/visual-language";

const PHOTO_BOOK_PARTNER = { name: "CEWE", url: "https://www.cewe.fr/livres-photo-cewe.html", affiliateDisclosure: "KREW peut percevoir une rémunération si tu effectues un achat via un lien partenaire. Cela ne modifie pas le prix payé." };
export const Route = createFileRoute("/_authenticated/trips/$tripId/memories")({ head: () => ({ meta: [{ title: "Souvenirs du voyage — KREW" }] }), component: MemoriesPage });
type Photo = { id:string; trip_id:string; url:string; author:string; likes:number; created_at:string; storage_path?:string|null; owner_user_id?:string|null; original_filename?:string|null };
async function signPhotoUrls(rows:any[]):Promise<Photo[]> { return Promise.all(rows.map(async row => { if(!row.storage_path)return {...row,url:row.url||""} as Photo; const {data,error}=await supabase.storage.from("trip-photos").createSignedUrl(row.storage_path,3600); if(error)throw error; return {...row,url:data.signedUrl} as Photo; })); }
function err(e:unknown){if(e&&typeof e==="object"){const x=e as any;return [x.message,x.details,x.hint,x.code?`code ${x.code}`:""].filter(Boolean).join(" — ");}return String(e||"Erreur inconnue");}
function fileName(p:Photo,i:number){return (p.original_filename?.trim()||`photo-${String(i+1).padStart(3,"0")}.jpg`).replace(/[\\/:*?"<>|]/g,"-");}
function buildKrewSelection(photos:Photo[]){if(photos.length<=12)return [...photos];const target=Math.min(120,Math.max(12,Math.round(photos.length*.14)));const buckets=new Map<string,Photo[]>();for(const p of [...photos].sort((a,b)=>b.likes-a.likes)){const d=new Date(p.created_at).toISOString().slice(0,10);const b=buckets.get(d)||[];b.push(p);buckets.set(d,b);}const days=[...buckets.keys()].sort();const out:Photo[]=[];let i=0;while(out.length<target&&days.length){const d=days[i%days.length],b=buckets.get(d)!;const p=b.shift();if(p)out.push(p);if(!b.length){buckets.delete(d);days.splice(i%days.length,1);i=0;}else i++;}return out.sort((a,b)=>+new Date(a.created_at)-+new Date(b.created_at));}

function MemoriesPage(){
 const {tripId}=Route.useParams();const fileInputRef=useRef<HTMLInputElement>(null);const qc=useQueryClient();const [userId,setUserId]=useState<string|null>(null);const [userName,setUserName]=useState("Moi");const [uploading,setUploading]=useState(false);const [downloading,setDownloading]=useState(false);const [showAlbum,setShowAlbum]=useState(false);const [showPartner,setShowPartner]=useState(false);const [permission,setPermission]=useState<"granted"|"denied"|"prompt">("prompt");const [showModal,setShowModal]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem("krew_photo_permission");if(saved==="granted"||saved==="denied")setPermission(saved);supabase.auth.getUser().then(({data:{user}})=>{if(!user)return;setUserId(user.id);supabase.from("trip_participants").select("display_name").eq("trip_id",tripId).eq("user_id",user.id).maybeSingle().then(({data})=>{if(data?.display_name)setUserName(data.display_name);});});},[tripId]);
 const {data:photos=[],isLoading}=useQuery<Photo[]>({queryKey:["trip-photos",tripId],queryFn:async()=>{const {data,error}=await supabase.from("trip_photos" as any).select("*").eq("trip_id",tripId).is("deleted_at",null).order("created_at",{ascending:false});if(error)throw error;return signPhotoUrls(data||[]);}});const selection=buildKrewSelection(photos);const days=selection.reduce((map,p)=>{const key=new Date(p.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});const list=map.get(key)||[];list.push(p);map.set(key,list);return map;},new Map<string,Photo[]>());
 const like=useMutation({mutationFn:async(id:string)=>{const {error}=await supabase.rpc("increment_trip_photo_likes",{p_photo_id:id});if(error)throw error;},onSuccess:()=>qc.invalidateQueries({queryKey:["trip-photos",tripId]}),onError:()=>toast.error("Impossible d'enregistrer le like.")});
 const remove=useMutation({mutationFn:async(p:Photo)=>{if(p.storage_path){const {error}=await supabase.storage.from("trip-photos").remove([p.storage_path]);if(error)throw error;}const {error}=await supabase.from("trip_photos" as any).update({deleted_at:new Date().toISOString()}).eq("id",p.id);if(error)throw error;},onSuccess:()=>{qc.invalidateQueries({queryKey:["trip-photos",tripId]});toast.success("Photo supprimée.");},onError:e=>toast.error(`Impossible de supprimer la photo : ${err(e)}`)});
 const download=async(isSelection=false)=>{const source=isSelection?selection:photos;if(!source.length)return;setDownloading(true);try{const used=new Set<string>();const files=source.filter((p,i)=>{const n=fileName(p,i);if(used.has(n))return false;used.add(n);return true;}).map((p,i)=>({name:fileName(p,i),url:p.url}));const blob=await createPhotosZip(files);const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`krew-${isSelection?"selection":"photos"}-${tripId}.zip`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);toast.success(`${files.length} photo(s) préparée(s) dans le ZIP.`);}catch(e){toast.error(`Impossible de préparer le téléchargement : ${err(e)}`);}finally{setDownloading(false);}};
 const upload=async(e:React.ChangeEvent<HTMLInputElement>)=>{const files=Array.from(e.target.files||[]);e.target.value="";if(!userId||!files.length){if(!userId&&files.length)toast.error("Tu dois être connecté pour importer une photo.");return;}setUploading(true);let added=0,duplicates=0;try{for(const file of files){if(!file.type.startsWith("image/")){toast.error(`${file.name} n'est pas une image prise en charge.`);continue;}const hash=await sha256File(file);const {data:dup,error:de}=await supabase.from("trip_photos" as any).select("id").eq("trip_id",tripId).eq("content_hash",hash).is("deleted_at",null).maybeSingle();if(de)throw de;if(dup){duplicates++;continue;}const id=crypto.randomUUID(),ext=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg",path=`${tripId}/${userId}/${id}.${ext}`;const {error:ue}=await supabase.storage.from("trip-photos").upload(path,file,{contentType:file.type,upsert:false});if(ue)throw ue;const {error:ie}=await supabase.from("trip_photos" as any).insert({id,trip_id:tripId,owner_user_id:userId,storage_path:path,author:userName,likes:0,content_hash:hash,original_filename:file.name,mime_type:file.type,file_size_bytes:file.size});if(ie){await supabase.storage.from("trip-photos").remove([path]);throw ie;}added++;}await qc.invalidateQueries({queryKey:["trip-photos",tripId]});if(added)toast.success(`${added} photo(s) ajoutée(s) à l'album.`);if(duplicates)toast.info(`${duplicates} doublon(s) exact(s) ignoré(s).`);}catch(e){toast.error(`Impossible d'importer la photo : ${err(e)}`);}finally{setUploading(false);}};

 return (
    <main className="mx-auto max-w-[1020px] px-5 sm:px-6 lg:px-10 py-8 sm:py-12 space-y-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 relative">
        <div className="space-y-2 relative">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-4 -left-4 w-[160px] h-[60px] opacity-40 pointer-events-none z-0"
          />
          <div className="flex items-center gap-2 text-primary relative z-10">
            <KrewIcon name="camera" tone="plum" size="sm" className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">Souvenirs</span>
          </div>
          <div className="relative inline-block z-10">
            <h1 className="font-display text-[36px] sm:text-[44px] font-normal leading-tight text-foreground">
              L&apos;album du voyage
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-0 -bottom-1.5 w-[140px] pointer-events-none"
            />
          </div>
          <p className="text-sm text-muted-foreground font-sans">
            Retrouve les meilleurs moments partagés avec le groupe.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {photos.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-medium" onClick={() => download(false)} disabled={downloading}>
                <Download className="size-3.5 mr-1" /> Toutes ({photos.length})
              </Button>
              <Button size="sm" className="rounded-xl text-xs font-medium" onClick={() => download(true)} disabled={downloading}>
                <KrewIcon name="favorite" tone="cream" size="sm" className="size-3.5 mr-1" /> Sélection KREW ({selection.length})
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-medium" onClick={() => setShowAlbum(true)}>
                <BookOpen className="size-3.5 mr-1" /> Album
              </Button>
            </>
          )}
          {photos.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-medium" onClick={() => setShowPartner(true)}>
              <ExternalLink className="size-3.5 mr-1" /> Imprimer
            </Button>
          )}
          {permission !== "prompt" && (
            <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => { localStorage.removeItem("krew_photo_permission"); setPermission("prompt"); }}>
              <Settings className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      {photos.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs sm:text-sm text-foreground/90 font-sans">
          <strong>KREW a sélectionné {selection.length} photos</strong> parmi {photos.length} photos du voyage. La sélection répartit les photos sur les différentes journées et tient compte des appréciations du groupe.
        </div>
      )}

      <section className="rounded-[24px] border border-dashed border-border bg-surface/30 p-8 text-center space-y-3">
        <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={upload} className="hidden" />
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KrewIcon name="plus" tone="plum" size="sm" className="size-6" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">Ajoute tes photos de voyage</p>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">Stockage privé, accessible uniquement aux participants autorisés.</p>
        </div>
        <div className="pt-1">
          <Button size="sm" className="rounded-xl font-medium" disabled={uploading} onClick={() => permission === "granted" ? fileInputRef.current?.click() : setShowModal(true)}>
            {uploading ? <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Importation...</> : "Choisir des photos"}
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto animate-spin text-primary size-6" />
        </div>
      ) : !photos.length ? (
        <div className="py-12 text-center border border-dashed border-border rounded-[24px] p-8 space-y-3">
          <div className="mx-auto w-12 h-12 flex items-center justify-center">
            <img src="/brand/otter-states/trip-progress.png" alt="" className="w-10 h-auto object-contain" />
          </div>
          <h2 className="font-display text-xl font-normal text-foreground">L&apos;album est encore vide</h2>
          <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">Importe les premières photos pour constituer l'album du voyage.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((p) => (
            <article key={p.id} className="group overflow-hidden rounded-[20px] border border-border/60 bg-background transition-transform duration-200 hover:-translate-y-0.5">
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                <img src={p.url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                {p.likes > 0 ? (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <KrewMark type="heart" tone="plum" size="sm" className="size-5" />
                  </div>
                ) : null}
              </div>
              <div className="p-3 flex items-center justify-between text-xs text-muted-foreground font-sans">
                <span>Par <strong className="text-foreground font-medium">{p.author}</strong></span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => like.mutate(p.id)} className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                    <KrewIcon name="favorite" tone={p.likes > 0 ? "plum" : "muted"} size="sm" className="size-3.5" />
                    <span className="font-mono text-[11px] font-semibold">{p.likes}</span>
                  </button>
                  {p.owner_user_id === userId && (
                    <button type="button" onClick={() => remove.mutate(p)} className="hover:text-destructive transition-colors cursor-pointer" aria-label="Supprimer photo">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-[24px] p-6 max-w-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-normal text-foreground">Autorisation d&apos;import</h3>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Fermer"><X className="size-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Les photos sont stockées dans un espace privé et accessibles uniquement aux participants autorisés.
            </p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" className="rounded-xl font-medium w-full" onClick={() => { localStorage.setItem("krew_photo_permission", "granted"); setPermission("granted"); setShowModal(false); setTimeout(() => fileInputRef.current?.click(), 150); }}>
                Autoriser
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl font-medium w-full" onClick={() => { localStorage.setItem("krew_photo_permission", "denied"); setPermission("denied"); setShowModal(false); }}>
                Refuser
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAlbum && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-5xl rounded-[28px] bg-card border border-border/60 shadow-xl overflow-hidden">
            <div className="p-5 sm:p-7 flex items-center justify-between border-b border-border/50">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">Souvenirs KREW</p>
                <h2 className="font-display text-2xl sm:text-3xl font-normal text-foreground">Notre voyage en images</h2>
                <p className="text-xs text-muted-foreground font-sans mt-0.5">{selection.length} moments sélectionnés · {days.size} journée(s)</p>
              </div>
              <button type="button" onClick={() => setShowAlbum(false)} aria-label="Fermer"><X className="size-5" /></button>
            </div>
            <div className="p-5 sm:p-8 space-y-10">
              <div className="rounded-[24px] overflow-hidden border border-border/50 bg-muted aspect-[16/8] relative">
                {selection[0] && <img src={selection[0].url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6 sm:p-10">
                  <div className="text-white">
                    <p className="text-xs uppercase tracking-[0.2em] font-mono">KREW</p>
                    <h3 className="font-display text-3xl sm:text-5xl font-normal">Notre voyage</h3>
                    <p className="text-xs mt-1 opacity-90 font-sans">Une sélection de {selection.length} souvenirs</p>
                  </div>
                </div>
              </div>
              {[...days.entries()].map(([day, items]) => (
                <section key={day} className="space-y-3">
                  <h4 className="font-display text-xl font-normal text-foreground">{day}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {items.map((p, i) => (
                      <figure key={p.id} className="space-y-1">
                        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border/40">
                          <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                        <figcaption className="text-[11px] text-muted-foreground truncate font-sans">{p.original_filename || `Souvenir ${i + 1}`}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="p-5 sm:p-7 border-t border-border/50 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowAlbum(false)}>Fermer</Button>
              <Button size="sm" className="rounded-xl font-medium" onClick={() => download(true)} disabled={downloading}>
                <Download className="size-3.5 mr-1.5" /> Télécharger la sélection
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPartner && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[24px] bg-card border border-border/60 p-6 space-y-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">Prestataire externe</p>
                <h2 className="font-display text-2xl font-normal text-foreground">Créer un album photo</h2>
              </div>
              <button type="button" onClick={() => setShowPartner(false)} aria-label="Fermer"><X className="size-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              KREW ne vend ni n&apos;imprime l&apos;album. Tu vas être redirigé·e vers <strong>{PHOTO_BOOK_PARTNER.name}</strong>, un prestataire externe, pour créer et commander ton album.
            </p>
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-xs font-sans space-y-1">
              <p className="font-semibold text-foreground">Ta sélection KREW : {selection.length} photos</p>
              <p className="text-muted-foreground leading-relaxed">
                Pour des raisons de confidentialité, KREW ne transmet pas automatiquement tes photos au prestataire. Télécharge d&apos;abord la sélection puis importe-la chez le prestataire.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-sans">{PHOTO_BOOK_PARTNER.affiliateDisclosure}</p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowPartner(false)}>Annuler</Button>
              <Button size="sm" className="rounded-xl font-medium" asChild>
                <a href={PHOTO_BOOK_PARTNER.url} target="_blank" rel="noopener noreferrer">
                  Continuer vers {PHOTO_BOOK_PARTNER.name} <ExternalLink className="size-3.5 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
